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
