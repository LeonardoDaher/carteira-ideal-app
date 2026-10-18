# Metodologia: estratégias montadas, manejo e roda (Simule Opções)

Abas "Estratégias" e "Roda" do Simule Opções (D103 a D107). Descritivas e educacionais, sem indicar operação. O cálculo roda no navegador (`webapp-src/src/domain/modelosDeEstrategia.ts`, `simulaOpcoes.ts`, `rolagem.ts` e `roda.ts`), com as séries reais do último pregão e o modelo de Black-Scholes onde é preciso estimar.

## 1. Onde fica cada coisa

- **Séries da B3:** compra e venda de uma call ou put soltas (botões C e V da tabela), já com o gráfico.
- **Estratégias ("Monte sua estratégia"):** estruturas com mais de uma perna.
- **Tendência:** sugere estruturas por visão de mercado (docs/13).
- **Roda:** um giro da roda (wheel).

## 2. Catálogo da aba Estratégias

Cada modelo define as pernas (call ou put, compra ou venda, múltiplo do lote) e o **degrau** de strike a partir do strike mais perto do preço do ativo (0 é o mais perto, +1 o seguinte acima, −1 o abaixo). É só o ponto de partida: o usuário troca a série (e o vencimento) de cada perna.

| Grupo | Modelos |
| --- | --- |
| Travas | trava de alta (calls e puts), trava de baixa (puts e calls) |
| Borboletas e condors | borboleta de calls, de puts e de ferro; condor de ferro e de calls |
| Volatilidade | straddle e strangle, comprados e vendidos (os vendidos mostram aviso de risco ilimitado) |
| Com ações | venda coberta, collar |
| Vários vencimentos | THL de calls e de puts; diagonal de calls e de puts |
| Renda e proteção (Prefiro PUT) | slide com put, put vendida otimizada, strangle comprado financiado, booster |

As quatro estruturas do último grupo seguem as definições dos textos públicos do canal e as mais comuns de mercado; as pernas exatas variam de uma mesa para outra, e a tela diz isso. O app confere a ordem dos strikes (por exemplo, a trava de alta com strikes trocados pede correção) e, nas de dois vencimentos, que a perna longa vence depois da curta.

## 3. Vencimentos diferentes (D104)

Com um vencimento só, o resultado no vencimento é exato (valor intrínseco). Com vencimentos diferentes, o gráfico mostra a posição **na data do primeiro vencimento**: a perna curta vale o intrínseco e as longas valem o preço de Black-Scholes com o prazo que resta. Cada perna usa a **volatilidade implícita do próprio preço**, de modo que, hoje, a posição vale o que custou. Ganho e perda máximos e equilíbrios viram **estimados** (varredura do preço de perto de zero a três vezes o maior valor de referência; "sem limite" quando sobram calls líquidas compradas ou vendidas). A tela avisa que é estimativa.

## 4. Manejo (D105)

Abaixo do resultado de toda estrutura montada:

1. **Cenários no primeiro vencimento:** ativo −10%, −5%, parado, +5% e +10%; resultado da estrutura e séries vendidas dentro do dinheiro (exercidas).
2. **Desmontar:** resultado de encerrar tudo num cenário (preço do ativo e dias úteis que passam), com cada opção valorizada por Black-Scholes.
3. **Rolagem:** encerra as pernas marcadas pelo valor do cenário (o resultado é realizado) e abre as novas, no mesmo lado e quantidade, pelo preço estimado no mesmo cenário. Mostra crédito ou débito líquido por troca, avisa quando há débito e abre a posição depois da rolagem com o mesmo painel de resultado (`Posicao.realizado` soma o que já foi realizado). Pernas que não rolam e já venceram até o cenário são encerradas pelo intrínseco.
4. **"O que costuma ser feito":** texto descritivo conforme as pernas vendidas.

Limites: último preço negociado e modelo europeio sem dividendos (o preço real de compra e venda pode ser pior; o crédito de uma rolagem real tende a ser menor que o estimado); a rolagem mantém o tipo da perna.

## 5. Roda (D107)

Um giro: **passo 1**, put coberta por caixa (caixa = strike × quantidade; rendimento do prêmio no prazo; "equivale a, por mês" por regra de três para 21 dias úteis, só para comparar; preço efetivo se exercida = strike − prêmio; chance de exercício pelo modelo); **passo 2**, se a put for exercida, a call coberta no vencimento seguinte. O prêmio da call é **estimado**: só será conhecido depois do exercício, com o ativo perto do strike da put, então a série é valorizada por Black-Scholes nesse cenário com a volatilidade implícita do último preço dela. Mostra chance de a ação ser vendida, equilíbrio das ações (strike da put − prêmios) e ganho do giro completo (diferença dos strikes + os dois prêmios). A roda não elimina o risco: com a ação bem abaixo do strike, fica-se com um papel que vale menos do que se pagou, e a call coberta trava a recuperação. Só vale para ativos que a pessoa aceitaria ter ao preço do strike. Não projeta vários meses.

## 6. Sobre "garantir renda"

Nenhuma estrutura garante renda: a renda de opções vem de vender prêmio, e o risco que o mercado cobra por ele fica com quem vende. As telas mostram o que cada estrutura rende no cenário bom e quanto custa no ruim, e não prometem resultado.
