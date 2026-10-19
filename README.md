# 🌐 NetPulse — Monitoramento de Conectividade e Diagnóstico de Rede

**Monitore sua conexão com a internet em tempo real, identifique interrupções, acompanhe a latência e gere relatórios para documentar problemas de conectividade.**

O **NetPulse** é uma aplicação web open source, inspirada no PingInfoView, desenvolvida para facilitar o monitoramento contínuo da conexão com a internet.

Com uma interface intuitiva, gráficos de desempenho, registros persistentes e diagnósticos automatizados, o NetPulse ajuda usuários domésticos, profissionais de TI e administradores de redes a identificar problemas de conectividade e documentar interrupções de serviço.

O projeto foi pensado especialmente para quem precisa reunir evidências técnicas sobre instabilidades e quedas frequentes de conexão para apresentação ao provedor de internet.

## ✨ Funcionalidades

### 📡 Monitoramento em tempo real

- Monitoramento contínuo de servidores DNS públicos.
- Testes periódicos de conectividade.
- Medição da latência em milissegundos.
- Identificação de destinos disponíveis e indisponíveis.
- Atualização automática dos resultados.
- Visualização do comportamento da conexão por meio de gráficos.

### 🌎 Servidores monitorados

Por padrão, o NetPulse monitora os seguintes servidores DNS:

| Provedor | Endereço IP |
|---|---|
| Cloudflare | `1.1.1.1` |
| Google DNS | `8.8.8.8` |
| Quad9 | `9.9.9.9` |
| OpenDNS | `208.67.222.222` |

Também é utilizado um teste HTTPS complementar para auxiliar na identificação de problemas gerais de conectividade.

### 📊 Dashboard e estatísticas

O painel apresenta indicadores de desempenho e disponibilidade da rede, incluindo:

- Latência dos destinos monitorados.
- Histórico visual de conectividade.
- Disponibilidade e perda de pacotes.
- Quantidade de falhas identificadas.
- Estatísticas de resposta.
- Situação atual dos serviços monitorados.

### 🚨 Identificação automática de quedas

O NetPulse analisa os resultados dos testes para identificar possíveis interrupções gerais de conectividade.

O diagnóstico considera a falha persistente de múltiplos destinos DNS em conjunto com o teste HTTPS complementar.

Essa abordagem ajuda a diferenciar indisponibilidades isoladas de possíveis problemas mais abrangentes na conexão.

**Importante:** falhas de resposta a ICMP ou HTTPS não significam necessariamente interrupção do serviço de internet. Os resultados devem ser interpretados como evidências técnicas auxiliares.

### 💾 Registro persistente de incidentes

As ocorrências são registradas em um arquivo JSON:

`dados/quedas.json`

Cada incidente pode conter:

- Destino afetado.
- Data e horário de início.
- Data e horário de recuperação.
- Duração da interrupção.
- Informações sobre a ocorrência.

Os registros permanecem disponíveis após o encerramento e a reinicialização da aplicação.

### 📄 Relatórios para provedores de internet

O NetPulse disponibiliza uma interface para geração de relatórios técnicos sobre a estabilidade da conexão.

Os relatórios incluem:

- Período analisado.
- Quantidade de ocorrências registradas.
- Duração acumulada das possíveis interrupções gerais.
- Histórico detalhado das falhas.
- Horários de início e restabelecimento.

É possível selecionar o período desejado e utilizar a opção **Imprimir / Salvar como PDF** do navegador.

Os relatórios podem ser utilizados como documentação complementar em reclamações e solicitações de suporte junto aos provedores de internet.

### 🔔 Alertas sonoros

O NetPulse possui notificações sonoras para possíveis interrupções gerais de conectividade.

O usuário pode habilitar os alertas diretamente na interface por meio da opção **Ativar som**.

Para que os alertas sejam reproduzidos, o navegador deve permanecer aberto e permitir a execução de áudio.

### 🛠️ Diagnóstico de rede

O projeto inclui ferramentas para auxiliar na investigação de problemas de conectividade, como:

- Testes de ping.
- Análise de latência.
- Identificação de perdas de resposta.
- Execução de traceroute.
- Investigação dos saltos de rede até o destino.

O traceroute pode auxiliar na identificação de pontos em que deixam de ser recebidas respostas, embora alguns equipamentos bloqueiem ou limitem esse tipo de diagnóstico.

## 🧰 Tecnologias utilizadas

O projeto utiliza tecnologias web e recursos nativos do Node.js.

| Tecnologia | Utilização |
|---|---|
| HTML5 | Estrutura da interface |
| CSS3 | Estilização e responsividade |
| JavaScript | Interatividade e gráficos |
| Node.js | Servidor local e execução dos testes |
| JSON | Persistência do histórico |
| ICMP / Ping | Verificação de conectividade |
| Traceroute | Diagnóstico de rotas |

A aplicação não depende de serviços externos para armazenar seu histórico de monitoramento.

## 🚀 Instalação e execução

### Pré-requisitos

- Windows.
- Node.js instalado.
- Navegador atualizado.
- Conexão de rede para execução dos testes.

Baixe o Node.js em:

https://nodejs.org/

### 1. Clone o repositório

```bash
git clone https://github.com/SEU-USUARIO/netpulse.git
```

Acesse a pasta do projeto:

```bash
cd netpulse
```

### 2. Execute a aplicação

No Windows, execute:

```bat
INICIAR-WINDOWS.bat
```

O servidor local será iniciado.

### 3. Acesse o dashboard

Abra seu navegador e acesse:

http://127.0.0.1:8787

O monitoramento será apresentado na interface web.

**Observação:** o backend deve permanecer executando para que os testes de conectividade e a gravação dos incidentes continuem funcionando.

## 📁 Estrutura do projeto

Exemplo dos principais componentes:

```text
netpulse/
├── index.html
├── relatorio.html
├── server.js
├── INICIAR-WINDOWS.bat
├── README.md
└── dados/
    └── quedas.json
```

O diretório `dados/` é destinado ao armazenamento local dos registros produzidos durante o monitoramento.

## 📈 Funcionamento do monitoramento

O NetPulse executa verificações periódicas contra destinos conhecidos na internet.

O funcionamento básico segue este fluxo:

1. Executar os testes de conectividade.
2. Registrar os tempos de resposta.
3. Atualizar os indicadores e gráficos.
4. Identificar falhas consecutivas.
5. Avaliar se os resultados sugerem uma interrupção geral.
6. Registrar o incidente em JSON.
7. Emitir um alerta sonoro, quando habilitado.
8. Registrar a recuperação da conexão.
9. Disponibilizar as informações no relatório.

O intervalo padrão entre verificações é de aproximadamente **4 segundos**.

## 🔒 Privacidade e armazenamento

O NetPulse foi projetado para funcionar localmente.

Os registros de incidentes são armazenados no próprio computador, sem necessidade de criar uma conta em um serviço de nuvem.

O usuário mantém o controle sobre os dados gerados.

**Atenção:** os arquivos de histórico podem revelar horários de utilização e informações sobre a rede. Evite publicar registros pessoais diretamente no GitHub.

## ⚠️ Limitações conhecidas

- Navegadores não permitem executar diretamente ping ICMP ou traceroute. Por isso, o NetPulse utiliza um backend local em Node.js.
- Equipamentos e servidores podem limitar respostas ICMP, mesmo quando a conexão está funcionando.
- Os diagnósticos automáticos não identificam necessariamente a causa exata de uma falha.
- A qualidade do monitoramento depende do computador estar ligado e do processo permanecer em execução.
- Alertas sonoros dependem das permissões e das condições de execução do navegador.
- Os relatórios representam as medições realizadas pelo dispositivo e não constituem, isoladamente, prova definitiva de descumprimento contratual pelo provedor.

## 🗺️ Roadmap

Sugestões de melhorias futuras:

- [ ] Configuração de destinos personalizados.
- [ ] Monitoramento simultâneo de múltiplas interfaces de rede.
- [ ] Gráficos históricos por dia, semana e mês.
- [ ] Indicadores de jitter.
- [ ] Cálculo de SLA e disponibilidade mensal.
- [ ] Diagnóstico avançado da rede local.
- [ ] Relatórios PDF gerados diretamente pelo backend.
- [ ] Exportação de dados em múltiplos formatos.
- [ ] Notificações via Telegram ou e-mail.
- [ ] Execução automática ao iniciar o Windows.
- [ ] Suporte ampliado a Linux e macOS.
- [ ] Empacotamento como aplicação desktop.

## 🤝 Como contribuir

Contribuições são bem-vindas!

Você pode colaborar corrigindo bugs, propondo funcionalidades, aprimorando a interface ou expandindo os recursos de diagnóstico.

Para contribuir:

1. Faça um fork do repositório.
2. Crie uma branch para sua alteração.
3. Implemente e teste suas modificações.
4. Faça commit das alterações.
5. Abra um Pull Request descrevendo a contribuição.

Problemas, sugestões e solicitações de recursos também podem ser registrados na seção **Issues** do GitHub.

## 📜 Licença

Sugestão: distribuir o projeto sob a **Licença MIT**, permitindo uso, estudo, modificação e redistribuição, conforme os termos da licença.

Para adotá-la, adicione um arquivo `LICENSE` ao repositório contendo o texto oficial da licença MIT, com o ano e o titular dos direitos autorais.

## ⭐ Apoie o projeto

Se o NetPulse foi útil para você, considere deixar uma estrela ⭐ no repositório.

Seu apoio ajuda a dar visibilidade ao projeto e incentiva o desenvolvimento de novas funcionalidades.

---

**NetPulse — Monitorar, diagnosticar e documentar sua conexão com a internet.**
