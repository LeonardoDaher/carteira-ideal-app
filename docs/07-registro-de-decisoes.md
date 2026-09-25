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
