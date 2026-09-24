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

**Contexto.** Nova aba (🏢 "Simule FII") para o cliente ver, para os 10 maiores FIIs do IFIX, a cotação, o último rendimento, a média dos últimos 3 meses e a renda mensal estimada para 10 a 5.000 cotas (ou uma quantidade livre).
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
