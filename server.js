'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawn} = require('child_process');
const net=require('net'),dns=require('dns').promises,crypto=require('crypto');
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR=path.join(__dirname,'dados'); const EVENTS_FILE=path.join(DATA_DIR,'quedas.json');
fs.mkdirSync(DATA_DIR,{recursive:true});
const SETTINGS_FILE=path.join(DATA_DIR,'config.json'), SAMPLES_FILE=path.join(DATA_DIR,'amostras.ndjson');
const DEFAULT_SETTINGS={intervalMs:4000,consecutiveFailures:2,latencyWarningMs:150,retentionDays:30,autoTrace:true,alerts:{telegram:{enabled:false,botToken:'',chatId:''}},provider:'',protocol:'',customTargets:[]};
function loadSettings(){try{const v=JSON.parse(fs.readFileSync(SETTINGS_FILE,'utf8'));return {...structuredClone(DEFAULT_SETTINGS),...v,alerts:{telegram:{...DEFAULT_SETTINGS.alerts.telegram,...(v.alerts?.telegram||{})}},customTargets:Array.isArray(v.customTargets)?v.customTargets:[]}}catch{return structuredClone(DEFAULT_SETTINGS)}}
let settings=loadSettings();
function atomicJson(filename,value){const tmp=filename+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2));fs.renameSync(tmp,filename)}
function safeSettings(){return {...settings,alerts:{telegram:{enabled:settings.alerts.telegram.enabled,botToken:settings.alerts.telegram.botToken?'********':'',chatId:settings.alerts.telegram.chatId}}}}
function validateTarget(t){if(!t||typeof t.name!=='string'||t.name.length>55||typeof t.host!=='string'||t.host.length>220||!['dns','http','tcp'].includes(t.kind))throw Error('Destino inválido');const host=t.host.trim();if(t.kind==='dns'&&!/^[a-z0-9.-]+$/i.test(host))throw Error('Host DNS inválido');if(t.kind==='tcp'&&!/^[a-z0-9.-]+:\d{1,5}$/i.test(host))throw Error('Use host:porta para TCP');if(t.kind==='http'){const u=new URL(host);if(u.protocol!=='https:'||u.username||u.password)throw Error('Somente URLs HTTPS sem credenciais são permitidas');}return {id:'custom-'+crypto.createHash('sha256').update(t.kind+':'+host).digest('hex').slice(0,12),name:t.name.trim()||host,host,kind:t.kind}}
function applySettings(body){if(!body||typeof body!=='object')throw Error('Configuração inválida');const next=structuredClone(settings);for(const [key,min,max] of [['intervalMs',2000,60000],['consecutiveFailures',2,10],['latencyWarningMs',20,2000],['retentionDays',1,365]])if(body[key]!==undefined){if(!Number.isInteger(body[key])||body[key]<min||body[key]>max)throw Error('Valor inválido: '+key);next[key]=body[key]}
for(const key of ['provider','protocol'])if(body[key]!==undefined){if(typeof body[key]!=='string'||body[key].length>100)throw Error('Texto inválido');next[key]=body[key]}
if(body.autoTrace!==undefined)next.autoTrace=Boolean(body.autoTrace);
if(body.customTargets!==undefined){if(!Array.isArray(body.customTargets)||body.customTargets.length>12)throw Error('Máximo de 12 destinos');next.customTargets=body.customTargets.map(validateTarget)}
if(body.telegram!==undefined){const t=body.telegram;if(typeof t!=='object')throw Error('Telegram inválido');if(t.botToken!==undefined&&t.botToken!=='********'){if(t.botToken&&(!/^\d{5,15}:[A-Za-z0-9_-]{20,100}$/.test(t.botToken)))throw Error('Token de bot inválido');next.alerts.telegram.botToken=t.botToken}if(t.chatId!==undefined){if(typeof t.chatId!=='string'||!/^-?\d{0,20}$/.test(t.chatId))throw Error('Chat ID inválido');next.alerts.telegram.chatId=t.chatId}if(t.enabled!==undefined)next.alerts.telegram.enabled=!!t.enabled;if(next.alerts.telegram.enabled&&(!next.alerts.telegram.botToken||!next.alerts.telegram.chatId))throw Error('Configure token e chat ID antes de ativar Telegram')}
settings=next;atomicJson(SETTINGS_FILE,settings);syncTargets();return safeSettings()}
async function telegram(message){const t=settings.alerts.telegram;if(!t.enabled)return;try{const body=JSON.stringify({chat_id:t.chatId,text:'NetPulse: '+message});const req=require('https').request({hostname:'api.telegram.org',path:'/bot'+encodeURIComponent(t.botToken)+'/sendMessage',method:'POST',timeout:5000,headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>res.resume());req.on('error',e=>console.error('Telegram:',e.message));req.on('timeout',()=>req.destroy());req.end(body)}catch(e){console.error('Telegram:',e.message)}}
function loadEvents(){try{const data=JSON.parse(fs.readFileSync(EVENTS_FILE,'utf8'));return Array.isArray(data.events)?data.events:[]}catch{return []}}
let events=loadEvents(), outages=new Map(), sequence=events.reduce((m,e)=>Math.max(m,e.id||0),0);
for(const e of events){if(e.end===null&&e.targetId){e.end=e.start;e.durationSeconds=0;e.status='monitoramento_interrompido';e.reason=(e.reason||'')+' | Monitoramento interrompido antes da recuperação; duração desconhecida.'}}
function saveEvents(){const payload={schema:1,description:'NetPulse - registro de incidentes (horarios ISO 8601)',updatedAt:new Date().toISOString(),events};atomicJson(EVENTS_FILE,payload)}
saveEvents();
function updateOutage(id,name,failed,ts,reason){let e=outages.get(id);if(failed&&!e){e={id:++sequence,targetId:id,target:name,start:new Date(ts).toISOString(),end:null,durationSeconds:null,reason:reason||'Falha nos testes',status:'em_andamento'};events.push(e);outages.set(id,e);saveEvents();if(id==='link')telegram('Possível queda geral iniciada às '+e.start)}else if(!failed&&e){e.end=new Date(ts).toISOString();e.durationSeconds=Math.round((ts-Date.parse(e.start))/1000);e.status='encerrada';outages.delete(id);saveEvents();if(id==='link')telegram('Conexão restabelecida. Duração: '+e.durationSeconds+' segundos')}}
function currentEvents(){return events.slice(-1000).map(e=>e.end?e:{...e,durationSeconds:Math.max(0,Math.round((Date.now()-Date.parse(e.start))/1000))})}

const MAX_HISTORY = 1200;
const IS_WIN = process.platform === 'win32';
const HOSTS = [
  {id:'cloudflare',name:'Cloudflare DNS',host:'1.1.1.1',kind:'dns'},
  {id:'google',name:'Google DNS',host:'8.8.8.8',kind:'dns'},
  {id:'quad9',name:'Quad9 DNS',host:'9.9.9.9',kind:'dns'},
  {id:'opendns',name:'OpenDNS',host:'208.67.222.222',kind:'dns'},
  {id:'internet',name:'Internet (HTTPS)',host:'https://www.google.com/generate_204',kind:'http'},
  {id:'dnslookup',name:'Resolução de nomes (DNS)',host:'example.com',kind:'dns-lookup'}
];
function newRecord(h){return {...h,status:'pending',lastMs:null,checks:0,success:0,fail:0,streak:0,lastCheck:null,history:[],jitterMs:null}}
const records = new Map(HOSTS.map(h=>[h.id,newRecord(h)]));
function syncTargets(){const desired=[...HOSTS,...settings.customTargets],ids=new Set(desired.map(x=>x.id));for(const id of records.keys())if(!ids.has(id)){records.delete(id);if(outages.has(id))updateOutage(id,'Destino removido',false,Date.now())}for(const h of desired)if(!records.has(h.id))records.set(h.id,newRecord(h));}

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
async function testTcp(host){return new Promise(resolve=>{const [name,portStr]=host.split(':');const start=performance.now();const sock=net.createConnection({host:name,port:Number(portStr)});let done=false;const finish=(ok,reason)=>{if(done)return;done=true;sock.destroy();resolve({ok,ms:ok?Math.round(performance.now()-start):null,reason})};sock.setTimeout(2400);sock.once('connect',()=>finish(true,null));sock.once('timeout',()=>finish(false,'Timeout TCP'));sock.once('error',e=>finish(false,e.code||e.message))})}
async function testDns(host){const start=performance.now();try{await Promise.race([dns.resolve4(host),new Promise((_,reject)=>setTimeout(()=>reject(Error('Timeout DNS')),2500))]);return {ok:true,ms:Math.round(performance.now()-start),reason:null}}catch(e){return {ok:false,ms:null,reason:e.message}}}
function appendSamples(targets,ts){try{fs.appendFileSync(SAMPLES_FILE,targets.map(r=>JSON.stringify({ts,id:r.id,kind:r.kind,ok:r.status==='up',ms:r.lastMs})).join('\n')+'\n')}catch(e){console.error('Erro salvando amostras:',e.message)}}
function historicalStats(hours){const since=Date.now()-hours*3600000;let count=0,success=0,latency=0,latencyCount=0;let rows=[];try{const data=fs.readFileSync(SAMPLES_FILE,'utf8').trim().split('\n');for(const line of data){if(!line)continue;try{const v=JSON.parse(line);if(v.ts>=since&&v.kind!=='gateway'){count++;success+=Number(v.ok);if(v.ok&&Number.isFinite(v.ms)){latency+=v.ms;latencyCount++}rows.push(v)}}catch{}}}catch{}return {checks:count,success,availability:count?100*success/count:null,avgLatency:latencyCount?latency/latencyCount:null,points:rows.slice(-3000)}}
function pruneSamples(){try{const cutoff=Date.now()-settings.retentionDays*86400000;const lines=fs.readFileSync(SAMPLES_FILE,'utf8').split('\n').filter(line=>{if(!line)return false;try{return JSON.parse(line).ts>=cutoff}catch{return false}});fs.writeFileSync(SAMPLES_FILE,lines.join('\n')+'\n')}catch(e){if(e.code!=='ENOENT')console.error('Retenção:',e.message)}}
async function getGateway(){try{if(IS_WIN){const r=await exec('route',['print','-4'],4500);const lines=r.out.split(/\r?\n/);for(const line of lines){let m=line.trim().match(/^0\.0\.0\.0\s+0\.0\.0\.0\s+(\d{1,3}(?:\.\d{1,3}){3})\s+/);if(m)return m[1]}}else{const r=await exec('ip',['route','show','default'],3000);const m=r.out.match(/\bvia\s+(\d{1,3}(?:\.\d{1,3}){3})/);if(m)return m[1]}}catch(_){}return null}
function addRecord(item,result,ts){item.lastReason=result.reason||null;item.status=result.ok?'up':'down';item.lastMs=result.ms;item.lastCheck=ts;item.checks++;if(result.ok){item.success++;item.streak=0}else{item.fail++;item.streak++}const previous=item.history.slice().reverse().find(x=>x.ok&&x.ms!==null);item.jitterMs=result.ok&&previous?Math.abs(result.ms-previous.ms):item.jitterMs;item.history.push({t:ts,ms:result.ms,ok:result.ok});if(item.history.length>MAX_HISTORY)item.history.shift()}
function addDiagnosis(severity,title,description){diagnostics.unshift({ts:Date.now(),severity,title,description});diagnostics=diagnostics.slice(0,40)}
async function traceroute(host,automatic=false){if(traceBusy)return {error:'Já existe um diagnóstico de rota em andamento.'};traceBusy=true;try{const args=IS_WIN?['-d','-h','12','-w','650',host]:['-n','-m','12','-w','1',host];const r=await exec(IS_WIN?'tracert':'traceroute',args,19000);let output=r.out.trim()||r.err.trim();if(!output)output='Não foi possível executar traceroute. Verifique se o comando está instalado.';if(automatic){const nonresponsive=output.split('\n').filter(l=>/^\s*\d+\s+/.test(l)&&l.includes('*')).length;addDiagnosis('info',`Rota analisada: ${host}`,nonresponsive?'Alguns saltos não responderam. Isso pode significar bloqueio de ICMP, não necessariamente falha de rede.':'Resultado do traceroute disponível no painel de diagnóstico.');}return {host,output,at:Date.now()}}finally{traceBusy=false}}
let lastTrace=null,lastLatencyWarning=0;
async function cycle(){if(!running)return;const ts=Date.now();const targets=[...records.values()];if(gatewayRecord)targets.unshift(gatewayRecord);
 await Promise.all(targets.map(async r=>{let result;try{result=r.kind==='http'?await testHttp(r.host):r.kind==='tcp'?await testTcp(r.host):r.kind==='dns-lookup'?await testDns(r.host):await ping(r.host)}catch(e){result={ok:false,ms:null,reason:String(e.message)}}addRecord(r,result,ts)}));
 appendSamples(targets,ts);
 const slowTargets=targets.filter(r=>r.status==='up'&&r.kind!=='http'&&r.lastMs>=settings.latencyWarningMs);
 if(slowTargets.length&&ts-lastLatencyWarning>60000){lastLatencyWarning=ts;addDiagnosis('warning','Latência elevada',slowTargets.map(r=>r.name+': '+r.lastMs+' ms').join(' · '))}
 const external=[...records.values()];const failCount=external.filter(r=>r.status==='down').length;const dnsFails=external.filter(r=>r.kind==='dns'&&r.status==='down').length;const gwUp=gatewayRecord?.status==='up';
 for(const r of targets){if(r.streak>=settings.consecutiveFailures)updateOutage(r.id,r.name,true,ts,r.lastReason);else if(r.status==='up')updateOutage(r.id,r.name,false,ts)}
 const httpDown=external.find(r=>r.id==='internet')?.streak>=settings.consecutiveFailures;const widespread=dnsFails>=3&&httpDown;
 const prevNet=outages.has('link');const aggregateStreak=external.filter(r=>r.streak>=settings.consecutiveFailures).length>=4;
 if(widespread&&aggregateStreak)updateOutage('link','Possível indisponibilidade geral da conexão',true,ts,'Falhas simultâneas em pelo menos 3 DNS públicos e HTTPS; causa exata não comprovada');
 else if(prevNet&&!widespread)updateOutage('link','Possível indisponibilidade geral da conexão',false,ts);
 if(failCount>=3&&external.some(r=>r.streak===settings.consecutiveFailures)){
   if(gatewayRecord&&gatewayRecord.status==='down')addDiagnosis('critical','Possível falha na rede local / roteador','O gateway não respondeu e vários serviços externos falharam. Verifique cabo, Wi‑Fi e roteador. Alguns roteadores bloqueiam ICMP.');
   else if(gwUp)addDiagnosis('critical','Possível problema após o roteador','O gateway respondeu, mas vários destinos externos falharam. Suspeita de link do provedor ou rota externa.');
   else addDiagnosis('warning','Falhas externas simultâneas','Vários destinos falharam. Sem resposta conclusiva do gateway; verifique conectividade e bloqueios ICMP.');
 }
 if(dnsFails>=3&&external.find(r=>r.id==='internet')?.status==='up'&&external.some(r=>r.streak===settings.consecutiveFailures))addDiagnosis('warning','Pings bloqueados, mas HTTP funciona','O teste HTTP está operacional: a rede pode estar bloqueando ICMP. Não conclua que os DNS estão indisponíveis.');
 if(failCount>=3&&settings.autoTrace&&external.some(r=>r.streak===settings.consecutiveFailures+1)&&Date.now()>nextTraceTime){nextTraceTime=Date.now()+120000;const target=external.find(r=>r.kind==='dns'&&r.status==='down')?.host||'1.1.1.1';traceroute(target,true).then(x=>{lastTrace=x}).catch(e=>addDiagnosis('warning','Traceroute indisponível',e.message))}
}
async function init(){syncTargets();gateway=await getGateway();if(gateway){gatewayRecord={id:'gateway',name:'Gateway local',host:gateway,kind:'gateway',status:'pending',lastMs:null,checks:0,success:0,fail:0,streak:0,lastCheck:null,history:[]}}await cycle();setTimeout(async function loop(){try{await cycle()}catch(e){console.error(e)}setTimeout(loop,settings.intervalMs)},settings.intervalMs);setInterval(pruneSamples,3600000).unref()}
function json(res,obj,code=200){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'http://127.0.0.1:'+PORT});res.end(JSON.stringify(obj))}
function sendFile(res,filename,contentType){fs.readFile(path.join(__dirname,filename),(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}res.writeHead(200,{'Content-Type':contentType,'Cache-Control':'no-cache'});res.end(data)})}
const server=http.createServer(async(req,res)=>{if(req.headers.host&&!['127.0.0.1:'+PORT,'localhost:'+PORT].includes(req.headers.host))return json(res,{error:'Host não autorizado'},403);const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:'+PORT,'http://localhost:'+PORT].includes(origin))return json(res,{error:'Origem não autorizada'},403);const url=new URL(req.url,'http://127.0.0.1:'+PORT);if(req.method==='GET'&&url.pathname==='/')return sendFile(res,'index.html','text/html; charset=utf-8');if(req.method==='GET'&&url.pathname==='/api/settings')return json(res,safeSettings());
if(req.method==='POST'&&url.pathname==='/api/settings'){try{let body='';for await(const chunk of req){body+=chunk;if(body.length>25000)throw Error('Requisição muito grande')}return json(res,applySettings(JSON.parse(body)))}catch(e){return json(res,{error:e.message},400)}}
if(req.method==='GET'&&url.pathname==='/api/history'){const hours=Math.max(1,Math.min(720,Number(url.searchParams.get('hours')||24)));return json(res,historicalStats(hours))}
if(req.method==='GET'&&url.pathname==='/api/state')return json(res,{started,interval:settings.intervalMs,settings:safeSettings(),gateway,targets:[...(gatewayRecord?[gatewayRecord]:[]),...records.values()],diagnostics,lastTrace,traceBusy,events:currentEvents(),eventsFile:EVENTS_FILE});if(req.method==='POST'&&url.pathname==='/api/trace'){const id=url.searchParams.get('id');const target=[...(gatewayRecord?[gatewayRecord]:[]),...records.values()].find(r=>r.id===id&&r.kind!=='http');if(!target)return json(res,{error:'Destino não encontrado.'},400);try{const result=await traceroute(target.host);lastTrace=result;return json(res,result)}catch(e){return json(res,{error:e.message},500)}}if(req.method==='GET'&&url.pathname==='/api/events.json'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="netpulse-quedas.json"','Cache-Control':'no-store'});return res.end(JSON.stringify({schema:1,exportedAt:new Date().toISOString(),events:currentEvents()},null,2))}
if(req.method==='GET'&&url.pathname==='/relatorio'){return sendFile(res,'relatorio.html','text/html; charset=utf-8')}
if(req.method==='GET'&&url.pathname==='/api/export'){const all=[...(gatewayRecord?[gatewayRecord]:[]),...records.values()];const rows=['data_hora;destino;host;status;latencia_ms'];for(const h of all){for(const p of h.history){rows.push([new Date(p.t).toISOString(),h.name,h.host,p.ok?'OK':'FALHA',p.ms??''].join(';'))}}rows.sort((a,b)=>a.localeCompare(b));res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="netpulse-historico.csv"'});return res.end('\ufeff'+rows.join('\r\n'))}res.writeHead(404);res.end('Not found')});
server.listen(PORT,'127.0.0.1',()=>console.log(`NetPulse: http://127.0.0.1:${PORT}`));init().catch(console.error);
