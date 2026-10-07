# Metodologia da triagem "FIIs baratos" (Tijolo e Papel)

**Versão da metodologia: 1.4.0** · Decisão de origem: D59 (alertas e conferência manual: D60) · Parâmetros: `config/fii-baratos.json` (fonte única) · Código: `scripts/fii-baratos-calculo.mjs` (cálculo puro), `scripts/atualizar-fii-baratos.mjs` (leitura da CVM e gravação da auditoria), `scripts/fii-baratos-verificar.mjs` (verificação independente).

> **Estado: NÃO PUBLICADO.** Este job só grava a trilha de auditoria em `auditoria/fii-baratos/<data>/`. Não há tela no app, código de acesso nem arquivo lido pelo site. Publicar depende de decisão do responsável (seção 9).

## 1. O que é, e o que não é

É uma **triagem contábil e de preço**, por fórmula e com dados públicos, que separa os FIIs em **Tijolo** e **Papel** e, dentro de cada grupo, ordena os que combinam **P/VP baixo** (cota barata em relação ao patrimônio) e **dividend yield de 12 meses alto**. **Não** é recomendação de compra, não considera o perfil de ninguém, e "barato" aqui significa só "P/VP baixo com rendimento alto": um desconto grande pode refletir um problema real do fundo (vacância, inadimplência, alavancagem) que os dados abertos usados aqui não mostram por inteiro (seção 10).

## 2. Fontes de dados (gratuitas e públicas)

| Fonte | O que traz | Observação |
|---|---|---|
| **Informe Mensal de FII da CVM** (`inf_mensal_fii_AAAA.zip`: `complemento`, `geral`, `ativo_passivo`) | DY do mês, valor patrimonial da cota, rentabilidade patrimonial, patrimônio líquido, cotistas, valor do ativo; ISIN e segmento declarado; composição do ativo e do passivo | Anos A−1 e A. Cada arquivo baixado tem URL, tamanho e sha256 no manifesto |
| **Preço diário** (`historico/fiis.json`, do job "Atualizar preço diário dos FIIs", `scripts/atualizar-fiis-historico.mjs`) | Fechamento, mínima, máxima e volume financeiro (R$) de cada pregão dos fundos do job de FIIs, a partir do **Boletim de Preços oficial da B3** (BVBG.086), sem chave e sem cota | **Fonte principal da cotação e da liquidez (1.4.0).** Usa os 21 últimos pregões; cotação com mais de `dados.cotacaoDiariaMaxIdadeDias` (7) dias da execução tira o fundo (`cotacao_defasada`) |
| **Cotação e volume mensais** (`webapp-src/src/data/rendimentosFii.json`, do job mensal de FIIs, brapi) | Cotação, data, volume médio e mediano (21 pregões), nome, setor | **Reserva**: vale só para o fundo sem preço diário (fora do histórico, ou sem negócio na janela), a menos que `dados.precoDiarioObrigatorio` seja `true`. Mais velha que `dados.cotacaoMaxIdadeDias` (45) dias: o fundo sai |

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
| **DY recente** | mediana dos rendimentos por cota dos 3 últimos meses (todos com dado) × 12 ÷ cotação | Mostra o rendimento de hoje, não o de 12 meses atrás |
| **Razão recente** | mediana dos 3 últimos meses ÷ mediana dos 12 meses | Abaixo de 0,75 = corte de rendimento (alerta `rendimento_em_queda`) |
| **Pico de rendimento** | média dos 12 meses ÷ mediana dos 12 meses | Acima de 1,25 = o DY de 12 meses depende de poucos meses atípicos (alerta `rendimento_com_pico`) |
| **Alavancagem** | (passivo total − rendimentos a distribuir − taxas a pagar) ÷ valor do ativo | Aproximação do passivo oneroso |

A escala do DY no informe varia (fração ou %): decide-se por competência, pela mediana de todos os fundos (acima de 0,05 = em %). A mesma escala vale para a rentabilidade patrimonial.

## 6. Filtros (por grupo)

Aplicados na ordem; o primeiro que reprova é o motivo registrado.

| Filtro | Tijolo | Papel |
|---|---|---|
| Liquidez (volume **mediano** diário, 21 pregões) | ≥ R$ 300 mil | ≥ R$ 300 mil |
| Patrimônio líquido | ≥ R$ 200 mi | ≥ R$ 150 mi |
| Cotistas (se informados) | ≥ 3.000 | ≥ 3.000 |
| P/VP | ≥ 0,3 | **≥ 0,7** |
| DY de 12 meses | — | ≤ 25% |
| Rentabilidade patrimonial de 12 meses | ≥ −15% | **≥ −5%** |
| Alavancagem | ≤ 40% | ≤ 40% |

O **mínimo de liquidez é o mesmo** nos dois grupos desde a 1.3.0 (R$ 300 mil de mediana por dia; antes era R$ 500 mil no tijolo, diferença que só existia para fechar 15 fundos no papel quando o corte se aplicava à média). O papel tem patrimônio mais folgado (quase todo fundo de papel é menor) e é mais rígido em P/VP (≥ 0,7) e queda patrimonial (≥ −5%), porque desconto grande em fundo de crédito costuma ser **perda já precificada**, não pechincha.

A liquidez usa a **mediana** do volume financeiro diário (R$, dias sem negócio contam zero) quando o job de FIIs a traz, e a média quando não (cada fundo registra a fonte em `liquidez_pela`). A média é puxada por poucos dias de negociação intensa: com as cotações de 07/10, SAPI11 e BROF11 passaram pelo filtro com volume médio acima do mínimo, mas negociam R$ 181 mil e R$ 354 mil por dia no Investidor10.

## 7. "A conferir", conferência manual e ranking

**A conferir.** Fundo com qualquer destes alertas **não entra no ranking**: vai para `a-conferir.csv`, sem posição, até alguém confirmar o dado numa fonte pública. Ele sai **antes** de calcular os ranks, para não distorcer a nota dos demais.

| Alerta | Regra | O que costuma ser |
|---|---|---|
| `pvp_muito_baixo` | P/VP < 0,55 | Cota e valor patrimonial em bases diferentes (desdobramento) ou desconto real e grande |
| `dy_alto` | DY de 12 meses > 18% | Distribuição não recorrente, ou risco de crédito alto no papel |
| `rendimento_em_queda` | mediana dos 3 últimos meses < 0,75 × mediana dos 12 meses | Corte de rendimento: o DY de 12 meses mostra o passado (MFII11: R$ 0,91 → R$ 0,30 por mês; BBIG11: R$ 0,07 → R$ 0,03) |
| `salto_de_preco` | variação de fechamento de mais de 25% de um dia para o outro nos 21 pregões do histórico diário | Cota que mudou de base (desdobramento ou grupamento): o P/VP deixa de fazer sentido |
| `rendimento_com_pico` | média dos 12 meses > 1,25 × mediana | Pagamento extra, pico no informe ou rendimento de antes de um corte (HGRE11: R$ 8,52 num mês do informe, DY de 12 meses de 16,6% contra ~9,4% no Investidor10; KORE11: R$ 1,25 → R$ 0,60 em janeiro) |

As duas últimas regras usam **mediana** de propósito. A primeira versão (média dos 2 últimos meses) marcou por engano GTWR11 e BRCO11, que pagam todo mês mas têm um mês com DY zero no informe da CVM; um mês zerado ou um pico isolado não pode decidir sozinho.

**Conferência manual** (`config/fii-baratos.json → conferencia`). Quem conferiu o dado numa fonte pública registra o fundo com **data, fonte, nota e a lista de alertas que a conferência libera**. Fundo com conferência vigente que cobre **todos** os alertas dele entra no ranking, marcado como conferido (coluna `conferido`, `alertas_liberados`). Regras de segurança: (a) a conferência vale por **90 dias** (`validadeDias`) a partir de `conferidoEm`, e depois disso o fundo volta para "a conferir" com a marca `conferenciaVencida`; (b) **alerta novo**, que a conferência não cobre, segura o fundo de novo; (c) conferência datada do futuro não vale. **Conferir o dado não é recomendar o fundo**: a conferência cobre a base dos números, não a qualidade dos imóveis nem o risco de crédito.

Conferidos em 07/10/2026 (Investidor10): **BRCR11** (libera `pvp_muito_baixo`: valor patrimonial e patrimônio batem, rendimento fixo de R$ 0,41 por mês) e **OUJP11** (libera `dy_alto`: dados batem e o rendimento alto é recorrente; é fundo de papel de alto retorno, e o risco de crédito não foi avaliado).

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

## 9. Publicação (pendente, decisão do responsável) e enquadramento proposto

`config/fii-baratos.json → publicacao.aprovadoPeloResponsavel` é `false` e **este job não escreve nada no app**. Para publicar (tela, código de acesso, divulgação) faltam decisões do responsável:

1. **Enquadramento regulatório.** Há uma **proposta** em `config/fii-baratos.json → publicacao.enquadramento`, com o texto de aviso (`avisoProposto`) no tom do Top 15 de ações. Resumo: triagem objetiva por fórmula, igual para todos, com dados públicos, regras e parâmetros públicos e trilha de auditoria; não considera o perfil de ninguém, não indica compra nem venda, não projeta preço nem rendimento e não promete retorno. Pontos para decisão: (a) mesma base da D22 (análise jurídica interna sem objeção), mas FIIs têm risco próprio (o desconto no P/VP costuma ser risco de crédito ou vacância já precificado; o rendimento é estimado); (b) a D22 previu parecer independente antes de divulgar em escala ou de telas que mudem a natureza do conteúdo (ranking de ativos); (c) a lista "a conferir" e a de fundos conferidos envolvem juízo humano sobre o **dado**, nunca sobre o mérito do fundo; (d) a separação entre Tijolo e Papel é por regra objetiva (composição do ativo).
2. **Preço diário.** **Construído na 1.4.0** (seção 2): o preço do dia vem do Boletim de Preços da B3, com histórico próprio. Falta ligar `dados.precoDiarioObrigatorio` (hoje `false`, para a triagem seguir funcionando com a reserva mensal durante a transição); ele deve virar `true` junto com a aprovação, para nenhum fundo publicado depender de preço mensal.
3. **Tela e acesso**, que seguiriam o desenho do Top 15 de ações (D50): ranking em `dados-privados/`, código do mês validado no servidor, texto de aviso lido de `publicacao.avisoProposto`.
## 10. Limitações conhecidas

1. **Faltam vacância e inadimplência.** Estão em outros arquivos da CVM (informes trimestral e anual), por imóvel e por devedor, e não entraram nesta versão. A rentabilidade patrimonial de 12 meses é um **indicador indireto** de perda de valor, não a medida direta.
2. **O rendimento é estimativa** (DY × valor patrimonial). Em meses de emissão ou de fechamento de semestre pode distorcer (a D10 mediu desvios de até 57% num mês isolado); a média de 12 meses atenua, não elimina.
3. **Valor patrimonial é contábil.** Para tijolo, o valor de mercado dos imóveis pode ser bem diferente; P/VP baixo não significa que o fundo vale mais do que o mercado diz.
4. **P/VP baixo em papel** costuma ser risco de crédito precificado. O filtro de P/VP ≥ 0,7 e o de queda patrimonial ≥ −5% reduzem, mas não eliminam, esse risco.
5. **Preço.** Com o histórico diário da B3 o P/VP usa a cotação do último pregão (no máximo 7 dias de idade); a cotação é **sem ajuste** (desdobramento, grupamento): o alerta `salto_de_preco` aponta o sintoma. O valor patrimonial vem do informe mensal (de até ~2 meses atrás), então P/VP mistura um preço de hoje com um patrimônio do mês passado. Fundo fora do histórico diário cai no preço mensal da brapi (reserva), que pode ter semanas.
6. **Cotas e valor patrimonial em bases diferentes** (desdobramento, grupamento) não são detectados automaticamente; o alerta de P/VP < 0,55 só aponta o sintoma.
7. **Fundos fora do `rendimentosFii.json`** não são avaliados, e o universo depende do filtro de liquidez daquele job.
8. **Não há backtest.** A metodologia não afirma nada sobre desempenho passado, e qualquer promessa de retorno está fora do escopo.
9. **Limiares são escolhas** a partir da distribuição observada na primeira execução (competência 2026-08), não regras de mercado: liquidez, patrimônio, cotistas, alavancagem, P/VP mínimo, queda patrimonial, DY máximo e os alertas (P/VP, DY alto, razão recente e pico de rendimento).
10. **Fundo que muda de CNPJ** (Resolução CVM 175) é ligado pelo ISIN; casos ambíguos aparecem em `origemCnpj`.
11. **O informe da CVM tem meses atípicos** (DY zero num mês em que o fundo pagou, ou um pico que o site do fundo não mostra, como o R$ 8,52 de HGRE11 em janeiro/26). Por isso os indicadores de rendimento recente usam mediana e há o alerta de pico; ainda assim, um erro que se repita nos 12 meses não é detectável.
12. **A conferência manual cobre só a base dos dados** (cota, valor patrimonial, rendimento). Não avalia vacância, qualidade dos imóveis, inadimplência nem risco de crédito.
13. **Valor patrimonial por cota: vale o do informe da CVM** (patrimônio líquido ÷ cotas emitidas), por decisão do responsável (D60): é a fonte oficial e reproduzível. Sites de dados (Investidor10) podem dividir pelas cotas **em circulação**, sem as que o fundo mantém em tesouraria depois de recomprar; o informe mensal não traz a quantidade em tesouraria. Caso observado: BBIG11, R$ 9,74 no informe (99,12 mi de cotas) contra R$ 10,72 no site (90,12 mi), com o mesmo patrimônio de R$ 965,9 mi (causa provável, não confirmada: cotas recompradas). Em fundo com recompra, o P/VP calculado fica **acima** do que um cotista de fato detém (o fundo é mais descontado do que o ranking mostra).
14. **Liquidez:** com o histórico diário da B3 (1.4.0), a média e a mediana vêm dos 21 últimos pregões do boletim (volume financeiro em R$, dia sem negócio conta zero); sem ele, vêm do job mensal de FIIs (brapi), e sem a mediana, vale a média. O mínimo de R$ 300 mil foi escolhido com as medianas reais de 07/10 (84 fundos de tijolo e 22 de papel saíram por liquidez; só 4 de tijolo ficavam entre R$ 300 mil e R$ 500 mil, e 2 de papel a menos de R$ 15 mil do corte); como todo limiar, é uma escolha, não regra de mercado.

## 11. Testes automatizados

`scripts/fii-baratos.test.mjs` cobre: classificação (incluindo o limite de 60%), competência de referência, ranks, cada filtro e seu motivo de exclusão, "a conferir", um fundo fabricado cujos números foram calculados à mão (P/VP, rendimento de 12 meses e sua anualização, DY, rentabilidade patrimonial, alavancagem), escala do DY em fração e em %, os alertas de rendimento (corte, mês zerado isolado, pico, janela incompleta e limites exatos), a conferência manual (libera só os alertas listados, validade de 90 dias, alerta novo, conferência vencida ou do futuro), a extração (última versão, migração de CNPJ pelo ISIN, campos zerados), determinismo, trava de sanidade e o ciclo gravar → verificar → detectar adulteração (arquivo editado e insumo trocado com manifesto "consertado").

## 12. Histórico de versões

| Versão | Data | Mudança |
|---|---|---|
| 1.4.0 | 2026-10-07 | Preço DIÁRIO da B3 (histórico próprio, `historico/fiis.json`) como fonte da cotação e do volume, com o preço mensal da brapi como reserva; alerta `salto_de_preco`; TGAR11 aceito no ranking por decisão do responsável (conferido); proposta de enquadramento e aviso em `publicacao`. |
| 1.3.0 | 2026-10-07 | Mínimo de liquidez único de R$ 300 mil (mediana) nos dois grupos; o do tijolo cai de R$ 500 mil. Decisão do responsável, com as medianas reais de 07/10. |
| 1.2.0 | 2026-10-07 | Liquidez pela mediana do volume diário (o job de FIIs passa a gravar `volumeMediano`; a média continua), com a fonte registrada por fundo; mínimos inalterados. |
| 1.1.0 | 2026-10-07 | Conferência dos 6 fundos de "a conferir" no Investidor10. Novos alertas `rendimento_em_queda` (mediana dos 3 últimos meses < 75% da mediana de 12 meses) e `rendimento_com_pico` (média > 125% da mediana), ambos por mediana; lista `conferencia` com validade de 90 dias e alertas liberados por fundo (BRCR11 e OUJP11); novas colunas nos CSVs. A primeira tentativa (média de 2 meses) foi descartada por falso positivo em GTWR11 e BRCO11. |
| 1.0.0 | 2026-10-06 | Versão inicial, vinda do protótipo analisado com o informe real de 2026-08: classificação pelo ativo, ranking por grupo, filtros, lista "a conferir", trilha de auditoria e verificação independente. Sem publicação no app. |
