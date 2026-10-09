# Passagem para o chat (Carteira Ideal) — estado em 09/10/2026, após a D77

Cole este arquivo no início do chat e anexe `docs/06-proximos-passos.md`, `docs/07-registro-de-decisoes.md` (a partir da D57), `docs/02-metodologia.md`, `docs/09-metodologia-acoes-baratas.md`, `docs/10-metodologia-fii-baratos.md` e `docs/11-metodologia-top15-etfs-bdrs.md`. O repositório é a memória do projeto: tudo abaixo está no GitHub (`LeonardoDaher/carteira-ideal-app`, branch `main`).

## 1. O que existe e está no ar

### Rankings Top 15 (D49 a D72)
- **Top 15 ações baratas** (D49–D58): job mensal com auditoria, verificação independente, acesso por código. `aprovadoPeloResponsavel` das ações **não deve ser alterado** sem pedido explícito.
- **Top 15 FIIs baratos, Tijolo e Papel** (D59–D66, metodologia **1.5.0**): job "Atualizar FIIs Baratos" (dia 21 às 06h UTC e sob demanda), auditoria em `auditoria/fii-baratos/<data>/`, lista "a conferir", conferência manual com validade de 90 dias, preço diário da B3 (com complemento da brapi). Publicado em 07/10/2026 (Simule FII, aba "Top 15 mais baratos"), só com código.
- **Top 15 ETFs mais negociados e Top 15 BDRs com maior desconto de preço** (D70, metodologia **1.1.0** cada): job "Atualizar Top 15 ETFs e BDRs" (dia 22 às 06h UTC e sob demanda), auditoria em `auditoria/top15-etfs/` e `auditoria/top15-bdrs/`, verificador `scripts/top15-mercado-verificar.mjs`. Publicados em 08/10/2026. ETFs: aba "Top 15 mais negociados" no Simule ETF, aberta (mais negociado é liquidez, não qualidade nem custo; ranking por taxa de administração não é viável porque a CVM não traz a taxa em dado aberto). BDRs: aba "Top 15 maior desconto" no Simule BDR, **com código próprio**; desconto é de **preço** contra o maior fechamento de 252 pregões, não de valor. **A variável `TOP15_BDRS_CODIGOS` foi criada na Vercel e o Redeploy feito** (conferido em 09/10/2026: `POST /api/top15-bdrs` responde 401 "Código inválido ou vencido" a um código falso, não 503). 10 BDRs seguem em "a conferir" (NFLX34, BKNG34 e outros), a maioria por salto de preço que parece desdobramento ainda não confirmado em `config/bdrs.json`.
- **Top 15 FIIs, ações e BDRs mais negociados** (D71, metodologia **1.0.0** cada): mesma liquidez dos ETFs (mediana do volume diário dos últimos 21 pregões), **abertos e sem código**; publicados em 08/10/2026 nas abas "Top 15 mais negociados/negociadas" dos Simule FII, Ações e BDR.
- **Top 15 do IFIX e do Ibovespa** (D72, metodologia **1.0.0** cada): os 15 maiores pesos da carteira teórica oficial, baixada da API pública da B3 (`GetPortfolioDay`) a cada execução (única etapa com rede; a auditoria guarda o sha256 da resposta e a verificação refaz o ranking sem internet). Abertos e sem código, publicados em 08/10/2026. Se a B3 falhar, os outros rankings são guardados e o job termina com erro (e-mail).

### Motor de perfis revisado (D73, 09/10/2026) — `webapp-src/src/domain/engine.ts`
Uma revisão crítica rodou o motor com as 2.187 combinações de respostas x 3 suitabilities e achou sete problemas; todos corrigidos. Resumo (detalhe em `docs/07` D73 e `docs/02`):
- **Capacidade real define só o vetor** (baixa = Defensivo, média = Equilibrado, alta = Crescimento Pleno; veto = Defensivo). **O suitability é o teto de risco da carteira** (`TETO_RISCO_SUITABILITY`: Conservador 10/20/30%, Moderado 35/45/55% em curto/médio/longo, Arrojado sem teto; **cripto só para Arrojado**). Antes, os perfis 2, 3 e 6 nunca apareciam; agora os **9 Perfis-Mãe são todos alcançáveis**.
- **Pilar 3 manda no prazo:** [A] (saque em até 24 meses) usa o modelo de curto prazo; [B] (3 a 5 anos) derruba o longo para médio.
- Calibradores que aumentam risco (Pilar 4 [C] e Pilar 6 [C]) não rodam em carteira vetada/Defensiva; o Pilar 4 [C] também não roda se a reação do suitability for ansiosa.
- **Pilar 7 não pontua mais** (score de 6 a 18; faixas baixa 6–9, média 10–14, alta 15–18). Pergunta reescrita para um conceito só: "Como você declara o Imposto de Renda hoje?" ([A] completa, [B] simplificada, [C] isento ou não sabe); sucessão virou aviso por idade (`IDADE_ALERTA_SUCESSAO` = 50); PJ deixou de ser coberto.
- Piso de liquidez de 20% (sem reserva) agora é cumprido (antes ficava em 17% a 19%); avisos para respostas contraditórias e para quitar dívida cara (Pilar 2 [A]). O **veto continua binário**.
- Os tetos, as faixas e a idade de 50 anos são **parâmetros de produto escolhidos pelo assistente**: pedem revisão do responsável e do parecer independente (D22).

### Meu Mês Supermercado (D74 a D76, 09/10/2026)
O Meu Mês tem **duas abas**: "Contas do mês" (como sempre) e "Supermercado" (nova), sem IA.
- **D74:** a pessoa escreve (ou dita pelo microfone do teclado) a lista; `domain/supermercado.ts` separa em itens (vírgula, ponto e vírgula, quebra de linha, " e ", " + "), lê a quantidade ("2 litros de leite", "3kg", "meia dúzia"), sugere a categoria por dicionário de palavras (11 categorias na ordem dos corredores) e cada item vira uma bolinha para ticar. Item igual a outro não comprado não duplica. Fica **só no aparelho** (chave `carteiraideal.supermercado`, separada do orçamento). Botões: tirar da lista o que já comprou, desmarcar tudo, apagar a lista (os de apagar pedem confirmação).
- **D75:** botão ✎ de **editar** por item (nome, quantidade, categoria). **Nome com vírgula separa em vários itens** (conserta o ditado que vem tudo junto). "Apagar a lista inteira" em amarelo.
- **D76:** botão verde **"Enviar o que falta pelo WhatsApp"** (com a logo): abre `wa.me` com só os itens **não ticados**, por categoria; some se nada falta. O texto só sai do aparelho quando a pessoa toca no botão; a Política de Privacidade cita isso.
- **Limites:** o dicionário é finito (o que não casa cai em "Outros"); não sincroniza entre aparelhos nem pessoas. **"Organizar com IA"** foi discutido e **adiado**: exigiria função nova na Vercel, chave de API, limite por pessoa e aviso de privacidade (o texto sairia do aparelho). O responsável quer testar o que existe antes.

- **D77:** a página inicial, o FAQ, a página `/meu-mes/` e o atalho do manifest passaram a citar a aba Supermercado (e que só o texto enviado pelo WhatsApp sai do aparelho).

### Decisões anteriores recentes
D67 Simule Imóvel com seleção de caminhos, D68 cartão "Simule Bens", D69 locação como quinto caminho no carro e na moto.

## 2. Como o acesso por código funciona (D50, D65, D66, D70)
- O arquivo público do app (`webapp-src/src/data/*.json`) traz **só o cabeçalho**, sem nenhum código de ativo (o job garante e há teste). A lista completa fica em `dados-privados/` e só as funções `api/top15.ts` (ações), `api/top15-fiis.ts` (FIIs) e `api/top15-bdrs.ts` (BDRs) a entregam, depois de validar o código do mês. ETFs, "mais negociados", IFIX e Ibovespa não têm código.
- **Um código por classe:** ações em `TOP15_CODIGOS`, FIIs em `TOP15_FIIS_CODIGOS`, BDRs em `TOP15_BDRS_CODIGOS` (variáveis da Vercel, nunca no repositório). Um não abre o outro. Sem a variável da classe, a porta fica fechada (503).
- Gerar: `npm run codigo-top15 -- --classe acoes`, `-- --classe fiis` ou `-- --classe bdrs`. O código nunca é gravado em arquivo nem enviado no chat. Dois códigos separados por vírgula na variável permitem a virada do mês.
- Limite: 10 tentativas erradas por IP a cada 15 minutos (hash do IP, Upstash/Redis; compartilhado entre as portas).
- No aparelho, cada lista guarda o código em chave própria (`carteiraideal.top15.codigo`, `...top15fiis.codigo`, `...top15bdrs.codigo`). A tela confere primeiro o código salvo ("Verificando o código salvo neste aparelho…") e só depois mostra o portão.

## 3. Pendências do responsável (nada disso o assistente pode fazer por ele)
1. **Criar `TOP15_FIIS_CODIGOS` na Vercel** (Settings → Environment Variables → Production), com código novo (`-- --classe fiis`), e fazer **Redeploy**. Até lá a lista de FIIs fica fechada. Se o código das ações ainda for o de teste, trocar também `TOP15_CODIGOS`. *(A dos BDRs já foi feita.)*
2. **Abrir a lista de BDRs com o código verdadeiro** (aba "Top 15 maior desconto" do Simule BDR) para conferir de ponta a ponta.
3. **Confirmar desdobramentos dos BDRs em conferência** olhando os avisos de evento corporativo da B3 e registrando em `config/bdrs.json → desdobramentos` (formato no `_leia` do arquivo). Sem isso, esses BDRs (NFLX34 e outros) ficam fora do ranking.
4. **Parecer independente** (D22): o responsável declarou que ele mesmo é o especialista; o registro disso é dele (o assistente não avalia o mérito jurídico). Vale para FIIs, ações, ETFs e BDRs **e agora também para o desenho novo do motor de perfis (D73)**.
5. **Rever os parâmetros do motor (D73):** tetos de risco, faixas de capacidade, idade do aviso de sucessão; decidir se renomeia o perfil 3 "Conservador Acúmulo" (sai com carteira bem conservadora por causa do teto).
6. **Testar o Meu Mês Supermercado no celular** depois que a Vercel publicar: ditado do teclado, ✎ editar, ticar, WhatsApp (conferir a mensagem e que o item ticado fica de fora) e layout dos botões. Conferir também no ar a página de Privacidade, a página inicial (FAQ novo) e `/meu-mes/`.
7. Divulgar cada código no Instagram `@acarteiraideal`.
8. Acompanhar: o job de FIIs no dia 21 e o de ETFs/BDRs no dia 22 (e-mail do GitHub se falhar), as conferências manuais dos FIIs (vencem em 05/01/2027), RZAT11 e o preço diário (workflow "Atualizar preço diário dos FIIs", 22h15).

## 4. Como o trabalho é entregue (importante para não voltar ao zip nem desfazer o trabalho do outro lado)
- No **Claude Code (desktop)** o assistente tem Git e GitHub CLI no computador (`C:\nodeportatil`), clone em `C:\nodeportatil\repo` (Node portátil em `C:\nodeportatil\node-v22.23.3-win-x64`; **não há Python**), e faz commit e push na `main`, dispara workflows e lê logs. O assistente **só faz commit e push quando o responsável pede**, cada vez. Para revogar o acesso: `gh auth logout` ou github.com/settings/applications.
- No **chat comum** o assistente **não** acessa o GitHub; o responsável sobe os arquivos que o chat gera ("Add files via upload"). **As duas frentes mexem no mesmo repositório.** Em 07–08/10 o chat subiu D67, D68 e D69 enquanto o Code trabalhava na D70, e a pasta de trabalho do Code estava desatualizada: se o Code enviasse como estava, desfaria o trabalho do chat. Por isso:
  - **Números de decisão:** conferir o último `## D..` em `docs/07-registro-de-decisoes.md` do GitHub antes de numerar a próxima (**a próxima livre é a D78**).
  - **O Code sempre traz a versão do GitHub antes de enviar** (`git pull --ff-only`) e tem uma trava que recusa enviar se o GitHub mudou um arquivo que ele ia enviar.
  - **No chat:** ao receber o zip do projeto, usar sempre o zip **mais recente do GitHub** (Code → Download ZIP) e dizer o número da última decisão.
- Regra prática: mudanças de código e dados no Code; decisões, texto, estratégia e conteúdo no chat. O zip do GitHub vem sem `.git` e sem `node_modules` (normal); o chat não roda `npm install`.
- Antes de qualquer envio: `npm test` (web: **1.561 testes** em 76 arquivos; scripts: 366 na última conferência), `tsc -b` limpo, e os workflows rodam sozinhos os testes da própria metodologia.
- Armadilha de ambiente: scripts de edição passados pelo shell com `\d`, `\s` ou aspas dentro de heredoc podem perder barras e apóstrofos; para edições grandes, escrever o script em arquivo (`.mjs`) e rodá-lo, e **sempre testar a regex** (um `/\s+/` virou `/s+/` e só os testes pegaram).

## 5. Regras de trabalho que o responsável pediu
- Não mudar `aprovadoPeloResponsavel` das **ações**; o dos FIIs está `true` desde a D65; o dos ETFs, BDRs, "mais negociados", IFIX e Ibovespa está `true` desde 08/10/2026.
- Não divulgar, gerar em arquivo nem escrever o código de acesso em lugar nenhum.
- Toda mudança de parâmetro dos rankings: subir `versaoMetodologia`, registrar em `historicoDeVersoes`, atualizar o doc 09/10/11 e a decisão (D-número) em `docs/07`.
- Mudança de cálculo: teste novo + **teste de mutação** (introduzir o defeito e ver o teste falhar). Já feito na D70 (31 mutações), D71 (15), D72 (34), D73 (17), D74 (19), D75 (12) e D76 (7).
- Conferência manual valida o **dado** (cota, valor patrimonial, rendimento, desdobramento), nunca o mérito do ativo; sempre com data, fonte e prazo.
- Em dúvida entre publicar ou segurar, segurar e perguntar. Relatar resultado de teste e de workflow como realmente foi.

## 6. Limitações conhecidas (resumo; detalhe nos docs 02, 10 e 11)
- Rendimento por cota dos FIIs é **estimado**; o informe da CVM tem anomalias (por isso os alertas e a lista "a conferir").
- A B3 não traz CVBI11, MALL11 e BBPO11 no boletim diário; o complemento da brapi cobre.
- Mais negociado (ETF, FII, ação, BDR) é liquidez, não qualidade. Desconto de BDR é de preço (inclui o dólar), não de valor. Peso no índice (IFIX, Ibovespa) não é qualidade.
- Todos os rankings são triagem objetiva por fórmula, igual para todos, e **não** são recomendação de investimento.
- Motor de perfis: veto binário (qualquer [A] nos Pilares 1 a 3 leva ao Defensivo); P1 e P4 repetem perguntas do suitability (reserva e reação), e a incoerência só gera aviso.
- Lista de supermercado: dicionário de categorias finito, sem sincronização entre aparelhos.

## 7. Próximas ideias (nenhuma iniciada)
- **Organizar com IA** na lista de supermercado (só se o ditado continuar ruim depois do teste).
- BDRs com fundamentos (P/L etc.) a partir de uma fonte externa dos balanços das empresas estrangeiras (projeto grande).
- ETFs com taxa de administração mantida à mão e conferida (tabela com fonte e data, no molde da conferência dos FIIs).
- Divulgação mensal automática do ranking (texto para o Instagram, sem código).
- Painel simples de acessos por mês (já existe contagem em `top15:acessos:AAAA-MM`, `top15fiis:acessos:AAAA-MM` e `top15bdrs:acessos:AAAA-MM`).
- Veto graduado no motor de perfis (hoje binário), com log de qual regra foi acionada; exigiria documentar a justificativa.
