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

No celular, pelo endereço da Vercel: landing → botão amarelo → 14 perguntas → resultado → abas Carteira e Simular; depois, de volta à landing, botões Simule FII e Aprender → abrir uma aula e ver o vídeo tocar → no fim do Aprender, liberar/baixar o livro.

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
| Livro infantil em PDF | Substituir `assets/livro-os-tres-potes-de-clara.pdf` por um arquivo **com o mesmo nome** |
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

## 5.7 Operação semanal dos dados oficiais de mercado (Simule Tesouro)

**Rotina automática.** Toda terça-feira, às 10h de Brasília, o GitHub roda o job "Atualizar dados oficiais de mercado" (decisões D15 e D16). Ele busca no Banco Central a Selic meta, o CDI, o IPCA, o dólar PTAX, o histórico da Selic e do IPCA desde 1999 e o Boletim Focus, e no Tesouro Transparente as taxas e preços de todos os títulos do Tesouro Direto. Grava `webapp-src/src/data/mercadoOficial.json` e faz um commit com a mensagem "dados: mercado oficial (AAAA-MM-DD)". A Vercel publica esse commit sozinha. Não precisa de secret: as fontes são públicas.

**Onde os dados aparecem.** Na aba **Simule Tesouro Direto** (botão 🏛️ da landing) e nas telas de detalhe do Tesouro, CDB e LCI/LCA ("Taxas de hoje" e "Juros e inflação no Brasil").

**Se o job falhar**, o GitHub manda um e-mail e o site continua com os dados da semana anterior. Para ver o motivo: **Actions** > execução com ✗ > **atualizar** > passo **"Buscar dados e gerar mercadoOficial.json"**.

| Mensagem no log | O que fazer |
|---|---|
| `[indicador] …`, `[historico] …`, `[focus] …`, `[tesouro] …` | Resumo do que foi lido. Conferir de vez em quando contra o site do Banco Central e do Tesouro Direto |
| `[aviso] … tentativa N falhou (HTTP 502)` ou `(resposta não é JSON: "<?xml…")` | Nada, se uma tentativa seguinte deu certo: o Banco Central oscila. O script tenta 4 vezes com espera crescente |
| `[erro] … falhou após 4 tentativas` | Rodar de novo mais tarde (Run workflow). Se repetir em dias diferentes, enviar o log para quem desenvolve |
| `[trava] …: valor … fora da faixa plausível` | Um código de série pode ter mudado. Enviar o log para quem desenvolve |
| `[trava] Tesouro: data-base … dias atrás` | O Tesouro Transparente não atualizou o arquivo. Rodar de novo no dia seguinte |
| `[trava] Focus …: sem projeção para …` | Virada de ano ou boletim atrasado. Rodar de novo no dia seguinte |
| `[trava] Histórico …: último ponto … não bate com o valor atual` | As consultas vieram desencontradas. Rodar de novo; se repetir, enviar o log |
| `[descartado] …` | Título com taxa implausível, deixado de fora. Nada a fazer se for pontual |
| `[aviso] Tipo de título desconhecido …` | O Tesouro lançou um tipo novo. Avisar quem desenvolve para incluí-lo |
| `[conteudo] … cita "Tesouro …", que não está à venda` | Um exemplo dos textos educacionais saiu de venda. Revisar `tesouroIPCA.ts`, `tesouroPrefixado.ts` ou `tesouroSelic.ts` (ver D17). O job não falha por isso |

**Se o deploy de dados falhar na Vercel** (commit "dados: mercado oficial" com status Error), abrir o log do deploy e enviar para quem desenvolve. Foi o que aconteceu no primeiro commit de dados reais (ver D16, correção do build).

**Rodar fora de terça:** Actions > **Atualizar dados oficiais de mercado** > **Run workflow**. Nunca "Re-run all jobs" numa execução antiga.

## 5.8 Operação diária dos BDRs (decisões D19 e D24)

**Fonte (D24).** Preço e volume vêm do Boletim de Preços oficial da B3 (BVBG.086), o mesmo
arquivo dos ETFs, sem cota. A brapi (`BRAPI_TOKEN`) só informa nome, setor e proporção BDR/ação,
com teto mensal próprio (`brapi.tetoMensal` em `config/bdrs.json`, padrão 80). Se a brapi falhar,
o job publica com o cadastro guardado em `historico/bdrs.json` e avisa no log.

**Antes de ligar (uma vez).**
1. Subir `scripts/atualizar-bdrs.mjs`, `config/bdrs.json` e os workflows `atualizar-bdrs.yml` e
   `carga-inicial-bdrs.yml` (a pasta `.github` costuma ficar de fora ao arrastar: criar ou editar
   os `.yml` à mão no GitHub).
2. Rodar Actions > **"Carga inicial de BDRs"** > Run workflow (padrão: 260 pregões, cerca de
   30 minutos). Ela grava `historico/bdrs.json` e publica `webapp-src/src/data/bdrs.json`. O
   histórico é publicado mesmo se a execução falhar; rodar de novo só baixa o que falta.
3. Ler no log da carga as linhas `[desdobramento]` e `N BDRs negociados de M no boletim`
   (tabela abaixo). A partir daí, "Atualizar BDRs" roda sozinho de segunda a sexta, às 22h.

Até a carga rodar, o job diário falha com "Rode a carga inicial" e a aba continua com o último
arquivo gerado pela brapi.

**Rotina automática.** De segunda a sexta, às 22h de Brasília, o GitHub roda "Atualizar BDRs":
baixa o boletim do dia, acrescenta o pregão ao histórico, grava `bdrs.json` (os 40 da lista e a
busca), confere se o site compila e faz um commit "dados: BDRs (AAAA-MM-DD)". Em feriado da B3
nada muda e nada é publicado.

**Se o job falhar**, o GitHub manda um e-mail e o app continua com os dados do último dia bom.
Para ver o motivo: Actions > execução com ✗ > **atualizar** > passo **"Buscar o boletim da B3 e
gerar bdrs.json"**.

| Mensagem no log | O que fazer |
|---|---|
| `config/bdrs.json ainda não foi conferido…` | Revisar as listas `excluir` e `revisados` e marcar `"conferidoPeloResponsavel": true` |
| `O histórico tem só … pregões … Rode a carga inicial` | Rodar o workflow "Carga inicial de BDRs" |
| `…: só N BDRs negociados no boletim (mínimo …)` | Boletim incompleto ou mudança da B3. Rodar de novo mais tarde; se repetir por dias, enviar o log para quem desenvolve |
| `…: o boletim trouxe a(s) data(s) …` | A B3 devolveu o arquivo de outro dia. Rodar de novo mais tarde |
| `sem resposta da B3 em 90 s` / `B3 respondeu …` | Site da B3 lento ou fora do ar. Rodar de novo mais tarde |
| `Só … de 5 BDRs de controle negociaram em …` | Problema geral no boletim. Rodar de novo mais tarde |
| `Só … BDRs de ações/ETF passaram no piso de liquidez` | A lista encolheu de repente. Enviar o log para quem desenvolve |
| `O pregão mais recente do histórico é de …, mais de 7 dias atrás` | O job está parado há dias. Rodar à mão e, se falhar, enviar o log |
| `[desdobramento] XXXX34: fechamento foi de R$ … para R$ … em AAAA-MM-DD (fator ≈ N)` | Conferir no aviso de eventos corporativos da B3 se houve desdobramento ou grupamento do BDR. Se houve, copiar para `desdobramentos` o trecho que a própria linha sugere. Se foi queda ou alta real, não fazer nada: a linha some quando o salto sair da janela de 52 semanas. Enquanto isso, o BDR aparece sem variação de 3 meses e/ou sem faixa de 52 semanas |
| `[proporcao] XXXX34: a brapi passou de … para …` | Sinal de desdobramento: conferir junto com a linha `[desdobramento]` |
| `[revisar] XXXX32: código de BDR patrocinado…` | Decidir: empresa de origem ou operação brasileira vai para `excluir`; as demais vão para `revisados`. O BDR continua publicado até a decisão |
| `[setor] XXXX34 (…)` | Setor da brapi sem tradução. Incluir a tradução em `setores`, ou o setor do BDR em `setorPorTicker` |
| `[categoria] XXXX39` | BDR de ETF sem grupo: incluir em `gruposEtf`. Enquanto isso, aparece em "Outros" |
| `[nome] XXXX34: ainda sem nome da brapi` | Normal nos primeiros dias ou sem token: o nome chega com a próxima listagem. Se persistir, incluir em `nomes` |
| `[aviso] BRAPI_TOKEN não definido` / `brapi respondeu 401/403` | Cadastrar ou trocar o secret `BRAPI_TOKEN`. A aba segue funcionando com nomes e setores guardados |
| `[aviso] Teto mensal da brapi para BDRs atingido` | Nada: o resto fica para o mês seguinte. Se acontecer todo mês, conferir o consumo dos três jobs no painel da brapi |
| `[info] brapi: N de 80 requisições no mês (…)` | Acompanhar de vez em quando. Esperado: cerca de 30 por mês |
| `[info] AAAA-MM-DD: N BDRs negociados de M no boletim` | Na primeira carga, anotar o N típico e ajustar `minimoBdrsNegociadosNoBoletim` para cerca de metade dele |
| `[info] Mais negociados: …` | Conferir 2 ou 3 volumes num site de cotações de vez em quando |
| `Sem pregão novo desde …: arquivos mantidos.` | Nada: feriado ou execução repetida no mesmo dia |

**Parâmetros** em `config/bdrs.json`: `maxAcoes` (35), `maxEtfs` (5), `pisoVolumeAcoes` e
`pisoVolumeEtfs` (reais por dia), `acompanharAcoes` e `acompanharEtfs` (quantos guardam série
longa), `pregoesBusca` (negócio mais antigo aceito na busca), `minimoBdrsNegociadosNoBoletim`,
bloco `brapi` (teto mensal e frequência das consultas) e bloco `desdobramentos`.

**Rodar fora do horário:** Actions > **Atualizar BDRs** > **Run workflow**. Antes das 21h, o
pregão do dia é ignorado (o boletim ainda pode estar incompleto).

## 5.9 Operação diária dos ETFs (decisão D23)

**Fonte.** Preço e volume vêm do Boletim de Preços oficial da B3 (BVBG.086), sem cota e sem
secret. A brapi (`BRAPI_TOKEN`) só informa quais códigos são ETF e o nome oficial, em 3
requisições por execução; se ela falhar, o job usa o universo guardado em `historico/etfs.json`
e avisa no log.

**Antes de ligar.**
1. Conferir em `config/etfs.json` as categorias, os índices e o câmbio (lâmina ou regulamento
   de cada ETF) e marcar `"conferidoPeloResponsavel": true`. Sem isso, os dois workflows falham
   de propósito.
2. Rodar **uma vez** Actions > "Carga inicial de ETFs" > Run workflow (padrão: 260 pregões,
   cerca de 30 minutos; na primeira execução real, 28 minutos, ~6 s por pregão). Ela grava
   `historico/etfs.json` e, com 21 pregões ou mais, já publica `webapp-src/src/data/etfs.json`.
   O histórico é publicado mesmo se a execução falhar ou for interrompida; rodar de novo só
   baixa o que falta.
3. A partir daí, "Atualizar ETFs" roda sozinho de segunda a sexta, às 22h de Brasília.

**Linhas do log.**

| Linha | O que fazer |
|---|---|
| `[revisar] XXXX11` | ETF novo com "Infra", "Incentivad", "Direitos Creditórios", "FINAM" ou "FINOR" no nome. Se não for fundo de índice, incluir em `excluir`; se for, em `revisados`. |
| `[categoria] XXXX11` | ETF da lista sem categoria: aparece em "Outros". Incluir em `categorias`. |
| `[indice] XXXX11` | ETF da lista sem índice: o cartão omite a linha. Incluir em `indices`, se quiser. |
| `[cambio] XXXX11` | ETF de bolsa exterior sem a informação de dólar. Incluir em `cambio` (true ou false). |
| `[aviso] Listagem da brapi indisponível` | O job seguiu com o universo guardado. Se repetir por dias, conferir a chave e a cota no painel da brapi. |
| `[info] AAAA-MM-DD: sem pregão na B3 (zip vazio)` | Feriado ou fim de semana. Normal. |
| `Sem pregão novo desde …` | Nada mudou; sem commit. Normal em feriado e em execução repetida. |

**Erros que param o job sem gravar nada.** Boletim do dia com data diferente da pedida ou com
menos de 60 ETFs do universo; menos de 5 dos 6 ETFs de controle (BOVA11, SMAL11, IVVB11, HASH11,
LFTS11, GOLD11) negociados no pregão; histórico com menos de 21 pregões (rodar a carga
inicial); pregão mais recente com mais de 7 dias; menos de 25 ETFs acima do piso de
R$ 500 mil/dia. O app continua com os dados do último dia bom.

## 5.10 Google Search Console (decisão D26)

Ferramenta gratuita do Google que mostra quais páginas estão indexadas, por quais buscas o site aparece e se há erros. Não coloca nenhum script no site.

1. Acesse https://search.google.com/search-console com a conta Google do Carteira Ideal e clique em **Adicionar propriedade**.
2. Escolha **Domínio** (não "Prefixo do URL") e digite `carteiraideal.app.br`.
3. O Google mostra um registro **TXT** (começa com `google-site-verification=`). Copie.
4. No **Registro.br** (o DNS do domínio fica lá, ver D8): Domínios → `carteiraideal.app.br` → **Editar zona** → Nova entrada, tipo **TXT**, nome em branco (`@`), valor = o texto copiado → Salvar. Não mexa no registro A da Vercel.
5. Volte ao Search Console e clique em **Verificar**. Se falhar, espere de 30 minutos a algumas horas (propagação do DNS) e tente de novo.
6. Depois de verificado: menu **Sitemaps** → digite `sitemap.xml` → Enviar.
7. Menu **Inspeção de URL** → cole `https://carteiraideal.app.br/` → **Solicitar indexação**. Repita com `https://carteiraideal.app.br/app/`.

Rotina: uma olhada por semana no relatório **Páginas** (erros de indexação) e, depois de um mês, no relatório **Desempenho** (buscas que trazem visitas).

**Como foi feito de fato (D26).** Como a zona DNS do Registro.br ficou "em transição", a propriedade foi criada por **Prefixo do URL** (`https://carteiraideal.app.br/`) e verificada pelo **arquivo HTML** `google5f0b815b0517184a.html`, que fica na raiz do repositório e é copiado para o site pelo `scripts/build-site.mjs`. A tag `<meta name="google-site-verification">` no `<head>` do `index.html` da raiz fica como reserva. Não apagar nenhum dos dois. Se a zona DNS liberar, dá para adicionar também a propriedade de Domínio pelo TXT, sem desfazer esta.

## 5.11 Páginas para o Google (decisão D26, Etapa 3)

A cada `npm run build`, o `scripts/build-site.mjs` chama o `scripts/gerar-paginas.mjs`, que cria em `dist-site/` as páginas de cada ferramenta, dos guias de ativos, das aulas de "Sair das dívidas" e, se o `mercadoOficial.json` tiver dados, de "Taxas do Tesouro Direto hoje". Elas entram no `sitemap.xml` sozinhas. Não há nada para rodar à mão.

**Depois de publicar, conferir:**
1. `carteiraideal.app.br/aprender/` abre e lista os guias.
2. `carteiraideal.app.br/simulador-tesouro-direto/` mostra o botão "Abrir o simulador".
3. `carteiraideal.app.br/sitemap.xml` lista cerca de 30 endereços. Se o job de mercado já rodou, inclui `/taxas-tesouro-direto-hoje/`.
4. No Search Console, menu **Sitemaps**: o `sitemap.xml` passa a mostrar as páginas encontradas (pode levar de horas a dias).

**No log da Vercel,** procure a linha `[build-site] Site montado em dist-site/ (landing + app/ + N páginas estáticas)`. Se aparecer `ATENÇÃO: as páginas estáticas de SEO NÃO foram geradas`, o site foi publicado sem elas: copiar o erro que vem logo em seguida e avisar quem desenvolve. O `npm test` cobre o gerador.

**Atualizar textos:** guias e aulas vêm de `data/analises/*.ts` e `data/trilhas.ts` (os mesmos do app); os textos das ferramentas ficam no `scripts/gerar-paginas.mjs`. Ao revisar os textos escritos à mão, atualizar `REVISADO_EM` nesse arquivo.

**O que nunca vai para as páginas públicas:** produtos (códigos como IVVB11), percentuais de alocação e a lógica do motor. Há filtros e testes para isso (D26).

**Autor e páginas Sobre (Etapa 4).** O nome e a formação do autor ficam na constante `AUTOR` do `scripts/gerar-paginas.mjs` e no JSON-LD (`founder`) do `index.html` da raiz. Se mudar, mude nos dois. As páginas `/sobre/` e `/metodologia-e-fontes/` também são geradas no build. Nunca acrescentar certificação ou registro que o autor não tenha: o `npm test` barra as siglas (CNPI, CEA, CFP, CPA, ANBIMA, OAB).

## 5.12 Operação diária das opções (decisão D96)

**O que roda.** O workflow "Atualizar opções" (`.github/workflows/atualizar-opcoes.yml`) roda de segunda a sexta às 23h UTC (20h de Brasília, a primeira da noite: o arquivo do dia sai por volta das 19h) e chama `scripts/atualizar-opcoes.mjs`. Ele baixa da B3 o cadastro de instrumentos (opções de ações e ETFs, estilo americana ou europeia, strike e vencimento) e o Boletim de Preços (COTAHIST) dos últimos pregões, junta as duas fontes, calcula a leitura de tendência com o histórico que os jobs de ações e ETFs já guardam e grava `webapp-src/public/dados/opcoes.json` (cerca de 1,3 MB: ~160 ativos e ~18 mil séries com vencimento em até 6 meses). Se algo mudou, faz o commit "dados: Opções (AAAA-MM-DD)"; em feriado da B3 ou sem dados novos, não muda nada.

**Rodar fora do horário.** Actions > **Atualizar opções** > **Run workflow**. A opção **forcar** reprocessa um dia já processado (útil depois de corrigir o script).

**O que conferir.** No log, as linhas com o número de ativos e de séries e a data do pregão; os ativos de controle (PETR4, VALE3 e BOVA11) precisam ter séries. Se o job recusar o arquivo (poucos ativos, séries demais sem preço ou controle ausente), o site continua com o arquivo anterior: rodar de novo mais tarde e, se repetir por dias, enviar o log para quem desenvolve. A tela lê o arquivo no navegador (`dados/opcoes.json`); não há servidor nem código de acesso.

**Cuidados.** O arquivo muda quase todo dia útil e entra no histórico do GitHub; o job não grava o horário de geração a menos que os dados mudem.

## Horários dos jobs diários (segunda a sexta, Brasília)

Os dados de mercado saem do Boletim de Preços da B3, cuja versão final do dia fica pronta por volta das 20h30; por isso
o corte (`horarioCorteBoletim`) é 20:45 e nenhum job de preço roda antes das 21h30. As Opções usam outro arquivo da B3
(COTAHIST, por volta das 19h) e rodam às 20h.

| Hora | Job |
|---|---|
| 20h00 | Opções |
| 21h30 | ETFs |
| 21h45 | Preço diário dos FIIs |
| 22h00 | BDRs |
| 22h15 | Ações |
| 22h45 | Top 15 mercado |
| 23h00 | FIIs baratos |
| 23h15 | Ações baratas |
| 23h45 | Ações endividadas |

Cada job que muda dados faz um commit, que dispara o deploy da Vercel; o app mostra o novo dia poucos minutos depois.
Os jobs que dependem de outros (Top 15, baratas, endividadas) ficam depois dos de preço.
