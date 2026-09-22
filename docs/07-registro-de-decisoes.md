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
