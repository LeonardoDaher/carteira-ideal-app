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
