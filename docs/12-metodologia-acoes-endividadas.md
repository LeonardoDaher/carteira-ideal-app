# 12. Metodologia: Top 15 empresas mais endividadas (D94)

Versão da metodologia: **1.1.0** (`config/acoes-endividadas.json`, fonte única dos parâmetros próprios). Ranking aberto (sem código), na aba "Top 15 mais endividadas" do Simule Ações. **Publicado em 17/10/2026**, por aprovação expressa do responsável (`publicacao.aprovadoPeloResponsavel` é `true`; v1.1.0). Sem parecer independente de terceiros (D22).

## 1. O que é, e o que não é

Ordena as empresas pela **dívida líquida ÷ EBITDA** dos últimos 12 meses: quantos anos de geração de caixa operacional (antes de impostos e juros) seriam necessários para pagar a dívida líquida. É um fato contábil, igual para todas as empresas, sem nota nem opinião nossa.

**Não é** recomendação de investimento, nem sinal de risco de calote. Dívida alta convive com setores de investimento pesado (energia, saneamento, concessões), com dívida longa e barata. A medida **não captura prazo, custo, moeda nem garantias da dívida**, dívida de arrendamentos e de fornecedores fica fora da conta, e o EBITDA de 12 meses pode estar deprimido ou inflado por um evento pontual.

## 2. De onde vêm os dados

Sem rede. Parte dos **mesmos insumos da triagem de ações baratas** (docs/09): as demonstrações da CVM (DFP e ITR) congeladas na última auditoria completa dela (`auditoria/acoes-baratas/<data>/insumos.json.gz`) e, todo dia útil, o preço do dia (`historico/acoes.json`, Boletim de Preços da B3). A leitura contábil é a de `calcularFundamentos` (`scripts/acoes-baratas-calculo.mjs`): **a mesma empresa tem o mesmo número nas duas listas**.

## 3. Universo e filtros

Valem os de `config/acoes-baratas.json`: cadastro curado (um código por empresa), fora Bancos, Seguros e previdência e Bolsa/holdings/serviços financeiros (dívida é a matéria-prima do negócio deles), fora duplicidade econômica (GOAU4), fora quem não tem CNPJ mapeado ou preço recente, e **liquidez média do emissor de pelo menos R$ 3 milhões por dia** (21 pregões, somando as classes). Depois, a leitura contábil exige demonstração com no máximo 200 dias e dados coerentes (balanço e DRE fecham, descrição das contas, quantidade de ações plausível).

**O que NÃO se aplica aqui, de propósito:**
- **Lucro de 12 meses positivo** e **volatilidade** (decil mais volátil): empresa com prejuízo ou muito volátil é justamente a que importa para quem olha endividamento.
- **Caixa operacional ≤ 2× o EBITDA** (`fcoMaximoSobreEbitda`): protege o indicador caixa operacional ÷ EV das ações baratas, que não é usado aqui, e derrubava AMER3, BHIA3, MGLU3 e SAPR11 (financiamento de clientes ou evento não recorrente dentro do fluxo operacional). Desligada só nesta lista; as demais verificações de integridade continuam.
- Os filtros de qualidade opcionais (ROIC, dívida líquida/EBITDA máxima, consistência de 5 exercícios) também não valem: são para a lista de baratas.

## 4. O cálculo

| Item | Conta |
|---|---|
| Dívida bruta | empréstimos e financiamentos de curto prazo (2.01.04) + longo prazo (2.02.01) |
| Caixa | caixa e equivalentes (1.01.01) + aplicações financeiras (1.01.02) |
| **Dívida líquida** | dívida bruta − caixa |
| EBIT ajustado | EBIT (3.05) − equivalência patrimonial − recuperabilidade de ativos − outras receitas e despesas operacionais |
| **EBITDA** (12 meses) | EBIT ajustado + \|depreciação e amortização (DVA 7.04.01)\| |
| **Indicador** | dívida líquida ÷ EBITDA |

Os valores de 12 meses são montados como último exercício + acumulado atual − acumulado do ano anterior.

**Ordenação:** decrescente pelo indicador; empate pelo código. A lista mostra os 15 primeiros; o arquivo guarda o ranking inteiro.

**Casos de borda** (cada um com código e motivo):
- **Caixa maior que a dívida** (dívida líquida ≤ 0): fora, código `caixa_liquido`.
- **EBITDA não calculável** (DVA sem a linha de depreciação): fora, código `sem_ebitda`.
- **Dívida líquida positiva e EBITDA zero ou negativo:** a razão não existe. A empresa vai para a **lista "sem EBITDA positivo"**, ordenada pela dívida líquida e **fora da ordem numérica** (é, por definição, pior que qualquer razão, mas não há número honesto para colocá-la na fila).

## 5. Trilha de auditoria

Desenho da D89: o ranking é recalculado **todo dia útil** (workflow "Atualizar Top 15 Empresas Endividadas", 00h30 de Brasília, depois das ações baratas); a **pasta completa** `auditoria/acoes-endividadas/<data>/` só é gravada na primeira execução do mês, ou quando mudam: os parâmetros (`config/acoes-endividadas.json` ou `config/acoes-baratas.json`), o código de cálculo (este ou o das ações baratas) ou a **auditoria de origem** (as ações baratas regravaram a delas, com balanços novos). Opção "auditoria completa" na execução manual.

- **Pasta completa:** `manifesto.json` (origem dos insumos, hashes, código), `config.json`, `config-base.json` (cópia do config das ações baratas), `insumos.json.gz`, `resultado.json`, `memoria-de-calculo.json.gz` (cada conta da CVM e cada fórmula, por empresa), `ranking.csv`, `sem-ebitda-positivo.csv`, `exclusoes.csv`, `LEIA-ME.md`.
- **Dias comuns:** reaproveita os insumos congelados da pasta do mês, troca só o preço, **confere de forma independente em memória** (relê insumos e configs, refaz o cálculo do zero, compara os hashes; se divergir, nada é publicado) e publica sem pasta nova. O cabeçalho público leva a impressão digital do dia, `modoAuditoria` e `auditoriaCompletaEm`.
- **Verificação independente, sem internet:** `node scripts/acoes-endividadas-verificar.mjs <pasta>` (ou `ultima`). Confere o sha256 de cada arquivo, o hash canônico dos insumos e das duas configs, e **recalcula** o resultado. Depende só de `acoes-endividadas-calculo.mjs` e do cálculo contábil das ações baratas. **Não prova** que os insumos reproduzem fielmente a CVM (isso é a conferência manual de docs/09, seção 9.2).
- **Trava de sanidade** (só na publicação): menos de 40 empresas avaliadas, ou mais de 35% do escopo sem dados utilizáveis, derruba o job; a auditoria completa fica gravada, o app não muda e o GitHub envia e-mail.

## 6. O que o preço muda, e o que não muda

O indicador (dívida líquida ÷ EBITDA) **vem só dos balanços**: não muda de um dia para o outro. O preço do dia entra no **valor de mercado**, na **liquidez** (quem passa ou sai do corte de R$ 3 milhões por dia) e nas verificações de capital. Por isso a lista é atualizada todo dia útil (mesma cadência dos outros Top 15), mas o ranking só se mexe de verdade quando sai balanço novo, na primeira execução do mês seguinte à entrega.

## 7. Limitações conhecidas

- **Dívida só de empréstimos e financiamentos** (inclui debêntures, que a CVM classifica ali): arrendamentos, fornecedores e passivos financeiros fora dessa conta não entram.
- **EBITDA de 12 meses** pode estar deprimido (ciclo ruim) ou inflado (venda de ativo); a lista não distingue.
- **Empresas em recuperação judicial ou sem preço recente** na B3 (por exemplo, sem negociação no último mês) saem com o motivo `sem_preco`.
- Quantidade de ações em milhares ou erros de preenchimento na CVM são tratados como nas ações baratas (ajustes registrados na memória de cálculo).
- Balanços novos só entram na primeira execução do mês seguinte, o mesmo ritmo das ações baratas.
- Setores de investimento pesado (energia, saneamento, concessões) aparecem com razões altas por natureza; olhe a medida com o setor em mente.
