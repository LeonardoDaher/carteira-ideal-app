# Metodologia da triagem "Top 15 ações mais baratas"

**Versão da metodologia: 1.0.7** · Decisão de origem: D49 · Parâmetros: `config/acoes-baratas.json` (fonte única) · Código: `scripts/acoes-baratas-calculo.mjs` (cálculo puro), `scripts/acoes-baratas-cvm.mjs` (leitura da CVM), `scripts/atualizar-acoes-baratas.mjs` (orquestração e gravação da auditoria), `scripts/acoes-baratas-verificar.mjs` (verificação independente).

> **Regra de ouro deste documento.** Tudo o que está aqui deve poder ser conferido contra o código e contra a pasta `auditoria/acoes-baratas/<data>/`. Se o código mudar, a versão em `config/acoes-baratas.json` sobe, o histórico de versões (final deste arquivo) ganha uma linha, e este texto é atualizado no mesmo commit.

---

## 1. O que é, e o que não é

É uma **triagem quantitativa por fórmula**: ordena as empresas do cadastro do app pela média de três rendimentos contábeis sobre o preço de mercado e mostra as 15 primeiras. A fórmula é a mesma para todos, não conhece o perfil de ninguém e não projeta retorno.

Não é recomendação de investimento, não estima valor justo e não diz que uma ação "é boa". Estar barata nos números é compatível com estar barata por um motivo ruim (armadilha de valor); os filtros de qualidade opcionais (seção 8) existem para reduzir isso, não para eliminá-lo.

**Exceção declarada à D19.** Os simuladores de ativos do app são descritivos, sem ranking nem múltiplos. O Top 15 é a única exceção, e por isso tem trava de publicação (seção 11) e trilha de auditoria completa. **Natureza declarada pelo responsável (04/10/2026):** análise estritamente contábil de informações públicas das empresas, por fórmula única, sem recomendação de compra. A tela, a página de Metodologia e os avisos foram redigidos de acordo.

## 2. Fontes de dados (todas gratuitas e públicas)

| Dado | Fonte | Arquivo / endereço | Como é registrado |
|---|---|---|---|
| Demonstrações anuais (DRE, BPA, BPP, DFC, DVA) | CVM, dados abertos | `…/CIA_ABERTA/DOC/DFP/DADOS/dfp_cia_aberta_AAAA.zip` | URL, sha256, tamanho e instante no `manifesto.json` |
| Demonstrações trimestrais | CVM, dados abertos | `…/CIA_ABERTA/DOC/ITR/DADOS/itr_cia_aberta_AAAA.zip` | idem |
| Quantidade de ações (composição do capital) | CVM, dentro dos zips DFP/ITR | `*_composicao_capital_*.csv` | idem |
| Ligação código de negociação → CNPJ | CVM, FCA | `…/CIA_ABERTA/DOC/FCA/DADOS/fca_cia_aberta_AAAA.zip` (valores mobiliários) | idem + `mapeamento-ticker-cnpj.csv` |
| Preços e volumes | B3, Boletim de Preços (BVBG.086) | `historico/acoes.json` (mantido pelo job diário de Ações) | último pregão no manifesto |
| Setor e nome | Cadastro curado do projeto | `config/acoes.json` | hash da config |

Anos baixados (com a data de corte no ano *A*): DFP de *A−5* a *A* (5 exercícios para a consistência, seção 8.5, mais o corrente), ITR de *A−1* e *A*, FCA de *A* e de *A−1* (o mais recente vale; o anterior só preenche os códigos que o recente não traz, para achar a empresa que ainda não entregou o FCA do ano ou mudou de código). Os DFP mais antigos que *A−2* são lidos só para lucro e caixa operacional (contas 3.11, 3.11.01 e 6.01, coluna ÚLTIMO).

**Escala e moeda.** `ESCALA_MOEDA` = MIL multiplica por 1.000; UNIDADE por 1; qualquer outra faz o job falhar. Linhas com `MOEDA` diferente de REAL são descartadas e contadas no manifesto (a empresa sai por dados incompletos se faltar conta por isso).

**Versões reapresentadas.** Para cada (empresa, `DT_REFER`), vale apenas a maior `VERSAO` do arquivo principal do formulário; linhas de versões antigas são ignoradas.

**Ponto no tempo.** Só entram documentos com `DT_REFER` e `DT_RECEB` até a data de corte. Isso impede "olhar o futuro" e permite reproduzir uma execução antiga.

## 3. Universo

Empresas de `config/acoes.json` (um código por empresa, o mais líquido). **O universo é o cadastro do app, não a bolsa inteira**; a tela diz quantas empresas foram analisadas. Ampliar o universo é editar o cadastro.

Saem do escopo (etapa `universo`): setores **Bancos**, **Seguros e previdência** e **Bolsa, holdings e serviços financeiros**, porque EV, EBIT e caixa operacional não medem o negócio de instituições financeiras. Sai também, pela lista `universo.excluirTickers` da config, a empresa que repete o mesmo negócio de outra do cadastro (hoje: **GOAU4**, holding que consolida a Gerdau/GGBR4; fica a operacional). Sai ainda quem não tem CNPJ resolvido ou preço recente (último negócio há mais de 10 dias do último pregão).

**CNPJ.** Ordem de prioridade: correção manual em `config/acoes-baratas-cnpj.json` → FCA com um único CNPJ de negociação vigente → FCA com um único CNPJ → ambíguo (empresa sai com motivo). Cada decisão e sua origem estão em `mapeamento-ticker-cnpj.csv`.

## 4. Filtros iniciais

Cada empresa é atribuída à **primeira** etapa que a reprova (a ordem muda a contagem por etapa, nunca o ranking final). Ordem: universo → liquidez → volatilidade → dados contábeis → lucro → indicador.

| Etapa | Regra | Parâmetro (config) |
|---|---|---|
| `liquidez` | Média diária de negociação do **emissor** (soma de todas as classes ON/PN do mesmo prefixo de 4 letras, dia sem negócio conta zero) abaixo do mínimo sai | `filtros.liquidezMinimaDiariaReais` = R$ 3.000.000; `sessoesLiquidez` = 21 |
| `volatilidade` | Volatilidade anualizada = desvio-padrão **amostral** dos retornos logarítmicos diários dos últimos 252 pregões × √252, sobre fechamentos ajustados por desdobramento. O corte é o percentil 90 (método *nearest-rank*) de **todas** as empresas do cadastro com série válida, inclusive as de setores excluídos. Sai quem tem volatilidade **estritamente acima** do corte | `percentilVolatilidadeExcluir` = 90; `minimoRetornosVolatilidade` = 126 |
| `volatilidade` (preço) | Salto de preço (queda ≥ 45% ou alta ≥ 80% entre dois fechamentos) sem desdobramento ou grupamento confirmado torna a série não confiável; a empresa sai com a data do salto. Confirmações valem se estiverem em `config/acoes.json → desdobramentos` **ou** em `config/acoes-baratas.json → desdobramentos` (somadas, sem duplicar a mesma data); fator > 1 = desdobramento, < 1 = grupamento. Confirmados na 1ª execução real: SBSP3 (1:5, 29/04/2026), SIMH3 (grupamento 2:1, 18/02/2026), ORVR3 (1:4, 11/08/2026) | — |
| `volatilidade` (histórico) | Menos de 126 retornos diários disponíveis: sai ("histórico insuficiente"). Isso retira IPOs recentes | `minimoRetornosVolatilidade` |
| `dados_contabeis` | Demonstração incompleta, defasada ou incoerente (seção 7) | `idadeMaximaDemonstracaoDias` = 200 |
| `lucro` | Lucro líquido dos últimos 12 meses não positivo sai | `lucroLtmPositivo` |
| `indicador` | EV ≤ 0 ou valor de mercado ≤ 0 sai (rendimento sobre EV indefinido) | — |

## 5. Dados contábeis: contas da CVM usadas

Consolidado (`con`) quando existe a conta 3.05 no documento mais recente; senão individual (`ind`). A escolha fica registrada na memória de cálculo.

| Variável | Conta CVM | Demonstração | Tipo | Observação |
|---|---|---|---|---|
| Receita | 3.01 | DRE | fluxo | usada só na verificação de coerência |
| Recuperabilidade de ativos | 3.04.03 | DRE | fluxo, opcional | ajuste do EBIT |
| Outras receitas operacionais | 3.04.04 | DRE | fluxo, opcional | ajuste do EBIT |
| Outras despesas operacionais | 3.04.05 | DRE | fluxo, opcional | ajuste do EBIT |
| Equivalência patrimonial | 3.04.06 | DRE | fluxo, opcional | ajuste do EBIT |
| **EBIT** | **3.05** | DRE | fluxo | descrição deve conter "resultado antes do resultado financeiro" |
| Resultado financeiro | 3.06 | DRE | fluxo, opcional | verificação de coerência |
| Despesas financeiras | 3.06.02 | DRE | fluxo, opcional | cobertura de juros |
| Resultado antes dos tributos | 3.07 | DRE | fluxo, opcional | verificação de coerência |
| **Lucro consolidado** | **3.11** | DRE | fluxo | **lucro de referência** dos filtros de lucro de 12 meses e de consistência |
| Lucro dos controladores | 3.11.01 | DRE | fluxo, opcional | **só informativo**: na primeira execução real a DFP da SER3 trazia 3.11.01 = 0 em todos os exercícios, até no de prejuízo, enquanto os ITR traziam valores normais |
| **Caixa das atividades operacionais (FCO)** | **6.01** | DFC (MD ou MI) | fluxo | |
| Depreciação e amortização | 7.04.01 | DVA | fluxo, opcional | EBITDA; sem ela o EBITDA é indisponível. **A DVA mostra as retenções com sinal negativo**, então usa-se o valor absoluto |
| Ativo total / Passivo total | 1 / 2 | BPA / BPP | saldo | verificação de que o balanço fecha |
| Caixa e equivalentes | 1.01.01 | BPA | saldo | |
| Aplicações financeiras (circulante) | 1.01.02 | BPA | saldo, opcional | |
| Empréstimos e financiamentos (inclui debêntures) | 2.01.04 e 2.02.01 | BPP | saldo, opcional | dívida bruta |
| **Patrimônio líquido** | **2.03** | BPP | saldo | |
| Participação de não controladores | 2.03.09 | BPP | saldo, opcional | |

"Opcional" quer dizer: conta realmente ausente vale 0 e isso fica escrito na memória de cálculo. Qualquer *outro* problema com uma conta (duração errada, descrição inesperada) invalida a empresa, nunca vira zero.

### 5.1 Últimos 12 meses (LTM)

- Último documento é **DFP** → o próprio exercício (de 360 a 372 dias).
- Último documento é **ITR** → `LTM = exercício anterior (DFP) + acumulado do ano atual (ITR, coluna ÚLTIMO) − acumulado do ano anterior (ITR, coluna PENÚLTIMO)`. Entre as linhas do ITR escolhe-se a de **maior duração** (acumulado do ano, não o trimestre isolado). Os dois acumulados devem ter durações iguais (tolerância de 4 dias) e a DFP deve ser a do exercício encerrado no dia anterior ao início do acumulado.
- Saldos (balanço) são os da data-base do documento mais recente.

### 5.2 Valor de mercado

`Valor de mercado = Σ por classe (ações em circulação × preço da classe)`, com ações em circulação = capital integralizado − tesouraria, por classe (ordinárias e preferenciais, da composição do capital do mesmo documento; se não houver, o registro mais recente até a data de corte).

**Preço de cada classe.** Classe ON = último fechamento do código terminado em 3. Classe PN = o código preferencial (final 4, 5 ou 6) mais negociado. **Unit (final 11) nunca é preço de classe**, porque vale várias ações juntas (ex.: 1 ON + 4 PN); na 1ª execução real a Taesa aparecia com a PN a R$ 42,85 (o preço da unit) contra a ON a R$ 14,03, e ALUP11, ENGI11, IGTI11 e SAPR11 tinham o valor de mercado superestimado. A unit conta só no **volume** do emissor.

**Classe sem negociação recente.** Se uma classe tem ações mas não negociou nos últimos 10 dias, ela é avaliada pelo preço da **outra** classe e a empresa é marcada `preco_da_outra_classe`. Se a parte aproximada passar de **50% das ações** (`verificacoes.maxFracaoSemPreco`), a empresa sai com o motivo `classe_sem_preco`, porque classes diferentes podem ter direitos econômicos muito diferentes (caso TFCO4: a ON, 93% das ações, não tem preço e vale cerca de 1/10 da PN). O limite foi de 10% na 1.0.5; subiu para 50% na 1.0.6 porque tirava AXIA3 (PN, 21%) e SHUL4 (ON, 43%), cujas classes têm direitos parecidos e cuja aproximação erra poucos por cento. Abaixo de 50% a empresa fica, marcada `preco_da_outra_classe`. Se não há preço de nenhuma classe e a referência é uma unit, a empresa sai por `capital_invalido`.

**Unidade da quantidade de ações.** O formulário da CVM não traz a unidade, e muitas companhias informam a quantidade **em milhares**. Na 1ª execução real, 31 de ~100 empresas (de Vale a Ambev, Renner, Cemig e Taesa) estavam nesse caso: P/VP implícito de 0,0003 a 0,0034 (com ×1000: 0,30 a 3,40). Dois caminhos, ambos registrados na memória de cálculo:

1. **Manual** (`capital.ajustesManuais`, por ticker, com o motivo): vence sempre.
2. **Automático** (`verificacoes.unidadeAutomatica`), **só com dois sinais independentes**: (a) o P/VP sem ajuste fica abaixo do mínimo plausível (0,02) **e** (b) o giro diário (volume médio do emissor ÷ valor de mercado) fica acima de 25% ao dia, isto é, o emissor negociaria por dia mais do que vale; **e** depois de multiplicar por 1.000 o P/VP volta à faixa e o giro a ≤ 25%. Empresa barata de verdade (P/VP baixo com giro normal) não é tocada; um ajuste que não deixa tudo plausível não é aplicado.

Depois de qualquer ajuste, a verificação de P/VP plausível (seção 7) roda de novo. A memória guarda a quantidade original da CVM, o fator e as evidências (P/VP e giro antes e depois).

**Erros de preenchimento da composição do capital (1.0.7).** Antes de calcular o valor de mercado, o capital é conferido contra os documentos anteriores da própria empresa (`sanearCapital`, em `acoes-baratas-calculo.mjs`). Só corrige com evidência; sem ela, o capital segue como veio. Cada correção vai para a memória de cálculo (com o valor que a CVM informou), para a lista `correcoesCapital` e para os alertas (`capital_corrigido:<código>`):

1. **Tesouraria em outra unidade** (`tesouraria_em_outra_unidade`, caso TEND3): no ITR de 30/06/2026 o capital vinha em milhares (122.578) e a tesouraria em unidades (65.148), o que tirava 53% das ações. Corrige se a tesouraria passa de 30% das ações da classe, se dividida por 1.000 fica abaixo de 10% e se no documento anterior ela era menor que 10%. A tesouraria é dividida por 1.000.
2. **Quantidade ×10, ×100 ou ×1000** (`quantidade_divergente`, caso LAVV3: 1.954.343.520 ações no ITR de 30/06/2026 contra 195.434.352 em todos os documentos anteriores). Corrige se a razão para o documento anterior é uma dessas potências (tolerância de 1%), se os dois documentos anteriores concordam entre si, se não há desdobramento ou grupamento em `desdobramentos` depois do documento anterior e se o preço não tem salto sem explicação. A quantidade é dividida pelo fator.

Esta correção vem **antes** do ajuste de unidade em milhares (acima), e os dois podem valer para a mesma empresa (TEND3).

### 5.3 EV, EBIT ajustado e demais derivados

```
Dívida bruta       = 2.01.04 + 2.02.01
Caixa              = 1.01.01 + 1.01.02
Dívida líquida     = Dívida bruta − Caixa
PL controladores   = 2.03 − 2.03.09
EV                 = Valor de mercado + Dívida líquida + 2.03.09
EBIT ajustado      = 3.05 − 3.04.06 − 3.04.03 − (3.04.04 + 3.04.05)
                     (cada parcela pode ser desligada em config: indicador.ebitAjustado)
EBITDA             = EBIT ajustado + |7.04.01|   (a DVA traz a depreciação negativa; soma-se o valor absoluto)
Capital investido  = PL total (2.03) + Dívida bruta − Caixa
NOPAT              = EBIT ajustado × (1 − 0,34)
```

## 6. Indicador composto e ordenação

Três rendimentos (quanto maior, mais barata a empresa):

1. **PL ÷ valor de mercado** (inverso do P/VP), com PL dos controladores.
2. **FCO 12m ÷ EV.**
3. **EBIT ajustado 12m ÷ EV.**

Para cada rendimento, calcula-se o **rank percentual** entre as empresas que chegaram até aqui: `(posto médio − 1) ÷ (n − 1)`, onde 1,0 é a empresa de maior rendimento; empates recebem a média dos postos. A **nota** é a média dos três ranks percentuais. A lista é ordenada por nota decrescente; em empate, ordem alfabética do código (determinístico).

*Por que ranks e não valores.* Ranks são imunes a valores extremos, que é o tratamento de *outliers* pedido no método de referência, sem exigir cortes arbitrários. A configuração aceita `metodoComposicao: "zscore_winsorizado"` (média de z-scores após cortar em p1 e p99) como alternativa para análise de sensibilidade; o padrão é `ranks`.

## 7. Verificações de integridade (por empresa)

Falhou, a empresa sai na etapa `dados_contabeis` com código e motivo em `exclusoes.csv`. Nada é corrigido em silêncio.

| Verificação | Regra | Código de exclusão |
|---|---|---|
| Demonstração atual | Última `DT_REFER` com no máximo 200 dias até a data de corte | `demonstracao_defasada` |
| Balanço fecha | |Ativo total − Passivo total| ≤ 0,5% do ativo | `balanco_nao_fecha` |
| DRE fecha | |EBIT + resultado financeiro − resultado antes dos tributos| ≤ 0,5% da maior entre receita e LTM do resultado antes dos tributos (só se 3.06 e 3.07 existem) | `dre_nao_fecha` |
| Descrição da conta | A descrição da CVM bate com a esperada (ex.: 3.05 contém "resultado antes do resultado financeiro") | `dados_incompletos_ou_incoerentes` |
| Capital plausível | P/VP implícito entre 0,02 e 100 (quando o PL de controladores é positivo) | `capital_implausivel` |
| Tesouraria | Tesouraria não pode exceder o capital da classe | `capital_invalido` |
| Classe com preço | Classe(s) com mais de 50% das ações sem negociação recente não são avaliadas pelo preço de outra | `classe_sem_preco` |
| Caixa operacional coerente | FCO de 12 meses não pode passar de **2x** o EBITDA (ou o EBIT ajustado, se não houver EBITDA), quando a referência é positiva (`verificacoes.fcoMaximoSobreEbitda`). Acima disso costuma ser financiamento apresentado no fluxo operacional (Magalu, 5,9x) ou entrada única de caixa (Sanepar: precatório de R$ 4 bi em 2025, FCO de R$ 7,06 bi contra R$ 2,8 bi em 2024, 2,2x; MLAS3, 2,98x). Na 1ª rodada completa as demais empresas ficaram em até 1,5x (mediana 0,65x, p90 1,1x) | `fco_incoerente` |
| Conta obrigatória | Receita, EBIT, lucro, FCO, ativo total, passivo total, caixa e PL presentes | `dados_incompletos_ou_incoerentes` |

## 8. Filtros de qualidade (opcionais)

Aplicados **depois** do ranking, ligados ou desligados pelo usuário na tela. **Não alteram nota nem posição**: apenas retiram nomes. Os limites são parte da metodologia (`qualidade` em `config/acoes-baratas.json`) e aparecem na tela. Os cinco resultados (`passa…`) são calculados na execução e gravados no ranking; o app não recalcula nada.

| # | Filtro | Fórmula | Passa quando | Casos especiais |
|---|---|---|---|---|
| 8.1 | **ROIC** | NOPAT ÷ capital investido | ≥ 10% | Capital investido ≤ 0: reprova |
| 8.2 | **Dívida líquida / EBITDA** | Dívida líquida ÷ EBITDA | ≤ 3,0x | Dívida líquida ≤ 0 (caixa líquido): passa. EBITDA indisponível (sem 7.04.01) ou ≤ 0 com dívida: reprova |
| 8.3 | **Caixa operacional positivo** | FCO 12m | > 0 | — |
| 8.4 | **Cobertura de juros** | EBIT ajustado 12m ÷ |despesas financeiras 12m (3.06.02)| | ≥ 3,0x | Despesa financeira zero: passa. Conta 3.06.02 ausente: reprova (cautela). EBIT ajustado ≤ 0: reprova |
| 8.5 | **Consistência de 5 exercícios** | Entre os 5 últimos DFP **consecutivos** (do mais recente para trás, intervalos de 360 a 372 dias, recebidos até a data de corte): lucro líquido **consolidado** (3.11) positivo e FCO (6.01) positivo | Lucro positivo em ≥ 4 **e** FCO positivo em ≥ 4 | Menos de 5 exercícios disponíveis (empresa nova, buraco na série, conta ausente): reprova. Usa o valor ÚLTIMO de cada DFP, como foi divulgado naquele ano. **Três regras de leitura (1.0.7), todas registradas no exercício ou nos "não lidos":** (a) DFP **sem nenhuma linha consolidada** (empresa sem controladas, ex.: TIMS3, PGMN3, TTEN3 em 2021 e SBSP3 em 2021 e 2022) vale pela individual; (b) coluna ÚLTIMO consolidada **zerada** (lucro e FCO exatamente zero ao mesmo tempo, ex.: TIMS3 em 2024 e 2025) com a individual preenchida vale pela individual (lucro zero com FCO diferente de zero é resultado e fica como está); (c) DFP com **data-base diferente do fim do exercício** (mês e dia da mais recente; ex.: "DFP" de 31/03/2023 da TEND3) é ignorada e listada como não lida, em vez de quebrar a cadeia. Se a DFP tem a consolidada preenchida, a individual nunca a substitui |

## 9. Trilha de auditoria

Cada execução grava `auditoria/acoes-baratas/AAAA-MM-DD/` (data do último pregão) e atualiza `auditoria/acoes-baratas/ultima.json`.

| Arquivo | Conteúdo | Para que serve |
|---|---|---|
| `manifesto.json` | Versão da metodologia; ambiente (Node, commit, execução do GitHub); sha256 do código de cálculo e do código de extração; sha256 da config, dos insumos, do resultado e da memória; **URL + sha256 + tamanho + instante de cada arquivo baixado**; contagens por etapa | Prova de onde veio cada dado e com qual código |
| `config.json` | Cópia exata dos parâmetros | Reproduzir sem depender do estado atual do repositório |
| `insumos.json.gz` | Cada linha das demonstrações usada (empresa, documento, versão, período, conta, descrição, valor em R$, link do documento), composição do capital, preços por classe, liquidez e série de fechamentos | **Tudo que o cálculo consome.** Congela a CVM no momento da execução (a CVM pode reapresentar depois) |
| `resultado.json` | Ranking, etapas e exclusões | É o que o hash do resultado cobre |
| `memoria-de-calculo.json.gz` | Por empresa: fórmula, valor e componentes de cada item (com conta, período e link), as 5 verificações, o valor de mercado por classe, cada exercício da consistência, o rank percentual de cada rendimento | Responde "de onde saiu este número?" |
| `ranking.csv`, `exclusoes.csv`, `mapeamento-ticker-cnpj.csv` | Abertos em planilha (separador `;`, decimal com vírgula) | Revisão humana |
| `LEIA-ME.md` | Roteiro de verificação | — |

### 9.1 Verificação independente (sem internet)

```
npm run verificar-acoes-baratas
# ou, para uma execução específica:
node scripts/acoes-baratas-verificar.mjs auditoria/acoes-baratas/AAAA-MM-DD
```

O verificador (`scripts/acoes-baratas-verificar.mjs`) depende **somente** de `scripts/acoes-baratas-calculo.mjs` e do Node: não importa o leitor da CVM, o histórico de preços nem o orquestrador. Um terceiro audita uma execução com esses dois arquivos e a pasta da execução, sem internet e sem o restante do repositório (há teste automatizado que roda exatamente nessa configuração).

O comando: (1) confere o sha256 de cada arquivo da pasta contra o manifesto; (2) confere os hashes canônicos dos insumos e da config; (3) **recalcula o resultado só com `insumos.json.gz` + `config.json`** e compara com o hash do manifesto; (4) avisa se o código de cálculo atual é diferente do usado na execução. Código de saída 0 = tudo confere. O workflow roda isso antes de publicar.

*O que a verificação prova e o que não prova.* Prova que o ranking é exatamente o que **esta metodologia** produz a partir **destes insumos**, e que nada foi alterado depois. **Não prova** que os insumos refletem fielmente a CVM nem que a metodologia é adequada: para isso existem as conferências 9.2 e 9.3.

### 9.2 Conferência dos insumos contra a fonte (manual, por amostragem)

Modelo para registrar a conferência: `auditoria/acoes-baratas/conferencia-manual-modelo.md`. Para cada empresa da amostra:

1. Em `ranking.csv`, copie o `link_documento`; abra o documento original na CVM.
2. Em `memoria-de-calculo.json.gz`, localize o ticker e leia `fluxos12m` e `saldos`: cada componente informa conta, descrição, período, versão e valor.
3. Compare com o documento: EBIT (3.05), FCO (6.01), PL (2.03), caixa (1.01.01), dívida (2.01.04 e 2.02.01) e lucro consolidado (3.11). Valores em R$ mil no documento = valor da memória ÷ 1.000.
4. Compare o preço de fechamento e a quantidade de ações (composição do capital) com a B3 e a CVM.
5. Refaça em planilha: `FCO/EV`, `EBIT ajustado/EV` e `PL/VM` a partir da memória e confira com `ranking.csv`.

Amostra mínima recomendada antes de publicar: 5 empresas, de setores diferentes, incluindo uma com ON e PN, uma com minoritários relevantes e uma em que o último documento é ITR.

### 9.3 Controle de mudanças

Qualquer alteração de parâmetro, de conta ou de fórmula: (1) muda `config/acoes-baratas.json`/código; (2) sobe `versaoMetodologia`; (3) acrescenta linha em `historicoDeVersoes`; (4) atualiza este documento; (5) roda os testes. O hash do código de cálculo no manifesto torna qualquer mudança não registrada visível.

### 9.4 Testes automatizados

`scripts/acoes-baratas.test.mjs` cobre: estatística (ranks, quantis, volatilidade), leitura de CSV no layout da CVM com fixtures (`scripts/fixtures/cvm`, geradas por `gerar-fixtures-cvm.py`: versão reapresentada ignorada, moeda estrangeira descartada, comparativo PENÚLTIMO ignorado), LTM, cada filtro e seu motivo de exclusão, as verificações de integridade, determinismo de hash, cobertura de juros, consistência, o ciclo completo gravar → verificar → detectar adulteração, a trava de publicação e a trava de coerência do texto público. O cenário "ALFA S.A." foi calculado à mão e o teste confere valor de mercado, EV, EBIT ajustado, rendimentos, ROIC, dívida líquida/EBITDA, cobertura e consistência.

## 10. Limitações conhecidas

1. **Dados reais da CVM.** O código nasceu contra fixtures no layout documentado e, desde a 1.0.1, é validado a cada rodada com os arquivos reais (a 1.0.7 foi a primeira executada com a CVM dentro do ambiente de desenvolvimento, e não só no GitHub). O leitor valida os cabeçalhos e **falha com mensagem explícita** se algo divergir. Os erros de preenchimento dos emissores continuam a surgir um a um (itens 16 e 17b); cada rodada nova pode achar outro.
2. **Caixa operacional não desconta investimentos.** O FCO ignora o capex, o que favorece empresas intensivas em capital (energia, saneamento, mineração, petróleo). As contas de capex não são padronizadas na CVM, e usá-las quebraria a auditabilidade; por isso o indicador é FCO/EV e não *free cash flow*.
3. **Juros no FCO e despesas financeiras.** Conforme a empresa, juros pagos ficam no FCO ou no financiamento; a conta 3.06.02 pode incluir variação cambial. A cobertura de juros herda essa imprecisão.
4. **Equivalência patrimonial e controladas.** O EBIT ajustado retira a equivalência, mas o patrimônio e o EV ainda carregam o valor dessas participações; o ROIC pode ficar subestimado em holdings operacionais.
5. **ROIC e dívida em ponto no tempo.** Usa o capital do fim do período, não a média. Arrendamentos entram na dívida só quando a empresa os classifica em empréstimos e financiamentos.
6. **Classes PN múltiplas.** A CVM informa as preferenciais somadas; elas são avaliadas pelo preço da preferencial mais negociada.
7. **Corte único por indicador.** Os limites de qualidade são os mesmos para todos os setores. Empresas de infraestrutura e concessões convivem com alavancagem maior; o filtro de 3,0x é uma escolha, não uma regra universal.
8. **Setores com contabilidade própria** (construção civil, concessionárias, empresas de saneamento sob contratos de concessão) podem distorcer FCO e EBIT por reconhecimento de receita específico.
9. **Sem proventos.** Dividendos não entram no indicador; preço sem ajuste por dividendos, e desdobramentos só confirmados manualmente em `config/acoes.json`.
10. **Universo = cadastro do app** (uma classe por empresa). Empresas fora do cadastro não são avaliadas.
11. **Não há backtest.** Esta versão não afirma nada sobre desempenho passado do método, e a tela não faz nenhuma promessa de retorno. Qualquer afirmação de desempenho exigiria um backtest com dados *point-in-time*.
12. **Holdings que consolidam empresa listada** repetem o mesmo negócio (caso Gerdau/Metalúrgica Gerdau, tratado em `universo.excluirTickers`). Outros casos só são vistos lendo o ranking; a lista é manual.
13. **Apresentação do fluxo de caixa.** Há empresas cujo FCO reportado inclui fluxos de financiamento (caso verificado: a Magalu reporta ~R$ 15,7 bi de FCO em 2025 com ~R$ 15 bi negativos no financiamento). A verificação `fco_incoerente` barra os casos extremos (> 2x o EBITDA), mas distorções menores passam; o FCO/EV deve ser lido com essa cautela. O limite foi escolhido a partir da distribuição observada na 1ª rodada completa (95 empresas), não de uma regra de mercado.
14. **IFRS 16 (arrendamentos) e varejo.** Os pagamentos de aluguel ficam no fluxo de financiamento, não no FCO, e o passivo de arrendamento pode ficar fora da dívida usada no EV. Isso tende a **inflar FCO/EV de varejistas e empresas com muitas lojas ou frota alugada**. Na primeira execução real, 4 das 15 primeiras eram desse perfil, com FCO/EV de 8% a 180%. É hipótese a confirmar na memória de cálculo de cada uma, e candidata a correção na v1.1 (somar o passivo de arrendamento à dívida e/ou descontar o aluguel pago do FCO).
15. **Classes com direitos econômicos diferentes** (caso TFCO4, onde a ON vale ~1/10 da PN). Hoje a empresa sai quando a parte sem preço passa de 50% das ações (entre 10% e 50% ela fica, avaliada pela outra classe, e o erro possível cresce com o peso e com a diferença de direitos); não há como saber o peso econômico de cada classe só com os dados abertos da CVM.
16. **Quantidade de ações incoerente que não aciona nenhuma trava.** Um erro de quantidade que mantenha o P/VP entre 0,02 e 100 passa (caso LAVV3 na 1ª execução: ações lidas 10x acima do real, P/VP de 15,5 em vez de ~1,5; a causa não foi identificada). Por isso a tela alerta P/VP acima de 10 (`verificacoes.pvpAlerta`), sem excluir. **A partir da 1.0.7 o caso LAVV3 é corrigido** (quantidade 10x o documento anterior, sem evento: seção 5.2), mas só quando há documento anterior que a contradiga; um erro **já presente em todos** os documentos da empresa não é detectável com dados da CVM.
17. **Desdobramento após a data-base do balanço.** Tratado automaticamente: eventos de `desdobramentos` (config) posteriores à data-base do balanço e até a data de corte multiplicam a quantidade de ações (caso ORVR3). Premissa: a quantidade do formulário é a da data-base (evidência: ORVR3). Se alguma empresa informar já pós-evento, marque o evento com `capitalJaAjustado: true`. Só vale para eventos que estejam na config: um desdobramento não confirmado aparece como salto de preço e a empresa sai.
17b. **Quantidade de ações que a CVM traz diferente da real** sem acionar trava. Caso TEND3, **causa achada na 1.0.7**: capital em milhares e tesouraria em unidades no mesmo ITR (seção 5.2). Outros erros do mesmo tipo podem existir; a tela mostra as ações usadas e o balanço de origem, e alerta giro diário acima de 5% do valor de mercado (`verificacoes.giroAlerta`), sinal típico de valor de mercado subestimado.
18. **Cobertura de juros.** A conta 3.06.02 inclui variação cambial e custo de derivativos de várias empresas, o que reduz a cobertura (valores de 0,5x a 2x apareceram até em empresas com caixa líquido).
19. **Dados da CVM podem ter erros de divulgação** que passam pelas verificações; a pasta de auditoria permite localizá-los depois.

## 11. Publicação: aprovação, trava de sanidade e o que ainda é recomendado

**Estado atual.** O responsável aprovou a publicação em 04/10/2026 (`publicacao.aprovadoPeloResponsavel: true` em `config/acoes-baratas.json`, com a aprovação registrada no próprio arquivo). **Não há parecer independente de terceiros**, e isso também está registrado (`parecerIndependente: false`); a D19 recomendava um antes de qualquer ranking de ativos, e a decisão de seguir sem ele é do responsável.

**Trava de sanidade (automática, só para publicar).** Os dados da CVM nunca foram lidos em arquivo real, então a primeira execução pode produzir um resultado claramente quebrado sem derrubar o job (por exemplo, CNPJ não mapeado para boa parte do cadastro). Antes de atualizar o app, o job confere (`publicacao.sanidade`):

| Regra | Padrão | Se falhar |
|---|---|---|
| Mínimo de empresas no ranking | 40 | job falha |
| Máximo de empresas do escopo sem dados utilizáveis (sem CNPJ, sem preço ou reprovadas em `dados_contabeis`; bancos etc. não contam) | 35% | job falha |

Quando a trava barra, a auditoria da execução já foi gravada (e é guardada como artefato do workflow por 30 dias), o app **não é alterado** e o erro diz o que estranhou. Os limites são palpites de partida; ajuste-os depois de ver a primeira execução real.

**O que continua recomendado depois da primeira execução (a trava não substitui):**

- [ ] `mapeamento-ticker-cnpj.csv`: revisar os códigos sem CNPJ ou ambíguos e preencher `config/acoes-baratas-cnpj.json` quando necessário.
- [ ] `exclusoes.csv`: ler as exclusões por `dados_incompletos_ou_incoerentes`, `capital_implausivel`, `balanco_nao_fecha` e `salto_de_preco`. Muitas exclusões desse tipo indicam problema de leitura, não da empresa.
- [ ] **Conferência manual** de pelo menos 5 empresas (seção 9.2), registrada em `auditoria/acoes-baratas/conferencia-manual-modelo.md` e arquivada.
- [ ] Rodar `npm run verificar-acoes-baratas` e arquivar a saída (o workflow já roda antes de publicar).
- [ ] Revisar os textos públicos: a página de Metodologia agora descreve o Top 15 como exceção contábil; as páginas Sobre/FAQ seguem dizendo que o app não faz recomendação, o que é coerente com a natureza declarada. Há teste que **falha** se a publicação estiver ligada e a página de Metodologia voltar a dizer que os simuladores de ativos "não fazem ranking".
- [ ] Parecer independente de especialista em mercado de capitais (recomendado pela D19; não obtido).

**Para desligar** (qualquer motivo): `aprovadoPeloResponsavel: false` e rodar o workflow. O app volta a mostrar "em validação" e deixa de receber nomes de ações.

### 11.1 Acesso por código mensal (D50)

O ranking **não vai no arquivo do app**. O job grava o cabeçalho em `webapp-src/src/data/acoesBaratas.json` e a lista completa em `dados-privados/acoes-baratas.json`, que só a função `api/top15.ts` lê, e só depois de conferir o código do mês. Esta pasta e `auditoria/` contêm o ranking: **o repositório precisa ser privado**.

**Como virar o código do mês (leva 2 minutos):**

1. Gere um código novo: `npm run codigo-top15` (ou peça a quem tiver o projeto aberto). Formato `CI-XXXX-XXXX`.
2. Na Vercel: projeto → **Settings → Environment Variables**.
   - Primeira vez: **Add** `TOP15_CODIGOS` com o código, em **Production**.
   - Nos meses seguintes: **edite** o valor para `CODIGO-NOVO,CODIGO-ANTIGO` (os dois, separados por vírgula).
3. **Deployments → ⋯ → Redeploy.** A variável só vale em um deploy novo.
4. Divulgue o código novo no Instagram (@acarteiraideal).
5. Alguns dias depois, remova o antigo (deixe só o novo) e faça um novo Redeploy.

Opcional: `TOP15_SAL` (qualquer texto aleatório) reforça o hash do IP. Com as variáveis de Redis do projeto presentes, o limite de tentativas é compartilhado entre os servidores; sem elas, vale um limite mais fraco por servidor.

**Cada classe tem o seu código (D66):** este passo é só das ações. O Top 15 de FIIs usa a variável `TOP15_FIIS_CODIGOS` (código gerado com `npm run codigo-top15 -- --classe fiis`); um código não abre a lista do outro.`n`n**Se o código vazar:** troque `TOP15_CODIGOS` por um código novo (só ele), faça Redeploy e divulgue o novo. O código antigo para de funcionar e, no aparelho de quem o tinha salvo, o app o apaga sozinho e volta a pedir.

**Para desligar a restrição** (modo aberto): `acesso.restritoPorCodigo: false` em `config/acoes-baratas.json` e rodar o workflow. **Para tirar a lista do ar:** `aprovadoPeloResponsavel: false` e rodar o workflow.

**Como testar:** a caixa só pede o código depois que o workflow roda a primeira vez com sucesso (até lá mostra "em validação"). Depois: Simule Ações → Top 15 mais baratas → digite o código.

## 12. Histórico de versões

| Versão | Data | Mudança |
|---|---|---|
| 1.0.7 | 2026-10-06 | Primeira rodada com CVM real no ambiente de desenvolvimento. TEND3 (tesouraria em unidades num capital em milhares: 57,4 mi → 122,5 mi de ações), LAVV3 (quantidade 10x a dos documentos anteriores: 1.954 mi → 195,4 mi), exercícios antigos de TIMS3, PGMN3, TTEN3 e SBSP3 (DFP só individual, e consolidada zerada na TIMS3 em 2024 e 2025), "DFP" de 31/03/2023 da TEND3 ignorada. Leitura de zip também no Windows. |
| 1.0.6 | 2026-10-05 | Análise do ranking.csv da 1.0.5: caixa operacional máx. 2x o EBITDA (Sanepar, Multilaser); desdobramento posterior ao balanço ajusta as ações (ORVR3); classe sem preço até 50%; alerta de giro alto; ações usadas e exercícios não lidos na tela; CNPJ manual de CSNA3 e CMIN3. |
| 1.0.5 | 2026-10-04 | Análise do ranking.csv e do exclusoes.csv da 1.0.3: detecção automática da unidade da quantidade de ações (31 de ~100 empresas informavam em milhares); unit nunca é preço de classe; classe sem preço com mais de 10% das ações exclui; desdobramentos de SBSP3, SIMH3 e ORVR3; alerta de P/VP > 10; FCA de dois anos; motivo real de "sem preço". |
| 1.0.4 | 2026-10-04 | SEER3 mostrava lucro positivo em 0 de 5 exercícios (as fontes dão 2 de 5) e lucro de 12 meses de R$ 57 mi: a DFP da CVM trazia a conta 3.11.01 zerada em todos os exercícios. O lucro de referência dos filtros passa a ser o consolidado (3.11); o dos controladores fica só como informação. |
| 1.0.3 | 2026-10-04 | Conferência com fontes públicas: nova verificação `fco_incoerente` (FCO > 3x o EBITDA), a partir do caso MGLU3; a memória de cálculo na tela passa a mostrar a composição dos 12 meses e o lucro e o caixa de cada exercício. |
| 1.0.2 | 2026-10-04 | VALE3 informa a quantidade de ações em milhares (4.072.366 em vez de ~4,07 bilhões) e era excluída por capital implausível. Criado o ajuste manual e registrado de unidade (`capital.ajustesManuais`), aplicado só à VALE3 (×1000). |
| 1.0.1 | 2026-10-04 | Primeira execução real: (1) corrige o EBITDA (a depreciação da DVA vem negativa e era subtraída), que inflava a dívida líquida/EBITDA e o filtro de qualidade correspondente; a nota e a ordem do ranking não mudam; (2) exclui a holding GOAU4; (3) a exclusão por capital implausível passa a mostrar os números usados. |
| 1.0.0 | 2026-10-04 | Versão inicial: universo, filtros, indicador composto (PL/VM, FCO/EV, EBIT ajustado/EV), ranking por média de ranks percentuais, filtros de qualidade opcionais (ROIC, dívida líquida/EBITDA, FCO, cobertura de juros, consistência de 5 exercícios), trilha de auditoria e verificação independente. |
