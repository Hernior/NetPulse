'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawn,execFile} = require('child_process');
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR=path.join(__dirname,'dados'); const EVENTS_FILE=path.join(DATA_DIR,'quedas.json');
fs.mkdirSync(DATA_DIR,{recursive:true});
function loadEvents(){try{const data=JSON.parse(fs.readFileSync(EVENTS_FILE,'utf8'));return Array.isArray(data.events)?data.events:[]}catch{return []}}
let events=loadEvents(), outages=new Map(), sequence=events.reduce((m,e)=>Math.max(m,e.id||0),0);
for(const e of events){if(e.end===null&&e.targetId){e.end=e.start;e.durationSeconds=0;e.status='monitoramento_interrompido';e.reason=(e.reason||'')+' | Monitoramento interrompido antes da recuperação; duração desconhecida.'}}
function saveEvents(){const payload={schema:1,description:'NetPulse - registro de incidentes (horarios ISO 8601)',updatedAt:new Date().toISOString(),events};const tmp=EVENTS_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(payload,null,2),'utf8');fs.renameSync(tmp,EVENTS_FILE)}
saveEvents();
function updateOutage(id,name,failed,ts,reason){let e=outages.get(id);if(failed&&!e){e={id:++sequence,targetId:id,target:name,start:new Date(ts).toISOString(),end:null,durationSeconds:null,reason:reason||'Falha nos testes',status:'em_andamento'};events.push(e);outages.set(id,e);saveEvents()}else if(!failed&&e){e.end=new Date(ts).toISOString();e.durationSeconds=Math.round((ts-Date.parse(e.start))/1000);e.status='encerrada';outages.delete(id);saveEvents()}}
function currentEvents(){return events.slice(-1000).map(e=>e.end?e:{...e,durationSeconds:Math.max(0,Math.round((Date.now()-Date.parse(e.start))/1000))})}

const INTERVAL = 4000, MAX_HISTORY = 1200;
const IS_WIN = process.platform === 'win32';
const HOSTS = [
  {id:'cloudflare',name:'Cloudflare DNS',host:'1.1.1.1',kind:'dns'},
  {id:'google',name:'Google DNS',host:'8.8.8.8',kind:'dns'},
  {id:'quad9',name:'Quad9 DNS',host:'9.9.9.9',kind:'dns'},
  {id:'opendns',name:'OpenDNS',host:'208.67.222.222',kind:'dns'},
  {id:'internet',name:'Internet (HTTP)',host:'https://www.google.com/generate_204',kind:'http'}
];
const records = new Map(HOSTS.map(h=>[h.id,{...h,status:'pending',lastMs:null,checks:0,success:0,fail:0,streak:0,lastCheck:null,history:[]}]));
let gateway=null, gatewayRecord=null, running=true, diagnostics=[], traceBusy=false, nextTraceTime=0, started=Date.now();
function exec(command,args,timeoutMs=5500){return new Promise(resolve=>{
  const proc=spawn(command,args,{windowsHide:true});let out='',err='',done=false;
  const finish=(result)=>{if(done)return;done=true;clearTimeout(timer);resolve(result)};
  const timer=setTimeout(()=>{proc.kill();finish({code:-1,out,err:'timeout'})},timeoutMs);
  proc.stdout.on('data',d=>{out+=d.toString();if(out.length>40000)out=out.slice(-40000)});
  proc.stderr.on('data',d=>{err+=d.toString()});
  proc.on('error',e=>finish({code:-1,out,err:e.message}));
  proc.on('close',code=>finish({code,out,err}));
})}
function parseLatency(s){let m=s.match(/(?:tempo|time)\s*[=<]\s*(\d+(?:[.,]\d+)?)\s*ms/i);if(m)return Number(m[1].replace(',','.'));m=s.match(/(?:m[eé]dia|average|avg)\s*[=:]\s*(\d+(?:[.,]\d+)?)/i);return m?Number(m[1].replace(',','.')):null}
async function ping(host){const args=IS_WIN?['-n','1','-w','1900',host]:['-n','-c','1','-W','2',host];const start=performance.now();const r=await exec('ping',args,3000);return {ok:r.code===0,ms:r.code===0?(parseLatency(r.out)??Math.round(performance.now()-start)):null,reason:r.code!==0?(r.err||r.out.split('\n').filter(Boolean).slice(-2).join(' ').trim()||'Sem resposta').slice(0,160):null}}
async function testHttp(url){return new Promise(resolve=>{const t0=performance.now();const req=require('https').get(url,{timeout:2500,headers:{'user-agent':'NetPulseLocal/1.0'}},res=>{res.resume();resolve({ok:res.statusCode>=200&&res.statusCode<400,ms:Math.round(performance.now()-t0),reason:res.statusCode>=400?'HTTP '+res.statusCode:null})});req.on('timeout',()=>req.destroy(new Error('Tempo esgotado')));req.on('error',e=>resolve({ok:false,ms:null,reason:e.message.slice(0,160)}))})}
async function getGateway(){try{if(IS_WIN){const r=await exec('route',['print','-4'],4500);const lines=r.out.split(/\r?\n/);for(const line of lines){let m=line.trim().match(/^0\.0\.0\.0\s+0\.0\.0\.0\s+(\d{1,3}(?:\.\d{1,3}){3})\s+/);if(m)return m[1]}}else{const r=await exec('ip',['route','show','default'],3000);const m=r.out.match(/\bvia\s+(\d{1,3}(?:\.\d{1,3}){3})/);if(m)return m[1]}}catch(_){}return null}
function addRecord(item,result,ts){item.lastReason=result.reason||null;item.status=result.ok?'up':'down';item.lastMs=result.ms;item.lastCheck=ts;item.checks++;if(result.ok){item.success++;item.streak=0}else{item.fail++;item.streak++}item.history.push({t:ts,ms:result.ms,ok:result.ok});if(item.history.length>MAX_HISTORY)item.history.shift()}
function addDiagnosis(severity,title,description){diagnostics.unshift({ts:Date.now(),severity,title,description});diagnostics=diagnostics.slice(0,40)}
async function traceroute(host,automatic=false){if(traceBusy)return {error:'Já existe um diagnóstico de rota em andamento.'};traceBusy=true;try{const args=IS_WIN?['-d','-h','12','-w','650',host]:['-n','-m','12','-w','1',host];const r=await exec(IS_WIN?'tracert':'traceroute',args,19000);let output=r.out.trim()||r.err.trim();if(!output)output='Não foi possível executar traceroute. Verifique se o comando está instalado.';if(automatic){const nonresponsive=output.split('\n').filter(l=>/^\s*\d+\s+/.test(l)&&l.includes('*')).length;addDiagnosis('info',`Rota analisada: ${host}`,nonresponsive?'Alguns saltos não responderam. Isso pode significar bloqueio de ICMP, não necessariamente falha de rede.':'Resultado do traceroute disponível no painel de diagnóstico.');}return {host,output,at:Date.now()}}finally{traceBusy=false}}
let lastTrace=null;
async function cycle(){if(!running)return;const ts=Date.now();const targets=[...records.values()];if(gatewayRecord)targets.unshift(gatewayRecord);
 await Promise.all(targets.map(async r=>{let result;try{result=r.kind==='http'?await testHttp(r.host):await ping(r.host)}catch(e){result={ok:false,ms:null,reason:String(e.message)}}addRecord(r,result,ts)}));
 const external=[...records.values()];const failCount=external.filter(r=>r.status==='down').length;const dnsFails=external.filter(r=>r.kind==='dns'&&r.status==='down').length;const gwUp=gatewayRecord?.status==='up';
 for(const r of targets){if(r.streak>=2)updateOutage(r.id,r.name,true,ts,r.lastReason);else if(r.status==='up')updateOutage(r.id,r.name,false,ts)}
 const httpDown=external.find(r=>r.id==='internet')?.streak>=2;const widespread=dnsFails>=3&&httpDown;
 const prevNet=outages.has('link');const aggregateStreak=external.filter(r=>r.streak>=2).length>=4;
 if(widespread&&aggregateStreak)updateOutage('link','Possível indisponibilidade geral da conexão',true,ts,'Falhas simultâneas em pelo menos 3 DNS públicos e HTTPS; causa exata não comprovada');
 else if(prevNet&&!widespread)updateOutage('link','Possível indisponibilidade geral da conexão',false,ts);
 if(failCount>=3&&external.some(r=>r.streak===2)){
   if(gatewayRecord&&gatewayRecord.status==='down')addDiagnosis('critical','Possível falha na rede local / roteador','O gateway não respondeu e vários serviços externos falharam. Verifique cabo, Wi‑Fi e roteador. Alguns roteadores bloqueiam ICMP.');
   else if(gwUp)addDiagnosis('critical','Possível problema após o roteador','O gateway respondeu, mas vários destinos externos falharam. Suspeita de link do provedor ou rota externa.');
   else addDiagnosis('warning','Falhas externas simultâneas','Vários destinos falharam. Sem resposta conclusiva do gateway; verifique conectividade e bloqueios ICMP.');
 }
 if(dnsFails>=3&&external.find(r=>r.id==='internet')?.status==='up'&&external.some(r=>r.streak===2))addDiagnosis('warning','Pings bloqueados, mas HTTP funciona','O teste HTTP está operacional: a rede pode estar bloqueando ICMP. Não conclua que os DNS estão indisponíveis.');
 if(failCount>=3&&external.some(r=>r.streak===3)&&Date.now()>nextTraceTime){nextTraceTime=Date.now()+120000;const target=external.find(r=>r.kind==='dns'&&r.status==='down')?.host||'1.1.1.1';traceroute(target,true).then(x=>{lastTrace=x}).catch(e=>addDiagnosis('warning','Traceroute indisponível',e.message))}
}
async function init(){gateway=await getGateway();if(gateway){gatewayRecord={id:'gateway',name:'Gateway local',host:gateway,kind:'gateway',status:'pending',lastMs:null,checks:0,success:0,fail:0,streak:0,lastCheck:null,history:[]}}await cycle();setInterval(()=>cycle().catch(e=>console.error(e)),INTERVAL)}
function json(res,obj,code=200){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'http://127.0.0.1:'+PORT});res.end(JSON.stringify(obj))}
function sendFile(res,filename,contentType){fs.readFile(path.join(__dirname,filename),(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'no-cache'});res.end(data)})}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1:'+PORT);if(req.method==='GET'&&url.pathname==='/')return sendFile(res,'index.html','text/html; charset=utf-8');if(req.method==='GET'&&url.pathname==='/api/state')return json(res,{started,interval:INTERVAL,gateway,targets:[...(gatewayRecord?[gatewayRecord]:[]),...records.values()],diagnostics,lastTrace,traceBusy,events:currentEvents(),eventsFile:EVENTS_FILE});if(req.method==='POST'&&url.pathname==='/api/trace'){const id=url.searchParams.get('id');const target=[...(gatewayRecord?[gatewayRecord]:[]),...records.values()].find(r=>r.id===id&&r.kind!=='http');if(!target)return json(res,{error:'Destino não encontrado.'},400);try{const result=await traceroute(target.host);lastTrace=result;return json(res,result)}catch(e){return json(res,{error:e.message},500)}}if(req.method==='GET'&&url.pathname==='/api/events.json'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="netpulse-quedas.json"','Cache-Control':'no-store'});return res.end(JSON.stringify({schema:1,exportedAt:new Date().toISOString(),events:currentEvents()},null,2))}
if(req.method==='GET'&&url.pathname==='/relatorio'){return sendFile(res,'relatorio.html','text/html; charset=utf-8')}
if(req.method==='GET'&&url.pathname==='/api/export'){const all=[...(gatewayRecord?[gatewayRecord]:[]),...records.values()];const rows=['data_hora;destino;host;status;latencia_ms'];for(const h of all){for(const p of h.history){rows.push([new Date(p.t).toISOString(),h.name,h.host,p.ok?'OK':'FALHA',p.ms??''].join(';'))}}rows.sort((a,b)=>a.localeCompare(b));res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="netpulse-historico.csv"'});return res.end('\ufeff'+rows.join('\r\n'))}res.writeHead(404);res.end('Not found')});
server.listen(PORT,'127.0.0.1',()=>console.log(`NetPulse: http://127.0.0.1:${PORT}`));init().catch(console.error);
