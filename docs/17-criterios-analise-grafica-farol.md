# Estudo: como o Farol lê o gráfico, e como replicar isso nos gráficos do app

Documento de **estudo**, não é decisão nem recomendação. Registra o método de análise gráfica do analista Thiago Bisi no programa diário **Farol** (playlist "Farol – Análise diária de oportunidades de investimentos", YouTube), organiza esse método em regras que o app consegue medir e propõe como entrar nos gráficos e na análise técnica de cada ação. **Nada aqui foi implementado.** Os números marcados como "provisório" são chute de partida e devem ser calibrados com o histórico de 5 anos (D120) antes de valerem.

## 1. Fontes e limites

**Vídeos lidos (transcrição automática do YouTube, sem revisão):**

| Data | O que foi lido | Contexto de mercado |
|---|---|---|
| 30/10/2026 | inteiro | semana de queda histórica (resultado da eleição), índice −18% |
| 23/10/2026 | parte das ações | véspera do segundo turno, mercado lateral |
| 15/10/2026 | parte das ações | correção curta em tendência de alta |
| 14/10/2026 | parte das ações | lateral com viés de alta |
| 09/10/2026 | parte das ações | índice em máxima histórica |
| 06/10/2026 | parte das ações | alta forte depois do primeiro turno |
| 02/10/2026 | parte das ações | rompimento do índice, bandas estreitas |
| 10/09/2026 | parte das ações | índices americanos em queda e vários rompimentos pontuais em ações |
| 28/08/2026 | parte das ações | **apresentado por outro analista**; só usado para vocabulário (padrão "1-2-3") |
| 28/07/2026 | parte das ações | mercado lateral com bandas estreitas, rompimentos pontuais em ações |
| 18/06/2026 | parte das ações | mercado em correção, com vendas por rompimento de suporte |
| 01/07/2026 | parte das ações | índice tentando formar fundo, ações com compras por pullback |
| 29/10/2026 | parte das ações | dia seguinte ao pior dia da queda pós-eleição, volatilidade alta |

Doze vídeos dele (mais o de outro analista), de junho a outubro de 2026. Os de junho, julho e a segunda leitura de outubro confirmaram o método sem trazer um setup novo; trouxeram só os pontos do bloco 3.9. **O método parece estável**: ler mais vídeos do mesmo programa tem retorno decrescente. O que falta para fixar números é calibrar com os preços (seção 6). Não li os 100 vídeos da playlist. Leitura de vídeo no navegador do app é lenta e instável: em vários vídeos a transcrição não carregou e eles ficaram de fora.

**O que a transcrição não mostra.** O desenho dele (linhas, caixas, canais) só aparece no vídeo. Tirei uma imagem do vídeo de 10/09 para conferir os indicadores da plataforma dele (seção 2). Os níveis e as linhas de tendência eu leio pelo que ele diz ("aqui nos 17,80", "essa faixa").

**É análise discricionária.** Há regras que ele repete e que dá para medir; há julgamentos de "gráfico bonito" que não dá. O que não for mensurável fica fora do cálculo e marcado como **discricionário**.

**Atribuição.** Os critérios abaixo são conceitos gerais de análise gráfica clássica e de operação de swing trade. Não copiar texto, imagens nem nomes de cursos dele no app. Os vídeos também vendem cursos; isso não é aproveitado.

## 2. O gráfico que ele usa (padrão visual)

Na imagem do vídeo de 10/09 (SUZB3, diário), a plataforma mostra:

- **Candles** diários.
- **Bandas de Bollinger A [21]**: média aritmética de 21 períodos no centro e duas bandas (provavelmente desvio 2). A "média de 21" que ele cita o tempo todo é o **centro da banda**.
- **Média móvel exponencial de 9** (a "média de 9") e **média aritmética de 50**.
- **Volume** com uma média móvel aritmética de 21 sobre ele.
- Uma **caixa** (retângulo) desenhada à mão sobre a base de consolidação, com linhas horizontais nos extremos.
- Ele também cita a **média de 200** (diária e semanal), linhas de tendência (**LTA** e **LTB**), canais e a **linha de retorno** (a paralela do canal).

Como ele analisa **três períodos**: diário e semanal para contexto, **60 minutos** para o gatilho e o stop curto ("um gráfico de 60 minutos pode ser usado para swing trade").

## 3. O método, em camadas

### 3.1 Contexto de mercado (antes da ação)
1. Olha o **índice** e os mercados externos antes das ações. Sem sinal de reversão no índice, evita compra de repique em ação. Num mercado em queda, a conclusão frequente é "nada a fazer".
2. **Risco de evento**: antes de eleição, balanço ou decisão de juros, evita swing, porque o preço pode abrir em **gap** e o stop não executa ("o mercado pode abrir com gap de 10% e eu não consigo stopar"). Ele cita a "temporada de balanços".
3. Considera horário de pregão e leilão: movimento feito no **leilão** é suspeito.

### 3.2 Tendência e estrutura (por período)
4. Tendência = **zigue-zague** (sequência de topos e fundos) mais o preço contra a média de 21 e a **LTA** ou **LTB**. **Pivô de alta** = rompe o topo anterior depois de um fundo; **pivô de baixa** = o oposto. Fundo duplo só "vale" depois de **romper o topo intermediário**.
5. **Reversão exige mais que um candle**: romper o canal de baixa e formar zigue-zague ascendente. Um candle verde pequeno, com volume fraco, no meio de uma queda "não é reversão".
6. Correção dentro de tendência de alta tem **volume baixo** e dura poucos candles; isso favorece a continuação ("três candles de queda, ideia de pullback").
7. Movimento em "linha reta", sem pausa, é desconfiado: espera repique ou correção.
8. **Retângulo** (base) e **congestão**: dentro de uma base, o viés é de rompimento no sentido da tendência anterior; compra na base mira a resistência da base, e rompimento é o sinal de entrada.

### 3.3 Níveis (suporte e resistência)
9. São **zonas** ("faixa", "região", "patamar"), nunca preço exato.
10. Origem dos níveis: fundos e topos anteriores nomeados pelo mês ("fundo de agosto", "topo de fevereiro"); **abertura da semana** (a abertura da segunda-feira); **bordas de gap** ("fronteira 1 e fronteira 2 do gap"); médias de 9, 21, 50, 200 (a de 200 semanal é suporte forte); LTA, LTB e linha de retorno; bordas de retângulo; números redondos; máxima histórica.
11. Nível rompido vira o contrário e é testado no pullback.
12. O nível do período maior pesa mais (semanal sobre diário).

### 3.4 Gatilhos e setups de compra (o coração do método)
Ele compra quase sempre **na superação da máxima de um candle de sinal**, depois que um setup se formou. Setups observados:

- **A. Rompimento de base com volatilidade comprimida.** A ação anda de lado por semanas, as **bandas de Bollinger estreitam** e a volatilidade cai; um dia rompe a base com **volume alto**, candle firme (ignição) e as **bandas começam a abrir**. Bom quando não está "caro" (perto do limite da base) e o stop é curto. Exemplos: "volume alto, bandas super estreitas, rompendo resistência, sem ficar muito caro"; "Suzano: 12 candles laterais, rompendo na 13ª, tem base mínima".
- **B. Pullback em tendência de alta.** A ação volta à **média de 9**, à **média de 21**, à **linha de retorno** do canal de alta, à LTA ou a **50% do gap**, e dá um candle de reversão (martelo, engolfo, trap, barra ignorada). Entrada na superação da máxima desse candle. Quer correção "profunda o bastante": "a gente tá muito distante da média de 21; eu faria nada".
- **C. Trap em suporte.** O preço tenta romper um fundo, não consegue e volta; compra na superação da máxima do candle do trap, com volume. Vale também o trap na mínima da barra de ignição, idealmente perto da média de 9.
- **D. Regra do gap.** Depois de um gap de alta, espera a correção até **50% da amplitude do gap, de corpo a corpo**; ou o preço "fecha o gap" e reage. Entrar "através de um gap" é aceito quando é rompimento de base. Gap aberto não preenchido é um alvo de correção.
- **E. Reversão de fundo.** Fundo duplo ou fundo mais alto, **pivô de alta** (romper o topo intermediário), rompimento da LTB, **zigue-zague ascendente**. Sequência que ele aprecia: fundo duplo, rompe o gap, respiro, pullback da cabeça e superação da máxima.
- **F. Barra ignorada / inside bar.** Candle (muitas vezes vermelho) que não foi superado no dia seguinte; compra na superação da máxima, com **stop curto** na mínima da barra pequena.
- **G. Barra de ignição / barra elefante.** Candle grande e firme que inicia movimento; ele evita operar **contra** barra grande, inclusive no semanal, e usa a ignição que rompe consolidação como gatilho.
- **H. "1-2-3 de compra"** (citado por outro analista no vídeo de 28/08): fundo, topo e um segundo fundo mais alto, comprado na superação da máxima do segundo fundo. Secundário, não é dele.
- **Venda (rara no swing):** retorno à média de ação muito esticada, rompimento de suporte com estrela cadente e volume. Ele diz com frequência que "ainda não é momento de venda" e evita vender depois de queda esticada.

### 3.5 Candles: só valem com contexto
13. **Martelo**: precisa de amplitude relevante frente à volatilidade e de volume que se destaque; martelo pequeno "não é candle de reversão". **Engolfo de alta**: com volume, sobre o suporte. **Estrela cadente**: reversão de topo com bom volume, mas "fechou em alta, não é bom sinal". Candle que **perde a mínima e engolfa** costuma continuar a alta.
14. Sombra inferior em candle de alta é positiva; candle de **indecisão** (inside, corpo pequeno) não muda o viés.

### 3.6 Volume e liquidez
15. Volume confirma rompimento e reversão. Ele cita "volume decente: média de 26 milhões, hoje 50 milhões" (cerca de **2 vezes a média**); a ignição pode valer mesmo com volume só "se destacando um pouco".
16. **Liquidez mínima**: ação que negocia menos de **R$ 1 milhão por dia** é descartada ("esquece").
17. Alta com volume fraco não muda nada; queda com volume baixo é correção, não reversão.

### 3.7 Filtros: quando não faz nada
18. **"Não vejo sinal, então não faço nada"** é uma conclusão normal e frequente. Ele diz o que precisaria ver para mudar de ideia (um nível, um candle).
19. **Esticado ou sobrecomprado**: longe da média de 9 ou de 21, ou depois de muitos dias de alta, não compra ("difícil se posicionar no meio de movimento forte"); espera correção. Ação já correu da barra de sinal: "pagar ainda mais caro não dá".
20. **Sobrevendido** depois de queda enorme não é compra sem sinal de reversão; também não vende ali.
21. **Rompimento que falha** vira sinal contrário; "pullback de um candle só nunca é legal"; rompimento precisa de confirmação (fechamento, volume).
22. **Stop caro**: se o stop fica longe demais, não entra e espera gatilho menor (no 60 minutos) ou trata como posição (position), não swing.
23. Contra as médias (preço abaixo da média de 21 e da de 200) a compra exige mais.

### 3.8 Stop, alvo e gestão
24. **Stop** abaixo da **mínima do candle de sinal**, ou da mínima de ontem, ou abaixo da base, ou do "fundo válido" da estrutura. Stop "frágil" (mínima de hoje) ou "longo" (mínima de ontem) é avaliado contra a distância da média de 21.
25. **Relação retorno/risco de pelo menos 1:1**: aceita stop de 12% só se o alvo entregar 12%; aceita 3,5% quando a barra é curta.
26. **Alvo**: próxima resistência, topo anterior, média de 200, fechamento do gap, ou **a altura da base projetada** a partir do rompimento ("uma boa medida de movimento lateral").
27. **Parcial** na resistência e **stop móvel por mínimas** (abaixo da mínima do dia ou da véspera) enquanto o papel sobe; "quem trabalha stop por mínimas não é stopado há bastante tempo". Ajusta o tamanho da parcial ao novo tamanho do stop.
28. Posição vendida ou comprada que perde o sinal sai e **reentra** se houver novo sinal.

### 3.9 Acréscimos dos vídeos de junho e julho
29. **Venda quando o setup é claro**: perda de suporte com **volume forte e barra grande** (ex.: queda de 9% com muito volume) dá venda, com gatilho na **perda da mínima** do candle. Como o preço já está esticado e o stop sai caro, usa **posição pequena** e, em vez de vender a mercado, uma **"pescaria"**: ordem em um repique provável para ter stop mais curto. Stop de venda acima das últimas máximas.
30. **Preço não ajustado por dividendos é a versão preferida** dele; ele compara com a ajustada porque a média de 200 pode ser obstáculo numa e suporte na outra ("no saldo das duas visões, dá para operar"). O app também não ajusta por dividendos (D120).
31. **Tamanho da barra é relativo à ação**: "2,5% já é uma barra significativa para ela"; o volume é comparado ao **"regime dos últimos dois meses"** da própria ação, não a um número fixo. Número de negócios também confirma volume.
32. **Pico de volume costuma marcar inflexão** do movimento.
33. **Resistência que vem de um gap** (origem do gap) atrapalha o rompimento, mesmo com bandas abrindo.
34. **Medida do mastro da bandeira**: o alvo de uma bandeira ou flâmula é o tamanho do impulso anterior projetado; "cumpriu o alvo da bandeira e começou a perder força".
35. **Acrescentar posição no pullback** depois de comprar o rompimento, sem fugir do risco definido.
36. **Evento após balanço**: ação que abre em gap de alta depois do balanço e "rasga para baixo" (amplitude de 13%) fica sem trade: "até a venda fica ruim, é difícil posicionar stop". Mudança de composição de índice por fundos também é risco de curto prazo.
37. **Liquidez**: "faz 8 milhões por dia" aparece como ressalva, não como veto (o veto citado é abaixo de R$ 1 milhão).
38. **Regime do índice manda**: com o índice em queda forte e sem sinal de fundo, "enquanto o índice não der uma sinalização firme, não vou às compras", mesmo com a ação dando setup. Depois de um choque, a **volatilidade geral sobe** e o tamanho de barra se mede contra ela: "2,23% parece um candle pequenininho porque a volatilidade geral aumentou muito".
39. **Ele próprio não opera vendido** ("eu não opero short"), mas reconhece e comenta sinais de venda. Para o app, venda é leitura descritiva, nunca ordem.
40. **Stop curto com reentrada**: "o stop certo era mais embaixo, mas eu iria de stop curto; se fosse stopado, tentaria uma reentrada".
41. **O retorno/risco considera obstáculos no caminho**: uma barra elefante baixista (abre na máxima e fecha na mínima, queda de 6,5%) sugere venda, mas "para chegar no um para um eu teria de vencer a média de 200 e o fundo importante: não abraço".
42. **Barra de ignição não acionada** que volta a corrigir não é compra: "nada garante que ela não caia até a abertura dessa barra"; a abertura da barra de ignição é o nível de invalidação.

## 4. Vocabulário dele → regra que o app consegue medir

Todos os números são **provisórios**, para calibrar.

| Termo dele | Regra mensurável proposta |
|---|---|
| Média de 21 | Média aritmética de 21 (centro das bandas de Bollinger) |
| Média de 9 | Exponencial de 9 |
| Bandas estreitas / abrindo | Largura das bandas (superior − inferior)/centro em percentil dos últimos 120 pregões: estreita se abaixo do percentil 20; "abrindo" se a largura sobe pelo menos 15% em 3 pregões |
| Base / consolidação | Mínimo de 12 candles com amplitude total (máxima − mínima) até 1,5 × ATR(14) × raiz do número de candles ou até 12% do preço; sem tendência (inclinação da média de 21 próxima de zero) |
| Barra de ignição | Corpo ≥ 1,5 × ATR(14), fecha no terço superior, sai de base, volume ≥ média de 21 do volume |
| Barra elefante | Amplitude ≥ 2 × ATR(14) |
| Barra ignorada | Candle cuja máxima e mínima não foram superadas pelo candle seguinte (inside bar) e cuja amplitude é menor que 0,8 × ATR(14) |
| Martelo | Sombra inferior ≥ 2 × corpo, fecha no terço superior, amplitude ≥ 0,8 × ATR(14), volume ≥ média de 21 |
| Engolfo de alta | Corpo de alta que engloba o corpo de baixa anterior, perto de suporte ou da média de 21, volume maior que o do dia anterior |
| Trap | Preço fura o nível (mínima abaixo do fundo, ou máxima acima do topo) e fecha de volta dentro nos 1 a 3 candles seguintes |
| Pivô de alta | Fechamento acima do topo intermediário depois de um fundo (pivô de 3 a 5 candles) |
| Pullback | Primeiro retorno ao nível rompido ou à média (9 ou 21) depois do rompimento, até 10 candles |
| Gap | Abertura acima da máxima (ou abaixo da mínima) do dia anterior; **fronteira 1** = máxima do dia anterior, **fronteira 2** = abertura do dia do gap; "regra dos 50%" = ponto médio de corpo a corpo |
| Esticado | Distância do fechamento à média de 21 acima de 2,5 × ATR(14) ou fechamento acima da banda superior |
| Fundo válido | Último fundo que, se perdido, quebra a sequência de fundos mais altos |
| Liquidez | Volume financeiro médio de 21 dias ≥ R$ 1 milhão |

## 5. O que o app já tem e o que falta

| Critério | No app hoje | Dá para automatizar? |
|---|---|---|
| Zonas por fundos e topos (3.3) | Sim: pivôs agrupados em zonas de largura limitada, com toques e idade | Já feito |
| Abertura da semana e bordas de gap como nível | Não | Sim, direto dos candles (abertura real no histórico de 5 anos) |
| Média de 200 semanal como nível | Média de 200 diária | Sim |
| Média de 9 exponencial, centro e bandas de Bollinger | Não (médias simples de 21, 80 e 200 no gráfico) | Sim |
| LTA, LTB, canal e linha de retorno | Não | Parcial: dois pivôs definem a reta; é a parte mais discricionária |
| Zigue-zague e pivô | Sim (estrutura da tendência) | Já feito; falta "pivô de alta" como evento |
| Base e rompimento com volume e bandas | Não | Sim |
| Candles medidos contra ATR e volume (martelo, engolfo, ignição, elefante, ignorada, trap) | Não | Sim |
| Gatilho pela máxima do candle de sinal, stop pela mínima do sinal | Hipótese de entrada no suporte; stop = suporte menos meio ATR | Sim |
| Regra dos 50% do gap, fechamento de gap | Não | Sim |
| Relação retorno/risco, alvo por altura da base, stop móvel por mínimas | Retorno/risco ≥ 1 com alvo nas resistências | Sim |
| Filtros (esticado, liquidez, stop caro, evento) | Liquidez e risco na nota; sem "esticado" nem "evento" | Esticado e liquidez sim; evento só com calendário de balanços (não temos) |
| "Sem sinal, nada" | Sim: conclusão "sem sinal técnico consistente" | Já feito |
| Gráfico de 60 minutos | Não | **Não**: falta fonte de dados (brapi gratuita não libera) |

## 6. Como replicar nos gráficos do app

Proposta em quatro camadas, da mais objetiva para a mais discricionária.

**Camada 1: indicadores no gráfico.** Bandas de Bollinger (21, 2) e média exponencial de 9 como opções ligáveis (junto das médias que já existem); volume com média de 21. Resultado visual igual ao que o analista usa.

**Camada 2: níveis.** Somar às zonas atuais: abertura da semana, bordas dos gaps abertos, média de 200 semanal, caixa da base atual (extremos da consolidação), máxima histórica. Cada nível com a origem escrita ("fundo de 12/08", "abertura da semana de 26/10"), como ele fala. LTA e LTB só depois, com ajuste manual possível.

**Camada 3: marcadores de sinal nos candles.** Pequenos símbolos nos candles em que um padrão medido ocorreu (ignição, elefante, ignorada, martelo, engolfo, trap, rompimento de base). O toque no candle explica por que foi marcado e com que números.

**Camada 4: leitura personalizada ("Leitura Farol")** no resumo da análise técnica, por ação:
- **Tendência** (diário e semanal) e **viés**;
- **Setup ativo** (A a G acima) ou "nenhum setup";
- **Gatilho** (preço da máxima do candle de sinal) e se já foi acionado;
- **Stop** (mínima do sinal ou base) e **distância em %**;
- **Alvo** (resistência, gap, altura da base) e **retorno/risco**;
- **Filtros reprovados** (esticada, liquidez baixa, stop longo, mercado em queda), cada um com o motivo;
- conclusão em texto: "Setup de rompimento de base com volume, gatilho 17,80, stop 16,90 (5,1%), alvo 19,40, retorno/risco 1,8" **ou** "Sem sinal: ação esticada, a 3,1 ATR da média de 21".
Tudo calculado por regra, descritivo, sem prometer retorno (exceção D19 como a da D119), com o mesmo aviso de "leitura educacional, não é recomendação".

**Calibragem com o histórico de 5 anos.** Antes de fixar os números da seção 4, rodar cada setup nos 5 anos de candles com abertura de 220 ações e medir: quantas vezes aparece, quanto o preço andou nos 5, 10 e 20 pregões seguintes, quantas vezes bateu no stop antes do alvo. Isso troca "chute provisório" por limiar escolhido com dado e mostra se um setup dele funciona no nosso universo. **Cuidado com sobreajuste**: escolher só limiares simples e testar em período que não foi usado para escolher.

## 7. Fases sugeridas

1. **Indicadores e níveis** (camadas 1 e 2): Bollinger, EMA 9, abertura da semana, gaps, média de 200 semanal, caixa da base. Baixo risco.
2. **Candles e setups medidos** (camada 3 e parte da 4): ignição, elefante, ignorada, martelo, engolfo, trap, rompimento de base, regra dos 50% do gap, com testes unitários por padrão.
3. **Leitura Farol e filtros** (camada 4): gatilho, stop, alvo, retorno/risco, motivos de "sem sinal".
4. **Calibragem e backtest** com o histórico de 5 anos, e só então fixar limiares e eventual pontuação.
5. **Linhas de tendência** e eventual **60 minutos** se houver fonte de dados.

## 8. Decisões em aberto (do responsável)

1. Quais camadas e fases entram, e em que ordem. Sugestão: fase 1, depois 2.
2. O app cita a inspiração ou escreve só "critérios de análise gráfica clássica"?
3. A "Leitura Farol" vira uma seção nova na análise técnica ou substitui a hipótese operacional atual?
4. Aceita o backtest como regra de calibragem (e a limitação de que 5 anos incluem um mercado muito atípico, a eleição de 2026)?
5. Ampliar a amostra de vídeos (outros meses) antes de fixar os limiares, ou calibrar só com o histórico de preços?
