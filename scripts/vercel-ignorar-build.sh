#!/usr/bin/env bash
# Usado como "ignoreCommand" no vercel.json. Convenção da Vercel: sair com 0 PULA o build; sair com 1 faz o build.
# Pula só quando o commit mexeu APENAS em arquivos que o site não usa (docs, auditoria, histórico, divulgação,
# workflows, notas .md/.txt da raiz). Na dúvida (sem commit anterior, erro no git), faz o build.
set -u
arquivos=$(git diff --name-only HEAD^ HEAD 2>/dev/null) || { echo "[ignorar-build] sem commit anterior: publicando"; exit 1; }
[ -z "$arquivos" ] && { echo "[ignorar-build] commit sem arquivos alterados: publicando"; exit 1; }
if echo "$arquivos" | grep -Evq '^(docs/|auditoria/|historico/|divulgacao/|\.github/|[^/]+\.md$|LEIA-ME[^/]*\.txt$|ARQUIVOS-ALTERADOS[^/]*\.txt$)'; then
  echo "[ignorar-build] o commit mexe em arquivos do site: publicando"
  exit 1
fi
echo "[ignorar-build] só docs/auditoria/histórico/divulgação: pulando o deploy"
exit 0
