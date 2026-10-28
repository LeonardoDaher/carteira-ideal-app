# 7. Registro de decisões

Cada decisão importante, com data, motivo e consequência. Acrescente novas decisões no final.

---

### D1 · Motor de decisão executado no servidor (22/09/2026)

**Contexto.** O app era um arquivo HTML único rodando 100% no navegador. Uma análise do arquivo publicado mostrou as 9 carteiras-modelo, os pesos das respostas e os 3 pilares de veto em texto legível para qualquer pessoa.

**Decisão.** Mover a execução do `engine.ts` para uma função serverless (`api/recomendacao.ts`). O app envia as respostas e recebe só o resultado.
**Consequência.** A metodologia deixou de estar no código entregue ao navegador (verificado no build). O app passou a depender de internet para calcular o resultado, com tela de erro e "Tentar novamente".

### D2 · Hospedagem na Vercel em vez do GitHub Pages (22/09/2026)

**Contexto.** O GitHub Pages só serve arquivos estáticos (não executa a API) e, no plano gratuito, exige repositório público, o que exporia o código-fonte do motor.

**Decisão.** Publicar na Vercel, conectada a um repositório GitHub privado. O GitHub passa a só guardar o código; a Vercel publica.
**Consequência.** Deploy automático a cada alteração, histórico de versões com retorno instantâneo, repositório privado. Plano gratuito limitado a uso não comercial.

### D3 · Repositório novo e privado (22/09/2026)

**Contexto.** O repositório antigo (`LeonardoDaher/Carteira-Ideal`) era público e já continha a metodologia. Nenhum link estava divulgado.

**Decisão.** Tornar o antigo privado e criar `carteira-ideal-app`, privado desde o início, enviando os arquivos pelo navegador.
**Consequência.** A partir daqui o código fica protegido. Cópias feitas enquanto o repositório antigo era público não podem ser recolhidas.

### D4 · Landing e app no mesmo projeto, mesma estrutura de endereços (22/09/2026)

**Decisão.** Manter a landing na raiz e o app em `/app`, montados pelo `scripts/build-site.mjs`.
**Consequência.** O botão da landing (`./app/`) e a lógica de "já respondeu" do `script.js` continuam funcionando sem alteração.

### D5 · Link temporário do Claude (Artifact) descartado como hospedagem (22/09/2026)

**Motivo.** O ambiente de publicação do Claude bloqueia conteúdo de terceiros, incluindo vídeos do YouTube, o que quebraria as trilhas de aprendizagem. Também não executaria a API protegida.

### D6 · Metodologia documentada em Markdown no repositório (22/09/2026)

**Contexto.** O arquivo de metodologia do projeto estava em texto (Markdown) com extensão `.docx`, o que impedia abri-lo no Word.

**Decisão.** A versão oficial passa a ser `docs/02-metodologia.md`, versionada junto com o código. Uma cópia em Word é gerada a partir dela quando necessário.
**Regra.** Qualquer mudança no `engine.ts` deve vir acompanhada da atualização desse documento e de uma entrada neste registro.

### D7 · Extensão `.js` obrigatória nos imports da API (22/09/2026)

**Contexto.** Após o primeiro deploy na Vercel, toda chamada a `/api/recomendacao` retornava 500 com `Erro [ERR_MODULE_NOT_FOUND]`. O app funcionava perfeitamente em `npm run dev` e em todos os testes locais — o erro só aparecia em produção.
**Causa.** A Vercel compila cada arquivo da função individualmente (não empacota tudo num só arquivo, diferente do Vite) e carrega o resultado com o carregador nativo de módulos ES do Node, que **exige a extensão `.js` explícita** em toda importação relativa. Os imports em `api/recomendacao.ts` e `api/_validacao.ts` apontavam para `../webapp-src/src/domain/engine` e `../webapp-src/src/domain/types` sem extensão — válido para o Vite, inválido para o Node em produção.

**Decisão.** Adicionar `.js` no final desses três imports (mesmo apontando para arquivos `.ts` — o TypeScript, em modo `bundler`, aceita essa forma e resolve corretamente para o `.ts` de origem).
**Verificação.** Reproduzido o erro exato fora da Vercel, compilando os arquivos individualmente e executando com o carregador nativo do Node (mesma mecânica da Vercel). Confirmado que o erro desaparece com a correção. Validado em produção: questionário completo até o resultado, sem erros.
**Lição para o futuro.** Qualquer novo arquivo dentro de `api/` que importe algo de fora da própria pasta `api/` precisa da extensão `.js` no import, mesmo com o arquivo de origem sendo `.ts`.

### D8 · Domínio próprio conectado (22/09/2026)

**Contexto.** O site estava no ar em `carteira-ideal-app.vercel.app`, funcional mas com endereço longo e citando a plataforma de hospedagem.

**Decisão.** Registrado `carteiraideal.app.br` no Registro.br. Conectado ao projeto na Vercel via um registro DNS tipo A (`@` → `216.198.79.1`), mantendo os servidores DNS do próprio Registro.br (sem delegar para os nameservers da Vercel).
**Consequência.** HTTPS válido emitido automaticamente pela Vercel para o domínio novo. `og:image` e `og:url` em `index.html` atualizados para `https://carteiraideal.app.br/`, testado na prévia do WhatsApp. Link da bio do Instagram atualizado e testado dentro do próprio app do Instagram.
**Nota para o futuro.** O endereço antigo `carteira-ideal-app.vercel.app` continua existindo e resolvendo (a Vercel mantém o domínio `.vercel.app` ativo por padrão) — não precisa ser removido, mas não deve mais ser divulgado.

### D9 · Aba "Simule FII" com dados da CVM atualizados uma vez por mês (24/09/2026)

**Contexto.** Nova aba (🏢 "Simule FII") para o cliente ver, para os 10 maiores FIIs do IFIX, a cotação, o último rendimento, a média dos últimos 3 meses (retirada depois, ver D10) e a renda mensal estimada para 10 a 5.000 cotas (ou uma quantidade livre).

**Fontes avaliadas.** bolsai Pro (R$ 49/mês, rendimento anunciado na B3, sem atraso), brapi Pro (R$ 1.399,90/ano) e CVM + brapi gratuito (R$ 0).

**Decisão.** CVM + brapi gratuito. Rendimento estimado a partir do Informe Mensal Estruturado da CVM (DY do mês × valor patrimonial da cota), cotação pela brapi no plano gratuito. Custo zero, com a limitação exibida no app.

**Mecanismo.** Um job do GitHub Actions roda no dia 20 de cada mês (`scripts/atualizar-rendimentos-fii.mjs`), gera `webapp-src/src/data/rendimentosFii.json` e faz commit; a Vercel republica sozinha. O app lê um arquivo estático: nenhuma chamada externa sai do navegador do cliente, nenhuma função serverless nova, a API continua sem gravar nada. O histórico do Git registra qual dado estava no ar em cada mês.

**Salvaguardas.**
- O job só publica se `config/fiis-ifix.json` estiver marcado `conferidoNaB3: true`.
- Rendimento fora da faixa de 0,1% a 3% ao mês sobre a cota não é publicado (protege contra escala trocada ou cotação errada).
- Menos de 8 fundos válidos = o job falha sem alterar o arquivo, e o app segue com os dados do mês anterior.

**Ressalvas exibidas ao cliente.** Aviso de atraso da CVM (1 a 2 meses) com o mês do último rendimento, frase padrão ANBIMA de rentabilidade passada, observação sobre isenção de IR condicionada à lei e o aviso educacional padrão. Ordem dos fundos = participação no IFIX, nunca por maior rendimento.

**Manutenção.** A cada rebalanceamento do IFIX (jan, mai, set), conferir a carteira teórica na B3 e atualizar `config/fiis-ifix.json`.

**Evolução possível.** Se o atraso da CVM incomodar os usuários, trocar a fonte do rendimento pela bolsai Pro mudando só o script; a tela e o formato do JSON não mudam.

**Execução em 24/09/2026.**
- Lista revisada pelo responsável: CPTS11 substituído por GGRC11.
- Plano gratuito da brapi confirmado para cotação de FII: teste com o GGRC11 no painel da brapi retornou `200 OK` com `regularMarketPrice`.
- Primeira execução: 9 fundos. O TRXF11 ficou de fora porque o prefixo de ISIN "TRXF" aparecia ligado a dois CNPJs com informe no mesmo mês. O CNPJ correto, 28.548.288/0001-52 (ISIN BRTRXFCTF003), foi confirmado nos comunicados oficiais do fundo e fixado em `config/fiis-ifix.json`. Na execução seguinte, 10 fundos publicados, deploy Ready na Vercel.
- Melhoria no script: quando o ISIN aponta para mais de um CNPJ, ele usa o CNPJ com o informe mais recente (caso típico de migração para a Resolução CVM 175). Só pede o CNPJ manual em caso de empate.
- Workflow atualizado para `actions/checkout@v5` e `actions/setup-node@v5`, eliminando o aviso de Node.js 20, e fixado em `ubuntu-24.04`, para a execução de 20/10 não depender da migração do `ubuntu-latest` para o Ubuntu 26.
- Lição operacional: a tradução automática do navegador alterava o conteúdo dos arquivos exibidos no GitHub. Registrado na seção 5.6 da operação.

### D10 · Simule FII: só o último rendimento, com trava por mediana (24/09/2026)

**Contexto.** A validação contra os valores anunciados pelos fundos mostrou que a estimativa feita a partir do Informe Mensal da CVM (DY do mês × valor patrimonial da cota) se aproxima do **resultado contábil do mês por cota**, e não do rendimento distribuído. Por isso ela se distorce em meses especiais:

| Fundo | Mês | Estimativa CVM | Anunciado | Erro | Provável causa |
|---|---|---|---|---|---|
| GGRC11 | ago/jul/jun | 0,098 / 0,150 / 0,122 | 0,10 / 0,10 / 0,10 | −2% / +50% / +22% | 11ª emissão; fechamento do exercício em junho |
| MXRF11 | ago/jul/jun | 0,094 / 0,075 / 0,108 | 0,10 / 0,10 / 0,10 | −6% / −25% / +8% | 12ª emissão em julho; junho ≈ resultado-caixa de 0,1097 |
| TRXF11 | ago/jul/jun | 0,926 / 0,943 / 1,461 | 0,93 | ~0% / ~0% / +57% | fechamento de semestre |

Com isso, a média de 3 meses exibida na tela chegava a superestimar a renda em 24% (GGRC11).

**Alternativas avaliadas.**
1. bolsai Pro (R$ 49/mês): valores exatos anunciados na B3, automático. **Recomendada pelo responsável técnico.**
2. Rendimentos digitados mensalmente pelo responsável, com a CVM como conferência: exato, gratuito, exige rotina mensal.
3. CVM mostrando só o último rendimento, com trava por mediana: gratuito e automático, ainda sujeito a erro em meses atípicos.

**Decisão.** Opção 3, escolhida pelo responsável pelo produto para manter custo zero.

**Implementação.**
- O script analisa 6 meses por fundo e publica **um**: o mais recente cujo valor fica a até 20% da mediana dos 6 (`toleranciaPadrao`). Meses fora disso são descartados e registrados no log.
- O KNIP11, fundo de inflação com variação real de rendimento, tem tolerância própria de 50%.
- O log avisa quando os meses mais recentes repetem o mesmo valor (caso do XPML11).
- Na tela, saíram a média e o seletor de base. Entrou o percentual sobre a cota, e o aviso passou a citar explicitamente emissões e fechamentos de semestre.

**Risco residual aceito.** Um mês distorcido em menos de 20% (ex.: MXRF11 em junho, +8%) continua podendo aparecer. A conferência mensal por amostragem (docs/06, bloco 7) acompanha esse risco; se as diferenças forem frequentes, a opção 1 exige mudar só o script.

### D11 · Simule FII e Aprender na landing; curso e livro dentro do Aprender (24/09/2026)

**Contexto.** Simule FII e Aprender só eram alcançáveis pela barra de abas do app, que aparece depois do questionário, embora nenhuma das duas dependa do resultado. Enquanto isso, o curso de Candlesticks e o livro infantil ocupavam dois botões da landing.

**Decisão.** Troca de lugares:
- Na landing, os botões **🏢 Simule FII** e **🎓 Aprender** ocupam os lugares do curso e do livro e abrem o app direto nessas telas (`./app/?tela=simuleFii` e `./app/?tela=aprender`), sem questionário.
- **Curso de Candlesticks** e **Educação Financeira Infantil** passam para o fim da tela Aprender, com o mesmo visual e a mesma liberação por confiança. A chave `carteiraideal.livroLiberado` foi mantida, então quem já liberou continua liberado.
- As duas abas saíram da barra, que fica com Perfil, Carteira e Simular. As duas telas ganharam "← Início", que volta à landing.

**Implementação.**
- `useAppState.ts`: `TELAS_AVULSAS` (Aprender, Trilha, Aula e Simule FII) nunca são salvas como "última tela". Assim, o botão amarelo da landing continua retomando o questionário ou o resultado de onde a pessoa parou, e não a aula que ela viu por último. O parâmetro `?tela=` dessas telas fica na URL, para recarregar a página manter a pessoa no lugar; o de `?tela=resultado` continua sendo removido.
- Estados salvos antes desta mudança que pararam numa tela hoje avulsa retomam no resultado (antes, essas telas só existiam depois dele).
- `ui/MateriaisExtras.tsx` concentra os dois botões e o diálogo do livro; o bloco correspondente saiu de `index.html`, `script.js` e `style.css`.

**Ponto em aberto.** O link "riqueza" no rodapé da landing continua apontando para o curso de Candlesticks.

### D12 · Simule FII: busca livre de qualquer FII listado, no plano gratuito (24/09/2026)

**Contexto.** A aba mostrava só os 10 maiores do IFIX. A busca livre estava prevista como "fase 2" (docs/06, bloco 7), com uma função na Vercel, cache e limite de requisições.

**O que mudou a avaliação.** O Informe Mensal que o job já baixava da CVM traz **todos** os FIIs registrados, não só os 10; o script lia o arquivo inteiro e descartava o resto. Ou seja, o rendimento de qualquer fundo já estava disponível, sem custo nem fonte nova.

**Decisão.** Ampliar o próprio job mensal, em vez de criar consulta em tempo real:
- O job processa os 10 fundos em destaque (como antes) e, em seguida, todos os demais FIIs do informe com ISIN de cota. O ticker é o prefixo do ISIN + "11"; se o código não existir na B3, a brapi responde 404 e o fundo fica de fora.
- O app continua lendo um arquivo estático. Sem função nova na Vercel, sem token exposto, sem dado pessoal trafegando, sem limite de requisições para administrar do lado do cliente. A LGPD não muda.
- A tela ganhou um campo de busca por código ou por parte do nome (sem acento, sem diferenciar maiúsculas). Os 10 do IFIX continuam como atalho.

**Filtros antes de consultar a brapi** (poupam a cota do plano gratuito):
- Sem informe nos últimos 3 meses (`mesesMaximoAtraso`): fundo encerrado ou atrasado com a CVM. Vai para `indisponiveis`, para a tela explicar o motivo se alguém procurar.
- Menos de 100 cotistas (`minimoCotistas`): em geral fundo restrito, fora da bolsa. Só vale se a coluna existir no informe.
- Ordem das consultas: destaques e depois do maior patrimônio para o menor. Se o teto por execução (`maxRequisicoesBrapi`, 800) ou a cota da brapi acabar, faltam só os menores.

**Qualidade do dado por fundo.** A trava por mediana e a faixa plausível (D10) foram validadas nos 10 maiores. Fundos menores falham mais, então:
- Fundo que não passa nas checagens não derruba a publicação: fica fora da lista e entra em `indisponiveis` com o motivo (`rendimento-atipico`, `fora-da-faixa`, `sem-rendimento`, `sem-cotacao`, `sem-informe-recente`).
- Fundo publicado com sinal de fragilidade recebe `confianca: "baixa"` e a tela mostra "Estimativa menos confiável" com o motivo: poucos meses de informe, valor repetido há 3 meses ou mais, ou cotação parada há mais de 7 dias (cota pouco negociada).

**Travas de publicação.** Continuam valendo o `conferidoNaB3` e o mínimo de 8 destaques válidos. Nova: se menos de 100 fundos no total (`minimoFundosTotal`) ficarem válidos, o arquivo não é atualizado, o que protege contra coluna renomeada ou brapi fora do ar.

**Formato do arquivo.** `rendimentosFii.json` ganhou `destaques` (tickers do IFIX, na ordem) e `indisponiveis`, e passou a ter um fundo por linha, para o diff mensal continuar legível. O app aceita o formato antigo (sem `destaques`, usa os 10 primeiros), então a publicação pode acontecer antes ou depois da primeira execução do job novo. O arquivo embutido no app cresce para algo como 60 a 90 KB, que o gzip reduz bastante.

**Enquadramento.** A busca exibe qualquer fundo encontrado, sem ordenar por rendimento nem sugerir compra. O aviso de rentabilidade passada ganhou a frase "Encontrar um fundo na busca não é uma indicação de compra."

**Mecanismo (Etapa 2, 27/09/2026).**
- `scripts/b3-boletim.mjs`: leitor do boletim, compartilhável com o futuro job de BDRs. Baixa `PRAAMMDD.zip` (zip dentro de zip), extrai só o XML da última versão do dia e o lê em fluxo, bloco a bloco. No boletim real de 25/09: 59.380 instrumentos em 2,5 s, 89 MB de memória. Zip menor que 1 KB = dia sem pregão.
- `scripts/atualizar-etfs.mjs`: universo pela brapi (com o histórico como reserva), boletins que faltam (até 5 dias úteis para trás no dia a dia), histórico próprio em `historico/etfs.json` (até 260 pregões; por ETF e por pregão, [fechamento, mínima, máxima, volume em reais] ou null), métricas, travas e gravação. Dia sem negócio conta como volume zero na média de 21 pregões. Variação de 3 meses só com 64 pregões ou mais; faixa de 52 semanas só com 240 ou mais. Antes das 21h de Brasília, o boletim do dia não é usado (a última versão sai por volta das 20h30).
- `--carga-inicial=N`: baixa até N pregões (máximo 260), com 1 s de pausa, e grava o histórico **sempre**, mesmo sem pregões suficientes para publicar, para uma carga interrompida continuar de onde parou.
- Workflows: `.github/workflows/atualizar-etfs.yml` (segunda a sexta, 22h de Brasília) e `.github/workflows/carga-inicial-etfs.yml` (manual, uma vez). Operação em `docs/05`, seção 5.9.
- Saída `webapp-src/src/data/etfs.json`: data do pregão, fonte, pregões no histórico, critério, ordem das categorias, os 40 da lista (ticker, nome, categoria, índice, câmbio, cotação e data, volume médio, variação de 3 meses, mínima e máxima de 52 semanas) e a busca com todos os ETFs (campos resumidos).
- **Conferido.** 26 testes novos (132 dos scripts no total). Simulação ponta a ponta com o zip real da B3 de 25/09 e a rede simulada: feriado (zip vazio), boletim com data trocada (ignorado na carga), carga incompleta (histórico gravado, lista não), pregão novo (40 ETFs: 16 de renda fixa, 8 de bolsa brasileira, 8 de bolsa exterior, 4 de ouro, dólar e commodities e 4 de cripto), execução repetida (arquivos idênticos) e brapi fora do ar (universo guardado). Na simulação, o mínimo de ETFs no boletim, fixado antes em 150, barrava até o pregão verdadeiro; ficou em 60 (só a primeira página da listagem soma 86 no boletim de 25/09).

**Primeira carga real (27/09/2026) e correções.** Os 260 boletins baixaram em 28 minutos (cerca de 6 s cada, ~225 ETFs por pregão), mas a carga processava as datas da mais antiga para a mais nova e parou ao atingir 260: guardou os pregões até 27/08 e deixou de fora o último mês. A trava de dado velho (mais de 7 dias) barrou a publicação, como previsto, e o job terminou com erro; como o commit só rodava no sucesso, o histórico baixado se perdeu. Correções: (1) a carga inicial processa da data mais nova para a mais antiga (teste novo que reproduz o erro); (2) o histórico é gravado a cada 20 pregões e o passo de publicação da carga roda sempre (`if: always()`), publicando o histórico mesmo com falha ou interrupção, e o `etfs.json` só se o site compilar; (3) cada download tem limite de 90 s e uma nova tentativa, para uma resposta presa da B3 não segurar o job; (4) o log mostra o tempo de cada pregão. 133 testes dos scripts; carga simulada de 45 pregões terminando em 25/09, com feriado pulado e gravações parciais.

**Segunda carga (27/09/2026, noite): sucesso.** 260 pregões, 40 ETFs na lista e 232 na busca, pregão de 25/09 (BOVA11 R$ 743 mi/dia, SMAL11 R$ 280 mi, BOVV11 R$ 91 mi). O log apontou 5 ETFs da lista sem categoria, das páginas 2 e 3 da listagem, que não tinham sido vistas ao montar o config: ISNT11 (Itaú Isento Março 28, FIC de fundos incentivados de infraestrutura) foi **excluído**, pelo mesmo motivo do ISEN11; B5MB11 e LFTI11 entraram em Renda fixa, IBOB11 e BZEQ11 em Bolsa brasileira, com índice.

**Tela "Simule ETF" (Etapa 3, 27/09/2026).** `screens/SimuleEtf.tsx`, aberta por `./app/?tela=simuleEtf` e pelo botão 🧺 da landing (depois do Simule BDR), no molde do Simule BDR:
- **Lista:** um bloco por categoria, na ordem fixa do config (bolsa brasileira, bolsa exterior, renda fixa, ouro/dólar/commodities, cripto, outros), e não por desempenho; dentro do bloco, ordem por volume. **Busca** por código ou nome em todos os ETFs; fora da lista, cartão resumido com "Fora da lista por volume" e, se não negociou no último pregão, a data do preço exibido. Busca sem resultado lembra que BDRs de ETF (final 39) ficam no Simule BDR e que fundos de debêntures incentivadas não aparecem.
- **Cartão:** preço e data do fechamento, categoria, volume médio, índice acompanhado, linha de câmbio só na bolsa exterior ("Varia também com o dólar" ou "Sem a variação do dólar", conforme o config conferido), variação de 3 meses no preço da cota, faixa de 52 semanas e uma linha de IR conforme o regime do ETF. Sem P/VP, sem taxa, sem cor de alta ou queda.
- **Simulação:** R$ 1 mil, 5 mil (padrão), 10 mil ou valor digitado → cotas inteiras, valor investido e sobra. Só a divisão pelo preço.
- **Avisos fixos** (regras conferidas em 27/09/2026 em fontes de setembro de 2026, sem mudança nas regras de ETF): renda fixa com IR retido na fonte (25% até 180 dias de prazo médio da carteira, 20% de 181 a 720, 15% acima), sem DARF e sem compensação de prejuízo com outros ganhos; demais ETFs com 15% sobre o ganho na venda (20% em day trade), DARF pelo investidor, sem a isenção de R$ 20 mil; rendimentos distribuídos por ETF de renda variável com 15% retidos na distribuição; rentabilidade passada, câmbio conforme a estrutura, oscilação dos ETFs de renda fixa, critério da lista e fonte oficial da B3.
- **Arquivos:** `domain/etfs.ts` (grupos, busca, regime de IR, textos de câmbio), `data/snapshotEtfs.ts` (leitura via `unknown`, D16), rota em `App.tsx` e `useAppState.ts` (tela avulsa, fora das abas), botão em `index.html`. A simulação e a variação reaproveitam `simularCompra` e `formatarVariacao` de `domain/bdrs.ts`.
- **Conferido.** 367 testes do app (16 novos) e 133 dos scripts; typecheck e lint sem erros; build de produção com um `etfs.json` no formato real (preços e volumes do boletim de 25/09); tela vista em navegador em 390×844 (claro e escuro) e 1440×900, e o botão da landing, sem erro de JavaScript.

**Pendências.**
- Conferir a cota mensal vigente do plano gratuito no painel da brapi e ajustar `maxRequisicoesBrapi` se necessário. O job leva alguns minutos por causa da pausa entre chamadas; o workflow tem teto de 45 minutos.
- Na primeira execução, ler no log a linha `[info] brapi: … requisições, … não listados, … sem cotação` e a contagem de baixa confiança, e conferir por amostragem 2 fundos pequenos, além dos 2 destaques de sempre.
- O nome exibido é o do cadastro da CVM, encurtado na tela ("FUNDO DE INVESTIMENTO IMOBILIÁRIO" e "RESPONSABILIDADE LIMITADA" saem). Alguns fundos podem aparecer com nome pouco familiar; a busca por código resolve.

**Primeira execução (24/09/2026).** 534 candidatos, 514 descartados por terem menos de 100 cotistas, 309 requisições à brapi, 90 códigos não listados na B3 e **211 fundos publicados** (10 de 10 destaques, 8 com baixa confiança). O limite da brapi não foi atingido.

**Ajuste após a primeira execução.** O VGIP11 (CRI atrelado ao IPCA) ficou de fora como "rendimento atípico": a trava de 20% em torno da mediana, calibrada nos 10 maiores, descartava fundos cujo rendimento varia de verdade com a inflação. Cerca de 225 candidatos pararam nessa etapa. Mudanças:
- Fora dos destaques, quando nenhum mês fica dentro da tolerância, o fundo passa a ser publicado com o mês **mais próximo da mediana** (em empate, o mais recente), marcado como baixa confiança com o motivo `rendimento-variavel`. A tela explica que a renda real pode ser maior ou menor. É um mês real, não uma média, para o rótulo "último rendimento, mês X" continuar verdadeiro. A faixa plausível de 0,1% a 3% ao mês continua valendo. Parâmetro: `outrosFundos.publicarVariaveis` (`false` volta a descartar). Os destaques não mudam: seguem a `tolerancia` de cada um.
- Fundo com o ISIN ligado a mais de um CNPJ com informe no mesmo mês (o caso do TRXF11) agora entra em `indisponiveis` como `cadastro-ambiguo`. Antes ele sumia, e a tela dizia "confira o código" para um código correto. O log lista os CNPJs, para quem quiser fixar o certo em `config/fiis-ifix.json` ou num destaque.
- Prefixos de ISIN que começam com número (ex.: `0D70`) são códigos internos de fundos não listados, porque ticker da B3 sempre começa com letra. Eles eram cerca de 90 dos 333 indisponíveis e, com a regra acima, passariam a gastar requisições. Agora ficam de fora antes de qualquer consulta.
- Mês antigo: fundo cujo mês publicado fica 3 ou mais meses atrás do mês mais recente do informe recebe baixa confiança com o motivo `mes-antigo`. Na primeira execução, o HBRH11 saiu com dez/2025, e o PNRC11, o XPIN11, o SPG211 e o RFOF11 com mar ou abr/2026.
- Efeito esperado: mais fundos publicados e mais requisições à brapi (até cerca de 550 por execução, ainda abaixo do teto de 800), com o job levando alguns minutos a mais.

### D13 · Simule FII: lista por liquidez e setor, com a busca mantida (25/09/2026)

**Contexto.** A busca livre (D12) abriu mais de 200 fundos, muitos pequenos e com dado frágil: mês antigo, cotação parada, rendimento irregular. O responsável pelo produto quis uma vitrine mais enxuta e confiável, organizada como o investidor pensa: por setor.

**Decisão.**
- **Lista principal:** só os fundos com **volume financeiro médio acima de R$ 1 milhão por dia** no último mês (21 pregões), agrupados por setor. Os 10 maiores do IFIX entram pelo mesmo critério, sem destaque separado. A tela explica o critério.
- **Busca mantida** para qualquer outro fundo com dado no mês. Se o fundo encontrado estiver abaixo do corte, o cartão mostra "Fora da lista por liquidez", com o volume médio, e explica o risco de comprar ou vender com pouca liquidez.
- **Cotação e rendimento continuam como antes:** CVM e brapi no plano gratuito, com as mesmas travas e avisos de confiança.

**Como é calculado.**
- **Liquidez.** A consulta da brapi passou a pedir o histórico do último mês (`range=1mo&interval=1d`) na mesma requisição da cotação, sem custo extra de cota. O volume médio é a soma de cotas negociadas × fechamento de cada dia, dividida pelo número de dias. Dias sem negócio contam como zero, de propósito, porque liquidez é justamente a frequência de negócios. O plano gratuito permite histórico de até 3 meses.
- **Setor.** Vem do segmento que o próprio fundo declara no Informe Mensal da CVM, traduzido para nomes que o investidor reconhece: Logística, Shoppings, Escritórios, Papel (CRI), Híbrido, Fundo de fundos, Saúde, Hotéis, Residencial, Varejo e renda urbana, Educacional e Outros. Fundo de fundos é reconhecido pelo nome, porque costuma se declarar como "Títulos e Val. Mob.". Quando a classificação declarada não for a que o mercado usa, a correção fica no bloco `setores` de `config/fiis-ifix.json`.
- **Ordem.** Setores com mais fundos primeiro e "Outros" por último. Dentro de cada setor, ordem alfabética, que é neutra e não sugere ranking de rendimento.

**Papel dos 10 do IFIX.** Viraram só **controle de qualidade** da publicação: se menos de 8 deles passarem nas checagens de dado e cotação, o problema é geral e o arquivo não é atualizado.

**Travas novas.**
- Menos de 20 fundos acima do corte (`minimoFundosTotal`) impede a publicação.
- Se a brapi não devolver histórico de volume para nenhum fundo, o job para com uma mensagem própria, porque isso indica que o plano ou o parâmetro `range` mudou.

**Log para conferência.** Cada execução registra:
- quantos fundos ficaram na lista e quantos só na busca;
- os 5 mais negociados e os 3 menos negociados da lista, para conferir por amostragem num site de cotações;
- a contagem por setor.

**Tela.** Ao tocar num fundo, a tela rola até o cartão, porque com dezenas de botões ele fica abaixo da dobra. A rolagem é sem animação quando o aparelho pede menos movimento. O aviso legal passou a dizer que estar na lista não é indicação de compra, porque o critério é só a liquidez.

**Primeira execução (25/09/2026) e ajustes.** 54 fundos na lista e 219 na busca. Os mais negociados foram TRXF11, KNCR11, HGLG11, MXRF11 e XPML11, todos acima de R$ 20 milhões por dia. Dois ajustes:
- **Setores.** "Híbrido 23" contra "Papel (CRI) 8" não correspondia ao mercado: muitos fundos de CRI se declaram "Híbrido" no segmento, mas informam o mandato "Títulos e Valores Mobiliários". O mandato passou a ter prioridade sobre o segmento, e o log lista os tickers de cada setor (linhas `[setor]`) para revisão.
- **VGIP11 e VGIR11.** O diagnóstico mostrou DY 0,0000 nos 6 meses: a gestora não preenche esse campo no informe da CVM. Não há estimativa possível pela CVM. Esses fundos ganharam o motivo próprio `sem-dy-informado`, e a busca orienta a conferir os rendimentos no site do fundo. Decisão do responsável pelo produto: não digitar à mão nem assinar fonte paga. A tela informa que o fundo não reporta o rendimento à CVM e que os rendimentos pagos estão no site da administradora.

**Ajustes de tela pedidos pelo responsável (25/09/2026).**
- O texto do critério passou a ser: "Somente são disponibilizadas as informações dos fundos imobiliários que negociam, em média, acima de R$ 1 milhão por dia. Para os demais fundos, com valores de negociação inferiores a R$ 1 milhão, favor consultar na busca acima."
- Os nomes de setor passaram por três versões. Primeiro, texto amarelo centralizado, com contorno no tema claro. Depois, o mesmo texto alinhado à esquerda. Na versão final, cada setor é uma caixa amarela na largura toda, com o nome em escuro e centralizado, no mesmo desenho do botão principal da landing ("Ver minha carteira de referência"). O visual é igual nos dois temas.
- A busca por fundo que não informa DY à CVM diz que os rendimentos estão no site da administradora do fundo, sem sugerir "tente na próxima atualização", porque isso não muda de um mês para o outro.

**Revisão dos setores (25/09/2026).** Mesmo com o mandato priorizado, a autodeclaração à CVM ainda divergia do mercado em 15 fundos da lista, entre eles HGLG11 e BTLG11 em "Híbrido" e MXRF11 em "Logística". As correções seguras foram para o bloco `setores` de `config/fiis-ifix.json`, com dois setores novos, Agro (RZTR11) e Energia (SNEL11). Na confirmação do responsável:
- KORE11 foi para Escritórios.
- TRXB11, JSAF11 e VGHF11 foram para Híbrido: são carteiras mistas, não papel puro.
- CPUR11, EIRA11, GARE11, IBBP11, PQAG11 e TJKB11 ficaram como declarados à CVM.

**Códigos renomeados.** O RVBI11 passou a negociar como **PSEC11** em 24/10/2025, sem mudar a política de investimento, e foi classificado como Fundo de fundos. O ISIN no informe da CVM mantém o prefixo antigo, então o app exibia RVBI11. Criado o bloco `renomeados` em `config/fiis-ifix.json`, no formato código antigo → código atual. O fundo aparece com o código atual, a busca pelo antigo continua encontrando-o e, se a brapi ainda não reconhecer o código novo, o script consulta o antigo. Outras trocas de código entram no mesmo bloco.

**Pontos a acompanhar na primeira execução.**
- O número de fundos na lista. A estimativa era de 40 a 50, mas quem decide é o critério. Se ficar grande demais, o corte sobe em `volumeMinimoDiario`.
- Se os nomes de setor declarados à CVM estão coerentes. Corrigir os que não estiverem em `setores`.
- Se o volume médio calculado bate com o de um site de cotações para 2 ou 3 fundos.

### D14 · Tema claro/escuro único entre landing e app (25/09/2026)

**Problema.** O tema escolhido na landing valia só para a landing. Quem trocava para o claro e abria o Simule FII, o Aprender ou o questionário caía no escuro.

**Causa.** Eram dois sistemas separados:
- a landing guardava a escolha na chave `theme` do navegador;
- o app guardava o tema dentro do próprio estado (`carteiraideal.estado`), começava no escuro e só oferecia a troca na tela de abertura do questionário.

**Correção.**
- A chave `theme` virou a fonte única da preferência. Ao abrir, o app lê essa chave, e ela vence o tema do estado salvo, porque a landing é a porta de entrada e guarda a escolha mais recente.
- Quando o tema muda no app, a mesma chave é gravada, e a landing acompanha na volta. A gravação só acontece depois da leitura, para o padrão escuro não apagar a escolha feita na landing.
- `webapp-src/index.html` aplica o tema antes da primeira pintura, para o app não piscar no escuro enquanto carrega.
- Testado no navegador: landing no claro → Simule FII no claro → "Início" → landing no claro → Aprender no claro.

### D15 · Dados oficiais de mercado: Banco Central e Tesouro Direto, uma vez por semana (25/09/2026)

**Contexto.** Os textos de `analises/tesouro*.ts` citam títulos e vencimentos fixos, que envelhecem sem aviso, e as 9 carteiras-modelo não têm nenhuma referência de cenário (Selic, inflação, câmbio). Pendência registrada em docs/06, bloco 4 (revisão periódica das carteiras-modelo).

**Decisão.** Novo job semanal no mesmo padrão do Simule FII (D9): script no GitHub Actions, arquivo estático versionado, nenhuma chamada externa saindo do navegador, custo zero.
- **Banco Central (SGS):** Selic meta (432), CDI anualizado (4389), IPCA do mês (433), IPCA 12 meses (13522) e dólar PTAX de venda (1). Último valor e o anterior.
- **Tesouro Transparente:** arquivo "Preço e taxa dos títulos do Tesouro Direto", só a data-base mais recente. Cada título com taxa e preço de compra e de venda (valores da manhã), indexador, tipo de taxa, cupom e se está à venda.
- **Derivado:** juro real ex-post (Selic meta descontada do IPCA 12 meses), como termômetro de cenário, não previsão de retorno.
- **Histórico para o gráfico:** Selic meta (432) e IPCA 12 meses (13522) desde 05/03/1999, início da série da meta. O SGS limita a consulta por período a 10 anos, então o script busca em janelas de 9 anos. A Selic meta vem diária, mas só muda nas reuniões do Copom: o script guarda só os pontos de mudança e o último dia, o que dá cerca de 150 pontos.
- Saída em `webapp-src/src/data/mercadoOficial.json`. Configuração em `config/mercado-oficial.json`.

**Salvaguardas.**
- Cada indicador tem faixa plausível e idade máxima no config. Fora disso, o job falha sem gravar (protege contra código de série trocado ou mudança de unidade).
- Tesouro: data-base com até 7 dias, pelo menos 10 títulos à venda e pelo menos um Selic, um Prefixado e um IPCA+ à venda. Título à venda com taxa fora da faixa é descartado e aparece no log.
- Qualquer falha = arquivo não atualizado; o app segue com os dados da semana anterior.
- SGS com 3 tentativas e pausa crescente (o serviço oscila). A consulta "últimos N" do SGS é limitada a 20 valores desde 26/03/2025; o job usa 2.
- Histórico: número mínimo de pontos, faixa plausível (a Selic de 1999 chegou a 45%, por isso a faixa vai até 50%) e o último ponto precisa ser igual ao valor atual do indicador. Se não bater, as duas consultas estão desencontradas e nada é gravado.

**Leitura das taxas.** As três famílias não falam a mesma língua: no Tesouro Selic a taxa é o ágio/deságio sobre a Selic, no IPCA+ (e Renda+, Educa+) é o juro real acima da inflação, no Prefixado é a taxa nominal. O campo `tipoTaxa` (`agioSobreSelic`, `jurosReais`, `nominal`) existe para a tela nunca comparar esses números diretamente. No Renda+ e no Educa+ o ano do nome comercial não é o vencimento; o nome gerado traz o vencimento explícito.

**Conferência do conteúdo.** A cada execução, o job procura nomes de títulos nos arquivos de `analises/tesouro*.ts` e lista no log (linhas `[conteudo]`) os que não estão à venda. Só avisa: a correção do texto é decisão editorial.

**Tela (DetalheAtivo).**
- **Taxas de hoje** (`ui/TaxasTesouroHoje.tsx`): no agregado Tesouro Direto, acompanha o chip escolhido (Selic, Prefixado ou IPCA+). Lista todos os títulos à venda da família, **em ordem de vencimento, nunca por maior taxa**, com a taxa escrita na régua certa ("Selic + 0,05%", "IPCA + 7,45%", "14,10% a.a."), o preço por título, uma frase explicando a régua, a data e a fonte, e o aviso de que a lista não é indicação de compra.
- **Juros e inflação no Brasil** (`ui/CenarioJuros.tsx`): nas telas de Tesouro, CDB com liquidez diária e LCI/LCA. Mostra Selic meta (com a data da última decisão do Copom que a alterou), CDI, IPCA 12 meses, juro real ex-post e dólar PTAX.
- **Gráfico** (`ui/GraficoJuros.tsx`, SVG próprio, sem biblioteca): Selic meta em degraus e IPCA 12 meses em linha, com períodos de 5 anos, 10 anos (padrão, porque os 45% de 1999 achatam a escala) e desde 1999. Tocar, arrastar ou usar as setas do teclado mostra o mês com Selic, IPCA e juro real. A leitura abre no último mês completo, com o IPCA já divulgado. O leitor de tela recebe um resumo do período (mínima, máxima e valor atual).
- Cores do gráfico próprias por tema (`--grafico-selic`, `--grafico-ipca`): no tema claro, o amarelo de destaque some como linha fina, por isso usa um tom mais escuro da mesma família.
- **Fora do Resultado, de propósito.** O cenário fica só nas telas de renda fixa, e o texto diz que a carteira de referência não muda conforme esses números. Colocá-lo ao lado da carteira sugeriria que a alocação reage à conjuntura, o que não acontece.
- Antes da primeira execução do job, as taxas mostram um aviso para consultar o site do Tesouro Direto, e o quadro de cenário não aparece. Com dado de mais de 10 dias, as duas seções avisam da possível defasagem.

**Manutenção.** Se o Tesouro Transparente mudar o endereço do arquivo, atualizar `tesouro.urlCsv` no config. Se aparecer tipo novo de título no log (`Tipo de título desconhecido`), incluí-lo em `classificarTitulo`.

### D16 · Aba "Simule Tesouro" aberta pela landing (25/09/2026)

**Contexto.** Pedido do responsável: uma aba própria do Tesouro Direto, no molde do Simule FII (D9, D11), além da seção já colocada no detalhe do Tesouro (D15), que continua lá.

**O que a aba tem** (`screens/SimuleTesouro.tsx`, aberta por `./app/?tela=simuleTesouro`, botão 🏛️ na landing):
- Escolha do tipo (Selic, Prefixado, IPCA+) e do título, todos os sem cupom à venda, **em ordem de vencimento**, com a taxa escrita na régua certa.
- Valor: R$ 1 mil, 5 mil (padrão), 10 mil, 50 mil ou digitado.
- Resultado: valor bruto no vencimento, custódia da B3, IR, valor líquido, o mesmo valor **em dinheiro de hoje** (descontada a inflação projetada), rentabilidade líquida ao ano e ganho acima da inflação.
- "Como a conta é feita" (fechado por padrão), com a tabela do Focus usada, a tabela do IR e a regra da custódia.
- O quadro de juros e o gráfico da D15, sem a frase sobre a carteira de referência, que aqui não se aplica.

**Regras do cálculo** (`domain/simulaTesouro.ts`, no app, porque é aritmética sobre dado público, não metodologia):
- Prefixado: taxa contratada. IPCA+: juro real composto com o IPCA projetado ano a ano. Selic: média entre a Selic no início e a projeção para o fim de cada ano, mais o ágio/deságio do título.
- Premissa de inflação e Selic: **mediana do Boletim Focus** (Banco Central, API Olinda, recurso ExpectativasMercadoAnuais), buscada pelo job semanal. Depois do último ano projetado, repete o último valor.
- Custódia da B3: 0,20% a.a. sobre o valor médio do título em cada ano, cobrada no vencimento (regra vigente desde 2025, sem cobrança semestral). Tesouro Selic: só sobre o que passar de R$ 10 mil, supondo ser o único Tesouro Selic do CPF (a tela avisa).
- IR regressivo pelo prazo total (22,5% / 20% / 17,5% / 15%), sobre o ganho já descontada a custódia.
- Prazo em dias corridos / 365; o Tesouro usa dias úteis / 252. A tela diz que o valor exato pode diferir um pouco.
- Mínimo de compra: 1% do preço do título, com piso de R$ 30; abaixo disso, aviso.

**Fora do simulador, de propósito.** Títulos com juros semestrais: pagam cupom a cada seis meses, já tributado, e o resultado dependeria de uma premissa de reinvestimento. Aparecem com a taxa, e a tela explica por que não entram. Renda+ e Educa+ também ficam fora (fluxo de renda mensal, regras próprias de custódia).

**Job semanal (D15) ampliado.** Busca o Focus de IPCA e Selic. Travas: coleta com até 14 dias, projeção para pelo menos o ano corrente e os 2 seguintes, valores dentro da faixa plausível. Qualquer falha impede a gravação, como nos demais dados.

**Conferência feita.** IPCA + 7,45% por 8 anos e 8 meses, R$ 10 mil, Focus perto de 3,6%: bruto de cerca de R$ 25,3 mil, custódia de cerca de R$ 287, IR de 15% e ganho real líquido de cerca de 6,1% ao ano, coerente com a conta de cabeça. Os testes conferem à mão um Prefixado de 2 anos (bruto, custódia, IR, líquido e valor em dinheiro de hoje) e a isenção do Selic.

**A acompanhar.** Na primeira execução, conferir no log a linha `[focus]` contra o boletim publicado no site do Banco Central, e comparar uma simulação com o simulador oficial do Tesouro Direto para o mesmo título e valor. Diferenças de poucos por cento são esperadas (dias corridos, premissas); diferenças grandes indicam erro.

**Correção após a primeira execução (25/09/2026).** O job falhou sem gravar nada, como previsto nas travas. Duas causas, ambas corrigidas:
- **Selic meta com data futura.** A série 432 vem preenchida até a véspera da próxima reunião do Copom (o log mostrou "13,75% em 2026-11-04"). A consulta "últimos 2" pegava essas datas, o que faria a trava do histórico acusar diferença. Agora todos os indicadores são lidos por período terminando hoje (30 dias para trás nos diários, 150 nos mensais), e datas futuras são descartadas.
- **Instabilidade do SGS.** A API devolveu HTTP 502 e páginas de erro em XML (com status 200). Duas falhas se resolveram na nova tentativa, mas a janela de 9 anos de dados diários da Selic (1999 a 2008) falhou as 3 vezes, embora o limite oficial seja de 10 anos. Agora: janelas de 3 anos, 1 segundo de pausa entre consultas, 4 tentativas com espera crescente (3, 6 e 12 segundos) e, quando a resposta não é JSON, o log mostra o começo do que veio.

### D17 · Textos do Tesouro e da ISA Energia revisados com a lista real de títulos (25/09/2026)

**Contexto.** A primeira execução bem-sucedida do job de mercado (D15, data-base 24/09/2026, 58 títulos) listou nas linhas `[conteudo]` os títulos citados nos textos educacionais que não estão à venda. Hoje o Tesouro oferece IPCA+ sem cupom só em 2029, 2032, 2035, 2040, 2045 e 2050, e Prefixado sem cupom só até 2032.

**Decisão.** Trocar cada exemplo por um título à venda e, quando há menos títulos disponíveis que no texto antigo, reduzir a contagem do grupo (`fundos`), sem mexer nos percentuais:
- **IPCA+ Aposentadoria:** longuíssimo 2040, 2045 e 2050 (saiu 2048); longo 2032 e 2035; intermediário 2029 (saiu 2027). De 8 para 6 títulos.
- **IPCA+ Educação:** alvo 2029 e 2032 (saíram 2031, 2033 e 2034); intermediário 2035 (saíram 2036 e 2037); semestral 2030 (saiu 2033). De 8 para 4 títulos. A nota passa a citar o Tesouro Educa+, feito para esse objetivo, para quem precisa de datas exatas.
- **IPCA+ Renda passiva:** com juros semestrais 2030, 2032, 2035 e 2037 (saíram 2029, 2031 e 2033). Continua com 8.
- **Prefixado:** longo passa a ser 2031 e 2032 (saíram 2033 e 2035), com o rótulo "acima de 4 anos" no lugar de "5 a 10 anos"; tático passa a ser o Prefixado com Juros Semestrais 2037, o mais longo à venda. De 8 para 7. A taxa de exemplo fixa ("11% a 12% a.a.") saiu; o texto aponta para "Taxas de hoje".
- **Tesouro Selic:** 2029 e 2031 continuam à venda; sem mudança.
- **Ações:** TRPL4 (ISA CTEEP) virou ISAE4 (ISA Energia Brasil) em 18/11/2024.

**Rotina.** A cada execução semanal, as linhas `[conteudo]` do log mostram se algum exemplo voltou a sair de venda. Quando aparecerem, repetir esta revisão.

**Correção do build (25/09/2026).** O primeiro commit de dados reais (`dados: mercado oficial`) falhou na Vercel com TS2352: o TypeScript lê cada ponto do histórico (`["1999-03-05", 45]`) como lista genérica `(string | number)[]`, e não como o par `[data, valor]` do tipo `PontoHistorico`, e recusa a conversão direta. Com o arquivo inicial vazio o erro não aparecia, e por isso passou em todos os testes locais. Agora o JSON é lido num ponto único, `webapp-src/src/data/snapshotMercado.ts`, com conversão via `unknown`: o build não depende mais do conteúdo do arquivo. O formato continua garantido pelo script e pelos testes dele. **Lição:** testar o build também com um arquivo de dados preenchido, não só com o inicial vazio.

### D18 · Ajustes visuais no detalhe do ativo (25/09/2026)

**Pedido do responsável.**
- **Ordem da tela:** "Taxas de hoje" e "Juros e inflação no Brasil" passam a ficar **depois** da carteira por segmento e dos exemplos, logo antes de "Como analisar este ativo" (título da D26; antes "Como um consultor analisa"). A carteira de referência vem primeiro; os dados de mercado são contexto.
- **Contagem de ativos por segmento** ("4 títulos", "3 fundos"): a pílula cinza, que quebrava em duas linhas, virou uma caixa amarela com texto escuro (classe `.contagem-setor`), no mesmo desenho do botão selecionado do Simule FII. Fica sempre numa linha; em nomes de segmento longos, o nome ocupa uma linha a mais.

Conferido em navegador nos dois temas, com a tela real de detalhe (Tesouro, IPCA+, Renda Passiva).

### D19 · BDRs: 40 mais negociados, cotação diária de fechamento (25/09/2026)

**Contexto.** Primeira das novas frentes de renda variável (BDRs, ETFs, ações e cripto), feitas uma por vez, cada uma com seu job. Regra geral decidida pelo responsável para todas elas: **telas estritamente descritivas**, com dado bruto, ordem por liquidez e agrupamento por setor, sem ranking nem múltiplos de avaliação (P/L, LPA, P/VP). Motivo: manter o app longe da atividade de análise de valores mobiliários (Resolução CVM 20), além da fronteira com consultoria já registrada (Resolução CVM 19).

**Testes feitos no navegador (25/09/2026), plano gratuito da brapi.**
- A listagem (`/api/quote/list?type=bdr`) funciona e traz os 879 BDRs listados, com fechamento, variação do dia, volume e setor, em uma requisição.
- A consulta individual com `range=3mo&interval=1d` funciona (AAPL34: 64 pregões, nome longo com a proporção "Repr 0.05 Sh").
- O campo `volume` é **quantidade de papéis**, e a listagem ordena por ele: isso favorece BDRs baratos. O MUTC34 (R$ 938 por papel) aparecia em 21º e é o 3º em reais; o NFLX34 (R$ 7,41) caía de 11º para 27º.
- Os testes foram feitos com o pregão aberto: o AAPL34 aparecia com R$ 3,9 mi no dia, contra média de R$ 26,2 mi nos 21 pregões completos anteriores. Por isso a seleção usa só pregões completos e o job roda depois do fechamento.

**Decisão.**
- **Universo:** 35 BDRs de ações (códigos 31 a 35) e 5 BDRs de ETF (código 39), os de maior **volume financeiro médio dos últimos 21 pregões completos** (mesma régua dos FIIs, D13), acima de um piso: R$ 300 mil/dia para ações, R$ 100 mil/dia para ETFs. BDR de ETF fica nesta aba; ETF brasileiro (IVVB11, BOVA11, HASH11) fica no futuro job de ETFs.
- **Fora da lista:** empresas de origem ou operação brasileira listadas no exterior: ROXO34 (Nubank), XPBR31 (XP), INBR32 (Inter), JBSS32 (JBS), STOC34 (StoneCo), PAGS34 (PagSeguro). O filtro não pode ser pelo final do código (Nubank, StoneCo e PagSeguro terminam em 34), por isso é uma lista em `config/bdrs.json`. Códigos 31 a 33 novos entre os mais negociados geram a linha `[revisar]` no log, sem exclusão automática.
- **AURA33 dentro**, no setor "Mineração de ouro", por decisão do responsável (BDR do setor de ouro).
- **MELI34 (Mercado Livre) e S2GM34 (Sigma Lithium) dentro**, por decisão do responsável: são empresas estrangeiras, embora o Brasil seja o maior mercado do Mercado Livre e a mina da Sigma fique em Minas Gerais. O critério de exclusão vale para empresas de **origem** brasileira ou cuja operação é essencialmente brasileira.
- **Setores:** a classificação da brapi (em inglês) é traduzida no config. Tecnologia fica dividida em "Software e internet" e "Semicondutores e hardware", porque juntas seriam metade da lista. BDRs de ETF, que a brapi classifica todos como "Miscellaneous", ganham grupos próprios (Metais preciosos, Renda fixa EUA, Temáticos, Cripto).
- **Frequência:** diária, nos dias úteis, às 19h de Brasília. O preço de um BDR muda todo dia por dois motivos (a ação lá fora e o dólar), então a cotação semanal ficaria defasada rápido demais. A tela destaca "Fechamento de DD/MM" e a variação de 3 meses, não a variação do dia.
- **Dados publicados por BDR:** código, nome da empresa, setor, fechamento e data, variação de 3 meses, volume médio em reais, mínima e máxima de 52 semanas e proporção BDR/ação ("20 BDRs = 1 ação"). Sem P/L e sem LPA, embora a brapi os devolva.

**Mecanismo.** `scripts/atualizar-bdrs.mjs`, workflow `.github/workflows/atualizar-bdrs.yml`, saída `webapp-src/src/data/bdrs.json`, config `config/bdrs.json`. Uma requisição de listagem, os 100 BDRs de ações e 30 de ETF com maior volume em reais no dia como candidatos (mais os de controle e os publicados no dia anterior, para a lista não oscilar por um dia fraco), e uma requisição por candidato. Cerca de 130 requisições por execução e 2.900 por mês. A função de volume médio é a mesma do job de FIIs (importada de `atualizar-rendimentos-fii.mjs`), para as duas abas usarem exatamente a mesma régua de liquidez.

**Salvaguardas.**
- Só publica com `"conferidoPeloResponsavel": true` no config.
- Listagem com menos de 300 BDRs, menos de 4 dos 5 BDRs de controle (AAPL34, MSFT34, NVDC34, AMZO34, GOGL34) válidos, menos de 25 BDRs de ações ou 3 de ETF acima do piso, ou pregão mais recente com mais de 7 dias: o job falha sem gravar.
- Cotação fora de R$ 0,10 a R$ 10.000, variação de 3 meses fora de −90% a +500% ou sem histórico de volume: o BDR fica de fora e aparece no log.
- Pregão em andamento (execução manual antes das 18h30) é descartado.
- Sem pregão novo (feriado da B3, execução repetida): o arquivo não é regravado, sem commit nem deploy.
- `npm run build` antes do commit, como no job de mercado.

**A acompanhar na primeira execução.** Conferir no log as linhas `[revisar]`, `[setor]` e `[categoria]`, e comparar o volume médio de 2 ou 3 BDRs com um site de cotações.

**Tela "Simule BDR" (mesmo dia).** `screens/SimuleBdr.tsx`, aberta por `./app/?tela=simuleBdr` e pelo botão 🌎 da landing, no molde do Simule FII:
- **Busca igual à dos FIIs**, a pedido do responsável. Alcança todos os BDRs listados (menos os excluídos) sem requisição extra: o job grava no mesmo arquivo a lista `busca`, montada com o dado da própria listagem (fechamento, setor, volume do último pregão). Busca por código sempre; por nome só quando a brapi informa o nome (os 40 da lista e boa parte dos BDRs patrocinados e de ETF). BDR da busca que está na lista abre o cartão completo; fora da lista, abre um cartão resumido com o aviso "Fora da lista por volume" e, se não negociou no último pregão, o aviso de que o preço pode ser de um dia anterior.
- **Lista:** um bloco por setor (caixa amarela, como no Simule FII), com os BDRs em ordem de volume, e um bloco "BDRs de ETF" no fim.
- **Cartão:** preço de fechamento e data, setor, volume médio, variação de 3 meses (em reais, já com o dólar), faixa de 52 semanas e proporção ("20 BDRs = 1 ação"). Sem P/L, sem LPA, sem cor de alta ou queda.
- **Simulação:** R$ 1 mil, 5 mil (padrão), 10 mil ou valor digitado → quantos BDRs inteiros o valor compra, valor investido, sobra e equivalente em ações. Só a divisão pelo preço, sem custos e sem projeção de retorno.
- **Avisos fixos:** como o IR funciona nos BDRs (15% sobre o ganho na venda, 20% em day trade, sem a isenção de R$ 20 mil; dividendos já com imposto retido na origem, 30% nos EUA, e tabela progressiva pelo carnê-leão no Brasil), risco cambial, frase padrão de rentabilidade passada, critério da lista e aviso educacional.
- **Tamanho:** com os ~870 BDRs na busca, o arquivo fica perto de 110 KB (cerca de 15 KB a mais no download compactado do app).

Conferido em navegador (390 px, temas claro e escuro) com dados simulados no formato real, incluindo o build de produção com esses dados.

### D20 · Layout para computador e instalação como aplicativo (25/09/2026)

**Contexto.** O app já funcionava em qualquer navegador de computador, mas travado numa coluna de celular de 430 px (`.app-frame`), com a barra de abas embaixo. Numa tela de 1440 px isso sobrava espaço dos lados e obrigava a rolar muito nos simuladores (a lista de códigos ficava longe do cartão do ativo).

**Decisão.** Três camadas, todas só de apresentação, sem tocar no motor (`engine.ts`), na API, nos jobs nem no formato dos dados salvos:
- **Camada 1 · Largura e navegação.** A partir de 960 px, cada tela ganha uma largura pela classe `tela-*` no `.app-frame` (`App.tsx`): questionário e aulas em 680 px, Aprender e detalhe do ativo em 840 px, painéis (Resultado, Carteira, Simular e os três simuladores) em 1120 px. A barra de abas vira um menu lateral fixo à esquerda (painel de vidro, no molde do NotebookLM), a pedido do responsável, para liberar a altura da tela: entre 960 e 1199 px fica compacto (ícone em cima, nome embaixo); a partir de 1200 px mostra o nome "Carteira Ideal" e ícone ao lado do texto.
- **Camada 2 · Duas colunas.** Resultado: perfil, explicação e alertas à esquerda, gráfico e legenda à direita. Carteira: gráfico fixo à esquerda, explicação das classes à direita. Simular: controle do valor fixo à esquerda, valores por classe em grade de duas colunas. Simule Tesouro, FII e BDR: escolha à esquerda, cartão do resultado fixo à direita (sem a rolagem automática até o cartão, que no computador já está visível). Textos de instrução trocam "Toque" por "Clique" / "Passe o mouse" quando há mouse.
- **Camada 3 · Instalar.** `webapp-src/public/manifest.webmanifest` e ícones 192/512 (inclusive versão "maskable"). Chrome e Edge mostram o botão "Instalar" na barra de endereço; no celular, "Adicionar à tela inicial" passa a usar o ícone e o nome certos. `scripts/build-site.mjs` agora copia a pasta `webapp-src/dist` inteira para `/app` (antes só o `index.html`).

**Ajuste após revisão do responsável (mesmo dia).** A primeira versão prendia a coluna fixa com `overflow-y: auto` e altura máxima, o que recortava a sombra do gráfico, os contornos de foco e o fim dos cartões em janelas baixas; e as descrições em 10,5 px justificadas ficavam apertadas no computador. Agora a coluna não recorta nada e só fica fixa em janelas com pelo menos 720 px de altura; no computador, `.tiny` vai a 12 px, `.small` a 13 px, e texto pequeno deixa de ser justificado.

**Logo em todas as telas (mesmo dia, a pedido do responsável).** Novo componente `ui/Marca.tsx`, com o mesmo desenho de `assets/logo-mark.svg` e o nome "Carteira Ideal" em Sora. No computador aparece no início de todas as telas: acima do conteúdo nas telas sem menu (`App.tsx`) e no topo do menu lateral nas telas com abas (`TabBar.tsx`); no menu compacto (960 a 1199 px) só o símbolo. A logo é um link para a landing, como o "← Início". Na tela inicial, a linha de nome com o ícone antigo fica escondida no computador, para não repetir a marca. (Ver o ajuste seguinte: a logo passou a aparecer também no celular.)

**Logo também no celular e botão amarelo (mesmo dia, a pedido do responsável).** A logo passa a abrir todas as telas também no celular. Nas telas com "← Início" (Aprender, Simule Tesouro/FII/BDR) ela fica na mesma linha do link, à esquerda (`VoltarInicio.tsx`). Na tela inicial ela fica centralizada acima do seletor Claro/Escuro, no lugar da linha de nome com o ícone antigo. Nas demais telas fica sozinha no alto (`App.tsx`, lista `TELAS_COM_LOGO_PROPRIA`); no computador, nas telas com abas, continua só no menu lateral. O botão "Refazer o questionário" do Resultado passa de contorno para o botão amarelo (`btn-primary`).

**Mecanismo.** Invólucros `.desk-grid`, `.desk-split`, `.desk-main` e `.desk-side` no JSX. Abaixo de 960 px eles têm `display: contents`: não existem para o layout e os filhos seguem na mesma coluna, com o mesmo espaçamento de antes. Todo o CSS novo está no fim de `webapp-src/src/index.css`, no bloco "D20".

**Conferido.** 149 testes do app e 106 dos scripts passando; build de produção; capturas em 1440×900 e 390×844, com dados de exemplo no formato real, confirmando o celular sem mudança.

### D21 · Meu Mês: controle do orçamento como complemento, com Modo Recuperação (26/09/2026, concluída)

**Contexto.** 82% das famílias brasileiras estavam endividadas em agosto de 2026 (Peic/CNC), 85,1% entre as que ganham até três salários mínimos, e a inadimplência chegou a 29,9%. O responsável quis oferecer, de graça, um controle simples do mês, no molde do papel em que ele mesmo anota e tica as contas fixas, com regras firmes para quem está endividado.

**Decisões de produto (discutidas com o responsável).**
- **A Carteira Ideal continua sendo o produto.** O público principal segue sendo quem já tem dinheiro guardado e quer saber onde investir. O controle do mês é uma **porta lateral**, no mesmo nível dos simuladores: nada da Carteira Ideal fica bloqueado ou condicionado a ele, e o investidor que chega pela bio não encontra conteúdo de dívida pelo caminho. Foi descartada a ideia de uma home por "fases" que deixaria a carteira para o fim da trilha, porque mudaria a finalidade do app.
- **Metáfora dos Três Potes de Clara** (livro do responsável): depois das contas, a sobra vai para 🔵 Guardar, 🟡 Fazer Crescer e 🟢 Gastar, nas cores do livro.
- **Modo Recuperação completo**, ativado só quando a pessoa cadastra dívida cara (mesmo critério do [A] do Pilar 2) ou escolhe ativá-lo. Plano de quitação com avalanche e bola de neve lado a lado, pote Quitar no lugar de Fazer Crescer, mini-reserva antes, pacto de não parcelar e roteiro de negociação (Registrato, Serasa Limpa Nome, consumidor.gov.br, Lei 14.181/2021). Conteúdo educativo, não assessoria jurídica, sem indicar banco ou produto de crédito.
- **Nada sai do aparelho.** Diferente do `engine.ts`, que roda na API para proteger as regras, aqui o dado sensível é da pessoa: salário, contas e dívidas ficam só no `localStorage`, sem cadastro e sem chamada à API.

**Etapas (uma por vez, cada uma em sua conversa).**
1. Motor do orçamento com testes e a tela Meu Mês básica. **Feita nesta decisão.**
2. Cartão de crédito: teto mensal próprio, semáforo e fatura entrando no mês seguinte. **Feita.**
3. Modo Recuperação completo. **Feita.**
4. Ponte com o questionário (sugestão, não preenchimento automático, das respostas dos Pilares 1 e 2), botão na landing, trilha "Sair das dívidas" no Aprender e material para o Instagram. **Feita.**

**Etapa 1, como ficou.**
- `domain/orcamento.ts`: funções puras. Ordem do dinheiro: salário − contas do mês − cofrinhos das contas anuais = sobra; sobra − Guardar − Fazer Crescer = Gastar. Situação do mês: `folga`, `apertado` (as contas cabem, os potes não) ou `negativo` (as contas passam do salário; a mensagem diz para não cobrir com cartão ou cheque especial).
- **Cofrinho das contas anuais:** o depósito do mês é o que falta guardar dividido pelos meses que restam, contando o atual e o do vencimento. Quem cadastra o IPVA de janeiro em outubro guarda 1/4 por mês, e não 1/12; mês pulado se espalha pelos seguintes; no mês do vencimento o item vira o pagamento. O ciclo são os 12 meses que terminam no próximo vencimento, e os depósitos são lidos dos próprios tiques.
- **Tique guarda o valor do momento**, para o total de um mês passado não mudar quando a conta for editada depois.
- **Reserva:** custo de vida = contas mensais + 1/12 das anuais; `sugestaoPilar1` já devolve [A]/[B]/[C] nas faixas da pergunta, para a Etapa 4.
- **Cópia de segurança:** "Salvar cópia" baixa um JSON (`formato: carteiraideal.meumes`) e "Restaurar cópia" valida campo a campo antes de substituir; arquivo inválido não altera nada. Motivo: com meses de histórico, perder o aparelho ou limpar o navegador não pode apagar tudo sem aviso.
- `state/useOrcamento.ts`: chave própria `carteiraideal.orcamento` (versão 1). O `carteiraideal.estado` (versão 2) não mudou, nenhum usuário perde respostas, e a versão React Native segue compatível pela interface `storage`.
- `screens/MeuMes.tsx`: tela avulsa (`TELAS_AVULSAS`), aberta por `./app/?tela=meuMes`. **Ainda sem botão na landing** (Etapa 4): dá para testar em produção sem divulgar. No computador, checklist e cadastro à esquerda, caminho do salário, potes e cópia à direita (`desk-split` da D20).
- CSS no bloco "D21" no fim de `index.css`. Linhas de 48 px para o dedo, foco visível, `prefers-reduced-motion` respeitado; campos de valor com 16 px para o iPhone não dar zoom.

**Não mudou.** `engine.ts`, API, questionário, jobs, landing e o formato dos dados salvos do questionário.

**Conferido.** 196 testes do app (36 do motor do orçamento e 11 da tela, novos) e 106 dos scripts passando; typecheck e lint sem erros; build de produção; capturas em 390×844 (claro e escuro) e 1440×900, sem erro de JavaScript.

**Etapa 2, cartão de crédito (26/09/2026, mesma conversa, a pedido do responsável).**
- **Modelo.** `Orcamento.cartao = { teto, compras }`. Cada compra guarda descrição, valor total, mês da compra e número de parcelas (1 = à vista, até 12 na tela e 24 na validação). A parcela de cada mês é arredondada para baixo em centavos e a última leva a diferença, para a soma bater.
- **Fatura.** As compras de um mês (à vista e parcelas que caem nele) formam a fatura paga no mês seguinte. Ela entra na lista do mês como mais uma conta a ticar (id reservado `cartao:fatura`) e no caminho do salário antes dos potes (`ResumoDoMes.fatura`). Simplificação deliberada: não há dia de fechamento. Isso foi explicado na tela ("é pago com o salário do mês seguinte"), e é assim que a maioria das pessoas pensa a fatura. Fatura ticada guarda o valor, como as demais contas.
- **Teto.** Escolhido pela pessoa, com a dica de que não é o limite do banco. `tetoSugerido` = pote Gastar de um mês típico (salário − contas mensais − 1/12 das anuais − Guardar − Fazer Crescer), arredondado para baixo em R$ 10. A sugestão só aparece sem teto ou com teto acima do que cabe: um teto mais prudente não recebe aviso.
- **Semáforo.** Verde até 70% do teto, amarelo até 100%, vermelho acima. No vermelho, a mensagem diz quanto passou, qual salário vai apertar e para parar de usar o cartão no mês.
- **Parcelamento.** Permitido nesta etapa, com aviso na hora de lançar (quantos meses compromete e o valor aproximado por mês) e a lista "Parcelas que você já assumiu" para os 12 meses seguintes. O pacto de não parcelar e a fricção ficam para a Etapa 3 (Modo Recuperação).
- **Compatibilidade.** Dados e cópias da Etapa 1, sem `cartao`, continuam válidos: a validação preenche um cartão vazio. Por isso a chave `carteiraideal.orcamento` segue na versão 1.
- **Ajuste visual após conferência em navegador.** O valor "gasto de teto" saiu do lado do título (quebrava mal em 390 px) e foi para uma linha própria acima do semáforo. `.mm-link` deixou de usar `font: inherit`, que anulava o tamanho de `.tiny`/`.small` nos links "Remover", "voltar para o mês atual" e "Apagar tudo".
- **Conferido.** 213 testes do app (11 novos do motor e 6 novos da tela) e 106 dos scripts; typecheck e lint sem erros; build de produção; capturas em 390×844 e 1440×900 com fatura, parcelas e semáforo vermelho, sem erro de JavaScript.

**Etapa 3, Modo Recuperação (26/09/2026, nova conversa).**
- **Onde está.** Regras das dívidas em `domain/recuperacao.ts` (funções puras, sem importar nada do orçamento); ligação com o caminho do salário em `domain/orcamento.ts`; blocos de tela em `screens/MeuMesRecuperacao.tsx`. O campo de valor em reais saiu do `MeuMes.tsx` para `ui/CampoReais.tsx`, usado pelos dois.
- **Modelo.** `Orcamento.recuperacao = { ligadoManual, dividas, metodo, pactoDesde }` e `potes.quitar`, ambos opcionais: dados e cópias das Etapas 1 e 2 voltam idênticos, sem campos novos, e a chave `carteiraideal.orcamento` segue na versão 1. Cada dívida guarda nome, tipo, saldo de hoje, maior saldo já registrado (régua da barra de progresso), juros ao mês e parcela mínima. A pessoa atualiza o saldo pelo extrato em "Editar"; o tique do pagamento não mexe no saldo, porque juros, multas e IOF reais só o extrato sabe.
- **Dívida cara.** Tipos da opção [A] do Pilar 2, pelo texto literal da pergunta (rotativo e fatura parcelada do cartão, cheque especial, empréstimo pessoal, dívida em dólar), são caros mesmo com juros digitados baixos; qualquer outra dívida é cara a partir de 3% ao mês (`LIMIAR_JUROS_CARO`, cerca de 42% ao ano, quase o triplo da Selic de 2026). Consignado e financiamento de carro ou imóvel, na casa de 1% a 2% ao mês, ficam abaixo, como na opção [B].
- **Quando liga.** Com dívida cara em aberto ou ligado pela pessoa ("Ligar o Modo Recuperação sem cadastrar dívida"). Desliga sozinho quando a última dívida cara zera, com mensagem de comemoração e a volta do Fazer Crescer. Ligado à mão, desliga pelo botão.
- **As três fases**, no topo da tela: (1) mini-reserva de metade de um mês de custo de vida, arredondada para cima em R$ 100, nunca menos de R$ 500; (2) quitar as dívidas caras; (3) completar a reserva de 3 meses e voltar a investir, já fora do modo. O custo de vida passou a incluir as parcelas mínimas das dívidas, que também não podem parar num imprevisto: isso muda a régua da reserva e o teto sugerido do cartão só para quem tem dívida cadastrada.
- **Caminho do salário.** As parcelas mínimas saem junto com as contas (linha "Parcelas mínimas das dívidas", em violeta). No modo, o 🔴 pote Quitar ocupa o lugar do 🟡 Fazer Crescer; o valor planejado do Fazer Crescer fica guardado e volta quando o modo desliga. Cada dívida aparece na lista do mês para ticar, com a parte da mínima e a do pote Quitar; o tique guarda o valor, como nas contas.
- **Plano de quitação.** Simulação mês a mês: os juros entram, paga-se a mínima de cada dívida, e o resto vai inteiro para a primeira da ordem de ataque; quando uma zera, a parcela dela reforça a seguinte. Avalanche (juros mais altos primeiro) e bola de neve (menor saldo primeiro) aparecem lado a lado, com meses até o fim, data, juros totais e a primeira dívida quitada; a tela diz quanto a avalanche economiza e quantos meses antes vem a primeira vitória da bola de neve, e deixa a escolha com a pessoa ("a que você vai conseguir seguir até o fim"). Também mostra quanto custaria pagar só as mínimas e avisa quando o plano não termina (horizonte de 30 anos). Simplificações ditas na tela: juros constantes, sem multas, IOF ou compras novas.
- **Correção após conferência em navegador.** Na primeira versão, o plano mandava o pote Quitar também para o financiamento do carro depois das dívidas caras, e mostrava "tudo quitado" num prazo irreal: o modo desliga quando as caras acabam e o dinheiro volta para o Fazer Crescer, e não para antecipar dívida barata. Agora, no modo e com dívida cara, o plano ataca só as caras; as baratas seguem com a parcela em dia e a tela diz que ficam fora do plano. Ligado à mão sem dívida cara, o plano abrange todas.
- **Aviso da mínima.** Quando a parcela mínima não cobre nem os juros do mês, o cadastro e a lista avisam que a dívida cresce mesmo pagando em dia.
- **Taxas de referência.** Quem não sabe a taxa encontra uma referência aproximada por tipo (rotativo 14%, fatura parcelada 9%, cheque especial 8%, empréstimo pessoal 6% ao mês), a partir das médias do Banco Central do início de 2026 arredondadas para baixo, com o cheque especial no teto legal. A taxa só é trocada ao mudar o tipo enquanto a pessoa não digitou a dela. Revisão semestral em docs/06.
- **Pacto de não parcelar.** Oferecido no cartão enquanto o modo está ligado. Com o pacto, a forma de pagamento só mostra "À vista"; parcelar exige tocar em "Quebrar o pacto nesta compra" e confirmar um aviso, e vale só para aquela compra. A tela conta as compras parceladas desde o mês do pacto (derivado das próprias compras, sem campo novo). O pacto continua valendo depois que o modo desliga, até a pessoa desfazê-lo.
- **Roteiro de negociação**, fechado por padrão, só para quem tem dívida ou está no modo: Registrato (gov.br prata ou ouro), direito de reduzir ou cancelar o limite do cheque especial, proposta por escrito com CET, Serasa Limpa Nome com alerta de golpe de boleto, consumidor.gov.br e Lei 14.181/2021 (Procon e Defensoria Pública; financiamento imobiliário, crédito rural e dívidas com garantia ficam de fora). Aviso final: conteúdo educativo, não é assessoria jurídica e não indica banco nem produto de crédito.
- **Preparação da Etapa 4.** `sugestaoPilar2`: [A] com dívida cara, [C] sem dívidas e custo de vida até metade do salário, [B] no resto. Ainda não usada na tela.
- **Não mudou.** `engine.ts`, API, questionário, jobs, landing e formato dos dados do questionário.
- **Conferido.** 256 testes do app (43 novos: 28 do domínio e 15 da tela) e 106 dos scripts passando; typecheck e lint sem erros; build de produção; capturas em 390×844 (claro e escuro) e 1440×900 com três dívidas, pacto feito e mês apertado, sem erro de JavaScript (o único erro de console foi a Google Fonts bloqueada pela rede do ambiente de teste).

**Etapa 4, pontes, landing, trilha e Instagram (26/09/2026, mesma conversa da Etapa 3).**
- **Sugestão, e não preenchimento.** Nas perguntas dos Pilares 1 e 2, quem tem Meu Mês neste aparelho vê o quadro "Pelo seu Meu Mês, a opção X combina", com o motivo em números (ex.: "sua reserva de R$ 600,00 paga 0,3 mês do seu custo de vida"). A opção ganha a etiqueta "Sugestão do Meu Mês" e borda tracejada, mas nada é marcado sozinho: a resposta é da pessoa, que pode discordar (a reserva pode estar em outro lugar, a dívida pode já ter sido renegociada). As faixas vêm de `sugestaoPilar1` e `sugestaoPilar2`, para o Meu Mês e o questionário nunca discordarem. Sem Meu Mês, com versão desconhecida ou dado corrompido, o questionário fica exatamente como antes.
- **Nada sai do aparelho.** O orçamento é lido só no navegador (`useSugestoesMeuMes`, só leitura). A API continua recebendo apenas as letras escolhidas, como sempre; o formato das respostas não mudou.
- **Resultado → Meu Mês.** Cartão "Antes de investir" com o botão "Abrir o Meu Mês", só para quem respondeu [A] no Pilar 2 (texto sobre dívida cara) ou, sem isso, [A] no Pilar 1 (texto sobre reserva). Quem respondeu diferente não vê nada: o investidor que chega pela bio segue sem conteúdo de dívida pelo caminho. Não mexe no motor; o veto continua binário (ver docs/06, bloco 4).
- **Botão na landing.** "🗓️ Meu Mês · Contas do mês e os três potes: guardar, investir e gastar", depois do Aprender, e com subtítulo sem a palavra dívida, pelo mesmo motivo.
- **Trilha 3 "Sair das dívidas".** 9 aulas em 3 tópicos (entender a dívida, montar o plano, negociar e recomeçar), cada uma espelhando uma regra do Modo Recuperação. Como ainda não há vídeos, `AulaTrilha` ganhou `texto`, `links` e `acao`: a aula com texto já conta como disponível e aparece como "Leitura · 2 min"; quando o Short sair, basta preencher `youtubeId` e o texto fica abaixo do vídeo. Aviso próprio nas aulas dessa trilha (não é assessoria jurídica, não indica banco nem produto de crédito). O Meu Mês, com dívida cadastrada, oferece a trilha; a última aula leva ao questionário (ou a refazê-lo).
- **Conteúdo novo que entra na revisão semestral e no parecer jurídico:** limite de juros e encargos do rotativo e do parcelamento da fatura em 100% da dívida original (Lei 14.690/2023), portabilidade de crédito (comparar pelo CET), exemplo de R$ 1.000 a 8% ao mês (≈ R$ 2.518 em 12 meses) contra uma aplicação a cerca de 14% ao ano (≈ R$ 1.137 antes do IR).
- **Links oficiais num só lugar** (`data/linksOficiais.ts`), usados pelo roteiro de negociação e pela trilha.
- **Instagram.** Decisão do responsável: o conteúdo é escrito aqui, onde estão as regras do app e os cuidados regulatórios, e a arte é feita no projeto "Publicações do Carteira Ideal", que guarda a identidade visual do @acarteiraideal. O briefing (`briefing-instagram-meu-mes.md`, fora do repositório) traz carrossel de lançamento, stories, os 9 roteiros de Shorts da trilha, legendas, frases proibidas e avisos obrigatórios.
- **Não mudou.** `engine.ts`, API, jobs, formato dos dados do questionário (`carteiraideal.estado` versão 2) e do Meu Mês (`carteiraideal.orcamento` versão 1).
- **Conferido.** 282 testes do app (26 novos: 11 da ponte, 5 do questionário, 3 do cartão do resultado, 6 da trilha e 1 do Meu Mês) e 106 dos scripts passando; typecheck e lint sem erros; build de produção; capturas em 390×844 e 1440×900, claro e escuro (landing, Pilares 1 e 2, resultado, Meu Mês, Aprender, trilha e aula), sem erro de JavaScript.

**Ajustes após o primeiro uso real (26/09/2026, depois da publicação da Etapa 4).** Pedidos do responsável ao testar no celular e no computador:
- **Editar conta a partir da lista do mês.** O "Editar" só existia no bloco Minhas contas, no fim da tela, e o formulário abria lá embaixo sem aviso. Agora cada conta da lista do mês tem "Editar" ao lado (fora da área que tica, para não marcar a conta por engano), e tocar em "Editar" leva a tela até o formulário, com o título "Editar conta: nome" e o campo do nome em foco.
- **Cadastro livre de contas.** Os atalhos vinham antes do campo do nome e pareciam obrigatórios: a pessoa achava que só podia cadastrar as contas da lista. O campo "Nome da conta" vem primeiro, com exemplos (Academia, Diarista, Pensão, Streaming), e só 6 atalhos aparecem, com "Mais N atalhos" para o resto.
- **Minhas contas logo abaixo da lista do mês**, antes das dívidas e do cartão.
- **Lista suspensa ilegível no tema escuro.** As opções (meses, tipo de dívida, parcelas) abriam com texto claro sobre fundo claro em alguns navegadores. Agora têm sempre texto escuro sobre fundo branco. Reforçado depois de um novo relato no Chrome do computador: `color-scheme: light` nas listas suspensas e cores das opções com `!important`, para nenhum estilo do tema escuro vencer.
- **Conta paga no cartão de crédito.** Conta mensal ganhou "Como você paga: Boleto, Pix ou débito | Cartão de crédito" (`Conta.cartaoDesde`, mês "AAAA-MM", opcional). A partir desse mês, a conta sai da lista do mês (não sai do salário duas vezes), entra no gasto do cartão (conta para o teto e o semáforo, e aparece como "Conta de todo mês" na lista do cartão) e é paga na fatura do mês seguinte. Os meses anteriores continuam como eram, e um tique já feito no mês continua valendo. O teto sugerido soma essas contas ao pote Gastar, e "Parcelas que você já assumiu" mostra só as parcelas de compras. Só para contas mensais: conta anual no cartão bagunçaria o cofrinho. Dados e cópias anteriores voltam idênticos; a chave segue na versão 1.
- **Conferido.** 293 testes do app (11 novos) e 106 dos scripts; typecheck e lint sem erros; build de produção; captura em 390×844 no tema escuro, sem erro de JavaScript.
- **Conta anual paga no cartão (pedido seguinte do responsável).** A primeira versão deixou as contas anuais de fora; o responsável pediu para incluir, porque a pessoa pode pagar IPVA ou IPTU no cartão à vista ou parcelar, e parcelado os juros são mais altos. `Conta.cartaoAnual = { parcelas, total, desde }`, só para anuais, opcional.
  - **Cartão à vista:** o cofrinho continua igual. No mês do vencimento, a conta vai para o cartão; no mês seguinte, o que foi guardado no ciclo paga essa parte da fatura (`coberturaDoCofrinho`), e só a diferença sai do salário. Sem isso, o dinheiro sairia duas vezes (no cofrinho e na fatura).
  - **Cartão parcelado (2 a 12 vezes):** a pessoa informa o total cobrado com juros e taxas, e a tela mostra quanto paga a mais, em reais, em % do valor e em juros ao mês (`jurosDoParcelamento`, taxa que iguala as parcelas ao valor à vista). Sem cofrinho: as parcelas entram nas faturas a partir do mês seguinte ao vencimento; o que já estava guardado no ciclo abate as primeiras parcelas. O custo de vida passa a usar o total com juros (`custoAnual`). Com o pacto de não parcelar, parcelar pede confirmação. A tela lembra de conferir desconto à vista ou parcelamento sem juros no boleto do órgão.
  - **Teto e semáforo:** as contas do ano no cartão aparecem na lista do cartão e no total da fatura, mas ficam fora do teto (`gastoNoTeto`), porque são planejadas: o IPVA não pode acender o vermelho em janeiro. Parcelas já assumidas entram em "Parcelas que você já assumiu" a partir do vencimento.
  - **Mudar o jeito de pagar** vale a partir do mês em que a pessoa muda; os meses anteriores continuam como eram.
  - **Conferido.** 303 testes do app (10 novos) e 106 dos scripts; typecheck e lint sem erros; build; capturas em 390×844 (formulário do parcelado e cartão em janeiro com IPVA 1 de 10), sem erro de JavaScript.

- **Juros ao ano no cadastro da dívida.** Financiamento e consignado costumam informar a taxa ao ano; o campo só aceitava ao mês. Agora há "Ao mês | Ao ano". A taxa ao ano é convertida para a equivalente ao mês por juros compostos (`jurosMensalDeAnual`: 12% ao ano ≈ 0,9489% ao mês, e não 1%), e a tela mostra a equivalência nos dois sentidos ("3% ao mês equivalem a 42,58% ao ano"). O dado continua guardado ao mês (`jurosMensal`), sem mudar o formato; a referência por tipo segue ao mês e, ao ser usada, volta o campo para "Ao mês". 307 testes do app (4 novos).

**Segunda rodada de ajustes (26/09/2026).** Relato do responsável: "cadastro uma conta no cartão, divido, e ela não aparece debitando do meu teto".
- **Parcelas da conta do ano passam a contar no teto.** Revisão do item "Teto e semáforo" acima. Regra nova e única para `gastoNoTeto`: entra no teto tudo o que vai sair do salário na fatura seguinte. Compras, parcelas e contas mensais no cartão entram inteiras; das contas do ano no cartão, só a parte que o cofrinho não cobre (`coberturaDaConta`, extraída de `coberturaDoCofrinho`). Efeito: à vista com cofrinho completo continua fora do teto (o IPVA à vista não acende o vermelho); parcelada entra com a parcela do mês, porque não tem cofrinho e é salário do mês seguinte comprometido. Justificativa de consultoria: a parcela de conta do ano no cartão é dívida nova e compete com o dia a dia; escondê-la do semáforo dava falsa folga. O `tetoSugerido` soma o 1/12 das contas parceladas no cartão (o custo de vida já separa esse 1/12; ele passa a circular pelo cartão), com arredondamento em centavos antes do piso de R$ 10.
- **Quando a parcela aparece.** A 1ª parcela entra no gasto do cartão (e no teto) no mês do vencimento e é paga na fatura do mês seguinte, como as compras. Se o vencimento é este mês, aparece já; se é futuro, só no vencimento. O formulário do parcelado mostra isso antes de salvar (`quandoApareceNoCartao`).
- **Parcelamento que já começou.** Antes, uma conta parcelada em agosto e cadastrada em setembro só aparecia no vencimento do ano seguinte. Quando o último vencimento já passou e ainda tem fatura (`parcelamentoPodeTerComecado`), a tela pergunta "Você já está pagando o parcelamento de agosto?" (padrão: "Não, é o próximo", porque um IPVA de janeiro cadastrado em outubro costuma ser o próximo). Com "Sim", o início (`desde`) volta ao vencimento (`inicioDaAnualNoCartao`) e as parcelas que faltam aparecem nos meses certos. Editar e salvar uma conta antiga com "Sim" corrige o início dela.
- **"Apagar tudo e começar de novo"** saiu do link cinza pequeno para uma caixa amarela com texto escuro (`.mm-apagar-tudo`), no desenho do botão principal. Continua pedindo confirmação.
- **Texto de abertura do Meu Mês** de 12px para 15px (`.mm-abertura`).
- **Subtítulo do botão da landing** agora é "Contas do mês e planejamento financeiro" (substitui o texto registrado na Etapa 4). Continua sem a palavra dívida.
- **Conferido.** 314 testes do app (7 novos) e 106 dos scripts; typecheck e lint sem erros; build de produção. Formato dos dados sem mudança (chave na versão 1).

**Terceira rodada (26/09/2026): a mesma parcela não conta duas vezes.** Pergunta do responsável: o atalho "Aluguel ou financiamento" em Minhas contas e o financiamento em Minhas dívidas não somam duas vezes? Somavam: a parcela de cada dívida já entra na lista do mês junto com as contas (`itensDoMes`), no custo de vida e na régua da reserva.
- **Atalho** passou a ser só "Aluguel". Financiamento, empréstimo e consignado vão em Minhas dívidas, onde entram saldo, juros e parcela, e onde o plano de quitação consegue enxergá-los.
- **Aviso no cadastro da conta:** nome que parece parcela de dívida (`pareceDivida`: financiamento, empréstimo, consignado, prestação, consórcio, crédito pessoal) mostra que o lugar certo é Minhas dívidas; se já há dívida desse tipo, avisa que a parcela contaria duas vezes.
- **Aviso na lista de Minhas contas:** conta mensal com esse nome, havendo dívida em aberto de parcela fixa (financiamento, consignado, empréstimo pessoal ou outra), aparece numa faixa amarela pedindo para remover se for a mesma (`contasEmDobroComDividas`). Cobre quem cadastrou pelo atalho antigo.
- **Aviso no cadastro da dívida:** ao cadastrar dívida desses tipos com uma conta parecida em Minhas contas, a tela aponta a conta pelo nome.
- Nada é removido sozinho: o app só avisa (mesma regra da Etapa 4, de não marcar nada pela pessoa). Formato dos dados sem mudança.
- **Conferido.** 318 testes do app (4 novos) e 106 dos scripts; typecheck, lint e build sem erros.

**Quarta rodada (26/09/2026): valor da parcela no lugar do total.** Relato: seguro do carro de R$ 1.200 em 12x de R$ 120 apareceu como 12x de R$ 10. O campo pedia o "total cobrado no cartão", e o responsável digitou a parcela (R$ 120), que o app dividiu por 12. A tela ainda mostrava "Sem juros?", porque o total era menor que a conta.
- O campo passou a ser **"Valor de cada parcela no cartão"**, que é o número que aparece na simulação do cartão. Logo abaixo, a conta fica à vista: "12x de R$ 120,00 = R$ 1.440,00 no total". O dado gravado continua sendo o total (`cartaoAnual.total` = parcela × vezes), sem mudar o formato.
- **Trava:** total abaixo do valor da conta (folga de 1 centavo por parcela para arredondamento) mostra um alerta vermelho e bloqueia o salvar, porque o cartão não cobra menos que a conta.
- **Conta já gravada errada:** aparece em Minhas contas com "Total menor que a conta: toque em Editar e confira o valor da parcela". Ao editar, o alerta aparece até corrigir.
- **Conferido.** 320 testes do app (2 novos, 3 ajustados) e 106 dos scripts; typecheck, lint e build sem erros.
- **Parcelado sem juros** (pergunta seguinte do responsável): funciona digitando a parcela sem juros (1.200 em 12x = R$ 100). A mensagem "Sem juros? Confira..." soava como desconfiança; agora confirma ("Sem juros: 12x de R$ 100,00, o mesmo valor da conta"), lembra de perguntar pelo desconto à vista (o custo escondido do sem juros) e, só para imposto no cartão, da taxa de serviço. Arredondamento testado (1.000 em 3x de 333,33 grava 1.000). 322 testes do app.

**Quinta rodada (26/09/2026): editar compras do cartão.** Pedido do responsável: compra lançada no cartão só podia ser removida; quem digitava errado tinha de apagar e lançar de novo.
- Cada compra da lista "No cartão em ..." ganhou **Editar** no lugar de Remover, no mesmo padrão de Minhas contas: o formulário vira "Editar compra: nome", carrega descrição, valor e forma de pagamento, e oferece "Salvar alterações", "Cancelar" e "Remover" (com a mesma confirmação de antes). Estado: `editarCompra` em `useOrcamento`.
- **A compra continua no mês em que foi feita.** Editar uma parcela vista em outro mês (a geladeira de setembro na lista de outubro) não muda o mês da compra; a tela avisa isso. As parcelas seguem a partir do mês original.
- **Pacto de não parcelar:** corrigir uma compra que já era parcelada não é parcelar de novo, então a edição dela não fica travada em "à vista". Transformar uma compra à vista em parcelada, com o pacto ligado, continua pedindo para quebrar o pacto.
- **Conferido.** 325 testes do app (3 novos) e 106 dos scripts; typecheck, lint e build sem erros. Formato dos dados sem mudança.

**Sexta rodada (26/09/2026): compras à vista do mês de uma vez.** Pedido do responsável (esclarecido na segunda mensagem): quem não quer anotar compra por compra lança, de uma vez, **só o total das compras à vista no cartão do mês**. Tudo o que é parcelado continua lançado em separado: compra parcelada em "Lançar compra", com o número de vezes; conta do ano ou de todo mês no cartão em Minhas contas.
- **Parecer:** bom desenho. Separar à vista de parcelado preserva o que importa no planejamento, que são as parcelas que comprometem os meses seguintes, e tira a chatice de anotar cafezinho por cafezinho. Riscos que ficaram tratados: (1) **contar duas vezes** compras à vista já anotadas uma a uma no mês, que fazem parte do total e são descontadas; (2) **esconder um parcelamento** dentro do total, o que a tela orienta a não fazer; (3) **perder o freio** do semáforo durante o mês, lembrado só no Modo Recuperação.
- **Como ficou:** link "Lançar as compras à vista do mês de uma vez" no bloco do cartão. A pessoa digita o total à vista do mês; o que passa das compras à vista já anotadas vira "Compras à vista do mês" (`acertarPeloTotal`, `aVistaLancadasNoMes`, `totalInformado`). Tecnicamente é uma compra à vista com id fixo por mês (`total-AAAA-MM`): o formato dos dados não muda, e teto, semáforo, fatura e Caminho do salário funcionam sem nada novo. Parcelas de compras, parcelas de contas do ano e contas mensais no cartão somam por cima, como antes.
- Total menor que as compras à vista já anotadas é barrado (alerta vermelho). Compra à vista anotada depois, no mesmo mês, sai do lançamento de uma vez e o total se mantém; compra parcelada não mexe nele. "Atualizar total à vista" e "Voltar a anotar uma por uma" (com confirmação; as compras anotadas ficam).
- Primeira versão desta rodada (descartada no mesmo dia): lançava o total da fatura inteira e descontava contas e parcelas. O responsável esclareceu que a ideia era só o à vista, o que é mais simples e mais seguro.
- **Conferido.** 330 testes do app (5 novos) e 106 dos scripts; typecheck, lint e build sem erros.

**Sétima rodada (26/09/2026): compras à vista do mês passado no primeiro mês.** Relato do responsável, no primeiro mês de uso: a fatura de setembro traz as compras à vista de agosto, e ele não achou onde lançá-las. Dava para voltar o mês com a seta ‹ e lançar em agosto, mas ninguém descobre isso sozinho.
- No mês atual, o bloco do cartão mostra o atalho "Primeiro mês no app? Lance as compras à vista de agosto, que você paga na fatura de setembro". É o mesmo lançamento de uma vez da sexta rodada, feito para o mês passado: entra na fatura deste mês (Contas do mês e Caminho do salário) e não mexe no gasto nem no teto do mês atual.
- Depois de lançado, o atalho vira "Compras à vista de agosto (fatura de setembro): R$ X. Corrigir". Some quando o mês passado já tem compras à vista anotadas uma a uma (a pessoa já lança por lá).
- **Conferido.** 332 testes do app (2 novos) e 106 dos scripts; typecheck, lint e build sem erros. Formato dos dados sem mudança.

**Oitava rodada (26/09/2026): caixa "Começando agora no app?" e parcelamentos em andamento.** Três pontos do responsável: (1) o atalho "Primeiro mês no app?" sumiu depois de alguns lançamentos; (2) os lançamentos de uma vez deveriam ficar numa caixa simples, para não se perderem; (3) quem chega no app com compras parceladas em andamento tinha de voltar mês a mês até a data da compra para lançá-las.
- **Por que o atalho sumia:** ele se escondia quando o mês passado já tinha compras à vista anotadas uma a uma. Regra trocada: a caixa "Começando agora no app?" fica sempre no mês atual, fechada, com uma linha dizendo para que serve.
- **Caixas simples** (`.mm-caixa`, borda fina, abre e fecha com + e −): "Compras à vista de setembro, de uma vez" (fechada mostra o total já lançado) e "Começando agora no app?".
- **Começando agora no app?** reúne o que vem na fatura que se paga agora: (1) compras à vista do mês passado; (2) **parcelamentos que você já estava pagando**. A pessoa informa o que vê no extrato ("parcela 4 de 10 na fatura de setembro") e o valor da parcela; o app calcula o mês da compra (`compraEmAndamento`: fatura deste mês = gasto do mês passado, então a compra é de `atual` meses atrás) e lança a compra parcelada com o total = parcela × vezes. As parcelas que faltam caem sozinhas nos meses certos, e a lançada fica editável como qualquer compra. Até 24 vezes. A caixa também explica que parcelas de contas do ano vêm de Minhas contas ("Sim, já estou pagando") e que a conta de todo mês no cartão do mês passado vai no total à vista.
- **Conferido.** 335 testes do app (5 novos, 2 reescritos) e 106 dos scripts; typecheck, lint e build sem erros. Formato dos dados sem mudança.

**Nona rodada (26/09/2026): títulos em caixinha na cor da bolinha.** Pedido do responsável: "Minhas contas" e o grupo dos cofrinhos das contas do ano no mesmo esquema do título "Minhas dívidas", uma caixinha arredondada na cor da bolinha correspondente em "Para onde vai o salário".
- "Minhas contas" em cinza (bolinha "Contas do mês", `seg-contas`). Em Contas do mês, os títulos dos grupos viram caixinhas menores: "Todo mês" em cinza, "Cofrinhos das contas do ano" no cinza mais claro (`seg-cofrinhos`), e, para a lista não ficar metade colorida, "Cartão de crédito" em laranja (`seg-cartao`) e "Dívidas" em roxo (`seg-dividas`). O fundo vem da mesma classe da bolinha e da barra; a cor do texto foi escolhida para ter contraste nos dois temas (`.mm-titulo-cor`). Conferido em captura de tela, tema escuro e claro.
- **Acerto na mesma rodada:** as caixinhas ficaram do tamanho do texto, e o pedido era igual a "Minhas dívidas". Agora são faixas na largura toda do card (os grupos de Contas do mês mantêm o texto menor, como o responsável preferiu). O título do card "Cartão de crédito" também ganhou a faixa laranja da bolinha da fatura.
- **Conferido.** 335 testes do app e 106 dos scripts; typecheck, lint e build sem erros.

**Décima rodada (26/09/2026): conta no cartão x compra parcelada.** Relato do responsável: lançou a geladeira em Minhas contas como conta de todo mês no cartão (R$ 120) e também como parcelamento no cartão; a fatura contou duas vezes.
- **Regra do app (explicada ao responsável):** cada gasto entra num lugar só. Compra parcelada no cartão vai no **cartão** ("Lançar compra" ou "Parcelamentos que você já estava pagando"), porque tem fim e o app para de cobrar depois da última parcela. Minhas contas "todo mês no cartão" é para o que se repete sem fim (streaming, academia). Conta do ano parcelada no cartão fica em Minhas contas, "Uma vez por ano". Nada disso tem tique próprio: tudo entra na "Fatura do cartão".
- **Aviso** (`compraParecidaComConta`, `contasEmDobroComCompras`): conta de todo mês no cartão com o mesmo valor da parcela (até R$ 1 de diferença) ou uma palavra do nome em comum (sem acento, palavras de 4 letras ou mais) com uma compra parcelada em andamento. Aparece em Minhas contas e no cartão (faixa amarela), dizendo que conta duas vezes e que continuaria cobrando depois da última parcela. No formulário, escolher "Cartão de crédito" mostra a regra ("Compra parcelada não vai aqui") e, se o nome ou o valor bater, o aviso específico. O app só avisa; quem remove é a pessoa.
- **Conferido.** 340 testes do app (5 novos) e 106 dos scripts; typecheck, lint e build sem erros. Formato dos dados sem mudança.

**Décima primeira rodada (26/09/2026): compra parcelada com juros.** Pedido do responsável: a compra no cartão só tinha "à vista" e "Nx", que dividia o valor, ou seja, só parcelado sem juros. Compra com juros ficava registrada abaixo do real no teto, na fatura e nas parcelas futuras.
- **Forma de pagamento com três opções** (botões, no lugar da lista): À vista, Parcelado sem juros (o app divide o valor, como antes) e Parcelado com juros. Nos parcelados, "Número de parcelas" de 2 a 24.
- **Com juros, o app pede o valor de cada parcela, não a taxa.** Decisão discutida com o responsável: a taxa confunde (ao mês ou ao ano? com IOF? CET?), e a parcela está na maquininha, no site ou na simulação. O app mostra "12x de R$ 115,00 = R$ 1.380,00 no total" e "Você paga R$ 180,00 a mais (15% sobre o preço), cerca de 2,22% ao mês" (`parcelamentoComJuros`, com a mesma conta de `jurosDoParcelamento`). A partir de 3% ao mês, avisa que é juro de dívida cara; no Modo Recuperação, que é dívida nova com juros.
- **Travas** iguais às das contas do ano: total abaixo do preço (folga de 1 centavo por parcela) é barrado com alerta vermelho; total igual ao preço avisa que é sem juros.
- **Dados:** a compra continua guardando o total em `valor` (parcela × vezes), então fatura, teto, parcelas futuras e os avisos funcionam sem mudança. Campo novo e opcional `valorAVista`, só em compra com juros, para mostrar "com juros" na lista e reabrir a compra certa ao editar. Compras antigas continuam válidas; o backup aceita o campo e recusa valor inválido.
- "Parcelamentos que você já estava pagando" (Começando agora no app?) já pedia o valor da parcela e continua igual: serve com ou sem juros.
- **Conferido.** 346 testes do app (6 novos, 4 ajustados) e 106 dos scripts; typecheck, lint e build sem erros; captura de tela no celular.

**Décima segunda rodada (26/09/2026): reserva acima da mini-reserva com dívida cara.** Pergunta do responsável: se a pessoa tem reserva e não consegue pagar a fatura, a reserva não deveria ir para a dívida? Resposta: o app não mexe no dinheiro (a reserva é um número informado), e a mini-reserva (metade do custo de vida, mínimo R$ 500) fica guardada de propósito, para um imprevisto não virar dívida nova. A lacuna era outra: reserva **acima** da mini-reserva ficava parada, rendendo perto de 1% ao mês, enquanto a dívida cara cobrava muito mais, e o app só dizia "Pronta".
- **Aviso no painel do Modo Recuperação** (`excedenteDaReserva`): com dívida cara em aberto e reserva acima da mini-reserva, mostra quanto sobra, a sugestão de uso na ordem dos juros mais altos (avalanche, marcando as dívidas que quita) e os juros evitados por mês. Só as dívidas caras entram: consignado e financiamento baratos não. Orienta pagar pelo canal oficial e pedir desconto para quitar à vista.
- **"Já paguei: atualizar reserva e dívidas"** (`usarExcedenteDaReserva`), com confirmação: baixa a reserva e os saldos. Se a pessoa pagou outro valor, ajusta à mão. Quando a última dívida cara acaba, o Modo Recuperação desliga sozinho, como antes. Quitada uma dívida, a parcela mínima dela sai do custo de vida e a mini-reserva diminui: o aviso pode voltar com o pequeno excedente novo, o que é correto.
- **Conferido.** 351 testes do app (5 novos) e 106 dos scripts; typecheck, lint e build sem erros; captura de tela no celular.

### D22 · Análise jurídica sem objeção; site 100% gratuito, sem link de curso pago (26/09/2026)

**Parecer.** A análise jurídica foi feita pelo próprio responsável pelo projeto, que é advogado, em 26/09/2026: sem objeção à fronteira com a consultoria de valores mobiliários (Resolução CVM 19/2021) e à relação com o suitability (Resolução CVM 30/2021), abrangendo também o Meu Mês (plano de quitação, roteiro de negociação), a trilha "Sair das dívidas" e a sugestão dos Pilares 1 e 2. Por ser do próprio autor, é uma análise interna, e não um parecer independente. Recomendação registrada: buscar um parecer independente de especialista em mercado de capitais antes de monetizar, de uma divulgação paga em escala ou de qualquer mudança na natureza do conteúdo (ranking de ativos, recomendação individual, cobrança).

**Projeto gratuito, sem captação de contato.** Não entra captação de e-mail. O único pedido ao visitante é seguir o @acarteiraideal no Instagram, que libera o livro por confiança e não coleta nenhum dado. Com isso, a LGPD não se aplica no modelo atual: nada pessoal sai do aparelho e a API não grava nada. O item "captação de contatos" do docs/06 foi descartado.

**Link do curso de Candlesticks retirado.** As regras de uso justo da Vercel restringem o plano Hobby a uso pessoal e não comercial, e dão como exemplos de uso comercial anunciar a venda de um produto ou serviço e usar links de afiliado. O curso na Udemy (curso pago do responsável, com código de indicação e `rel="sponsored"`) aparecia no "riqueza" do rodapé da landing e em "Mais conteúdo" no Aprender. Das opções avaliadas (perguntar ao suporte da Vercel, migrar para o Pro ou retirar o link), o responsável escolheu retirar: o site fica 100% gratuito e sem divulgação de produto pago, e o curso passa a ser divulgado só pelo Instagram.
- Landing: a frase "O estudo é sua maior riqueza" continua, sem link; o subtítulo do Aprender virou "Aulas curtas e livro infantil grátis".
- App: o botão "Curso de Candlesticks" e a constante `URL_CURSO_CANDLESTICKS` saíram de `ui/MateriaisExtras.tsx`. Um teste garante que o Aprender não tem link para a Udemy nem link patrocinado.
- **Gatilho para migrar ao Pro:** anúncio, link de afiliado, venda de produto ou serviço, pagamento a quem produz o site. Enquanto nada disso existir, o plano Hobby segue adequado.

**Não mudou.** Motor, API, jobs, Meu Mês, questionário e formato dos dados salvos.

### D23 · ETFs da B3: 40 mais negociados, dados oficiais da B3 (27/09/2026, concluída)

**Contexto.** Segunda frente de renda variável (D19), com as mesmas regras: telas estritamente descritivas, dado bruto, ordem por liquidez, agrupamento por categoria, sem ranking nem múltiplos. BDRs de ETF (final 39) continuam na aba de BDR; aqui ficam os ETFs brasileiros (BOVA11, IVVB11, HASH11 e afins).

**Mudança de fonte: brapi → B3.** Em 27/09/2026 o painel da brapi avisou que o plano gratuito cairá "em breve" de 15.000 para **1.000 requisições/mês**, sem data. Só o job de BDRs gasta cerca de 2.900. O plano Startup (R$ 119,99/mês) foi descartado pelo responsável: o preço e o volume passam a vir de arquivos públicos da B3, sem cota, e a brapi fica só para o que a B3 não traz (nome longo dos ETFs, setor dos BDRs), com poucas requisições por mês. A migração começa pelos ETFs; o job de BDRs migra em seguida.

**Testes (27/09/2026, com os arquivos do pregão de 25/09).**
- **brapi, plano gratuito:** `/api/v2/tickers?subType=etf` funciona (257 ETFs em 3 páginas de 100, com `longName`); só 1 ativo por requisição; o `volume` é quantidade e às vezes vem errado de escala (FNAM11: 79,5 milhões na brapi, contra 79,6 mil cotas e R$ 28,7 mil na B3).
- **COTAHIST diário da B3** (`https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_DDDMMAAAA.ZIP`, 0,6 MB): traz fechamento, mínima, máxima e **volume em reais** dos ETFs de bolsa, exterior, cripto e ouro e dos BDRs, idênticos à brapi no preço. **Não traz nenhum ETF de renda fixa** (0 de 27), que a B3 trata como instrumento de renda fixa.
- **Boletim de Preços da B3** (BVBG.086.01, `https://www.b3.com.br/pesquisapregao/download?filelist=PRAAMMDD.zip,`, 12,7 MB compactado, 4 versões de ~136 MB no dia): traz **todos** os instrumentos, inclusive os ETFs de renda fixa (LFTS11: R$ 160,46 e R$ 18,1 mi), com `LastPric`, `MinPric`, `MaxPric` e `NtlFinVol` (volume em reais, lote padrão mais fracionário). Os 86 ETFs do config estão no arquivo. Versões do dia às 18h39, 19h06, 19h24 e 20h33 de Brasília; 69 dos 1.643 códigos de fundos e BDRs mudam de volume entre a primeira e a última (ajustes pequenos), o preço de fechamento não. Usar sempre a última versão.
- **Acesso pelo GitHub Actions:** um repositório público (cvscarlos/b3-api-dados-historicos) baixa esses arquivos todo dia às 22h18 de Brasília; o último commit automático (26/09) já tinha o pregão de 25/09. Lições registradas por ele: dia sem pregão devolve HTTP 200 com zip vazio de 22 bytes; a página de séries históricas passou a ter captcha, a URL direta continua funcionando.
- **Liquidez em reais no dia 25/09 (boletim):** o 40º ETF negociou R$ 3,3 mi; 71 dos 86 classificados passaram de R$ 500 mil.

**Decisão.**
- **Fonte diária:** Boletim de Preços (última versão do dia), lido em fluxo, sem carregar o XML inteiro na memória. Um arquivo só para ETFs (inclusive renda fixa), BDRs e, no futuro, ações e FIIs.
- **Histórico próprio:** o job guarda fechamento, mínima, máxima e volume em reais de cada pregão, e calcula dele a média de 21 pregões, a variação de 3 meses e a faixa de 52 semanas. Carga inicial feita uma vez, por execução manual.
- **Horário:** dias úteis às 22h de Brasília (depois da última versão do boletim).
- **Universo:** os 40 ETFs de maior volume financeiro médio nos últimos 21 pregões completos, acima de R$ 500 mil/dia. Os demais ficam na busca.
- **Fora da lista (`excluir`):** FNAM11 e FNOR11 (cotas dos antigos FINAM e FINOR; especificação "CI *" na B3) e 12 FICs de debêntures de infraestrutura (BODB11, BODI11, CDII11, CPDI11, BDIF11, DIVS11, IFRA11, ISEN11, BINC11, SNID11, CPTI11, IFRI11), classificados como ETF pela brapi, com tributação própria (isenção de IR para PF, Lei 12.431/2011). Nome novo com "Infra", "Incentivad", "Direitos Creditórios", "FINAM" ou "FINOR" gera `[revisar]` no log.
- **Categorias, índice acompanhado e câmbio:** manuais no config (a B3 e a brapi não classificam). Sem categoria: "Outros" e `[categoria]` no log; sem índice ou câmbio, o cartão omite a linha e o log mostra `[indice]` ou `[cambio]`.
- **ETFs de controle:** BOVA11, SMAL11, IVVB11, HASH11, LFTS11 e GOLD11; menos de 5 válidos, o job falha sem gravar.
- **Sem taxa de administração** na primeira versão.

**Pendências.** Termos de uso da B3 para exibir preços de fechamento em site público (leitura do responsável, na linha do parecer da D22). Conferência de índices e câmbio no config antes de ligar `conferidoPeloResponsavel`. Avisos fixos de IR depois de conferir a legislação vigente.

### D24 · BDRs migrados para o Boletim de Preços da B3 (27/09/2026)

**Contexto.** Pendência da D23: o job de BDRs (D19) gastava cerca de 130 requisições da brapi por pregão (1 listagem + 1 por candidato), perto de 2.900 por mês. Com o plano gratuito caindo para 1.000 por mês, ele esgotaria a cota em cerca de 8 pregões e levaria junto os jobs de FIIs e ETFs, que usam a mesma chave.

**Decisão.**
- **Preço e volume:** Boletim de Preços da B3 (BVBG.086), o mesmo arquivo e o mesmo leitor dos ETFs (`scripts/b3-boletim.mjs`). O universo de BDRs sai do próprio boletim, pelo final do código (31 a 35 ações, 39 ETF), sem depender da brapi.
- **brapi só para o que a B3 não traz**, com cache em `historico/bdrs.json` e teto mensal próprio (`brapi.tetoMensal`, 80): nome curto e setor de todos os BDRs pela listagem (1 requisição, no máximo uma vez por semana); nome longo e proporção BDR/ação dos BDRs da lista (1 requisição cada, a cada 60 dias, até 6 por dia; 45 na carga inicial). Consumo esperado: cerca de 30 por mês. Sem token, com a cota esgotada ou com a brapi fora do ar, o job publica do mesmo jeito, com o cadastro guardado.
- **Orçamento da brapi com o plano de 1.000:** FIIs até 800 por execução mensal (teto de `config/fiis-ifix.json`, ~550 no uso real), ETFs ~66, BDRs no máximo 80. Pior caso 946: cabe, mas com pouca folga. O job de FIIs é o próximo candidato a migrar a cotação e o volume para o boletim.
- **Mesma régua de liquidez dos ETFs (D23):** volume médio dos últimos 21 pregões, dia sem negócio contando como zero. Na versão da brapi a média era sobre os dias com histórico; BDRs pouco negociados podem aparecer com média um pouco menor. A lista continua sendo os 35 de ações e os 5 de ETF acima do piso (R$ 300 mil e R$ 100 mil por dia). Ganho: a seleção agora olha a média de 21 pregões de **todos** os BDRs, e não só de 130 candidatos escolhidos pelo volume de um dia.
- **Histórico em duas camadas**, para não pesar no repositório: série longa (até 260 pregões) só dos BDRs "acompanhados" (os 150 de ações e 40 de ETF mais negociados, mais os de controle e os publicados; quem já era acompanhado só sai se cair abaixo do dobro do limite); série curta (21 pregões) dos demais. Séries alinhadas pela direita. Simulação com 880 BDRs e 260 pregões: 4,2 MB sem compactar, 1,7 MB compactado (0,5 MB em gzip), na mesma ordem do histórico de ETFs.
- **Desdobramentos:** o histórico da brapi vinha ajustado; o boletim traz preço bruto. Um salto entre dois fechamentos seguidos (queda de 45% ou mais, ou alta de 80% ou mais) gera `[desdobramento]` no log com a data e o fator sugerido, e o BDR sai sem variação de 3 meses e sem faixa de 52 semanas até o responsável confirmar o evento em `desdobramentos` (config). Confirmado, os preços anteriores são ajustados no cálculo; o histórico guardado continua bruto. O salto também antecipa a consulta da proporção na brapi, e uma proporção que muda gera `[proporcao]` no log. Escolha conservadora de propósito: ajuste automático erraria numa queda real de 50%, e a tela mostraria uma variação falsa.
- **Busca:** todos os BDRs com negócio nos últimos 63 pregões (antes: todos da listagem da brapi, inclusive sem negócio recente), com o preço e a **data do último negócio**. A tela passa a mostrar essa data no cartão resumido, em vez da data do último pregão.
- **Horário:** dias úteis às 22h30 de Brasília (depois da última versão do boletim e meia hora depois do job de ETFs). Carga inicial manual, uma vez (workflow "Carga inicial de BDRs").
- **Tela:** rodapé "Preços e volumes oficiais da B3 (Boletim de Preços); nome, setor e proporção da brapi". O arquivo antigo (sem o campo `fonte`) continua sendo lido do jeito de antes, até ser trocado.

**Mantido da D19.** Exclusões, revisados, `[revisar]` para 31 a 33, tradução de setores, grupos dos BDRs de ETF, BDRs de controle (AAPL34, MSFT34, NVDC34, AMZO34, GOGL34; menos de 4 negociados no pregão, o job falha sem gravar), faixas plausíveis, trava de dado velho (7 dias), `npm run build` antes do commit, telas estritamente descritivas.

**Mecanismo.** `scripts/atualizar-bdrs.mjs` (reescrito; entrada por `executar()`, com as dependências de rede por parâmetro para o teste de ponta a ponta), `scripts/atualizar-bdrs.test.mjs` (27 testes, inclusive carga inicial, dia a dia, feriado, desdobramento e brapi sem token com boletins sintéticos no formato BVBG.086), `config/bdrs.json` (parâmetros novos: `minimoBdrsNegociadosNoBoletim`, `acompanharAcoes`, `acompanharEtfs`, `pregoesBusca`, blocos `brapi` e `desdobramentos`; saíram `candidatosAcoes`, `candidatosEtfs`, `maxRequisicoesBrapi`, `minimoBdrsNaLista`, `horarioCorteFechamento`), workflows `atualizar-bdrs.yml` e `carga-inicial-bdrs.yml`, `domain/bdrs.ts` (campos opcionais `fonte`, `pregoesNoHistorico` e `dataCotacao` na busca) e `screens/SimuleBdr.tsx`.

**A calibrar na primeira carga.** `minimoBdrsNegociadosNoBoletim` (150) é uma estimativa conservadora, porque ainda não foi contado quantos BDRs negociam num pregão típico no boletim: o log mostra "N BDRs negociados de M no boletim" em cada dia; ajustar para cerca de metade do número típico. Conferir também as linhas `[desdobramento]` do último ano e o volume médio de 2 ou 3 BDRs num site de cotações (deve ficar perto do que a versão da brapi mostrava).

**Não testado aqui.** O download real do boletim: o ambiente de desenvolvimento não alcança o site da B3. O caminho de download é o mesmo do job de ETFs, que já rodou a carga de 260 pregões no GitHub Actions em 27/09/2026.

### D25 · Meu Mês e Aprender logo abaixo do botão principal da landing (27/09/2026)

**Contexto.** Na D21 o botão Meu Mês ficou por último, depois das ferramentas de simulação, por ser complemento e não a porta principal. Aprender também vinha depois dos quatro simuladores.

**Decisão.** Nova ordem da landing: Descobrir meu perfil (botão principal) → Meu Mês → Aprender → Simule FII → Simule Tesouro Direto → Simule BDR → Simule ETF → e-mail. Organizar o mês e aprender vêm antes de simular investimentos, na mesma lógica dos Pilares Duros (reserva e dívida cara antes de risco). O botão principal continua em primeiro e com destaque; os demais mantêm o mesmo estilo (`link-2`).

**Mecanismo.** Só `index.html` (raiz): troca de posição dos dois `<li>`, sem mudança de texto, endereço ou estilo. `script.js` e `style.css` não dependem da ordem dos botões.

### D26 · SEO: repositório antigo fechado e base técnica para o Google (28/09/2026, Etapas 0 a 4 feitas)

**Contexto.** O objetivo é o site aparecer nas buscas do Google. Diagnóstico feito com o código: (1) o repositório antigo `LeonardoDaher/Carteira-Ideal` ainda estava **público**, com o GitHub Pages ativo e a versão antiga do app, que trazia o motor de decisão legível (o motivo da mudança para a Vercel); (2) a página inicial tinha o título "Carteira Ideal — Links", sem h1 e sem texto além dos botões; (3) o app é um arquivo único renderizado por JavaScript, sem descrição, e todas as ferramentas passam por `?tela=`, então para o Google tudo é uma página só; (4) não havia `robots.txt`, `sitemap.xml`, canonical nem dados estruturados; (5) o app carregava o Google Fonts, embora as mesmas fontes já estivessem no site; (6) o endereço `carteira-ideal-app.vercel.app` (D8) servia uma cópia idêntica do site.

**Decisão.**
- **Etapa 0 (feita pelo responsável):** repositório antigo tornado privado e GitHub Pages desligado. Google Search Console: verificar o domínio (docs/05, seção 5.10).
- **Etapa 1 (técnica):** `robots.txt` (libera tudo, menos `/api/`); `sitemap.xml` gerado a cada build por `scripts/build-site.mjs` (a home, o `/app/` e todas as páginas da Etapa 3, cada uma com a sua data; os endereços com `?tela=` ficam de fora de propósito); canonical, título, descrição e Open Graph no app (`webapp-src/index.html`), o que também melhora a prévia no WhatsApp dos links `./app/?tela=...`; fontes do app servidas por `/assets/fonts` (sem Google Fonts); redirecionamento permanente de `carteira-ideal-app.vercel.app` para o domínio próprio (`vercel.json`, regra por host, que não afeta as prévias de deploy).
- **Etapa 2 (página inicial):** os botões do link na bio continuam no topo, e a bio do Instagram não muda. A ordem dos botões é a da D25 (principal, Meu Mês, Aprender, FII, Tesouro, BDR, ETF); o SEO não mexeu nela. O h1 é "Seu perfil de investidor vai além do teste da corretora". Entraram título e descrição novos, canonical e, abaixo dos botões, as seções "Como funciona", "Ferramentas gratuitas" e "Perguntas frequentes". Dados estruturados (JSON-LD): WebSite, Organization, WebApplication e FAQPage.
- **Regra de manutenção:** o texto das perguntas frequentes existe duas vezes no `index.html` da raiz (no corpo e no JSON-LD do `<head>`). Mudou um, muda o outro: o Google penaliza dado estruturado diferente do conteúdo visível.
- **Search Console (28/09/2026):** a verificação por TXT no Registro.br ficou travada (zona DNS "em transição"); foi usada a verificação por **arquivo HTML** (`google5f0b815b0517184a.html`, na raiz do repositório e copiado para o site por `scripts/build-site.mjs`), com a **tag HTML** `google-site-verification` no `<head>` do `index.html` da raiz como reserva. **Não apagar nenhum dos dois**, senão a verificação se perde.
- **Sem impacto na LGPD (D22):** nenhuma linha de script de terceiros entrou no site; o Search Console é verificado por DNS.

- **Etapa 3 (páginas para o Google, feita em 28/09/2026):** `scripts/gerar-paginas.mjs` gera, a cada build, 28 páginas HTML com texto pronto no código-fonte (o app continua sendo a ferramenta; cada página tem um botão que o abre): teste de perfil (`/teste-perfil-de-investidor/`), simuladores de Tesouro, FII, BDR e ETF, Meu Mês, hub `/aprender/`, 11 guias de ativos (`/aprender/ativos/<nome>/`), hub e 9 aulas de "Sair das dívidas" (`/aprender/sair-das-dividas/<aula>/`) e, quando o `mercadoOficial.json` tem dados, `/taxas-tesouro-direto-hoje/` (regenerada a cada deploy, ou seja, toda terça pelo job semanal). Os guias e as aulas são lidos de `data/analises/*.ts` e `data/trilhas.ts` (`scripts/ts-loader.mjs` transpila o TypeScript, sem copiar texto): mudou no app, muda na página no próximo deploy. O estilo é o `paginas.css`. A landing passou a apontar os cartões "Ferramentas gratuitas" para essas páginas, e os botões do topo seguem abrindo o app direto. Se o gerador falhar, o site sai do mesmo jeito, sem as páginas novas, e o log mostra "ATENÇÃO" (um problema de SEO não pode impedir a publicação dos dados semanais).
- **Regras de conteúdo das páginas (têm teste):** (1) **os guias de ativos não citam produtos** (códigos como IVVB11) **nem percentuais de alocação**; os exemplos ilustrativos, os gráficos e as frases que os mencionam ficam só no app (filtro `limparTexto`); (2) **nenhuma página explica a metodologia do motor** (veto, matrizes, pesos, pilares): a frase da aula "Dívida cara x dívida barata" que cita o Pilar 2 e a opção A é omitida na página (filtro `semMetodologia`), e continua no app; (3) toda página termina com o aviso educacional. Esses filtros são a resposta à pendência da D22 sobre indexar as análises publicamente: o que fica público é conteúdo educacional genérico, sem indicação de produto.
- **Como manter:** texto de ferramenta, em `scripts/gerar-paginas.mjs` (funções `pagina...`); data da revisão do texto escrito à mão em `REVISADO_EM` (vira o `lastmod` e o `dateModified`: atualizar quando revisar); novo simulador (ex.: ações, cripto), copiar o molde de `paginaBdr`, incluir na lista de `gerarPaginas`, no `LINKS_RODAPE`, e acrescentar o cartão na landing.

- **Etapa 4 (quem faz o projeto, feita em 28/09/2026):** o responsável **não tem CNPI, CEA, CFP, CPA nem outra certificação ANBIMA**; a formação é em **Administração e Direito**, e ele optou por **aparecer com o nome** no Google. Por isso: (1) páginas `/sobre/` (quem faz, formação, por que existe, como se mantém, o que não é, contato e correções) e `/metodologia-e-fontes/` (como o teste chega à carteira, em alto nível e sem expor o motor; de onde vêm os dados; revisão e limitações); (2) todas as páginas geradas mostram "Por [nome] · Revisado em [data]" (ou "Dados de [data]" nas taxas) e trazem `Person` e `Organization` no JSON-LD; (3) o título da tela de detalhe do ativo no app, que dizia **"Como um consultor CEA/CNPI analisa"**, virou **"Como analisar este ativo"** (a redação antiga sugeria análise de profissional registrado); (4) há teste que **barra siglas de certificação** (CNPI, CEA, CFP, CPA, ANBIMA, OAB) em qualquer página pública. **Onde está o nome:** constante `AUTOR` em `scripts/gerar-paginas.mjs` **e** o JSON-LD (`founder`) do `index.html` da raiz; mudou num, muda no outro. **Redação jurídica** ("não sou analista nem consultor de valores mobiliários registrado na CVM", "atividades reguladas pela CVM"): texto proposto para revisão do responsável, que é advogado. Nenhum número de registro (OAB etc.) foi incluído: só entra se o responsável quiser.

**Próximas etapas.** Ideia de reforço de confiança, se o responsável quiser: convidar um profissional certificado (CFP, CEA ou CNPI) para revisar os guias e assinar "revisado por" (só se for real). Etapa 5: páginas por código de negociação, só depois da leitura dos termos de uso da B3 (pendência da D23). Ideia de curto prazo: as 9 aulas têm 160 a 215 palavras cada, o que é pouco para o Google; se o Search Console mostrar "rastreada, mas não indexada", juntar a trilha numa página longa ou ampliar as aulas.

**Verificação.** 368 testes do app e 150 dos scripts (15 novos: gerador, filtros, links internos, sitemap, autor e ausência de siglas de certificação) passando; typecheck e lint sem erros; build de produção OK; JSON-LD validado e idêntico ao texto visível; landing conferida em 390×844 (claro e escuro) e 1440×900 e o app aberto em `?tela=simuleTesouro` com as fontes locais, sem erro de JavaScript. Etapas 3 e 4: 30 páginas conferidas em 390×844 (claro e escuro) e 1440×900, sem rolagem lateral e sem erro de JavaScript. Em ambiente de desenvolvimento o `mercadoOficial.json` vem vazio, então a página de taxas só aparece no site publicado. O build mostra 5 avisos "didn't resolve at build time" das fontes do app: esperados, porque os arquivos ficam na landing (`/assets/fonts`) e são encontrados no site publicado.

### D27 · Livro infantil renomeado: "Os Três Potes de Clara" (28/09/2026)

**Contexto.** Os personagens do livro do responsável foram renomeados: Duda passou a se chamar Clara e Gui passou a se chamar Pedro. O título virou "Os Três Potes de Clara". A capa e a placa "Eletrônicos" da cena 3.1 (que trazia o nome antigo) foram refeitas com o nome novo.

**Decisão.** Publicar o PDF novo, trocar os textos do app que mostram o título e, depois de revisão, também o nome do arquivo e os comentários residuais que ainda citavam "Duda": `assets/livro-os-tres-potes-de-duda.pdf` passou a `assets/livro-os-tres-potes-de-clara.pdf` (README e docs/05 atualizados para o novo nome) e os comentários em `index.html`, `index.css`, `orcamento.ts`, `MeuMes.tsx`, `script.js` e no registro D21 (linha da metáfora dos três potes) passaram a citar "Clara". O nome do arquivo que o usuário baixa é `Os-Tres-Potes-de-Clara.pdf`.

**Mecanismo.** `assets/livro-os-tres-potes-de-clara.pdf` (55 páginas, 6x9, gerado do Word; nome do arquivo trocado, mesmo caminho `assets/`); `webapp-src/src/ui/MateriaisExtras.tsx` (título do diálogo, `URL_LIVRO_PDF`, nome do arquivo baixado e "55 páginas", que estava como 54 e já não batia com o PDF); `scripts/gerar-paginas.mjs` (título do livro nas páginas Sobre e Aprender); `README.md` e `docs/05-publicacao-e-operacao.md` (nome do arquivo na instrução de como atualizar o livro). Nenhum teste precisou mudar — `MateriaisExtras.test.tsx` usa a constante `URL_LIVRO_PDF`, não o valor fixo.

**Verificação.** 368 testes do app e 150 dos scripts passando; typecheck e build de produção sem erro. No site montado, o PDF publicado é o novo (título "Os Três Potes de Clara", 55 páginas) e o app e as duas páginas mostram o nome novo.

### D28 · Trilha 4 "Tutorial Meu Mês" na aba Aprender: 17 aulas em texto, prontas para receber os vídeos (29/09/2026)

**Contexto.** O responsável vai gravar uma série de 17 vídeos curtos (9:16) ensinando a preencher o Meu Mês. O manual da série (PDF, Word e pacote de telas) foi produzido em 29/09/2026 e está em `3-material-de-apoio/manual-meu-mes/`. Pedido: abrir na aba Aprender uma trilha com as 17 aulas, com os mesmos 17 títulos dos vídeos.

**Decisão.** Nova trilha **4 "Tutorial Meu Mês"** (`id: 'tutorial-meu-mes'`), depois de "Sair das dívidas" (a numeração das trilhas 1 a 3 não muda). As 17 aulas seguem a ordem de gravação e os títulos da série, em 6 tópicos: Começar pelo salário (1 aula), Cadastrar as contas (4), Dívidas e cartão de crédito (3), O mês na prática (4), Modo Recuperação (4) e Cópia de segurança (1). Cada aula já nasce **em texto** ("Leitura · 1 min" ou "2 min"), com o passo a passo do manual em parágrafos "Passo 1, Passo 2...", os cuidados mais comuns e o botão **Abrir o Meu Mês** no fim. Quando o vídeo de uma aula sair, basta preencher `youtubeId` e `formato: 'vertical'` naquela aula: o texto continua abaixo do vídeo, como na trilha 3.

**Avisos.** Campo novo `aviso?: 'dividas'` em `AulaTrilha`. As 5 aulas do tutorial que falam de dívida (Minhas dívidas, Modo Recuperação, Plano de quitação, Pacto e negociação, Reserva parada) levam o aviso "Conteúdo educativo. Não é assessoria jurídica e não indica banco nem produto de crédito."; as demais levam "Tutorial de uso do Meu Mês. Conteúdo educativo: os valores dos exemplos são fictícios." A trilha 3 e as trilhas de investimento seguem com os avisos de antes. As aulas de Minhas dívidas e de negociação trazem os links oficiais (Registrato, consumidor.gov.br, Lei 14.181/2021), lidos de `data/linksOficiais.ts`.

**Mecanismo.** `data/trilhas.ts` (interface + trilha 4, sem mudar nenhuma outra trilha); `screens/AprenderVideo.tsx` (escolha do aviso do rodapé); teste novo `screens/TutorialMeuMes.test.tsx`. `Aprender.tsx` e `Trilha.tsx` não mudaram: leem `TRILHAS` e mostram a trilha nova sozinhos ("Trilha 4 · 6 tópicos · 17 de 17 aulas disponíveis").

**Fora do escopo, de propósito.** (1) **Sem páginas estáticas para o Google:** o `gerar-paginas.mjs` só lê a trilha `sair-das-dividas`, então o tutorial existe só dentro do app; se quiserem SEO para ele, o molde é `paginasTrilhaDividas`, e antes vale confirmar que nenhuma aula explica o motor (as aulas do tutorial falam da ferramenta Meu Mês, não do motor de alocação). (2) **Sem atalho no Meu Mês:** o Meu Mês só oferece a trilha 3, e só com dívida cadastrada; um cartão "Tutorial Meu Mês" na própria tela seria o próximo passo natural.

**Verificação.** 374 testes do app (6 novos: existência e ordem dos 17 títulos, ids únicos e texto mínimo, ausência de promessa, de banco e de certificação, cartão no Aprender e 17 "Leitura" na trilha, aula com botão e próxima aula, aulas de dívida com aviso e fontes) e 150 dos scripts passando; typecheck e lint sem erros; build de produção OK (30 páginas estáticas, como antes). Telas conferidas em 390×844: cartão "Trilha 4" no Aprender, lista com os 6 tópicos e aulas de texto e de dívida.

### D29 · App instalado abre na página inicial: manifesto único na raiz (29/09/2026)

**Contexto.** Depois de instalar o app pelo domínio próprio, o ícone abria direto o `/app/` (o questionário) e não a página inicial, que reúne todas as ferramentas (Meu Mês, Aprender, simuladores). Causa: o manifesto ficava em `webapp-src/public/` (publicado em `/app/manifest.webmanifest`) com `start_url` e `scope` em `./`, ou seja, `/app/`. A página inicial ficava fora do escopo (o Chrome mostrava a barra de endereço nela) e não tinha `<link rel="manifest">`.

**Decisão.** Um só manifesto, na raiz do repositório (`manifest.webmanifest`), com `start_url: "/"` e `scope: "/"`. A landing e o `/app/` apontam para ele (`/manifest.webmanifest`). O `id` continua `/app/`: é a identidade do app instalado e não deve mudar, para quem já instalou receber a atualização sem reinstalar. Descrição ampliada (investimentos, planejamento do mês e dívidas) e 4 atalhos ao segurar o ícone (Meu Mês, Aprender, Descobrir meu perfil, Simule FII).

**Mecanismo.** `manifest.webmanifest` novo na raiz (ícones em `/app/icon-*.png`); `scripts/build-site.mjs` copia o arquivo para o site; `index.html` da raiz e `webapp-src/index.html` com o link; `webapp-src/public/manifest.webmanifest` **removido** (fonte única); teste novo `scripts/manifest.test.mjs` (4 testes).

**Título e descrição da home (mesma D29).** A mensagem passou a abranger o app inteiro: `<title>` "Carteira Ideal | Perfil de investidor, planejamento financeiro e simuladores" (76 caracteres; o Google pode cortar o final), meta description, `og:title`, `og:description` e a descrição do `WebApplication` no JSON-LD alinhados. A palavra "personalizada" ficou de fora de propósito: o site descreve uma carteira de **referência**, educacional, e o aviso diz que ela não considera toda a situação do usuário. O texto do FAQPage não mudou (continua idêntico ao do corpo da página).

**Para quem já instalou.** O Chrome atualiza sozinho em poucos dias; para ver na hora, desinstalar e instalar de novo pelo `carteiraideal.app.br`.

**Verificação.** 158 testes dos scripts passando (4 novos); build de produção OK (31 páginas estáticas); no site montado, `manifest.webmanifest` na raiz e o link presente na landing e no app.

### D30 · Tela inicial do app: botão centralizado acima do aviso e novo texto do aviso educacional (29/09/2026)

**Contexto.** No celular, com a barra do Chrome, o botão principal da tela inicial do app (`/app/`) ficava abaixo do aviso "Conteúdo educacional" e saía da parte visível, exigindo rolagem para achar o caminho até o questionário.

**Decisão.** (1) O botão "Descobrir meu perfil e carteira de referência" passa para cima do aviso completo e fica **centralizado no espaço livre** entre o cartão de cima (as 3 características) e a caixa do aviso. (2) O texto do aviso completo (`AvisoEducacional`, variante `completo`, só usada nesta tela) foi reescrito pelo responsável: "Conteúdo educacional. Este app não é recomendação de investimento nem consultoria. As carteiras mostradas são exemplos de referência, geradas por regras automáticas a partir das suas respostas. Rentabilidade passada não garante rentabilidade futura."

**Tentativa descartada.** Chegou a entrar uma frase curta acima do botão ("Conteúdo educacional, não é recomendação de investimento."). O responsável pediu para removê-la: o aviso completo já está na mesma tela, logo abaixo do botão.

**O que saiu do aviso completo.** A referência a "profissional certificado (CEA/CFP)" e a expressão "sem considerar toda a sua situação". A variante curta (telas de resultado, carteira e simulador) e o aviso da tela de detalhe do ativo não mudaram e ainda recomendam procurar um profissional certificado. Se o texto voltar a citar que a carteira não considera toda a situação do usuário, é aqui que se restaura.

**Mecanismo.** `webapp-src/src/screens/Onboarding.tsx`: dois `<div className="grow" />` iguais, um antes e outro depois do botão, dividem o espaço livre em partes iguais (o botão fica no meio; se a tela for baixa e não sobrar espaço, os dois encolhem juntos e o botão continua entre as duas caixas). `webapp-src/src/ui/AvisoEducacional.tsx`: texto da variante `completo`. Nenhum teste dependia do texto antigo.

**Verificação.** 374 testes do app passando; typecheck e lint sem erros; build de produção OK. Espaço acima e abaixo do botão medido igual (83/83 px em 390×844, 55/55 em 393×780, 28/28 em 360×640).

## D31 e D32 (30/09/2026): métricas de uso, política de privacidade, painel e conserto da home

**Métricas anônimas.** Eventos do funil enviados a `/api/evento` (Redis REST), sem IP, sem respostas individuais, com id aleatório do navegador contado por HyperLogLog. Respeita Do Not Track e Global Privacy Control. Detalhes em `docs/08-metricas-de-uso.md`.

**Política de privacidade** em `/privacidade/`, com link no rodapé da landing, no rodapé das 30 páginas geradas (`LINKS_RODAPE`) e na tela inicial do app (`Onboarding.tsx`). Não é aconselhamento jurídico; revisar antes de divulgar a parceiros.

**Painel** em `/painel.html` (raiz, noindex), lê `/api/metricas` com o `METRICAS_TOKEN`.

**Incidente e lição.** Um pacote montado sobre um zip antigo sobrescreveu os dois `index.html` e apagou as mudanças da D29 (manifesto, título, descrição, Open Graph); o teste `manifest.test.mjs` acusou. A D31/D32 restauraram tudo. Regra daqui para frente: todo pacote parte do zip atual do repositório (Code, Download ZIP), leva só os arquivos alterados nas pastas certas e nunca sobrescreve arquivos de dados dos jobs (`historico/`, `config/`, JSONs de mercado).


## D33 (30/09/2026): vídeos das Trilhas 3 e 4

**O que entrou.** As 26 aulas das trilhas "Sair das dívidas" (9) e "Tutorial Meu Mês" (17) ganharam vídeo (YouTube Shorts): `youtubeId` e `formato: 'vertical'` em `webapp-src/src/data/trilhas.ts`. Os títulos da planilha de links bateram 1 a 1 com os títulos das aulas. O texto das aulas continua abaixo do player (comportamento já existente de `AprenderVideo`). Com as Trilhas 1 e 2, as 4 trilhas agora têm vídeo (41 vídeos no total).

**Mudança visível.** Na lista da trilha, aula com vídeo mostra só a duração ("2 min"); o selo "Leitura · 2 min" fica só para aula sem vídeo.

**Testes.** `TutorialMeuMes.test.tsx` e `TrilhaSairDasDividas.test.tsx` deixaram de afirmar "aula só em texto" e passaram a exigir `youtubeId` válido (11 caracteres) e `formato: 'vertical'`. Novo teste: o player da aula "Descubra tudo o que você deve" carrega `youtube.com/embed/JLuz-UN9tqo`. Total: 380 testes.

**Lições do processo.**
- Abrir `youtube.com/embed/ID` direto na barra de endereço dá Erro 153 (sem origem/referrer). Não serve como teste de incorporação; testar sempre dentro do app.
- O upload do zip por "Add file > Upload files" não substituiu `trilhas.ts` (a aula seguiu sem vídeo). O que funcionou: abrir o arquivo no GitHub, lápis (Edit), Ctrl+A, colar o arquivo inteiro e Commit. Para arquivos únicos, preferir esse caminho.
- Ao buscar um ID no editor do GitHub, copiar e colar: na fonte do editor, "l" minúsculo e "I" maiúsculo são quase idênticos.
- Arquivo `.test.tsx` anexado no chat tenta abrir como artefato e dá "Falha ao carregar artefato"; entregar como `.txt`.

**Verificação.** 380 testes, typecheck, lint e build de produção OK; deploys na Vercel (`03695d8`, `fc3561d`, `47c4e51`) em Ready; vídeos funcionando no app publicado.


## D34 (01/10/2026): Meu Mês, dívida quitada por fora e restaurar cópia na primeira tela

**Origem.** Ao escrever o Manual de Utilização do Meu Mês (telas reais, passo a passo), dois comportamentos ficaram difíceis de explicar e foram corrigidos no app.

**1. Dívida paga por fora do app.** Antes, em Editar, o botão "Salvar alterações" ficava desabilitado com saldo zero (a regra `saldo > 0` valia para cadastro e edição). Quem quitava uma dívida pelo canal do credor só conseguia "Remover", e perdia o histórico e a comemoração. Agora:
- Ao **editar**, saldo zero é aceito. Dívida **nova** continua exigindo saldo maior que zero (`MeuMesRecuperacao.tsx`, `valido`).
- Novo botão **"Quitei esta dívida"** em Editar (aparece com saldo maior que zero): pede confirmação, zera o saldo e mantém `saldoInicial` (a barra de progresso e o "Quitada 🎉" continuam). Se era a última dívida cara, o Modo Recuperação desliga e aparece a comemoração.
- A dica do campo "Quanto deve hoje", ao editar, passou a dizer "Pagou tudo? Digite 0 e salve, ou toque em 'Quitei esta dívida'".

**2. Restaurar cópia na primeira tela.** Antes, o botão só existia no cartão "Seus dados ficam só neste aparelho", que só aparece depois de informar o salário: quem trocava de celular precisava digitar um salário qualquer para chegar nele. Agora a primeira tela ("Comece pelo salário") traz o cartão **"Já usa o Meu Mês em outro aparelho?"** com o botão "Restaurar cópia" (`RestaurarCopiaInicial`, em `MeuMes.tsx`). Mesma validação da cópia, mesma confirmação ("Restaurar a cópia substitui tudo...") e mesmo aviso para arquivo inválido. O `data-testid="arquivo-copia"` é o mesmo; nunca há dois ao mesmo tempo (a primeira tela e o cartão do fim da página são excludentes).

**Trilha 4 e Trilha 3.** Textos das aulas "Minhas dívidas" e "Cópia de segurança" (`trilhas.ts`) atualizados para os dois fluxos.

**Testes.** 7 novos (4 em `MeuMesRecuperacao.test.tsx`: salvar saldo zero ao editar, dívida nova exige saldo, "Quitei esta dívida" com e sem confirmação; 3 em `MeuMes.test.tsx`: restaurar na primeira tela, arquivo inválido, desistir na confirmação). Total: 387 testes no app; typecheck, lint e build OK.

**Arquivos alterados.** `webapp-src/src/screens/MeuMes.tsx`, `webapp-src/src/screens/MeuMesRecuperacao.tsx`, `webapp-src/src/screens/MeuMes.test.tsx`, `webapp-src/src/screens/MeuMesRecuperacao.test.tsx`, `webapp-src/src/data/trilhas.ts`, `docs/07-registro-de-decisoes.md`.


## D35 (01/10/2026): Manual de Utilização do Meu Mês dentro do app

**O que entrou.** O Manual de Utilização do Meu Mês (PDF de 54 páginas, 6,7 MB, com as telas reais do app, o passo a passo de cada cadastro e quatro casos completos) passou a ser baixado de dentro do app. O arquivo fica em `assets/manual-meu-mes.pdf`, na mesma pasta do livro "Os Três Potes de Clara", e é servido na raiz do site (o `build-site.mjs` copia a pasta `assets` inteira). Caminho relativo a `/app/`: `../assets/manual-meu-mes.pdf`.

**Onde aparece.** (1) Na primeira tela do Meu Mês, abaixo de "Já usa o Meu Mês em outro aparelho?". (2) Na tela completa, acima do cartão "Seus dados ficam só neste aparelho". (3) Na tela da Trilha 4 (Tutorial Meu Mês), no topo, antes da lista das 17 aulas. Por sugestão do responsável, o link ficou na trilha e **não** é repetido dentro de cada aula (`Trilha.tsx`; `AprenderVideo.tsx` voltou ao original). As outras trilhas não mostram o link. Download direto, sem liberar por rede social e sem coleta de dados.

**Como atualizar o manual.** Enviar um PDF novo, com o mesmo nome (`manual-meu-mes.pdf`), para a pasta `assets/`. Nenhum código muda. As capturas de tela do manual saem do próprio app (script em Playwright), então regenerar depois de mudanças de tela é rápido. O manual retrata o app em 30/09/2026 e já inclui os comportamentos da D34.

**Arquivos.** Novo: `webapp-src/src/data/manualMeuMes.ts` (URL, nome do arquivo e textos do link, num lugar só) e `assets/manual-meu-mes.pdf`. Alterados: `MeuMes.tsx` (componente `LinkManual`), `Trilha.tsx`, `MeuMes.test.tsx` e `TutorialMeuMes.test.tsx`.

**Testes.** 2 novos: o link aparece na primeira tela e na tela completa, com o `href` e o nome do arquivo certos; a tela da Trilha 4 mostra o link no topo, e nem as aulas nem as outras trilhas o mostram. Total: 389 testes; typecheck, lint e build OK. O PDF é servido com status 200 no site de teste.


## D36 (01/10/2026): Minha Carteira, uma das três funcionalidades principais do Carteira Ideal

**Posição no produto.** A Minha Carteira é uma **funcionalidade do Carteira Ideal** (não um app à parte), no mesmo nível do questionário e do Meu Mês. Por isso fica na **página inicial, logo abaixo do botão do questionário e acima do Meu Mês**, e também em cartão próprio na seção "Ferramentas gratuitas", em página para o Google (`/minha-carteira/`), no rodapé das páginas, nos atalhos do app instalado (manifesto, que aceita no máximo 4: ficaram perfil, Minha Carteira, Meu Mês e Aprender, e o Simule FII saiu dos atalhos, continuando na página inicial) e no painel de métricas. **Funciona sem o questionário.** Quem o responde ganha, dentro da própria tela, o cartão que compara a carteira que tem com a carteira sugerida.

**O que entrou.** Tela avulsa `?tela=minhaCarteira` (também pelo cartão no fim da tela Carteira). A pessoa importa extratos da B3 (Negociação, Movimentação, Posição, Proventos recebidos e a receber) em Excel ou CSV, uma planilha própria, ou lança e corrige à mão. O app calcula o preço médio pelos lançamentos e mostra: Carteira (patrimônio ou capital aplicado, resultado e evolução), Proventos, **Comparação com a carteira sugerida**, Composição, Conferência com a Posição, Posições e Lançamentos, mais backup e restauração. Visual: cartões escuros de contorno sutil, números grandes, variação verde/vermelho e ouro nos gráficos (tokens `--mc-*` em `index.css`, tema escuro e claro; as demais telas não mudam).

**Comparação com a carteira sugerida.** Usa `ctx.resultado`, que o app já calcula sozinho assim que as respostas estão completas (nada novo é gravado sobre o resultado). Estados: sem questionário, convida (é opcional); calculando, avisa; falha, oferece "Tentar novamente"; com resultado, mostra o perfil, a **aderência** (100 menos metade da soma dos desvios, em pontos percentuais), uma linha por classe com "você x sugerida", a diferença em pontos e em reais, e o **aporte guiado** (distribui só dinheiro novo entre as classes abaixo do alvo, em centavos exatos, sem mandar vender). A carteira sugerida é exibida com o Tesouro agrupado numa fatia ("Tesouro Direto"), igual à tela Carteira, e a carteira da pessoa recebe o mesmo agrupamento. **Classificação dos ativos** (`classesDaCarteira.ts`): prioridade para a escolha da pessoa, depois a aba da Posição na B3 (uma unit com final 11 na aba Ações é ação), depois o classificador por nome e ticker com as listas de FIIs, ETFs e BDRs do app (`data/catalogoAtivos.ts`). O que não dá para classificar com segurança **fica de fora**, o cartão diz quanto ficou e pede a escolha; o provável-mas-incerto (ex.: ETF de ações) entra na conta e pede confirmação. As escolhas ficam gravadas (`classes`).

**Leitura simples (revisão de 01/10/2026, a pedido do dono do projeto).** A primeira versão tinha texto demais, em letra de 10 a 13 px e cinza médio, e não se lia. Mudou: (1) **passo a passo em 3 etapas** na importação ("Baixe na B3" com link para a Área do Investidor, "Envie aqui", "Pronto!"), com a explicação extra e a planilha-modelo recolhidas num "Prefere usar a sua própria planilha?"; (2) **cartões de exemplo** antes da primeira importação (Carteira, Proventos e Composição em cinza tracejado, etiqueta "Exemplo", valor "R$ —", sem nenhum número e escondidos de leitores de tela), que somem quando entram dados reais; (3) textos curtos e explicações sob demanda ("Por quê?", "Como classificamos..."); (4) letras de 13 a 30 px (só o eixo dos gráficos tem 11,5 px, e no celular mostra um mês sim, outro não) e texto secundário em `--mc-suave`, com contraste de cerca de 10:1 no tema escuro (o cinza anterior dava 6:1) e 7:1 ou mais nos dois temas. Um teste (`legibilidade.test.ts`) falha se voltar letra pequena, o cinza antigo ou contraste abaixo de 7:1.

**Princípios de método.** (1) Os **lançamentos** são a fonte da verdade. (2) **Capital aplicado não é patrimônio**: sem série de preços, a evolução mostra o custo. (3) **Resultado só onde o histórico confere com a Posição**, e o cartão diz que parte da carteira essa conta cobre. (4) **Privacidade**: tudo no aparelho (chave `carteiraideal.carteira`); só as respostas do questionário vão à API, como sempre; os ativos nunca. A política de privacidade (seção 3, 4 e 8) e o FAQ da página inicial foram atualizados. O importador de planilhas não carrega o leitor de PDF. (5) **Prioridade das fontes**: nota de negociação, depois Negociação, depois Movimentação (a Movimentação traz a data de liquidação, D+2; somar tudo contaria em dobro). (6) O que a pessoa **exclui ou corrige** é lembrado: reimportar não traz o errado de volta.

**O que os extratos reais ensinaram** (13 meses de extratos e Posição de 30/09/2026): futuros (`WINM26`) têm formato de ticker, então a coluna Mercado decide; a corretora aparece com e sem ponto final; o mesmo provento vem com o preço unitário arredondado diferente em cada extrato, então a chave de proventos ignora o preço; 62 de 71 ativos bateram com a Posição, e as 9 diferenças eram negócios ainda não liquidados ou posse anterior ao período.

**Ficou de fora de propósito.** (a) **Nota de corretagem em PDF**: o leitor existe (`importacao/notaSinacor.ts`, `pdf.ts`, com conferência pelos totais da própria nota), mas não está ligado, porque o pdf.js pesaria cerca de 1,8 MB num app de arquivo único; falta decidir entre embutir e servir como arquivo separado, e validar com o PDF real. (b) **Benchmarks** (CDI, IPCA, Ibovespa...). (c) **Posição em 31/12 para o Imposto de Renda**: a base existe (`derivarPosicoes` calcula a posição e o custo em qualquer data), falta o cartão e a revisão fiscal. (d) **Renda fixa de banco** (CDB, LCI): a Posição vem em aba de colunas diferentes, hoje ignorada com aviso; dá para lançar à mão e escolher a classe.

**Arquivos.** Novos: `webapp-src/src/domain/` (`lancamentos.ts`, `conferencia.ts`, `painelCarteira.ts`, `carteiraSalva.ts`, `classesDaCarteira.ts`, `graficosSvg.ts`, `carteiraAtual.ts`, `classificadorAtivo.ts`, `importacao/*`), `data/catalogoAtivos.ts`, `state/useCarteiraReal.ts`, `ui/painel/*`, `screens/MinhaCarteira.tsx`. Alterados: `index.html`, `manifest.webmanifest`, `painel.html`, `privacidade/index.html`, `scripts/gerar-paginas.mjs` (+ teste), `useAppState.ts`, `App.tsx`, `Carteira.tsx`, `index.css`, `package.json`, `package-lock.json` (`read-excel-file`; `pdfjs-dist`, que não entra no pacote do app).

**Testes.** 369 novos (765 no total, mais 158 dos scripts); typecheck, lint e build OK. O pacote do app foi de 967 kB para 1.122 kB (324 kB para 369 kB comprimido), sem pdf.js. Cobrem a interface e o fluxo (importar, reimportar, conferir, lançar, corrigir, excluir, backup, apagar, comparar, classificar, aporte). **Não verificado**: o aspecto visual da página num navegador; os gráficos foram conferidos desenhando os SVGs reais, e o layout deve ser revisado no app publicado.

## D37 (01/10/2026): fim do "piscar" da tela "Responda o questionário" ao reabrir o app

**O defeito.** Quem já tinha respondido o questionário e voltava ao app pelo botão da página inicial via, por um instante, "Responda o questionário para ver seu resultado" com o botão "Começar", e logo depois o resultado. A causa: o app reabre na última tela (Resultado, Carteira ou Simulador), mas a carteira sugerida é calculada no servidor e só chega depois; até lá, essas telas mostravam o convite. O conserto anterior havia tratado só quem **nunca** respondeu. Os testes não pegavam porque o mock da API respondia na hora.

**O conserto.** `useAppState` passou a expor `resultadoPendente` (respostas completas, sem resultado e sem erro), verdadeiro já na primeira renderização depois de ler o aparelho. Um componente único, `ui/SemResultado.tsx`, decide o que as três telas mostram: **calculando** ("Montando sua carteira sugerida…", com a barra de abas, para a tela não pular), **erro** (mensagem e "Tentar novamente", em vez de mandar refazer o teste) ou, só para quem nunca respondeu, o convite de sempre. Junto, outro defeito do mesmo tipo: a tela de Detalhe de um ativo era gravada como ponto de retomada, mas o ativo escolhido não é gravado, então reabrir caía em "Nenhum ativo selecionado"; agora volta ao Resultado.

**Testes.** `App.retomada.test.tsx` (9 testes) usa uma API que demora de verdade e um `MutationObserver` que garante que o convite **nunca é inserido** na tela durante o carregamento. Foi verificado que, desfeito o conserto, 6 desses testes falham.


## D38 (01/10/2026): a Posição manda no que a pessoa tem; ticker com dígito; correção das pendências

**Regra de produto: a Posição da B3 manda no que a pessoa tem.** Se o ativo não está na Posição, a quantidade em custódia é zero, e não há o que conferir nem corrigir. Antes, o app também comparava ativos que a pessoa já zerou (vendidos, convertidos ou transferidos fora do histórico importado), e isso enchia a conferência de "inconsistências" que não interessavam. Agora a conferência (`conferencia.ts`) considera **só os ativos da Posição**; os demais saem em `foraDaPosicao`, só para o painel reconhecer uma **compra recente ainda não liquidada** (D+2). Os zerados também saem da lista de posições, do **total investido** e do **gráfico de evolução** (que, com Posição, mostra o custo do que a pessoa tem hoje), que antes eram inflados por eles.

**Só existem dois resultados, e "inconsistente" deixou de existir.** Para um ativo que está na Posição: (1) **confere**, mesmo que os lançamentos mostrem MAIS cotas que a Posição (venda ou ajuste fora do histórico; no caso real do SNEL11, a própria B3 se contradiz entre Negociação e Movimentação em 15 cotas). A Posição manda, e o preço médio **não muda**, porque tirar cotas ao preço médio não altera o preço médio; ou (2) **falta o preço de compra**, quando a Posição tem cotas que o histórico importado não explica (compra anterior ao período, ou vendas que superam o que foi comprado). Só o segundo pede algo da pessoa: informar o preço médio desse saldo ou importar um período mais longo. A conta do saldo anterior é `max(faltante, exigido pelo histórico, 0)`: cobre a Posição e evita o histórico ficar negativo no meio do caminho. Ressalva conhecida: o preço médio só muda por lançamentos a mais se a venda que faltou ocorreu antes de compras a preços bem diferentes. Em cada pendência a pessoa pode ainda **ver e corrigir os lançamentos do ativo** (a lista ganhou filtro por ativo).

**Defeito do ticker com dígito no meio.** O reconhecedor exigia 4 letras seguidas de número, então `B3SA3` (e BDRs como `A1MD34`, ETFs como `B5P211`) virava o **nome inteiro do produto** ("B3SA3 - B3 S.A. - BRASIL, BOLSA, BALCAO") e se partia em dois ativos, e a conciliação Negociação x Movimentação não funcionava para eles. A regra agora é única (`PADRAO_TICKER` em `lancamentos.ts`: 1ª posição letra, 3 seguintes letra ou dígito, depois 1 ou 2 dígitos) e usada pelos cinco pontos que reconhecem ticker. **Migração** (`canonizarAtivos`, ao abrir): normaliza os ativos já gravados no aparelho (lançamentos, Posição, agenda, classes escolhidas e a lista de descartados) e reconcilia as fontes de novo; carteira sem o problema volta intacta, com os mesmos ids.

**Testes.** 821 no total (mais 158 dos scripts); typecheck e lint OK. Cobrem a regra dos zerados (conferência, lista, total, resultado e gráfico), a regra de que lançamentos a mais não são problema, o ticker com dígito em cada ponto, a migração (inclusive a lista de descartados e a idempotência) e os fluxos de tela (saldo anterior, ver e corrigir lançamentos, filtro).


## D39 (01/10/2026): preço médio editável, valor aplicado da B3 e posições agrupadas por tipo

**Preço médio com três origens, por ordem de confiança.** (1) **Informado pela pessoa** (`precosMedios`, gravado no aparelho): vale mais que tudo e dá resultado sempre; pode ser desfeito com "Voltar ao calculado". (2) **Valor aplicado da B3**: a Posição do Tesouro Direto já traz o custo (`valorAplicado`), então o preço médio sai de `valorAplicado / quantidade`, **sem histórico e sem pedir nada** (só vale se todas as linhas do ativo trazem o valor). (3) **Calculado** pelos lançamentos, quando o histórico confere com a Posição. A conferência (`conferirComPosicao`) reconhece (1) e (2) como "preço de compra conhecido": o ativo deixa de aparecer como "falta o preço de compra". Isso resolveu, por exemplo, os Tesouros IPCA+ que apareciam com preço médio "—" mesmo tendo o custo na própria Posição. Cada ativo ganhou o botão **"Editar preço médio"**, e o texto informa a origem do número (calculado, valor aplicado da B3 ou informado por você).

**Posições agrupadas por tipo**, como "Produtos da sua carteira" na Área do Investidor da B3 (`agruparPosicoes`): um bloco por tipo (Ações, Tesouro Direto, FIIs e fundos, BDRs, ETFs), recolhido, com quantos ativos tem, a **fatia da carteira** e o **valor**; os blocos e os ativos de dentro saem do maior para o menor valor, e as compras recentes ainda não liquidadas ficam num bloco à parte, por último. Com um tipo só, o bloco já vem aberto.

**Filtro por tipo nos lançamentos** (Todos, Compras e vendas, Proventos). A lista misturava proventos mensais com as compras, o que atrapalhava quem queria ver o que forma o preço médio de um ativo. "Ver lançamentos" (nas posições e na conferência) agora abre a lista já filtrada por aquele ativo **e só com compras e vendas**.

**Testes.** 860 no total (mais 158 dos scripts); typecheck e lint OK. Cobrem a origem do preço médio (informado, B3, calculado e a precedência entre elas), a conferência com preço conhecido, o agrupamento, a persistência e a migração dos preços informados, e os fluxos de tela (editar, desfazer, valor inválido, cancelar, ver lançamentos, filtro por tipo).


## D40 (01/10/2026): ativo digitado à mão (com classe), painel de edição, sem lista de pendências e proventos como na B3

**Sai a lista de pendências.** O cartão "Conferência com a Posição", com a lista de ativos "pedem atenção" e os formulários de saldo inicial, foi removido da tela: quem não tem o preço de compra de um ativo informa o preço médio por conta própria. O domínio da conferência continua existindo, porque é ele que decide de onde vem cada preço médio, mas na tela só sobra um selo discreto "Sem preço médio" na linha do ativo e uma frase curta no cartão de Posições. A data da Posição passou para esse cartão.

**Ativo digitado à mão é POSIÇÃO, não compra** (`ativosManuais.ts`, `AtivoManual`). Antes, quem digitava a posição inteira (ex.: 1.600 BBAS3 a R$ 19,50) via o app gravá-la como "Compra, hoje, Manual", o que é falso e ainda se somava às compras reais do histórico. Agora o botão **"Adicionar ativo"** cadastra nome, quantidade, preço médio, valor atual (opcional) e a **classe** (as 11 da carteira sugerida, mais "fora da carteira sugerida"), sem gerar nenhum lançamento. A classe escolhida alimenta a comparação com a carteira sugerida (vale mais que a detecção automática). O ativo entra nas Posições, no total, no resultado e na composição, no bloco da sua classe (nova categoria "Renda fixa (bancos)" para CDB e LCI/LCA). Dá para editar tudo e remover (com confirmação). O botão existe mesmo antes de importar qualquer extrato. O filtro **"Digitados por mim"** nos lançamentos acha e permite apagar os lançamentos manuais antigos.

**Linha do ativo e painel de edição.** O **lápis** fica na frente do ativo e abre um painel (janela por cima da tela: sobe de baixo no celular, centralizada no computador; fecha com Esc, X, Cancelar ou clique fora) com preço médio e classe (nos digitados à mão, também quantidade e valor atual). **"Ver lançamentos"** fica no fim da linha do ativo, e abre a lista já filtrada por ele e só com compras e vendas.

**Proventos como na página Proventos da B3.** Recebido **este ano** e **nos últimos 12 meses**; gráfico de **15 meses** (12 antes, o atual e 2 depois) com o **valor escrito sobre cada barra** e o que ainda será pago em barra tracejada ("a receber", sem contar duas vezes o que já virou lançamento); e a lista **"Valores de cada mês"**, em que cada mês abre com cada pagamento (data, ativo, tipo, valor e de qual extrato veio), para a pessoa conferir número a número com a B3. Os tipos de provento passaram a incluir **amortização, reembolso e juros**, que a B3 conta na página de Proventos. **Duplicidade entre fontes:** a Movimentação (data do crédito) e os Proventos recebidos (data do pagamento) podem divergir em um dia, e a instituição e a quantidade podem vir escritas de outro jeito; o mesmo ativo, com o mesmo valor, em até 4 dias, vindo de fontes diferentes, é um pagamento só (fica o dos Proventos recebidos). Dois pagamentos iguais da mesma fonte nunca são fundidos.

**Diagnóstico registrado.** Comparando o gráfico do app com o da B3 (valores rotulados), 10 de 11 meses batiam em até 2%; **agosto/26** estava ~2,35 vezes acima (≈ R$ 1.907 contra R$ 812,99). O excesso (≈ R$ 1.094) é maior que o total da B3 no mês, então não era só duplicação de lançamentos de agosto. A causa não pôde ser reproduzida com os extratos disponíveis (só cobrem setembro). O detalhe de cada mês foi criado justamente para localizá-la; se o excesso persistir depois da regra de duplicidade, o detalhe de agosto mostrará os lançamentos responsáveis.

**Testes.** 932 no total (mais 158 dos scripts); typecheck e lint OK. Cobrem a ausência da lista de pendências, o lápis e o painel (editar, cancelar, Esc, clique fora, voltar ao calculado, valores inválidos), o cadastro de ativos à mão (classe, sugestão pelo nome, validações, nome repetido, edição, remoção, ausência de lançamento, comparação), o filtro "Digitados por mim", os proventos (15 meses, a receber, este ano, 12 meses, detalhe do mês) e a regra de duplicidade entre fontes.


## D41 (01/10/2026): proventos repetidos em par (transferência de custódia) deixam de inflar o gráfico

**O defeito.** O gráfico de proventos batia com a página Proventos da B3 em 11 dos 12 meses, ao centavo. Só **agosto/26** vinha inflado: R$ 1.897,61 contra R$ 812,99 na B3. O detalhe de agosto (lista "Valores de cada mês") mostrou 49 lançamentos, todos "B3 Movimentação", com **10 grupos idênticos repetidos em par** (mesma data, ativo, tipo e valor), sempre em 04/08, 05/08 e 10/08. A conta fecha ao centavo: o excesso era exatamente 2 x 542,31 (duas cópias de cada par), e **sem os dois lados de cada par o mês dá R$ 812,99, o valor da B3**. Ou seja, a B3 não conta esses pares como dinheiro recebido.

**A causa provável (inferida, ainda não vista nas linhas brutas do extrato).** O padrão (par, nas datas em que a pessoa mudou ativos de corretora) é o de uma transferência de custódia: um lado crédito, o outro débito. O importador lia as duas linhas como proventos positivos (`Math.abs`). Ainda precisa ser confirmado olhando as colunas "Movimentação" e "Entrada/Saída" de uma dessas linhas no arquivo original.

**A regra** (`desfazerProventosEmPares`, em `lancamentos.ts`): proventos da **Movimentação** repetidos em par (mesma data, ativo, tipo e valor) se cancelam de dois em dois: com 2 ou 4 cópias não sobra nenhuma; com 3, sobra 1. A instituição e a quantidade são ignoradas de propósito, porque numa transferência a corretora de origem está num lado e a de destino no outro. Só vale para a Movimentação (Proventos recebidos, planilha e lançamentos digitados nunca são desfeitos), e nunca toca compras e vendas. Aplicada em dois lugares: **ao importar** (com aviso "N provento(s) repetidos em par ... foram descartados") e **ao abrir os dados já gravados** (`limparProventosEmPares`, migração idempotente; carteira sem pares volta intacta). Assim o agosto de quem já importou se corrige sem reimportar.

**Limite conhecido.** Se alguém tem o mesmo ativo em duas corretoras, com o mesmo valor de provento no mesmo dia, os dois pagamentos (legítimos) seriam cancelados. É raro, e na conta real que originou a regra todos os pares eram artefatos. Se aparecer um caso assim, o ajuste é incluir a instituição na chave só quando as duas linhas forem créditos.

**Testes.** 951 no total (mais 158 dos scripts); typecheck e lint OK. Cobrem a regra e seus limites (2, 3 e 4 cópias, datas/valores/tipos diferentes, outras origens, compras), a importação com aviso, a migração dos dados gravados e a tela (agosto, "este ano" e a lista do mês saem corrigidos).

## D42 (02/10/2026): landing com um único cartão "Simule Ativos"; simuladores numa página própria

**Contexto.** A landing tinha quatro cartões de simulador (FII, Tesouro Direto, BDR, ETF) e ia ganhar um quinto (Ações). A página de bio ficaria longa demais.

**Decisão.** A landing passa a ter só o cartão **Simule Ativos** (`?tela=simuleAtivos`). A nova tela `SimuleAtivos` reúne os simuladores; cada um mantém o endereço `?tela=` de antes, então as páginas de SEO (`/simule-fii/` etc.) e os links externos continuam funcionando. Nos simuladores, o link de topo passou de "← Início" para "← Simule Ativos"; no hub, "← Início" volta à landing. A tela é avulsa: não depende do questionário e não vira ponto de retomada.

**Consequência.** Um novo simulador (o Simule Ações, a seguir) entra só como mais um cartão no hub, sem mexer na landing. Motor, dados e API não mudaram.

## D43 (02/10/2026): Simule Ações, com setores da B3 e cadastro próprio, sem brapi

**Contexto.** O Simule Ações precisava de muitas empresas, de todos os setores, sem estourar a cota gratuita da brapi (que já sustenta nome, setor e proporção dos BDRs). A conta de requisições seria o limite do tamanho da lista.

**Decisão.** Seguir o molde dos ETFs (D23) e BDRs (D24), mas **sem a brapi**. Preço e volume saem do Boletim de Preços oficial da B3 (BVBG.086), que é gratuito e sem cota. Setor e nome saem de um **cadastro curado** em `config/acoes.json` (37 setores, 226 empresas, nos 10 setores econômicos da B3; um código por empresa, o mais líquido). O job `scripts/atualizar-acoes.mjs` roda às 23h de Brasília, depois do job de BDRs, e guarda o histórico em `historico/acoes.json`. Reaproveita do job de BDRs a série alinhada pela direita, a detecção de desdobramento (salto de preço) e a faixa de 52 semanas.

**A tela.** `SimuleAcoes` mostra o total de setores e de empresas, a lista por grupo da B3 e por setor (com a contagem de cada um), a busca por código ou nome e a simulação de compra (ações inteiras, lotes de 100 e fracionário). Tela descritiva: ordem por volume dentro do setor, sem ranking nem múltiplos de avaliação (como a D19).

**Cobertura.** O que o job publica na lista é só o que negociou nos últimos 21 pregões; o resto do cadastro some e aparece como `[sem negócio]` no log. Qualquer código de ação (4 caracteres + 3 a 6) fora do cadastro com negócio nos últimos 63 pregões entra na **busca**, com setor "Outros". Mudar o cadastro regrava a tela mesmo sem pregão novo (`cadastroId`).

**Limites conhecidos.** (1) Preço bruto: bonificações pequenas não são detectadas como salto e deslocam um pouco a variação de 3 meses; dividendos nunca entram. (2) Códigos marcados `revisar` no cadastro foram montados de memória e precisam de conferência na primeira carga. (3) O histórico de ~230 empresas com 260 pregões é um arquivo de alguns megabytes regravado todo dia; se o repositório crescer demais, reduzir a janela. (4) Units (11) só entram se estiverem no cadastro.

**Consequência.** O Simule Ações é mais um cartão no hub Simule Ativos (D42). Antes de aparecer com dados, rodar uma vez o workflow "Carga inicial de Ações".

## D44 (03/10/2026): Financiar, alugar ou consórcio? Comparativo de patrimônio, com todos os custos explicados

**Contexto.** Quem quer morar num imóvel precisa escolher entre financiar, continuar no aluguel (e investir) ou entrar num consórcio, e as calculadoras que existem comparam só duas rotas, ou mostram parcela em vez de patrimônio. A ideia era uma ferramenta na página inicial que dissesse, com conta, qual das três deixa o maior patrimônio líquido depois de N anos. O racional matemático veio de um prompt de especificação (custo de oportunidade, investimento da diferença, regras do consórcio).

**Decisão: a ferramenta sempre aponta um vencedor.** A tela diz qual das três rotas termina com o maior patrimônio líquido e por quanto. Isso é diferente de recomendar: **a ferramenta não indica banco, administradora de consórcio nem produto**, e o resultado é uma conta matemática sobre premissas de taxa informadas pela pessoa (com a projeção de longo prazo do Boletim Focus como ponto de partida). O texto da tela, da página de SEO e da Metodologia diz isso de forma expressa. A D19 (simuladores descritivos, sem ranking) continua valendo para os simuladores de **ativos**; o comparativo é a exceção declarada, porque ordena **caminhos**, nunca instituições ou produtos (a página de Metodologia foi ajustada para dizer isso).

**A regra que torna a comparação justa ("mesmo dinheiro").** (1) O capital inicial comum, entrada + ITBI/cartório do financiamento, fica aplicado desde o mês 0 para quem aluga ou entra no consórcio. (2) Em cada mês, o **orçamento de referência** é o maior desembolso entre os três cenários, e quem paga menos **investe a diferença**. Assim os três gastam exatamente o mesmo dinheiro (`totalColocado`, igual nos três, e um teste garante isso), e a diferença de resultado vem só de para onde o dinheiro foi: patrimônio ou custo. O racional original comparava os cenários dois a dois; no consórcio isso quebrava, porque antes da contemplação a pessoa paga parcela **e** aluguel.

**Patrimônio líquido** = imóvel a preço de mercado − dívida restante + investimentos líquidos de IR (com opção de descontar corretagem de 6% e 15% de IR sobre o ganho de capital da venda, desligada por padrão; os dois números aparecem). Antes da contemplação, o consórcio não tem imóvel **nem** dívida na série: as parcelas pagas são custo, e as futuras ainda não são obrigação de quem não tem o bem (a primeira versão descontava a dívida inteira e o gráfico começava em −R$ 500 mil; corrigido na revisão visual).

**Premissas e convenções (`domain/simulaImovel.ts`).**
- **Financiamento:** SAC ou Price pela taxa **nominal** ao ano ÷ 12; MIP sobre o saldo devedor, DFI sobre o valor do imóvel, tarifa fixa; TR zerada. O **CET é resultado** (TIR do fluxo do banco), nunca entrada: assim os custos não são contados duas vezes.
- **Aluguel e custos de quem é dono** (IPTU, condomínio, manutenção, 1% do imóvel ao ano) reajustados uma vez por ano.
- **Consórcio:** carta = valor do imóvel; parcela = carta × (1 + adm + fundo de reserva) ÷ prazo, corrigida uma vez por ano. Até o mês M, parcela **e** aluguel; no fim do mês M o imóvel é comprado ao preço de mercado (a diferença para a carta corrigida sai do fundo, ou sobra para ele) e se paga ITBI/cartório; depois, mora no imóvel e segue pagando. Lance em R$ de hoje, corrigido até M, abate o prazo ou a parcela.
- **Investimentos:** taxa efetiva anual convertida em mensal; aporte no fim do mês; IR regressivo sobre o ganho na data final (simplificação: todos os aportes com a idade do horizonte). Se a taxa informada já é líquida, o IR é zero.
- **Pontos de partida da tela:** projeção de longo prazo do Focus (último ano projetado) para Selic (rendimento) e IPCA (inflação, valorização e reajustes). Juros do financiamento (10,5%), seguros (MIP 0,03% e DFI 0,012% ao mês), tarifa (R$ 25), ITBI (4%), custos de dono (1% ao ano) e contemplação no 36º mês são **valores de partida nossos, editáveis**, não taxas de mercado conferidas.

**O que a pessoa precisa entender, e como a tela entrega.** O resultado traz: (1) **"O que este resultado mostra"**: o que é patrimônio líquido, por que os três usam o mesmo dinheiro, por que o primeiro colocado ficou na frente (uma **decomposição que soma exatamente a vantagem**: custos + valorização + rendimento líquido de IR, + custos de venda se ligados, com o sinal de a favor ou contra e o que mais pesou) e o que o resultado não é; (2) **"Para onde foi cada real"**: dinheiro colocado − custos + valorização + rendimento − IR = patrimônio, nos três lado a lado; (3) **custo por custo de cada caminho** (ITBI, juros, MIP, DFI, tarifa, custos de dono, aluguel, taxa de administração, fundo de reserva, aluguel de espera, ITBI do consórcio, **reajuste das parcelas**, lance), cada um com valor e explicação em linguagem simples, separados em custo (não volta) e patrimônio (continua sendo seu), mais os investimentos, com **o capital inicial (entrada + ITBI/cartório) separado dos aportes mensais** e a explicação de onde vem o orçamento de referência (no exemplo padrão, nos 3 primeiros anos quem define o orçamento é o consórcio, que paga parcela e aluguel ao mesmo tempo, e quem aluga investe a diferença; um print de usuário mostrou que o total aplicado, sozinho, parecia dinheiro vindo do nada) e depois rendimento bruto, IR e saldo; (4) **todas as premissas usadas**. O ponto de virada (valorização do imóvel em que a ordem muda) e a sensibilidade à data de contemplação (12, 36, 60, 120 e 180 meses) mostram que o vencedor depende das premissas.

**Contabilidade que fecha (garantida por teste).** `detalhe.contabilidade` reconcilia cada cenário: `patrimônio = totalColocado − custos + valorização + rendimento − IR − custos de venda`, com `diferenca` ≈ 0. Um teste roda 11 cenários (Price, lance por prazo e por parcela, horizonte maior que o prazo, IR ligado e desligado, consórcio quitado antes, reajustes altos, sem entrada...) e exige diferença de até R$ 1. Isso pegou dois erros durante o desenvolvimento: o custo do consórcio não contava a taxa embutida na dívida restante, e o reajuste das parcelas depois do uso da carta não aparecia como custo (agora aparece: sem ele a conta não fecha com correção).

**Onde fica.** Cartão **"🏠 Financiar, alugar ou consórcio?"** na landing, abaixo do Simule Ativos (decisão do responsável: cartão próprio na página inicial, não dentro do hub da D42), que abre `?tela=simuleImovel`, tela avulsa que não depende do questionário. Página de SEO `/financiar-alugar-ou-consorcio/`, com cartão em "Ferramentas gratuitas", link no rodapé e no hub Aprender.

**Não modelado (dito na tela).** Ganho de capital com isenção de imóvel único, seguro de vida do grupo e taxa de transferência de cota, devolução do fundo de reserva, multa por atraso, FGTS, reformas, vacância, queda de preço por região, mudança da TR, antecipação de parcelas, aprovação do crédito, desempenho do preço do imóvel diferente do informado.

**Desempenho.** Cálculo completo em ~22 ms: as ~60 simulações auxiliares (ponto de virada e contemplação) rodam em modo leve (sem série mensal nem CET); a tela usa `useDeferredValue` para a digitação não esperar o resultado.

**Limites conhecidos.** (1) O IR de longo prazo usa a alíquota de 15% para todo o fundo quando o horizonte passa de dois anos, mesmo para aportes recentes; o efeito é pequeno em horizontes longos e maior em horizontes curtos. (2) O consórcio supõe contemplação em mês fixo; na vida real ela é incerta (por isso a tabela de sensibilidade). (3) Se o capital inicial não cobre lance + ITBI + complemento da carta, o buraco é tratado como dinheiro tomado ao custo do rendimento, e a tela avisa. (4) Os valores de partida do financiamento e do consórcio precisam ser conferidos pelo responsável contra propostas reais antes da divulgação. (5) A revisão do texto de aviso ("conta matemática, não recomendação") é do responsável certificado.

**Testes.** 1.046 → 1.128 no app e 178 → 180 nos scripts. Cobrem as tabelas SAC/Price, o CET, a conservação de dinheiro com taxas zeradas, a reconciliação item a item em 11 cenários, a decomposição da vantagem, o ponto de virada (empate na valorização encontrada e ordem acima e abaixo dela), a sensibilidade à contemplação, o lance nas duas regras, a série mensal sem o mergulho pré-contemplação, os campos com três casas decimais (seguros), os fluxos de tela (vencedor, erro de validação, regra do lance, SAC/Price, custos de venda, gráfico por teclado) e as páginas de SEO.

**Consequência.** Motor, questionário, API e simuladores de ativos não mudaram. O comparativo roda inteiro no navegador (aritmética sobre premissas informadas, sem regra proprietária a proteger).

## D45 (03/10/2026): Simule Bens, o hub do comparativo (imóvel hoje; carro e moto depois)

**Contexto.** Depois da D44 (comparativo de imóvel), a ideia é atender também carro e moto, e incluir **comprar à vista** como quarta rota. Como na D42 (Simule Ativos), a landing não deve ganhar um cartão por bem; o certo é um cartão só que abre um hub.

**Decisão.** Tela nova **Simule Bens** (`?tela=simuleBens`, tela avulsa, sem questionário), com um cartão para cada bem: **Imóvel** (ativo, leva a `?tela=simuleImovel`, que não mudou de endereço) e **Carro** e **Moto** como **"Em breve"** (sem link, `aria-disabled`, para ninguém cair numa tela vazia). O cartão da landing passa a abrir o hub, e o comparativo de imóvel volta para "← Simule Bens", como os simuladores de ativos voltam para o Simule Ativos. Quando carro ou moto ficarem prontos, basta trocar `disponivel` para `true` em `BENS` (`screens/SimuleBens.tsx`).

**Decisão sobre "comprar".** No desenho do responsável, **comprar significa pagar à vista**: as quatro rotas serão *comprar à vista, financiar, consórcio e alugar*. Isso muda o motor (a pessoa informa **quanto tem disponível hoje**; quem financia, entra no consórcio ou aluga aplica a sobra), então não entra nesta decisão: fica para a **D46**, com testes e registro próprios.

**Por que o título da landing ainda NÃO diz "à vista".** O cartão continua "Financiar, alugar ou consórcio?", porque o comparativo publicado ainda não tem a rota à vista. Anunciar quatro caminhos antes de calculá-los seria prometer o que a ferramenta não faz. O título passa a "Comprar à vista, financiar, consórcio ou alugar?" junto com a D46 (uma linha em `index.html`).

**O que não mudou.** Nenhum cálculo, nenhuma premissa, nenhuma página de SEO. A página `/financiar-alugar-ou-consorcio/` continua abrindo o comparativo direto (`/app/?tela=simuleImovel`), e os endereços já divulgados seguem valendo. Quem chega por ela volta, no app, para o hub.

**Consequência.** Um clique a mais para quem sai da landing até o comparativo de imóvel (landing → hub → imóvel), o mesmo custo do Simule Ativos. Em troca, a landing não cresce quando carro e moto chegarem.

**Testes.** 1.128 → 1.134 no app: o hub (links, itens indisponíveis sem link, aviso, volta à landing), o retorno do imóvel ao hub e o `?tela=simuleBens` abrindo a tela sem nenhuma resposta salva.

## D46 (03/10/2026): Comprar à vista, a quarta rota do comparativo de imóvel

**Contexto.** No desenho do responsável, "comprar" significa **pagar à vista**: as rotas passam a ser comprar à vista, financiar, consórcio e alugar. A D44 só tinha as três últimas.

**Decisão: campo novo "Dinheiro disponível hoje" (`dinheiroDisponivel`).** Quanto a pessoa tem hoje, em R$. Regras:
- **`null` (padrão) = só a entrada + o ITBI do financiamento**, exatamente o comportamento anterior. Com isso, **nada do que estava publicado muda** para quem não mexer no campo. Comprovado por um teste de regressão que comparou o motor da D45 com o da D46 em 12 cenários (288 campos de cenário, a contabilidade, os investimentos, a série mês a mês, o ponto de virada e a sensibilidade): idênticos, número a número.
- **Maior que a entrada + ITBI:** a sobra fica aplicada desde o mês 0 em todos os caminhos (no financiamento, `C − entrada − ITBI`; no aluguel e no consórcio, `C` inteiro).
- **Menor que a entrada + ITBI:** erro em português ("precisa cobrir ao menos a entrada mais o ITBI e o cartório").
- **Cobre o imóvel + ITBI (`C ≥ V + ITBI`): a rota "comprar à vista" entra** (4 caminhos). **Senão, fica de fora do ranking**, e a tela diz quanto falta, com um botão que preenche o valor necessário. Nunca se inventa dinheiro para viabilizá-la.
- Na tela, enquanto o campo não for informado, ele acompanha a entrada (entrada + ITBI). Apagar o campo volta a esse modo. O campo antigo "Entrada disponível" passou a se chamar **"Entrada do financiamento"**, porque "disponível" agora é o dinheiro total.

**Como a rota funciona.** No mês 0 paga o imóvel inteiro e o ITBI/cartório com o dinheiro disponível e aplica o que sobrar. Não há dívida, juros, seguros nem parcela; só os custos de quem é dono (IPTU, condomínio, manutenção). **Mesma regra do mesmo dinheiro:** como o à vista só gasta os custos de dono, ele **nunca define o orçamento de referência** (que continua sendo o maior desembolso entre os outros caminhos) e **investe a diferença todo mês**, como quem aluga. Isso supõe que a pessoa mantém a mesma verba mensal dos outros caminhos, e a tela diz isso. O "preço escondido" da rota é o rendimento do dinheiro que virou imóvel; é isso que decide se compensa, e o texto do bloco e o ponto de virada mostram.

**Contabilidade.** A identidade `patrimônio = colocado − custos + valorização + rendimento − IR − custos de venda` passou a usar **C (o dinheiro disponível)** no lugar do capital K0 (entrada + ITBI) e vale para as quatro rotas; um teste a verifica em 10 cenários com a rota ativa (dinheiro exato, com sobra, Price, lance, custos de venda, IR desligado, horizonte curto e longo, imóvel que desvaloriza, entrada grande). A decomposição da vantagem do primeiro sobre o segundo colocado continua somando exatamente, agora com quatro rotas.

**O que a tela ganhou.** Título "Comprar à vista, financiar, consórcio ou alugar?"; o campo e um atalho para preencher o valor necessário; um aviso quando a rota fica de fora; quarta linha no gráfico (traço ponto-e-traço e cor própria, para quem não distingue cores); quarta coluna em "Para onde foi cada real"; bloco "Comprar à vista: cada custo e cada taxa" (primeiro na lista, na ordem do título); linha "Comprar à vista × alugar" no ponto de virada. **Quando a ordem não muda no intervalo testado, o ponto de virada agora diz quem fica sempre na frente** (antes dizia só que a ordem não mudava).

**Tabela comparativa.** Corrigido um defeito antigo: o CSS mirava filhos diretos, mas as linhas ficam em `div` de linha com `display: contents`, então bordas e alinhamento das células nunca foram aplicados. Agora a tabela tem bordas e números alinhados, sem o "R$" repetido (a unidade vai na legenda) e cabe em até quatro colunas em tela de 360 px.

**Textos públicos.** Cartão da landing, hub Simule Bens, página de SEO (`/financiar-alugar-ou-consorcio/`, endereço mantido, com título, descrição, lead, custos e duas perguntas novas sobre pagar à vista) e Metodologia agora falam em quatro caminhos. O título da página de SEO foi encurtado para caber nos 75 caracteres que o teste de qualidade exige.

**Ajuste após uso real (03/10/2026).** Um usuário perguntou por que o atalho dizia R$ 520.000 para um imóvel de R$ 500.000: os R$ 20.000 são o ITBI, a escritura e o registro (4% do imóvel no valor de partida), e a tela não mostrava isso. Mudanças: (1) o campo "Dinheiro disponível hoje" subiu para logo depois do valor do imóvel, no começo do formulário; (2) o campo "ITBI, escritura e registro" saiu do bloco do Financiamento (onde parecia só valer para financiar) e foi para o primeiro bloco, com o valor em reais e o aviso de que varia por cidade; (3) o botão passou a dizer "Usar R$ 520.000 (imóvel + ITBI e cartório)" e a dica mostra a conta ("o imóvel (R$ 500.000) mais o ITBI e o cartório (R$ 20.000)"). O percentual de 4% continua sendo valor de partida nosso, e o responsável deve conferir o do município antes de divulgar.

**Limites conhecidos.** (1) Não há ainda a rota "juntar e comprar depois" para quem não tem o dinheiro (aporte mensal até chegar ao valor): quem não cobre o imóvel só vê o aviso do que falta. (2) O à vista supõe que a pessoa investe a diferença mensal; se gastar, o resultado cai, como no aluguel. (3) O IR do fundo continua aproximado (alíquota do horizonte inteira). (4) A isenção de ganho de capital do imóvel único continua fora do cálculo.

**Testes.** 1.134 → 1.170 no app (28 do motor, 8 de tela, ajustes nos existentes) e 180 nos scripts (um teste de metodologia atualizado).

**Consequência.** O comparativo agora cobre as quatro rotas que o responsável definiu. O motor continua sendo função pura rodando no navegador. Carro e moto (D47 em diante) herdam o campo de dinheiro disponível e a rota à vista.


## D47 (03/10/2026): Simule Carro, o segundo bem do Simule Bens

**Contexto.** O hub Simule Bens (D45) já trazia Carro como "Em breve". O imóvel (D44 a D46) compara rotas por **patrimônio final**; para um carro isso engana, porque o bem perde valor e quase qualquer alternativa "ganha" de quem compra, ignorando a utilidade. O responsável decidiu, em resposta às três perguntas de abertura: (1) **mostrar custo e patrimônio lado a lado, com o custo em destaque**; (2) a alternativa a ter o carro entra como **um valor mensal único** informado pela pessoa (assinatura, locação ou aplicativo); (3) a primeira versão cobre **0 km e seminovo, com curvas de depreciação diferentes**.

**Decisão: motor novo `simulaCarro.ts`, cópia adaptada do `simulaImovel.ts`.** O motor do imóvel **não foi alterado** (a classe `Fundo`, o `degrau` e a busca de raiz foram copiados; `tabelaFinanciamento` e `calcularCet` são importados). Única mudança fora do carro em código compartilhado: o `GraficoPatrimonio` aceita a propriedade opcional `nomes` (padrão igual ao antigo), para rotular a linha "Sem carro".

**O que se manteve do modelo (briefing, seção 4).** (a) **Mesmo dinheiro:** todos partem do mesmo capital e, a cada mês, o orçamento de referência é o maior desembolso entre os caminhos; quem gasta menos investe a diferença. (b) **Contabilidade que fecha:** `patrimônio = colocado − custos + valorização + rendimento − IR − custos de venda`, com a depreciação entrando como valorização **negativa**; há teste em 10 cenários e vale para as quatro rotas. (c) **Dinheiro disponível hoje:** `null` = só a entrada mais os custos de aquisição do financiamento (emplacamento, IOF, gravame); a rota à vista só entra se o dinheiro cobrir o carro mais o emplacamento, senão a tela diz quanto falta. (d) **O CET é resultado**, nunca entrada: parte do valor financiado menos IOF e gravame (que saem do bolso) e usa só as parcelas. (e) Antes da contemplação do consórcio não há carro nem dívida na série. (f) A ferramenta não indica banco, administradora, locadora, aplicativo nem produto.

**As duas leituras são a mesma conta.** Como todos os caminhos colocam o mesmo dinheiro, `custo líquido = dinheiro colocado − patrimônio final`. Logo a ordem por custo é a **exata inversa** da ordem por patrimônio; não são critérios concorrentes, e a tela diz isso. Além do líquido (que já desconta o rendimento do dinheiro e, por isso, depende de quanto capital a pessoa tem aplicado), mostra-se o **custo bruto** (custos que não voltam + perda de valor do carro + deságio da revenda, se ligado), que é o que "saiu do bolso e não voltou". Um teste verifica a identidade e a ordem inversa.

**O que muda em relação ao imóvel.**
- **Depreciação:** curva em dois trechos, nominal, sobre o valor corrente (`valor = p0 × (1−d1)^(m/12)` até o 12º mês; depois `p0 × (1−d1) × (1−d2)^((m−12)/12)`). Valores de partida **nossos e editáveis**: 0 km 14% no 1º ano e 9% depois; seminovo 9% e 7%. Os botões 0 km/Seminovo (amarelos quando selecionados, `chip` + `selected` + `aria-pressed`) recarregam **só** depreciação, manutenção e envelhecimento da manutenção; valor do carro, entrada e demais campos não mudam.
- **Custos de dono:** IPVA e seguro (% do valor de mercado no início de cada ano de posse; partida 3% e 4%), manutenção (% do preço de compra, partida 1% em 0 km e 2,5% em seminovo, subindo com a inflação e mais 10% ou 8% ao ano de envelhecimento) e uso (combustível, estacionamento, pedágio: R$ 800 por mês, corrigido pela inflação). No lugar de ITBI, IPTU e condomínio. O IPVA é diluído por mês (na prática é anual ou em cotas).
- **Aquisição:** emplacamento (1,5%) em todo caminho que compra; IOF (3% do financiado, pago no início) e gravame (R$ 400) só no financiamento.
- **Financiamento:** sempre **Price**, com juros em **% ao mês** (partida 1,9%), prazo em meses (partida 48), entrada de R$ 30.000.
- **Consórcio:** prazo de 72 meses, taxa de administração de 15%, fundo de reserva de 2%, contemplação no 18º mês (partida). Até a contemplação paga **parcela e a mobilidade sem carro**. Na contemplação compra o carro **equivalente** (que acompanha a inflação até lá) e paga o emplacamento; **o carro só começa a perder valor depois da contemplação**. A carta é corrigida uma vez por ano e o preço do carro, continuamente (mesma convenção do imóvel), então no mês 12 faltam 4,5% de correção da carta.
- **Sem carro:** não é aluguel de carro. É o gasto mensal **total** de mobilidade (partida R$ 1.800), corrigido pela inflação; quem tem o carro paga o uso por conta própria, e esse valor já inclui tudo. Substitui o "alugar" do imóvel nas barras e no gráfico (a linha usa o estilo do aluguel).
- **Ponto de virada:** deixa de ser a valorização do bem e passa a ser o **gasto mensal sem carro** a partir do qual cada rota de ter o carro empata com ficar sem ele (busca de raiz entre R$ 0 e R$ 15.000). Com os valores de partida e dinheiro padrão, financiar empata perto de R$ 2.960 por mês e o consórcio perto de R$ 2.962.
- **Horizonte:** de 1 a 10 anos (partida 5), porque em prazos longos o carro precisaria ser trocado, o que o modelo não faz; a tela avisa a partir de 8 anos.
- **Revenda:** opção de descontar um deságio (partida 5%) no patrimônio final; não há ganho de capital.

**Fontes dos valores de partida.** Rendimento (Selic) e inflação (IPCA) vêm da projeção de longo prazo do Boletim Focus, como no imóvel. A fonte oficial para os **juros** é a série **SGS 25471** do Banco Central (taxa média mensal de juros, recursos livres, pessoas físicas, aquisição de veículos; a 20749 é a mesma em % ao ano), confirmada no catálogo de dados abertos do Banco Central. **Nesta entrega o valor mais recente da série não foi lido; os 1,9% ao mês são nossos**, marcados como tal na tela, e a pendência está em `docs/06`. Depreciação, IPVA, seguro, manutenção, uso, IOF e gravame de partida também são **nossos**, estimativas de ordem de grandeza que o responsável deve conferir (tabela FIPE, cotações e o IPVA do estado) antes de divulgar.

**Efeito do orçamento de referência a conhecer.** Como no imóvel, juros maiores no financiamento elevam a parcela e, portanto, o orçamento de referência; quem fica sem carro passa a investir mais. Isso é a regra do mesmo dinheiro funcionando, não um erro, e um teste o documenta.

**Textos públicos.** Cartão "Carro" do hub ativado (`disponivel: true`) e página de SEO nova `/carro-a-vista-financiar-consorcio-ou-sem-carro/` (título de 56 caracteres, descrição, FAQ de 7 perguntas, links no rodapé, no hub Aprender e na Metodologia). A Metodologia ganhou uma frase dizendo que o comparativo de carro ordena caminhos, nunca bancos, administradoras, locadoras, aplicativos ou produtos. **O cartão da landing não foi alterado** (continua falando do imóvel); decidir se ele deve passar a falar em "bens".

**Não foi pedido e não foi feito:** mexer no motor ou nas premissas do imóvel; seletor "Quais caminhos comparar?"; botão de cenário histórico; desabilitar campos do financiamento.

**Limites conhecidos.** (1) Não há "juntar e comprar depois". (2) O IR do fundo continua aproximado (alíquota do horizonte inteiro). (3) Não há troca de carro nem ganho ou prejuízo de capital na venda. (4) O custo líquido depende do capital aplicado; a tela explica e mostra o bruto ao lado. (5) A utilidade de ter o carro não entra na conta. (6) Moto reaproveitará `simulaCarro.ts`; moto de trabalho (que gera renda) continua como caso a decidir.

**Testes.** 1.182 → 1.230 no app (36 do motor, 10 de tela, 1 do hub, 1 do estado; testes do hub reescritos porque o carro deixou de ser "Em breve") e 180 → 182 nos scripts (página de SEO do carro; contagem de páginas 33 → 34).

**Consequência.** O Simule Bens passa a ter dois bens. O motor do carro é função pura no navegador, como o do imóvel, e é a base da moto (D48).


## D48 (03/10/2026): Simule Moto, o terceiro bem do Simule Bens

**Contexto.** O hub Simule Bens (D45) tinha a Moto como "Em breve". O briefing previa que ela reaproveitasse o motor do carro "com outros valores de partida" e deixava em aberto se a **moto de trabalho** (que gera renda) seria caso à parte. O responsável pediu para seguir com a moto sem responder sobre a moto de trabalho.

**Decisão 1: escopo = moto de uso pessoal; moto de trabalho fica de fora.** Foi o padrão conservador: a renda que o bem produz (entrega, mototáxi) muda a pergunta de "quanto custa" para "quanto o bem se paga", e o motor não tem esse fluxo. Não se inventou premissa de renda. A página de SEO e a FAQ dizem isso expressamente. **Decisão pendente do responsável:** se a moto de trabalho deve virar uma versão própria (com um campo de renda líquida mensal gerada pelo bem) ou se basta o aviso atual.

**Decisão 2: nenhum motor novo.** `simulaMoto.ts` tem só os valores de partida da moto (`inputsMotoPadrao`, `PRESET_TIPO_MOTO`, `aplicarTipoMoto`, `simularComparativoMoto`) e chama `simularComparativoCarro`. Valem, portanto, as mesmas regras do carro: mesmo dinheiro, contabilidade que fecha, dinheiro disponível `null` = entrada + custos, à vista só se couber, CET como resultado, antes da contemplação não há bem nem dívida, e as duas leituras (custo e patrimônio) lado a lado.

**Única mudança no motor do carro (aditiva).** Campo novo `bem: 'carro' | 'moto'` em `InputsCarro` (padrão `'carro'`), que escolhe só o **vocabulário** das mensagens do motor: erros de validação ("Informe o valor da moto."), avisos, descrições de custo e o nome do vencedor ("Sem moto"), com a concordância de gênero certa. Sem isso a moto herdaria mensagens falando em carro. O cálculo não mudou; os 46 testes do carro continuaram passando sem alteração, e novos testes comprovam que as mensagens do carro permanecem idênticas.

**Valores de partida da moto (todos nossos, editáveis, a conferir antes de divulgar).** Moto de baixa cilindrada de R$ 20.000, entrada de R$ 6.000, financiamento em 36 meses a 2,2% ao mês (carro: 48 meses a 1,9%), IPVA de 2%, seguro de 6% do valor (carro: 4%, por causa do risco de roubo), emplacamento de 2,5%, uso de R$ 250 por mês (combustível, estacionamento e pedágio), consórcio de 60 meses com contemplação no 12º, e gasto de R$ 600 por mês sem moto. Depreciação: 0 km 10% no 1º ano e 7% depois; seminovo 7% e 5% (carro: 14/9 e 9/7). Manutenção: 3% do preço no 1º ano em 0 km e 4% em seminovo, com envelhecimento de 8% e 6% ao ano (carro: 1% e 2,5%), porque moto gasta mais com corrente, pneus e óleo. IOF de 3% e gravame de R$ 400 como no carro. **Nenhum vem de fonte oficial:** a série 25471 do Banco Central (aquisição de veículos) não separa moto, e não foi lida nesta entrega. Rendimento e inflação continuam vindo do Boletim Focus.

**Resultado com os valores de partida e o dinheiro padrão (R$ 7.320).** Custo bruto de cerca de R$ 690 por mês para financiar e para o consórcio, R$ 656 sem moto; "Sem moto" termina à frente. O ponto de virada fica perto de R$ 720 por mês de gasto sem moto para financiar e perto de R$ 700 para o consórcio. Com R$ 30.000, a rota à vista entra e empata perto de R$ 630.

**Telas.** `SimuleMoto.tsx` e `DetalheCustosMoto.tsx` foram gerados a partir das do carro por um filtro que protege os nomes de código e aplica o gênero (o carro → a moto, do carro → da moto, ao carro → à moto), **e depois revisados frase a frase**: o filtro não pegava concordâncias como "preço da moto novo", "moto mais velho" ou "a moto é comprado", todas corrigidas. Um teste da tela garante que a palavra "carro" só aparece nas duas comparações de seguro escritas de propósito ("seguro maior que no carro, por causa do risco de roubo"). Textos próprios de moto: risco de roubo no seguro, corrente na manutenção, capacete e equipamentos no uso. Os botões 0 km/Seminovo (amarelos, `chip` + `selected` + `aria-pressed`) recarregam só depreciação, manutenção e envelhecimento da manutenção.

**Duplicação consciente.** As duas telas e os dois arquivos de detalhe da moto duplicam os do carro (cerca de 1.000 linhas) em vez de parametrizar os componentes por bem. Motivo: o briefing orienta copiar, evita mexer em telas do carro já publicadas e testadas, e deixa a moto livre para divergir (moto de trabalho). **Custo:** uma correção de texto no carro precisa ser repetida na moto. Se surgir um quarto bem, vale parametrizar por `bem` em vez de copiar de novo.

**Textos públicos.** Cartão "Moto" do hub ativado (`disponivel: true`); com os três bens no ar, nenhum cartão fica como "Em breve" (o suporte a "Em breve" no hub continua para bens futuros). Página de SEO nova `/moto-a-vista-financiar-consorcio-ou-sem-moto/` (título de 54 caracteres, FAQ de 7 perguntas incluindo "posso usar para moto de trabalho?"), com links no rodapé, no hub Aprender e na Metodologia. **O cartão da landing não foi alterado.**

**Não foi pedido e não foi feito:** mexer em premissas do imóvel ou do carro; seletor "Quais caminhos comparar?"; botão de cenário histórico; desabilitar campos do financiamento.

**Limites conhecidos.** (1) Moto de trabalho fora do escopo. (2) Valores de partida sem fonte oficial. (3) Os mesmos do carro: sem "juntar e comprar depois", sem troca de moto no horizonte, IR aproximado, sem ganho de capital na venda, sem a utilidade de ter a moto. (4) Motos de alta cilindrada ou elétricas têm depreciação e custos bem diferentes e exigem trocar os valores de partida.

**Testes.** 1.230 → 1.258 no app (motor da moto, tela da moto, hub e estado) e 182 → 184 nos scripts (página de SEO da moto; contagem de páginas 34 → 35).

**Consequência.** O Simule Bens tem os três bens previstos. O próximo passo natural não é um novo bem, e sim fechar as pendências de fonte (série do Banco Central, FIPE) e decidir sobre a moto de trabalho.

## D49 (04/10/2026): Top 15 ações mais baratas dentro do Simule Ações, com metodologia auditável

**Contexto.** O responsável pediu, dentro do Simule Ações, duas caixas: o simulador de sempre e um "Top 15 mais baratas", baseado num método quantitativo de valor (filtros de liquidez, lucro e volatilidade; indicador composto de PL/valor de mercado, caixa operacional/EV e EBIT/EV; ranking; seleção), com dados 100% gratuitos, filtros de qualidade opcionais e **toda a metodologia de verificação documentada e auditável**.

**Decisão.** (1) **Duas caixinhas** em `SimuleAcoes` (`role="tablist"`, visual `.vehicle-card` já existente): "Simulador" (abre por padrão, sem nenhuma mudança de comportamento) e "Top 15 mais baratas" (`screens/Top15Baratas.tsx`). (2) **Cálculo fora do app**, em job mensal (`.github/workflows/atualizar-acoes-baratas.yml`, dia 2) e sob demanda, no padrão dos outros jobs (Node `.mjs`, sem dependências). O app recebe o resultado pronto em `data/acoesBaratas.json`; **nunca recalcula nota nem reordena** (os filtros de qualidade só retiram nomes). (3) **Fontes 100% gratuitas:** dados abertos da CVM (DFP, ITR, composição do capital, FCA para ligar código a CNPJ) e o histórico de preços da B3 que o job de Ações já mantém. (4) **Metodologia** em `docs/09-metodologia-acoes-baratas.md` e parâmetros em `config/acoes-baratas.json` (fonte única, versionada).

**Auditabilidade (o requisito central).** O cálculo é um módulo **puro** (`scripts/acoes-baratas-calculo.mjs`: sem rede, sem disco, sem relógio) que consome "insumos" congelados. Cada execução grava `auditoria/acoes-baratas/AAAA-MM-DD/` com: `manifesto.json` (URL, sha256, tamanho e instante de cada arquivo da CVM; sha256 da config, dos insumos, do resultado e do código de cálculo; commit e execução do GitHub), `insumos.json.gz` (cada linha da CVM usada, com conta, versão, período e link do documento), `memoria-de-calculo.json.gz` (fórmula, valor e componentes de cada número de cada empresa), `resultado.json`, `ranking.csv`, `exclusoes.csv` (toda empresa fora do ranking, com etapa, código e motivo), `mapeamento-ticker-cnpj.csv` e `config.json`. **Verificação independente** (`scripts/acoes-baratas-verificar.mjs`, que depende só do cálculo e do Node) refaz o resultado a partir dos insumos e compara hashes; o workflow roda isso antes de publicar, e um teste a executa como processo separado com apenas dois scripts. A tela mostra a pasta, o comando e os hashes.

**Regras de projeto que sustentam a auditoria.** Nada falha em silêncio: cabeçalho de CSV da CVM fora do esperado derruba o job; toda exclusão tem motivo; conta opcional ausente vale zero *e isso fica escrito*; qualquer outra anomalia exclui a empresa. Apenas a maior `VERSAO` de cada documento vale; só entram documentos recebidos até a data de corte (sem olhar o futuro). Verificações de integridade por empresa: balanço fecha, DRE fecha, descrição da conta, capital plausível (P/VP implícito entre 0,02 e 100), demonstração com no máximo 200 dias.

**Filtros de qualidade opcionais** (depois do ranking; não mudam a nota): ROIC ≥ 10%; dívida líquida/EBITDA ≤ 3,0x (caixa líquido passa); caixa operacional positivo; **cobertura de juros** ≥ 3,0x (EBIT ajustado ÷ despesas financeiras 3.06.02); **consistência de 5 exercícios** (lucro e FCO positivos em ≥ 4 dos 5 últimos DFP consecutivos). Os limites são parte da metodologia e aparecem na tela.

**Conflito declarado com a D19 e aprovação.** A D19 definiu que as telas de ativos são **estritamente descritivas, sem ranking nem múltiplos**, para manter o app longe da atividade de análise de valores mobiliários (Resolução CVM 20), e o registro (parecer de 26/09) **recomenda buscar parecer independente de especialista em mercado de capitais antes de qualquer mudança na natureza do conteúdo, citando expressamente ranking de ativos**. O Top 15 é exatamente isso, então ele nasceu como exceção declarada e a configuração foi entregue **travada** (`aprovadoPeloResponsavel: false`).

**Aprovação (04/10/2026).** O responsável, que é advogado e dono do projeto, autorizou a publicação, caracterizando o Top 15 como **análise estritamente contábil de informações públicas das empresas, por fórmula única, e não recomendação de compra**. A flag passou a `true`, com a aprovação registrada em `config/acoes-baratas.json`. **Não foi obtido parecer independente de terceiros** (o registro diz isso de forma expressa: `parecerIndependente: false`); é uma análise interna do próprio autor, como na D32, e a recomendação da D19 de buscar parecer externo permanece em aberto como risco aceito. Consequências da aprovação: (a) o texto da página pública de Metodologia, que dizia que os simuladores de ativos "não fazem ranking", foi ajustado para descrever o Top 15 como a única exceção, contábil e sem recomendação (a trava de coerência por teste, que impede publicar com a frase antiga, passou a valer e passa); (b) as páginas Sobre/FAQ continuam dizendo que o app não faz recomendação, o que é coerente com a natureza declarada; (c) a tela se apresenta como triagem por fórmula, "barata nos números não quer dizer boa compra", sem projeção de retorno.

**Trava de sanidade da publicação.** Como os dados da CVM nunca foram lidos em arquivo real, a primeira execução pode produzir resultado quebrado sem derrubar o job. Antes de atualizar o app, o job barra a publicação se houver menos de 40 empresas no ranking ou se mais de 35% das empresas do escopo ficarem sem dados utilizáveis (`publicacao.sanidade`). Barrada, a auditoria fica gravada e guardada como artefato do workflow (30 dias), o app não é alterado e o erro explica o motivo. Os limites são palpites de partida a ajustar depois da primeira execução real.

**Limites conhecidos.** (1) **Nunca rodou com dados reais da CVM**: foi desenvolvido contra fixtures no layout documentado (`scripts/fixtures/cvm`, dados fictícios, cenário calculado à mão); nomes de arquivo/colunas da composição do capital e do FCA não foram confirmados em arquivo real. A primeira execução no GitHub Actions é parte da validação. (2) Caixa operacional sem desconto de capex (contas de capex não são padronizadas na CVM; usá-las quebraria a auditabilidade). (3) O universo é o cadastro do app, não a bolsa inteira. (4) Sem backtest: a tela não afirma nada sobre desempenho. (5) Sem proventos; cortes únicos entre setores; ROIC com capital do fim do período. (6) Ver a seção 10 de `docs/09-metodologia-acoes-baratas.md`.

**Testes.** Scripts: 184 → 215 (31 novos, incluindo a trava de sanidade e o registro da aprovação, em `scripts/acoes-baratas.test.mjs`: estatística, leitura de CSV da CVM com fixtures, LTM, cada filtro e motivo, integridade, determinismo, cobertura, consistência, ciclo gravar/verificar/adulterar, verificador independente em processo separado, trava de publicação e trava de coerência com o texto público). App: 1.258 → 1.274 (16 novos: domínio dos filtros, caixa do Top 15 nos estados "em validação" e publicado, combinação de filtros, memória de cálculo, busca de exclusões, troca entre as duas caixinhas). Os 13 testes anteriores do Simule Ações continuam passando sem alteração, exceto o título de um deles, que agora diz que é a *aba do simulador* que não faz ranking. Foi feito teste de mutação nas regras de consistência e cobertura; os dois mutantes que sobreviveram são equivalentes (mesmo comportamento).

**Próximos passos do responsável (nesta ordem).** Rodar o workflow manualmente (Actions → "Atualizar Top 15 Ações Baratas"): como a publicação está aprovada, **a primeira execução bem-sucedida já atualiza o app**, e a trava de sanidade é a rede de proteção; revisar `mapeamento-ticker-cnpj.csv` e `exclusoes.csv`; conferir 5 empresas contra a CVM (modelo em `auditoria/acoes-baratas/conferencia-manual-modelo.md`); ajustar os limites de qualidade (ROIC 10%, dívida líquida/EBITDA 3,0x, cobertura 3,0x e 4-de-5 são escolhas, não regras) e os de sanidade; considerar o parecer independente.

**Consequência.** Motor de perfil, questionário, API, Meu Mês, Meus Ativos, os demais simuladores e a landing não mudaram. O repositório tem uma cópia defasada deste registro na raiz (`07-registro-de-decisoes.md`, sem a D48); o vigente é este, em `docs/`.

## D50 (04/10/2026): Top 15 liberado só com o código mensal, validado no servidor

**Contexto.** O responsável quis restringir o Top 15 a quem "seguir no Instagram ou tiver um código do autor", e iniciar os testes com **um código único por mês**. Duas constatações moldaram a solução: (1) **não existe verificação legítima de quem segue uma conta**: a API oficial da Meta só devolve a *contagem* de seguidores, nunca a lista, e as ferramentas que raspam a lista violam a política da plataforma e arriscam a conta; (2) **esconder a caixa na tela não protege nada**, porque o ranking ia embutido no arquivo do app, legível por qualquer pessoa. Por isso o acesso é por código, validado no servidor, e o código é distribuído pelo Instagram (quem quer a lista acompanha o perfil), sem tentar verificar o "seguir".

**Decisão.** (1) **O ranking sai do arquivo do app.** O job (`atualizar-acoes-baratas.mjs`) passa a gravar duas metades: o **cabeçalho** (versão, datas, hashes, parâmetros, limites de qualidade, perfil do Instagram, sem nenhuma ação) em `webapp-src/src/data/acoesBaratas.json`, e a **lista completa** em `dados-privados/acoes-baratas.json`, pasta fora do app e fora do `dist-site`. (2) **Função `api/top15.ts`** (`POST { codigo }`): confere o código e só então devolve a lista; `vercel.json` inclui `dados-privados/**` apenas nessa função. (3) **Código na variável `TOP15_CODIGOS` da Vercel**, nunca no repositório; aceita **mais de um código separado por vírgula** para a virada do mês sem derrubar ninguém. Sem código configurado, a porta fica **fechada**. Códigos com menos de 8 caracteres na configuração são ignorados. (4) **Tela**: `Top15Baratas` mostra o campo do código (com link para o Instagram), lembra o código no aparelho e, quando ele vence, o servidor o recusa, o app apaga o salvo e volta a pedir. Falha de rede não apaga o código salvo. (5) **Gerador** `npm run codigo-top15`: formato `CI-XXXX-XXXX`, 24 símbolos sem ambiguidade (~36,7 bits), sorteio criptográfico. (6) **Chave de segurança** `acesso.restritoPorCodigo` em `config/acoes-baratas.json`: com `false`, volta ao modo aberto (ranking no arquivo do app).

**Defesas na função.** Comparação em tempo constante e sem curto-circuito; **limite de 10 tentativas erradas por IP em 15 minutos** (durante a trava nem o código certo passa); do IP guardamos **apenas um hash**, com validade de 15 minutos (Redis quando configurado, com reserva em memória se o Redis falhar); resposta com `Cache-Control: private, no-store`; erro interno devolve mensagem genérica; contagem agregada mensal de acessos (`ok`, `falha`, `bloqueado`), sem identificar ninguém e sem nunca derrubar o acesso se falhar.

**Prova de que a lista não vaza.** Além dos testes, foi simulada uma publicação com nomes de ação inventados, o site foi compilado e foram procurados todos os arquivos que a Vercel serve: **zero ocorrências** em modo por código; no controle positivo (modo aberto), a mesma busca encontrou a lista. Oito mutações nas defesas da função (aceitar qualquer código, tirar a trava, abrir a porta sem configuração, cache público, IP em texto puro, código curto, publicar dado não aprovado, vazar erro interno) foram todas detectadas pelos testes.

**O que isto NÃO é.** (a) Não é segurança forte: **um código único circula e vaza** (alguém o repassa). Funciona como atrito e funil para o Instagram, e se vazar basta trocá-lo. Código individual por pessoa daria controle, a um custo maior; ficou para depois dos testes. (b) Não verifica quem segue o perfil. (c) **Não muda a natureza regulatória do conteúdo**: restringir a audiência não torna a lista outra coisa, e condicionar o acesso a um ranking de ações a um relacionamento com o perfil pode ser lido como captação de clientes, ponto que o responsável deve pesar na análise jurídica. (d) O repositório precisa continuar **privado**: a pasta `auditoria/` e `dados-privados/` contêm o ranking.

**Pendências.** (1) A **Política de Privacidade** (`/privacidade/`) deve citar que, para limitar tentativas de acesso por código, o servidor guarda por até 15 minutos um identificador irreversível (hash) do IP de quem erra o código, e conta acessos e erros de forma agregada; o texto é do responsável e não foi alterado. (2) Variável `TOP15_CODIGOS` precisa ser criada na Vercel antes do primeiro uso; sem ela a tela mostra "ainda não está disponível". (3) O limite de tentativas **não foi aplicado** à `api/recomendacao.ts` (pergunta em aberto: a API do motor, hoje sem limite, permite mapear as matrizes por tentativa e erro).

**Testes.** Scripts: 215 → 231 (13 da função de acesso e do gerador de código, 3 do job e do vazamento). App: 1.274 → 1.289 (cliente do código, porta do código na tela e um teste do Simule Ações inteiro com o arquivo de dados no estado que o job grava). Ver os arquivos `scripts/top15-acesso.test.mjs`, `webapp-src/src/domain/acessoTop15.test.ts` e `Top15Baratas.test.tsx`.

**Consequência.** O motor do perfil, o questionário, os demais simuladores e a landing não mudaram. O Top 15 só mostra a lista a quem tem o código do mês; o simulador de ações segue aberto.

## D51 (04/10/2026): Primeira execução com dados reais da CVM: um erro de cálculo, uma duplicidade e três pontos em aberto

**Contexto.** O workflow rodou pela primeira vez com dados reais e o responsável enviou prints da tela (15 cartões e consultas ao "por que ficou de fora?"). Até então a metodologia só tinha sido exercitada contra arquivos de teste no layout documentado. A leitura dos prints (conferência de coerência interna, não contra a CVM) achou o seguinte.

**1) Erro de cálculo confirmado: EBITDA.** RECV3 mostrava dívida líquida/EBITDA de 51,5x, AZZA3 60,3x e MGLU3 18,2x, com EBIT ajustado/EV de 15,0%, 12,1% e 16,3%. Isso é impossível: como DL/EBITDA = (DL/EV) ÷ (EBITDA/EV), DL/EV ≤ 1 e EBITDA ≥ EBIT, o teto seria 6,7x, 8,3x e 6,1x. Causa: a DVA da CVM apresenta as retenções (conta 7.04.01, depreciação) com **sinal negativo**, e o código somava o valor como veio, o que subtraía a depreciação do EBIT. **Por que os testes não pegaram:** o arquivo de teste foi escrito por quem programou, com a depreciação positiva, uma suposição sobre o formato que a realidade desmentiu; ao construir fixtures, o formato dos dados reais precisa ser confirmado, não suposto. Correção: valor absoluto, com teste nos dois sinais e uma identidade que precisa valer sempre. **Efeito:** só o indicador de dívida líquida/EBITDA e o filtro de qualidade correspondente; a nota e a ordem do ranking não usam EBITDA e não mudam. Versão da metodologia 1.0.0 → 1.0.1.

**2) Duplicidade econômica: GGBR4 e GOAU4.** Apareceram nas posições 14 e 15 com ROIC, dívida líquida/EBITDA e cobertura idênticos: a Metalúrgica Gerdau é holding que consolida a Gerdau. Para o leitor parecem duas oportunidades; é uma. Criada a lista `universo.excluirTickers` (config), com GOAU4 e o motivo; fica a operacional. **Decisão do responsável:** pode remover a linha da config para voltar a listar os dois.

**3) Exclusão do VALE3 por capital implausível.** A trava de integridade funcionou: o P/VP implícito saiu ~0 (valor de mercado muito menor que o PL), típico de quantidade de ações em milhares ou de demonstração em outra moeda. Sem os números na mensagem não dava para saber qual. A mensagem agora traz valor de mercado, PL e ações por classe; a causa será vista na próxima execução. Não foi aplicada correção automática de unidade, para não mascarar erro.

**Em aberto (precisam da memória de cálculo da tela, não do código):** (a) MGLU3 com caixa operacional/EV de 180,4%, valor que exige EV muito pequeno e destoa de DL/EBITDA alto; (b) SEER3 com lucro positivo em 0 de 5 exercícios e ROIC de 17,9% (pode ser coerente se o EBIT é positivo e os juros e baixas levam o lucro a negativo, mas deve ser conferido); (c) 4 das 15 primeiras são varejistas, com FCO/EV de 8% a 180%, o que combina com o efeito do IFRS 16 descrito na seção 10 da metodologia (item 13).

**O que os prints confirmam sem ressalva:** o leitor da CVM funcionou de primeira com arquivos reais (sem erro de layout); a trava de sanidade não barrou; PETR4 entrou no ranking e WEGE3 também (não aparecem como excluídas); o acesso por código funcionou (D50).

**Testes.** Scripts: 231 → 234 (3 novos: EBITDA nos dois sinais com a identidade, duplicidade econômica, mensagem do capital). Mutação: voltar ao erro original, subtrair a depreciação e ignorar a lista de duplicados são detectados.

**Consequência.** O ranking exibido na primeira execução tem a dívida líquida/EBITDA errada e uma duplicidade; ambos se corrigem na próxima execução do workflow (a ordem das 15, por não depender do EBITDA, deve mudar só pela saída de GOAU4).

## D52 (04/10/2026): VALE3 informa a quantidade de ações em milhares: ajuste manual e registrado de unidade

**Contexto.** Depois do D51, a mensagem de exclusão passou a mostrar os números e o responsável enviou a de VALE3: "P/VP implícito de 0.0015 (valor de mercado R$ 293,6 mi ÷ PL dos controladores R$ 196.635 mi; ON 4.072.366 ações × R$ 72,1)". A Vale tem cerca de 4,07 **bilhões** de ações ON, então a quantidade veio **em milhares** no formulário da CVM. Com ×1000, o valor de mercado é ~R$ 293,6 bi e o P/VP ~1,49, plausíveis. Foi a trava de capital plausível (P/VP entre 0,02 e 100) que impediu um número absurdo de entrar no ranking.

**Decisão.** Ajuste **manual, por ticker e registrado**, em `config/acoes-baratas.json → capital.ajustesManuais` (`VALE3: ×1000`, com o motivo). Não há correção automática de unidade: ela esconderia erro de outras empresas, e um erro de milhares em qualquer outra aparece sozinho como exclusão com os números na mensagem, que é como esta foi achada. O ajuste (a) vale só para o ticker listado; (b) fica na memória de cálculo, com a quantidade ORIGINAL da CVM e o motivo; (c) não dispensa a verificação de P/VP plausível, que roda depois: um ajuste errado continua excluindo a empresa, e a mensagem diz que foi "MESMO com o ajuste manual". Versão da metodologia 1.0.1 → 1.0.2.

**Limite conhecido.** Se a Vale passar a informar em unidades, o ajuste a multiplicará por 1000 e o P/VP implícito ficará acima de 100: a trava a excluirá e a mensagem mostrará "MESMO com o ajuste manual". Aí basta remover a linha. As demonstrações dela (PL de ~R$ 196,6 bi) parecem corretas e em reais; só a contagem de ações estava em outra unidade.

**Testes.** Scripts: 234 → 235 (ajuste só para o ticker listado, registro na memória, trava depois do ajuste). Mutação (ignorar o ajuste, aplicá-lo a qualquer ticker, não registrá-lo) detectada.

## D53 (04/10/2026): Conferência de MGLU3 e SEER3 com fontes públicas: uma verificação nova e um erro ainda sem causa

**Contexto.** O responsável enviou a "Memória de cálculo" de MGLU3 e SEER3. Os valores foram comparados com fontes públicas de indicadores e com notícias de resultado (Dados de Mercado, iValor, Investidor Ativos/ADVFN, HG Brasil, Analítica, InfoMoney). Essas fontes calculam por conta própria, então valores próximos confirmam a leitura e diferenças grandes indicam problema; elas não substituem a conferência no documento da CVM.

| Item | Nosso | Fonte pública | Veredito |
|---|---|---|---|
| MGLU3, lucro por exercício (2021 a 2025) | 3 de 5 positivos | +590,7 · −499,0 · −979,1 · +448,7 · +204,6 mi = 3 de 5 | Confere |
| MGLU3, lucro de 12 meses | R$ 89 mi | R$ 88,5 mi (2T26) | Confere |
| MGLU3, caixa operacional | R$ 16,4 bi (12m) | R$ 15,7 bi em 2025 e R$ 15,8 bi em 2024; financiamento −R$ 15 bi | Confere com o reportado |
| SEER3, valor de mercado | R$ 1,9 bi (128,7 mi ações × R$ 14,60) | ações 128,72 mi | Confere |
| SEER3, caixa operacional | R$ 443 mi | ~R$ 425 mi (P/FCO 3,53 a R$ 1,5 bi) | Confere |
| SEER3, patrimônio | R$ 1,5 bi | P/VP ~1,0 a 1,2 a R$ 1,5 bi | Confere |
| SEER3, lucro por exercício | **0 de 5** | +52,5 (2021) · −222,2 · −28,0 · −1,2 · +214,4 (2025) = **2 de 5** | **Não confere** |
| SEER3, lucro de 12 meses | **R$ 57 mi** | TTM R$ 246,7 mi (data da fonte desconhecida; o 2T26 pode diferir) | **Suspeito** |

**MGLU3: a leitura está certa, o indicador é que não serve.** O FCO de R$ 16,4 bi é o que a empresa reporta (apresentação contábil de recebíveis e financiamento a clientes dentro do fluxo operacional, com o espelho no financiamento). Ele fazia o caixa operacional/EV chegar a 180% e colocava a empresa em 3º lugar por um efeito sem significado econômico. **Decisão:** nova verificação de integridade `fco_incoerente`: FCO de 12 meses acima de 3x o EBITDA (ou o EBIT ajustado, sem EBITDA) exclui a empresa, com o motivo e os números na tela "Por que ficou de fora?". Limite em `verificacoes.fcoMaximoSobreEbitda` (3,0); com os números do print as demais 14 empresas ficam entre 0,2x e 1,9x, longe do limite. Mutação detectada.

**SEER3: erro nosso, causa não identificada.** Tudo o que se pôde conferir (ações, valor de mercado, patrimônio, caixa operacional) bate; o lucro, não, e "0 de 5" é impossível com 2021 e 2025 positivos. Para a MGLU3 o mesmo caminho de cálculo do lucro bateu exatamente, o que aponta algo específico da demonstração da Ser e não do método. Hipóteses a verificar: a conta 3.11.01 (atribuído aos controladores) pode divergir da 3.11 (consolidado) na demonstração da Ser, ou o lançamento do lucro nos exercícios antigos usar outra estrutura de contas. **Em vez de chutar a correção, a tela passou a mostrar a prova:** "Como chegamos aos 12 meses" (exercício + acumulado atual − acumulado do ano anterior, para lucro, caixa operacional e EBIT, com período e documento de cada parcela), o lucro consolidado e o dos controladores lado a lado, e o lucro e o caixa de cada exercício. Na próxima execução, a Memória de cálculo da SEER3 mostrará onde o número se desvia. Até lá, "exercícios com lucro" da SEER3 não deve ser usado.

**Também documentado.** A seção 10 da metodologia ganhou a limitação sobre a apresentação do fluxo de caixa (item 13). Versão 1.0.2 → 1.0.3.

**Testes.** Scripts: 235 → 237 (fco_incoerente nos limites, nas duas referências e com os números reais; composição dos 12 meses fechando com o total e histórico por exercício). App: 1.289 → 1.290 (a nova seção da memória de cálculo).

## D54 (04/10/2026): SEER3 resolvida: o lucro dos controladores vem zerado na DFP; o lucro de referência passa a ser o consolidado

**Contexto.** Com a "Memória de cálculo" da D53 em tela, a SEER3 mostrou a causa: na conta 3.11.01 (lucro atribuído aos controladores) a **DFP traz R$ 0 em todos os cinco exercícios** (2021 a 2025), inclusive em 2022, quando a empresa perdeu R$ 222 mi, enquanto os **ITR trazem valores normais** (R$ 182 mi no 1S26 e R$ 125 mi no 1S25). O lucro de 12 meses (exercício + acumulado atual − acumulado do ano anterior = 0 + 182 − 125 = R$ 57 mi) misturava um exercício zerado com acumulados corretos, e o histórico dava "0 de 5 exercícios com lucro" (as fontes públicas dão 2 de 5: +52,5 em 2021 e +214,4 em 2025). Os demais componentes da SEER3 (EBIT, caixa operacional, patrimônio, valor de mercado) bateram com as fontes.

**Decisão.** O lucro de referência dos filtros (lucro de 12 meses positivo e consistência de 5 exercícios) passa a ser o **consolidado (conta 3.11)**, que é obrigatório e coerente com o EBIT, o caixa operacional e o EV, todos consolidados. O lucro dos controladores (3.11.01) fica **só como informação**: aparece na memória de cálculo, no lucro de 12 meses e, em cada exercício, quando difere do consolidado, para quem quiser conferir. Versão 1.0.3 → 1.0.4.

**Limite desta correção, a conferir.** Pressupõe que a conta 3.11 da DFP da SEER3 está preenchida (a conta 3.11 é obrigatória e o EBIT, na mesma demonstração, veio certo). Se na próxima execução o lucro consolidado também vier zerado em algum exercício, a tela mostrará os dois lado a lado e a causa será outra. Efeito colateral aceito: em empresa com minoritários grandes, o lucro de referência inclui a parte deles (coerente com o EV, que também os inclui).

**Também confirmado nesta rodada (D53 em tela).** (1) A MGLU3 saiu pela verificação nova, com o motivo claro: caixa operacional de R$ 16.395 mi, 5,9x o EBITDA de R$ 2.790 mi. (2) O EBITDA dela (R$ 2,79 bi) valida a correção da D51: antes a dívida líquida/EBITDA era 18,2x e na execução seguinte caiu para 1,1x. (3) Os componentes de 12 meses da SEER3 fecham com as fontes públicas: EBIT R$ 490 mi, caixa operacional R$ 443 mi. **Lição do caso:** mostrar na tela de onde vem cada número foi o que achou o defeito, em vez de adivinhá-lo.

**Testes.** Scripts: 237 → 238 (a SEER3 reproduzida: DFP com 3.11.01 = 0 em todos os anos e o lucro consolidado preservado; 3 de 5 em vez de 0 de 5). Mutação (voltar a preferir os controladores no lucro de 12 meses e no histórico) detectada. App: 1.290 (sem teste novo; o existente passou a conferir a informação dos controladores na lista por exercício).

## D55 (04/10/2026): Análise do ranking.csv e do exclusoes.csv inteiros: três defeitos sistêmicos e a lista de pendências do cadastro

**Contexto.** Depois de várias rodadas corrigindo uma empresa por vez a partir de prints, o responsável enviou o `ranking.csv` (68 empresas) e o `exclusoes.csv` (158) da execução da metodologia 1.0.3. Analisados de uma vez, com conferência cruzada contra fontes públicas, revelaram problemas que atingiam dezenas de empresas, não uma. **Lição:** olhar o arquivo inteiro, e não o caso a caso, teria poupado várias rodadas; o `exclusoes.csv` é onde os defeitos de leitura se escondem.

**O que passou na conferência interna (sem ressalva).** A nota do ranking recalculada a partir dos três rendimentos bate exatamente; P/VP = 1/(PL/VM) em todas as linhas; todos os indicadores `passa_*` coerentes com os limites (ROIC, dívida/EBITDA, FCO, cobertura, consistência); volume mínimo no ranking de R$ 3,4 mi (limite 3,0) e volatilidade máxima de 58,5%; FCO/EBIT entre −0,8x e 2,7x (nenhum extremo), o que confirma a correção da D51 e a verificação da D53; CAML3, com ano fiscal que termina em fevereiro (data-base 31/05/2026), foi calculada corretamente.

**Defeito 1: 30 empresas fora por "capital implausível", todas com o MESMO padrão.** P/VP implícito entre 0,0003 e 0,0034 em todas (com ×1000: entre 0,30 e 3,40, ou seja, os 30 ficariam plausíveis): a quantidade de ações vem **em milhares** na CVM. É o caso da Vale (D52), só que sistêmico: Ambev, Assaí, Auren, Axia, Bradespar, CBA, Cemig, Copasa, Cyrela, Dexco, Ecorodovias, Eneva, Fras-le, Grendene, Hidrovias, Kepler, LOG, Renner, Mills, MRV, Iochpe-Maxion, Natura, Irani, Randon, Taesa, Tenda, Tupy, Vibra, Vulcabras e Yduqs. Eram cerca de 30% das empresas elegíveis, e várias delas (as maiores) poderiam estar entre as 15 mais baratas. **Decisão:** detecção **automática** da unidade, com a salvaguarda de exigir **dois sinais independentes** (P/VP abaixo do mínimo e giro diário impossível, ambos corrigidos pelo ×1000) e a plausibilidade depois do ajuste; o manual da D52 continua e vence. Quando a D52 foi escrita eu recusei a correção automática por medo de mascarar erro; a evidência mostrou que o caso é sistêmico e que um segundo sinal (giro) separa o erro de unidade da empresa barata de verdade. Tudo fica na memória de cálculo.

**Defeito 2: units avaliadas como ações PN.** A mensagem de exclusão da Taesa mostrava "PN × R$ 42,85" ao lado de "ON × R$ 14,03": o preço da **unit** (TAEE11, que vale 1 ON + 2 PN) estava sendo usado como preço da classe PN. O mesmo valia para qualquer empresa cujo código de referência é uma unit: ALUP11, ENGI11, IGTI11 e SAPR11, que estavam **no ranking** com P/VP de 1,9, 5,0, 3,0 e 3,25, superestimados (valor de mercado inflado, rendimentos subestimados, posições mais baixas do que deveriam). **Decisão:** unit nunca é classe nem preço de classe; conta só no volume do emissor. Classe sem negociação é avaliada pelo preço da outra classe.

**Defeito 3: o lucro dos controladores zerado (D54) atinge mais de uma empresa.** SEER3 (0 de 5 exercícios), **TIMS3** (0 de 4, com lucro de 12 meses de R$ 1,79 bi, o que prova o erro), **MLAS3** e **VAMO3** (excluídas por "lucro de R$ 0"). Todas se explicam pela mesma causa da D54 e voltam a ser calculadas com o lucro consolidado. **A D54 ainda não havia sido executada nesses arquivos.**

**Três saltos de preço resolvidos com fonte.** SBSP3 (desdobramento 1:5, negociação "ex" a partir de 29/04/2026), SIMH3 (grupamento 2:1, ajustada a partir de 18/02/2026) e ORVR3 (desdobramento 1:4, "ex" a partir de 11/08/2026): as datas coincidem exatamente com os saltos acusados. Confirmados em `config/acoes-baratas.json → desdobramentos` (somados aos de `config/acoes.json`). **A verificar:** o valor de mercado da Orizon (se a quantidade de ações do balanço de 30/06 for anterior ao desdobramento de 11/08, o valor sairia 4x menor; o esperado é algo perto de R$ 9 a 10 bi).

**TFCO4 e LAVV3: P/VP de 20,6 e 15,5, contra ~3,3 e ~1,5 nas fontes.** TFCO4: a CVM traz 877 mi de ações ON (sem negociação, com direito econômico de ~1/10 da PN) e 65 mi PN; a ON era avaliada pelo preço da PN (valor de mercado R$ 12,6 bi contra R$ 2,0 bi nas fontes). Passa a sair com o motivo `classe_sem_preco`. LAVV3: a quantidade de ações lida é exatamente 10x a das fontes (1.954 mi contra 195,4 mi) e **a causa não foi identificada**; fica o alerta de P/VP acima de 10 na tela. As duas ficavam no fim do ranking e não distorciam o Top 15.

**Pendências do cadastro (não são defeito de cálculo).** 19 empresas sem CNPJ mapeado (AESB3, AMAR3, AZUL4, BRIT3, CMIN3, CRFB3, CSNA3, CTNM4, DMMO3, EMBR3, GUAR3, JBSS3, KRSA3, MBLY3, MBRF3, ODPV3, RDNI3, STBP3, ZAMP3) e 11 sem preço recente (CASN3, MWET4, NEOE3, NGRD3, ODER4, PETZ3, RPMG3, SHOW3, SRNA3, TEKA4, TKNO4). Boa parte parece ser mudança de código de negociação, fusão ou saída da bolsa, não falha de leitura; **o `config/acoes.json` precisa ser revisado** para tirar o que não negocia mais ou atualizar o código. O FCA passa a ser lido de dois anos (o recente vale), o que pode resolver os que apenas ainda não entregaram o FCA do ano. O arquivo `mapeamento-ticker-cnpj.csv` mostra, por código, a origem do CNPJ e o motivo.

**Exclusões que parecem corretas e não foram mexidas.** 48 por liquidez (nomes pequenos e ilíquidos), 13 pela volatilidade (ANIM3, ARML3, BHIA3, BRKM5, CVCB3, DASA3, HAPV3, LIGT3, LJQQ3, MOVI3, ONCO3, PCAR3, RAIZ4: perfil coerente), 25 de setores fora de escopo (bancos, seguros, bolsa), CSAN3 e USIM5 por prejuízo; AGRO3 saiu pela verificação do caixa operacional (venda de terras no fluxo operacional) e AMER3 e MGLU3 também.

**Efeito esperado da próxima execução (estimativa, não verificada).** O ranking deve passar de 68 para algo em torno de 95 a 100 empresas, e o Top 15 pode mudar bastante, porque entram nomes grandes que estavam fora por um defeito de leitura.

**Testes.** Scripts: 238 → 250 (12 novos: unit, unidade automática com os casos de borda, classe sem preço, alerta de P/VP, desdobramentos, FCA de dois anos, colunas do CSV). Mutação (9 defesas novas) detectada. App: 1.290 → 1.291.

## D56 (05/10/2026): Segunda rodada completa (95 empresas): o que a D55 resolveu, o que sobrou e a regra do caixa operacional

**Contexto.** Depois de subir a D55, o responsável enviou o `exclusoes.csv`, o `ranking.csv` e o `mapeamento-ticker-cnpj.csv` da execução com a metodologia 1.0.5. Mesma lição da D55: analisados inteiros e conferidos contra fontes públicas, em vez de empresa por empresa.

**O que a D55 resolveu (confirmado nos arquivos).** O ranking passou de 68 para **95 empresas** (a estimativa era de 95 a 100). Não há mais nenhuma exclusão por `capital_implausivel` (eram 30) nem por `salto_de_preco` (eram 3). 24 empresas foram ajustadas automaticamente por quantidade em milhares, mais a Vale (manual). SAPR11 passou de P/VP 3,25 para **0,97** (fontes: 0,83 a 0,96; ações 1,51 bi), validando a correção das units. SEER3 mostra **2 de 5** exercícios com lucro, como nas fontes. MLAS3, VAMO3 e KLBN11 voltaram (lucro consolidado). O FCA de dois anos resolveu 7 CNPJs (de 19 para 12 sem CNPJ; os 7 viraram "sem preço", ou seja, não negociam mais ou quase não negociam). Conferência interna sem ressalva: nota, P/VP, `passa_*` e consistência todos coerentes.

**Defeitos novos achados, e o que mudou.**

1. **Caixa operacional não recorrente: SAPR11 (3º) e MLAS3 (6º).** O FCO de 12 meses da Sanepar é **R$ 6,94 bi para uma receita de ~R$ 7,4 bi** (94%). Está certo: ela reporta R$ 7,06 bi em 2025 contra R$ 2,8 bi em 2024, por um precatório de R$ 4 bi recebido. Mas não é geração recorrente, e distorcia FCO/EV (48%). O MLAS3 chegava a 2,98x o EBITDA, a 0,02 do limite de 3,0x. Na distribuição observada, a mediana de FCO/EBITDA é 0,65x e o p90 é 1,1x; só estes dois e o INTB3 (2,08x, a conferir) passam de 2x. **Decisão:** limite de 3,0x para **2,0x**. Efeito esperado: saem SAPR11, MLAS3 e INTB3 (esta última pode ser uma exclusão indevida; fica a avaliar). É escolha a partir da distribuição observada, não regra de mercado.

2. **ORVR3: valor de mercado de R$ 2,7 bi contra ~R$ 10 bi.** O balanço de 30/06 traz a quantidade de ações **anterior** ao desdobramento 1:4 de 11/08, e o preço de hoje é o posterior. **Decisão:** desdobramento ou grupamento confirmado na config, posterior à data-base do balanço e até a data de corte, multiplica a quantidade de ações (ORVR3: 137.324 mil ×4 ×1000 = 549,3 mi, exatamente o capital divulgado após o desdobramento). Premissa: a quantidade do formulário é a da data-base (a evidência é a própria ORVR3). Marca `capitalJaAjustado: true` desliga o ajuste de um evento.

3. **TEND3 (10ª): valor de mercado de R$ 1,68 bi contra ~R$ 3,4 bi.** A quantidade de ações na CVM é 57,4 mi; o real é 122,6 mi (várias fontes). Rende P/VP de 1,09 contra ~2,2, EBIT/EV de 42% e giro diário de 9% (o maior do ranking). **Causa não identificada.** O que mudou: (a) alerta quando o giro diário passa de 5% do valor de mercado; (b) a tela mostra as ações usadas e o balanço de onde vieram. A TEND3 também tem só 3 exercícios lidos (de 5).

4. **Exercícios lidos a menos: TEND3 (3), SBSP3 (3), TIMS3 (4), PGMN3 (4), TTEN3 (4).** Para a TIMS3, que é lucrativa há anos, "2 de 4 com lucro" também está errado. **Causa não identificada.** A tela passou a listar os exercícios que **não puderam ser lidos**, com o motivo (sem conta de lucro, sem conta de caixa operacional, duração inválida) e a lacuna na série de DFP.

5. **AXIA3 e SHUL4 fora por "classe sem preço".** O limite de 10% era rígido demais para classes com direitos parecidos. **Decisão:** 50% (TFCO4, 93%, segue fora). Entre 10% e 50% a aproximação pelo preço da outra classe erra pouco por cento; fica marcada `preco_da_outra_classe`.

6. **CNPJ.** As 15 sem CNPJ são todas "não encontrado no FCA" (nenhuma ambígua): 3 são financeiras (BPAC11, DAYC4, APER3, sem efeito) e 12 não. **EMBR3 mudou para EMBJ3 em 03/11/2025** (cadastro desatualizado). CSNA3 e CMIN3 não aparecem no FCA de 2025 nem no de 2026 por motivo não identificado; entraram em `config/acoes-baratas-cnpj.json` com CNPJ verificado (CSN 33.042.730/0001-04 e CSN Mineração 08.902.291/0001-15, em mais de uma fonte, a segunda em documento da própria companhia na CVM), com a fonte registrada.

**Exclusões revisadas e que parecem corretas.** Prejuízo em 12 meses (AURE3, CSAN3, HBSA3, LWSA3, MRVE3, NATU3, RAPT4, SIMH3, TUPY3, USIM5); volatilidade acima de 60,3% (14); `sem_preco` (18: Azul, Odontoprev, Petz, Serena, Zamp, RNI... parecem saídas da bolsa ou iliquidez extrema); setores fora do escopo (25); `fco_incoerente` (AGRO3, AMER3). O LWSA3 saiu por prejuízo de R$ 200 mi: antes aparecia lucrativo (R$ 25 mi) pelo defeito do lucro dos controladores.

**Pendências, para o responsável.** (a) `config/acoes.json`: EMBR3 → EMBJ3 (e rodar a carga inicial de Ações para o histórico); revisar os 18 `sem_preco` e os 9 `sem_cnpj` restantes que não negociam mais (AESB3, AMAR3, BRIT3, CRFB3, DMMO3, KRSA3, MBLY3, MBRF3, STBP3). MBRF3 (fusão BRF + Marfrig) tem mudança de perímetro: o LTM misturaria perímetros e deve continuar fora. (b) Prints da Memória de cálculo da **TEND3** e da **TIMS3** depois desta atualização, para fechar os pontos 3 e 4. (c) LAVV3 (ações lidas 10x acima das fontes, P/VP 17,4): causa não identificada, só alerta.

**Testes.** Scripts: 250 → 256; app: 1.291 → 1.293. Mutação (7 defesas novas) detectada.

## D57 (06/10/2026): Primeira rodada com a CVM real dentro do ambiente de desenvolvimento: TEND3, LAVV3 e os exercícios antigos têm causa e correção

**Contexto.** Pela primeira vez o cálculo rodou aqui com os arquivos reais da CVM (DFP 2021 a 2026, ITR 2025 e 2026, FCA 2025 e 2026) e os preços da B3, sem depender de o responsável subir arquivos e devolver CSVs. Os três CSVs (`ranking.csv`, 96 empresas; `exclusoes.csv`, 130; `mapeamento-ticker-cnpj.csv`, 226) foram lidos inteiros, e cada empresa suspeita foi aberta nos insumos congelados (`insumos.json.gz`). Esta decisão parte da D56 (metodologia 1.0.6); o pacote D57 anterior, que tentava resolver os exercícios antigos com duas hipóteses, nunca foi subido e é substituído por esta, que acha a causa comprovada de cada caso.

**1. TEND3: causa achada (unidades misturadas no mesmo documento).** No ITR de 30/06/2026 (versão 2) a CVM traz capital integralizado de **122.578** (em milhares, 122,6 mi de ações) e tesouraria de **65.148** (em unidades: 65 mil ações; nos documentos anteriores a tesouraria era 0 ou 1.396 mil). O cálculo subtraía 65.148 de 122.578 (= 57.430) e o ajuste automático ×1000 multiplicava tudo, inclusive a tesouraria, chegando a 57,4 mi. **Correção** (`sanearCapital`): tesouraria acima de 30% das ações da classe que, dividida por 1.000, fica abaixo de 10%, com tesouraria menor que 10% no documento anterior, é tratada como informada em unidades. Resultado: 122,51 mi de ações (o real é 122,6 mi, a diferença é a tesouraria de 65 mil), P/VP de **2,33** (contra 1,09 errado; fontes ~2,2), e a TEND3 sai do Top 15 (de 7ª para 34ª).

**2. LAVV3: causa achada (erro de digitação do emissor em um único documento).** O ITR de 30/06/2026 traz **1.954.343.520** ações; todos os documentos anteriores (ITR de 2025, ITR de 31/03/2026) trazem **195.434.352**. Não há desdobramento (nada na config, preço sem salto): é exatamente 10x. **Correção** (`sanearCapital`): quantidade que muda por 10, 100 ou 1.000 (tolerância de 1%) contra um documento anterior, com os dois documentos anteriores concordando entre si, sem desdobramento ou grupamento depois do documento anterior e sem salto de preço sem explicação, é dividida pelo fator. Resultado: 195,43 mi, P/VP de **1,74** (contra 17,4; fontes ~1,5). Limite do método: um erro presente em **todos** os documentos da empresa não é detectável com dados da CVM.

**3. Exercícios antigos não lidos (TIMS3, PGMN3, TTEN3 em 2021; SBSP3 em 2021 e 2022): causa achada.** A DFP dessas empresas só traz a demonstração **individual** (não têm controladas); o código procurava só a consolidada e descartava o exercício como "DFP sem a conta de lucro". **Correção:** DFP sem nenhuma linha da consolidação escolhida vale pela individual, com observação no exercício. Se a DFP tem a consolidada, ela nunca é trocada.

**4. TIMS3: segundo defeito, não visto antes (lucro 0 e FCO 0 em 2024 e 2025).** Na DFP de 2024 e na de 2025 a coluna ÚLTIMO **consolidada** vem toda zerada (balanço inclusive: ativo total 0), enquanto a PENÚLTIMO e a individual estão preenchidas. Isso reduzia a TIMS3 a "2 de 4 com lucro" (ela é lucrativa há anos). **Correção:** lucro e caixa operacional exatamente zero **ao mesmo tempo** na consolidada, com a individual preenchida, vale pela individual. Zero isolado continua sendo resultado. Resultado: **5 de 5 exercícios** com lucro e FCO, a TIMS3 passa na consistência. **A verificar:** o lucro de 12 meses da TIMS3 (R$ 1,79 bi) vem do ITR e está coerente; mas se a mesma consolidada zerada aparecer em outra empresa no ITR ou na DFP mais recente (não nos exercícios antigos), o cálculo de 12 meses seria afetado; hoje nenhuma empresa do ranking tem lucro e FCO de 12 meses ambos zero.

**5. TEND3: terceiro defeito (lacuna na série).** A CVM lista para a TEND3 uma "DFP" com data-base **31/03/2023**, entre as de 31/12/2022 e 31/12/2023 (recebida em 03/05/2023). Ela quebrava a cadeia de exercícios (lacuna de 275 dias) e a TEND3 ficava com 3 de 5. **Correção:** só valem DFP com o mesmo mês e dia de fim de exercício da mais recente; a outra é ignorada e aparece em "exercícios não lidos". A TEND3 tem agora 5 exercícios, com lucro positivo em 2 e caixa operacional positivo em 3 (2023 foi prejuízo de R$ 102 mi), então **não passa** na consistência (exige 4 de 5 em cada): a informação aparece na tela. Isso é filtro de qualidade, não exclusão do ranking.

**6. Efeito no Top 15.** Antes: QUAL3, CEAB3, LREN3, BRAV3, RECV3, MDIA3, **TEND3**, COGN3, JHSF3, MYPK3, SEER3, AZZA3, PETR4, GGBR4, YDUQ3. Depois: QUAL3, CEAB3, LREN3, BRAV3, RECV3, JHSF3, MDIA3, COGN3, MYPK3, SEER3, AZZA3, PETR4, GGBR4, YDUQ3, **POMO4** (a TEND3 sai; a POMO4, 16ª, entra). As notas mudam um pouco porque os ranks percentuais dependem de todas as empresas (a TIMS3, a LAVV3 e a TEND3 mudaram de posição). O ranking continua com 96 empresas e 130 fora.

**7. O que olhei e NÃO mexi.** (a) As 130 exclusões estão coerentes: 46 liquidez, 25 setor fora do escopo, 18 sem preço (AZUL4, PETZ3, SRNA3, ZAMP3, RDNI3, ODPV3 etc.: último negócio entre 12/2025 e 09/2026, saída da bolsa ou iliquidez; JBSS3, CASN3, CTNM4, ODER4 e TEKA4 sem série na B3), 14 volatilidade, 10 prejuízo, 10 sem CNPJ, 5 `fco_incoerente` (AGRO3, AMER3, MLAS3, SAPR11, TUPY3), 1 classe sem preço (TFCO4), 1 duplicidade (GOAU4). (b) **Cadastro, 10 sem CNPJ:** só a Embraer tem solução simples, **EMBR3 → EMBJ3** (CNPJ 07.689.002/0001-89, confirmado no FCA 2026 da CVM, Novo Mercado desde 2006). Não alterei `config/acoes.json` porque a D56 reservou a troca ao responsável e ela deve ser seguida da carga inicial de Ações (histórico de preços do novo código). BRFS3 aparece no FCA com negociação encerrada em 22/09/2025 e MBRF3 não aparece (fusão BRF + Marfrig): segue fora de propósito. AESB3, AMAR3, BRIT3, CRFB3, DMMO3, KRSA3, MBLY3, STBP3 não existem no FCA 2025 nem 2026 (provável saída da bolsa por OPA ou fusão); BPAC11, DAYC4 e APER3 são financeiras e não mudam nada. (c) O único alerta de P/VP alto que sobra é a WEGE3 (11,4, com 4.196 mi de ações, última do ranking, 96ª): não investiguei; fica só o alerta.

**8. Ajuste de ambiente.** Nove testes dos scripts falhavam no Windows porque o leitor de zip chamava o programa `unzip`. Agora usa o `tar` do Windows (que lê zip) quando não há `unzip`; no GitHub (Ubuntu) o caminho de código é o mesmo de antes (`unzip`). **Não comparei uma execução Windows com uma Linux**; a primeira execução no GitHub depois desta decisão confirma.

**Não alterado, por decisão do responsável:** `publicacao.aprovadoPeloResponsavel` (continua `true`), o código de acesso do Top 15 (não foi gerado, divulgado nem gravado) e os textos públicos.

**Testes.** Scripts: 256 → 261 (5 novos: tesouraria em unidades com os casos de borda, quantidade ×10 com os casos de borda, DFP só individual, consolidada zerada, DFP fora do fim do exercício); app: 1.293 (inalterado). Verificação independente da execução (`npm run verificar-acoes-baratas`): OK. `tsc -b`: sem erros.

## D58 (06/10/2026): Política de Privacidade do Top 15, limite de chamadas da API do motor de perfil e Embraer como EMBJ3

**Política de Privacidade (`privacidade/index.html`).** Nova seção 5A: o código do Top 15 é conferido no servidor e **não é guardado** (só fica no aparelho da pessoa, em localStorage); as tentativas são contadas por **hash do IP, por no máximo 15 minutos**; há uma contagem mensal agregada de acessos aceitos, recusados e bloqueados. Data de atualização: 06/10/2026. Seções 6 (Upstash) e 8 (prazo) ajustadas. Isso fecha o item "atualizar a Política de Privacidade" da lista de antes da divulgação. Revisão final do texto continua sendo do responsável.

**Limite de chamadas da `/api/recomendacao` (decidido, era a pendência da seção 2 de `docs/06`).** 60 chamadas por IP a cada 15 minutos; acima disso, resposta 429 com mensagem para a pessoa e `Retry-After`. Só hash do IP (com `TOP15_SAL`, se existir) e por 15 minutos, no mesmo Redis das métricas; sem Redis, contagem em memória por instância. **Falha aberta**: erro na contagem nunca bloqueia. O número é folgado de propósito (uso normal é 1 a poucas chamadas, mas redes de celular compartilham IP). Não impede uma extração lenta e distribuída; só a torna cara. Uma mudança de IP resolve para quem estiver bloqueado, e o limite se renova sozinho em 15 minutos. **A observar:** se aparecer reclamação de bloqueio indevido, subir `MAX_CHAMADAS` em `api/_limite.ts`. O Redis precisa aceitar `EXPIRE ... NX` (Redis 7 ou superior; Upstash aceita); se não aceitar, a contagem em memória segue valendo.

**Embraer: EMBR3 → EMBJ3** em `config/acoes.json` (pendência da D56). A Embraer muda de código desde 03/11/2025 (CNPJ 07.689.002/0001-89, confirmado no FCA da CVM). **EMBJ3 só tem 21 pregões no histórico** e por isso sai do Top 15 por `historico_insuficiente` (precisa de 126) até rodar a **carga inicial de Ações** (Actions → "Carga inicial de Ações"), que busca o histórico do código novo. Depois dela e de uma nova execução do Top 15, a Embraer passa a ser avaliada.

**Testes.** Scripts: 261 → 265 (4 novos, `scripts/recomendacao-limite.test.mjs`: chave só com hash, 60 passam e a 61ª trava com janela que não renova, falha aberta, comandos do Redis e reserva em memória); app: 1.293. `tsc -b` sem erros. O handler `api/recomendacao.ts` em si não tem teste automatizado (importa o motor de perfil, que o carregador de testes dos scripts não lê); a lógica do limite, sim.

## D59 (06/10/2026): Triagem "FIIs baratos" (Tijolo e Papel) como job com trilha de auditoria, sem publicação no app

**O que foi pedido e o que foi feito.** Um Top 15 de FIIs baratos "usando indicadores próprios de FII". Depois de um protótipo com o Informe Mensal real da CVM (competência 2026-08), a triagem virou um job nos mesmos moldes do das ações (D49): extração → insumos congelados → cálculo puro → manifesto com hashes → verificação independente → workflow. Metodologia completa em `docs/10-metodologia-fii-baratos.md`; parâmetros em `config/fii-baratos.json` (v1.0.0).

**Decisões de método.**
1. **Classificar pelo que o fundo tem** (composição do ativo do informe), não pelo setor declarado: Tijolo, Papel, Fundo de fundos ou Misto, com limite de 60% do total investido. Ex.: MXRF11 está como "Logística" no cadastro e é papel (~70% em recebíveis). Fundo de fundos e misto ficam fora dos rankings.
2. **Dois rankings separados**, cada um pela média dos ranks de P/VP baixo e DY de 12 meses alto, com filtros próprios: o **papel** tem liquidez (R$ 300 mil/dia) e patrimônio (R$ 150 mi) mais folgados que o tijolo (R$ 500 mil e R$ 200 mi), porque quase todo fundo de papel é menor (com os valores do tijolo sobravam 13 fundos), e é mais rígido em P/VP (≥ 0,7) e queda patrimonial (≥ −5%), porque desconto grande em fundo de crédito costuma ser perda precificada.
3. **Lista "a conferir":** P/VP < 0,55 ou DY de 12 meses > 18% tiram o fundo do ranking até alguém conferir o dado numa fonte pública (MFII11, TGAR11, BBIG11, BRCR11, TRBL11 e OUJP11 na primeira execução). Saem **antes** de calcular os ranks, para não distorcer a nota dos demais.
4. **Rentabilidade patrimonial de 12 meses** (variação do valor patrimonial sem as distribuições) como indicador indireto de perda de valor, já que vacância e inadimplência não estão no informe mensal.

**Primeira execução (competência 2026-08, cotações de 25/09/2026).** 219 fundos no universo, 210 com dado, **32 de tijolo e 15 de papel** no ranking, 6 a conferir, 166 fora (liquidez 95, fundo de fundos 27, misto 19, dados insuficientes 8, poucos cotistas 6, P/VP suspeito no papel 5, DY implausível no papel 3, patrimônio em queda 2, sem CNPJ 1). Top 15 tijolo: KORE11, TOPP11, HGRE11, CXAG11, RZAT11, BPML11, GTWR11, JSRE11, HSLG11, RBVA11, NEWL11, RZTR11, RBRP11, BBPO11, RCRB11. Top 15 papel: RECR11, CVBI11, VRTA11, CYCR11, KCRE11, JSCR11, PORD11, XPCI11, MANA11, KNHY11, KNIP11, HGCR11, MXRF11, KNSC11, KNCR11. **O fundo do 15º lugar do tijolo tem nota 0,58 contra 0,94 do primeiro, e no papel os quatro últimos têm notas quase iguais (0,14 a 0,18): a ordem na cauda é frágil.** Verificação independente da execução: OK.

**NÃO é publicado.** `publicacao.aprovadoPeloResponsavel = false` e o job **não escreve nada no app** (sem tela, sem código de acesso, sem arquivo lido pelo site); só `auditoria/fii-baratos/<data>/`. Para publicar faltam duas decisões do responsável: (a) **enquadramento regulatório** (a D22 aceitou o risco para o Top 15 de ações; ranking de FII pede a mesma decisão e, antes de divulgar em escala, o parecer independente); (b) **preço diário** (a cotação vem do job mensal de FIIs, e o P/VP herda a defasagem). O job barra fundos com cotação mais velha que 45 dias.

**Workflow.** `.github/workflows/atualizar-fii-baratos.yml`: dia 21 de cada mês (um dia depois do job de rendimentos de FIIs, que roda no dia 20) e sob demanda; roda os testes, calcula, guarda a auditoria como artefato, **verifica** (refaz o cálculo só com os insumos gravados) e só então faz o commit da pasta `auditoria/fii-baratos`. Falhou qualquer etapa: erro, e-mail do GitHub, nada é commitado. Trava de sanidade: menos de 15 (tijolo) ou 10 (papel) no ranking, ou mais de 15% dos fundos sem dado, derruba o job depois de gravar a auditoria.

**Limitações que continuam abertas** (detalhe na seção 10 de `docs/10`): faltam vacância e inadimplência (informes trimestral e anual da CVM); o rendimento por cota é estimado a partir do DY; valor patrimonial é contábil; cota e valor patrimonial em bases diferentes só aparecem como alerta; os limiares são escolhas a partir de uma única competência. **A conferir pelo responsável:** MFII11, TGAR11 e os demais da lista "a conferir"; dois ou três fundos do topo de cada grupo contra uma fonte pública (cotação, P/VP, rendimento do mês).

**Testes.** Scripts: 272 → 279 (um arquivo novo, `scripts/fii-baratos.test.mjs`, com 14 testes, e a remoção dos 7 do protótipo): classificação, competência de referência, ranks, filtros, "a conferir", fundo fabricado com números calculados à mão, escala do DY em %, extração (versões, migração de CNPJ, campos zerados), determinismo, trava de sanidade e o ciclo gravar → verificar → detectar adulteração. **Mutação:** 8 defeitos introduzidos de propósito no cálculo (rank do DY invertido, alertas que não separam, anualização errada, filtro de P/VP do papel removido, cotação defasada ignorada, limite de 60% trocado, competência sem cobertura, DY em % sem dividir); o teste da anualização não pegava e foi reforçado (caso com 10 meses), e os 8 passaram a ser detectados.

**Mudança colateral.** `scripts/acoes-baratas-cvm.mjs` ganhou a função exportada `lerEntradaDoZip` (mesmo `unzip`, com `tar` quando não há `unzip`), reaproveitada pelo job de FIIs; o job de ações não muda de comportamento.

## D60 (07/10/2026): FIIs baratos, conferência dos 6 fundos suspeitos e duas melhorias: alertas de rendimento e conferência manual registrada

**Conferência feita** (Investidor10, 07/10/2026) dos 6 fundos da lista "a conferir" da D59. **Nenhum tinha cota e valor patrimonial em bases diferentes**: valor patrimonial por cota, patrimônio líquido e rendimento de 12 meses bateram com a CVM em MFII11, TGAR11, BRCR11, TRBL11 e OUJP11 (o rendimento de 12 meses de MFII11, R$ 10,77, e de TGAR11, R$ 9,73, bateu ao centavo com a estimativa DY × valor patrimonial). Exceção: **BBIG11**, com valor patrimonial por cota de R$ 9,74 no informe contra R$ 10,72 no site (o patrimônio líquido bate; o informe divide por 99,12 mi de cotas emitidas e o site por 90,12 mi, a diferença provável de cotas em tesouraria depois de recompra, o que o informe mensal não traz e não foi confirmado). **Decisão do responsável: manter o valor patrimonial por cota do informe da CVM** (fonte oficial, reproduzível e auditável); a limitação ficou registrada em `docs/10`, seção 10, item 13: em fundo com recompra de cotas o P/VP do ranking fica acima do que o cotista detém. O problema real foi outro: o **DY de 12 meses estava inflado** em MFII11 (rendimento de R$ 0,91 para R$ 0,30 por mês), BBIG11 (R$ 0,07 para R$ 0,03) e TRBL11 (pagamento extra de R$ 2,68 em julho e depois R$ 0,44).

**Duas melhorias (metodologia 1.1.0).**
1. **Alertas de rendimento.** `rendimento_em_queda`: mediana dos 3 últimos meses abaixo de 75% da mediana dos 12 meses. `rendimento_com_pico`: média dos 12 meses acima de 125% da mediana. Os dois mandam o fundo para "a conferir". **Calibragem com dado real:** a primeira versão usava a média dos 2 últimos meses e foi descartada, porque marcava por engano GTWR11 e BRCO11 (pagam todo mês, mas o informe da CVM tem um mês com DY zero) e deixava passar HGRE11. Com mediana, a queda pega só MFII11 (0,29), BBIG11 (0,43) e TRBL11 (0,68), e o pico pega **HGRE11** (R$ 8,52 num mês do informe; DY de 12 meses de 16,6% contra ~9,4% no site, que mostra R$ 0,85 por mês com extra de R$ 1,50 em janeiro e julho) e **KORE11** (que cortou o rendimento de R$ 1,25 para R$ 0,60 em janeiro: DY de 14,7% contra ~10,8% atual). Os dois estavam no Top 15 do Tijolo, KORE11 em 1º.
2. **Conferência manual registrada** (`config/fii-baratos.json → conferencia`): fundo conferido, com data, fonte, nota e **os alertas que a conferência libera**. Entra no ranking marcado como conferido. Vale **90 dias**; alerta novo ou conferência vencida (ou datada do futuro) devolve o fundo para "a conferir". Liberados hoje: **BRCR11** (`pvp_muito_baixo`: dados batem, rendimento fixo de R$ 0,41 por mês, vacância de 10,4%) e **OUJP11** (`dy_alto`: dados batem, rendimento alto recorrente; **é fundo de papel de alto retorno e o risco de crédito não foi avaliado**). A conferência cobre a base dos dados, não a qualidade do fundo.

**Resultado com os mesmos dados da D59** (competência 2026-08, cotações de 25/09): tijolo 31, papel 16, a conferir 6 (BBIG11, HGRE11, KORE11, MFII11, TGAR11, TRBL11). Top 15 tijolo: TOPP11, BRCR11, CXAG11, GTWR11, RZAT11, RBVA11, BPML11, NEWL11, HSLG11, RZTR11, JSRE11, BBPO11, FATN11, RBRP11, RCRB11. Top 15 papel: OUJP11, RECR11, CVBI11, VRTA11, CYCR11, JSCR11, KCRE11, PORD11, XPCI11, MANA11, KNHY11, MXRF11, KNIP11, HGCR11, KNSC11. Verificação independente: OK.

**TGAR11 continua em "a conferir" por decisão pendente do responsável:** os dados batem e o rendimento é estável (R$ 0,70 a 0,72 por mês), mas é fundo de desenvolvimento (receita menos previsível), cota −34% em 12 meses. Se o responsável decidir aceitá-lo, basta registrá-lo em `conferencia` liberando `pvp_muito_baixo` e `dy_alto`.

**Preço defasado, agora com número.** Entre 25/09 e 07/10 a cota subiu 11% em TGAR11, 12% em BBIG11 e 8% em BRCR11, e, segundo o responsável, os FIIs subiram bastante no dia anterior (não verificado aqui). O P/VP do job herda a cotação do job mensal de FIIs; **antes de olhar o ranking, rode "Atualizar rendimentos de FIIs" para renovar as cotações.** Com cotações de hoje, BRCR11 e BBIG11 ficam com P/VP de 0,55, no limite do alerta de P/VP. O preço diário continua sendo condição para publicar.

**Testes.** Scripts: 279 → 282 (`fii-baratos.test.mjs` de 14 para 17 testes: alertas de rendimento com mês zerado isolado, pico e janela incompleta; conferência manual com liberação parcial, validade de 90 dias, alerta novo, vencida e do futuro; coerência da configuração). **Mutação:** 7 defeitos novos introduzidos no cálculo (mediana trocada por média, pico sem alerta, limites trocados, janela de 12 meses, conferência sem validade ou que libera tudo ou aceita data futura) e os 7 foram detectados; a primeira versão do alerta (média de 2 meses) foi trocada depois de mostrar falso positivo em dado real.

## D61 (07/10/2026): FIIs baratos, segunda execução com cotações novas e liquidez pela mediana (metodologia 1.2.0)

**Segunda execução no GitHub** (cotações de 07/10/2026, competência 2026-08): 218 fundos no universo, tijolo 29, papel 19, 6 a conferir (BBIG11, HGRE11, KORE11, MFII11, TGAR11, TRBL11; com as cotações novas BBIG11 saiu do alerta de P/VP). A verificação independente e o commit da auditoria passaram. Top 15 tijolo: TOPP11, BRCR11, GTWR11, RBVA11, BPML11, BROF11, BBPO11, RZTR11, HSLG11, FATN11, RCRB11, RBRP11, MALL11, JSRE11, PVBI11. Top 15 papel: OUJP11, HABT11, SAPI11, CVBI11, RECR11, CYCR11, VRTA11, JSCR11, WHGR11, MANA11, XPCI11, PORD11, KCRE11, KNHY11, KNCR11.

**Conferência dos entrantes novos** (Investidor10): HABT11 (papel, 2º: P/VP 0,72, logo acima do corte de 0,7; DY 17%; rendimento estável de R$ 0,92 a 0,97 por mês), SAPI11 (papel, 3º: P/VP 0,84, DY 16,9%, extra de R$ 0,207 em janeiro) e BROF11 (tijolo, 6º: P/VP 0,58, DY 10,5%, rendimento estável, vacância de 9,4%). Dados de base consistentes e nenhum alerta de rendimento. **O que apareceu foi a liquidez:** SAPI11 negocia R$ 181 mil por dia e BROF11, R$ 354 mil no site, abaixo dos mínimos do ranking (R$ 300 mil no papel e R$ 500 mil no tijolo), e mesmo assim passaram.

**Causa.** O job de FIIs (`atualizar-rendimentos-fii.mjs`) guarda só a **média** do volume financeiro diário dos últimos 21 pregões (histórico da brapi, volume × fechamento, dias sem negócio contam zero). Uma média é puxada por poucos dias de negociação intensa (aqui, o rali do dia anterior) e deixa passar fundo que quase não negocia no dia típico.

**Mudança.** (1) O job de FIIs passa a gravar também `volumeMediano` (mediana dos mesmos 21 pregões, arredondada a milhares), sem tirar nem mudar `volumeMedio`, que o Simule FII usa; é um campo a mais no `rendimentosFii.json` e o app não o lê. Nenhuma requisição nova à brapi: a mediana sai do mesmo histórico. (2) O ranking de FIIs baratos usa a mediana no filtro de liquidez quando ela existe e **a média quando o job de FIIs ainda não a trouxe**, e registra a fonte de cada fundo (`liquidez_pela` nos CSVs, `liquidez` na memória de cálculo, `liquidezPorMediana` e `liquidezPorMedia` no resultado e no log). Os mínimos continuam R$ 500 mil e R$ 300 mil, agora sobre o dia típico. **Isso deve tirar fundos do ranking** (os números exatos só se conhecem depois da execução com a mediana); os mínimos vieram de uma distribuição de médias e precisam ser revistos com os números reais.

**Ordem de execução depois de subir os arquivos:** primeiro "Atualizar rendimentos de FIIs" (para gravar a mediana e renovar as cotações), depois "Atualizar FIIs Baratos". Se o segundo rodar antes, o log mostra "mediana em 0 fundos" e o resultado é o mesmo de antes.

**Testes.** Scripts: 282 → 286 (`atualizar-rendimentos-fii.test.mjs`: 3 testes novos da mediana; `fii-baratos.test.mjs`: 1 teste de liquidez pela mediana e verificações novas na extração). **Mutação:** 7 defeitos introduzidos (liquidez que ignora a mediana, sem o recurso da média, fonte sempre "mediana", mediana de quantidade par e ímpar errada, extração que não copia a mediana) e os 7 foram detectados; dois sobreviveram à primeira versão dos testes (mediana ímpar e cópia na extração) e foram reforçados.

## D62 (07/10/2026): FIIs baratos, terceira execução com a mediana e mínimo de liquidez único de R$ 300 mil (metodologia 1.3.0)

**Terceira execução** (cotações e volumes de 07/10/2026): a mediana foi usada em **208 fundos** (a média em 1: BTSG11, sem histórico de volume). Universo 218, tijolo 27, papel 16, 5 a conferir (BBIG11, HGRE11, KORE11, MFII11, TGAR11), 170 fora. Top 15 tijolo: TOPP11, BRCR11, GTWR11, BPML11, RBVA11, BBPO11, RZTR11, HSLG11, FATN11, RBRP11, JSRE11, MALL11, PVBI11, LVBI11, HSML11. Top 15 papel: HABT11, RECR11, CVBI11, CYCR11, VRTA11, WHGR11, MANA11, PORD11, XPCI11, KCRE11, KNHY11, KNCR11, KNIP11, HGCR11, MXRF11. SAPI11 (mediana de R$ 231 mil) e BROF11 (R$ 334 mil) saíram, como previsto na D61; OUJP11, JSCR11, CXAG11, RCRB11 e TRBL11 também saíram por liquidez.

**Calibragem com os números reais** (`exclusoes.csv` da execução): 106 fundos saíram por liquidez, 84 de tijolo (mediana típica de R$ 19 mil por dia) e 22 de papel (R$ 139 mil). A mediana é coerente com o Investidor10 (SAPI11 R$ 231 mil × R$ 181 mil no site, BROF11 R$ 334 mil × R$ 354 mil, OUJP11 R$ 285 mil × R$ 340 mil). Só **4 fundos de tijolo** ficavam numa faixa discutível, entre R$ 300 mil e R$ 500 mil (TRBL11 R$ 471 mil, RCRB11 R$ 466 mil, RZAT11 R$ 429 mil, BROF11 R$ 334 mil), e **2 de papel** a menos de R$ 15 mil do corte de R$ 300 mil (OUJP11 R$ 285 mil, GAME11 R$ 286 mil). O TRBL11, que tinha sumido de "a conferir", saiu por R$ 29 mil de diferença.

**Decisão do responsável:** mínimo de **R$ 300 mil por dia (mediana) nos dois grupos**. O do tijolo cai de R$ 500 mil para R$ 300 mil; o do papel não muda. A diferença entre os dois mínimos só existia para fechar 15 fundos no papel quando o corte se aplicava à média. **Efeito esperado:** TRBL11, RCRB11, RZAT11 e BROF11 voltam a passar pelos demais filtros e alertas (TRBL11 volta para "a conferir"); OUJP11 e GAME11 continuam fora, por R$ 15 mil e R$ 14 mil. Os números exatos aparecem na próxima execução.

**Outros achados do arquivo, sem mudança.** (a) `dy_implausivel` em ICRI11 (220%), RPRI11 (289%) e VCJR11 (249%): provável erro do informe, não rendimento real; (b) P/VP de 0,13 a 0,18 em HCTR11 e DEVA11 (papel em dificuldade, já excluído pelo filtro de P/VP de 0,7); (c) TEPP11 (patrimônio −90%) e VISC11 (−33%) saíram por queda patrimonial, como esperado.

**Testes.** Scripts: 286, sem mudança de número (os testes de liquidez foram reescritos para o mínimo único: exatamente R$ 300 mil passa, R$ 299 mil sai, nos dois grupos). `tsc -b` sem erros.

## D63 (07/10/2026): FIIs baratos, preço diário da B3, TGAR11 aceito, OUJP11 fora e proposta de enquadramento (metodologia 1.4.0)

**Quarta execução** (cotações e volumes de 07/10/2026, com a mediana e o mínimo único de R$ 300 mil da D62): tijolo 30, papel 16, a conferir 6. O resultado bateu com a previsão da D62: BROF11, RZAT11 e RCRB11 voltaram ao Top 15 do tijolo, TRBL11 voltou a "a conferir", o Top 15 do papel não mudou. Conferidos no Investidor10: **RCRB11** (P/VP 0,72, DY 9,6%, rendimento subindo de R$ 0,95 para R$ 1,30, patrimônio de R$ 704 mi, sem observação) e **RZAT11** (P/VP 0,88, DY 15,7%, **rendimento irregular**: R$ 0,85 a R$ 1,70 por mês e caindo para R$ 1,00 em setembro, com DY atual ~13%; hoje não dispara `rendimento_em_queda`, com razão de 0,85 contra o limite de 0,75, mas deve ser observado quando o informe de setembro entrar).

**Decisões do responsável.** (1) **TGAR11 aceito** no ranking: registrado em `conferencia` (libera `pvp_muito_baixo` e `dy_alto`; dados batem com a CVM, rendimento estável de R$ 0,70 a 0,72 por mês, **fundo de desenvolvimento**, cota −34% em 12 meses). (2) **OUJP11 fica fora**: a conferência dele continua registrada, mas a mediana de volume (R$ 285 mil) está abaixo do mínimo de R$ 300 mil, e o mínimo não foi alterado. (3) Seguir para **o preço diário e o enquadramento** como condições para publicar.

**Preço diário da B3.** Novo job "Atualizar preço diário dos FIIs" (`scripts/atualizar-fiis-historico.mjs`, workflow `atualizar-fiis-preco.yml`, segunda a sexta às 22h15 de Brasília) e workflow "Carga inicial de FIIs (preço diário)" (padrão 60 pregões). Fonte: **Boletim de Preços oficial da B3** (BVBG.086), o mesmo módulo e o mesmo formato dos jobs de ações, BDRs e ETFs, **sem chave e sem cota**. Grava só `historico/fiis.json` (80 pregões, um fundo por linha) e não toca no app. O universo é o dos fundos do job mensal de FIIs. A triagem passa a usar, por fundo: a **cotação do último pregão com negócio** (no máximo 7 dias de idade) e a **média e a mediana do volume financeiro** dos 21 últimos pregões (dia sem negócio conta zero). Fundo fora do histórico ou sem negócio na janela cai no preço mensal da brapi (reserva), e a fonte de cada fundo fica registrada (`fonte_cotacao`, `fonteCotacao`). Novo parâmetro `precoDiarioObrigatorio` (hoje `false`): quando `true`, quem não tem preço diário sai (`sem_preco_diario`); deve ligar junto com a aprovação para publicar. **Novo alerta `salto_de_preco`:** variação de fechamento acima de 25% de um dia para o outro nos 21 pregões (desdobramento, grupamento) manda o fundo para a conferência, porque a cota sem ajuste deixa o P/VP sem sentido.

**Teste de realidade antes de subir.** O boletim da B3 de 06/10/2026 foi baixado e lido com o módulo real: **192 dos 219 fundos** do universo aparecem (176 com negócio no dia; os demais não negociaram naquele dia), e os preços batem com o Investidor10 (BRCR11 R$ 44,14 × R$ 44,12; TGAR11 R$ 48,49 × R$ 48,50; BBIG11 R$ 5,85 × R$ 5,86). O volume de um único dia confirma o problema da média: SAPI11 negociou R$ 724 mil naquele dia e tem mediana de R$ 231 mil. **Não foi possível rodar o job de ponta a ponta no ambiente de desenvolvimento** (o módulo do boletim usa o `unzip` do Linux, que não existe no Windows), então a primeira execução real é a do GitHub; as partes puras têm teste, e o leitor do boletim é o mesmo já usado nos outros jobs.

**Enquadramento: proposta, não aprovação.** Em `config/fii-baratos.json → publicacao` ficam o **texto de aviso proposto** (no tom do Top 15 de ações: "não é recomendação de investimento", triagem por fórmula, igual para todos, números do passado, risco próprio dos FIIs, perda possível) e o **enquadramento** (descrição e quatro pontos para decisão: a base comum com a D22, os riscos próprios dos FIIs, o parecer independente previsto na D22 antes de divulgar em escala, e o fato de a conferência manual validar o dado e não o mérito do fundo). **`aprovadoPeloResponsavel` continua `false`**: nada é publicado.

**Testes.** Scripts: 286 → 295 (`fii-baratos.test.mjs` de 18 para 21 testes; novo `atualizar-fiis-historico.test.mjs`, com 6). **Mutação:** 13 defeitos introduzidos (preço diário ignorado, mínimo de pregões, último pregão errado, dia sem negócio, trava obrigatória, limite de idade igual ao mensal, alerta de salto sem efeito e com comparação errada, extração sem série ou sem datas, séries desalinhadas, universo sem maiúsculas) e os 13 foram detectados; um sobreviveu à primeira versão (salto medido contra o primeiro dia) e foi reforçado com um caso de tendência gradual.

## D64 (07/10/2026): Envio direto ao GitHub, primeira execução com preço diário e fundos que a B3 não traz (metodologia 1.4.1)

**Como o trabalho passa a ser entregue.** Depois de várias rodadas de zip e de upload manual, o responsável autorizou o acesso direto ao GitHub. Foram instalados **Git e GitHub CLI** no computador de trabalho e feito **um login pelo navegador** (código de dispositivo; a senha nunca passa pelo assistente), com as permissões `repo` e `workflow`. O repositório foi clonado em `C:\nodeportatil\repo`. Desde então o assistente confere o que difere do GitHub (comparando os arquivos com os blobs do `HEAD`), roda os testes no clone, faz **commit e push na `main`**, dispara os workflows com `gh workflow run` e lê os logs com `gh run view --log`, sem prints. Os commits saem com a identidade já usada pelos workflows (Leonardo Daher, `COMMIT_AUTOR_*`), que o deploy da Vercel aceita. **Para revogar o acesso:** `gh auth logout` no computador, ou "Revoke" em github.com/settings/applications (GitHub CLI). Sem a conferência explícita do responsável, o assistente não força push, não apaga branch e não mexe em `aprovadoPeloResponsavel`.

**Arquivo duplicado removido.** O repositório tinha `.github/workflows/atualizar-fii-baratos.yml.` (nome terminado em ponto, **idêntico byte a byte** ao arquivo correto, criado por engano na primeira colagem pelo navegador). O Windows não grava esse nome, então ele foi removido (a cópia correta continua).

**D63 subiu** (commit `542cc7d`): 14 arquivos, 118 já iguais ao GitHub; os workflows "Atualizar preço diário dos FIIs" e "Carga inicial de FIIs (preço diário)" aparecem na lista de Actions.

**Primeira execução com preço diário** (carga de 60 pregões em 6m56s, até 06/10/2026, 199 fundos com preço; triagem do mesmo dia): tijolo 31, papel 16, a conferir 5, fora 166; **TGAR11 em 1º do tijolo** (conferido). Top 15 tijolo: TGAR11, TOPP11, BRCR11, GTWR11, RBVA11, BPML11, BROF11, BBPO11, RZAT11, RZTR11, HSLG11, RCRB11, FATN11, RBRP11, JSRE11. Top 15 papel: HABT11, RECR11, CVBI11, CYCR11, VRTA11, WHGR11, MANA11, PORD11, XPCI11, KCRE11, KNHY11, KNCR11, KNIP11, HGCR11, MXRF11. A conferir: BBIG11, HGRE11, KORE11, MFII11, TRBL11. Preço diário em 180 fundos, mensal em 24. A verificação independente passou.

**Achado: a B3 não traz alguns fundos líquidos no boletim.** Nos 4 arquivos do boletim de 06/10 (todos completos, ~58,7 mil instrumentos) **não existem** BBPO11, CVBI11 e MALL11, embora a brapi mostre cotação de 06/10 e volume de R$ 0,8 a 2,7 mi por dia (e Tivio, Pátria Crédito e Pátria Malls sejam fundos conhecidos). Dos 19 fora do histórico diário, **só esses 3 são líquidos**; os outros 16 são ilíquidos, e 10 outros, dentro do histórico, não negociaram nos últimos 21 pregões. Consequência: com `precoDiarioObrigatorio` ligado (condição para publicar), CVBI11 (3º do papel) e BBPO11 (8º do tijolo) sairiam do ranking. **Correção (1.4.1):** o job de preço diário completa, **pela brapi, só os fundos líquidos que o boletim não traz** (mediana de volume mensal da brapi acima de R$ 300 mil e nenhum negócio no boletim nos últimos 21 pregões; cerca de 3 requisições por dia, com limite de 20 por execução e `BRAPI_TOKEN` do repositório). Nunca sobrescreve um dia do boletim, não completa dia sem negócio, e a lista dos completados fica em `complementadosPelaBrapi` no `historico/fiis.json`. A triagem registra a origem de cada preço: "B3 (boletim diário)" ou "brapi (histórico diário)". A causa de a B3 não trazer esses fundos **não foi identificada**; pode ser mudança de código ou de segmento de negociação.

**Testes.** Scripts: 295 → 307 (`atualizar-fiis-historico.test.mjs` de 6 para 12 testes, e 1 teste novo da triagem). **Mutação:** 12 defeitos no complemento (sobrescrever dia do boletim, preencher dia sem negócio ou fora do histórico, candidato sem piso de liquidez ou com dado no boletim, volume em cotas em vez de reais, 429 que não para, sem limite de requisições, lista de complementados perdida, origem ignorada, limite de idade errado) e os 12 foram detectados.

## D65 (07/10/2026): Top 15 de FIIs baratos publicado atrás do código do mês (metodologia 1.5.0)

**Decisão.** O responsável autorizou publicar ("vamos publicar"). `aprovadoPeloResponsavel` passou a `true` em `config/fii-baratos.json` (com `aprovacao` registrando data e escopo) e `precoDiarioObrigatorio` a `true`. Nenhuma regra de cálculo mudou. `aprovadoPeloResponsavel` do Top 15 de ações não foi tocado.

**Acesso (mesmo desenho da D50).** O job grava um cabeçalho público (`webapp-src/src/data/fiiBaratos.json`, sem nenhum código de fundo) e a lista em `dados-privados/fii-baratos.json`. Nova função `api/top15-fiis.ts` (reaproveita `criarHandler`: código do mês, limite de 10 erros por 15 minutos por IP com hash, contador mensal `top15fiis:acessos`), registrada em `vercel.json` com `includeFiles: dados-privados/**`. Um código vale para as duas listas e fica salvo no aparelho sob a mesma chave. O código **não é gravado em arquivo algum**.

**Trava.** O job faz a verificação de sanidade ANTES de tocar nos arquivos do app: se ela falhar, termina com erro, a auditoria fica gravada e o app não muda.

**Tela.** Componente genérico `PortaoPorCodigo` (extraído do Top 15 de ações, que continua com os mesmos testes), nova tela `Top15FiisBaratos` na aba "Top 15 mais baratos" do Simule FII: abas Tijolo e Papel, memória de cálculo por fundo, selo de conferência manual (data, fonte e validade), "Fundos em conferência" (fora do ranking), busca de "por que ficou de fora", auditoria (comando de verificação e hashes) e aviso (`publicacao.aviso`, ou `avisoProposto`).

**Workflow.** "Atualizar FIIs Baratos" agora compila o site (`npm ci && npm run build`) antes e guarda no repositório a auditoria, o cabeçalho e a lista privada.

**Testes.** Scripts: 307 (inclui publicação: aprovado com código não expõe fundo no cabeçalho; não aprovado só cabeçalho; falha de sanidade deixa o app intacto; `api/top15-fiis` e `vercel.json`). Web: 1321 testes, `tsc -b` limpo.

**Pendências do responsável.** (1) Antes de divulgar, trocar o `TOP15_CODIGOS` de teste da Vercel por um gerado com `npm run codigo-top15` (nunca enviar nem guardar o código). (2) Parecer independente de especialista (D22) antes de divulgar em escala. (3) Acompanhar RZAT11 e os fundos "em conferência"; a conferência manual vale 90 dias.

## D66 (07/10/2026): um código de acesso por classe de ativos

**Decisão.** O Top 15 de ações e o Top 15 de FIIs passam a ter **códigos diferentes**. O código das ações continua em `TOP15_CODIGOS`; o dos FIIs fica em **`TOP15_FIIS_CODIGOS`** (variável nova na Vercel, nunca no repositório). Um código **não abre** a lista do outro.

**Como funciona.** `api/top15-fiis.ts` valida só contra `TOP15_FIIS_CODIGOS`; **sem a variável a porta fica fechada** (503), mesmo que `TOP15_CODIGOS` exista. No aparelho cada lista guarda o seu código em chave própria: ações em `carteiraideal.top15.codigo` (a mesma desde a D50, então quem já liberou as ações continua liberado) e FIIs em `carteiraideal.top15fiis.codigo`. O portão `PortaoPorCodigo` recebe a chave por parâmetro. O limite de tentativas erradas por IP continua **compartilhado** entre as duas portas (mesmo hash de IP), o que só dificulta o chute. A contagem mensal de acessos já era separada (`top15:acessos` e `top15fiis:acessos`).

**Gerador.** `npm run codigo-top15 -- --classe acoes` ou `-- --classe fiis` sorteia o código e lembra em qual variável colocá-lo (o código nunca é gravado). Cada execução é independente.

**Efeito na publicação da D65.** O código de teste que estava em `TOP15_CODIGOS` deixa de abrir os FIIs. Para os FIIs voltarem a abrir é preciso criar `TOP15_FIIS_CODIGOS` na Vercel e fazer Redeploy. O código antigo salvo em aparelhos para os FIIs não existia em chave própria, então quem já tinha liberado os FIIs digita o novo código uma vez.

**Testes.** Scripts: 307 → 308 (`top15-acesso.test.mjs` com o isolamento nos dois sentidos e o gerador por classe). Web: o portão com chave própria e o teste de que o código salvo das ações não abre os FIIs.

## D67 (07/10/2026): Simule Imóvel, a pessoa escolhe quais caminhos comparar

**Pedido do responsável.** Não obrigar a comparação dos quatro caminhos: poder comparar, por exemplo, **à vista × consórcio** ou **financiar × consórcio**, ou marcar os quatro.

**Decisão.** Novo campo `caminhos` nas entradas do motor (`simulaImovel.ts`): lista de 2 a 4 entre `avista`, `financiamento`, `consorcio` e `aluguel`. **Ausente ou `null` = todos**, exatamente como antes: um teste compara o resultado inteiro, número a número, com o de antes (4 caminhos marcados = sem escolha). O mínimo é **dois**; menos que isso, ou caminho repetido ou desconhecido, vira erro em português.

**O que mudou no cálculo (e por quê).** O **orçamento de referência** (o maior desembolso do mês, que quem gasta menos investe a diferença) passou a considerar **só os caminhos escolhidos**. Se ele continuasse considerando os quatro, a parcela do financiamento inflaria o orçamento e mudaria o resultado de à vista × consórcio, sem que o financiamento estivesse na comparação. Um teste muda juros, entrada, tarifa e sistema do financiamento e confirma que o par à vista × consórcio não se mexe (e foi verificado com teste de mutação: reintroduzido o orçamento de quatro caminhos, o teste falha). A contabilidade (`patrimônio = colocado − custos + valorização + rendimento − IR − custos de venda`) continua fechando em todos os pares testados, com e sem lance.

**À vista sem dinheiro.** Continua valendo a regra da D46: sem dinheiro para o imóvel e o ITBI, a rota fica de fora e nunca se inventa dinheiro. O resultado traz `caminhosEscolhidos` (o que a pessoa pediu) e `rotas` (o que de fato entrou). Se sobrar menos de dois (por exemplo, à vista × consórcio sem o dinheiro), a tela mostra o erro, quanto falta e um botão para usar o valor necessário.

**Ponto de virada.** Com o **aluguel** na comparação, cada caminho escolhido é medido contra ele (como sempre foi). **Sem o aluguel**, o ponto de virada passa a ser entre os pares dos escolhidos (ex.: financiar × consórcio). O resultado traz `pares` (com quem fica na frente acima do ponto); os campos antigos `avistaVsAluguel`, `financiamentoVsAluguel` e `consorcioVsAluguel` continuam existindo. Observação útil: **à vista × financiar não têm ponto de virada pela valorização**, porque os dois são donos do mesmo imóvel desde o mês 0; a tela diz que a ordem não muda. A tabela "E se a contemplação demorar?" só aparece com o consórcio na comparação.

**Tela.** Bloco "Quais caminhos comparar?" no começo do formulário, com quatro botões (marcado = fundo amarelo, ✓ e `aria-pressed`), o botão "Comparar os quatro" quando há menos que quatro, e a regra de nunca ficar com menos de dois. Ranking, gráfico, "Para onde foi cada real", blocos de custos, decomposição da vantagem e ponto de virada mostram só os escolhidos. Os blocos de entrada dos caminhos de fora ficam **recolhidos** e marcados "(fora da comparação)" (não são ocultos, para não esconder um valor inválido). O texto diz "Os dois caminhos usam o mesmo dinheiro" quando são dois.

**Não foi pedido e não foi feito.** Carro e moto (têm as mesmas quatro rotas, com "sem carro" no lugar do aluguel) e as páginas de SEO/Metodologia não ganharam o seletor; o estado da escolha não é guardado no aparelho. Fica como próximo passo natural, no mesmo molde.

**Testes.** Web 1.322 → 1.347 (18 do motor, incluindo regressão 4 caminhos = antes, contabilidade em 5 combinações, independência do financiamento, validação, ponto de virada por pares; 7 de tela). `tsc -b` limpo. Scripts: 308 passam.


## D68 (07/10/2026): o cartão da landing passa a se chamar "Simule Bens"

**Decisão.** O cartão que levava ao hub Simule Bens ainda tinha o título do imóvel ("Comprar à vista, financiar, consórcio ou alugar?"), pendência deixada na D47. Agora o título é **Simule Bens** e a descrição é "Imóvel, carro e moto: à vista, financiar, consórcio ou alugar? Veja qual caminho custa menos", no mesmo molde do cartão "Simule Ativos". O destino não mudou (`./app/?tela=simuleBens`). A descrição fala em "custa menos" porque, no carro e na moto, a leitura principal é o custo; no imóvel a tela mostra o patrimônio, que é a mesma conta vista do outro lado.

**Seção "Ferramentas gratuitas" da página inicial (SEO).** O cartão único do imóvel virou **três cartões "Simule Bens"**: imóvel, carro e moto, cada um levando à sua página (`/financiar-alugar-ou-consorcio/`, `/carro-a-vista-financiar-consorcio-ou-sem-carro/` e `/moto-a-vista-financiar-consorcio-ou-sem-moto/`). Antes, carro e moto só apareciam no rodapé. Não foi criada página-hub estática de "Simule Bens"; o hub continua só no app.

**Página do imóvel (`scripts/gerar-paginas.mjs`).** A pergunta "A ferramenta indica qual banco ou qual consórcio escolher?" deixou de dizer "três caminhos" (agora "os caminhos que você escolher, dois, três ou os quatro"), a lista "O que a ferramenta calcula" ganhou a escolha dos caminhos (D67) e a data de revisão da página foi para 07/10/2026 (`REVISADO_D67`).

**Pendência ligada.** A página de carro e a de moto ainda não têm o seletor de caminhos (só o imóvel, D67).


## D69 (07/10/2026): locação como quinto caminho no carro e na moto, com o seletor de caminhos

**Pedido do responsável.** Muita loja aluga carro e moto, às vezes com a possibilidade de comprar no fim. A pessoa pode querer pagar a locação, e não só ficar "sem carro/moto".

**Decisão.** A **locação** é um quinto caminho próprio, separado de "sem carro/sem moto" (que segue sendo um gasto mensal total informado). O seletor "Quais caminhos comparar?" da D67 passa a valer também no carro e na moto (2 a 5 caminhos).

**Premissas da locação (campos editáveis; valores de partida nossos, não de fonte oficial).** Mensalidade (já inclui IPVA, seguro e manutenção) com reajuste anual; caução (devolvida no fim, sem rendimento); taxa de entrada; quilômetros incluídos por mês, quilômetros que a pessoa roda e preço do quilômetro excedente (reajustado com a mensalidade); opção de **comprar no fim do contrato por valor residual informado** (mais transferência). Partida da moto: mensalidade 900, caução 900, 1.500 km incluídos, 800 rodados, excedente 0,40, compra 10.000.

**Cálculo.** O capital inicial, menos caução e taxa, fica investido (classe `Fundo`, IR regressivo); a diferença para o orçamento de referência é investida todo mês. O **orçamento de referência** considera só os caminhos escolhidos (como na D67). Na compra no fim, sai do fundo o valor da compra mais a transferência, e o veículo entra no patrimônio a valor de mercado; a depreciação é valor da compra menos valor de mercado. A contabilidade fecha: patrimônio = colocado − custos + valorização + rendimento − IR − custos de venda.

**Compatibilidade.** `caminhos` ausente ou `null` = os quatro caminhos de antes da locação (resultado idêntico ao anterior, coberto por teste de regressão). Na tela, a escolha começa com os cinco marcados. Ponto de virada: contra "sem o bem" (gasto mensal) e contra a locação (mensalidade).

**Limites assumidos.** Contrato com a duração do horizonte; compra apenas no último mês; sem multa de rescisão, avaria, franquia nem troca de veículo.

**Textos públicos.** Páginas de carro e moto (título, descrição, "o que calcula", custos, FAQ), cartões da landing e rodapé atualizados.

**Testes.** Web 1.347 → 1.375; scripts 308. Teste de mutação no orçamento de referência (só os caminhos escolhidos): confirmado e arquivo restaurado.

## D70 (08/10/2026): Top 15 ETFs mais negociados e Top 15 BDRs com maior desconto de preço

**Decisão e o que mudou em relação ao plano.** O responsável pediu os rankings de ETFs e BDRs. A recomendação inicial para ETFs era "mais eficientes" (menor taxa de administração, patrimônio e liquidez mínimos). **Não é viável de forma confiável**: a CVM não traz a taxa de administração de ETFs em dado aberto (o `cad_fi.csv` antigo não tem ETF ativo e o `registro_classe.csv` novo não tem coluna de taxa), e ligar ticker a CNPJ também não é direto. Por isso o ETF seguiu o critério que o próprio responsável pediu antes, **mais negociados** (liquidez), e o BDR o critério recomendado: **desconto de preço** contra a máxima de 12 meses. Metodologia completa em `docs/11-metodologia-top15-etfs-bdrs.md`.

**O que foi construído.** Cálculo puro `scripts/top15-mercado-calculo.mjs`; orquestrador com auditoria `scripts/atualizar-top15-mercado.mjs` (`etfs` ou `bdrs`); verificador independente `scripts/top15-mercado-verificar.mjs`; configurações `config/top15-etfs.json` e `config/top15-bdrs.json` (v1.0.0); workflow mensal "Atualizar Top 15 ETFs e BDRs" (dia 22); trilha em `auditoria/top15-etfs/` e `auditoria/top15-bdrs/`. Sem rede: lê `historico/etfs.json` e `historico/bdrs.json`, com o sha256 no manifesto.

**Acesso.** ETFs: **aberto** (ordenação por volume de dado público que o app já exibe). BDRs: **código próprio**, `TOP15_BDRS_CODIGOS` (função `api/top15-bdrs.ts`, arquivo `dados-privados/bdr-desconto.json`, chave `carteiraideal.top15bdrs.codigo`), isolado das ações e dos FIIs nos dois sentidos, como na D66. `npm run codigo-top15 -- --classe bdrs`. O cabeçalho público dos BDRs não tem nenhum ticker (teste automático).

**Telas.** Novo componente `AbasDaTela` e abas "Simulador | Top 15" em Simule ETF e Simule BDR. A nota do D23 ("sem ranking") passa a valer só para o simulador; o ranking tem aviso próprio.

**Primeira execução real (pregões até 05/10/2026).** ETFs: universo 234, 80 elegíveis. BDRs: universo 702, 64 elegíveis, 10 em conferência (vários por salto de desdobramento ainda não confirmado em `config/bdrs.json`: NFLX34, BKNG34 e outros). A verificação independente passou nos dois.

**Publicação.** O responsável mandou publicar os dois em 08/10/2026 ("publique os 2"): `aprovadoPeloResponsavel` passou a `true` nos dois (v1.1.0, aprovação registrada em `publicacao.aprovacao`); nenhuma regra de cálculo mudou. ETFs ficam abertos. Os BDRs só abrem com o código do mês próprio (`TOP15_BDRS_CODIGOS`): **até a variável existir na Vercel a lista de BDRs fica fechada** (503). O parecer independente (D22) segue como item do responsável.

**Testes.** Scripts: +33 (`top15-mercado.test.mjs`) e +1 (`top15-acesso.test.mjs`). **Mutação:** 31 defeitos no cálculo (mediana trocada por média, dia sem negócio ignorado, limites inclusivos de liquidez, dias e pregões sem negócio, máxima por máxima do dia em vez do fechamento, desdobramento ignorado, limites do salto, desconto extremo, ordem, janela, alinhamento da série, cortes de lista e de categoria, desempates, sanidade) e os 31 foram detectados; 6 sobreviveram à primeira versão dos testes (limites exatos e o dia sem negócio) e foram cobertos. Web: telas, domínio e acesso dos dois rankings.

## D71 (08/10/2026): Top 15 mais negociados de FIIs, ações e BDRs, abertos

**Decisão.** O responsável pediu, em sequência, os rankings de **FIIs**, **ações** e **BDRs mais negociados** e decidiu que são **abertos, sem código** (como o de ETFs da D70). O critério é o mesmo dos ETFs: a mediana do volume financeiro diário dos últimos 21 pregões. Metodologia na seção 7 de `docs/11-metodologia-top15-etfs-bdrs.md`.

**Como foi feito.** O cálculo dos ETFs virou o cálculo de liquidez das quatro classes (a classe e a categoria vêm nos insumos; `calcularFiis`, `calcularAcoes` e `calcularBdrsNegociados` são adaptadores finos). O orquestrador ganhou as classes `fiis`, `acoes` e `bdrs-negociados`, cada uma com config (`config/top15-fiis.json`, `top15-acoes.json`, `top15-bdrs-negociados.json`, v1.0.0), pasta de auditoria e arquivo do app próprios; o verificador independente reconhece as cinco. Nome e segmento dos FIIs vêm do job de FIIs, nome e setor das ações vêm do job de ações (o sha256 desses arquivos entra no manifesto), e os BDRs usam o cadastro do histórico de BDRs, com os BDRs de ETF (final 39) em categoria própria e as empresas brasileiras do `config/bdrs.json` de fora (D19).

**Telas.** A tela dos ETFs virou a tela genérica `Top15MaisNegociados` (os textos de cada classe ficam num mapa: ETF, FII, ação e BDR, com o gênero certo e a ressalva do que cada ranking NÃO mede). Terceira aba "Top 15 mais negociados/negociadas" em Simule FII, Simule Ações e Simule BDR; Simule ETF já tinha. `AbasDaTela` passou a calcular as colunas pelo número de abas.

**Primeira execução real (pregões até 07/10/2026).** FIIs: 202 analisados, 75 elegíveis (topo KNCR11, TRXF11, MXRF11, BTLG11, HGLG11). Ações: 390 analisadas, 196 elegíveis (PETR4, VALE3, ITUB4, BBAS3, AXIA3). BDRs: 933 analisados, 91 elegíveis (AURA33, MELI34, MUTC34, NVDC34, TSLA34). A verificação independente passou nos três.

**Publicação.** O responsável mandou publicar os três em 08/10/2026 ("publique os 3"): `aprovadoPeloResponsavel` passou a `true` (v1.1.0, aprovação registrada em `publicacao.aprovacao`); nenhuma regra de cálculo mudou. Acesso aberto, sem código e sem variável na Vercel.

**Testes.** Scripts +11 (`top15-mercado.test.mjs`: classe nos resultados, configs, três construtores de insumos, publicação aberta sem arquivo privado, verificação independente, pastas e arquivos sem colisão); web +28 (`Top15MaisNegociados.test.tsx`, um bloco por classe mais as abas das três telas). **Mutação:** 15 defeitos novos (precedência do nome, categoria padrão, ordem dos segmentos e setores, filtro de BDR de ETF, exclusões manuais, classe errada nos adaptadores, formato do snapshot e do CSV, sanidade, verificador) e os 15 foram detectados (um sobreviveu à primeira versão do teste de nomes e foi coberto); as 31 mutações do cálculo (D70) continuam todas detectadas.

## D72 (08/10/2026): Top 15 do IFIX e do Ibovespa (maiores pesos)

**Decisão.** O responsável pediu o "Top 15 FII do IFIX" e o "Top 15 ações do IBOV". Foi lido como **os 15 maiores pesos de cada índice**, o sentido usual de "top do índice", que é dado oficial e auditável. A alternativa (ranquear só os componentes por volume ou por preço) ficou como possibilidade futura, porque os rankings de mais negociados (D70 e D71) e de baratos já existem.

**O que foi construído.** `scripts/b3-indices.mjs` (endereço, download com nova tentativa e leitura estrita da carteira da B3), `calcularIndice` e a sanidade de índice em `scripts/top15-mercado-calculo.mjs`, classes `ifix` e `ibov` no orquestrador (`executarIndice`, assíncrono; é a única etapa com rede) e no verificador, `config/top15-ifix.json` e `config/top15-ibov.json` (v1.0.0), arquivos do app `ifixMaioresPesos.json` e `ibovMaioresPesos.json`. A auditoria guarda a tabela completa da B3, o endereço e o sha256 da resposta bruta; a verificação independente refaz tudo sem internet. Detalhe na seção 8 de `docs/11-metodologia-top15-etfs-bdrs.md`.

**Telas.** Componente `Top15Indice` e quarta aba em Simule FII ("Top 15 do IFIX") e em Simule Ações ("Top 15 do Ibovespa"); as abas passaram a ficar em duas colunas. Cada cartão mostra o peso, o peso acumulado, a barra proporcional, a cotação e o volume (informativos).

**Workflow.** As duas etapas de índice rodam com `continue-on-error`: se a B3 falhar, os outros rankings são guardados, a auditoria do índice que falhou vai só como artefato (não para o repositório) e o job termina com erro no fim.

**Primeira execução real.** IFIX: 99 fundos, os 15 maiores somam 50,9% (KNCR11, KNIP11, BTLG11, HGLG11, XPML11). Ibovespa: 76 ativos, os 15 maiores somam 66,2% (ITUB4, VALE3, PETR4, PETR3, AXIA3). Pesos somam 100% nos dois.

**Publicação.** O responsável mandou publicar os dois em 08/10/2026 ("publique os 2"): `aprovadoPeloResponsavel` passou a `true` (v1.1.0, aprovação registrada em `publicacao.aprovacao`); nenhuma regra de cálculo mudou. Acesso aberto, sem código e sem variável na Vercel.

**Testes.** Scripts +9 no `b3-indices.test.mjs` e +11 no `top15-mercado.test.mjs`; web +16 (`Top15Indice.test.tsx`) mais os testes de abas atualizados. **Mutação:** 34 defeitos nos índices (ordem e desempate, acúmulo e arredondamento do peso, corte, universo, cada limite da sanidade, cada validação da leitura da B3, nova tentativa, erro HTTP, nomes e setores, sha256 da resposta, CSV, verificador) e os 34 foram detectados; 3 sobreviveram à primeira versão (arredondamento dos pesos, que o teste não exercitava, e uma mutação mal escolhida minha) e foram cobertos.

## D73 (09/10/2026): Revisão do motor de perfis (`engine.ts`) e da pergunta do Pilar 7

**Contexto.** Uma revisão crítica da metodologia (matriz, veto, travas) rodou o motor com as 2.187 combinações de respostas da Arquitetura x 3 suitabilities e achou sete problemas verificáveis. O responsável pediu para corrigir todos e preencher a matriz.

**O que mudou.**
1. **Os 9 Perfis-Mãe passam a ser todos alcançáveis.** Antes, os perfis 2, 3 e 6 nunca apareciam (a coluna Conservador da matriz era sempre Defensivo e o Moderado nunca chegava a Crescimento Pleno). Agora a **capacidade real define só o vetor** (baixa = Defensivo, média = Equilibrado, alta = Crescimento Pleno; veto = Defensivo) e o **suitability vira teto de risco da carteira** (tabela `TETO_RISCO_SUITABILITY`: Conservador 10/20/30%, Moderado 35/45/55% em curto/médio/longo, Arrojado sem teto; soma de ouro, FIIs, ações, BDRs, internacionais e cripto). O excesso sai das classes de risco na mesma proporção e vai para o Tesouro Selic (curto) ou o IPCA+ (médio e longo). **Cripto só para Arrojado**, como o doc 02 (seção 5.1) já dizia e o motor não cumpria. Efeito colateral aceito: a carteira do Moderado Equilibrado de longo prazo perdeu os 3% de cripto.
2. **O Pilar 3 manda no prazo da carteira.** [A] (saque em até 24 meses) usa o modelo de **curto prazo**; [B] (3 a 5 anos) derruba o prazo longo para **médio**. Antes, o veto levava ao Defensivo mas mantinha o prazo longo (22% em FIIs e ações).
3. **Calibradores que aumentam risco (Pilar 4 [C], Pilar 6 [C]) não rodam em carteira vetada ou Defensiva**, e o Pilar 4 [C] também não roda se a pergunta de reação do suitability disse que a pessoa se abala com quedas.
4. **Pilar 7 deixa de pontuar.** O score passa a ter 6 pilares (6 a 18); as faixas viraram baixa 6 a 9, média 10 a 14, alta 15 a 18 (mesma proporção das antigas 7 a 11, 12 a 16 e 17 a 21). Declaração de IR não mede capacidade de risco, e a troca da resposta do Pilar 7 mudava o perfil em 42% das combinações sem veto.
5. **Pergunta do Pilar 7 reescrita para um conceito só** (antes misturava regime de declaração, PJ e sucessão): "Como você declara o Imposto de Renda hoje?" com três opções que se excluem: [A] completa, [B] simplificada, [C] isento(a) ou não sabe. Cada resposta gera um aviso (PGBL, "compare com o VGBL", "confira o modelo"). **Sucessão** saiu da pergunta: o aviso sobre previdência e herança aparece a partir dos **50 anos** (`IDADE_ALERTA_SUCESSAO`, parâmetro a revisar). **PJ** deixa de ser coberto. As chaves das respostas não mudaram (a, b, c), então a API não muda.
6. **Piso de liquidez de 20% (sem reserva) agora é cumprido.** Antes o motor somava o que faltava ao CDB e a normalização final diluía, deixando 19% ou 17%. Agora a fatia sai das outras classes na mesma proporção.
7. **Respostas que se contradizem:** se o suitability diz que há reserva e o Pilar 1 diz menos de 3 meses, aparece um aviso (a reserva do Pilar 1 já leva ao Defensivo, com 25% ou mais de liquidez); o Pilar 2 [A] passa a avisar que **quitar dívida cara vem antes** de investir (e aponta o plano de dívidas do Meu Mês). O veto continua binário.

**Não mudou.** O veto binário dos Pilares 1 a 3, a rebaixa por prazo curto/idade/reação, as travas de patrimônio e experiência, o número de perguntas (14) e a API. O teto e as faixas são **parâmetros de produto** e merecem a revisão do responsável e do parecer independente (D22).

**Testes.** 46 testes no motor (`engineD73.test.ts` novo e ajustes em `engine.test.ts`), incluindo varredura das 2.187 combinações x 3 suitabilities (soma 100%, sem negativos, dentro do teto, cripto só Arrojado, piso de liquidez). **Mutação:** 17 defeitos introduzidos (tetos, cripto, prazo do Pilar 3, pontuação do Pilar 7, faixas, calibradores, reação, piso, vetores, idade, destino do corte); 3 passaram na primeira rodada (fronteira da faixa baixa, destino do corte e um trecho redundante, que foi removido) e todos são detectados agora.

**Pendência.** Os testes `Top15BdrsDesconto.test.tsx` e `Top15MaisNegociados.test.tsx` (Simule BDR) já falhavam na `main` antes desta mudança; não foram mexidos aqui.


## D74 (09/10/2026): Meu Mês Supermercado, lista de compras por categoria (sem IA)

**Decisão.** O responsável pediu uma segunda aba no Meu Mês, "Supermercado": a pessoa diz o que precisa comprar, os itens aparecem com uma bolinha para ticar no mercado, agrupados por categoria. Começou **sem IA**, com categorias. O Meu Mês passou a ter duas abas (mesmo componente `AbasDaTela` das telas de simulação): **Contas do mês** (o que já existia, sem mudança) e **Supermercado**.

**Como funciona.** A pessoa escreve (ou dita pelo microfone do teclado) "arroz, feijão, 2 litros de leite, sabão em pó e frango". `domain/supermercado.ts` separa em itens (vírgula, ponto e vírgula, quebra de linha, " e ", " + "; marcadores e numeração saem; "2,5 kg" não quebra), lê a quantidade ("2 litros", "3kg", "12", "meia dúzia", números por extenso), sugere a **categoria** por dicionário de palavras (11 categorias na ordem dos corredores: Hortifruti, Açougue e peixaria, Padaria, Frios e laticínios, Mercearia, Bebidas, Congelados, Limpeza, Higiene e beleza, Pet, Outros; sem acento, plural ignorado, a expressão mais longa vence, como "leite de coco" = bebida e "leite" = laticínio) e a pessoa troca a categoria de qualquer item. Item igual a um que ainda não foi comprado não duplica (a pessoa é avisada); item já comprado volta como compra nova. Na categoria, o que falta vem antes do que já está no carrinho. Botões: tirar da lista o que já foi comprado, desmarcar tudo (reusar a lista) e apagar a lista, os dois de apagar com confirmação.

**Onde fica.** Só no aparelho (`localStorage`, chave `carteiraideal.supermercado`, versão 1), separada do orçamento (`carteiraideal.orcamento`): uma não mexe na outra. Nada vai para a API. A leitura descarta o que estiver malformado (limite de 300 itens, 80 caracteres no nome) sem travar. A Política de Privacidade passou a citar a lista de compras entre os dados guardados no aparelho.

**Limites conhecidos.** O dicionário de categorias é finito: o que não casa cai em "Outros" (dá para trocar, mas o app não aprende). Não sincroniza entre aparelhos nem entre pessoas. O microfone é o do teclado do celular (a página não faz reconhecimento de voz própria).

**Próximo passo, se o responsável quiser.** Um botão opcional "Organizar com IA" (função nova na Vercel, chave de API, limite por pessoa e texto de privacidade avisando que o texto sai do aparelho), e/ou "Enviar a lista pelo WhatsApp".

**Testes.** Domínio +56 (`supermercado.test.ts`) e tela +16 (`MeuMesSupermercado.test.tsx`, inclusive as duas abas juntas e a lista independente do orçamento). **Mutação:** 19 defeitos (duplicidade, ordem, limpeza, desmarcar, limites da leitura, decimal, separadores, marcadores, plural, desempate de categoria, validação); todos detectados, exceto o desempate entre categorias de mesmo tamanho, que é equivalente porque nenhuma palavra do dicionário repete entre categorias.


## D75 (09/10/2026): Editar itens do Meu Mês Supermercado; botão de apagar em amarelo

**Pedido.** O ditado do teclado do celular reproduz mal a lista (junta itens e erra a escrita), então o responsável pediu um botão de **editar** em cada item, e o botão "Apagar a lista inteira" em amarelo, como o de adicionar.

**O que mudou.** Cada item ganhou o botão ✎: abre um formulário no próprio item com nome, quantidade (opcional) e categoria, com Salvar, Cancelar, Enter e Esc. `editarItem` (em `domain/supermercado.ts`) **separa em vários itens** quando o nome editado tem vírgula, " e " ou quebra de linha, para consertar o ditado que veio tudo junto: o primeiro pedaço fica no lugar do item (mantém o "comprado"), os outros entram logo abaixo com a categoria sugerida. Ao separar, o primeiro pedaço também ganha a categoria sugerida, a menos que a pessoa tenha escolhido outra na edição. A quantidade escrita no nome vale quando o campo de quantidade fica vazio. Nome vazio não muda nada. "Apagar a lista inteira" e a confirmação usam `btn-primary` (amarelo).

**Testes.** +9 no domínio e +4 na tela. **Mutação:** 12 defeitos em `editarItem` (regex da quantidade, quantidade e categoria ignoradas, divisão, extras descartados, "comprado" perdido, nome vazio, id inexistente, limites de tamanho), todos detectados. Um defeito real apareceu antes do envio: a limpeza de espaços da quantidade apagava a letra "s" (uma barra invertida perdida na edição por script), e foi corrigido.

**Também neste envio (sem mudança no app).** Os testes `Top15BdrsDesconto.test.tsx` e `Top15MaisNegociados.test.tsx` (Simule BDR) já falhavam: o Top 15 de BDRs foi publicado atrás de código (D70) e a tela passou a conferir primeiro o código salvo no aparelho ("Verificando o código salvo neste aparelho…") antes de mostrar o portão; os testes conferiam de forma síncrona e agora esperam o portão (`findByTestId`). O teste de varredura da D73 ganhou limite de 60 s, porque estourava os 5 s padrão na suíte inteira.


## D76 (09/10/2026): Meu Mês Supermercado, enviar a lista pelo WhatsApp

**Pedido.** Um botão para mandar a lista de compras a outra pessoa (ou a si mesmo). Decidido: manda **só o que ainda falta comprar** (itens não ticados), não a lista inteira.

**Como funciona.** `textoParaCompartilhar` monta a mensagem por categoria, na ordem dos corredores, só com os itens não ticados ("🛒 Lista de compras", cada categoria com emoji e itens em "• Nome, quantidade"); categoria que esvazia some. `linkDoWhatsApp` devolve `https://wa.me/?text=…` com o texto codificado; a pessoa escolhe o contato no próprio WhatsApp. O botão ("Enviar o que falta pelo WhatsApp") é um link que abre em nova aba (`noopener noreferrer`) e **só aparece quando há algo faltando** (some com a lista vazia ou tudo ticado); o texto acompanha os tiques.

**Privacidade.** O texto não passa por servidor nosso; só sai do aparelho quando a pessoa toca no botão e escolhe o contato, e a partir daí é tratado pelo WhatsApp. A Política de Privacidade ganhou um parágrafo sobre isso, e o aviso no fim da aba também.

**Limites.** É um envio único (não sincroniza se a lista mudar depois) e quem recebe ganha só o texto, não a lista no app.

**Testes.** +4 no domínio (só o que falta, itens ticados e categorias vazias fora, vazio sem link, codificação do link) e +2 na tela (o link acompanha os tiques e o botão some sem nada faltando).


## D77 (09/10/2026): Página inicial, FAQ e página /meu-mes/ passam a citar o Meu Mês Supermercado

**Pedido.** Depois da D74 a D76, a página inicial e o FAQ ainda descreviam o Meu Mês só como contas.

**O que mudou.**
- **Página inicial (`index.html`):** o cartão do Meu Mês diz "Contas do mês, supermercado e planejamento financeiro"; o cartão da lista de ferramentas virou "Meu Mês: contas e supermercado" e cita a lista por categoria para ticar no mercado e enviar pelo WhatsApp. A resposta do FAQ "Minhas respostas ficam guardadas em algum lugar?" passou a dizer que a lista de supermercado também fica só no aparelho e que **só o texto da lista sai dele, e apenas se a pessoa tocar em "Enviar o que falta pelo WhatsApp"**. Nova pergunta do FAQ, "O que posso fazer no Meu Mês?" (visível e no JSON-LD; as 6 perguntas coincidem nos dois).
- **Página `/meu-mes/` (`scripts/gerar-paginas.mjs`):** descrição, lead, nova seção "Aba Supermercado: a lista de compras" (bolinha para ticar, editar, WhatsApp), seção "Onde ficam os seus dados" com a exceção do WhatsApp (e a cópia de segurança, que cobre só as contas), e duas perguntas novas no FAQ ("Como funciona o Meu Mês Supermercado?" e "Posso mandar a lista de compras para outra pessoa?"). Data de revisão desta página: 09/10/2026 (as demais seguem em 28/09/2026).
- **`manifest.webmanifest`:** descrição do atalho do Meu Mês. O arquivo estava com fim de linha do Windows (CRLF) no disco e foi normalizado para LF, como está no repositório.

**Verificação.** Os 366 testes de scripts passam; o JSON-LD da página inicial e o da `/meu-mes/` são válidos; conferido na tela, com um servidor estático local, que a página inicial mostra os textos novos.


## D78 (12/10/2026): Veto explicado na tela, trilha de auditoria do motor e perfil 7 passa a "Quase Arrojado"

**Contexto.** Uma segunda revisão do motor (cenários com um, dois e três [A] nos pilares duros, conferidos no motor local e na API publicada) achou uma contradição visível ao cliente: com veto, a tela mostrava "Capacidade real: alta (score 16/18)" ao lado de um perfil defensivo, porque o score mede a vida financeira em geral e o veto olha o risco imediato.

**O que mudou.**
1. **Tela de resultado sem contradição.** Com veto, a linha passa a explicar: "Pelo score, sua capacidade seria alta (16/18), mas [motivos]: por isso a carteira de referência fica defensiva", com os motivos de cada pilar que vetou ("a sua reserva cobre menos de 3 meses", "você tem dívida cara ou passivo em dólar", "você vai precisar de parte do dinheiro em até 24 meses"). Sem veto, a linha é a de sempre.
2. **Motivo do veto em linguagem simples, como primeiro aviso** ("Carteira levada a Defensivo porque …. Resolvendo isso, o perfil pode subir numa nova avaliação.").
3. **Trilha de auditoria em cada resultado:** `versaoMotor` (`VERSAO_MOTOR`, hoje `2026.10.12-D78`; mudar a cada alteração de regra), `regrasAcionadas` (identificadores estáveis, na ordem em que rodaram: `veto:<pilar>`, `prazo:janela-24-meses`, `prazo:janela-3-a-5-anos`, `aviso:divida-cara`, `aviso:reserva-divergente`, `limite:estresse-vs-reacao`, `teto:suitability-<perfil>`, `piso:liquidez-sem-reserva`, `limite:patrimonio-baixo`, `limite:sem-experiencia`, `rebaixa:prazo-curto-arrojado`, `limite:reacao-ansiosa`, `rebaixa:idade-aposentadoria`) e `pilaresDoVeto`. A API devolve os campos novos junto com o resto; nada é gravado no servidor. Os calibradores suaves (Pilares 4 a 6) ainda não geram regra própria.
4. **Rótulo do perfil 7:** "7. Arrojado Travado (Falso Arrojado)" virou **"7. Arrojado Travado (Quase Arrojado)"** (tipo, motor, testes, docs/02 e painel). O painel de métricas soma as contagens do nome antigo e do novo na mesma barra, para o histórico não se partir.
5. **Comentários do código:** corrigidos os que citavam "13 classes" e seções do documento antigo; documentado que a chave `acoesETFs` é um nome herdado de "Ações".

**Não mudou.** O veto continua binário (qualquer [A] nos Pilares 1 a 3 leva ao Defensivo); as carteiras-modelo; o número de perguntas (14); as regras de cálculo.

**Decisões de produto que ficam com o responsável** (propostas da revisão, não aplicadas): (a) o Defensivo de longo prazo, que recebe quem vetou por P1 ou P2 (30% em risco, 22% em FIIs e ações), é adequado?; (b) separar o P2 em "dívida cara" e "passivo em dólar" (hoje dois conceitos numa resposta); (c) reserva e reação são perguntadas no suitability e nos Pilares 1 e 4: unificar mudaria 14 para 12 ou 13 perguntas; (d) perguntar o percentual a sacar no P3 (15ª pergunta) para segregar só a fatia, em vez de levar a carteira inteira ao curto prazo; (e) teste de propriedade "piorar uma resposta nunca aumenta o risco", ainda não escrito.

**Testes.** +15 (`engineD78.test.ts`, `Resultado.test.tsx`). **Mutação:** 13 defeitos (ordem e filtro dos pilares, versão e regras não gravadas, aviso do veto fora de ordem, regras de veto, teto, piso e prazo ausentes, motivo errado, tela ignorando o veto ou os motivos); todos detectados, o primeiro defeito que sobreviveu ([B] contando como veto) ganhou teste.

## D79 (12/10/2026): Meu Mês Supermercado separa sozinho o ditado sem vírgulas (sem IA, sem rede)

**Contexto.** O ditado do teclado do celular entrega a lista inteira numa linha só ("arroz feijão leite ovos"), e o separador só cortava por vírgula, ponto e vírgula, quebra de linha, " e " e " + ". O responsável perguntou sobre usar IA; o custo estimado é de centavos (Haiku 5.5, US$ 0,10 e US$ 0,50 por milhão de tokens), mas a IA exigiria função na Vercel, chave, limite por pessoa e aviso de privacidade (o texto sairia do aparelho). Decidido começar pela melhoria gratuita e local; a IA continua adiada.

**O que mudou** (`separarItensGrudados` em `webapp-src/src/domain/supermercado.ts`, usada por `interpretarTexto` e, portanto, também pela edição do item):
1. Corta onde começa um produto do dicionário de categorias (a chave mais longa vence). Palavra desconhecida gruda no item anterior ("arroz parboilizado").
2. Depois de "de", "com", "sem", "para"... a parte continua o mesmo item ("suco de laranja", "arroz com feijão").
3. Qualificativos ("integral", "recheado", "congelado", "ralado"...) e pares conhecidos ("queijo mussarela", "suco laranja", "farinha mandioca") não abrem item novo (`MODIFICADORES`, `COMPLETAM`).
4. Se o texto começa por quantidade ("2 leite 3 ovos", "2 kg arroz 1 kg feijão"), cada número seguido de palavra abre item novo; "2kg" colado é descolado em qualquer ponto.
5. Quantidade depois do nome ("leite 2 litros", "arroz 5kg") vira quantidade do item (antes ficava no nome).
6. Achado na conferência no ar (12/10/2026): "arroz feijão 2 litros de leite" deixava "feijão 2 litros de leite" junto, porque o texto não começava por número. Agora, no meio do texto, número + unidade + "de" (ou número direto + palavra) abre item novo; "leite 2 litros arroz 1 kg" segue lendo a quantidade como do nome anterior.

**Limites conhecidos.** Dois produtos do dicionário seguidos que formam um nome só e não estão em `COMPLETAM` são separados (ex.: "queijo presunto" vira dois itens); "arroz com feijão" fica como um item. A pessoa corrige no ✎ (nome com vírgula separa). Quantidade depois do nome só é lida com unidade. Produto fora do dicionário não separa. Esses limites são o gatilho para voltar à IA, se o teste no celular mostrar que pesam.

**Não mudou.** Privacidade (nada sai do aparelho), categorias, formato gravado, WhatsApp.

**Testes.** +10 em `supermercado.test.ts`; dois testes antigos (domínio e tela) que usavam "arroz feijão leite" como item grudado passaram a usar texto que o separador não reconhece. **Mutação:** 5 defeitos (conector, qualificativo, par conhecido, número abre item, número solto no fim); um sobrevivente (qualificativo) levou a um teste novo ("frango congelado").

## D80 (12/10/2026): teste de propriedade do motor ("piorar uma resposta nunca aumenta o risco") e verificação automática a cada envio

**Contexto.** A revisão do motor (D78) deixou como pendência o teste de propriedade e a verificação a cada envio. Os testes do motor eram todos de exemplos escolhidos à mão; nada afirmava uma regra que vale para todas as respostas.

**O que entrou.**
1. **`engineMonotonia.test.ts`** (tempo de execução: cerca de 9 s). Três propriedades, com a arquitetura conferida de forma exaustiva (2.187 combinações) e o suitability amostrado com semente fixa (40 combinações): (a) o Pilar 7 não muda nenhum percentual; (b) toda carteira soma 100, sem classe negativa, cripto só para Arrojado e risco dentro do teto do suitability (+1 de arredondamento); (c) piorar uma resposta (prazo, tolerância, reserva, patrimônio, experiência e reação; os seis pilares que pontuam) não aumenta o risco. "Objetivo" fica de fora: não é uma escala.
2. **Workflow `verificar.yml`**: `tsc -b` e `npm test` (web e scripts) a cada envio na `main` e em cada pull request, ignorando commits só de dados. É alarme (e-mail do GitHub), não trava: a Vercel publica por conta própria.

**Achado: a propriedade (c) é violada.** Em 254.421 comparações, o risco **sobe** 2 pontos ou mais em 2.507 (cerca de 1%), com aumento máximo de 8 pontos: a carteira de quem declarou menos capacidade pode ficar com mais risco que a de quem declarou mais. Causas medidas (ordem de peso): (1) o corte do teto do suitability mantém o piso de cada classe e termina abaixo do teto (`aplicarTetoSuitability`, `atual - Math.floor(atual * fator)`); (2) o limite de 10% por classe de quem não tem experiência roda **depois** do teto e corta de novo; (3) o piso de liquidez de quem não tem reserva corta mais a carteira de vetor maior, que tem menos liquidez de partida, do que a Defensiva do veto; (4) arredondamento de 1 a 2 pontos (Pilar 4 [A] move 30% de cada classe para ouro, que conta como risco).

**Como ficou o teste.** Trava o estado atual: o número de aumentos de 2 pontos ou mais (2.507) e o maior aumento (8) não podem crescer. Não corrige o motor.

**Correção proposta (não aplicada; muda carteiras exibidas e exige subir `VERSAO_MOTOR`):** (i) corte do teto pelo método dos maiores restos, que fecha exatamente no teto; (ii) rodar o limite de 10% por classe **antes** do teto. Medido em experimento local, com os testes atuais do motor (56) passando: aumentos de 2 pontos ou mais caem de 12,6 mil para 3,6 mil (em outra amostra, de 60 suitabilities, sem o Pilar 7 fixo) e o maior de 8 para 4; o resto é arredondamento e o piso de liquidez. O piso, que é decisão de produto (tirar a liquidez que falta de renda fixa longa antes de tirar de risco), segue com o responsável.

**Aplicado (12/10/2026, `VERSAO_MOTOR` 2026.10.12-D80).** Por decisão do responsável, as duas correções entraram no motor: (i) `aplicarTetoSuitability` passa a fechar exatamente no teto (maiores restos); (ii) o limite de 10% por classe de quem não tem experiência roda antes do teto. Nada mudou nos tetos, faixas, veto e piso de liquidez. Medido na mesma amostra do teste de propriedade: aumentos de 2 pontos ou mais caíram de 2.507 para 956 (de 1% para 0,4%) e o maior de 8 para 5 pontos; os limites do teste foram apertados. O que sobra é arredondamento (Pilar 4 [A] move 30% de cada classe para o ouro, que conta como risco) e o piso de liquidez, que segue decisão de produto. Testes novos em `engineD80.test.ts` (falham no motor antigo).

## D81 (12/10/2026): o piso de liquidez sai primeiro da renda fixa longa

**Contexto.** Na D80 sobrou como causa de inversão de risco o piso de liquidez de quem não tem reserva (20% em Tesouro Selic + CDB): ele tirava a fatia que faltava de **todas** as classes na mesma proporção, o que reduzia o risco por tabela justamente de quem tinha a carteira mais arrojada (menos liquidez de partida). A Defensiva do veto, que já tem 40% de liquidez, não cedia nada. Resultado: quem declarava mais capacidade podia terminar com menos risco que quem caiu no veto (exemplo medido: 16% contra 20%).

**Decisão do responsável (opção B).** O piso passa a sair primeiro da renda fixa de prazo mais longo (Tesouro IPCA+, Prefixado e LCI/LCA, na mesma proporção entre elas) e, só se isso não bastar, das classes de risco. A opção C (um teto de risco explícito para quem não tem reserva) fica para ser decidida junto das decisões do veto (D78).

**Efeito medido** (60 suitabilities x 729 arquiteturas): com reserva, nenhuma carteira muda (0 de 26.973); sem reserva, 15% mudam (2.510 de 16.767), com aumento médio de 1,7 ponto de risco entre as que mudam e máximo de 8, sempre dentro do teto do perfil. No teste de propriedade: aumentos de 2 pontos ou mais de 956 para 469 e o maior de 5 para 3 pontos. `VERSAO_MOTOR` 2026.10.12-D81; limites do teste apertados. Testes novos em `engineD81.test.ts` (falham com o piso antigo).

## D82 (12/10/2026): veto limita o prazo da carteira ao médio

**Contexto.** Primeira das decisões em aberto da D78. Quem vetou por reserva menor que 3 meses (Pilar 1) ou por dívida cara/passivo em dólar (Pilar 2) e tinha prazo longo no suitability recebia o Defensivo de **longo** prazo: 30% em risco (22% em FIIs e ações). A tela diz "resolva isso antes de investir", e a carteira exibida contradizia o aviso. Só o veto por saque em até 24 meses (Pilar 3 [A]) levava ao prazo curto.

**Decisão do responsável.** Qualquer veto limita o prazo da carteira a, no máximo, **médio** (Defensivo de médio prazo: 20% em risco). O saque em até 24 meses segue como curto. Quem tinha prazo curto ou médio não muda. Regra registrada como `prazo:veto-medio` e aviso na tela. `VERSAO_MOTOR` 2026.10.12-D82.

**Efeito.** Só carteiras vetadas com prazo longo mudam (de 30% para 20% de risco). No teste de propriedade, aumentos de risco ao piorar uma resposta (2 pontos ou mais) caem de 469 para 379 e o maior de 3 para 2 pontos. Testes novos em `engineD82.test.ts` (falham sem a regra).

**Segue em aberto (D78):** separar o Pilar 2 em "dívida cara" e "passivo em dólar"; perguntar o percentual a sacar no Pilar 3; unir reserva e reação com os Pilares 1 e 4 (14 vira 12 ou 13 perguntas); nome do perfil 3; opção C do piso (teto de risco explícito para quem não tem reserva).

## D83 (12/10/2026): veto menos rígido: o Pilar 3 pergunta quanto vai ser sacado

**Contexto.** Decisão 4 da D78. O [A] do Pilar 3 ("vou sacar uma fatia relevante do capital em até 24 meses") vetava igual para quem ia sacar 10% e para quem ia sacar 80%, sempre com Defensivo de curto prazo.

**O que mudou.**
1. **Pergunta de complemento** (`parteDoSaque`), mostrada só a quem marcou [A] no Pilar 3: "Que parte do dinheiro que você vai investir aqui você prevê sacar nesses 24 meses?" ([A] mais da metade; [B] de um quarto até a metade; [C] menos de um quarto). A maioria continua com 14 perguntas; quem marca o saque responde 15. A contagem "Pergunta X de N" já considera isso.
2. **Regras do motor** (`VERSAO_MOTOR` 2026.10.12-D83): [A] mantém o veto (Defensivo, curto); [B] não veta, vetor pela capacidade e prazo curto (liquidez de 45% a 50%); [C] não veta e usa no máximo o prazo médio. Regras registradas: `prazo:saque-medio-24-meses` e `prazo:saque-pequeno-24-meses`. Sem a resposta, comportamento anterior (veta).
3. **Compatibilidade.** Campo opcional na API (letra a/b/c validada); estados salvos antigos continuam completos sem ele. Resposta de pergunta que deixou de aparecer (a pessoa voltou e mudou o Pilar 3) é descartada. O hook `useQuestionario` ganhou perguntas condicionais e opcionais.

**Parâmetros de produto escolhidos pelo assistente** (a revisar pelo responsável e pelo parecer independente, D22): os cortes de um quarto e da metade e o efeito de cada faixa. A justificativa do corte na metade é a liquidez dos modelos de curto prazo (45% a 50%); a do prazo médio para menos de um quarto, a mesma do Pilar 3 [B].

**Limites.** O veto continua binário nos Pilares 1 e 2. O texto do site diz "14 perguntas" (a FAQ da página do teste cita a exceção); a página inicial e o app mantêm 14. A pergunta mede a intenção declarada, não confere o valor.

**Testes.** `engineD83.test.ts` (8), `validacaoApi.test.ts` (3), três fluxos em `useAppState.test.ts` e três do hook em `useQuestionario.test.ts`. **Mutação:** 4 defeitos (veto ignorando a parte, faixa [C], faixa [B], resposta oculta vazando), todos pegos.

## D84 (12/10/2026): "passivo em dólar" sai da opção [A] do Pilar 2

**Contexto.** Decisão 2 da D78, na forma mais simples. A opção [A] do Pilar 2 dizia "dívidas caras (cartão, cheque especial, empréstimo pessoal) **ou passivos em dólar**" e vetava. Dívida cara pede liquidez e quitação; passivo em dólar, muitas vezes, pede o contrário: ter parte do patrimônio em dólar (BDRs e fundos internacionais) como proteção natural. Quem devia em dólar era empurrado para o Defensivo, a carteira com menos exposição ao dólar.

**O que mudou.**
1. **Texto das opções** (`perguntasArquitetura.ts`, `docs/02`): [A] fica "Possuo dívidas caras (cartão, cheque especial, empréstimo pessoal)"; [B] passa a incluir "ou compromissos em dólar já controlados", para quem deve em dólar não ter que marcar [C] ("zero dívidas"). Mensagem do veto: "você tem dívida cara".
2. **Ponte com o Meu Mês** (`ehDividaCaraParaOPilar2`): a dívida em dólar anotada no Meu Mês, sozinha, passa a sugerir [B], e não [A]; com juros a partir de 3% ao mês continua sendo [A]. A explicação da sugestão cita o dólar no [B].
3. **Nada mudou no motor**: o veto é o mesmo, então `VERSAO_MOTOR` segue em 2026.10.12-D83.

**Não mudou (a decidir).** O Modo Recuperação do Meu Mês continua ligando por dívida em dólar (`TIPOS_DE_DIVIDA.dolar.cara`, `ehDividaCara`): a pessoa anotou uma dívida e o plano de quitação segue sendo útil. Se o responsável preferir que o dólar também deixe de ligar o Modo Recuperação, é uma linha em `recuperacao.ts`, com impacto nos testes do Meu Mês.

**Limites.** Quem já respondeu [A] por causa do dólar segue vetado até refazer o questionário. O motor não passa a aumentar a exposição ao dólar para quem deve em dólar: só deixa de vetar.

**Testes.** 2 novos (`recuperacao.test.ts`, `ponteQuestionario.test.ts`); 2 ajustados (texto do veto). **Mutação:** a regra do dólar removida derruba os 2.

## D85 (13/10/2026): proteção da API e do site, etapa 1

**Contexto.** O responsável pediu para proteger o app a partir da pendência "restringir `ALLOWED_ORIGIN`" (docs/06, seção 2). Levantamento no ar: as quatro famílias de função respondiam `Access-Control-Allow-Origin: *` (qualquer site podia chamar a API pelo navegador dos visitantes); o `/api/evento` não tinha limite (as métricas podiam ser inflacionadas); o token do painel era comparado com `!==` e sem limite de tentativas; a página não tinha cabeçalhos de segurança além do HSTS da Vercel. Já estavam bem: repositório privado, `npm audit` sem vulnerabilidades, nenhum segredo no código, limite por IP na recomendação e no Top 15.

**O que mudou.**
1. **Origens (`api/_cors.ts`):** a lista padrão passa a ser o domínio definitivo (`https://carteiraideal.app.br` e `https://www.carteiraideal.app.br`), sem precisar de variável. `ALLOWED_ORIGIN`, se existir, substitui a lista (várias separadas por vírgula; `*` vale, de forma explícita). Requisição de navegador com `Origin` fora da lista recebe **403** (inclusive no preflight), sem cabeçalho CORS. Sem `Origin` (curl, servidor) segue. Vale para `recomendacao`, `evento` e as três funções do Top 15.
2. **Limite no `/api/evento`:** 300 por IP a cada 15 minutos (hash do IP com sal, mesmo Redis ou memória); acima disso o evento é descartado em silêncio (204), porque contar nunca devolve erro ao navegador.
3. **Token do painel (`/api/metricas`):** comparação em tempo constante (hash + `timingSafeEqual`) e limite de 30 tentativas por IP a cada 15 minutos (429, inclusive com o token certo, até a janela vencer).
4. **Cabeçalhos de segurança** em `vercel.json`, para todas as rotas: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` e `Permissions-Policy` sem câmera, microfone, geolocalização, pagamento e USB (o app não usa nenhum; o ditado do Supermercado é o do teclado).

**Limites, ditos com franqueza.** CORS protege o navegador do visitante, não o servidor: quem chama a API fora de um navegador não é barrado por isto, e o que o limita é o limite por IP (60 por 15 minutos na recomendação), o código do Top 15 e o token do painel. Em redes de celular o IP é compartilhado. Fica **para a etapa 2**: `Content-Security-Policy` (exige inventário de scripts, estilos e fontes do site e das páginas geradas), Vercel (Spend Management, WAF/Bot Protection do plano), 2FA e proteção da `main` no GitHub, `dados-privados/` fora do repositório se ele um dia deixar de ser privado, e testes automáticos do restante da API.

**Testes.** `scripts/api-protecao.test.mjs` (7): origens padrão e por variável, origens parecidas barradas, 403 em recomendação e evento, token errado de qualquer tamanho, 429 após 30 tentativas. **Mutação:** 3 defeitos (CORS sem barrar, limite do painel, CORS do evento), todos pegos.

**Complemento da D85 (14/10/2026): configuração feita no painel da Vercel, que não está no repositório.**
1. **Regra de limite na borda (WAF Rate Limiting, plano Hobby: 1 regra por projeto).** Nome "Limite da API"; condição *Request Path* começa com `/api/`; *Fixed Window* de 60 s, **120 requisições por IP**; ação padrão 429. Publicada pelo responsável. **Testada no ar:** 115 requisições seguidas a `/api/evento` (abaixo do limite) passaram todas; 250 logo em seguida deram 1 passagem e **249 respostas 429** com `X-Vercel-Mitigated: deny`; passada a janela de 60 s, `/api/recomendacao` voltou a 200 e a página `/app/` ficou intacta durante o teste. O bloqueio acontece antes da função, então não gasta execução. A contagem da Vercel é por região; o limite do código (60 em 15 minutos na recomendação) segue valendo por baixo.
2. **Bot Protection (managed ruleset, todos os planos): ativado em `Log`** pelo responsável. Em `Log` só registra o que seria tratado como robô. **Decidir depois de cerca de 7 dias:** olhar a tela Firewall e, se só aparecerem scripts e scanners (e não o Googlebot nem o navegador interno do Instagram), passar para `Challenge`. Não criar desafio só para `/api/*`: a API só aceita chamadas feitas depois de o navegador ter uma sessão de desafio, e o app quebraria.
3. **Spend Management não existe no plano Hobby** (só Pro e Enterprise). No Hobby os limites são fixos; acompanhar em Usage e deixar as notificações de uso ligadas. Se migrar para o Pro (gatilhos da D22), ligar Spend Management com `Pause Production Deployments`.
4. **Contas (fora do código):** o responsável informou em 14/10/2026 que **ativou o 2FA** (a lista de quais contas não foi detalhada; a recomendada era GitHub, Registro.br, Vercel, Upstash, e-mail e Instagram). **Pendentes:** conferir se todas as contas da lista estão cobertas e guardar os códigos de recuperação fora do computador; Dependabot alerts (gratuito em repositório privado).
5. **Ruleset da `main` (14/10/2026): criado, mas NÃO é aplicado.** O responsável criou o ruleset `proteger-main` (alvo: branch padrão; regras: restringir exclusões e bloquear force push; sem pull request, sem status check e sem "restringir atualizações", porque os jobs de dados e os envios vão direto na `main`). O GitHub avisou na tela que, em repositório privado, ele só é aplicado em conta paga, e a API confirmou: `GET /repos/.../rulesets` e `/rules/branches/main` respondem **403 "Upgrade to GitHub Pro or make this repository public"**. Ou seja, **a `main` não está protegida contra exclusão nem force push no plano gratuito**; o ruleset passa a valer sozinho se a conta migrar para o GitHub Pro (cerca de US$ 4 por mês; confirmar na página de planos, porque a tela cita "Team" e a API cita "Pro"). Risco aceito por ora: repositório privado, uso individual, 2FA ativo e a regra de trabalho de nunca usar `--force`. **Não** tornar o repositório público para obter a proteção: ele guarda `dados-privados/`.

## D86 (13/10/2026): Content-Security-Policy (fase 1 só relatou; fase 2 já bloqueia)

**Contexto.** Etapa 2 da proteção (D85). Inventário do site montado (40 páginas HTML): nenhuma página carrega script, estilo ou fonte de outro domínio; as chamadas de rede do app são só `/api/recomendacao` e `/api/evento` (o painel usa `/api/metricas`); o Vercel Web Analytics vem de `/_vercel/insights/script.js` (mesmo domínio); o único conteúdo de terceiros embutido é o vídeo do YouTube (`iframe`) das aulas; imagens e fontes são do próprio site ou `data:`; o app é um arquivo único com **script inline de 1,7 MB** (`vite-plugin-singlefile`), mais 5 scripts inline pequenos (tema claro/escuro e o painel); não há `eval` nem `dangerouslySetInnerHTML`.

**O que entrou (`vercel.json`).** Cabeçalho `Content-Security-Policy-Report-Only` em todas as rotas: `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data:`; `font-src 'self' data:`; `connect-src 'self'`; `frame-src` só YouTube; `worker-src 'self' blob: data:`; `manifest-src 'self'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'self'`. Em modo "só relata" o navegador registra no console o que a política bloquearia, sem bloquear nada. O teste `scripts/csp.test.mjs` trava a política (sem curinga, sem `unsafe-eval`, só YouTube em quadro, sem recurso externo nas páginas-fonte).

**Fases seguintes.** (2) Conferir no ar, página por página, que nenhuma violação aparece (landing, app com o questionário, Meu Mês, Aprender com vídeo, Minha Carteira com importação de PDF, painel) e trocar para `Content-Security-Policy` (bloqueia). (3) Trocar `'unsafe-inline'` do `script-src` por **hashes** calculados no build (os cinco scripts pequenos são fixos; o do app muda a cada build, então os hashes entram numa `<meta>` injetada por `build-site.mjs`, e o cabeçalho passa a ser a interseção das duas).

**Limite.** Com `'unsafe-inline'` nos scripts, a política **ainda não impede** um script inline injetado; o ganho da fase 1 é impedir que a página fale com outros domínios, carregue plugins ou seja embutida em outro site. O ganho contra injeção de script só vem na fase 3. Hoje não há ponto de injeção conhecido (React escapa o texto; nada usa `innerHTML`).

**Fase 2 (13/10/2026): bloqueando.** A fase 1 ficou no ar em modo "só relata" e foi conferida no navegador, página por página, com o console aberto: landing, questionário completo até o resultado, Meu Mês (as duas abas), Aprender com aula em vídeo do YouTube, Simule FII e Tesouro, Minha Carteira com importação de CSV, Privacidade, painel e uma página de guia. **Nenhuma violação.** (O método foi validado provocando uma violação de propósito, que o console registrou.) O cabeçalho passou a `Content-Security-Policy`. Não testado diretamente: o navegador interno do Instagram e o painel autenticado. Se algo quebrar, voltar a chave para `Content-Security-Policy-Report-Only` em `vercel.json` (um commit). Observação sem relação com a CSP: `/favicon.ico` responde 404.

## D87 (13/10/2026): CSP, fase 3: scripts inline só por hash

**Contexto.** Fase 3 da D86. O cabeçalho da Vercel é estático e dizia `script-src 'self' 'unsafe-inline'`, o que não impede um script inline injetado. Não dá para pôr hash no cabeçalho porque o app é um arquivo único com um script inline de ~1,7 MB que muda a cada build.

**O que mudou.**
1. **Meta de CSP por página** (`scripts/csp-hashes.mjs`, chamado por `build-site.mjs` como último passo): cada HTML publicado recebe `<meta http-equiv="Content-Security-Policy">` com `script-src 'self'` + o sha256 de cada script inline que ele tem, e `script-src-attr 'none'`. Entra logo depois de `<meta charset>`, antes de qualquer script. Com o cabeçalho e a meta valendo juntos, o navegador exige passar nas duas: script ou handler inline que não esteja na lista de hashes é bloqueado. O cabeçalho continua com `'unsafe-inline'` (é ele que deixa a meta decidir).
2. **Build falha, em vez de publicar página quebrada:** se algum HTML tiver atributo de evento inline (`onclick=`...) ou URL `javascript:`, ou se um hash não bater na conferência pós-injeção. O arquivo de verificação do Google (sem `<head>`) não é tocado e sai idêntico.
3. **Landing:** o botão de tema deixou de usar `onclick="toggleMode()"`; o clique é ligado em `script.js` (`addEventListener`). Era o único handler inline do site.

**Conferido** (build local, servido em `localhost`, no navegador): o app renderiza com o script de 1,7 MB liberado por hash; um `<script>` inline injetado e um `onclick` injetado foram **bloqueados** (`script-src-elem` e `script-src-attr`, `enforce`); o botão de tema da landing funciona; painel e página de guia sem violações. 40 páginas protegidas.

**Limites.** (a) A proteção contra script inline vale só para navegadores que respeitam `<meta>` CSP (todos os atuais); a `<meta>` não aceita `frame-ancestors` nem relatório, que continuam no cabeçalho. (b) `style-src 'unsafe-inline'` fica (o React usa atributos `style`); estilo injetado não executa código. (c) Um novo script inline entra sozinho na lista a cada build, mas um novo **atributo de evento** faz o build falhar: usar `addEventListener`. (d) O que o responsável publicar fora deste build (um HTML colado à mão no `dist-site`) não ganha a meta.

**Testes.** `scripts/csp-hashes.test.mjs` (10): só scripts executáveis entram, hash exato, `unsafe-inline` ausente, posição da meta, idempotência, handler/`javascript:` derrubam o build, arquivo do Google intacto. **Mutação:** 3 defeitos (`unsafe-inline` na meta, proibição ignorada, script com `src` contado), todos pegos.

## D88 (14/10/2026): testes automáticos do contrato de `/api/recomendacao`

**Contexto.** A API era verificada só à mão e pela validação do payload (`validacaoApi.test.ts`). Último item técnico da lista de proteção (D85).

**O que entrou** (`scripts/api-recomendacao.test.mjs`, 11 testes, rodam no `npm test` e no workflow "Verificar"): o handler real, chamado com requisição e resposta simuladas, sem Redis.
1. **200:** carteira soma 100 e sem classe negativa; `versaoMotor` no formato esperado; `alertas` e `regrasAcionadas` em lista; determinismo (mesmo corpo, mesma resposta); sem as perguntas da arquitetura, calcula só pelo suitability.
2. **Contrato da resposta:** só os campos conhecidos; nenhum nome de matriz ou parâmetro interno vaza no JSON (a API existe para o motor não ficar no navegador).
3. **Veto:** reserva curta leva ao Defensivo, prazo no máximo médio e até 20% em risco; o Pilar 3 [A] veta sem `parteDoSaque` ou com [A] e não veta com [B] e [C].
4. **405** para GET, PUT, DELETE e PATCH; `OPTIONS` responde 204.
5. **400** em 11 formas de payload inválido, sempre com `{ erro }` e sem detalhe interno.
6. **429:** 60 chamadas por IP passam e a 61ª recebe 429 com `Retry-After: 900`; o limite vem antes da validação; outro IP não é afetado; vale o primeiro IP do `x-forwarded-for`.
7. **CORS:** sem `Origin` não há cabeçalho de origem; a do próprio site é ecoada.

**Mutação:** 4 defeitos (checagem de método removida, limite desligado, validação desligada, limite de 60 para 70), todos pegos.

**Não coberto:** o caminho 500 (erro interno do motor), porque a validação impede entradas que o façam falhar; e o comportamento do limite com Redis ligado (usa o mesmo contador, testado em `recomendacao-limite.test.mjs`).

## D89 (15/10/2026): Top 15 atualizados todo dia útil, com a auditoria completa só uma vez por mês

**Contexto.** O responsável abriu os Top 15 e viu data e preço velhos: a posição no ranking não batia com o preço que a pessoa via no app. Causa: os preços eram diários, mas os rankings só eram recalculados uma vez por mês (ações no dia 2, FIIs baratos no dia 21, mais negociados, BDRs e índices no dia 22). "Barato" é uma razão em que o preço está no denominador; com o preço congelado no dia do cálculo, quem subiu continuava "mais barato" e quem caiu não entrava.

**Decisão do responsável (15/10/2026).** Atualizar todos os Top 15 **todo dia útil**, com a **conferência** do cálculo mantida a cada execução e a **auditoria completa só uma vez por mês**. Motivo da auditoria mensal: a pasta completa (insumos, memória de cálculo, CSVs) em 250 pastas por ano por classe inchariam o repositório sem acrescentar prova; o que protege a cada dia é a conferência antes de publicar, não a pasta.

**O que mudou** (nenhuma fórmula, filtro, parâmetro ou `versaoMetodologia`):
1. **`scripts/auditoria-diaria.mjs` (novo, módulo puro).** `decidirModo` escolhe entre **completa** (primeira execução do mês; hash da config mudou; hash do código de cálculo mudou; `--completa`; sem auditoria anterior) e **diária**. A data usada é a de execução (a pasta das ações leva o nome do último pregão, que pode ser do mês anterior). `conferirEmMemoria` grava e relê insumos e config (como a verificação por arquivo faria), refaz o cálculo do zero e compara os três hashes.
2. **Mais negociados, BDRs com desconto, IFIX e Ibovespa** (`atualizar-top15-mercado.mjs`): `concluir` ganhou `diaria`/`forcarCompleta`; o CLI é diário por padrão e aceita `--completa`. Na execução diária não grava pasta nem mexe em `ultima.json`; o cabeçalho público leva a impressão digital do dia e aponta para a pasta do mês.
3. **FIIs baratos** (`atualizar-fii-baratos.mjs`): na execução diária lê os **insumos congelados** da pasta do mês (informe da CVM) e troca preço diário (`historico/fiis.json`), cotação, volume, nome e segmento (`atualizarPrecosDosInsumos`). Sem rede e sem baixar a CVM.
4. **Ações baratas** (`atualizar-acoes-baratas.mjs`): na execução diária lê as demonstrações congeladas da pasta do mês e troca só o bloco de preço de cada empresa (`atualizarPrecosDosInsumos`). `--data-corte` manual força a completa. `ultima.json` passou a gravar `dataExecucao`.
5. **Workflows:** os três passam a rodar de terça a sábado em UTC (segunda a sexta, no horário de Brasília): mais negociados e afins às 23h30, FIIs baratos às 23h45, ações baratas à 00h; a execução manual ganhou a opção "auditoria completa". Os cinco jobs de preço rodam antes.
6. **App:** o cabeçalho público ganhou `modoAuditoria` e `auditoriaCompletaEm`; na seção "Auditoria e verificação" de cada tela, a execução diária explica que o ranking é do dia, conferido por um segundo cálculo, e que a pasta completa é mensal (com a data). Arquivos antigos, sem os campos, mostram o texto de sempre. A data visível ("Pregões até", "Preços de", "Cotações até") continua sendo a do último pregão.

**Se algo falhar.** Conferência divergente, trava de sanidade ou B3 fora do ar (só índices): o job termina com erro e e-mail, e o app fica como estava. Faltando o histórico de preço ou o arquivo congelado, a execução cai sozinha para a completa.

**Testes.** `scripts/auditoria-diaria.test.mjs` (21) e `webapp-src/src/domain/auditoriaDiaria.test.ts` + 1 caso em `Top15MaisNegociados.test.tsx`. Fixam: a regra de decisão e seus cinco gatilhos; que "informe/demonstração congelado + preço do dia" produz **exatamente** os insumos da execução completa com os mesmos dados; o ranking acompanhando o preço do dia (FIIs e mais negociados); nenhuma pasta nova e `ultima.json` intacto; a pasta do mês continua verificável; a trava de sanidade vale no modo diário. **Mutação:** 9 defeitos (virada de mês, hash da config, hash do código, conferência do resultado, `--completa`, preço do FII, preço das ações, modo diário desligado, data da pasta no cabeçalho), todos pegos; 1 mutante equivalente, descartado.

**Limites.** (a) Balanços novos (ITR/DFP) e o informe mensal da CVM só entram na primeira execução do mês seguinte, o mesmo ritmo de antes. (b) A impressão digital mostrada é a do dia; o comando de verificação da tela confere a pasta do mês (a tela diz isso). (c) Em feriado da B3 o ranking é recalculado com o mesmo pregão (a data visível não muda). (d) Aumenta o número de commits de dados (3 a mais por dia útil) e de deploys na Vercel.

## D90 (16/10/2026): tema claro, contorno preto fino em todo texto amarelo

**Contexto.** O responsável pediu uma análise do app inteiro no tema claro e ajustes que não prejudicassem a leitura, com o exemplo de um contorno preto fino em todo texto amarelo. Desde a D89 o código e a cotação dos cards do Top 15 são amarelos (`var(--accent)`), e no tema claro o amarelo sobre fundo branco quase some.

**Levantamento.** Texto amarelo no app vem só de duas cores: `--accent` (amarelo da marca) e `--warning` (âmbar de alerta), usadas em classes do `index.css` (`.tab.active`, `.trilha-badge`, `.badge-media`, `.perfil-badge.Moderado` e `.Equilibrado`, `.mc-selo.faltaSaldoAnterior`, `.mc-chip-situacao.abaixo`) e em estilos inline das telas (cartões e cotações dos simuladores e dos Top 15, resultado dos comparativos, avisos, ícones). Fundo amarelo com texto escuro (botões, opção marcada) já tem contraste e não muda. Letra amarela dentro de selo escuro (`.quiz-option.selected` letra e etiqueta) também não.

**O que mudou** (só `index.css`, só `data-theme='light'`; o tema escuro e os dados não mudam):
1. `-webkit-text-stroke: 1.1px #111` com `paint-order: stroke fill`: o contorno fica por fora das letras e o miolo amarelo não afina. Navegador sem `paint-order` cai num anel de `text-shadow` de 0,6px.
2. A regra vale para as classes acima e para **qualquer** estilo inline `color: var(--accent)` ou `var(--warning)` (seletores de atributo), então telas novas já entram sozinhas. Ícones SVG nessas cores recebem `drop-shadow` equivalente.
3. O contorno é herdado; texto auxiliar `.muted` dentro de um trecho amarelo volta ao normal.

**Conferido no navegador** (tema claro, localhost): Simule FII (cartão do fundo e Top 15 mais negociados), carro, questionário completo e uma varredura de cor em 13 telas e no questionário (Simule FII, Ações, Tesouro, BDR, ETF, Ativos, Bens, Carro, Imóvel, Moto, Meu Mês, Minha Carteira e Aprender): nenhum texto amarelo ficou sem contorno. **Não conferido:** a tela de resultado (a API não roda no servidor local) e as listas com código (Top 15 de ações, FIIs baratos e BDRs com desconto), cujo cartão usa o mesmo estilo dos demais; páginas estáticas do site (landing, guias), que têm CSS próprio.

**Testes.** `scripts/contorno-amarelo.test.mjs` (4): toda classe do `index.css` com texto amarelo está na lista do contorno (exceção explícita para letra amarela em selo escuro), os seletores inline existem nas duas posições, o contorno é preto, fino e só no tema claro. **Mutação:** 4 defeitos (classe tirada da lista, seletor inline do `--warning` tirado, contorno fora do tema claro, classe nova amarela sem contorno), todos pegos (a primeira rodada deixou passar um, por comparação por trecho de texto; corrigido para comparar o seletor inteiro).

**Limites.** O contorno herdado pode aparecer em texto colorido aninhado dentro de um trecho amarelo (só tratei o `.muted`). `--mc-ouro` (dourado escuro do Minha Carteira) já tinha contraste e ficou como estava. Quem escrever amarelo em outro formato (cor hexadecimal, `rgb`) não é pego pelo seletor inline; o teste cobre só `--accent` e `--warning`.

**Complemento da D90 (16/10/2026): logo.** No tema claro, o anel amarelo da logo também ganhou o contorno preto fino por fora (`drop-shadow` de 0,6 a 0,8 px, duas vezes): na logo do app (`.marca-logo`, `index.css`), na da landing (`.light #profile img`, `style.css`) e nas das páginas geradas (`:root.light .marca img`, `paginas.css`). Os arquivos `logo-mark.svg` e `favicon.svg` não mudaram. Conferido no navegador só a logo do app (computador); landing e páginas geradas não foram abertas.

## D91 (16/10/2026): divulgação mensal dos Top 15 (texto pronto para o Instagram, sem postar)

**Contexto.** A ideia "divulgação mensal automática do ranking" estava nas próximas ideias. Os rankings mudam todo dia útil (D89), então a divulgação é uma foto datada ("até 15/10").

**O que foi feito.** `scripts/gerar-divulgacao.mjs` lê só os arquivos públicos do app (`webapp-src/src/data`), sem rede, e grava `divulgacao/AAAA-MM/` com três textos: (1) carrossel dos mais negociados (ações, FIIs, ETFs e BDRs); (2) carrossel dos 15 maiores pesos do Ibovespa e do IFIX, com o peso de cada posição; (3) chamada das listas com código (ações baratas, FIIs baratos e BDRs com desconto), **sem nenhum ativo**. Workflow "Gerar divulgação mensal" (`.github/workflows/gerar-divulgacao.yml`): dia 2 de cada mês, 12h UTC, e sob demanda; faz commit só da pasta `divulgacao/`.

**Decisões.** (1) **Não posta sozinho:** o responsável lê e publica. Postar exigiria conta comercial ligada à Meta e um token guardado, e publicaria sem leitura humana. (2) Todo texto leva o aviso de que não é recomendação (nos slides e na legenda). (3) A instrução de como pedir o código fica entre colchetes (`[instrução definida pelo responsável]`) até ele definir.

**Travas (o script para com erro):** ranking não publicado; lista com tamanho diferente de 15 ou com ativo repetido; ranking com código marcado como aberto; ranking com código que traga lista no arquivo público (vazaria o que o código protege).

**Testes.** `scripts/gerar-divulgacao.test.mjs` (10). **Mutação:** 12 defeitos introduzidos (cada trava, o formato do percentual, ativo no post das listas com código e o aviso removido de cada slide e legenda); 2 passaram na primeira rodada (aviso só no slide ou só na legenda, porque o teste olhava o texto inteiro) e agora o teste confere os dois; todos são pegos. Um defeito (tirar a trava final que procura a frase do aviso) é equivalente: o aviso vem do mesmo texto fixo, e o teste cobre.

**Limites.** O texto sai de dados do dia do job, não do dia da publicação: se o responsável postar dias depois, as datas ("até 15/10") continuam corretas, mas a lista pode ter mudado. Sem imagens: só o texto de cada slide. O parecer independente da D22 continua pendente para ampliar o alcance.

## D92 (16/10/2026): `@vercel/node` removido (só fornecia dois tipos) e alertas do Dependabot

**Contexto.** Três execuções do Dependabot falharam (`tar`, `undici`, `@fastify/busboy`): as três vinham de `@vercel/node`, e a única atualização automática rebaixaria o pacote. `npm audit` listava 17 alertas (1 crítico, 14 altos). O pacote era usado só em `import type { VercelRequest, VercelResponse }` nas quatro funções da API.

**Tentativa descartada.** Subir `@vercel/node` para a 24.0.2 (a "correção" que o `npm audit` sugere) não resolvia: continuava com `@fastify/busboy` e `path-to-regexp` vulneráveis e mexia em quase 6 mil linhas do `package-lock.json`.

**O que mudou.** `api/_tipos.ts` (novo) declara os dois tipos com o que as funções usam (`IncomingMessage` e `ServerResponse` do Node, mais `query`, `body`, `status()` e `json()`); as quatro funções importam de lá; `@vercel/node` saiu do `package.json`. Arquivo com `_` no nome não vira função na Vercel. Mais `source-map-js` 1.2.1 → 1.2.2 (`npm update`). Nenhuma linha de lógica mudou.

**Resultado.** Alertas do `npm audit`: 17 → 3 (os 3 restantes são `braces`, `micromatch` e `vite-plugin-singlefile`, só na montagem do site, sem ir para o navegador nem para a API; o "conserto" sugerido é rebaixar o plugin para a 0.9.0, que não adotei). `tsc -b` limpo, 1.626 testes do app e 433 de scripts passando, `npm run build` ok.

**Limites.** Se uma função passar a usar outro campo do pedido ou da resposta, o `tsc -b` avisa e o tipo é ampliado em `api/_tipos.ts`. O Dependabot pode ainda abrir pull requests para os 3 alertas restantes. `npm audit fix` quebra neste projeto (erro interno do npm: `edgesOut`), por isso o ajuste do `source-map-js` foi por `npm update`. **Ainda não conferido no ar:** o deploy da Vercel com a API sem o pacote (os tipos somem na compilação, mas só a produção confirma).

## D93 (17/10/2026): trava de sanidade do IFIX e do Ibovespa aceita a carteira do próximo pregão

**Contexto.** No primeiro run agendado de sexta para sábado depois da D89, o job "Atualizar Top 15 ETFs e BDRs" terminou em **falha** (run `39012441704`, 17/10/2026): `a carteira é de 2026-10-19, -2 dias antes da execução (máximo 10): carteira desatualizada`. Os outros cinco rankings foram calculados e publicados normalmente (em modo diário, com a conferência independente OK); só o IFIX e o Ibovespa falharam, e o job terminou vermelho de propósito (e-mail).

**Causa.** A API da B3 (`GetPortfolioDay`) devolve a carteira do **próximo pregão**. Na noite de sexta (execução já no sábado, em UTC), no fim de semana e antes de feriado, a data é futura. A trava de sanidade da D72 tratava qualquer data futura como carteira desatualizada, o que nunca apareceu porque o job rodava uma vez por mês (D89 o tornou diário). Defeito meu, de desenho: a D89 mudou a frequência sem rever as travas que dependem do calendário.

**Decisão.** Novo parâmetro `publicacao.sanidade.antecedenciaMaximaDias = 4` em `config/top15-ifix.json` e `config/top15-ibov.json` (versão **1.1.1** de cada um): a trava aceita carteira de até 4 dias à frente da execução (cobre o fim de semana, 3 dias, e um feriado emendado, 4). Mais que isso, ou mais de 10 dias no passado, continua barrando. Sem o parâmetro vale 0 (comportamento antigo). A regra de ordenação, os pesos e o resto da trava não mudaram.

**Efeito esperado.** O IFIX e o Ibovespa voltam a ser publicados todo dia útil, inclusive na noite de sexta. Como o código de cálculo e o config mudam, a primeira execução depois do envio grava a auditoria **completa** de todos os rankings de índice (e a dos demais, porque o hash do arquivo de cálculo muda); depois voltam ao modo diário.

**Testes.** `top15-mercado.test.mjs`: caso novo da D93 (execução em 17/10 com carteira de 19/10 passa; 1 e 4 dias à frente passam; 5 dias à frente barra com mensagem própria; o limite de 10 dias no passado não mudou), o teste antigo ficou como "sem antecedência configurada, data futura barra" e o teste de configuração fixa versão 1.1.1 e `antecedenciaMaximaDias = 4` nos dois índices. **Mutação:** 4 defeitos (ignorar a antecedência, aceitar qualquer data futura, tolerância de 1 dia a mais, ignorar o valor da config), todos pegos. Suíte de scripts: 434 passam.

**Para acompanhar.** Na próxima sexta à noite (ou no primeiro run agendado depois do envio) o job deve terminar verde. O run vermelho de 17/10 não precisa ser refeito: o IFIX e o Ibovespa ficaram com o ranking de 16/10, que continua válido até o próximo pregão.
## D94 (17/10/2026): Top 15 empresas mais endividadas (dívida líquida ÷ EBITDA), aberto, publicado

**Pedido do responsável (17/10/2026).** Um novo ranking: as empresas mais endividadas. Decisões dele, por pergunta: medida = **dívida líquida ÷ EBITDA**; universo = **o mesmo das ações baratas**; acesso = **aberto, sem código**; tela = **nova aba no Simule Ações, atualizada todo dia útil**. Ele esclareceu que a lista é de **empresas** (uma linha por empresa, que o cadastro já garante: um código por empresa).

**Desenho.** Reaproveita ao máximo as ações baratas, para a mesma empresa ter o mesmo número nas duas listas:
1. **Config** `config/acoes-endividadas.json` (v1.0.0): só os parâmetros próprios (tamanho da lista, critério, trava de sanidade, aviso). Universo, liquidez e leitura contábil são os de `config/acoes-baratas.json`, e uma mudança lá exige subir a versão aqui.
2. **Cálculo puro** `scripts/acoes-endividadas-calculo.mjs`: usa `calcularFundamentos` das ações baratas. Diferenças de propósito: **sem** filtro de lucro positivo e de volatilidade, e **sem** a verificação "caixa operacional ≤ 2× o EBITDA". Esta última protege o indicador caixa operacional ÷ EV, que não é usado aqui, e na primeira rodada derrubava **AMER3, BHIA3, MGLU3 e SAPR11**, justamente empresas bem endividadas; as demais verificações de integridade valem. Caixa maior que a dívida e EBITDA não calculável saem com motivo. **Dívida líquida positiva com EBITDA zero ou negativo** vai para a lista **"sem EBITDA positivo"**, fora da ordem numérica (a razão não existe).
3. **Job** `scripts/atualizar-acoes-endividadas.mjs` + verificador `scripts/acoes-endividadas-verificar.mjs` + workflow `atualizar-acoes-endividadas.yml` (terça a sábado 03h30 UTC, depois das ações baratas): sem rede. Parte dos **insumos congelados** das ações baratas, troca só o preço, e segue a D89 (auditoria completa só na primeira execução do mês, ou se mudarem os parâmetros, o código de cálculo, ou a **auditoria de origem**; nos outros dias, conferência independente em memória). Para isso `decidirModo` ganhou `origemAtual` (a lista fica velha quando as ações baratas regravam a auditoria dela, com balanços novos).
4. **App:** aba "Top 15 mais endividadas" (quinta aba do Simule Ações), `Top15Endividadas.tsx`: cartões com a razão, dívida líquida, EBITDA e cobertura de juros; "Como chegamos nesse número" com cada conta da CVM; lista à parte sem EBITDA positivo; "Por que uma empresa ficou de fora?" (inclui quem está do 16º em diante); auditoria e aviso. Código e cotação em amarelo (D90).
5. **Docs:** `docs/12-metodologia-acoes-endividadas.md`.

**Primeira rodada (preços de 16/10/2026, balanços de 05/10).** Universo 226, 129 avaliadas, 109 no ranking, nenhuma sem EBITDA positivo. Top 15: AGRO3 (35,3x), AMER3 (24,2x), HBOR3 (11,6x), ONCO3 (9,7x), LOGG3 (8,6x), BRKM5, AURE3, TTEN3, CAML3, ROMI3, ECOR3, EQTL3, TAEE11, TUPY3 e ORVR3. Verificação independente OK.

**Publicação.** `aprovadoPeloResponsavel` começou `false` (regra do projeto: o responsável aprova cada lista; D22 pede parecer independente antes de divulgar em escala). **Aprovada pelo responsável em 17/10/2026**, no mesmo dia, com acesso aberto e o aviso proposto sem alterações: `true` na versão 1.1.0 (`publicacao.aprovacao`; nenhuma regra de cálculo mudou), sem parecer independente de terceiros. O primeiro run depois da aprovação grava a auditoria completa (o config mudou) e publica a lista.

**Testes.** `scripts/acoes-endividadas.test.mjs` (23): conta feita à mão (A 100÷120, B 600÷150, C 300÷100), sinal da depreciação, desempate, cada exclusão, o que NÃO se aplica (prejuízo, volatilidade, FCO muito acima do EBITDA), lista sem EBITDA positivo, sanidade, auditoria, adulteração de arquivo, de insumo e de config, modo diário com preço novo (valor de mercado muda, razão não), os gatilhos da auditoria completa (virada de mês, parâmetros desta lista e das ações baratas, código de cálculo, insumos de origem, `--completa`), publicação com e sem aprovação, trava de sanidade. Web: `Top15Endividadas.test.tsx` (13) + três testes existentes ajustados para cinco abas. **Mutação:** 15 defeitos no script (filtro do FCO reaplicado, ordem crescente, caixa líquido aceito, tudo no ranking, sem desempate, setor financeiro, liquidez, EBITDA nulo, lista sem EBITDA, sanidade, origem dos insumos, data da pasta, restante, trava na publicação, publica sem aprovação) e 6 na tela, todos pegos; 2 mutantes equivalentes descartados (EBITDA zero já é barrado pela guarda da razão).

**Limites.** (a) Dívida = só empréstimos e financiamentos (inclui debêntures); arrendamentos e fornecedores não entram. (b) Não mede prazo, custo, moeda nem garantias. (c) EBITDA de 12 meses pode estar deprimido ou inflado por evento pontual. (d) Empresas sem preço recente na B3 saem com `sem_preco` (por exemplo AZUL4, JBSS3, na primeira rodada). (e) O indicador vem do balanço: só se mexe quando sai demonstração nova, embora o preço mude a lista de quem passa na liquidez. (f) O divulgador mensal (D91) ainda não inclui esta lista (decisão do responsável).
## D95 (17/10/2026): o divulgador mensal inclui o Top 15 empresas mais endividadas (post 4)

**Pedido do responsável (17/10/2026).** Depois de aprovar e publicar a lista (D94), incluir as empresas mais endividadas no divulgador mensal da D91.

**O que mudou** (`scripts/gerar-divulgacao.mjs`, nenhuma outra regra): novo arquivo `divulgacao/AAAA-MM/post-4-endividadas.md`, um carrossel separado (o tema pede ressalvas próprias, e o post 3 continua sendo o das listas com código):
1. **Conteúdo:** as 15 empresas na ordem do ranking, cada uma com a razão dívida líquida ÷ EBITDA (ex.: `1 AGRO3 (35,3x)`), com as datas dos preços e dos balanços usados, um slide de aviso e a legenda. Se houver empresas na lista à parte (dívida líquida com EBITDA zero ou negativo), um slide diz **quantas** são, sem citar o código delas.
2. **Texto de cautela fixo:** "Dívida alta não quer dizer empresa em risco: energia, saneamento e concessões convivem com dívida longa e barata. A medida não mostra prazo, custo nem moeda da dívida. Bancos e seguradoras ficam de fora." Mais o aviso curto de que não é recomendação de investimento no slide de aviso e na legenda.
3. **Travas** (o script para com erro): ranking não publicado; arquivo marcado como ranking com código (`acessoRestrito: true`; esta lista é aberta, então o código de empresa pode aparecer no texto, ao contrário das listas com código); lista que não tenha exatamente 15 empresas; empresa repetida; empresa sem a razão.
4. `mesPadrao` continua sendo o do pregão mais recente das listas de volume e de índice. O workflow "Gerar divulgação mensal" (dia 2, 9h de Brasília) passou a gerar quatro posts.

**Testes.** `gerar-divulgacao.test.mjs` passou de 10 para 12 testes (post 4 com razão, datas, cautela e slide da lista à parte; cada trava; os quatro arquivos; o arquivo público real do repositório). **Mutação:** 11 defeitos (cada trava, o formato da razão, a cautela, a numeração do slide de aviso, o singular e o plural do slide da lista à parte, o post fora da lista), todos pegos.

**Limites.** O texto sai do arquivo público do dia da geração: se a lista for retirada (`publicado: false`), a divulgação do mês para com erro, como nas demais. O responsável lê e publica; o script não posta nada.



## D96 (17/10/2026): Simule Opções (séries reais da B3 e payoff por estratégia)

**Decisão.** Novo cartão "Simule Opções" no hub Simule Ativos (`?tela=simuleOpcoes`, tela avulsa, sem questionário), com duas abas: **Séries da B3** e **Estratégias**. Descritivo e educacional: não indica operação nem ranqueia séries.

**Fontes e job.** Duas fontes oficiais da B3, sem cota e sem secret. (1) **Cadastro de instrumentos** (`InstrumentsConsolidatedFile`, CSV de 22 MB, por `arquivos.b3.com.br/api/download`, em dois passos: pede o token e baixa): dá, de cada série, ativo-objeto, tipo, **estilo (americana ou europeia)**, strike, vencimento e lote; em 16/10/2026 eram 79.545 opções em 239 ativos. (2) **COTAHIST** diário (zip de ~650 KB): último preço, negócios e volume. `scripts/atualizar-opcoes.mjs` (workflow "Atualizar Opções", terça a sábado 01h15 UTC) lê os **últimos 5 pregões** e publica `webapp-src/public/dados/opcoes.json` (~1,4 MB, em tuplas): **todos os ativos** com série que negociou na janela (161 ativos e 20.750 séries em 16/10/2026), cada série com último preço, data desse negócio e variação contra o fechamento anterior. O arquivo é carregado por `fetch` (não entra no JavaScript do app) e a CSP `connect-src 'self'` já cobre. Mesmas travas dos outros jobs: poucos ativos ou séries, ativos de controle (PETR4, VALE3, BOVA11) ausentes ou série inválida = termina com erro sem gravar. O estilo A/E **não está no COTAHIST**: vem só do cadastro, e não segue regra fixa por tipo (há calls europeias e puts americanas).

**Aba Séries.** Busca entre todos os ativos (código ou nome) e atalhos para os 12 mais negociados em opções. Tabela ordenável: ticker, tipo, modelo A/E, strike, A/I/OTM, distância do strike, último, variação, data, negócios, volume financeiro, volatilidade implícita, delta, gama e teta ($ e %). Filtros combináveis: tipo, modelo, **vários vencimentos** (com dias úteis, contados como a B3 e as plataformas: de 16/10 a 19/11/2026 são 22), **faixa de strike** (mínimo e máximo, mais atalhos de ±5%, ±10% e ±20% do preço) e "só o último pregão". Seleção de séries e botão "Criar estratégia com as selecionadas". Ficou de fora a coluna **F.M.** (formador de mercado): não achei fonte oficial gratuita e não a inventei.

**Aba Estratégias.** Compra de call, venda de call, compra de put, venda de put, venda coberta, trava de alta, trava de baixa e **séries escolhidas na tabela** (cada uma comprada ou vendida, com quantidade e preço editáveis; exige o mesmo vencimento). Ganho máximo, perda máxima, ponto de equilíbrio e débito/crédito (exatos no vencimento), gráfico de lucro e prejuízo, curva "daqui a N dias úteis" e gregas da posição. Vendas sem cobertura mostram aviso de risco (perda sem limite na call; obrigação de comprar pelo strike na put; margem de garantia).

**Ajustes pedidos depois do primeiro uso.** (1) **Preço à vista do ativo-objeto em destaque**: cartão com preço, variação do dia e data do fechamento (o job passou a guardar `dataCotacao` e `variacao` de cada ativo; ANIM3 saiu a R$ 5,10, −2,86%), e a aba Estratégias parte do preço do ativo escolhido, com strikes e prêmios de exemplo proporcionais a ele, em vez dos R$ 30 fixos. (2) **Só vencimentos dos próximos 6 meses**, aplicado no job (o arquivo caiu para 18.630 séries) e na tela. (3) **Vencimentos separados em mensais e semanais**: mensal é a terceira sexta-feira do mês, ou a quinta anterior se essa sexta for feriado da B3 (19/11/2026); botões "Só mensais" e "Só semanais". (4) **Campo de strike**: eu recriava o campo a cada número digitado, e ele perdia o foco depois do primeiro dígito; corrigido, com teste que digita em sequência. (6) **Preço à vista na mesma linha do ticker** (BOVA11 R$ 202,30 +0,45%), com os detalhes em letra menor embaixo. (7) **Controle deslizante de duas alças para a faixa de strike**, como nas plataformas de opções: cada passo anda de um strike existente para o próximo, as pontas valem "sem limite", as alças não se cruzam, e os campos de digitar, os atalhos de ±% e o controle ficam sincronizados. (5) **Voltar**: abrir as Estratégias cria uma entrada no histórico, então o "voltar" do navegador ou do celular leva às séries, e não para fora da tela; também há o botão "← Voltar às séries".

**Modelo.** Black-Scholes europeu, sem dividendos, dias úteis/252, juro de partida na Selic meta, volatilidade implícita no último preço. É **estimativa nossa**: comparado com uma plataforma do mercado, a volatilidade implícita saiu uns 10 a 15 pontos abaixo e o delta cerca de 0,01 acima (a outra usa o preço do ativo na hora do negócio e, provavelmente, outro modelo). A tela diz isso. Opções americanas podem ser exercidas antes do vencimento: o modelo é aproximação.

**Limites.** O preço é o do último negócio de cada série, não o preço atual de compra e venda. Sem corretagem, emolumentos, IR nem margem. Calendário de feriados da B3 escrito à mão em `domain/opcoes.ts` (2026 a 2028): conferir a cada ano. Volatilidade histórica do ativo fica para outra etapa (exige histórico de preços). Opções sobre índice (IBOV) e sobre futuros ficaram fora.

**Testes.** 35 de domínio (payoff, análise, Black-Scholes, gregas, volatilidade implícita, filtros, dias úteis, ordenação, busca), 20 da tela e 11 do job; hub e `?tela=` atualizados.

## D97 (17/10/2026): Top 15 maiores prêmios de opções (aba nova do Simule Opções)

**Decisão.** Terceira aba do Simule Opções, "Top 15 prêmios", que responde: **para um mesmo risco, quem paga o maior prêmio** para quem vende opção. Metodologia completa em `docs/12-metodologia-top15-premios-opcoes.md`. Descritivo e educacional, como os outros Top 15: o risco vai ao lado de cada linha (colchão, chance de exercício e volatilidade implícita), sem recomendação.

**Cálculo.** Rendimento do prêmio sobre o dinheiro travado (strike na put vendida, preço do ativo na call coberta), levado a 21 dias úteis por regra de três simples. Só séries fora ou no dinheiro (nas dentro do dinheiro, parte do preço é valor intrínseco). Só séries que negociaram no último pregão, com 10 negócios ou mais e 3 dias úteis ou mais até o vencimento. Cada linha tem "Simular": a put vendida abre as Estratégias com a série vendida, e a call coberta abre a venda coberta já preenchida.

**O que mudou no caminho (erro meu, corrigido).** A primeira versão ordenava por "prêmio por risco" (rendimento ÷ chance de exercício). Não serve: o prêmio cai mais rápido que o risco quando o strike se afasta, então a razão sempre favorece as opções perto do preço e não mede "pouco risco por muito prêmio". Trocou-se por um **limite de risco escolhido pela pessoa** (chance máxima de exercício: 10%, 15%, 25%, 40% ou sem limite; padrão 25%), e o ranking compara os prêmios dentro dele. Também o padrão passou a ser **só vencimentos mensais**: com os dados reais, as semanais de 4 dias úteis dominavam a lista (MGLU3 a 11,5% "ao mês") por causa da extrapolação linear e do degrau de R$ 0,01 do preço.

**Resultado com dados reais (16/10/2026, vencimento de 19/11, chance de exercício até cerca de 25%).** BBAS3 rende 2,5% em 21 dias úteis, PETR4 1,9% e VALE3 1,1%; MGLU3 5,5% e ANIM3 3,1%. O topo da venda de put é de varejo, imobiliárias e locadoras, com volatilidade implícita de 100% a 170%: prêmio alto é incerteza alta, e é isso que a tela deixa visível.

**Comparação com um método público.** Um vídeo de educador de opções (julho de 2026) fixa o vencimento, compara as opções na linha do dinheiro, trata o ranking como filtro e cruza com fundamentos e tendência. Coincide com nosso foco no valor extrínseco, no vencimento fixo e no ranking como filtro; difere ao comparar só a opção ATM (que ordena por volatilidade), enquanto nós fixamos a chance de exercício. O cruzamento com a dívida e com as ações baratas foi feito logo depois (D98); lucro e tendência do ativo continuam fora.

**Limites.** O preço é o do último negócio, e não o de compra e venda: o prêmio realmente recebido pode ser menor. Dividendos, corretagem, emolumentos, IR e margem de garantia ficam de fora. A chance de exercício é estimativa do modelo, e não previsão.

**Testes.** 14 de cálculo do ranking (`premios.test.ts`), 3 da chance de exercício e 9 da aba (`SimuleOpcoesPremios.test.tsx`).

## D98 (17/10/2026): Top 15 de prêmios cruzado com as ações endividadas e baratas

**Pedido do responsável (17/10/2026).** Depois da análise de um vídeo público sobre ranking de prêmios (que defende olhar a dívida e a qualidade da empresa antes de vender), pediu que o Top 15 de prêmios cruzasse com as listas de ações baratas e endividadas que o app já tem.

**Desenho.** `domain/fundamentosPremios.ts` monta um índice por empresa (4 primeiras letras do código) com a posição e a dívida líquida ÷ EBITDA da lista das mais endividadas; `calcularTopPremios` ganhou um contexto opcional com esse índice e as raízes das mais baratas, e dois filtros: dívida máxima (sem limite, 5x ou 3x) e "só as mais baratas". Na tabela, coluna "Dív. líq./EBITDA" (razão, posição, aviso para as 15 mais endividadas, "sem EBITDA positivo"), e o selo "Top 15 mais baratas".

**Decisão de privacidade (a que mais importa).** A lista das mais baratas é **restrita por código** (D50): o arquivo do app vem com `ranking` vazio e a lista só sai do servidor com o código do mês. Cruzar de forma aberta vazaria uma lista restrita. Por isso o ranking de prêmios **só lê a lista se a pessoa já liberou o código neste aparelho** (chave `carteiraideal.top15.codigo`, a mesma da aba do Simule Ações), pelo mesmo endpoint, com cache na sessão. Sem código: nenhum pedido ao servidor, nenhuma marca, e uma nota explica como liberar. Código recusado ou rede fora: aviso discreto, ranking intacto. Nenhuma regra, arquivo ou aprovação das ações baratas foi alterada.

**Quem fica sem dado.** Bancos, seguradoras, bolsa/holdings, ETFs e empresas de pouca liquidez não estão na lista de dívida: continuam no ranking, com "—". Com dados de 16/10/2026, 61 dos 88 ativos do ranking (sem limite de risco) tinham dado de dívida. Com o limite de 3x, saem, por exemplo, MRVE3, EQTL3 (a 12ª mais endividada) e CSAN3; MGLU3 (1,1x), VAMO3, RENT3, CYRE3 e ANIM3 ficam.

**Limites.** Os da D94: dívida só em empréstimos e financiamentos (sem arrendamentos, relevantes em varejo e locadoras), sem prazo, custo ou moeda; EBITDA de 12 meses pode estar distorcido. A lista de dívida só muda quando sai balanço novo. Lucro e tendência de preço do ativo **não** entram (o vídeo recomenda olhá-los). O cruzamento é um filtro para começar a análise, e não uma indicação de operação.

**Testes.** 8 de domínio (`fundamentosPremios.test.ts`: índice, posição, empresas fora do universo, filtros de dívida e de baratas) e 6 de tela (`SimuleOpcoesCruzamento.test.tsx`: coluna, limite de dívida, lista não publicada, código liberado, sem código, código recusado). Os testes usam tudo injetado, sem rede.

## D99 (17/10/2026): aba "Por visão" do Simule Opções (estruturas por visão de mercado)

**Pedido do responsável (17/10/2026).** Uma aba de "estratégia de IA": dado um ativo e a tendência dele (por exemplo, de alta, e que ela se mantenha), listar as estruturas de opções que servem (trava de alta, condor etc.) e, para cada uma, **quais séries usar e onde estão as melhores**.

**Decisão.** Quarta aba do Simule Opções, "Por visão". Metodologia completa em `docs/13-metodologia-estrategias-por-visao.md`. Fluxo: a pessoa escolhe o ativo (a mesma busca da aba Séries, agora compartilhada, e o ativo escolhido vale em todas as abas); o app lê a tendência e sugere a visão (alta, baixa ou lateral), que a pessoa pode trocar, inclusive para "muita oscilação"; para a visão e o vencimento escolhidos, monta as estruturas com as séries reais do último pregão e mostra até 3 candidatas por estrutura, com crédito ou débito, ganho e perda máximos, equilíbrio, **chance de lucro**, retorno no cenário e liquidez. "Simular" leva a candidata ao simulador, com cada série no lado e na quantidade certos.

**Por que não é um modelo de linguagem (e o que "IA" significou aqui).** O motor é determinístico: mesmo ativo e mesmos dados, mesma lista, e cada número é conferível. Um modelo de linguagem exigiria servidor (a chave não pode ir ao navegador), limite de uso e custo, e traria o risco de inventar preço, strike ou probabilidade num produto de derivativos. A camada de linguagem natural (traduzir "quero renda com BBAS3, acho que lateraliza" em visão, vencimento e critério, e explicar o resultado) é possível por cima do motor, que continuaria sendo a única fonte dos números. **Não está feita**, e vale decidir antes se o produto quer isso.

**Sobre "as melhores".** No modelo de preços, nenhuma estrutura tem vantagem esperada: a esperança do resultado, no mundo neutro ao risco, é o custo de montar. As estruturas diferem no perfil (quanto arrisca, quanto pode ganhar, com que chance). Por isso o app **não elege uma "melhor"**: ordena pelo critério escolhido (maior chance de lucro, maior retorno no cenário ou menor risco) e mostra os três números; a tela diz isso. Pelo mesmo motivo (e porque recomendação personalizada de derivativo é atividade regulada), o texto fala em "candidatas" e traz o aviso educacional.

**Tendência.** O job de opções passou a publicar, por ativo, as médias de 21 e 63 pregões, os retornos, a posição na faixa de 52 semanas e a volatilidade realizada, calculados do histórico de fechamentos que os jobs de ações e ETFs já guardam (`historico/acoes.json` e `historico/etfs.json`). 148 dos 161 ativos têm. Regra de leitura: alta = preço > média de 21 > média de 63 e retorno de 63 pregões ≥ +3%; baixa, o inverso; o resto é lateral. A tela mostra os números e compara a volatilidade realizada com a implícita perto do preço (opções caras ou baratas em relação ao que o ativo oscila).

**Corte que o teste com dados reais mostrou ser necessário.** Uma "trava de alta" da PETR4 saía no topo com débito de R$ 49 e ganho máximo de R$ 1 (pagar quase a largura inteira da trava: sinal de preço velho numa das pernas). Travas e borboleta de débito agora precisam render ao menos 25% do risco. Antes disso, o piso geral de ganho de 5% do risco derrubava até a venda de put comum (que rende uns 1% a 3% sobre o strike), e foi baixado para 0,5%.

**Desempenho.** Cada estrutura leva poucos milissegundos para um ativo (as travas de crédito, mais pesadas, chegam a cerca de 100 ms no BOVA11, que tem centenas de séries); medindo as quatro estruturas mais pesadas nos 161 ativos, o total foi de cerca de 4 s, e a tela só calcula o ativo escolhido.

**Limites.** O preço de cada perna é o do último negócio, e não o de compra e venda. A tendência é leitura do passado e não prevê. Lucro da empresa, dívida e notícias não entram nesta aba (a aba Top 15 prêmios cruza com a dívida). Modelo europeu sem dividendos. Corretagem, emolumentos, IR e margem de garantia ficam de fora. Só risco limitado.

**Testes.** 23 do motor (`estrategiasPorVisao.test.ts`, com as contas de cada estrutura conferidas à mão e a chance de lucro contra a fórmula fechada), 6 da leitura de tendência, 5 do cálculo de tendência no job e 12 da aba (`SimuleOpcoesPorVisao.test.tsx`).

## D100 (17/10/2026): aba "Gráficos" do Simule Opções (primeiro gráfico: negócios por strike)

**Pedido do responsável (17/10/2026).** Uma aba de gráficos; o primeiro mostra o **número de negócios por strike** para um vencimento (ele esperava uma parábola), podendo escolher **quantos vencimentos quiser dentro dos 6 meses**. Esclarecimentos dele durante a construção: vale para **calls e puts**, **independentemente de a série ser europeia ou americana**, e o **preço do ativo-objeto no dia deve ficar no centro do gráfico**.

**Desenho.** Quinta aba do Simule Opções, "Gráficos" (\`GraficosOpcoes.tsx\`; cálculo em \`domain/graficoNegocios.ts\`; desenho em \`ui/GraficoPorStrike.tsx\`), com a mesma busca de ativo das outras abas. Controles: **vencimentos** (vários, em grupos mensais e semanais, com "só mensais", "só semanais", "todos" e "limpar"); **tipo** (calls e puts separadas, somadas, só calls ou só puts); **o que contar** (negócios ou volume financeiro); **strikes mostrados** (±10%, ±20%, ±30% do preço ou todos); **escala** (valores reais, ou cada linha em % do próprio pico, para comparar o formato entre vencimentos de tamanhos muito diferentes: o de 19/11 da PETR4 tem 11.393 negócios no pico e o de 18/12 tem 323). Uma cor por vencimento; calls em traço cheio e puts tracejadas.

**O que entra na conta.** Só as séries que negociaram no último pregão contam (as que só negociaram em dias anteriores entram como zero, para o eixo mostrar todos os strikes listados). Americanas e europeias somam juntas, e séries diferentes do mesmo tipo, vencimento e strike (como as ajustadas por proventos) também. Mostra, por linha, o pico (strike, % do preço e valor) e o total, e uma tabela com os números de cada strike para quem prefere ler assim (e para leitor de tela).

**Preço no centro.** O eixo horizontal é simétrico em torno do preço do ativo no dia, indo até o strike mais distante, de modo que a linha tracejada do preço fica sempre exatamente no meio e a marca central do eixo é o próprio preço (com um teto de 95% do preço para o eixo não ficar negativo quando há strikes muito acima; o excesso é recortado). O eixo vertical usa um teto "redondo" (12.000 em vez de 11.393, com 6.000 no meio).

**Leitura.** Passar o mouse, tocar ou usar as setas (esquerda e direita, início e fim) sobre o gráfico mostra os valores de cada linha no strike mais próximo, com a distância ao preço. A seta começa no strike mais perto do preço.

**A forma não é uma parábola.** Com os dados de 16/10/2026, é um sino **assimétrico e com picos**: os negócios se concentram perto do preço (PETR4, vencimento de 19/11: pico no strike 58,91, 1,3% abaixo do preço, com 11.393 negócios de calls e 10.199 de puts), com picos em strikes de números redondos, calls negociando mais acima do preço e puts mais abaixo. No BOVA11, com todos os strikes, o pico fica em 185 (8,6% abaixo do preço) e há muitas puts distantes, que são proteção de carteira. O texto da tela diz isso, e que muito negócio num strike mostra onde há liquidez, e não para onde o preço vai.

**Barra de abas.** Com cinco abas, \`AbasDaTela\` passou a quebrar em linhas quando há mais de quatro (3 e 2 no celular, uma linha só no computador); com até quatro, nada mudou.

**Limites.** Os negócios são os de **um pregão** (o último), então mudam bastante de um dia para o outro; não é posição em aberto (interesse aberto), que o app não tem. O volume financeiro de cada série é o do dia do último negócio. Só os próximos 6 meses de vencimentos.

**Testes.** 8 do cálculo (\`graficoNegocios.test.ts\`: separação de calls e puts, soma, faixa, volume, pico, séries paradas, vencimentos vazios), 14 da aba (\`SimuleOpcoesGraficos.test.tsx\`, incluindo escala relativa, teclado e o "voltar" do navegador) e 10 do gráfico (teto do eixo e o preço sempre no centro, inclusive com strikes só de um lado).

## D101 (17/10/2026): gráficos do Simule Opções no visual e nas cores do Simule Tesouro Direto

**Pedido do responsável (17/10/2026).** Os gráficos usarem as cores do que aparece no Simule Tesouro Direto.

**O que o Tesouro usa.** O gráfico dele (`GraficoJuros`) tem um vocabulário próprio no `index.css`: classes `grafico-juros-*` (grade, eixo em IBM Plex Sans, linhas de ponta arredondada, guia pontilhada, ponto com contorno da cor do fundo, leitura e marquinha de legenda) e as cores `--grafico-selic` (âmbar), `--grafico-ipca` (azul) e `--grafico-con` (verde), cada uma com um tom para o tema escuro e outro, mais escuro, para o claro (o amarelo de destaque some como linha fina sobre fundo claro).

**O que mudou.** Os dois gráficos de opções, o de **negócios por strike** (aba Gráficos) e o de **payoff** (aba Estratégias), passaram a usar esse mesmo vocabulário, e não mais cores fixas em hexadecimal:
- **Negócios por strike (substituído na D102: a cor passou a dizer o tipo, e o traço o vencimento):** uma cor por vencimento, da nova paleta `--grafico-v1` a `--grafico-v8`. As três primeiras **são** as do Tesouro (`v1` = âmbar, `v2` = azul, `v3` = verde, por referência às variáveis dele, então acompanham o tema sozinhas). As cinco seguintes (magenta, laranja, ciano, violeta e cinza) são minhas, da mesma família, com um tom para cada tema, porque o Tesouro só tem três e o gráfico aceita até oito vencimentos. Calls em traço cheio e puts com o tracejado de 7 e 3,5 que o Tesouro já usa no Simule Imóvel.
- **Payoff:** linha do vencimento em âmbar (`--grafico-selic`), curva "daqui a N dias" em azul tracejado (`--grafico-ipca`), área de lucro em verde (`--grafico-con`, no lugar de `--mc-pos`) e de prejuízo em vermelho (`--danger`); grade, eixos e guia do preço de hoje com as mesmas classes.
- **Legendas e leituras** com a marquinha do Tesouro (barra curta na cor da linha, tracejada nas puts), no lugar dos símbolos de texto coloridos. Isso também cumpre a regra da D90: nenhum texto amarelo, porque a cor agora fica só na marquinha, e o texto continua na cor normal.
- A leitura do gráfico de strike passou a usar a caixa de leitura do Tesouro (`grafico-juros-leitura`); os valores continuam separados por espaço no texto, para o leitor de tela.

**Conferido nos dois temas** com dados reais: no escuro, âmbar vivo, azul e verde claros; no claro, âmbar escuro, azul e verde de 50% de brilho, os mesmos valores que o Tesouro usa.

**Testes.** 3 do CSS (\`graficosOpcoesCores.css.test.ts\`: as três primeiras cores herdam do Tesouro, as cinco extras existem nos dois temas e as classes reaproveitadas existem) e 5 dos componentes (\`graficosOpcoesCores.test.tsx\`: classes e variáveis em vez de cores fixas, tracejado das puts, marquinhas, payoff em âmbar e azul, nenhum hexadecimal solto).

**Limites.** O Tesouro só tem três cores, então a partir do quarto vencimento no mesmo gráfico as cores são as extras (da mesma família, mas não são "do Tesouro"). O gráfico de strike mostra no máximo oito vencimentos distintos antes de repetir cores.

## D102 (17/10/2026): no gráfico de negócios por strike, a cor diz o tipo (calls em amarelo, puts em azul) e o traço diz o vencimento

**Pedido do responsável (17/10/2026).** "E se mudar a cor da call para amarelo?" Na D101 a cor distinguia o vencimento (âmbar, azul, verde e mais cinco tons) e o traço distinguia calls (cheio) de puts (tracejado).

**Decisão.** Trocar o significado dos dois canais:
- **Cor = tipo**, com as cores do gráfico do Simule Tesouro, que mudam com o tema: **calls em amarelo** (âmbar, `--grafico-selic`), **puts em azul** (`--grafico-ipca`) e **calls e puts somadas em verde** (`--grafico-con`). É o par de cores que o gráfico do Tesouro já tem para suas duas séries.
- **Traço = vencimento**, em ordem de data: cheio, tracejado (7 e 3,5), pontilhado (0,1 e 4,5, mais grosso, como o do consórcio no Simule Imóvel), traço e ponto, e mais quatro padrões até o oitavo vencimento. A legenda, a lista de picos e a leitura mostram um trecho de cada linha com a mesma cor, traço e espessura (`MarcaDaLinha` virou um pequeno SVG, no lugar da barra de CSS), e uma linha de texto explica: "Amarelo são as calls, azul são as puts e verde são calls e puts somadas".
- A paleta própria por vencimento da D101 (`--grafico-v1` a `--grafico-v8`) saiu do CSS: a regra que a substitui não precisa de cores novas, só das três do Tesouro.

**Por que assim.** Calls e puts são a comparação que mais interessa neste gráfico (as puts concentram abaixo do preço e as calls acima), e o amarelo para calls casa com o âmbar que o Tesouro usa. Como a cor não distingue mais o vencimento, o traço faz esse papel sem criar cores novas. A cada novo vencimento marcado, o gráfico não ganha uma cor nova, e sim um traço novo.

**Limites.** (1) **No tema claro o "amarelo" é um âmbar escuro** (o tom que o Tesouro usa no claro, porque o amarelo vivo some sobre fundo branco e o app não usa texto nem linha fina amarela no claro, D90); no escuro é o amarelo vivo. (2) Distinguir vencimentos só pelo traço é mais difícil do que pela cor quando há quatro ou mais vencimentos sobrepostos: dá para ler com até uns três; com mais, vale usar a leitura por strike (mouse, toque ou setas), que lista cada linha com a sua marquinha, ou a tabela de números. (3) O gráfico de payoff da aba Estratégias não mudou: segue em âmbar (no vencimento) e azul tracejado (antes do vencimento).

**Testes.** O de CSS passou a conferir que a paleta por vencimento não existe mais e que âmbar, azul e verde existem nos dois temas; os de componente conferem cor por tipo, traço e espessura por linha, e a marquinha como trecho da linha; os da aba conferem calls em âmbar, puts em azul, somadas em verde, os três primeiros traços por vencimento (cheio, tracejado e pontilhado) e a legenda.


## D103 (17/10/2026): compra e venda de call e put se montam nas Séries da B3; a aba Estratégias vira "Monte sua estratégia"

**Pedido do responsável (17/10/2026).** Mandar quem clica numa série para outra aba não fazia sentido: lá, "compra de call" ou "venda de put" aparecia sem strike, sem ativo e sem séries. A compra e a venda de call e de put devem ficar montadas na própria aba Séries da B3, com o gráfico ali; a aba Estratégias fica só para estruturas (travas, borboleta, condor e as demais), com escolha de ativo e de séries.

**Séries da B3.** A caixinha de seleção virou dois botões por linha, **C** (comprar) e **V** (vender). Clicar monta a operação ali mesmo, acima da tabela e sem trocar de aba: preço da série (vem do último negócio), quantidade (lote do ativo, no mínimo 100) e preço do ativo, todos editáveis, e logo abaixo o resultado completo (ganho e perda máximos, equilíbrio, gráfico no vencimento e antes dele, passagem do tempo, gregas e aviso de risco nas vendas). Clicar de novo no mesmo botão, ou em Fechar, desfaz. O botão "Criar estratégia com as selecionadas" saiu.

**Estratégias ("Monte sua estratégia").** Escolhe-se o ativo (a mesma busca das outras abas), a estrutura e o vencimento dos próximos 6 meses; o app sugere uma série real para cada perna a partir do preço do ativo (degraus de strike contados a partir do mais perto do preço) e cada perna pode ser trocada por outra série do mesmo vencimento, com o preço editável. Catálogo (`domain/modelosDeEstrategia.ts`): trava de alta e de baixa (com calls e com puts), borboleta de calls, de puts e de ferro, condor de ferro e de calls, straddle e strangle (comprados e vendidos), venda coberta e collar. Só aparecem os vencimentos que têm série de todos os tipos que o modelo usa. As estruturas vendidas sem proteção (straddle e strangle vendidos) mostram o aviso de risco. A ordem dos strikes é conferida (trava de alta com strike trocado, ou duas pernas do mesmo tipo no mesmo strike, pedem correção em vez de calcular).

**O que continua.** As abas Top 15 prêmios e Por visão seguem mandando uma série ou uma estrutura para a aba Estratégias, que as recebe como "Séries escolhidas" (compra ou venda por série, quantidade e preço editáveis, com remoção) ou, no caso da venda coberta do ranking, no modelo Venda coberta já com a série. Por isso a aba Por visão (sugere estruturas e séries por tendência) e a Estratégias (montagem manual, com o catálogo completo) não se sobrepõem: uma recomenda, a outra monta.

**Código.** O resultado (cartões, gráfico, tempo, gregas, volatilidade e juros) saiu da tela antiga para `PainelDaPosicao`, usado pelas duas abas. `MonteSuaEstrategia` substitui o antigo `Estrategias`; o catálogo e as regras de escolha de séries ficam no domínio, com testes.

**Testes.** 9 novos para compra e venda de call e put nas séries (as quatro operações, desfazer, edição de preço e quantidade, gregas), 10 para a aba Estratégias e 14 do catálogo (escadas, degraus, ordem dos strikes, ganho e perda limitados ou não por estrutura).


**Nome da aba (17/10/2026).** A aba "Por visão" passou a se chamar **Tendência** (só o nome na tela e nos textos; o funcionamento da D99 é o mesmo).


## D104 (17/10/2026): estruturas com vencimentos diferentes (THL, diagonais) na aba Estratégias

**Pedido do responsável (17/10/2026).** O motor exigia o mesmo vencimento em todas as pernas. O responsável quer montar, com o mesmo ativo, estruturas com strikes e vencimentos diferentes (a THL e a malha de renda do "Prefiro PUT", diagonais, calendários).

**Por que antes não dava.** O gráfico "no vencimento" é exato porque, nessa data, cada opção vale só o valor intrínseco. Com vencimentos diferentes não existe data em que todas as pernas já venceram: na data da perna curta, a longa ainda vale mais que o intrínseco, e esse valor só pode ser estimado.

**Como ficou.**
- Cada perna tem o seu prazo (\`Perna.dias\`) e, opcionalmente, a sua volatilidade (\`Perna.sigma\`). Sem prazo próprio, tudo funciona como antes.
- Quando os prazos diferem, o gráfico principal passa a mostrar a posição **na data do primeiro vencimento** (o da perna curta): a curta vale o intrínseco e as longas valem o preço de Black-Scholes com o prazo que resta. Cada perna usa a **volatilidade implícita do próprio preço**, de modo que, hoje, a posição vale o que custou (resultado zero) e a estimativa não nasce enviesada.
- Ganho e perda máximos e equilíbrios viram **estimados** (\`analisarEstimado\`: varre o preço do ativo de perto de zero a três vezes o maior valor de referência; "sem limite" quando sobram calls líquidas compradas ou vendidas, como no cálculo exato). A tela diz, em destaque, que é estimativa e que, se a volatilidade mudar, o resultado muda.
- Na aba Estratégias, **cada perna escolhe o próprio vencimento** (e a série dentro dele; ao trocar o vencimento fica o strike mais perto do anterior). As séries trazidas do Top 15 e da Tendência também podem ter vencimentos diferentes (antes davam erro).
- Novos modelos, no grupo "Vários vencimentos": **Trava horizontal de calls (THL)**, **Trava horizontal de puts (THL)**, **Trava diagonal de calls** e **Trava diagonal de puts**. A perna longa vai para o vencimento mensal seguinte ao escolhido para a curta, e o app confere que a longa vence depois da curta.

**Limites.** (1) A estimativa usa um modelo europeu, sem dividendos; opções americanas podem ser exercidas antes. (2) Usa o último preço negociado de cada perna, que pode estar longe do preço real de compra e venda; em estruturas de dois vencimentos isso pesa mais, porque a conta depende da diferença entre dois preços. (3) A rolagem (recomprar a perna atual e vender a do vencimento seguinte) e o plano de ajuste ainda não existem: são a etapa seguinte. (4) Pernas de ativos diferentes ficam fora: o resultado por preço do ativo deixa de ter um eixo só.

**Testes.** 6 de domínio para o cálculo (reconhecer vencimentos diferentes, resultado zero hoje, valor da perna longa na data da curta, máximo e mínimo limitados no calendário, perda sem limite quando cabe, e que sem prazo próprio nada muda), 6 do catálogo (perna longa no vencimento seguinte, diagonal, vencimentos oferecidos, ordem de vencimentos, débito) e 4 da tela (THL, diagonal, perna longa antes da curta, troca de vencimento numa estrutura comum).


## D105 (17/10/2026): manejo da estrutura (cenários, desmontagem e rolagem) na aba Estratégias

**Pedido do responsável (17/10/2026).** Rolagem e plano de ajuste/manejo para quando o mercado vai contra, nas estruturas montadas.

**O que a aba Estratégias passou a mostrar, abaixo do resultado da estrutura** (bloco "Manejo"):
1. **Cenários no primeiro vencimento**: ativo −10%, −5%, parado, +5% e +10%, com o resultado da estrutura inteira e quais séries vendidas ficam dentro do dinheiro (seriam exercidas). Exato com um vencimento só; estimado com vários.
2. **"E se o mercado for contra antes do vencimento?"**: o responsável escolhe um cenário (preço do ativo e dias úteis que passam; atalhos de −10% a +10%) e vê o **resultado de desmontar tudo** nesse cenário, com o valor de cada opção.
3. **Rolagem**: marca-se cada perna a rolar, escolhe-se o novo vencimento (só os posteriores com séries do mesmo tipo; o mensal seguinte é o padrão) e a nova série (o strike mais perto do atual é o padrão). O app mostra, por perna, o encerramento, a abertura e o **crédito ou débito líquido** da troca, avisa quando há débito ("você paga para adiar"), e abre a **posição depois da rolagem** com o mesmo painel de resultado (ganho e perda máximos, equilíbrio, gráfico, tempo, gregas), já com o prejuízo ou lucro realizado nas pernas encerradas somado.
4. **"O que costuma ser feito"**: texto descritivo conforme as pernas (put vendida, call vendida coberta ou descoberta, trava, THL e diagonais, só comprada), e um lembrete de definir antes o gatilho do ajuste. Não é recomendação de operação.

**Como se calcula** (\`domain/rolagem.ts\`). O cenário é uma data e um preço do ativo. Cada opção é valorizada por Black-Scholes com a volatilidade implícita do preço da própria série hoje (assim, hoje, cada perna vale o que custou). Rolar encerra a perna antiga pelo valor do cenário (realiza o resultado) e abre a nova, no mesmo lado e quantidade, pelo preço estimado nesse cenário, com prazo contado a partir dele. Pernas que não rolam e já venceram até o cenário são encerradas pelo valor intrínseco. A posição depois da rolagem leva um campo novo, \`Posicao.realizado\`, somado ao resultado em qualquer preço, de modo que o ganho e a perda máximos já incluem o que foi realizado.

**Limites.** (1) Tudo usa o último preço negociado e um modelo europeu, sem dividendos: no dia, o preço real de compra e venda pode ser pior, e o crédito de uma rolagem real tende a ser menor que o estimado. (2) A rolagem mantém o tipo da perna (call continua call); trocar de tipo ou de lado fica fora. (3) Só estruturas montadas na aba Estratégias: acompanhar uma posição que a pessoa já tem, informando os preços de entrada, é a etapa seguinte, assim como a "roda" e os modelos do Prefiro PUT (Slide, put otimizada, booster).

**Testes.** 12 de domínio (valor no cenário, desmontagem, rolagem de vendida e comprada, realizado no gráfico, pernas vencidas no caminho, ações, cenários e exercidas) e 7 da tela.


## D106 (17/10/2026): modelos do tipo "Prefiro PUT" no catálogo (slide, put otimizada, strangle financiado, booster)

**Pedido do responsável (17/10/2026).** Incluir as estruturas descritas em material do canal Prefiro PUT. O responsável não tinha as pernas exatas, então valem as definições dos textos e as mais comuns de mercado, e isso está escrito na tela de cada modelo ("confira e ajuste as séries").

**Modelos** (grupo "Renda e proteção (Prefiro PUT)", na aba Estratégias; todas as séries podem ser trocadas):
- **Slide com put**: compra uma put de strike maior e vende duas puts de strikes menores (intermediária e inferior). Costuma sair com crédito; aviso de put vendida sem proteção.
- **Put vendida otimizada**: put vendida mais trava de baixa com calls (vende uma call e compra outra de strike maior). O crédito das calls soma ao da put; o risco de baixo continua o da put.
- **Strangle comprado financiado**: strangle comprado com opções mais afastadas vendidas (condor de ferro comprado). Perda máxima é o débito; o ganho fica limitado.
- **Booster**: ações, trava de alta com calls financiada por uma put vendida abaixo. Dentro da faixa das calls, ganho cerca do dobro da ação sozinha.

**Fora desta rodada.** A "roda" (sequência put, exercício, venda coberta) e o acompanhamento de uma posição já existente. Os demais modelos de vários vencimentos (THL e diagonais) já estão na D104.

**Limites.** As quatro montagens são leituras dos textos, e não as pernas oficiais de nenhuma mesa; strikes e quantidades padrão (degraus a partir do strike mais perto do preço) são ponto de partida. As estruturas com put vendida sem proteção mostram o aviso de risco e a perda não tem teto de "poucos reais": chega perto do strike vezes a quantidade.

**Testes.** 5 de domínio (pernas e strikes padrão, crédito do slide, perda máxima igual ao débito no strangle financiado, delta cerca de dois no booster, grupo) e 1 da tela.


## D107 (17/10/2026): aba "Roda" (wheel) no Simule Opções

**Pedido do responsável (17/10/2026).** Montar a roda (wheel) do material do "Prefiro PUT": vender put até ser exercida, vender call coberta sobre as ações, e voltar à put.

**O que a aba mostra** (um giro, com séries reais do ativo escolhido):
- **Passo 1, put coberta por caixa.** Vencimento e série da put (padrão: o strike mais perto de 5% abaixo do preço), quantidade, caixa reservado (strike × quantidade), prêmio, rendimento no prazo e "equivale a, por mês" (regra de três para 21 dias úteis, só para comparar), preço efetivo se for exercida (strike menos prêmio) e quanto isso está abaixo do preço de hoje, chance de exercício (modelo, volatilidade implícita do próprio preço), e o resultado da put no mesmo painel das outras estruturas.
- **Passo 2, call coberta depois do exercício.** Vencimento (padrão: o mensal seguinte ao da put) e série da call (padrão: o primeiro strike a partir do strike da put). O prêmio da call é **estimado**: só será conhecido quando a put for exercida, com o ativo perto do strike da put, então a série é valorizada por Black-Scholes nesse cenário com a volatilidade implícita do último preço dela. Mostra prêmio estimado, chance de a ação ser vendida, equilíbrio das ações (strike da put menos os dois prêmios), ganho e rendimento do giro completo (diferença dos strikes mais os dois prêmios, sobre o caixa), aviso quando o strike da call fica abaixo do preço efetivo da ação, e o painel de resultado com as ações a partir do strike da put e o prêmio da put já somado (\`Posicao.realizado\`).
- **Manejo da put** (cenários, desmontagem e rolagem da D105) num bloco recolhível, para o caso de o ativo cair antes do vencimento.
- Um aviso de que a roda não elimina o risco: se a ação cair bem abaixo do strike, fica-se com um papel que vale menos do que se pagou, e a call coberta trava a recuperação.

**Limites.** (1) Só um giro; não projeta vários meses (repetir o rendimento de um mês não é garantido e a tela não faz essa conta). (2) O passo 2 depende de um prêmio estimado e do ativo no strike da put; o real pode diferir. (3) Preço de último negócio e modelo europeu, sem dividendos, sem corretagem nem imposto. (4) Só vale para ativos que a pessoa aceitaria ter em carteira ao preço do strike (dito na tela).

**Código.** \`domain/roda.ts\` (\`passoDaPut\`, \`passoDaCall\`), \`screens/RodaOpcoes.tsx\`, aba "Roda" com histórico de navegador como as demais. 9 testes de domínio e 10 da tela.


## D108 (17/10/2026): novas estruturas na aba Tendência

**Pedido do responsável (17/10/2026).** As estruturas novas do catálogo da aba Estratégias deveriam entrar também na aba Tendência.

**O que entrou**, no mesmo motor da D99 (mesmo vencimento, risco limitado, séries que negociaram no último pregão):
- **Alta:** Slide com put e Booster (além de compra de call, travas e venda de put).
- **Baixa:** Collar (para quem tem a ação).
- **Lateral:** Borboleta com puts, Borboleta de ferro, Condor com calls e Put vendida otimizada (além do condor de ferro, borboleta com calls e venda coberta).
- **Muita oscilação:** Strangle comprado financiado (além de straddle e strangle comprados).

Cada cartão mostra, como as demais, até três candidatas ordenadas pelo critério escolhido (chance de lucro, retorno no cenário ou menor risco), com custo ou crédito, ganho e perda máximos, equilíbrio e chance de lucro. As definições das pernas são as do catálogo da D104 e da D106 (as do Prefiro PUT seguem as leituras explicadas na D106).

**Ajustes no motor.**
- O piso de "débito precisa render 25% do risco" (D99) passou a valer só quando o débito é a maior parte do risco (travas, borboletas, strangle financiado). Em estruturas de custo quase zero, como o slide e o booster, o risco vem das pernas vendidas e o piso as eliminava sem motivo.
- Slide: aceita crédito ou custo de até 25% do prêmio da put comprada (com os preços reais, o crédito puro quase nunca aparece). Booster: o débito da trava de alta precisa ser coberto, ou quase (até R$ 0,02 por opção), pela put vendida.
- "Simular" no **Collar** e no **Booster** abre o modelo próprio na aba Estratégias, com as ações e as séries do cartão na ordem das pernas (antes, só a venda coberta, de uma perna, tinha esse caminho); as demais continuam abrindo como "Séries escolhidas".

**Fora.** THL e diagonais ficam fora da Tendência: o motor dela compara estruturas no mesmo vencimento, e as de vencimentos diferentes têm resultado estimado (D104), que não se compara com o exato das demais. A venda de straddle e de strangle também não entra: a Tendência só mostra risco limitado.

**Limites.** O slide e a put otimizada têm put vendida sem proteção: a perda máxima é grande diante do ganho e a chance de lucro costuma ser alta, o que é o perfil dessas estruturas e não sinal de que "valem a pena" (a tela já diz que nenhuma tem vantagem esperada).

**Testes.** 8 de domínio (catálogo e visão certa, candidatas de risco limitado, pernas e lados de cada uma, encaminhamento do collar e do booster) e 3 da tela.


## D109 (17/10/2026): na landing, o cartão Simule Ativos sobe para logo abaixo do botão principal

**Pedido do responsável (17/10/2026).** Na landing, o cartão **Simule Ativos** passa a ficar logo abaixo do botão "Descobrir meu perfil e carteira de referência" (ou "Ver minha carteira de referência").

**Nova ordem dos cartões:** botão principal, **Simule Ativos**, Meus Ativos, Meu Mês, Aprender, Simule Bens, e-mail. Antes, o Simule Ativos vinha depois do Aprender. Só mudou a posição no HTML (\`index.html\`); o endereço (\`?tela=simuleAtivos\`), o texto e o desenho do cartão são os mesmos. Esta decisão substitui a posição descrita na D42 e nos comentários de D25 e D44 (o Simule Bens agora fica depois do Aprender).


## D110 (17/10/2026): Simule Opções entra nos textos da landing, nos metadados e na documentação; no hub, vem depois do Simule Ações

**Pedido do responsável (17/10/2026).** Incluir as opções no cartão da landing e nos demais campos e documentações do app; dentro do Simule Ativos, o Simule Opções fica logo depois do Simule Ações.

**O que mudou.**
- **Hub Simule Ativos:** nova ordem Simule Ações, **Simule Opções**, Simule FII, Simule Tesouro Direto, Simule BDR, Simule ETF. A descrição do cartão passou a citar compra e venda, travas, THL, roda e rolagem.
- **Landing:** o texto do cartão Simule Ativos agora diz "Ações, opções, FII, Tesouro Direto, BDR e ETF: quanto cada um rende"; as descrições (meta, Open Graph e JSON-LD) da landing e do \`webapp-src/index.html\` citam ações e opções.
- **Páginas estáticas** (\`scripts/gerar-paginas.mjs\`): atalhos para as ferramentas e a página "Metodologia e fontes" passaram a citar ações e opções; nela, a lista "De onde vêm os dados dos simuladores" ganhou o item das opções (cadastro de instrumentos e COTAHIST da B3, estimativas de Black-Scholes) e um parágrafo diz que o Simule Opções descreve, que o Top 15 prêmios e a Tendência ordenam sempre por um critério escolhido pela pessoa e que nada ali é recomendação.
- **Documentação:** \`docs/04\` (jornada: Simule Ativos na landing e as seis abas do Simule Opções), \`docs/05\` (nova seção 5.12, operação diária das opções), \`docs/06\` (nova seção 13, o que falta), \`docs/13\` (nome Tendência e as estruturas da D108) e novo \`docs/14-metodologia-estrategias-montadas.md\` (catálogo, vencimentos diferentes, manejo, roda e a ressalva de que nenhuma estrutura garante renda).

**Fora.** Página pública de SEO para o Simule Opções (como as de FII, ETF e BDR) não foi criada; está em \`docs/06\` como decisão do responsável. O Simule Ações também não tem página própria.


## D111 (17/10/2026): Top 15 prêmios ganha o botão V (vender) na frente de cada linha; o Simular continua no fim

**Pedido do responsável (17/10/2026).** O Top 15 prêmios deveria seguir a lógica das Séries da B3 (botões com cor, operação montada ali mesmo, em vez de jogar para outra aba). Em seguida, o responsável ponderou que a pessoa também pode querer montar estruturas com aquele strike, então o **Simular fica**. E, como o ranking é de quem vende, **só o V** (sem o C).

**Como ficou.**
- **V (vermelho), na primeira coluna.** Monta a venda da série ali mesmo, abaixo da tabela, sem sair do ranking, com o mesmo painel das Séries (preço da série, quantidade e preço do ativo editáveis; ganho e perda máximos, equilíbrio, gráfico, passagem do tempo, gregas e aviso de risco). Clicar de novo no V, ou em Fechar, desfaz.
- **No ranking de puts**, o V é a venda de put. **No ranking de calls cobertas**, o V é a **venda coberta** (entram as ações, compradas ao preço do ativo, e some o aviso de perda sem limite), e não a venda descoberta de call.
- **Simular**, na última coluna (agora com o título "Estruturas"), segue levando a série para a aba Estratégias, para montar travas e outras estruturas com aquele strike.
- Uma linha de texto explica a diferença entre os dois botões.

**Código.** O painel da operação saiu de \`SimuleOpcoes.tsx\` para \`OperacaoDaSerie.tsx\` (agora com a opção \`coberta\`), junto com o botão \`BotaoDeLado\`, usado pelas Séries da B3 e pelo Top 15.

**Testes.** 5 novos (V na frente e Simular no fim, venda de put montada ali, venda coberta, desfazer, Simular continua levando à aba Estratégias); os testes que liam as colunas do ranking foram deslocados em uma coluna.


## D112 (18/10/2026): aba "Minha posição" no Simule Opções

**Pedido do responsável (18/10/2026).** Uma aba em que a pessoa cadastra a estrutura de opções que já montou (ativo, strike, preço pago, com botão "+" para ir adicionando pernas, inclusive as ações das estruturas que usam o ativo), e o app identifica a estrutura, analisa como ela está no dia, mostra o gráfico e traz sugestões de saída caso o mercado ande contra ela: rolagem, manejo, troca de trava.

**O que faz.** Cadastro de pernas (tipo, lado "Comprei" verde ou "Vendi" vermelho, vencimento, série real, quantidade e preço da operação), ações opcionais, data e preço do ativo na montagem. Reconhece a estrutura; mostra o resultado de hoje pelo último preço, ganho e perda máximos, o quanto do ganho máximo já foi capturado, tabela perna a perna (strike, A/I/OTM, distância, delta) e pontos de atenção; desenha o gráfico da posição; e lista as **possibilidades de saída** (manter, encerrar tudo, encerrar só uma perna, rolar uma perna para o vencimento seguinte no mesmo strike ou num mais afastado, rolar a estrutura inteira, proteger a vendida descoberta), cada uma com o fluxo de hoje, o resultado realizado e o novo ganho e perda máximos, e um botão "Ver como fica" que desenha o gráfico da posição resultante. Um bloco recolhível leva o manejo da D105 (cenários, desmontagem e rolagem com liberdade).

**Decisões de desenho.**
- **Sugestões sem "melhor":** o app mostra o que cada saída muda em números e não elege uma; a escolha depende do que a pessoa pensa do ativo e do risco que aceita (o mesmo critério da D99).
- **Volatilidade no preço de mercado de hoje:** cada perna é calibrada no último preço da série, e não no preço da operação, para que as estimativas partam do mercado de hoje.
- **Trocas de hoje pelo último preço:** nas rolagens "de hoje", as duas pontas usam o último preço de cada série, e não um valor de modelo. Isso evitou um prejuízo falso em opções muito dentro do dinheiro, cujo último preço é abaixo do valor intrínseco (negócio antigo); o app agora avisa desse caso.
- **Dados só no aparelho:** `localStorage`, uma posição por ativo; a frase de privacidade da landing e das páginas passou a citar a posição de opções.
- Série cadastrada que saiu da lista fica fora da análise, com aviso.

**Limites.** Só há o preço do último pregão (não guardamos a evolução dia a dia da posição); preço defasado e modelo europeio sem dividendos; preço real de compra e venda pode ser pior; ignora corretagem, emolumentos e imposto. Séries fora dos próximos 6 meses ou sem negócio recente não podem ser cadastradas. O responsável não tem posição em opções hoje: a aba foi testada só com dados de teste e com séries reais do app.

**Código.** `domain/posicaoReal.ts` (resolução, reconhecimento, situação de hoje e possibilidades), `screens/MinhaPosicaoOpcoes.tsx`; `Alvo` de `rolagem.ts` ganhou `precoDaAntiga` e `precoDaNova`, e `sigmaDaPerna` respeita a volatilidade que a perna já traz. 26 testes de domínio e 16 da tela, mais 4 de rolagem e de preço defasado.


## D113 (18/10/2026): passo a passo por objetivo no início da aba Estratégias

**Pedido do responsável (18/10/2026).** Seguir com os próximos passos que o assistente tinha apontado; o primeiro foi um passo a passo para escolher a estrutura pelo objetivo, porque o catálogo da aba Estratégias é uma lista longa de nomes.

**Como ficou.** Um cartão "Não sabe por onde começar? Qual é o seu objetivo?" abre a aba, com seis objetivos: **renda com prêmios**, **proteger o que já tenho**, **apostar na alta**, **apostar na queda**, **lucrar com o ativo parado** e **lucrar com movimento forte**. Cada um mostra uma frase na voz da pessoa, um resumo de como o objetivo costuma ser buscado com opções, e as estruturas que costumam servir, cada uma com uma frase de razão, uma etiqueta de risco (risco limitado; perda limitada ao prêmio pago; exige ter as ações; vencimentos diferentes, com resultado estimado; risco grande se for contra) e o botão **Montar**, que seleciona o modelo na lista completa, logo abaixo. Objetivos com uma estrutura simples de uma perna (compra de call ou put) avisam que ela se monta em Séries da B3, com o botão C; renda e Roda apontam para a aba Roda.

**Decisões.** (1) O passo a passo **não elege** a melhor estrutura: lista as que costumam servir e mostra o risco de cada uma, no mesmo espírito da D99. (2) Straddle e strangle vendidos não aparecem em nenhum objetivo (risco ilimitado). (3) Os textos nunca prometem resultado: um teste barra "garantido", "sem risco", "certeza", "lucro certo" e "melhor estratégia"; o objetivo de renda diz que nenhuma estrutura garante renda.

**Código.** `domain/objetivosDeEstrategia.ts` (objetivos e etiqueta de perfil) e o cartão em `MonteSuaEstrategia.tsx`. 5 testes de domínio e 2 da tela.


## D114 (18/10/2026): glossário em linguagem simples no Simule Opções

**Pedido do responsável (18/10/2026).** Seguir com o próximo passo: a revisão dos textos em linguagem mais simples para quem está começando; combinou-se começar por um glossário curto.

**Como ficou.** Um glossário recolhível no fim da tela (aparece em todas as abas), com **30 termos** (opção, call, put, strike, prêmio, vencimento, exercício, americana e europeia, comprar e vender, dentro e fora do dinheiro, valor intrínseco e de tempo, crédito e débito, perna, trava, estrutura, ponto de equilíbrio, ganho e perda máximos, payoff, venda coberta e descoberta, margem de garantia, rolagem, roda, colchão, volatilidade implícita, delta, gama, teta, vega, lote e último preço). Cada termo tem uma explicação curta e, quando ajuda, um exemplo com números inventados (ativo "XPTO3"). Há **busca** (ignora acento e maiúscula; acha pelo nome, por sinônimos como "opção de compra", "theta" ou "ITM" e pelo texto da explicação, com o nome exato primeiro) e um botão **"Primeira vez com opções? Abrir o glossário"** no topo da tela, que abre e leva até ele.

**Decisões.** Os textos descrevem e não prometem resultado (há um teste que barra "garantido", "sem risco" e afins); a explicação de "último preço" diz que ele pode estar defasado, que é a razão de os números do app serem estimativas; a explicação de "margem de garantia" diz que o app não a calcula.

**Código.** `domain/glossarioOpcoes.ts` (termos e busca) e `screens/GlossarioOpcoes.tsx`. 6 testes de domínio e 3 da tela.

## D115 (20/10/2026): "Ver mais" no Top 15 de prêmios, com a continuação do ranking até 100

**O que mudou.** Abaixo da tabela do Top 15 há um card com o botão **Ver mais**, que mostra as posições 16 em diante do mesmo ranking, na mesma tabela (mesmas colunas, V e Simular), até **100 resultados**. Fechado, o card só diz quantas séries há a mais. **Mostrar menos** recolhe.

**Decisões.** Os filtros e a ordem são os mesmos do Top 15: a continuação é só o resto da lista, calculada de uma vez (100 posições) e fatiada, então a ordem das 15 primeiras não muda. O limite é 100 porque, mais abaixo, o rendimento já é baixo e a liquidez, fraca; o card avisa para conferir "Neg." e a chance de exercício. Sem mais de 15 séries, o card não aparece. O painel do botão V abre logo abaixo da tabela em que está a linha escolhida.

**Código.** `TAMANHO_MAXIMO_DO_RANKING` em `domain/premios.ts`; `screens/TopPremiosOpcoes.tsx`. 4 testes novos em `SimuleOpcoesPremios.test.tsx`.

## D116 (20/10/2026): escolha do vencimento no Top 15 de prêmios (mensal específico e W1 a W5)

**O que mudou.** Em **Mensais**, aparecem botões com **Todos** e um por vencimento mensal ainda a correr na base (até 6), com a data e os dias úteis (ex.: "19/11/2026 · 24 d.u."); o primeiro é o próximo vencimento. Em **Semanais**, aparecem **Todos, W1, W2, W4 e W5**. O padrão continua sendo mensais, todos.

**Decisões.** W é a ordem da sexta-feira no mês (1ª sexta = W1); se a sexta é feriado e o vencimento cai na quinta, vale a sexta seguinte. Não há W3: a 3ª sexta é o vencimento mensal. "Próximos 6 meses" e "Todos" dariam o mesmo resultado (a base só traz 6 meses), então só há "Todos". O filtro vale também para o card "Ver mais" (D115).

**Código.** `semanaDoMes`, `SEMANAS_DO_MES` e os campos `mensal` e `semana` do filtro em `domain/premios.ts`; botões em `screens/TopPremiosOpcoes.tsx`. 3 testes novos.

## D117 (20/10/2026): Top 15 prêmios de opções passa a abrir com código do mês

**O que mudou.** A aba Top 15 prêmios pede o **código do mês**, no mesmo molde do Top 15 de ações, FIIs e BDRs (D50, D65, D70): campo "CI-XXXX-XXXX", código salvo neste aparelho, aviso quando o salvo venceu, botão "Sair e trocar o código". Código próprio da lista (D66), em **`TOP15_OPCOES_CODIGOS`** na Vercel; o das outras listas não abre esta, e vice-versa. O gerador aceita `npm run codigo-top15 -- --classe opcoes`.

**Decisão que precisa de atenção.** Nas outras listas o ranking só existe no servidor. Aqui ele é **calculado no próprio app** a partir do arquivo de opções (`opcoes.json`), que é público e usado pelas demais abas. Por isso a função `api/top15-opcoes.ts` só **confere o código** e devolve a confirmação (`dados-privados/opcoes-premios.json`): o código controla o acesso à tela, mas **não esconde os dados de opções**, que continuam abertos. Proteger o ranking de fato exigiria calculá-lo no servidor (trabalho à parte). As abas Séries, Tendência, Gráficos, Roda, Estratégias e Minha posição continuam abertas.

**Operação.** Enquanto `TOP15_OPCOES_CODIGOS` não estiver configurada, a porta fica fechada (resposta 503: "A lista ainda não está disponível"), como nas outras listas. O filtro "só as mais baratas" dentro do ranking continua usando o código das ações (D98).

**Código.** `api/top15-opcoes.ts`, `dados-privados/opcoes-premios.json`, `vercel.json`, `acessoTop15.ts` (`buscarTop15Opcoes`, `CHAVE_CODIGO_TOP15_OPCOES`), `TopPremiosOpcoes.tsx` (porta + lista), `scripts/gerar-codigo-top15.mjs`. Testes: 1 de API, 5 de tela.

## D118 (22/10/2026): Simule Futuros (índice, dólar, juros e agro), com simulador e aba Tendência

**O que mudou.** Novo cartão no hub Simule Ativos, aberto por `?tela=simuleFuturos`. Cobre os contratos **cheios e minis**: Ibovespa (IND, WIN), dólar (DOL, WDO), juros (DI1) e agro (BGI boi gordo, CCM milho, ICF café). Duas abas: **Simulador** (resultado bruto de uma posição comprada ou vendida, em pontos ou preço, com a margem informada pela pessoa e tabela de cenários de ±1%, ±2% e ±3%; no DI, a conta é por taxa e PU) e **Tendência** (análise gráfica do contínuo: candles, médias de 21 e 80 (a de 80 em azul, contínua), suporte e resistência de 20 candles nas mesmas cores da análise técnica das ações, volume, IFR, ATR, posição na faixa e leitura alta/baixa/lateral pela mesma regra das ações, sobre a média e o retorno de 80 candles).

**Fonte.** Boletim de Preços da B3 (BVBG.086), o mesmo dos ETFs e BDRs. Conferido em 21/10/2026: IND, WIN, DOL, WDO, DI1, BGI, CCM e ICF vêm com preço de ajuste e ajuste anterior; abertura, máxima, mínima e último só nos contratos que negociaram. Os dados são de **fim de dia**, sem cotação intradiária.

**Decisões.** (1) O **contínuo** (INDFUT, WINFUT, DOLFUT, WDOFUT, DI1FUT, BGIFUT, CCMFUT, ICFFUT) é o vencimento de **maior posição em aberto** de cada dia; na troca de vencimento, os candles antigos são multiplicados pela razão entre o ajuste anterior do novo e o ajuste do antigo (sem salto falso). No DI não há ajuste: a série é a taxa. (2) A **margem não é publicada** no boletim: a pessoa informa. (3) A conta é **bruta**: sem corretagem, emolumentos e IR; no DI, aproximada (dias úteis sem feriados, sem o CDI sobre o saldo do ajuste). (4) Descritivo (D19): a leitura olha o passado, não prevê e não recomenda operar.

**Atenção antes de publicar.** Multiplicador, moeda e tick de `config/futuros.json` foram **conferidos em 22/10/2026 nas fichas do produto da B3** (WIN R$ 0,20 por ponto e tick 5; WDO US$ 10.000 e tick 0,5; DOL US$ 50.000 e tick 0,5; DI1 R$ 100.000 por taxa, tick 0,001 até 3 meses e 0,005 acima; BGI 330 arrobas e tick R$ 0,05; CCM 450 sacas e tick R$ 0,01; ICF 100 sacas em US$ e tick US$ 0,05). Só o IND (R$ 1,00 por ponto) não tem ficha própria e se apoia em material educacional da B3 e de corretoras. O job **só publica com `conferidoPeloResponsavel: true`** (já marcado). Rode uma vez o workflow **"Carga inicial de futuros"** e então o diário **"Atualizar futuros"**. Até lá o app mostra "dados ainda não carregados".

**Curva de juros do DI1 (22/10/2026).** Terceira aba, só no DI1: taxa ao ano de cada vencimento e taxa a termo entre vencimentos vizinhos. A taxa vem do **PU de ajuste** do pregão (mesmo critério para todos os vencimentos, negociados ou não) e, no pregão de 21/10, ficou a cerca de 0,01 ponto percentual do último negócio. Para isso a contagem de dias úteis passou a descontar os **feriados nacionais** (Carnaval, Sexta-feira Santa, Corpus Christi, Consciência Negra desde 2024 etc.); lei nova ou feriado extraordinário não entram, então segue sendo aproximação. Vencimentos com menos de 5 dias úteis ficam fora da curva. Código: `curvaDI`, `taxaATermo`, `resumoCurva` e o calendário em `domain/futuros.ts`; `ui/GraficoCurvaDI.tsx`; `CurvaDeJuros` em `screens/SimuleFuturos.tsx`.

**Código.** `scripts/atualizar-futuros.mjs` (job, com `--carga-inicial`), `config/futuros.json`, `historico/futuros.json` (gerado), `webapp-src/src/data/futuros.json` (gerado), workflows `atualizar-futuros.yml` e `carga-inicial-futuros.yml`; `domain/futuros.ts`, `ui/GraficoFuturo.tsx`, `screens/SimuleFuturos.tsx`. `b3-boletim.mjs` passou a exportar `lerTag` e aceitar um extrator próprio em `lerBoletim`. Testes: `atualizar-futuros.test.mjs`, `futuros.test.ts`, `SimuleFuturos.test.tsx`. **Não foram executados** na máquina onde foi escrito (sem Node instalado): rode `npm test` e `npm run typecheck` antes do primeiro commit.

## D119 (22/10/2026): Análise técnica, fundamentalista e confluência dentro do Simule Ações

**O que mudou.** O Simule Ações ganhou um segundo grupo de abas, **"Análise de uma ação"**: **Análise técnica**, **Análise fundamentalista** e **Confluência**, para uma ação por vez (a escolhida pela busca ou pelos atalhos das 10 mais negociadas), com o **horizonte** curto, médio ou longo nas abas técnica e de confluência. Os prompts de especificação (análise técnica e fundamentalista de ações da B3) foram implementados como **motores quantitativos determinísticos**: nada é gerado por IA, tudo vem de regras públicas, testadas e documentadas em `docs/15-metodologia-analise-acoes.md`.

**Exceção à D19.** A D19 mantém as telas de ações descritivas, sem ranking nem múltiplos. Como na D49, estas abas são uma **exceção declarada** pedida pelo responsável: trazem notas, valor justo, categoria e uma leitura final. Para ficarem no campo educacional, a leitura é sempre "do modelo", com justificativa, valor justo em **três cenários e faixa** (não preço-alvo único), confiança separada, alertas, e o aviso fixo de que não é recomendação. Os rótulos da leitura final ("Considerar entrada", "Aguardar preço mais atrativo", "Manter / acompanhar", "Reduzir exposição", "Evitar novos investimentos") vêm do prompt do responsável; **vale uma avaliação jurídica** de que isso, num app aberto, não se enquadra como recomendação de investimento (Resolução CVM 20) antes de divulgar a funcionalidade.

**Decisões.**
1. **Dados novos, em arquivos separados.** `acoes-series.json` (260 pregões de cada empresa do cadastro, com desdobramentos aplicados e o BOVA11 como referência) sai do mesmo job das Ações; `fundamentos.json` (5 exercícios e 12 meses por empresa, em R$ mil, e quantidade de ações por classe) vem de um **job novo** que lê a CVM. Os dois ficam em `public/dados/` e só são baixados ao abrir uma aba de análise: o app é um único HTML de 2,2 MB e não pode crescer 2 MB. Cobertura: 212 séries e 190 empresas com fundamentos (de 226 no cadastro).
2. **O pipeline auditado do Top 15 não foi tocado.** O job de fundamentos importa as funções de `acoes-baratas-calculo.mjs` e `acoes-baratas-cvm.mjs` sem alterá-las, para não mudar os hashes da auditoria; a extração própria guarda contas a mais (CAPEX, dividendos, balanço completo, contas de bancos).
3. **Validação com a auditoria.** Lucro e caixa operacional de 12 meses batem com o Top 15 em 95 de 96 empresas. Isso pegou erros reais, corrigidos: patrimônio e lucro de bancos (códigos diferentes), caixa operacional inflado (MGLU3), desdobramentos antigos virando "diluição" (BBAS3 ×2 em 2024, BBDC4 e outras), ações informadas em milhares (BBDC4) e quantidade de ações implausível.
4. **Sem inventar o que não existe.** Sem abertura no boletim: sem candles, e o gráfico é de faixa. Sem texto na CVM: vantagem competitiva, gestão, governança qualitativa, partes relacionadas, TAM e perspectivas aparecem como "dados insuficientes para conclusão" ou como indício financeiro rotulado. Sem série de 5 anos de preço: sem comparação com o múltiplo histórico da própria empresa. Sem IPCA no app: crescimento nominal.
5. **Taxa de desconto ancorada no mercado.** Custo do capital = Selic meta + 1 p.p. (±2 p.p. nos cenários) e crescimento terminal = IPCA de longo prazo do Focus + 0,5 p.p., lidos de `mercadoOficial.json`. Com a Selic em 13,75%, o valor justo fica conservador (VALE3, WEGE3 e ITUB4 aparecem acima do valor justo base); a tela explica a sensibilidade e a limitação para empresas de crescimento muito alto.
6. **Uma nota alta não neutraliza risco crítico, e problema de dado não é risco.** Alerta crítico limita a categoria a "Neutra"; dado ruim vira "dados insuficientes" e "manter/acompanhar", nunca "evitar".
7. **Convicção da confluência** separada da nota: duas leituras opostas dão convicção baixa, mesmo com nota combinada média.

**Operação.** Novo workflow `atualizar-fundamentos.yml` (terça a sábado, 01h47 de Brasília, com repetição às 10h17; sem mudança nos dados, sem commit). `atualizar-acoes.yml` e `carga-inicial-acoes.yml` passaram a versionar também `acoes-series.json`. `npm run atualizar-fundamentos` roda à mão. **Antes do primeiro deploy**, rode o workflow **"Atualizar Ações"** (gera `acoes-series.json` com o `historico/etfs.json` de referência) e **"Atualizar Fundamentos"**; os dois arquivos de hoje foram gerados localmente a partir do histórico e da CVM de 22/10/2026.

**Código.** `scripts/fundamentos-calculo.mjs`, `scripts/atualizar-fundamentos.mjs`, `.github/workflows/atualizar-fundamentos.yml`; em `atualizar-acoes.mjs`, `montarSeries` e `formatarSeries`; `domain/analiseTecnica.ts`, `domain/analiseFundamentalista.ts`, `domain/confluencia.ts`; `screens/AnaliseTecnicaAcao.tsx`, `AnaliseFundamentalistaAcao.tsx`, `ConfluenciaAcao.tsx`, `useAnaliseDaAcao.ts`; `ui/GraficoPrecoAcao.tsx`, `MiniGrafico.tsx`, `BlocosDeAnalise.tsx`, `formatoAnalise.ts`; `data/useArquivoDados.ts`. Testes: 28 (técnica), 32 (fundamentalista), 28 (confluência), 14 (telas), 19 (job de fundamentos) e 7 novos no job de Ações. Quatro testes antigos das listas Top 15 passaram a contar só as abas do grupo "O que você quer ver", porque agora há duas listas de abas na tela.

**Limitações conhecidas.** (a) O histórico de preços é de 12 meses: a média de 200 pregões mal existe e o gráfico mensal é sempre de baixa confiança; subir `MAXIMO_PREGOES_GUARDADOS` para 520 resolveria, ao custo de dobrar `acoes-series.json`. (b) 36 empresas do cadastro ficam sem fundamentos (sem CNPJ no FCA, sem negócio recente, demonstração defasada): a tela diz o motivo. (c) Bonificações que não coincidem com os fatores conhecidos (por exemplo, +13% no ITUB4) aparecem como "aumento de capital". (d) A comparação setorial só existe com 4 ou mais empresas no setor.

## D120 (22/10/2026): Gráfico de candles com histórico de até 5 anos (COTAHIST) na análise técnica

Pedido do responsável: o gráfico da análise técnica passou de linha para **candles**, com suporte (azul) e resistência (vermelho) em linha contínua fina e o preço na ponta, médias simples de 21 (amarela), 80 (rosa) e 200 (fúcsia tracejada), painéis de volume, IFR, MACD e estocástico pleno abaixo do preço, troca entre diário, semanal e mensal, zoom pela roda do mouse, arrasto e botões. A análise e a nota continuam calculadas sobre os 260 pregões do Boletim; só o **desenho** usa o histórico longo.

**Fonte.** COTAHIST da B3 (`https://bvmf.bmfbovespa.com.br/InstDados/SerHist/COTAHIST_AAAA.ZIP`), arquivo oficial, gratuito e sem chave, com **abertura real**, máxima, mínima, último preço, quantidade e volume de cada papel por pregão. Escolhida porque o Boletim de Preços (D23) não traz a abertura e guarda só 260 pregões. O job `atualizar-historico-acoes.yml` (sábado, mais disparo manual) baixa os anos necessários, lê o TXT em fluxo e grava `webapp-src/public/dados/acoes-historico/<TICKER>.json` para as ações do cadastro (220 de 226 na primeira carga, 22/10/2021 a 21/10/2026, cerca de 12 MB no total). O app baixa só o arquivo da ação aberta. Módulo de cálculo puro e testado: `scripts/historico-cotahist.mjs`.

**Desdobramentos e grupamentos.** O COTAHIST não os ajusta. O job aplica os de `config/acoes.json` e **detecta** os demais por três sinais no mesmo pregão (fator inteiro de preço, quantidade de ações na mesma proporção, volume em reais normal). Na primeira carga foram 28 eventos (por exemplo MGLU3 1:10 em 27/05/2024, CASH3 1:10, BHIA3 1:25 e HAPV3 1:15). Um falso positivo conhecido (queda da Americanas em 12/01/2023) está em `historicoLongo.ignorarEventos`. Bonificação com fator quebrado não é detectada; o que sobra de salto vai para `saltosRestantes` e aparece na tela. Detalhes e limites em `docs/15-metodologia-analise-acoes.md`.

**Junção com a série de 12 meses.** O gráfico usa o arquivo longo até o último dia dele e a série diária depois. Se os fechamentos das duas fontes na data em comum diferirem mais de 2%, descarta o arquivo longo (escalas diferentes).

**Fica para depois: gráfico de 60 minutos.** Não há fonte gratuita no projeto: a brapi, testada com o token do projeto em 22/10/2026, só libera o intervalo diário e períodos de até 3 meses no plano gratuito (60 minutos exige o plano Startup, R$ 119,99 por mês; vários anos de diário, o Pro). Sem fonte, a aba de 60 minutos e o 60 minutos na "Tendência por período" não foram feitos.

## D121 (23/10/2026): Sua HP12C no Simule Bens (resolvedor por voz/texto, banco de questões e calculadora RPN)

**Decisão.** O hub Simule Bens ganha o cartão **Sua HP12C** (`?tela=suaHp12c`), tela avulsa com duas abas. **Resolver problema:** a pessoa fala (reconhecimento de voz do navegador, pt-BR) ou escreve o enunciado; `domain/hp12cInterpretador.ts` descobre o tema por palavras-chave e números ("10 mil", "1,5% ao mês", "dois anos"), preenche os campos e `domain/matematicaFinanceira.ts` resolve mostrando a fórmula. São 13 temas (juros simples, compostos, exatos e contínuos; taxa equivalente, nominal/efetiva, acumulada e real; desconto racional/comercial, simples/composto; HP12C n-i-PV-PMT-FV; renda perpétua e diferida; VPL, TIR, TIRM, payback e lucratividade; SAC, Price, SAM e Americano) e 28 questões prontas filtráveis por assunto. **Calculadora HP-12C (RPN):** `domain/hp12cEmulador.ts` (motor) e `ui/Hp12cEmulador.tsx` (teclado), com pilha X-Y-Z-T, LAST X, STO/RCL 0–9, f/g, BEGIN/END, n/i/PV/PMT/FV, 12×/12÷, INT, %, Δ%, %T, yˣ, 1/x, √x, eˣ, LN, FRAC, INTG, x², n!, CFo/CFj/Nj, NPV e IRR.

**Convenções.** Mês comercial de 30 dias, ano de 12 meses, taxas em %. Sinais como na HP12C (entra no caixa é positivo; a parcela tem sinal contrário ao do valor financiado). Em n calculado o emulador arredonda para cima, como a calculadora. Quando o enunciado não diz "simples" nem "composto", o interpretador usa composto e avisa.

**Limites.** É uma réplica do comportamento, não o emulador oficial da HP: não há programação (R/S, SST, PRGM), estatística, datas, AMORT nem a convenção de juros com prazo fracionário (flag C). A leitura do enunciado é heurística: a tela mostra os campos preenchidos para a pessoa corrigir. A voz depende do navegador (Chrome/Edge/Safari); sem ela, fica o campo de texto. Os temas vêm da estrutura das aulas 00 a 06 do curso (SEFAZ-RJ) e das fórmulas padrão de matemática financeira.

**Código.** `domain/matematicaFinanceira.ts`, `hp12cInterpretador.ts`, `hp12cEmulador.ts`; `screens/SuaHp12c.tsx`; `ui/Hp12cEmulador.tsx`; registro em `App.tsx` e `state/useAppState.ts`; cartão em `screens/SimuleBens.tsx`. Testes: 15 (matemática), 10 (interpretador), 19 (emulador), 11 (tela) e o hub atualizado.

## D122 (25/10/2026): Top 15 ações pagadoras de dividendos (dividend yield de 12 meses), com "Ver mais" até a 100ª posição

**Pedido do responsável (25/10/2026).** Instalar na aba Simule Ações o ranking das 15 ações que mais pagam dividendos, avaliar se os dados vêm da B3 ou da CVM, conferir o resultado contra o Investidor10 e incluir o botão "Ver mais" para quem quiser ver as posições abaixo.

**Fonte: B3, não CVM.** A CVM só traz o dividendo **pago** no exercício (DFC 6.03), em valor total, sem data com e sem valor por ação: serve ao payout da análise fundamentalista, não a um yield por ação com janela de 12 meses. A B3 publica, por empresa, cada provento com classe, tipo, valor por ação e data com. Duas listas públicas, que o job une: o histórico (`GetListedCashDividends`, por nome de pregão) e o cadastro da empresa (`GetListedSupplementCompany`, pelo código de quatro letras, com o ISIN de cada classe). Nenhuma basta sozinha (o histórico não devolve nada pelo nome atual de Ambev, Klabin e outras, e demora a listar o provento já aprovado e ainda não pago; o cadastro só guarda os recentes).

**Desenho.** Mesmo molde da D94 e da D89:
1. **Config** `config/acoes-dividendos.json` (v1.0.0): janela de 365 dias, liquidez mínima de R$ 3 mi por dia (21 pregões), tipos que entram (dividendo, JCP bruto e rendimento; restituição de capital não), alerta de yield acima de 20%, trava de sanidade e aviso. Universo: o cadastro de `config/acoes.json` (bancos e seguradoras entram).
2. **Leitor da B3** `scripts/b3-proventos.mjs`: monta o endereço (base64 em URL), lê com validação de formato (erra em vez de adivinhar), une as duas listas e dá o sha256 do texto bruto. Sem o cabeçalho `accept: application/json`, porque com ele a B3 devolve o JSON dentro de uma string.
3. **Cálculo puro** `scripts/acoes-dividendos-calculo.mjs`: classe pelo código (3 ON, 4 PN, 11 UNT...), soma por ação na janela, ajuste por desdobramento posterior ao provento (os `ajustes` do COTAHIST, D120), exclusões com código e motivo, ordem por yield.
4. **Job** `scripts/atualizar-acoes-dividendos.mjs` + verificador `scripts/acoes-dividendos-verificar.mjs` + workflow `atualizar-acoes-dividendos.yml` (terça a sábado 03h15 UTC, 00h15 de Brasília, depois das endividadas): **com rede** (a B3), uns 3 minutos. Auditoria da D89 (pasta completa só na primeira execução do mês ou se mudarem parâmetros ou código; nos outros dias, conferência independente em memória).
5. **App:** aba "Top 15 pagadoras de dividendos" (sexta aba do Simule Ações), `Top15Dividendos.tsx`: cartões com yield, proventos por ação, número de pagamentos e "Cada provento que entrou na soma" (data com, tipo, valor, e a conta fechada); card **Ver mais** com as posições 16 a 100 em linhas compactas, cada uma abrindo os proventos; busca de ação fora do Top; auditoria e aviso. Código e cotação em amarelo (D90).
6. **Docs:** `docs/16-metodologia-acoes-dividendos.md`.

**Conferência com o Investidor10 (25/10/2026).** 97 ações em comum: diferença média de **0,14 ponto percentual**, 92 dentro de 0,5 e **todas dentro de 1**. O que sobra é o preço (eles usam a cotação do dia, nós o fechamento de 22/10; GRND3: 32,56% × 4,57 ÷ 4,67 = 31,87%, o número deles). A conferência achou **quatro erros nossos**, todos corrigidos e com teste: (a) linhas iguais da B3 descartadas como duplicidade (são parcelas: Cemig dava 5,5% contra 9,8%); (b) desdobramento 5:1 da Sabesp sem ajuste (10,9% contra 2,2%); (c) provento aprovado e não pago ausente do histórico (ISAE4, SANB11, PINE4, ALOS3), resolvido com a segunda lista; (d) séries A04OR/A05OR do Banco do Brasil triplicando o BBAS3 (8,7% contra 2,8%). Também o código `B3SA3`, que tem dígito no meio, não era reconhecido.

**Primeira rodada (preços de 22/10/2026).** Universo 226, 124 com proventos, 100 no ranking. Top 15: GRND3 (32,6%), LOGG3 (23,1%), POMO4 (20,9%), VULC3 (19,4%), MDNE3 (15,9%), LAVV3 (15,8%), EVEN3 (15,7%), RECV3 (13,9%), DIRR3 (13,7%), CURY3 (13,5%), SHUL4 (12,6%), BRAP4 (12,5%), FIQE3 (11,1%), UNIP6 (11,0%) e BBSE3 (10,6%). Verificação independente OK.

**Publicação.** `aprovadoPeloResponsavel` começou `false` (regra do projeto; D22 pede parecer independente de terceiros antes de divulgar em escala). **Aprovada pelo responsável em 25/10/2026**, no mesmo dia, com acesso aberto e o aviso proposto sem alterações: `true` na versão 1.1.0 (`publicacao.aprovacao`; nenhuma regra de cálculo mudou), sem parecer independente de terceiros. O JSON do app foi gerado já publicado, com a auditoria completa regravada.

**Limites.** (a) Data com, não data de pagamento: um provento com data com depois do último pregão da base só entra no dia seguinte. (b) Provento extraordinário entra como qualquer outro e infla o yield (a tela avisa acima de 20% e mostra cada data). (c) Bonificação em ações e desdobramento de fator quebrado não entram nem são ajustados. (d) 27 empresas do cadastro (PRIO3, CSAN3, CSNA3, BRKM5, BHIA3, AMER3, DASA3 e outras) saem com `sem_dados_b3`; a B3 não publica proventos para elas. (e) Ambev, Klabin e Cury ficam com `historico_parcial`: só vale o cadastro da empresa, que cobre os últimos meses. (f) Depende de uma API pública da B3 sem contrato de estabilidade: se o formato mudar, o leitor erra e o job falha sem publicar. (g) Um código por empresa (a classe mais negociada do cadastro).

**Testes.** `scripts/acoes-dividendos.test.mjs` (35): leitor e união das listas, URL, nova tentativa e JSON codificado duas vezes, conta feita à mão, parcelas, restituição de capital, desdobramento (Sabesp), cada exclusão, trava de sanidade, auditoria, modo diário, verificador pegando arquivo adulterado. Web: `Top15Dividendos.test.tsx` (13) + cinco testes existentes ajustados para seis abas.

## D123 (25/10/2026): Top 15 confluência (positivas e negativas), ao lado da aba Confluência

**Pedido do responsável (25/10/2026).** Um "Top 15 confluência" ao lado da aba Confluência, com escolha entre positivas e negativas e botão "Ver mais".

**Desenho.** Diferente dos outros Top 15, **não há job, auditoria em pasta nem workflow**: o ranking é calculado no aparelho, com os mesmos arquivos que a aba Confluência já baixa (`dados/acoes-series.json` e `dados/fundamentos.json`) e as mesmas funções (`analisarTecnica`, `analisarFundamentos`, `analisarConfluencia`), então o número de cada ação é igual nas duas telas. Módulo puro `domain/confluenciaRanking.ts`; tela `screens/Top15Confluencia.tsx`; aba "Top 15 confluência" no grupo "Análise de uma ação" do `SimuleAcoes.tsx`.

**Regras.** Positiva = situação `confluencia-positiva` (fundamentos favoráveis e gráfico a favor), da maior nota combinada para a menor. Negativa = `confluencia-negativa`, da menor nota para a maior. Empate: maior convicção, depois ordem alfabética. A nota usa os pesos do horizonte escolhido (curto 30/70, médio 50/50, longo 70/30). Ações de liquidez baixa saem (sinal técnico pouco confiável); ações sem as duas análises também. Mostra 15 cartões e "Ver mais" com o resto da lista.

**Limites.** Sem aprovação do responsável nem código de acesso (a lista só reordena análises já publicadas); sem auditoria congelada, o resultado muda com os arquivos do dia. Confluência negativa não é sinal de venda. Cortes e ordem são escolhas do assistente, a rever pelo responsável. Primeira leitura (horizonte médio, 23/10/2026): 183 ações avaliadas, 25 positivas, 7 negativas, 10 fora por liquidez.

**Testes.** `Top15Confluencia.test.tsx` (3: Ver mais, alternância, horizonte e lista vazia); teste das abas de análise ajustado para quatro abas.

## D124 (25/10/2026): Dividend yield da análise da ação passa a usar os proventos da B3

**Problema (responsável).** O DY de 12 meses da tela de análise não batia com o Investidor10: FIQE3 mostrava 4,2% contra 11%. A tela dividia os dividendos **pagos na DFC** (6.03, por exercício) pelo valor de mercado; o ranking de dividendos (D122) e o Investidor10 somam os proventos **por ação com data com** nos últimos 12 meses ÷ cotação (FIQE3 no ranking: 11,06%).

**Decisão.** A análise usa o DY da B3 (o mesmo do ranking). O job `atualizar-acoes-dividendos` agora baixa os proventos de **toda ação com preço** (o filtro de liquidez continua só no ranking) e grava `dyPorTicker` com o DY de cada uma (0 se não pagou na janela). A análise lê `dyPorTicker` (`dyB3` em `analisarFundamentos`); sem ele (sem preço ou sem proventos publicados na B3), cai no DY da DFC, e o texto do indicador diz de onde veio. Payout e proventos ÷ FCF seguem na DFC, que é a medida de caixa. Ranking e Top 15 não mudaram.

**Cobertura.** 151 de 226 ações do cadastro com o DY da B3. Ficam na DFC as 29 sem preço recente, as 27 sem proventos publicados na B3 e as que não têm classe identificada.

**Testes.** `acoes-dividendos.test.mjs` (35; o de `montarInsumos` agora espera baixar quem não tem liquidez). Web: suíte inteira verde.

## D125 (28/10/2026): aba "Preço teto de compra" no Simule Ações

**Pedido (responsável).** Uma aba com o preço teto de compra, um radar que fica verde quando a ação cai abaixo do teto e uma notificação no celular. Preocupação: o teto não pode contradizer a análise fundamentalista.

**Decisão.** Dois métodos, escolhidos entre Bazin, Graham e Gordon. **Bazin é o gatilho** (dividendo médio por ação ÷ retorno mínimo, 6% clássico, ajustável a 8, 10 ou 12%); **Graham confirma** (√(22,5 × LPA × VPA)) e vira o gatilho só para quem não paga dividendos. **Gordon ficou de fora**: explode quando r − g é pequeno e g é chute. O dividendo de Bazin é a média dos últimos 5 exercícios da DFC ÷ ações atuais; com menos de 3 exercícios cai para os proventos de 12 meses da B3 e a tela marca "histórico curto".

**Consistência com a fundamentalista (revista após auditoria, 28/10/2026).** O teto lê a MESMA `analisarFundamentos` da aba ao lado, e a **leitura final dela é o juiz**: o verde só acende se o preço está abaixo do teto **e** a fundamentalista diz "considerar entrada" (o que já exige margem de segurança de 25%, valor justo de confiança média ou alta, categoria atrativa e nenhum alerta crítico). Qualquer outra leitura (aguardar preço, manter, reduzir, evitar) vira "Abaixo, mas sem aviso", com a justificativa da própria fundamentalista. O amarelo ("perto") some onde ela diz evitar ou reduzir. Se a fundamentalista vê margem e o preço está acima do teto, a mensagem diz que o aviso só liga quando as duas concordam. O cartão mostra sempre a leitura final da fundamentalista ao lado do teto.

**Auditoria.** A primeira regra (preço abaixo do valor justo base) deixava 18 ações verdes, 5 com "aguardar preço" e 9 com valor justo de baixa confiança: contradição. `precoTeto.coerencia.test.ts` roda as duas análises em TODAS as ações do cadastro, com os dados publicados, e falha se alguma regra de coerência for quebrada.

**Dividendo recente (ressalva, não veto).** Se os proventos dos últimos 12 meses (B3) são menos de 70% da média dos exercícios, o cartão mostra "com ressalva", a notificação a repete e o quadro de cálculo traz o teto de Bazin com o dividendo recente. Não bloqueia o verde: vetar por isso faria o teto contradizer a fundamentalista no sentido inverso.

**Aviso (fase 1).** Lista de ações acompanhadas e radar, guardados no aparelho (`localStorage`). O aviso é notificação do navegador, se permitida, mais faixa na tela, e só dispara quando a pessoa abre o app: quem entra abaixo do teto é avisado uma vez, e volta a ser avisado se sair e entrar de novo. **Fase 2, pendente:** push com o app fechado exige service worker, chaves Web Push, guardar o aparelho (o projeto já tem Redis) e um job depois do fechamento; no iPhone só com o app instalado.

**Arquivos.** `domain/precoTeto.ts` (puro), `screens/PrecoTetoAcoes.tsx`, aba "Preço teto de compra" no `SimuleAcoes.tsx`. Testes: `precoTeto.test.ts` (16) e quatro casos novos em `SimuleAcoesAnalise.test.tsx`.

**Limites.** Bazin com média de 5 anos puxa dividendos extraordinários (PETR4 aparece com teto de R$ 132 contra preço de R$ 58); a taxa de 6% é permissiva com a Selic alta. Não é recomendação (D19).

**Em observação e cobertura (28/10/2026).** Abaixo do teto mas sem "considerar entrada" a ação entra na lista recolhível "Em observação", com o motivo da própria fundamentalista; ela não fica verde nem gera aviso. Teto acima de 5× o preço vira ressalva de dividendo atípico (ex.: PTBL3 com teto de R$ 9.408 contra preço de R$ 1,76), sem vetar. Diagnóstico das 191 ações: 135 têm valor justo de confiança baixa (faixa entre cenários larga em 88, só um método aplicável em 68, nenhum método em 35), e só 10 chegam a "considerar entrada". O radar pequeno vem daí, não do teto: ampliar o radar exige melhorar a cobertura do valor justo, não afrouxar regras.

**Causa da baixa cobertura do valor justo (investigada em 28/10/2026).** O segundo método (P/L do setor) exige a mediana de pelo menos 4 outras empresas do mesmo setor com P/L positivo, e o cadastro (`config/acoes.json`) tem setores pequenos: 36 setores, a maioria com 3 a 6 empresas. Cerca de 70 das 191 ações ficam sem P/L setorial por isso (Alimentos e bebidas, Shoppings, Calçados, Papel e celulose, Locação, Farmácias, Transmissão, Software, Siderurgia, entre outros) e dependem só do fluxo de caixa descontado, que falha quando o fluxo de caixa livre é negativo ou instável. Com um método só, ou nenhum, a confiança cai para baixa. Os demais motivos (faixa entre cenários larga, métodos divergentes) vêm da incerteza do próprio modelo e **não** são cobertura. **Decisão:** não baixar o mínimo de 4 pares, não aceitar mediana de outro setor nem afrouxar os limites de confiança, porque isso criaria valor justo e verde sem base. O caminho correto é ampliar o cadastro nos setores com poucas empresas (dado, não regra); fica como pendência de decisão do responsável, porque mexe na lista que alimenta todas as telas e exige rodar os jobs de dados.

**D126 (28/10/2026): comparação por grupo B3 e ampliação do cadastro.** Pedido do responsável após o diagnóstico de cobertura. (1) **Cadastro** (`config/acoes.json`): entram SOJA3 (Boa Safra Sementes, em Agronegócio), HBRE3 (HBR Realty, em Shoppings e imóveis comerciais) e JSLG3 (JSL, em Transporte e infraestrutura); LOGG3 (LOG Commercial Properties, empresa de exploração de imóveis, segmento do setor financeiro) sai de "Serviços e locação de equipamentos" e vai para "Shoppings e imóveis comerciais". Os dados dessas ações só existem em `fundamentos.json` depois que o job `atualizar-fundamentos` rodar. (2) **Regra** (`GRUPOS_B3` em `analiseFundamentalista.ts`): se o setor não tem 4 pares com o múltiplo, a mediana vem do grupo B3 do setor (Tecidos, vestuário e calçados; Materiais básicos; Energia elétrica: geração e transmissão; Petróleo, gás e biocombustíveis; Comércio de alimentos e medicamentos; Alimentos processados; Tecnologia da informação; Locação e serviços; Construção; Seguros, bolsa e serviços financeiros). O mínimo de 4 pares, a separação entre financeiras e não financeiras e todos os limites de confiança continuam iguais. O método aparece como "P/L do grupo B3" com o motivo na premissa, e o cartão do preço teto mostra a ressalva (não veta). **Efeito medido nos dados de 28/10/2026 (antes do job novo):** valor justo com confiança baixa 135 → 96 (média 37 → 61, alta 19 → 34); ações com 2 métodos 62 → 102 (as sem nenhum método caíram de 35 para 31); "considerar entrada" 10 → 20; radar verde 7 → 15. O teste de coerência com dados reais continua passando: nenhum verde contradiz a fundamentalista. **Risco assumido:** o grupo B3 é um comparador mais largo que o setor; a ressalva visível e a checagem de divergência entre métodos (1,6×) são a contrapartida. Se o radar de 15 parecer generoso, o ajuste conservador é contar o uso do grupo como um motivo de confiança a mais.

**"Falta cair X% para entrar" (28/10/2026).** Os cartões do preço teto e a lista "Em observação" mostram quanto o preço precisa cair, e até qual valor, para a análise fundamentalista (preço de entrada com margem de 25%) e o teto de dividendos concordarem; indica qual trava está mais longe. Só aparece com valor justo de confiança média ou alta, sem alerta crítico e com leitura "aguardar", "manter" ou "considerar entrada"; com "evitar" ou "reduzir" não faz sentido e não aparece. Exemplo: BBAS3 a R$ 17,38 mostra "falta cair 0,7% (até R$ 17,25)". É só informação: não muda o verde nem o aviso. O teste de coerência garante que quem está verde nunca mostra "falta cair".

## D127 (28/10/2026): aviso de preço teto com o app fechado (fase 2)

**Pedido (responsável).** Receber no celular o aviso de que uma ação acompanhada entrou abaixo do preço teto, mesmo com o app fechado.

**Como funciona.** (1) O app registra um service worker (`webapp-src/public/sw.js`, publicado em `/app/sw.js`) que só recebe e mostra notificações; não guarda cache nem intercepta pedidos. (2) Ao tocar em "Ligar aviso no celular" na aba Preço teto, o navegador cria uma inscrição de push com a chave pública VAPID (`GET /api/push-chave`) e o app a envia, com os códigos acompanhados e a taxa de Bazin, a `POST /api/push-inscrever` (`DELETE` desliga). (3) O servidor guarda no Redis, por aparelho (`push:a:<hash do endpoint>`, índice `push:todos`): endereço de entrega e chaves do navegador, códigos, taxa, quem já foi avisado e a data; expira em 90 dias sem o app ser aberto. (4) O job `.github/workflows/avisar-preco-teto.yml` roda depois de cada execução bem-sucedida de "Atualizar Ações" (preço novo), calcula o preço teto de cada taxa com o **mesmo código da tela** (`domain/precoTetoLote.ts`: `calcularItensPrecoTeto`, `avisoDoAparelho`) e envia o aviso a quem acabou de entrar no verde. Vários de uma vez viram uma só notificação. (5) Endereço recusado pelo navegador (404 ou 410) apaga o aparelho; falha temporária não marca como avisado e tenta de novo na execução seguinte.

**Consistência.** O aviso usa a mesma regra do verde da tela (a fundamentalista é o juiz) e a mesma conta de "quem já foi avisado". Com o push ligado, a tela deixa de disparar a notificação do navegador ao abrir o app (o aviso na faixa da tela continua), para o mesmo evento não avisar duas vezes.

**Segurança e privacidade.** Só endereços dos serviços de push de Google, Mozilla, Apple e Microsoft são aceitos, na API e no job (sem isso o job poderia ser usado para chamar qualquer endereço: SSRF). Limite de 40 chamadas por IP a cada 15 minutos; no máximo 60 códigos; taxa só entre as quatro do app. Nada de nome, e-mail, IP ou dado de carteira. A política de privacidade ganhou a seção 5B (opcional, o que é guardado, por quanto tempo e como apagar). A chave privada VAPID vive só nos secrets do GitHub.

**Para ligar em produção** (nada funciona até isto ser feito; sem as variáveis a API responde 503 e o job termina sem erro): `npm run gerar-chaves-push`; `VAPID_PUBLIC_KEY` na Vercel (Production e Preview) e novo deploy; secrets do GitHub `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:), `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (iguais aos da Vercel). Para testar: ligar o aviso no celular e rodar o workflow "Avisar Preço Teto" no modo `teste`; o modo `simular` mostra o que seria enviado sem enviar.

**Limites.** O aviso chega uma vez por dia, depois do fechamento (o preço do app é de fechamento). No iPhone só funciona com o app instalado na tela inicial (iOS 16.4 ou mais novo). Quem desinstala o app ou revoga a permissão sai do índice quando o navegador recusa a entrega. O aviso é informação, não recomendação.

**Arquivos.** `api/_push.ts`, `api/push-chave.ts`, `api/push-inscrever.ts`, `scripts/avisar-preco-teto.mjs`, `scripts/gerar-chaves-push.mjs`, `webapp-src/src/data/pushPreco.ts`, `webapp-src/src/domain/precoTetoLote.ts`, `webapp-src/public/sw.js`, `privacidade/index.html`. Testes: `scripts/avisar-preco-teto.test.mjs` (11, com Redis falso), `webapp-src/src/data/pushPreco.test.ts` (7).
