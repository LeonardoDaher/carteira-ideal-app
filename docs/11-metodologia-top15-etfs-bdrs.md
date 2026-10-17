# Metodologia: Top 15 mais negociados (ETFs, FIIs, ações e BDRs) e Top 15 BDRs com maior desconto de preço

Versão **1.1.0** de cada ranking (publicação aprovada em 08/10/2026; a 1.0.0 foi o cálculo, decisão D70). Parâmetros: `config/top15-etfs.json` e `config/top15-bdrs.json` (fonte única; o hash de cada um vai no manifesto de cada execução). Cálculo: `scripts/top15-mercado-calculo.mjs` (função pura). Verificação independente: `scripts/top15-mercado-verificar.mjs`.

## 1. O que são, e o que não são

- **ETFs mais negociados** ordena os ETFs pela **liquidez**: a mediana do volume financeiro diário dos últimos 21 pregões. **Não** mede qualidade, custo, tamanho do patrimônio, desempenho nem preço baixo. ETF não tem valor justo a comparar, e a taxa de administração não está em dado aberto da CVM (o cadastro antigo não traz ETF ativo e o registro novo não tem coluna de taxa), por isso não há ranking de custo.
- **BDRs com maior desconto de preço** ordena os BDRs de ação pelo quanto o último fechamento está **abaixo do maior fechamento dos últimos 252 pregões**. É desconto de **preço**, que inclui o câmbio: **não** é desconto de valor da empresa, porque não há balanço de empresa estrangeira nos dados. Uma queda grande costuma ter motivo real. Fundamentos (P/L etc.) exigiriam uma fonte externa dos balanços das empresas estrangeiras e ficam para uma versão futura.
- Nenhum dos dois considera o perfil de ninguém, indica compra ou venda, projeta preço ou promete retorno.

## 2. Fonte de dados

Boletim de Preços da B3 (BVBG.086), já guardado pelos jobs diários em `historico/etfs.json` (D23) e `historico/bdrs.json` (D19/D24): para cada pregão, fechamento, mínima, máxima e volume em reais de cada ativo (260 pregões guardados). O job deste ranking **não usa rede**: lê esses arquivos, e o manifesto registra o sha256 de cada um. Quem não confia no histórico pode refazer o download do boletim de cada pregão e comparar.

## 3. ETFs: cálculo

Para cada ETF do histórico (universo ~234 códigos):

1. Janela: os últimos 21 pregões. Volume de cada dia (dia sem negócio = 0). **Volume mediano** = mediana desses 21 valores; **volume médio** e **dias negociados** são só informativos.
2. Filtros, nesta ordem (o primeiro que reprova dá o motivo): fora por decisão registrada (`config/etfs.json → excluir`, produtos classificados como ETF que não são fundos de índice comuns); sem negócio na janela; último negócio há mais de 5 pregões; menos de 15 dias negociados; mediana abaixo de R$ 500 mil (mesmo piso do job de ETFs).
3. Ordem: maior volume mediano; empate: mais dias negociados, depois ordem alfabética. Lista **geral** com 15 e os **5 mais negociados de cada categoria** (categorias de `config/etfs.json`).
4. Informativo: variação de 3 meses (último fechamento ÷ fechamento 63 pregões antes − 1).

Resultado de 08/10/2026 (pregões até 05/10): 234 no universo, 80 passaram, 154 ficaram de fora (147 por liquidez). Top: BOVA11, SMAL11, LFTB11, IVVB11, BOVV11, SPXR11, GOLD11, LFTS11, DIVO11, B5P211, AUPO11, HASH11, NASD11, LTBX11, IMAB11.

## 4. BDRs: cálculo

Universo: BDRs de ação (códigos 31 a 35, fora de derivativos), ~700 códigos. Para cada um:

1. Aplica os desdobramentos e grupamentos **confirmados** em `config/bdrs.json → desdobramentos` (preços anteriores à data são divididos pelo fator).
2. Filtros, nesta ordem: fora por decisão registrada (empresas de origem ou operação brasileira, D19); sem negócio; último negócio há mais de 5 pregões; menos de 15 dias negociados nos últimos 21; mediana abaixo de R$ 300 mil (piso dos BDRs de ação do job de BDRs); menos de 240 pregões de histórico.
3. **Desconto = 1 − último fechamento ÷ maior fechamento dos últimos 252 pregões.**
4. Vai para **"a conferir"** (fora do ranking, antes de ordenar) o BDR com **salto de preço** (queda de 45% ou mais, ou alta de 80% ou mais, entre dois fechamentos seguidos na janela: possível desdobramento ainda não confirmado) ou com **desconto acima de 60%**. Voltam ao ranking quando o evento é confirmado nos avisos da B3 e registrado no config.
5. Ordem: maior desconto; empate: maior volume, depois ordem alfabética. Top 15.

Resultado de 08/10/2026: 702 no universo, 64 no ranking, 10 a conferir (S1TX34, K1LA34, BKNG34, D1EL34, NFLX34, N1OW34, F1TN34, RGTI34, C2RW34, M1RN34; vários com salto de desdobramento ainda não confirmado em `config/bdrs.json`) e 628 fora (511 por histórico curto ou pouca liquidez). Top 15: S2GM34, ORCL34, NIKE34, M2ST34, C2OI34, S1BS34, BABA34, W1DC34, N1VO34, Z2SC34, MOSC34, ADBE34, IBMB34, U1BE34, V1ST34.

## 5. Trilha de auditoria

Cada execução grava `auditoria/top15-etfs/<data>/` e `auditoria/top15-bdrs/<data>/`:

| Arquivo | Para que serve |
|---|---|
| `manifesto.json` | Origem (sha256 do histórico), hashes da config, dos insumos, do resultado e do código de cálculo |
| `config.json` | Cópia exata dos parâmetros |
| `insumos.json.gz` | As séries (fechamento, mínima, máxima, volume) de cada ativo, exatamente como entraram no cálculo, mais exclusões manuais e desdobramentos |
| `resultado.json` | Ranking, alertas e exclusões com o motivo de cada |
| `memoria-de-calculo.json.gz` | Por ativo da lista: a fórmula, a janela e o volume de cada dia (ETF) ou a máxima, a data dela e os saltos (BDR) |
| `*.csv` | O mesmo, em planilha |

**Verificar:** `node scripts/top15-mercado-verificar.mjs auditoria/top15-etfs/AAAA-MM-DD` (ou `top15-bdrs`). Recalcula o resultado só com `insumos.json.gz` + `config.json`, sem internet, e compara com o hash do manifesto. Detecta arquivo editado e insumo trocado (mesmo com o manifesto "consertado").

**Trava de sanidade** (antes de tocar no app): lista com menos de 15 ativos, ou mais da metade do universo sem negócio recente (histórico desatualizado), derruba o job; a auditoria fica gravada e o app não muda.

## 6. Publicação e acesso

- `publicacao.aprovadoPeloResponsavel` é `true` nos dois desde 08/10/2026 (v1.1.0, aprovação registrada em `publicacao.aprovacao`). Se voltar a `false`, ou se a trava de sanidade falhar, o app mostra "em validação" (ou não muda).
- **ETFs: acesso aberto.** O arquivo `webapp-src/src/data/etfsMaisNegociados.json` traz tudo. Motivo: é uma ordenação por volume de dados públicos da B3, que o app já mostra na aba de ETFs.
- **BDRs: com código próprio** (`TOP15_BDRS_CODIGOS`, D66/D70), pelo mesmo desenho das ações e dos FIIs: o arquivo público (`bdrsDesconto.json`) traz só o cabeçalho, sem nenhum BDR, e a lista fica em `dados-privados/bdr-desconto.json`, entregue por `api/top15-bdrs.ts` depois de validar o código. Um código só abre a própria lista.
- Telas: aba "Top 15 mais negociados" no Simule ETF e aba "Top 15 maior desconto" no Simule BDR, com o aviso "Não é recomendação de investimento" e a explicação de que liquidez e desconto de preço não são qualidade nem valor.
- Workflow "Atualizar Top 15 ETFs e BDRs": **todo dia útil** às 23h30 de Brasília, depois dos jobs de preço (e sob demanda). Valia dia 22 de cada mês até a D89.
- **Execução diária e auditoria completa mensal (D89).** A fórmula, os filtros e a `versaoMetodologia` de cada ranking não mudaram. Todo dia útil o job recalcula os sete rankings (ETFs, FIIs, ações e BDRs mais negociados; BDRs com maior desconto; maiores pesos do IFIX e do Ibovespa) com o histórico do dia e, **só na primeira execução do mês** (ou quando o config ou o código de cálculo mudam, ou com "auditoria completa" marcada), grava a pasta `auditoria/top15-<classe>/<data>/`. Nos outros dias o ranking é **conferido de forma independente em memória** (grava e relê os insumos e a config, refaz o cálculo do zero e compara os hashes; se divergir ou a trava de sanidade barrar, nada é publicado) e `ultima.json` continua apontando para a pasta do mês. O cabeçalho público leva a impressão digital do resultado **do dia**, `modoAuditoria` (`completa` ou `diaria`) e `auditoriaCompletaEm`. Na lista de BDRs "a conferir" e nos índices nada muda: a carteira do IFIX e do Ibovespa continua baixada da B3 a cada execução, e se a B3 falhar os outros rankings são publicados e o job termina com erro.

## 7. FIIs, ações e BDRs mais negociados (D71)

O MESMO cálculo da seção 3 (mediana do volume diário dos últimos 21 pregões; filtros de dias negociados e de último negócio; lista geral de 15 e os 5 de cada categoria), aplicado a mais três classes. Cada uma tem seu config (`config/top15-fiis.json`, `top15-acoes.json`, `top15-bdrs-negociados.json`, v1.0.0), sua trilha (`auditoria/top15-fiis/`, `top15-acoes/`, `top15-bdrs-negociados/`) e seu arquivo do app (`fiisMaisNegociados.json`, `acoesMaisNegociadas.json`, `bdrsMaisNegociados.json`). **Acesso aberto, sem código**, por decisão do responsável: é uma ordenação por volume de dado público da B3.

| Classe | Histórico | Universo | Categoria | Piso de volume | Variação |
|---|---|---|---|---|---|
| FIIs | `historico/fiis.json` (61 pregões; B3, com complemento da brapi, D64) | ~202 fundos | segmento do fundo (nome e segmento do job de FIIs) | R$ 300 mil por dia | 60 pregões (o histórico de FIIs ainda não tem 63) |
| Ações | `historico/acoes.json` (260 pregões) | ~390 códigos (cada código conta: PETR3 e PETR4) | setor (do job de ações) | R$ 1 milhão por dia | 3 meses |
| BDRs | `historico/bdrs.json` (260 pregões) | ~930 códigos: BDRs de ação (31 a 35) e de ETF (39), fora derivativos e fora as empresas brasileiras de `config/bdrs.json` (D19) | setor; os BDRs de ETF formam a categoria "BDRs de ETF" | R$ 300 mil por dia | 3 meses |

Resultado de 08/10/2026 (pregões até 07/10): **FIIs** 202 analisados, 75 passaram; topo KNCR11, TRXF11, MXRF11, BTLG11, HGLG11. **Ações** 390 analisadas, 196 passaram; topo PETR4, VALE3, ITUB4, BBAS3, AXIA3. **BDRs** 933 analisados, 91 passaram; topo AURA33, MELI34, MUTC34, NVDC34, TSLA34.

Mais negociado é **liquidez**, não qualidade, preço baixo nem segurança, e o aviso de cada tela diz isso. Para olhar preço contra os números do ativo, há o Top 15 FIIs baratos e o Top 15 ações baratas; para BDR, o Top 15 maior desconto. A publicação de cada ranking depende de `publicacao.aprovadoPeloResponsavel` no config da classe; os três estão `true` desde 08/10/2026 (v1.1.0).

## 8. Top 15 do IFIX e do Ibovespa: os maiores pesos (D72)

Aqui o critério não é volume nem preço: é o **peso do ativo na carteira teórica oficial do índice**, publicada pela B3. O app mostra os 15 maiores pesos do **IFIX** (fundos imobiliários, aba do Simule FII) e do **Ibovespa** (ações, aba do Simule Ações).

- **Fonte (única etapa com rede):** a carteira do dia na API pública da B3 que alimenta a página do índice (`sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay`), lida por `scripts/b3-indices.mjs`. O manifesto guarda o endereço, o tamanho e o **sha256 da resposta bruta**; a tabela completa (todos os ativos e pesos) fica nos insumos, de modo que a **verificação independente refaz o ranking sem internet**.
- **Leitura estrita:** a leitura **erra** em vez de adivinhar se a resposta não tem a lista, a data ou o peso de um ativo, se há código repetido, ou se o total de registros informado pela B3 não bate com o recebido (paginação incompleta).
- **Cálculo:** ordena do maior para o menor peso (empate: ordem alfabética do código), corta em 15 e acumula o peso (soma arredondada em três casas). Cotação, setor/segmento e a mediana do volume dos últimos 21 pregões são **informativos**, vêm do histórico diário da B3 e dos jobs do projeto, e não entram na ordem. Nome: o da B3 para FIIs e o do app (quando existe) para ações.
- **Trava de sanidade:** o job falha, e o app não muda, se a lista tem menos de 15 ativos, se a carteira tem menos de 50 ativos (IFIX) ou 40 (Ibovespa), se os pesos não somam 100% (tolerância de 0,5 ponto) ou se a data da carteira está mais de 10 dias antes da execução ou mais de 4 dias **à frente** dela (`antecedenciaMaximaDias`, v1.1.1, D93: a B3 publica a carteira do próximo pregão, então na noite de sexta, no fim de semana e antes de feriado a data é futura, e isso é normal). O workflow isola essas duas etapas: se a B3 falhar, os outros rankings são guardados, o índice que falhou fica como estava e o job termina com erro (e-mail do GitHub).
- **Publicação:** acesso **aberto**, sem código. `publicacao.aprovadoPeloResponsavel` em `config/top15-ifix.json` e `config/top15-ibov.json` está `true` desde 08/10/2026 (v1.1.0).
- **Peso não é qualidade.** Peso grande quer dizer ativo grande e líquido dentro do índice. A B3 revisa a carteira a cada quadrimestre e, entre as revisões, os pesos mudam todo dia com os preços. A empresa pode aparecer com mais de um código no Ibovespa (PETR3 e PETR4).

Resultado de 08/10/2026 (carteira da B3 de 08/10/2026): **IFIX** com 99 fundos; os 15 maiores somam 50,9% do índice (KNCR11 8,76%, KNIP11 4,71%, BTLG11 4,69%, HGLG11 4,51%, XPML11 4,38%…). **Ibovespa** com 76 ativos; os 15 maiores somam 66,2% (ITUB4 9,16%, VALE3 8,86%, PETR4 8,37%, PETR3 5,12%, AXIA3 4,77%…). A verificação independente passou nos dois.

## 9. Limitações conhecidas

- Liquidez não é qualidade: o ETF mais negociado pode ser caro ou ruim para o seu objetivo. A taxa de administração, o índice e o risco estão no regulamento e na lâmina.
- O histórico guarda 260 pregões; BDR listado há menos de 240 pregões fica de fora (histórico curto).
- Desdobramentos e grupamentos só entram quando confirmados em `config/bdrs.json`; até lá o BDR vai para "a conferir". Confirmar exige olhar o aviso de evento corporativo na B3 (decisão manual).
- O desconto de BDR inclui o câmbio (BDR = ação lá fora × dólar) e usa o fechamento, não o preço ajustado por dividendos.
- A API da B3 dos índices não é um contrato público documentado: se o formato mudar, a leitura erra e o ranking deixa de ser atualizado (a trava avisa por e-mail).
- A B3 não traz alguns instrumentos no boletim (como já visto nos FIIs, D64); o ativo ausente simplesmente não entra.
