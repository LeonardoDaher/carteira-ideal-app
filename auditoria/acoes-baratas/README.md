# Auditoria da triagem "Top 15 ações mais baratas"

Cada pasta `AAAA-MM-DD/` é uma execução do job `scripts/atualizar-acoes-baratas.mjs` (data = último pregão usado). `ultima.json` aponta a mais recente. **Os arquivos desta pasta são gerados; não edite à mão** (o manifesto guarda o sha256 de cada um e a verificação acusa qualquer alteração).

- O que cada arquivo contém e como verificar: `docs/09-metodologia-acoes-baratas.md`, seção 9, e o `LEIA-ME.md` dentro de cada execução.
- Verificar a última execução, sem internet: `npm run verificar-acoes-baratas`.
- Conferência manual contra a CVM: `conferencia-manual-modelo.md`.

**Tamanho.** `insumos.json.gz` e `memoria-de-calculo.json.gz` são compactados. Com execução mensal o crescimento é pequeno, mas se o repositório pesar demais, mantenha as execuções que serviram de base a uma publicação ou a uma conferência manual e arquive as demais fora do Git (os hashes dos arquivos arquivados continuam no `manifesto.json`).

**Terceiros.** Uma pasta de execução é autossuficiente: com ela, `scripts/acoes-baratas-calculo.mjs` e `scripts/acoes-baratas-verificar.mjs` (só esses dois) qualquer pessoa refaz o cálculo e confere os hashes, sem internet e sem o restante do repositório: `node scripts/acoes-baratas-verificar.mjs <pasta>`.
