# 16. Metodologia: Top 15 ações pagadoras de dividendos (D122)

Versão da metodologia: **1.1.0** (`config/acoes-dividendos.json`, fonte única dos parâmetros). Ranking aberto (sem código), na aba "Top 15 pagadoras de dividendos" do Simule Ações, com o card **Ver mais** que continua a lista até a 100ª posição. **Publicado em 25/10/2026**, por aprovação expressa do responsável (`publicacao.aprovadoPeloResponsavel` é `true`; v1.1.0, nenhuma regra de cálculo mudou). Sem parecer independente de terceiros (D22).

## 1. O que é, e o que não é

Ordena as ações pelo **dividend yield dos últimos 12 meses**: a soma dos proventos em dinheiro por ação (dividendos, juros sobre capital próprio brutos e rendimentos) com data com nos últimos 365 dias, dividida pelo preço de fechamento mais recente. É um fato histórico, igual para todas as ações, sem nota nem opinião nossa.

**Não é** recomendação nem previsão. Yield alto pode vir de provento extraordinário (a tela avisa quando passa de 20%), de preço em queda ou de lucro que não volta. A medida **não diz** se o pagamento é recorrente, se cabe no caixa ou no lucro, nem se a ação está barata.

## 2. De onde vêm os dados

| Dado | Fonte |
|---|---|
| Proventos em dinheiro por ação | **B3**, duas listas públicas da página de cada empresa, **unidas**: o **histórico** (`GetListedCashDividends`, por nome de pregão: anos de proventos) e o **cadastro da empresa** (`GetListedSupplementCompany`, pelo código de quatro letras: proventos recentes e a pagar, com o ISIN de cada classe). Um provento = classe da ação, tipo, valor por ação, data com e data da aprovação |
| Preço de fechamento e liquidez | Boletim de Preços da B3 (BVBG.086), já guardado em `historico/acoes.json` |
| Desdobramentos e grupamentos | `ajustes` de `webapp-src/public/dados/acoes-historico/<código>.json` (COTAHIST, D120): os mesmos que ajustam os gráficos |

**Por que não a CVM?** A CVM publica o dividendo **pago** (DFC, conta 6.03) como valor total do exercício, não por ação nem por data com. Serve para a análise fundamentalista (payout, proventos ÷ FCF), mas não para um yield por ação com janela de 12 meses. Para a data com e o valor por ação, a fonte é a B3.

## 3. Universo e filtros

- O cadastro do app (`config/acoes.json`): um código por empresa, a classe mais negociada. Bancos, seguradoras e holdings **entram** (pagam muito provento); diferente das listas de dívida.
- **Liquidez** média de pelo menos R$ 3 milhões por dia nos últimos 21 pregões (a mesma régua das outras listas), no código do cadastro. Sem isso, micro-empresas com pagamento único apareceriam no topo.
- **Preço recente:** negociou nos últimos 10 dias. Papel parado não tem preço de referência.
- Tem de ter pago ao menos um provento em dinheiro na janela.

## 4. O cálculo

1. **Classe da ação pelo código:** final 3 = ON, 4 = PN, 5 = PNA, 6 = PNB, 11 = UNT (units). Só entram as linhas da B3 dessa classe.
2. **Janela:** data com maior que (último pregão − 365 dias) e menor ou igual ao último pregão.
3. **Tipos que entram:** `DIVIDENDO`, `JRS CAP PROPRIO` (JCP, valor **bruto**, antes do imposto) e `RENDIMENTO`. **Não entra** `REST CAP DIN` (restituição de capital: devolve patrimônio, não distribui lucro).
4. **Valor por ação:** `valueCash ÷ quotedPerShares` (algumas linhas vêm por lote de 1.000).
5. **Parcelas:** quando a B3 publica duas ou mais linhas iguais (mesma data com e mesmo valor), são parcelas do mesmo provento, com datas de pagamento diferentes. **Cada linha entra na soma.** Descartar as repetidas subestimava Cemig, Petrobras, WEGE, Moura Dubeux e outras (ver seção 6).
6. **Desdobramento depois do provento:** o valor da B3 é o da época. Se houve desdobramento (ou grupamento) com data posterior à data com, divide-se pelo fator (5 = cada ação virou 5). Sem isso, a Sabesp (desdobramento 5:1 em 29/04/2026) saía com 10,9% em vez de 2,2%.
7. **Yield** = soma por ação ÷ preço de fechamento. **Ordenação:** decrescente; empate pelo código. A lista mostra 15; o arquivo guarda até 100 (`rankingAteOnde`), que o card "Ver mais" mostra.

**Casos de borda** (cada um com código e motivo na lista de exclusões): `sem_preco`, `liquidez_baixa`, `sem_dados_b3` (a B3 não tem cadastro ou proventos para o nome de pregão), `sem_proventos` (inclui quem só teve devolução de capital), `classe_desconhecida`.

**Por que duas listas.** Nenhuma basta: (a) o **histórico** filtra pelo nome de pregão da época do provento, e para algumas empresas o nome atual não devolve nada (Ambev, Klabin, B3, Cury e outras 30 na primeira rodada); (b) ele demora a listar o que já foi aprovado e ainda não foi pago (ISAE4, SANB11, PINE4 e ALOS3 perdiam o último provento, e era isso que ainda separava o resultado do Investidor10). O **cadastro da empresa** não tem esses dois defeitos, mas só guarda os proventos recentes ou a pagar. A união vale, para cada (classe, tipo, data com), a lista que tiver **mais linhas** (empate: o histórico): assim uma parcela repetida não é contada duas vezes, nem o mesmo pagamento com arredondamento diferente nas duas listas (0,0402 × 0,040223), e nada que uma lista tem e a outra não tem se perde. Quando o histórico não devolve nada com o nome de pregão, a ação sai com o alerta `historico_parcial` (só vale o cadastro, que pode não alcançar o começo da janela) e a tela avisa.

## 5. Trilha de auditoria

Desenho da D89: o ranking é recalculado **todo dia útil** (workflow "Atualizar Top 15 Ações Pagadoras de Dividendos", 00h15 de Brasília, depois das endividadas); a **pasta completa** `auditoria/acoes-dividendos/<data>/` só é gravada na primeira execução do mês, ou quando mudam os parâmetros, o código de cálculo (este ou o leitor da B3) ou com "auditoria completa" na execução manual.

- **Pasta completa:** `manifesto.json` (hashes, código, fontes), `config.json`, `insumos.json.gz` (os proventos **como a B3 publicou**, mais preço, liquidez e ajustes de cada empresa), `resultado.json`, `memoria-de-calculo.json.gz` (proventos usados e não usados, por ação), `ranking.csv`, `proventos.csv` (um provento por linha), `exclusoes.csv`, `LEIA-ME.md`.
- **Dias comuns:** baixa a B3, recalcula e **confere de forma independente em memória** (relê insumos e config, refaz o cálculo do zero, compara os hashes; se divergir, nada é publicado).
- **Verificação sem internet:** `node scripts/acoes-dividendos-verificar.mjs <pasta | ultima>`. Confere o sha256 de cada arquivo, o hash canônico dos insumos e da config, e **recalcula** o resultado. **Não prova** que os insumos reproduzem a B3: para isso, compare um código com a página de proventos da empresa em b3.com.br.
- **Trava de sanidade** (só na publicação): menos de 40 ações com proventos, mais de 30% do escopo sem dados da B3 ou yield acima de 100% derruba o job; a auditoria fica gravada, o app não muda e o GitHub envia e-mail. Uma falha de download numa empresa isolada não derruba o job (ela sai com `sem_dados_b3` e o motivo).

## 6. Conferência com o Investidor10 (25/10/2026)

Comparado o DY de 12 meses calculado aqui com o do ranking "Maiores Dividend Yield" do Investidor10 (investidor10.com.br/acoes/rankings/maiores-dividend-yield/), para as ações que aparecem nos dois lados (97 das 100 do nosso ranking; BBDC4, GGBR4 e IGTI11 não estavam no ranking deles).

| Medida | Resultado |
|---|---|
| Diferença média absoluta | **0,14 ponto percentual** |
| Dentro de 0,25 p.p. | 84 de 97 |
| Dentro de 0,5 p.p. | 92 de 97 |
| Dentro de 1 p.p. | **97 de 97** |
| Maiores diferenças | MTRE3 (+0,8), EVEN3, LOGG3, GRND3 (+0,7), RECV3 (+0,6): nossa conta é maior em todas |

**O que sobra é o preço.** O Investidor10 divide pela cotação do dia da consulta; nós, pelo fechamento do último pregão da base (22/10). Em GRND3 o preço deles era R$ 4,67 contra R$ 4,57 nosso, e 32,56% × 4,57 ÷ 4,67 = 31,87%, exatamente o número deles. A mesma conta fecha as outras da lista.

**Quatro correções saíram desta conferência** (estão nas seções 2 e 4; cada uma tem teste):
1. **Parcelas repetidas.** Antes, linhas iguais da B3 eram descartadas como duplicidade. Eram parcelas reais: a Cemig dava 5,5% contra 9,8% do Investidor10, e os R$ 1,39 por ação que a CVM registra como dividendo pago pela Cemig em 2025 só fecham com a soma completa.
2. **Desdobramento da Sabesp** (5:1 em 29/04/2026): sem ajustar os proventos anteriores, saía 10,9% em vez de 2,2%.
3. **Cadastro da empresa como segunda lista.** O histórico da B3 demora a listar o provento já aprovado e ainda não pago (ISAE4, SANB11, PINE4 e ALOS3 perdiam o último pagamento) e não devolve nada para 30 empresas pelo nome de pregão (Ambev, Klabin, Cury e outras).
4. **Séries do Banco do Brasil** (ISIN A04OR e A05OR): repetem o provento da ação ordinária e triplicavam o BBAS3 (8,7% em vez de 2,8%). Ficam fora da conta.

O ranking deles começa em empresas pequenas e ilíquidas (SCAR3, HBRE3, CATA3 com 119%), que ficam fora daqui pela liquidez mínima. A comparação é uma foto do dia: o Investidor10 não tem contrato de dados, e a fonte que vale é a B3.

## 6.1 Uso fora do ranking (D124)

O resultado também guarda `dyPorTicker`: o mesmo yield para **toda** ação com preço e proventos da B3, sem o filtro de liquidez. A análise fundamentalista de uma ação mostra esse número em "Dividend yield (12 meses)", para bater com o ranking e com o Investidor10; sem ele, usa os dividendos pagos da DFC.

## 7. Limitações conhecidas

- **Data com, não data de pagamento.** O que entra é o que tinha direito no período, mesmo que pague depois. O Investidor10 e outras fontes podem usar outra convenção.
- **Proventos extraordinários** entram como qualquer outro: o yield de 12 meses de uma empresa que fez um pagamento único grande não se repete. A tela avisa quando o yield passa de 20% e mostra a data de cada provento.
- **Bonificações em ações** não são proventos em dinheiro e ficam fora. **Desdobramentos sem fator inteiro** (bonificação de 10%, por exemplo) não são detectados pelo COTAHIST e não ajustam o valor antigo.
- **Units:** conta só as linhas `UNT` da B3. Empresas cuja unit não tem linha própria ficam sem proventos.
- **Um código por empresa** (a classe mais negociada do cadastro): o yield da outra classe pode ser um pouco diferente.
- **Empresas sem proventos na B3** (27 do cadastro na primeira rodada, entre elas PRIO3, CSAN3, CSNA3, BRKM5, BHIA3, AMER3 e DASA3) saem com `sem_dados_b3`, e a lista de exclusões da tela mostra o motivo de cada uma. Se uma delas pagou provento e a B3 não o publicou, o ranking não tem como saber.- **Histórico parcial:** quando a B3 não devolve o histórico de uma empresa pelo nome de pregão (Ambev, Klabin e Cury na primeira rodada), só vale a lista do cadastro dela, que cobre os últimos meses e pode não alcançar o começo dos 12 meses. A tela avisa (`historico_parcial`).
- Depende da API pública da B3, que não tem contrato de estabilidade; se o formato mudar, o leitor erra de propósito (`lerProventos`) e o job falha sem publicar.
