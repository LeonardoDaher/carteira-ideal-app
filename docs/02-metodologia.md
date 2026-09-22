# Estrutura de uma Carteira Verdadeiramente Personalizada

*Versão revisada — alinhada à implementação do app "Carteira Ideal" (11 classes, 9 Perfis-Mãe de Carteira)*

> **Atualização de arquitetura (setembro/2026).** Desde a versão com API protegida, o motor descrito neste documento (`engine.ts`) **não roda mais no navegador do usuário**. Ele fica em `webapp-src/src/domain/engine.ts` e é executado apenas pela função serverless `api/recomendacao.ts`, hospedada na Vercel. O app envia as 14 respostas e recebe de volta só o resultado pronto. Toda a lógica abaixo continua valendo exatamente como descrita; mudou apenas **onde** ela é executada. Detalhes em `docs/03-arquitetura-tecnica.md`.
>
> **Faixas do suitability interno do app** (não detalhadas no texto original): cada uma das 7 perguntas vale de 1 (A) a 4 (D), somando 7 a 28 pontos. Até 14 pontos = Conservador; 15 a 21 = Moderado; 22 a 28 = Arrojado.

Para estruturar uma carteira verdadeiramente personalizada — indo além das perguntas padronizadas de suitability (perfil de risco) aplicadas pelas corretoras —, é preciso investigar a realidade prática, psicológica e comportamental do investidor.

Enquanto a análise de perfil tradicional foca apenas na tolerância teórica à volatilidade, um planejamento patrimonial robusto exige mapear a arquitetura de vida da pessoa.

Este questionário de 7 perguntas é aplicado em complemento ao suitability já respondido na corretora — que pode ter de 8 a 15 perguntas, variando conforme a instituição (XP, BTG, Rico, Itaú etc.). Juntos, os dois blocos formam a base do diagnóstico completo.

*Nota de implementação: o app "Carteira Ideal" não depende de suitability externo — ele já embute o seu próprio questionário de 7 perguntas de suitability (webapp-src/src/data/questions.ts) somado às 7 perguntas de Arquitetura Patrimonial abaixo (webapp-src/src/data/perguntasArquitetura.ts), totalizando 14 perguntas respondidas dentro da própria ferramenta. A lógica descrita neste documento também funciona como complemento a um suitability já respondido em outra corretora, para quem quiser aplicá-la fora do app.*

# As 7 Perguntas-Chave da Arquitetura Patrimonial

| **Pilar de Análise** | **A Pergunta-Chave** | **Por que essa pergunta muda a alocação?** |
| --- | --- | --- |
| 1. Capacidade Financeira de Risco | Se você perdesse sua fonte principal de renda hoje, por quanto tempo sua reserva atual pagaria suas contas sem precisar vender investimentos de longo prazo? | Separa a tolerância emocional da capacidade real de tomar risco. Restrição dura: uma resposta [A] força o Perfil Patrimonial para Defensivo. |
| 2. Arquitetura do Passivo & Dívidas | Qual é a situação das suas obrigações financeiras e custos fixos atuais? | De nada adianta buscar rentabilidade se o investidor paga juros mais altos em dívida cara. Restrição dura: uma resposta [A] força o Perfil Patrimonial para Defensivo. |
| 3. Janela de Liquidez & Desembolsos | Você tem algum grande evento de gasto planejado para os próximos 2 a 5 anos (imóvel, casamento, reforma, viagem, transição de carreira)? | Evita ter que vender Ações ou FIIs no fundo de um ciclo de queda. Restrição dura: uma resposta [A] força o Perfil Patrimonial para Defensivo. |
| 4. Comportamento sob Estresse | Como você reagiu (ou reagiria) se visse sua carteira caindo 20% a 30% em um momento de crise de mercado? | Calibrador suave: entra no Score de Capacidade Real (7 a 21 pontos), sem poder de veto. |
| 5. Dependência de Renda Passiva | Qual é o objetivo principal dos rendimentos gerados por essa carteira hoje? | Calibrador suave: entra no Score de Capacidade Real, sem poder de veto. |
| 6. Capital Humano & Concentração de Risco | Qual é o perfil da sua atividade profissional e patrimônio fora do mercado financeiro? | Calibrador suave: entra no Score de Capacidade Real, sem poder de veto. |
| 7. Eficiência Fiscal e Sucessão | Como é estruturada a sua declaração de Imposto de Renda e visão de futuro do patrimônio? | Calibrador suave: entra no Score de Capacidade Real, sem poder de veto. |

*Os textos das perguntas e opções acima reproduzem literalmente webapp-src/src/data/perguntasArquitetura.ts do app. Os Pilares 1 a 3 são as "restrições duras" (restricaoDura: true no código); os Pilares 4 a 7 são "calibradores suaves" — contribuem para o Score de Capacidade Real (Seção 3.1) e, além disso, ajustam a composição fina da carteira dentro do teto de risco já definido (função aplicarCalibradoresSuaves, ver Seção 3.5).*

## Resumo da Lógica em Um Parágrafo

As perguntas tradicionais de suitability medem apenas a intenção teórica do investidor, enquanto as 7 perguntas da arquitetura patrimonial cruzam a estabilidade do trabalho, o orçamento doméstico, o passivo de curto prazo e as dores comportamentais passadas para desenhar uma alocação que sobreviva tanto às crises de mercado quanto às necessidades reais do dia a dia.

# 2. Como os Dois Modelos Se Encaixam na Prática

A junção dos dois modelos cria um filtro de duas etapas onde a vida real sempre dá a palavra final sobre o teste genérico:

**Perfil Suitability (Intenção) + Arquitetura Patrimonial (Realidade) = Alocação Ideal Realizável**

- O Suitability define o Teto Máximo: estabelece o limite regulatório e psicológico máximo de volatilidade que a pessoa tolera.

- A Arquitetura Patrimonial ajusta o Piso e a Distribuição: olha para os compromissos de vida e reduz essa porcentagem de acordo com a necessidade de liquidez, passivos e estabilidade de renda.

# 3. Mecanismo Formal de Pontuação e Decisão

## 3.1 Pontuação por Pilar (Score de Capacidade Real)

Cada resposta das 7 perguntas recebe um valor numérico: [A] = 1 ponto, [B] = 2 pontos, [C] = 3 pontos (calcularScoreArquitetura em engine.ts). Somando as 7 respostas — duras e suaves —, o Score de Capacidade Real varia de 7 a 21 pontos:

| **Faixa de Score** | **Capacidade Real** | **Leitura Prática** |
| --- | --- | --- |
| 7 a 11 pontos | Baixa | Vida financeira pouco amortecida — foco em caixa e liquidez |
| 12 a 16 pontos | Média | Estabilidade razoável, mas com pontos de atenção em algum pilar |
| 17 a 21 pontos | Alta | Vida financeira sólida — liberdade real para buscar rentabilidade |

## 3.2 Regra de Veto

Na versão implementada (função vetoAplicado em engine.ts), a regra de veto é binária, não escalonada por número de ocorrências:

- Qualquer resposta [A] em pelo menos um dos 3 Pilares Duros (Capacidade Financeira, Passivo ou Janela de Liquidez) força o Perfil Patrimonial para Defensivo, independentemente do Score consolidado ou do resultado do suitability.

- Nenhuma resposta [A] nesses 3 pilares → o Perfil Patrimonial segue normalmente para a Matriz Cruzada (Seção 3.3).

*O motor não distingue hoje se um, dois ou três Pilares Duros vieram como [A] — o efeito é o mesmo (Defensivo) em qualquer desses casos. Não há uma versão "parcial" do veto nem uma exceção que eleve o perfil de volta quando os 3 pilares vierem como [C].*

## 3.3 Matriz Cruzada de Decisão (Suitability x Capacidade Real)

Sem veto acionado, o Perfil Patrimonial é lido diretamente na matriz 3x3 abaixo (MATRIZ_PATRIMONIAL em engine.ts):

| **Capacidade Real ↓ / Suitability →** | **Conservador** | **Moderado** | **Arrojado** |
| --- | --- | --- | --- |
| Baixa (7–11) | Defensivo | Defensivo | Defensivo |
| Média (12–16) | Defensivo | Equilibrado | Equilibrado |
| Alta (17–21) | Defensivo | Equilibrado | Crescimento Pleno |

*Sem exceções: mesmo com Capacidade Real Alta, um suitability Conservador resolve sempre para Defensivo, e não existe, na versão implementada, uma regra que eleve esse resultado.*

## 3.4 Os 9 Perfis-Mãe de Carteira

O nome exibido ao cliente não é o Perfil Patrimonial isolado (Defensivo/Equilibrado/Crescimento Pleno) nem o Perfil de Suitability isolado (Conservador/Moderado/Arrojado) — é o cruzamento dos dois, em uma matriz de 9 combinações (MATRIZ_PERFIL_FINAL em engine.ts):

| **Suitability ↓ / Perfil Patrimonial →** | **Defensivo** | **Equilibrado** | **Crescimento Pleno** |
| --- | --- | --- | --- |
| Conservador | 1. Conservador Puro | 2. Conservador Renda | 3. Conservador Acúmulo |
| Moderado | 4. Moderado Defensivo | 5. Moderado Renda (Equilíbrio) | 6. Moderado Expansão |
| Arrojado | 7. Arrojado Travado (Falso Arrojado) | 8. Arrojado Gerador de Renda | 9. Arrojado Pleno / Global |

*"7. Arrojado Travado (Falso Arrojado)" é o nome dado a quem se declarou Arrojado no suitability mas teve o Perfil Patrimonial rebaixado para Defensivo — seja por veto, seja por baixa Capacidade Real.*

## 3.5 Calibradores Suaves (Pilares 4 a 7) — Ajuste Fino de Composição

Os Pilares 4 a 7 somam pontos ao Score de Capacidade Real (Seção 3.1) exatamente como os 3 Pilares Duros. Além disso, a função aplicarCalibradoresSuaves (engine.ts) usa essas mesmas 4 respostas para mover pontos percentuais entre classes de ativos que competem pela mesma função na carteira — sempre dentro do teto de risco já definido pelo Perfil Patrimonial (Seções 3.2 e 3.3), e sempre antes das travas de segurança rígidas (Seção 6), que têm a palavra final.

| **Pilar** | **Resposta** | **Ajuste Implementado (aplicarCalibradoresSuaves)** |
| --- | --- | --- |
| 4. Comportamento sob Estresse | [A] | Reduz Ações, BDRs, Fundos Internacionais/ETFs e Criptomoedas em 30% cada, redirecionando tudo para Ouro. |
|  | [B] | Nenhum ajuste — mantém a carteira-modelo (Seção 5.2). |
|  | [C] | Move até 3 pp de Tesouro Selic para Ações e até 2 pp de Tesouro Selic para BDRs. |
| 5. Dependência de Renda Passiva | [A] | Move 40% de Ações para FIIs (prioriza fluxo de caixa mensal). |
|  | [B] | Nenhum ajuste. |
|  | [C] | Move 30% de FIIs para Ações (prioriza acúmulo, não renda). |
| 6. Capital Humano | [A] | Move 50% do Tesouro Prefixado para Tesouro IPCA+ (mais previsibilidade real com renda oscilante). |
|  | [B] | Nenhum ajuste. |
|  | [C] | Move até 2 pp de Tesouro Selic para Ações e até 1 pp de Tesouro Selic para BDRs (menos colchão necessário). |
| 7. Eficiência Fiscal e Sucessão | [A] | Não move percentual — gera um alerta sugerindo aportar via PGBL para a dedução de até 12% do IR. |
|  | [B] | Nenhum ajuste, nenhum alerta. |
|  | [C] | Não move percentual — gera um alerta sugerindo VGBL/Previdência regressiva para foco sucessório. |

*Pilar 7 nunca move percentual entre classes: PGBL, VGBL e Holding são veículos/invólucros fiscais, não classes de ativo — por isso o ajuste correto é um alerta para o consultor escolher o invólucro certo, não uma realocação. Todas as movimentações são feitas ponto a ponto (moverPontos), nunca deixam uma classe negativa e preservam a soma total da carteira, que segue normalizada a 100% ao final de gerarRecomendacao.*

## Resumo da Lógica em Um Parágrafo

O mecanismo implementado resolve o cruzamento em quatro passos: (1) somar as 7 respostas de [A] a [C] para obter o Score de Capacidade Real (7 a 21); (2) checar se algum dos 3 Pilares Duros veio como [A] — se sim, o Perfil Patrimonial vai direto para Defensivo; se não, o Score cruza com o suitability na matriz 3x3 (Seção 3.3); (3) cruzar esse Perfil Patrimonial com o Perfil de Suitability original na matriz de 9 células para chegar ao Perfil-Mãe de Carteira (Seção 3.4); e (4) aplicar os Calibradores Suaves dos Pilares 4 a 7 para ajustar, dentro desse teto, a composição fina entre classes que competem pela mesma função (Seção 3.5).

# 4. Menu de Respostas Objetivas

Texto literal das 7 perguntas conforme implementado em webapp-src/src/data/perguntasArquitetura.ts:

## 1. Capacidade Financeira de Risco (restrição dura)

*Se você perdesse sua fonte principal de renda hoje, por quanto tempo sua reserva atual pagaria suas contas sem precisar vender investimentos de longo prazo?*

- [A] Menos de 3 meses (Capacidade Baixa — Exige foco total em liquidez e Selic)

- [B] De 3 a 12 meses (Capacidade Média — Permite alocação moderada)

- [C] Mais de 12 meses (Capacidade Alta — Liberdade para buscar rentabilidade)

## 2. Arquitetura do Passivo & Dívidas (restrição dura)

*Qual é a situação das suas obrigações financeiras e custos fixos atuais?*

- [A] Possuo dívidas caras (cartão, cheque especial, empréstimo pessoal) ou passivos em dólar.

- [B] Possuo dívidas estruturadas/longas (financiamento imobiliário/auto com taxa baixa) e custos fixos controlados.

- [C] Zero dívidas e custo fixo baixo em relação ao que ganho.

## 3. Janela de Liquidez & Desembolsos (restrição dura)

*Você tem algum grande evento de gasto planejado para os próximos 2 a 5 anos (imóvel, casamento, reforma, viagem, transição de carreira)?*

- [A] Sim, vou precisar sacar uma fatia relevante do capital em até 24 meses.

- [B] Sim, mas o desembolso será médio e ocorrerá entre 3 e 5 anos.

- [C] Não, todo o dinheiro aportado é para longo prazo (5 a 10+ anos).

## 4. Comportamento sob Estresse (calibrador suave)

*Como você reagiu (ou reagiria) se visse sua carteira caindo 20% a 30% em um momento de crise de mercado?*

- [A] Resgataria tudo para parar de perder dinheiro (Trauma de perda/Conservador na prática).

- [B] Ficaria desconfortável e pararia de olhar a conta, mas não venderia nada.

- [C] Veria como oportunidade e usaria o caixa para comprar mais ativos baratos.

## 5. Dependência de Renda Passiva (calibrador suave)

*Qual é o objetivo principal dos rendimentos gerados por essa carteira hoje?*

- [A] Preciso do dinheiro caindo na conta mensal/semestralmente para pagar custo de vida.

- [B] Não preciso agora, mas quero construir uma transição para viver de renda em 3 a 5 anos.

- [C] Acúmulo 100% focado no longo prazo (reinvisto todos os rendimentos, dividendos e juros).

## 6. Capital Humano & Concentração de Risco (calibrador suave)

*Qual é o perfil da sua atividade profissional e patrimônio fora do mercado financeiro?*

- [A] Renda variável/oscilante (empresário, autônomo, comissionado).

- [B] Renda estável (CLT consolidado em grande empresa, profissional liberal tradicional).

- [C] Renda ultra estável (concursado público, aposentado, rentista).

## 7. Eficiência Fiscal & Planejamento Sucessório (calibrador suave)

*Como é estruturada a sua declaração de Imposto de Renda e visão de futuro do patrimônio?*

- [A] Declaração Completa do IR (PF) e busco formas de deduzir imposto (ex: PGBL).

- [B] Declaração Simplificada (PF) ou operações via PJ/Empresa.

- [C] Foco principal em facilitar a transferência para herdeiros no futuro (sucessão/doação).

# 5. Integração com as 11 Classes de Ativos

O app trabalha com 11 classes de ativos (webapp-src/src/data/assets.ts).

*Correção em relação a versões anteriores deste documento: chegou a se falar em 15 classes, incluindo Fundos DI, Fundos Multimercado, Fundos de Ações Líquidos e CRI/CRA. Essas 4 classes saíram da régua de ativos do app. Onde apareciam nas alocações originais, a fatia foi redistribuída assim (comentário em MATRIZ_PATRIMONIAL_CARTEIRA, engine.ts): Fundos DI → 100% Tesouro Selic; Fundos de Ações Líquidos → 100% Ações; CRI/CRA → 100% LCI/LCA; Fundos Multimercado → 20% Ouro, 20% BDRs, 20% Fundos Internacionais/ETFs e 40% FIIs.*

## 5.1 O Papel Estrutural de Cada uma das 11 Classes

| **#** | **Grupo** | **Classe de Ativo** | **Função na Carteira** | **Risco Dominante** |
| --- | --- | --- | --- | --- |
| 1 | Reserva & Liquidez | Tesouro Selic | Título público pós-fixado com liquidez diária. Reserva de emergência e caixa operacional. | Defensivo |
| 2 |  | CDB Liquidez Diária | Empréstimo a um banco, geralmente coberto pelo FGC até R$ 250 mil. Complemento de reserva. | Defensivo |
| 3 | Renda Fixa Estruturada | Tesouro IPCA+ | Título público que paga IPCA + taxa fixa. Blindagem do poder de compra no longo prazo. | Conservador / Moderado |
| 4 |  | Tesouro Prefixado | Título público com taxa de retorno fixa e conhecida na compra. Trava de taxa para metas com data certa. | Moderado |
| 5 |  | LCI / LCA | Letras de Crédito Imobiliário/Agronegócio. Isentas de IR para PF e cobertas pelo FGC — o "CDB isento", com carência mínima. | Defensivo |
| 6 | Hedge & Descorrelação | Ouro | Proteção contra estresse sistêmico e desvalorização da moeda — historicamente descorrelacionado de ações e renda fixa BR. | Defensivo / Hedge |
| 7 | Renda & Crescimento BR | FIIs | Fundos que investem em imóveis/recebíveis imobiliários e distribuem renda mensal isenta de IR para PF. | Moderado / Arrojado |
| 8 |  | Ações | Participação direta no capital de empresas listadas na B3. Maior potencial de retorno e de oscilação. | Arrojado |
| 9 | Exposição Global & Cripto | BDRs | Recibos de ações de empresas estrangeiras negociados na B3. Exposição internacional com risco cambial. | Arrojado |
| 10 |  | Fundos Internacionais / ETFs | ETFs que replicam índices de bolsas fora do Brasil, diversificando geograficamente e dolarizando parte da carteira. | Arrojado |
| 11 |  | Criptomoedas | Exposição a criptoativos via fundos, ETFs, BDRs ou compra direta. Altíssima volatilidade — fatia pequena, só para perfis Arrojados. | Ultra-Arrojado |

## 5.2 Carteiras-Modelo: Perfil Patrimonial x Prazo

A alocação final depende de dois eixos: o Perfil Patrimonial (Defensivo / Equilibrado / Crescimento Pleno, resultado da Seção 3) e o Prazo (curto / médio / longo, que já vem das respostas do suitability). Isso gera 9 carteiras-modelo — 3 tabelas abaixo, cada uma com 3 colunas de prazo (MATRIZ_PATRIMONIAL_CARTEIRA em engine.ts):

## Perfil Patrimonial: Defensivo

| **Grupo** | **Classe** | **Curto Prazo** | **Médio Prazo** | **Longo Prazo** |
| --- | --- | --- | --- | --- |
| Reserva & Liquidez | 1. Tesouro Selic | 55% | 35% | 20% |
|  | 2. CDB Liquidez Diária | 25% | 5% | 5% |
| Renda Fixa Estruturada | 3. Tesouro IPCA+ | 5% | 20% | 25% |
|  | 4. Tesouro Prefixado | 5% | 10% | 10% |
|  | 5. LCI / LCA | — | 10% | 10% |
| Hedge & Descorrelação | 6. Ouro | 6% | 6% | 6% |
| Renda & Crescimento BR | 7. FIIs | 2% | 7% | 12% |
|  | 8. Ações | — | 5% | 10% |
| Exposição Global & Cripto | 9. BDRs | 1% | 1% | 1% |
|  | 10. Fundos Internacionais / ETFs | 1% | 1% | 1% |
|  | 11. Criptomoedas | — | — | — |
| TOTAL | 11 Classes | 100% | 100% | 100% |

## Perfil Patrimonial: Equilibrado

| **Grupo** | **Classe** | **Curto Prazo** | **Médio Prazo** | **Longo Prazo** |
| --- | --- | --- | --- | --- |
| Reserva & Liquidez | 1. Tesouro Selic | 35% | 15% | 10% |
|  | 2. CDB Liquidez Diária | 15% | — | — |
| Renda Fixa Estruturada | 3. Tesouro IPCA+ | 10% | 25% | 20% |
|  | 4. Tesouro Prefixado | 5% | 10% | 5% |
|  | 5. LCI / LCA | — | 13% | 13% |
| Hedge & Descorrelação | 6. Ouro | 7% | 6% | 6% |
| Renda & Crescimento BR | 7. FIIs | 12% | 11% | 14% |
|  | 8. Ações | 12% | 12% | 17% |
| Exposição Global & Cripto | 9. BDRs | 2% | 4% | 6% |
|  | 10. Fundos Internacionais / ETFs | 2% | 4% | 6% |
|  | 11. Criptomoedas | — | — | 3% |
| TOTAL | 11 Classes | 100% | 100% | 100% |

## Perfil Patrimonial: Crescimento Pleno

| **Grupo** | **Classe** | **Curto Prazo** | **Médio Prazo** | **Longo Prazo** |
| --- | --- | --- | --- | --- |
| Reserva & Liquidez | 1. Tesouro Selic | 30% | 10% | 5% |
|  | 2. CDB Liquidez Diária | 15% | — | — |
| Renda Fixa Estruturada | 3. Tesouro IPCA+ | 5% | 20% | 15% |
|  | 4. Tesouro Prefixado | — | 5% | 5% |
|  | 5. LCI / LCA | — | 13% | 13% |
| Hedge & Descorrelação | 6. Ouro | 7% | 6% | 6% |
| Renda & Crescimento BR | 7. FIIs | 14% | 12% | 17% |
|  | 8. Ações | 25% | 17% | 17% |
| Exposição Global & Cripto | 9. BDRs | 2% | 6% | 6% |
|  | 10. Fundos Internacionais / ETFs | 2% | 8% | 11% |
|  | 11. Criptomoedas | — | 3% | 5% |
| TOTAL | 11 Classes | 100% | 100% | 100% |

## 5.3 Como Aplicar essa Estrutura na Prática

- Definição da Fatia: cada uma das 11 classes recebe seu percentual do patrimônio total combinando Perfil Patrimonial (linha da matriz) e Prazo (coluna).

- Calibração Fina: os Pilares 4 a 7 redistribuem pontos percentuais dentro dessa fatia — ver Seção 3.5 para a especificação exata implementada em aplicarCalibradoresSuaves.

- Travas de Segurança Adicionais: o motor ainda ajusta a carteira por cima disso com base em reserva de emergência, patrimônio disponível e experiência do investidor — ver Seção 6, que sempre prevalece sobre a calibração fina.

## 5.4 Matriz de Fallback (Sem as 7 Perguntas de Arquitetura Patrimonial)

Quando o cliente ainda não respondeu as 7 perguntas de Arquitetura Patrimonial, o motor usa uma matriz mais simples — só Suitability x Prazo (MATRIZ_BASE em engine.ts), sem o eixo de Capacidade Real:

| **Suitability** | **Prazo** | **Composição (classes e %)** |
| --- | --- | --- |
| Conservador | Curto | Tesouro Selic 70% · CDB Liquidez Diária 30% |
|  | Médio | Tesouro Selic 45% · CDB Liquidez Diária 15% · LCI / LCA 10% · Tesouro Prefixado 20% · Ouro 2% · BDRs 2% · Fundos Internacionais 2% · FIIs 4% |
|  | Longo | Tesouro Selic 30% · CDB Liquidez Diária 10% · LCI / LCA 10% · Tesouro IPCA+ 25% · Ouro 3% · BDRs 3% · Fundos Internacionais 3% · FIIs 16% |
| Moderado | Curto | Tesouro Selic 70% · CDB Liquidez Diária 30% |
|  | Médio | Tesouro Selic 25% · CDB Liquidez Diária 5% · LCI / LCA 15% · Tesouro Prefixado 15% · Ouro 4% · BDRs 4% · Fundos Internacionais 4% · FIIs 28% |
|  | Longo | Tesouro Selic 10% · CDB Liquidez Diária 5% · LCI / LCA 15% · Tesouro IPCA+ 20% · Ouro 2% · Ações 20% · FIIs 24% · BDRs 2% · Fundos Internacionais 2% |
| Arrojado | Curto | Tesouro Selic 40% · CDB Liquidez Diária 30% · Ações 27% · Criptomoedas 3% |
|  | Médio | Tesouro Selic 10% · CDB Liquidez Diária 7% · LCI / LCA 14% · Tesouro Prefixado 10% · FIIs 20% · Ações 27% · BDRs 9% · Criptomoedas 3% |
|  | Longo | Tesouro Selic 5% · CDB Liquidez Diária 3% · LCI / LCA 12% · Tesouro IPCA+ 15% · FIIs 15% · Ações 27% · BDRs 10% · Ouro 5% · Fundos Internacionais 5% · Criptomoedas 3% |

## Resumo da Lógica em Um Parágrafo

Com as 11 classes de ativos organizadas em 5 grupos (Reserva & Liquidez, Renda Fixa Estruturada, Hedge & Descorrelação, Renda & Crescimento BR, Exposição Global & Cripto) e cruzadas com Perfil Patrimonial x Prazo, a Arquitetura Patrimonial gera 9 carteiras-modelo objetivas e replicáveis — eliminando o risco de concentrar patrimônio apenas no que a corretora sugere no teste tradicional.

# 6. Travas de Segurança Adicionais do Motor

Depois de montar a carteira-modelo (Seção 5.2 ou 5.4), o motor (gerarRecomendacao em engine.ts) ainda aplica travas de segurança individuais, na seguinte ordem:

- Prazo curto + Arrojado: se o prazo for curto e o perfil de suitability for Arrojado, rebaixa 1 nível para Moderado antes de cruzar com a Arquitetura Patrimonial.

- Liquidez frequente: se o investidor reage a notícias de crise com ansiedade e pode precisar sacar o dinheiro de repente, o perfil é limitado a, no máximo, Moderado.

- Idade e aposentadoria: se o investidor tem mais de 60 anos e o objetivo é aposentadoria, o perfil é rebaixado 1 nível para preservar capital.

- Sem reserva de emergência: se a liquidez atual (Tesouro Selic + CDB) ficar abaixo de 20% da carteira, o motor reforça CDB Liquidez Diária até atingir esse piso.

- Patrimônio baixo (< R$ 5 mil): remove FIIs, Ações, BDRs, Ouro, Fundos Internacionais e Criptomoedas, redirecionando tudo para Tesouro Selic até o cliente ter mais capital para diversificar.

- Sem experiência de investimento: limita cada ativo de risco (Ações, BDRs, FIIs, Ouro, Fundos Internacionais, Criptomoedas) a no máximo 10% cada, redirecionando o excedente para Tesouro Selic.

- Normalização final: a carteira é sempre reajustada matematicamente para somar exatamente 100%, corrigindo eventuais erros de arredondamento.

*Estas travas rodam sobre a carteira-modelo já escolhida (Seção 5.2/5.4) e podem alterar bastante o resultado final exibido ao cliente — por isso, duas pessoas com o mesmo Perfil-Mãe de Carteira podem receber alocações finais diferentes, dependendo da reserva de emergência, do patrimônio disponível e da experiência de cada uma.*