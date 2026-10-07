# Metodologia da triagem "FIIs baratos" (Tijolo e Papel)

**Versão da metodologia: 1.0.0** · Decisão de origem: D59 · Parâmetros: `config/fii-baratos.json` (fonte única) · Código: `scripts/fii-baratos-calculo.mjs` (cálculo puro), `scripts/atualizar-fii-baratos.mjs` (leitura da CVM e gravação da auditoria), `scripts/fii-baratos-verificar.mjs` (verificação independente).

> **Estado: NÃO PUBLICADO.** Este job só grava a trilha de auditoria em `auditoria/fii-baratos/<data>/`. Não há tela no app, código de acesso nem arquivo lido pelo site. Publicar depende de decisão do responsável (seção 9).

## 1. O que é, e o que não é

É uma **triagem contábil e de preço**, por fórmula e com dados públicos, que separa os FIIs em **Tijolo** e **Papel** e, dentro de cada grupo, ordena os que combinam **P/VP baixo** (cota barata em relação ao patrimônio) e **dividend yield de 12 meses alto**. **Não** é recomendação de compra, não considera o perfil de ninguém, e "barato" aqui significa só "P/VP baixo com rendimento alto": um desconto grande pode refletir um problema real do fundo (vacância, inadimplência, alavancagem) que os dados abertos usados aqui não mostram por inteiro (seção 10).

## 2. Fontes de dados (gratuitas e públicas)

| Fonte | O que traz | Observação |
|---|---|---|
| **Informe Mensal de FII da CVM** (`inf_mensal_fii_AAAA.zip`: `complemento`, `geral`, `ativo_passivo`) | DY do mês, valor patrimonial da cota, rentabilidade patrimonial, patrimônio líquido, cotistas, valor do ativo; ISIN e segmento declarado; composição do ativo e do passivo | Anos A−1 e A. Cada arquivo baixado tem URL, tamanho e sha256 no manifesto |
| **Cotação e volume médio** (`webapp-src/src/data/rendimentosFii.json`, do job de FIIs) | Cotação, data da cotação, volume médio diário, nome, setor | **Hoje é o job mensal (brapi), não um preço diário.** Mais velha que `dados.cotacaoMaxIdadeDias` (45) dias da execução: o fundo sai (`cotacao_defasada`) |

Os CSVs da CVM são ISO-8859-1. O leitor valida colunas obrigatórias e **falha com mensagem explícita** se o layout mudar.

## 3. Universo e competência de referência

O universo são os fundos de `rendimentosFii.json` (os que o job de FIIs acompanha). O código de negociação é ligado ao CNPJ pelo **ISIN** do informe "geral" (as 4 letras do ISIN são o prefixo do ticker). Com a Resolução CVM 175, o ISIN passa para um CNPJ novo; havendo mais de um, vale o de informe mais recente, e isso fica registrado em `origemCnpj`.

A **competência de referência** é a mais recente com pelo menos 80% do número de fundos da competência com mais fundos (`dados.coberturaMinimaDaCompetencia`): o mês corrente costuma vir com poucos informes (em 06/10/2026, 2026-09 tinha 8 fundos e 2026-08 tinha 1.353).

## 4. Classificação pelo ativo

O fundo é classificado pelo que **tem** (composição do ativo na competência de referência), não pelo segmento declarado: o MXRF11, por exemplo, está como "Logística" no cadastro e carrega ~70% em recebíveis.

| Tipo | Regra (fatia do total investido) | Conta como |
|---|---|---|
| **Tijolo** | imóveis ≥ 60% | `Direitos_Bens_Imoveis`, ações e cotas de sociedades de atividades de FII |
| **Papel** | recebíveis ≥ 60% | CRI, CRI_CRA, LCI, LCI_LCA, LIG, letras hipotecárias, FDIC, cédulas, debêntures, notas promissórias, CDVM, outros valores mobiliários |
| **Fundo de fundos** | cotas ≥ 60% | cotas de FII e de outros fundos, FIP |
| **Misto** | nenhum acima | — |

Fundo de fundos e misto **não entram** nos rankings (saem em `exclusoes.csv` com as fatias). `CRI` e `CRI_CRA` (e `LCI`/`LCI_LCA`) são colunas de versões diferentes do informe e nunca vêm preenchidas juntas; somam-se.

## 5. Indicadores

| Indicador | Fórmula | Observação |
|---|---|---|
| **P/VP** | cotação ÷ valor patrimonial da cota (referência) | |
| **Rendimento por cota do mês** | DY do mês (fração) × valor patrimonial da cota do mês | **Estimativa**: o informe traz só o DY, não o valor distribuído |
| **DY de 12 meses** | (soma dos rendimentos por cota dos meses com dado × 12 ÷ nº de meses com dado) ÷ cotação | Exige ≥ 10 meses com dado nos últimos 12 |
| **Rentabilidade patrimonial de 12 meses** | produto de (1 + rentabilidade patrimonial do mês) − 1 | Variação do valor patrimonial **sem** as distribuições; queda forte indica perda de valor (provisões, inadimplência, reavaliação) |
| **Alavancagem** | (passivo total − rendimentos a distribuir − taxas a pagar) ÷ valor do ativo | Aproximação do passivo oneroso |

A escala do DY no informe varia (fração ou %): decide-se por competência, pela mediana de todos os fundos (acima de 0,05 = em %). A mesma escala vale para a rentabilidade patrimonial.

## 6. Filtros (por grupo)

Aplicados na ordem; o primeiro que reprova é o motivo registrado.

| Filtro | Tijolo | Papel |
|---|---|---|
| Liquidez (volume médio diário) | ≥ R$ 500 mil | ≥ R$ 300 mil |
| Patrimônio líquido | ≥ R$ 200 mi | ≥ R$ 150 mi |
| Cotistas (se informados) | ≥ 3.000 | ≥ 3.000 |
| P/VP | ≥ 0,3 | **≥ 0,7** |
| DY de 12 meses | — | ≤ 25% |
| Rentabilidade patrimonial de 12 meses | ≥ −15% | **≥ −5%** |
| Alavancagem | ≤ 40% | ≤ 40% |

O papel tem liquidez e patrimônio mais folgados porque quase todo fundo de papel é menor (com os valores do tijolo sobram 13 fundos), e é mais rígido em P/VP e queda patrimonial porque desconto grande em fundo de crédito costuma ser **perda já precificada**, não pechincha.

## 7. "A conferir" e ranking

**A conferir.** Fundo com **P/VP < 0,55** (cota e valor patrimonial possivelmente em bases diferentes, como num desdobramento) ou **DY de 12 meses > 18%** (distribuição não recorrente) **não entra no ranking**: vai para `a-conferir.csv`, sem posição, até alguém confirmar o dado numa fonte pública. Ele sai **antes** de calcular os ranks, para não distorcer a nota dos demais. Caso real da primeira execução: MFII11 (P/VP 0,40, DY 28%) e TGAR11 (0,41; 22%) lideravam o tijolo.

**Ranking.** Dentro de cada grupo: `nota = média dos ranks percentuais de P/VP (menor é melhor) e de DY de 12 meses (maior é melhor)`; empate desempatado pelo menor P/VP e, depois, pelo ticker. Lista de 15 por grupo (`tamanhoDaLista`).

## 8. Trilha de auditoria

Cada execução grava `auditoria/fii-baratos/<data>/` (data da execução): `manifesto.json` (sha256 das fontes, da config, dos insumos, do resultado e do código de cálculo), `config.json`, `insumos.json.gz` (cada linha do informe usada, por fundo e competência), `resultado.json`, `memoria-de-calculo.json.gz` (por fundo: classificação com fatias, série de 12 meses, cada fórmula com seus números), `ranking-tijolo.csv`, `ranking-papel.csv`, `a-conferir.csv`, `exclusoes.csv` (etapa, código e motivo de cada fundo que ficou de fora) e `LEIA-ME.md`.

**Verificação independente (sem internet):**

```
npm run verificar-fii-baratos                     # execução mais recente
node scripts/fii-baratos-verificar.mjs auditoria/fii-baratos/AAAA-MM-DD
```

Confere o sha256 de cada arquivo, o hash canônico dos insumos e da config e **recalcula** o resultado só com insumos + config, comparando com o manifesto. O verificador depende só de `fii-baratos-calculo.mjs`. **O que não prova:** que os insumos reproduzem fielmente a CVM (isso é a conferência manual abaixo).

**Conferência manual dos insumos (por amostragem).** Em `memoria-de-calculo.json.gz`, abra o ticker e compare o DY, o valor patrimonial da cota e a rentabilidade patrimonial de dois ou três meses com `inf_mensal_fii_complemento_AAAA.csv` (sha256 do zip no manifesto), e a composição do ativo com `inf_mensal_fii_ativo_passivo_AAAA.csv`. Compare também a cotação e o P/VP de 2 ou 3 fundos do ranking com uma fonte pública de cotações.

**Trava de sanidade.** Se um grupo fica com menos de 15 (tijolo) ou 10 (papel) fundos, ou mais de 15% dos fundos ficam sem dado utilizável, o job grava a auditoria e **termina com erro** (o GitHub envia e-mail e a auditoria não é guardada no repositório; fica como artefato do workflow).

## 9. Publicação (pendente, decisão do responsável)

`config/fii-baratos.json → publicacao.aprovadoPeloResponsavel` é `false` e **este job não escreve nada no app**. Antes de publicar (tela, código de acesso, divulgação) é preciso decidir: (a) o **enquadramento regulatório** (a D22 tratou o ranking de ações como "triagem contábil" com risco aceito; ranking de FII pede a mesma decisão e, antes de divulgar em escala, o parecer independente da seção 3 de `docs/06`); (b) o **preço diário** (hoje é o do job mensal de FIIs, e o P/VP herda a defasagem); (c) a tela e o acesso, que seguiriam o desenho do Top 15 de ações (D50).

## 10. Limitações conhecidas

1. **Faltam vacância e inadimplência.** Estão em outros arquivos da CVM (informes trimestral e anual), por imóvel e por devedor, e não entraram nesta versão. A rentabilidade patrimonial de 12 meses é um **indicador indireto** de perda de valor, não a medida direta.
2. **O rendimento é estimativa** (DY × valor patrimonial). Em meses de emissão ou de fechamento de semestre pode distorcer (a D10 mediu desvios de até 57% num mês isolado); a média de 12 meses atenua, não elimina.
3. **Valor patrimonial é contábil.** Para tijolo, o valor de mercado dos imóveis pode ser bem diferente; P/VP baixo não significa que o fundo vale mais do que o mercado diz.
4. **P/VP baixo em papel** costuma ser risco de crédito precificado. O filtro de P/VP ≥ 0,7 e o de queda patrimonial ≥ −5% reduzem, mas não eliminam, esse risco.
5. **Preço defasado** (job mensal; seção 9).
6. **Cotas e valor patrimonial em bases diferentes** (desdobramento, grupamento) não são detectados automaticamente; o alerta de P/VP < 0,55 só aponta o sintoma.
7. **Fundos fora do `rendimentosFii.json`** não são avaliados, e o universo depende do filtro de liquidez daquele job.
8. **Não há backtest.** A metodologia não afirma nada sobre desempenho passado, e qualquer promessa de retorno está fora do escopo.
9. **Limiares são escolhas** a partir da distribuição observada na primeira execução (competência 2026-08), não regras de mercado: liquidez, patrimônio, cotistas, alavancagem, P/VP mínimo, queda patrimonial, DY máximo e os dois alertas.
10. **Fundo que muda de CNPJ** (Resolução CVM 175) é ligado pelo ISIN; casos ambíguos aparecem em `origemCnpj`.

## 11. Testes automatizados

`scripts/fii-baratos.test.mjs` cobre: classificação (incluindo o limite de 60%), competência de referência, ranks, cada filtro e seu motivo de exclusão, "a conferir", um fundo fabricado cujos números foram calculados à mão (P/VP, rendimento de 12 meses e sua anualização, DY, rentabilidade patrimonial, alavancagem), escala do DY em fração e em %, a extração (última versão, migração de CNPJ pelo ISIN, campos zerados), determinismo, trava de sanidade e o ciclo gravar → verificar → detectar adulteração (arquivo editado e insumo trocado com manifesto "consertado").

## 12. Histórico de versões

| Versão | Data | Mudança |
|---|---|---|
| 1.0.0 | 2026-10-06 | Versão inicial, vinda do protótipo analisado com o informe real de 2026-08: classificação pelo ativo, ranking por grupo, filtros, lista "a conferir", trilha de auditoria e verificação independente. Sem publicação no app. |
