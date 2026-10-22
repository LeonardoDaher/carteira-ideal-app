# Metodologia da análise de ações (técnica, fundamentalista e confluência)

Decisão D119. Três abas dentro de **Simule Ações**, para **uma ação por vez**: **Análise técnica**, **Análise fundamentalista** e **Confluência**. Tudo é **calculado por regra, no navegador, a partir de dados verificáveis**: não há IA gerando números nem texto de análise. A conclusão é uma leitura **quantitativa e educacional**, nunca uma recomendação nem uma ordem de compra ou venda. As telas continuam avisando isso.

## O que é calculado onde

| Etapa | Arquivo | Quando roda |
|---|---|---|
| Séries diárias de preço | `scripts/atualizar-acoes.mjs` → `webapp-src/public/dados/acoes-series.json` | todo pregão (mesmo job das Ações) |
| Fundamentos da CVM | `scripts/atualizar-fundamentos.mjs` + `scripts/fundamentos-calculo.mjs` → `webapp-src/public/dados/fundamentos.json` | terça a sábado, de madrugada (`atualizar-fundamentos.yml`) |
| Análise técnica | `webapp-src/src/domain/analiseTecnica.ts` | no app, ao abrir a aba |
| Análise fundamentalista | `webapp-src/src/domain/analiseFundamentalista.ts` | no app, com o preço do dia |
| Confluência | `webapp-src/src/domain/confluencia.ts` | no app |

Os dois arquivos de dados ficam em `public/dados/` e só são baixados quando uma das três abas é aberta (como o `opcoes.json`). Os módulos de cálculo são puros (sem rede, sem relógio) e testados.

## Análise técnica

**Dados.** Fechamento, mínima, máxima e volume em R$ do Boletim de Preços da B3, até 260 pregões (cerca de 12 meses), com os desdobramentos confirmados em `config/acoes.json` já aplicados. Dividendos não ajustam a série.

**Limites declarados na tela.**
- O boletim **não traz a abertura**: não há candlestick (martelo, engolfo, doji) nem gap de abertura. O gráfico é de faixa (mínima a máxima) e fechamento, e o "gap" é medido entre mínima e máxima de dias seguidos.
- O volume é **financeiro (R$)**, não quantidade de ações nem número de negócios. O OBV é uma aproximação feita com esse volume.
- Com 12 meses, o gráfico **mensal** tem no máximo 12 barras e é sempre marcado como "histórico curto, baixa confiança"; a média de 200 pregões só existe com 200 ou mais pregões.
- Salto de preço não confirmado como desdobramento (hoje: 8 códigos) derruba a confiança e é avisado na tela.

**Tendência** (diário, semanal, mensal): três votos independentes: estrutura de topos e fundos (pivôs com 5, 3 e 1 barras de cada lado; folga de 0,2%), preço contra a média de referência (50 pregões, 21 semanas, 6 meses) e inclinação dessa média. Alta ou baixa exige 2 de 3 votos **e** que a estrutura ou a inclinação concorde: nunca só o preço contra uma média. ADX de 14 (Wilder) com 25 ou mais é "tendência forte"; movimento sem correções (sem pivôs) com ADX forte usa a inclinação no lugar da estrutura. Sem votos claros: consolidação (ADX abaixo de 20) ou transição.

**Indicadores.** Médias simples de 9, 21, 50 e 200 e exponenciais de 9 e 21; IFR de 14 (Wilder) com divergência altista e baixista pelos dois últimos fundos e topos; MACD 12, 26, 9 (linha, sinal, histograma, cruzamento em 10 pregões, posição sobre o zero, aceleração, divergência); ATR de 14 (Wilder) e ATR%; volume contra a média de 20, volume nas altas contra o das quedas, OBV financeiro e liquidez (abaixo de R$ 1 mi/dia é baixa; até R$ 10 mi, moderada).

**Zonas.** Pivôs de 4 barras agrupados por tolerância (metade do ATR%, entre 0,8% e 3%); só entra zona com 2 ou mais toques; relevância pelo número de toques e pela idade. Rompimento é "confirmado" (2 fechamentos além da zona), "tentativa" ou "falso" (voltou para dentro). Fibonacci é complementar (retração do maior movimento de 252 pregões).

**Padrões.** Só os que as regras comprovam: topo e fundo duplos (até 3% de diferença, 10 a 80 pregões entre eles, vale de pelo menos 4%), ombro-cabeça-ombro e o invertido, retângulo (faixa de até 12% com 2 toques em cada ponta), canal por regressão (R² de 0,6 ou mais) e triângulos. Cada padrão traz critérios, confirmação, invalidação, objetivo (só quando confirmado) e limitações. Bandeiras e flâmulas **não** são avaliadas.

**Pontuação (0 a 100).** Tendência e estrutura 30%, momentum 20%, volume e confirmação 20%, suportes e resistências 15%, volatilidade e risco 15% (pesos iniciais). Viés: 65 ou mais altista; 55 a 65 moderadamente altista; 45 a 55 neutro; 35 a 45 moderadamente baixista; abaixo de 35 baixista. O peso de cada período gráfico na nota de tendência depende do **horizonte** (curto 50/30/20, médio 25/50/25, longo 10/30/60 para diário/semanal/mensal). **Confiança** é separada: qualidade dos dados, concordância entre indicadores, clareza da estrutura, liquidez e conflito entre períodos; não é probabilidade de lucro. Se o viés é neutro e a confiança é baixa (ou o diário está em consolidação ou transição), a conclusão é *"Sem sinal técnico suficientemente consistente neste momento"*.

**Hipótese operacional** (só de compra, só em viés altista, sem liquidez baixa): região de entrada no suporte mais próximo, stop = suporte menos meio ATR, alvos = próximas resistências, relação retorno/risco de pelo menos 1. Sem estrutura que a sustente, a tela diz por que não há hipótese. Não é ordem de compra.

**Histórico dos sinais.** Cruzamentos de médias e do MACD, entrada do IFR em 30 e 70 e rompimentos de 20 pregões, cada um com o que o preço fez nos 10 pregões seguintes. São poucos casos: **não** formam taxa de acerto, e a tela diz isso.

## Análise fundamentalista

**Dados.** DFP (5 exercícios) e ITR (12 meses) da CVM, em R$ mil, em base consolidada quando existe. O exercício usa a coluna *penúltimo* da DFP seguinte (reapresentada) e o job avisa quando o lucro mudou mais de 2%. O TTM é exercício anterior + acumulado do ano − acumulado do ano anterior, com as funções já auditadas do Top 15 (`ltmDaConta`, `saldoDaConta`, `sanearCapital`, `valorDeMercado`), **importadas sem alteração** para não mudar o hash da auditoria do Top 15.

**Validação cruzada (22/10/2026).** Lucro e caixa operacional de 12 meses de 96 empresas do Top 15 batem com a auditoria de 05/10 (95 de 96; a exceção, CAML3, tem outro exercício social e outra data de corte). Corrigido na própria validação: bancos e seguradoras não usam `2.03` (patrimônio) nem `3.11` (lucro); acham-se pelo nome.

**Quantidade de ações.** Por classe (ON e PN), sem tesouraria, com as mesmas regras do Top 15 (ajuste manual de unidade, ajuste automático com dois sinais, desdobramento posterior ao balanço) mais um passo novo: **desdobramentos, bonificações e erros de unidade (×100, ×1000) ainda não cadastrados são detectados pelo salto na quantidade de ações entre exercícios** e desfeitos nos anos anteriores (fatores 1,1; 1,2; 1,25; 1,3; 4/3; 1,4; 1,5; 2; 3; 4; 5; 10 e os inversos, tolerância de 1,2%). Cada ajuste fica registrado na empresa e nas limitações da tela. Quantidade implausível frente ao patrimônio (P/VP implícito fora de 0,05 a 100) suprime valor de mercado, múltiplos e valor justo.

**Instituições financeiras** (setores Bancos, Seguros e previdência, Bolsa, holdings e serviços financeiros): EBIT, EBITDA, dívida, caixa operacional e CAPEX não são publicados; a leitura usa lucro, ROE, P/L, P/VP, PL/ativos e dividendos.

**Indicadores.** ROIC = NOPAT ÷ capital investido (NOPAT = EBIT sem equivalência × (1 − 34%); capital = PL + dívida − caixa); ROE sobre o PL médio; ROA; margens; LPA; dívida líquida/EBITDA; cobertura de juros; liquidez corrente; FCO; **FCF = FCO − CAPEX**; conversão do lucro em caixa; P/L, P/VP, EV/EBITDA, EV/EBIT, P/Vendas, P/FCF e dividend yield; payout sobre o lucro e proventos sobre o FCF. Cada indicador mostra valor, histórico, referência do setor, interpretação, fórmula, fonte e data. Valor ausente é *null*, nunca zero; o app escreve "dados insuficientes para conclusão".

**Trava do caixa operacional.** FCO acima de 2× o EBITDA (ou o EBIT) é tratado como financiamento classificado como operação (caso MGLU3, com FCO de R$ 16 bi sobre valor de mercado de R$ 11 bi): o FCF não é usado na avaliação nem na conversão, e a tela alerta. É a mesma trava do Top 15.

**Comparação setorial.** Mediana das **outras empresas do mesmo setor** do cadastro, com pelo menos 4 com o múltiplo; sem isso, "poucas empresas comparáveis". Financeiras só se comparam entre si. Não há comparação com o histórico próprio de 5 anos porque o histórico de preços tem 12 meses.

**Valor justo** (três cenários, faixa e confiança):
- *Não financeiras:* (1) fluxo de caixa livre descontado: FCF normalizado (média de até 3 períodos, ×0,8/1/1,1 por cenário), crescimento de 5 anos igual ao crescimento composto da receita limitado a 2%–10% (×0,5/1/1,5), crescimento terminal e taxa de desconto; (2) LPA normalizado × P/L mediano do setor (×0,8/1/1,2). O valor do cenário é a média dos métodos aplicáveis.
- *Financeiras:* P/VP justo = (ROE − g) ÷ (custo do capital − g), com o ROE médio dos 3 últimos exercícios (×0,85/1/1,1), e o mesmo P/L do setor.
- **Premissas.** Custo do capital próprio = **Selic meta + 1 p.p.** (pessimista +2 p.p., otimista −2 p.p.); crescimento terminal = **IPCA de longo prazo do Focus + 0,5 p.p.** (pessimista −1, otimista +1). Ambos vêm de `mercadoOficial.json`; sem eles valem 15% e 4%. Com a Selic de 13,75% em 20/10/2026, o custo base é 14,75%. O valor justo é muito sensível a isso, por isso a **faixa** entre cenários importa mais que o número único.
- **Limitação assumida:** empresas de crescimento muito alto (WEGE3, por exemplo) aparecem caras, porque o modelo limita o crescimento explícito. A tela diz isso.
- **Margem de segurança** = 1 − preço ÷ valor justo base; **potencial** = valor justo ÷ preço − 1 (são diferentes e aparecem separados); **preço de entrada** = valor justo × (1 − 25%). Se nenhum método se aplica (FCF negativo e sem múltiplo do setor), **não se força preço-alvo**.
- **Confiança** cai com: um só método, métodos que divergem mais de 1,6×, faixa entre cenários maior que 2,2×, menos de 4 exercícios, preço de classe aproximado.

**Pontuação.** Qualidade (40%): rentabilidade 30, crescimento do LPA 20, consistência (lucro em quantos exercícios e estabilidade de margem positiva) 25, geração de caixa 25. Valuation (35%): margem de segurança 60, múltiplos contra o setor 40. Segurança e risco (25%): endividamento 35 (régua mais folgada para energia, saneamento, telecom e concessões), cobertura de juros 20, liquidez corrente 15, diluição 15, proventos contra o FCF 15 (e, nas financeiras, PL/ativos e estabilidade do lucro). Critério sem dado sai da média, e a nota fica **parcial** se uma dimensão inteira falta. Os pesos 40/35/25 são configuráveis (`Premissas.pesos`).

**Alertas** (crítico, atenção ou informação): lucro persistentemente negativo, FCF estruturalmente negativo (crítico só se o lucro, o endividamento ou a cobertura também forem frágeis), endividamento preocupante (dívida líquida/EBITDA acima de 3,5×, ou 5× em setores de infraestrutura; ou EBIT menor que a despesa financeira), deterioração de margens, diluição (recorrente = 2 ou mais aumentos de mais de 3%; crítico se o total passa de 30%), proventos acima do lucro e do FCF, caixa operacional incoerente e dados incompletos. **Uma nota alta não neutraliza um alerta crítico**: com alerta crítico a categoria não passa de "Neutra". **Problema de dados não é risco da empresa**: vira "dados insuficientes para conclusão" e "manter/acompanhar", nunca "evitar".

**Categoria e leitura final.** Atrativa (nota 68+, qualidade 65+, valuation 60+, segurança 55+, sem alerta crítico); atrativa com ressalvas (58+); neutra; pouco atrativa (abaixo de 45 ou valuation muito baixo com qualidade média); evitar ou reavaliar (abaixo de 35, ou alerta crítico com qualidade abaixo de 60). A leitura final (considerar entrada, aguardar preço mais atrativo, manter/acompanhar, reduzir exposição, evitar novos investimentos) decorre dessas condições e da margem de segurança, **não** só da nota, e traz a justificativa e o que justificaria reavaliar. "Considerar entrada" e "reduzir exposição" exigem valor justo com confiança média ou alta.

**O que NÃO é calculado** (porque a CVM não traz texto): barreiras de entrada, marca, escala, tecnologia, gestão, partes relacionadas, auditoria, controvérsias, TAM e perspectivas setoriais. Aparecem como **"dados insuficientes para conclusão"**. A vantagem competitiva é só um *indício financeiro* (ROIC acima de 15% em quantos exercícios, estabilidade da margem bruta), rotulado como tal. Os riscos externos são descrições gerais do setor, não da empresa. Crescimento real (sem IPCA no app) e lucro recorrente também não existem.

## Confluência

Compara a postura de cada análise: fundamentalista (atrativa e com ressalvas = favorável; neutra; pouco atrativa e evitar = desfavorável; dados críticos = indisponível) e técnica (viés altista ou moderadamente altista = favorável; neutro ou sem sinal = neutra; baixista = desfavorável). O quadro 3×3 dá a situação (confluência positiva, fundamentos favoráveis com gráfico contra, gráfico forte com fundamentos fracos etc.).

- **Pontuação combinada** = média ponderada das duas notas, por horizonte: longo 70% fundamentos e 30% gráfico, médio 50/50, curto 30/70. A tela avisa que duas notas médias podem esconder uma boa e uma ruim.
- **Convicção:** alta só com as duas leituras no mesmo sentido e confiança boa nas duas; baixa quando são opostas ou uma está indisponível; média nos demais casos.
- **Confluência de preço:** compara o preço de entrada fundamentalista (25% de margem) com o suporte técnico mais próximo (coincide, acima do suporte, abaixo do suporte ou preço atual já abaixo).
- **O que acompanhar** e **riscos de interpretação** (liquidez baixa, salto de preço, valor justo frágil, balanço de data anterior ao preço, horizontes diferentes).
- Sem uma das duas análises, a confluência é **"incompleta"** e não há pontuação.

## Operação e verificação

- Para rodar à mão: `npm run atualizar-fundamentos` (baixa cerca de 110 MB da CVM; `--dados-locais=PASTA` guarda os zips e reutiliza). O job só grava o arquivo se houver pelo menos 100 empresas com fundamentos e falha **sem alterar nada** se a CVM mudar o layout.
- Primeira execução real (22/10/2026): 190 de 226 empresas do cadastro com fundamentos. Ficam de fora: 12 sem CNPJ no FCA, 20 sem negócio nos últimos 10 pregões, 4 com demonstração defasada, 2 sem exercícios completos e as demais por motivos listados em `excluidas` no próprio arquivo.
- Testes: `analiseTecnica.test.ts`, `analiseFundamentalista.test.ts`, `confluencia.test.ts`, `SimuleAcoesAnalise.test.tsx`, `scripts/fundamentos.test.mjs` e os novos casos em `scripts/atualizar-acoes.test.mjs`.
