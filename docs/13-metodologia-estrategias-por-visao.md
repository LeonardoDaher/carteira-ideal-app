# Metodologia: estratégias por visão de mercado (Simule Opções)

Aba "Tendência" (antes "Por visão") do Simule Opções (D99). Descritiva e educacional: para um ativo, lê a tendência do passado, pergunta a visão da pessoa e monta, com as séries reais do último pregão, as estruturas de opções que combinam com essa visão. Não indica operação. O cálculo roda no navegador (`webapp-src/src/domain/estrategiasPorVisao.ts` e `tendencia.ts`); não usa modelo de linguagem.

## 1. Leitura da tendência (passado, não previsão)

O job diário (`scripts/atualizar-opcoes.mjs`) calcula, para cada ativo com 64 ou mais fechamentos no histórico que os outros jobs guardam (`historico/acoes.json` e `historico/etfs.json`, 260 pregões): média de 21 e de 63 pregões, retorno em 21 e 63 pregões, posição na faixa de 52 semanas e volatilidade realizada de 21 e 63 pregões. Em 16/10/2026, 148 dos 161 ativos tinham.

A leitura (no app):

| Leitura | Regra |
| --- | --- |
| Alta | preço > média de 21 > média de 63, e retorno de 63 pregões ≥ +3% |
| Baixa | preço < média de 21 < média de 63, e retorno de 63 pregões ≤ −3% |
| Lateral | qualquer outra combinação |

A pessoa pode escolher outra visão (alta, baixa, lateral ou muita oscilação). A tela mostra os números que levaram à leitura.

## 2. Estruturas por visão

| Visão | Estruturas |
| --- | --- |
| Alta | compra de call; trava de alta com calls (débito); trava de alta com puts (crédito); venda de put |
| Baixa | compra de put; trava de baixa com puts (débito); trava de baixa com calls (crédito) |
| Lateral | condor de ferro; borboleta com calls; venda coberta (quem já tem a ação) |
| Muita oscilação | straddle comprado; strangle comprado |

Só entram estruturas de **risco limitado**: não há strangle vendido, call descoberta nem outra estrutura de perda ilimitada.

Cada estrutura tem uma janela de strikes em torno do preço (por exemplo, trava de alta com calls: call comprada de 95% a 105% do preço, vendida até 120% e a no máximo 15% do preço de largura). Só séries do vencimento escolhido que **negociaram no último pregão**, com **5 negócios ou mais** cada, e vencimento com **3 dias úteis ou mais**.

Cortes de coerência: trava com débito maior que a largura (ou crédito maior que a largura) sai; trava ou borboleta de **débito** precisa render ao menos **25% do risco** (pagar quase a largura inteira para ganhar centavos é sinal de preço velho em uma das pernas); estrutura com ganho máximo abaixo de **0,5% do risco** sai.

## 3. O que se mede em cada candidata (por 100 opções)

- **Ao montar:** crédito (recebe) ou débito (paga), pelo último preço de cada série.
- **Ganho máximo, perda máxima e equilíbrios:** exatos no vencimento (a conta é linear por trechos, com quebras nos strikes).
- **Chance de lucro:** integral da densidade lognormal do preço no vencimento (neutra ao risco, com a volatilidade implícita média das séries usadas) sobre os preços em que o resultado é positivo.
- **Retorno no cenário:** resultado se o ativo andar **um desvio-padrão do prazo** (volatilidade implícita × raiz do prazo, algo como 10% a 12% em um mês) a favor da visão, dividido pela perda máxima. Na visão lateral, o cenário é o ativo parado no preço de hoje; em "muita oscilação", o lado mais favorável.
- **Negócios mínimos:** o menor número de negócios entre as séries da estrutura (liquidez).

## 4. Ordenação, e por que o app não elege uma "melhor"

No modelo de preços, nenhuma estrutura tem vantagem esperada: a esperança do resultado, no mundo neutro ao risco, é o custo de montar. O que muda de uma para outra é o **perfil**: quanto se arrisca, quanto se pode ganhar e com que chance. Estruturas de crédito ganham com frequência e têm teto; as de débito ganham muito quando o movimento vem, mas com chance menor.

Por isso o app ordena pelo critério que a pessoa escolhe, e mostra os três números lado a lado: **maior chance de lucro** (padrão), **maior retorno no cenário** ou **menor risco** (menor perda máxima). Mostra até 3 candidatas por estrutura.

A única informação que dá alguma inclinação é a comparação da **volatilidade realizada** (21 pregões) com a **implícita** das opções perto do preço: implícita bem acima da realizada indica opções caras em relação ao que o ativo vem oscilando (favorece mais quem vende prêmio), e bem abaixo indica opções baratas (favorece mais quem compra). A tela mostra os dois números e a frase, sem recomendar.

## 5. Ligação com o simulador

"Simular" leva a candidata à aba Estratégias com cada série no lado certo e na quantidade certa (a borboleta vende 2x a série do meio; a venda coberta abre a estratégia "Venda coberta"). Lá a pessoa vê o gráfico, a passagem do tempo e as gregas.

## 6. Limites

- Preço de cada perna é o do **último negócio**, e não o de compra e venda: pernas com negócios em horas diferentes podem formar um preço que não se consegue de fato; o resultado real pode ser pior.
- Tendência é leitura do passado; não prevê. Lucro da empresa, dívida e notícias não entram aqui (a aba Top 15 prêmios cruza com a dívida).
- Modelo de Black-Scholes europeu, sem dividendos, dias úteis/252, juro na Selic meta.
- Corretagem, emolumentos, IR, margem de garantia e dividendos ficam de fora.
- Opções americanas podem ser exercidas antes do vencimento; a conta do vencimento é exata, a de antes dele é aproximada.

## 7. Sobre "IA"

O motor é determinístico: o mesmo ativo e os mesmos dados dão sempre a mesma lista. **Não usa um modelo de linguagem.** Um assistente em linguagem natural ("quero renda com BBAS3, acho que lateraliza") é possível como camada por cima: o modelo traduziria o pedido em visão, vencimento e critério, e explicaria o resultado, com o motor como única fonte dos números. Isso pede servidor (a chave não pode ir ao navegador), limite de uso, custo e uma regra firme: o texto do modelo nunca inventa preço, strike nem probabilidade, e nunca recomenda operação. Não está feito.

## Estruturas acrescentadas (D108)

Além das estruturas da D99, a aba passou a montar, no mesmo motor (mesmo vencimento, risco limitado, séries que negociaram no último pregão): **slide com put** e **booster** (alta), **collar** (baixa), **borboleta com puts**, **borboleta de ferro**, **condor com calls** e **put vendida otimizada** (lateral) e **strangle comprado financiado** (muita oscilação). As definições das pernas estão em `docs/14-metodologia-estrategias-montadas.md`. O piso de "débito precisa render 25% do risco" só vale quando o débito é a maior parte do risco; nas estruturas de custo quase zero (slide e booster) ele não se aplica. "Simular" no collar e no booster abre o modelo próprio na aba Estratégias. THL e diagonais ficam fora desta aba, porque têm vencimentos diferentes e resultado estimado.
