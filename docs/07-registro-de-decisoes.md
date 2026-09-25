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
