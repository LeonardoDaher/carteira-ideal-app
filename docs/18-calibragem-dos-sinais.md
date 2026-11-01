# 18. Calibragem dos sinais de candle (backtest com 5 anos)

Registro da Fase 4 do plano de `docs/17-criterios-analise-grafica-farol.md` (decisão D132). Mede, com o histórico de 5 anos de candles com abertura real, o que os sinais da D130 e os filtros da D131 entregaram, e diz quais limiares foram mantidos, mudados ou deixados sem comprovação. **É estudo de método, não promessa de retorno.**

## 1. Como foi medido

- **Dados:** 218 ações com arquivo em `public/dados/acoes-historico/` (nov/2021 a out/2026), ajustadas a desdobramentos. 23.473 operações simuladas.
- **Sinal:** o detector de `sinaisDeCandle` roda candle a candle e só enxerga o que já aconteceu até aquele candle.
- **Entrada:** no primeiro candle, em até 5 depois do sinal, que supera a máxima (compra) ou perde a mínima (venda) do candle de sinal. Se abre além do gatilho, entra na abertura. Stop perdido antes do gatilho cancela. Se no candle da entrada o stop também é tocado, vale o stop (hipótese conservadora).
- **Saída:** no stop (na abertura, se abrir além dele) ou no fechamento do 20º candle depois da entrada.
- **Resultado em R:** lucro ou prejuízo dividido pelo risco (entrada menos stop). Perder o stop em geral é -1 R.
- **Referência:** todo candle de 40 em diante tratado como "sinal" (gatilho na máxima, stop na mínima, risco até 10%), 258.852 operações. Um sinal só tem valor se for melhor que isso.
- **Treino e teste:** entradas até 30/06/2024 (treino) e depois (teste). O teste inclui o choque da eleição de out/2026.
- **O que não entra:** custos, corretagem, dividendos, impostos. **Vício de sobrevivência:** só as ações que ainda existem, o que favorece compras. Sinais vizinhos na mesma ação são correlacionados, então o erro-padrão mostrado é otimista.
- **Reprodução:** `BACKTEST=1 BACKTEST_SAIDA=arquivo.json npx vitest run src/domain/backtestSinais.run.test.ts` (cerca de 1 minuto), em `webapp-src`.

## 2. Resultado

### Sinais contra a referência (média em R, ± erro-padrão)

| Grupo | Treino | Teste |
|---|---|---|
| Referência, compra | -0,13 | -0,11 |
| Referência, venda | -0,14 | -0,27 |
| Sinais de compra | -0,07 ± 0,03 | +0,13 ± 0,04 |
| Sinais de venda | -0,07 ± 0,02 | -0,15 ± 0,03 |

Os sinais ficam **acima da referência** nos dois períodos e nos dois lados, mas só a compra do período de teste ficou claramente positiva. A venda é negativa nos dois períodos.

### Por tipo (média em R, treino / teste)

| Sinal | Treino | Teste | Leitura |
|---|---|---|---|
| Engolfo de alta | +0,11 | +0,18 | positivo nos dois períodos (n ≈ 2.900) |
| Barra elefante de alta | -0,01 | +0,16 | neutro a positivo |
| Ignição de alta | -0,05 | +0,15 | inverteu de sinal |
| Trap de fundo | -0,09 | +0,19 | inverteu de sinal |
| Trap da banda inferior | -0,03 | +0,12 | inverteu de sinal |
| Martelo | -0,17 | +0,02 | fraco |
| Barra ignorada (compra) | -0,78 | -0,02 | muito negativo, poucos casos e stop curto (2%) |
| Estrela cadente | -0,09 | -0,29 | negativo |
| Trap de topo / da banda superior | 0,00 / -0,07 | -0,14 / -0,16 | negativo |
| Ignição e elefante de baixa | -0,10 / +0,01 | -0,03 / +0,07 | perto de zero |
| Engolfo de baixa | -0,05 | -0,11 | negativo |
| Barra ignorada (venda) | -0,27 | -0,39 | negativo |

### Filtros (média em R, treino / teste)

| Filtro | Passa | Reprova | Conclusão |
|---|---|---|---|
| Liquidez ≥ R$ 1 mi/dia (compra) | -0,04 / +0,19 | -0,24 / -0,16 | **sustentado** nos dois períodos |
| Liquidez ≥ R$ 1 mi/dia (venda) | -0,06 / -0,11 | -0,14 / -0,36 | **sustentado** |
| Ação esticada > 2,5 ATR (compra) | -0,08 / +0,13 | 0,00 / +0,11 | **não sustentado**: não é pior |
| Exaustão de 11 candles | n = 1 | n = 1 | sem dados: quase nunca ocorre com sinal ativo |

### Tamanho do stop (todos os períodos, média em R)

| Stop | Compra | Venda |
|---|---|---|
| até 3% | -0,11 | -0,26 |
| 3 a 5% | +0,01 | -0,17 |
| 5 a 10% | +0,09 | -0,03 |
| acima de 10% | +0,07 | +0,06 |

Stops curtos perdem mais vezes (79% a 81% terminam no stop) porque o ruído do dia os alcança. Em R, stop largo não é pior; o custo dele é o capital imobilizado por operação, que o R não mostra.

### Varredura de limiares (média em R, treino / teste)

| Limiar | Valores | Resultado |
|---|---|---|
| Corpo da ignição (ATR) | 1 / 1,5 / 2 / 2,5 | sem padrão: -0,02/+0,09, -0,07/+0,07, -0,10/+0,19, -0,03/+0,10 |
| Volume mínimo (× média de 21) | 0,8 / 1 / 1,5 / 2 | melhora com o corte nos dois períodos: -0,04/+0,07, -0,05/+0,09, -0,03/+0,09, **+0,03/+0,14** |
| Profundidade do trap (ATR) | 0,1 / 0,25 / 0,5 / 1 | sem ganho: todos perto de -0,05/-0,03 |
| Amplitude do elefante (ATR) | 1,5 / 2 / 2,5 / 3 | sem ganho; 3 ATR fica pior (+0,01/+0,03) |

## 3. O que mudou no app (D132)

| Item | Antes | Agora | Por quê |
|---|---|---|---|
| Filtro de liquidez | reprova abaixo de R$ 1 mi/dia | **mantido** | única regra sustentada nos dois períodos e nos dois lados |
| Ação esticada | reprova | **atenção** | reprovadas não foram piores que as demais |
| Exaustão | reprova | **atenção** | sem casos para medir |
| Ressalva na tela | não havia | **frase por lado** | compra: perto de zero em R e melhor que a referência; venda: resultado médio negativo |
| Limiares de ignição, elefante, trap e volume | provisórios | **mantidos** | nenhum mostrou ganho robusto nos dois períodos; volume 2× é candidato, a rever |

Nada foi ajustado só porque um valor ficou melhor em um período: escolher limiar no teste seria sobreajuste.

## 4. Limites e próximos passos

- A margem dos sinais sobre a referência é pequena (cerca de 0,1 a 0,3 R) e sem custos. **Não há vantagem comprovada**: o bom resultado da compra no período de teste (jul/2024 a out/2026) pode ser característica do período.
- Candidatos para uma segunda rodada, com dados novos ou outra janela: volume mínimo de 2×, engolfo de alta como sinal principal de compra, retirar ou rebaixar sinais de venda e a barra ignorada.
- Ainda não medidos: alvo e retorno/risco (o alvo depende de zonas calculadas em cada data), tendência a favor, rompimento de base e regra dos 50% do gap (não implementados), saída por parcial em 1:1 e stop móvel.
- O backtest não decide a nota da análise técnica: a nota e a leitura de tendência continuam como estavam.

## 5. Segunda rodada: rompimento de base e regra dos 50% do gap (D133)

Os dois sinais que faltavam da Fase 2 entraram em `sinaisDeCandle` e foram medidos do mesmo jeito (mesma entrada, saída, treino e teste; 28.179 operações com todos os sinais).

- **Rompimento de base:** o fechamento sai de uma base (12 candles ou mais, amplitude até 12%) que terminou no candle anterior, com 0,3% de folga, volume pelo menos na média de 21 e fechamento firme (terço da direção). A variação "com bandas de Bollinger estreitas antes" (largura no quinto mais baixo dos 120 pregões anteriores) é registrada na explicação e medida à parte.
- **Regra dos 50% do gap:** gap de pelo menos 0,8% nos últimos 15 candles; o preço toca o meio do gap, de corpo a corpo, pela primeira vez e fecha de volta no lado do gap (acima, no gap de alta). O sinal vale uma vez por gap.

| Sinal (média em R, treino / teste) | Treino | Teste | n (treino / teste) |
|---|---|---|---|
| Rompimento de base, alta | -0,72 ± 0,76 | +0,05 ± 0,07 | 722 / 887 |
| ... com bandas estreitas | -0,06 ± 0,08 | +0,13 ± 0,10 | 418 / 335 |
| Rompimento de base, baixa | -0,24 ± 0,06 | -0,09 ± 0,06 | 709 / 679 |
| ... com bandas estreitas | +0,08 ± 0,09 | -0,10 ± 0,09 | 393 / 338 |
| 50% do gap de alta | -0,33 ± 0,17 | +0,37 ± 0,34 | 62 / 51 |
| 50% do gap de baixa | -0,41 ± 0,21 | -0,56 ± 0,16 | 59 / 53 |

**Leitura:** nenhum dos dois mostrou vantagem robusta. O rompimento de alta fica perto de zero (o -0,72 do treino vem de poucas perdas enormes, com erro-padrão de 0,76), e as bandas estreitas melhoram o resultado nos dois períodos, mas dentro do erro. O gap de 50% tem poucos casos (cerca de 50 por período), inverte de sinal entre treino e teste na alta e é negativo na baixa. **Ficam no app como leitura descritiva, sem peso na nota e sem mudar filtros**, com a mesma ressalva por lado da seção 3.

## 6. Linhas de tendência: o sinal perto da reta (D134)

Para cada sinal, com só os candles até o dia do sinal (os últimos 300), calculou-se a LTA (sinais de compra) ou a LTB (sinais de venda) vigente e não rompida. "Perto" é o extremo do candle de sinal (mínima na compra, máxima na venda) a até 1,5% da reta; "longe" é o resto; "sem" é quando não havia linha válida.

| Grupo (média em R, treino / teste) | Treino | Teste | n (treino / teste) |
|---|---|---|---|
| Compra perto da LTA | +0,01 ± 0,08 | +0,26 ± 0,10 | 580 / 588 |
| Compra longe da LTA | -0,31 ± 0,22 | +0,11 ± 0,05 | 2.588 / 2.821 |
| Compra sem LTA | -0,05 ± 0,04 | +0,10 ± 0,04 | 3.938 / 3.044 |
| Venda perto da LTB | -0,19 ± 0,06 | -0,20 ± 0,06 | 604 / 638 |
| Venda longe da LTB | -0,10 ± 0,03 | -0,17 ± 0,08 | 2.381 / 2.296 |
| Venda sem LTB | -0,05 ± 0,02 | -0,13 ± 0,03 | 4.439 / 4.262 |

**Leitura:** compra perto da LTA fica à frente dos outros dois grupos nos dois períodos (cerca de 0,15 R no teste), mas a diferença está dentro de uns 1,5 erros-padrão e o grupo é pequeno: **sugestivo, não comprovado**. Venda perto da LTB é um pouco pior que as demais. Por isso a linha **não vira filtro nem entra na leitura do setup**: fica como desenho e nota descritiva no gráfico.
