# 5. Publicação e operação

Tudo abaixo pode ser feito **pelo navegador**, sem terminal.

## 5.1 Primeira publicação

### Passo A · Subir os arquivos para um repositório privado no GitHub

1. GitHub → **+** → **New repository** → nome `carteira-ideal-app` → **Private** → sem README → **Create repository**.
2. Clique em **"uploading an existing file"**.
3. O GitHub aceita **no máximo 100 arquivos por envio** e este projeto tem mais que isso. Faça em **dois envios**:
   - **Envio 1:** abra a pasta do projeto, selecione **tudo, exceto a pasta `docs`** (Ctrl+A e depois Ctrl+clique em `docs` para desmarcá-la), arraste para o navegador → **Commit changes**.
   - **Envio 2:** no repositório, **Add file → Upload files**, arraste a **pasta `docs` inteira** → **Commit changes**.
4. Arraste sempre o **conteúdo** da pasta do projeto, nunca a pasta em si. A página inicial do repositório deve mostrar `api`, `assets`, `docs`, `scripts`, `webapp-src`, `index.html`, `package.json` e `vercel.json` logo no primeiro nível.

### Passo B · Publicar na Vercel

1. Em **vercel.com/new**, entre com a conta do GitHub.
2. Autorize a Vercel a ver o repositório `carteira-ideal-app` (mesmo sendo privado; o plano gratuito aceita repositórios privados da conta pessoal).
3. Selecione o repositório → **Deploy**. Não altere nenhuma configuração: o `vercel.json` já informa o comando de build e a pasta de saída.
4. Ao final, a Vercel mostra um endereço como `carteira-ideal-app.vercel.app` — funciona imediatamente, e pode continuar sendo usado (ver Passo F para conectar um domínio próprio, opcional).

### Passo C · Testar antes de divulgar

No celular, pelo endereço da Vercel: landing → botão amarelo → 14 perguntas → resultado → abas Carteira e Simular; depois, de volta à landing, botões Simule FII e Aprender → abrir uma aula e ver o vídeo tocar → no fim do Aprender, conferir o curso de Candlesticks e liberar/baixar o livro.

### Passo D · Ajustar o endereço de compartilhamento

✅ Já feito (22/09/2026): `og:image` e `og:url` no `index.html` da raiz apontam para `https://carteiraideal.app.br/`, testado e confirmado na prévia do WhatsApp.

### Passo E · Colocar o link na bio do Instagram

Só depois dos passos C e D.

### Passo F · Domínio próprio (opcional)

✅ Já feito (22/09/2026): domínio `carteiraideal.app.br` registrado no Registro.br e conectado ao projeto na Vercel. Resumo do processo (detalhes em [Registro de decisões, D8](07-registro-de-decisoes.md)):

1. Na Vercel: projeto → **Settings → Domains** → digitar o domínio → Add.
2. A Vercel mostra os registros DNS a configurar (no nosso caso, um registro **A** com host `@` apontando para um IP).
3. No Registro.br: **Meus Domínios** → o domínio → **DNS** → **Configurar endereçamento** → colar o IP que a Vercel mostrou.
4. Aguardar a propagação (levou poucos minutos, no nosso caso) até a Vercel marcar o domínio como válido e emitir o HTTPS automaticamente.
5. Repetir os passos D e E (og:url/og:image e bio do Instagram) para o domínio novo.

O endereço antigo (`carteira-ideal-app.vercel.app`) continua funcionando — a Vercel não desativa o subdomínio gratuito ao adicionar um domínio próprio.

## 5.2 Como editar qualquer arquivo pelo navegador

1. No GitHub, abra o arquivo e clique no **lápis** (Edit).
2. Altere o texto.
3. **Commit changes**.
4. A Vercel detecta a mudança e publica sozinha em 1 a 2 minutos. O andamento aparece na aba **Deployments** do projeto na Vercel.

## 5.3 Onde mudar cada coisa

| Quero mudar... | Arquivo |
|---|---|
| Botões, textos e links da landing | `index.html` (raiz) |
| Cores e visual da landing | `style.css` (raiz) |
| Livro infantil em PDF | Substituir `assets/livro-os-tres-potes-de-duda.pdf` por um arquivo **com o mesmo nome** |
| Texto das 7 perguntas de suitability | `webapp-src/src/data/questions.ts` |
| Texto das 7 perguntas de Arquitetura Patrimonial | `webapp-src/src/data/perguntasArquitetura.ts` |
| Descrição das 11 classes de ativos | `webapp-src/src/data/assets.ts` |
| Aulas, trilhas e vídeos | `webapp-src/src/data/trilhas.ts` (campo `youtubeId` = o código depois de `v=` no link do YouTube) |
| Carteiras-modelo, pesos, veto, travas | `webapp-src/src/domain/engine.ts` ⚠️ ver abaixo |
| Fundos da aba Simule FII | `config/fiis-ifix.json` (ver seção 5.6) |
| Textos e avisos da aba Simule FII | `webapp-src/src/screens/SimuleFii.tsx` |

⚠️ **Mudanças no motor (`engine.ts`) mudam a recomendação de todos os usuários.** Antes de alterar: registre o motivo no [Registro de decisões](07-registro-de-decisoes.md), atualize a [Metodologia](02-metodologia.md) e peça a quem desenvolve para rodar `npm run test`, porque vários testes conferem os percentuais atuais e precisarão ser ajustados junto.

## 5.4 Se algo der errado depois de uma atualização

Na Vercel: **Deployments** → escolha a última versão que funcionava → menu **⋯** → **Promote to Production** (ou "Instant Rollback"). O site volta à versão anterior em segundos. Depois, corrija o arquivo com calma no GitHub.

Se o build falhar, a Vercel mantém no ar a última versão boa e mostra o erro em **Deployments → (versão com erro) → Build Logs**.

## 5.5 Para quem desenvolve (terminal)

```bash
npm install          # uma vez
npm run dev          # só a interface (sem API: o cálculo falha de propósito com "Tentar novamente")
vercel dev           # interface + API, igual à produção (requer: npm install -g vercel)
npm run test         # 97 testes do app + 42 do script mensal de FIIs
npm run typecheck    # tipos do app e da API
npm run build        # build de produção em dist-site/
```

## 5.6 Operação mensal da aba Simule FII

**Rotina automática.** Todo dia 20, às 9h de Brasília, o GitHub roda o job "Atualizar rendimentos de FIIs". Ele baixa o informe mensal da CVM, busca as cotações na brapi (os 10 fundos em destaque e, desde a decisão D12, os demais FIIs listados, para a busca livre), grava `webapp-src/src/data/rendimentosFii.json` e faz um commit com a mensagem "dados: rendimentos de FIIs (AAAA-MM)". A Vercel publica esse commit sozinha. Não é preciso fazer nada.

**Se o job falhar**, o GitHub manda um e-mail. O app continua no ar com os dados do mês anterior, porque o script nunca grava um arquivo pela metade. Para ver o motivo: GitHub > **Actions** > execução com ✗ > **atualizar** > passo **"Buscar dados e gerar rendimentosFii.json"**. As mensagens são em português:

| Mensagem no log | O que fazer |
|---|---|
| `config/fiis-ifix.json ainda não foi conferido…` | Conferir a lista e marcar `"conferidoNaB3": true` |
| `Variável BRAPI_TOKEN não definida` | Cadastrar (ou recadastrar) o secret `BRAPI_TOKEN` |
| `ISIN aponta para mais de um CNPJ…` | Descobrir o CNPJ do fundo (aparece nos comunicados dele na B3) e adicionar `"cnpj"` na linha do fundo, como já foi feito com o TRXF11 |
| `[info] … descartado (… da mediana …)` | Nada: é a trava funcionando. O mês estava distorcido (emissão, fechamento de semestre) e o app mostra o mês típico anterior |
| `nenhum dos … meses ficou dentro da tolerância` | O fundo fica de fora neste mês. Se acontecer por 2 meses seguidos com um fundo cujo rendimento varia de verdade, aumentar a `"tolerancia"` dele em `config/fiis-ifix.json` |
| `os … meses mais recentes têm valor idêntico` | Conferir o valor anunciado pelo fundo. O dado é publicado mesmo assim; se estiver errado, avisar quem desenvolve |
| `rendimento estimado … fora da faixa plausível` | Conferir o fundo manualmente. Se o dado da CVM estiver errado naquele mês, o fundo fica de fora até o mês seguinte |
| `Coluna não encontrada (…)` | A CVM mudou o formato do arquivo. Enviar o log para quem desenvolve |
| `brapi respondeu 401/403` | Chave expirada ou revogada: gerar outra em brapi.dev e atualizar o secret |
| `[info] brapi: … requisições, … não listados, … sem cotação` | Resumo da lista ampla (D12). "Não listados" é normal: são fundos do informe que não negociam na B3. Se aparecer "(limite atingido)", a cota da brapi ou o teto `maxRequisicoesBrapi` acabou antes do fim: os menores fundos ficaram sem cotação neste mês |
| `[info] XXXX11: ISIN aponta para mais de um CNPJ…` (fundo fora do destaque) | Nada obrigatório: o fundo aparece na busca como "sem dados neste mês" com o motivo. Se for um fundo importante, descobrir o CNPJ certo nos comunicados dele e avisar quem desenvolve |
| `[info] Liquidez: N fundos acima de R$ 1 mi/dia na lista por setor; …` | Resumo da lista (D13). Os demais fundos com dado ficam só na busca |
| `[info] Mais negociados: …` / `Menos negociados da lista: …` | Conferir 2 ou 3 desses volumes num site de cotações. Se não baterem, avisar quem desenvolve |
| `[setor] Híbrido: …` (uma linha por setor) | Tickers de cada setor. Revise: se um fundo estiver no setor errado, corrija no bloco `setores` de `config/fiis-ifix.json` |
| `[info] Setores: …` | Contagem por setor. Setor estranho para um fundo? Corrigir no bloco `setores` de `config/fiis-ifix.json` (ex.: `"XXXX11": "Logística"`) |
| `A brapi não devolveu histórico de volume (range=1mo)…` | O plano gratuito ou a API mudou. Enviar o log para quem desenvolve |
| `Só … fundos passaram no critério de liquidez (mínimo …)` | Algo encolheu a lista de repente (brapi fora do ar, cota esgotada). Rodar de novo no dia seguinte |
| `[depurar] XXXX11: …` | Diagnóstico pedido em `outrosFundos.depurar`: mostra os 6 meses estimados, a mediana e o mês escolhido do fundo. Serve para entender por que um fundo específico ficou de fora. Depois de resolvido, pode esvaziar a lista |
| `brapi pediu para desacelerar (429)` | Nada, se for pontual: o script espera e tenta de novo. Se virar rotina, aumentar `pausaEntreRequisicoesMs` em `outrosFundos` |
| `Só … fundos no total ficaram válidos (mínimo …)` | A lista ampla encolheu de repente (brapi fora do ar, cota esgotada no início, coluna da CVM renomeada). Rodar de novo no dia seguinte; se repetir, enviar o log para quem desenvolve |

**Rodar fora do dia 20:** Actions > **Atualizar rendimentos de FIIs** (na lista da esquerda) > **Run workflow**. Não use "Re-run all jobs" dentro de uma execução antiga: ele repete o código daquela data e ignora alterações feitas depois.

**Lista ampla (D12).** Os parâmetros ficam em `outrosFundos`, dentro de `config/fiis-ifix.json`: `ativo` (`false` volta a publicar só os 10), `mesesMaximoAtraso`, `minimoCotistas`, `maxRequisicoesBrapi`, `pausaEntreRequisicoesMs` e `minimoFundosTotal`. Problemas em fundos fora do destaque não derrubam o job: o fundo fica de fora ou aparece na busca como "sem dados neste mês", com o motivo.

**Manutenção do IFIX (janeiro, maio e setembro).** A B3 rebalanceia o índice a cada quatro meses. Confira a carteira teórica em b3.com.br (Índices > IFIX > Composição da carteira), atualize a ordem e os tickers em `config/fiis-ifix.json`, ajuste `"vigencia"` e rode o job manualmente.

**Cuidado com a tradução automática do navegador.** Ela altera o texto dos arquivos na tela do GitHub (por exemplo, `false` vira "falso" e "set a dez" vira "definir dez"). Desative a tradução para github.com antes de editar qualquer arquivo.
