# 5. Publicação e operação

Tudo abaixo pode ser feito **pelo navegador**, sem terminal.

## 5.1 Primeira publicação

### Passo A · Subir os arquivos para um repositório privado no GitHub

1. GitHub → **+** → **New repository** → nome `carteira-ideal-app` → **Private** → sem README → **Create repository**.
2. Clique em **"uploading an existing file"**.
3. O GitHub aceita **no máximo 100 arquivos por envio** e este projeto tem mais que isso. Faça em **dois envios**:
   - **Envio 1:** abra a pasta do projeto, selecione **tudo, exceto a pasta `docs`** (Ctrl+A e depois Ctrl+clique em `docs` para desmarcá-la), arraste para o navegador → **Commit changes**.
   - **Envio 2:** no repositório, **Add file → Upload files**, arraste a **pasta `docs` inteira** → **Commit changes**.
4. Arraste sempre o **conteúdo** da pasta do projeto, nunca a pasta em si. A página inicial do repositório deve mostrar `api`, `assets`, `docs`, `scripts`, `webapp-src`, `index.html`, `package.json` e `vercel.json` logo no primeiro nível.

### Passo B · Publicar na Vercel

1. Em **vercel.com/new**, entre com a conta do GitHub.
2. Autorize a Vercel a ver o repositório `carteira-ideal-app` (mesmo sendo privado; o plano gratuito aceita repositórios privados da conta pessoal).
3. Selecione o repositório → **Deploy**. Não altere nenhuma configuração: o `vercel.json` já informa o comando de build e a pasta de saída.
4. Ao final, a Vercel mostra um endereço como `carteira-ideal-app.vercel.app`.

### Passo C · Testar antes de divulgar

No celular, pelo endereço da Vercel: landing → botão amarelo → 14 perguntas → resultado → abas Carteira, Simular e Aprender → abrir uma aula e ver o vídeo tocar.

### Passo D · Ajustar o endereço de compartilhamento

No `index.html` da raiz, as linhas `og:image` e `og:url` ainda apontam para `leonardodaher.github.io/Carteira-Ideal`. Troque pelo endereço novo (ver 5.2). Sem isso, a prévia do link no WhatsApp/LinkedIn fica sem imagem.

### Passo E · Colocar o link na bio do Instagram

Só depois dos passos C e D.

## 5.2 Como editar qualquer arquivo pelo navegador

1. No GitHub, abra o arquivo e clique no **lápis** (Edit).
2. Altere o texto.
3. **Commit changes**.
4. A Vercel detecta a mudança e publica sozinha em 1 a 2 minutos. O andamento aparece na aba **Deployments** do projeto na Vercel.

## 5.3 Onde mudar cada coisa

| Quero mudar... | Arquivo |
|---|---|
| Botões, textos e links da landing | `index.html` (raiz) |
| Cores e visual da landing | `style.css` (raiz) |
| Livro infantil em PDF | Substituir `assets/livro-os-tres-potes-de-duda.pdf` por um arquivo **com o mesmo nome** |
| Texto das 7 perguntas de suitability | `webapp-src/src/data/questions.ts` |
| Texto das 7 perguntas de Arquitetura Patrimonial | `webapp-src/src/data/perguntasArquitetura.ts` |
| Descrição das 11 classes de ativos | `webapp-src/src/data/assets.ts` |
| Aulas, trilhas e vídeos | `webapp-src/src/data/trilhas.ts` (campo `youtubeId` = o código depois de `v=` no link do YouTube) |
| Carteiras-modelo, pesos, veto, travas | `webapp-src/src/domain/engine.ts` ⚠️ ver abaixo |

⚠️ **Mudanças no motor (`engine.ts`) mudam a recomendação de todos os usuários.** Antes de alterar: registre o motivo no [Registro de decisões](07-registro-de-decisoes.md), atualize a [Metodologia](02-metodologia.md) e peça a quem desenvolve para rodar `npm run test`, porque vários testes conferem os percentuais atuais e precisarão ser ajustados junto.

## 5.4 Se algo der errado depois de uma atualização

Na Vercel: **Deployments** → escolha a última versão que funcionava → menu **⋯** → **Promote to Production** (ou "Instant Rollback"). O site volta à versão anterior em segundos. Depois, corrija o arquivo com calma no GitHub.

Se o build falhar, a Vercel mantém no ar a última versão boa e mostra o erro em **Deployments → (versão com erro) → Build Logs**.

## 5.5 Para quem desenvolve (terminal)

```bash
npm install          # uma vez
npm run dev          # só a interface (sem API: o cálculo falha de propósito com "Tentar novamente")
vercel dev           # interface + API, igual à produção (requer: npm install -g vercel)
npm run test         # 52 testes
npm run typecheck    # tipos do app e da API
npm run build        # build de produção em dist-site/
```
