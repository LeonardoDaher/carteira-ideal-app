# Metodologia: Top 15 maiores prêmios de opções (Simule Opções)

Aba "Top 15 prêmios" do Simule Opções (D97). Descritiva e educacional: mostra onde o mercado paga mais para quem vende opção, com o risco ao lado. Não indica operação. O cálculo roda no navegador (`webapp-src/src/domain/premios.ts`), sobre as séries do job diário (`docs/07`, D96).

## Pergunta que o ranking responde

**Para um mesmo risco, quem paga o maior prêmio?** Prêmio alto costuma ser o mercado cobrando por risco alto: ativos com volatilidade alta pagam mais, e nada disso é "dinheiro grátis". Por isso o ranking nunca aparece sem o risco ao lado.

## Cálculo

| Item | Put vendida | Call coberta |
| --- | --- | --- |
| Dinheiro travado | strike | preço do ativo |
| Séries aceitas | strike até o preço do ativo | strike a partir do preço do ativo |
| Rendimento no prazo | prêmio ÷ strike | prêmio ÷ preço do ativo |
| Colchão | queda até o equilíbrio: (preço − (strike − prêmio)) ÷ preço | o próprio prêmio, em % do preço |
| Ganho se exercida | não se aplica | (strike − preço + prêmio) ÷ preço |

- **Rendimento em 21 dias úteis** = rendimento no prazo × 21 ÷ dias úteis até o vencimento (regra de três simples, sem juros compostos). Serve para comparar prazos diferentes.
- **Chance de exercício** = N(−d2) na put e N(d2) na call, de Black-Scholes, com a volatilidade implícita no último preço da série (juro: Selic meta). É estimativa neutra ao risco, para comparar linhas entre si, e não uma previsão.
- **Volatilidade implícita** na linha mostra o risco do ativo por trás do prêmio.

## Escolhas e por quê

1. **Só séries fora ou no dinheiro.** Numa opção dentro do dinheiro, boa parte do preço é valor intrínseco (o que ela valeria se vencesse hoje), e não prêmio de verdade. Nas séries aceitas, o preço é todo valor extrínseco (tempo e volatilidade).
2. **O risco é um limite, e não uma razão.** Dividir prêmio por risco sempre favoreceria as opções perto do preço, porque o prêmio cai mais rápido que o risco quando o strike se afasta (a razão vira só "perda média se for exercida"). Fixando o limite (chance máxima de exercício de 10%, 15%, 25%, 40% ou sem limite, padrão 25%), a comparação entre ativos fica justa. Isso foi testado e descartado na primeira versão (ordenação "prêmio por risco").
3. **Padrão: só vencimentos mensais.** Levar 4 dias úteis a 21 exagera o rendimento das semanais, e o degrau de R$ 0,01 pesa muito num prêmio de poucos centavos. As semanais ficam a um clique.
4. **Uma série por ativo (padrão).** Sem isso, um ativo com muitos strikes ocupa o ranking inteiro.
5. **Liquidez mínima.** Só séries que negociaram no último pregão, com pelo menos 10 negócios (3, se a pessoa pedir séries pouco negociadas) e pelo menos 3 dias úteis até o vencimento. O preço é o do último negócio, e não o de compra e venda.

## Exemplo real (pregão de 16/10/2026, vencimento de 19/11, chance de exercício até cerca de 25%)

| Ativo | Rendimento em 21 d.u. | Volatilidade implícita |
| --- | --- | --- |
| MGLU3 | 5,45% | 170% |
| ANIM3 | 3,11% | 149% |
| BBAS3 | 2,52% | 72% |
| PETR4 | 1,88% | 52% |
| VALE3 | 1,12% | 31% |

Mesmo risco de exercício, prêmios muito diferentes: quem paga mais é quem tem mais incerteza. O ranking é um filtro para começar a análise, e não o fim dela.

## Comparação com o método de um educador de opções (vídeo de julho de 2026)

Análise de um vídeo público sobre como achar os maiores prêmios para venda (resumo próprio, a partir da transcrição automática). O método dele, resumido:

- O preço da opção é valor intrínseco + valor extrínseco (tempo e volatilidade); quem vende quer o extrínseco, então evita vender opção longa e dentro do dinheiro, e prefere contratos curtos.
- Cria um ranking de ativos pelo prêmio das opções **na linha do dinheiro (ATM), com o vencimento fixado**, para comparar "banana com banana", descontando o valor intrínseco quando o strike não é exatamente o preço.
- Trata o ranking como filtro, e não como decisão: prêmio muito alto é incerteza muito alta. Cruza com a qualidade da empresa (dívida, lucro) e a tendência semanal; busca "prêmio alto e empresa boa". O vídeo é também propaganda de uma mentoria paga, e a promessa de "prêmios até 50% maiores" não é verificável.

Onde coincide com o nosso: foco no valor extrínseco, vencimento fixo (nosso padrão mensal), ranking como filtro e risco ao lado. Onde difere: ele compara a opção ATM (que na prática ordena os ativos por volatilidade implícita); nós fixamos a chance de exercício e deixamos a pessoa escolher o risco. O que ele faz e nós só fazemos em parte: cruzar com fundamentos e tendência do ativo. Hoje o ranking cruza com a dívida (lista das mais endividadas) e, para quem tem o código, com o Top 15 mais baratas (seção abaixo); lucro e tendência de preço continuam fora.

## Cruzamento com as listas do app (D98)

Prêmio alto é incerteza alta, e a dívida da empresa é parte dessa incerteza. O ranking cruza com duas listas que o app já tem, sem recalcular nada:

- **Mais endividadas (aberta, D94).** Coluna "Dív. líq./EBITDA" com a razão e a posição na lista; as 15 mais endividadas ganham o aviso "Nª mais endividada", e quem tem dívida positiva com EBITDA zero ou negativo aparece como "sem EBITDA positivo". Filtro "Dívida da empresa": sem limite, até 5x ou até 3x; com limite, saem as empresas acima dele e as sem EBITDA positivo. A empresa é achada pelas 4 primeiras letras do código (PETR3 e PETR4 são a mesma). Quem não está na lista (bancos, seguradoras, ETFs, pouca liquidez) **continua no ranking**, com "—": ausência de dado não é sinal de saúde nem de risco. Limites herdados da D94: a dívida é só empréstimos e financiamentos (com debêntures), sem arrendamentos, e não mede prazo, custo nem moeda; o EBITDA de 12 meses pode estar distorcido por evento pontual.
- **Mais baratas (restrita por código, D50).** O Top 15 mais baratas só chega pelo servidor, com o código do mês. O ranking de prêmios **só lê essa lista se a pessoa já liberou o código neste aparelho** (o mesmo guardado pela aba Top 15 do Simule Ações). Com o código, as empresas da lista ganham o selo "Top 15 mais baratas" e aparece o filtro "Só as empresas do Top 15 mais baratas"; sem código, nada é pedido ao servidor, a lista continua restrita e a tela só explica como liberá-la. Código recusado ou servidor indisponível não quebram o ranking.

O cruzamento é um filtro para começar a análise. Prêmio alto em empresa muito endividada é o mercado avisando de um risco que o preço da opção já inclui; prêmio alto em empresa pouco endividada merece mais atenção; estar na lista das baratas não torna a venda de opção mais segura.
