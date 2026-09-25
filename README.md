# Carteira Ideal

Landing de "link na bio" do Instagram + app **Carteira Ideal** (perfil de investidor e carteira de
referência). Conteúdo educacional, não é recomendação de investimento.

> 📚 **Documentação completa em [`docs/`](docs/README.md)**: visão geral, metodologia, arquitetura, jornada do cliente com todas as telas, guia de publicação e operação, próximos passos e registro de decisões.

```
index.html          landing (link na bio)
style.css           estilos da landing
script.js           tema claro/escuro e botão "já respondeu"
assets/             logo, fundos, fontes, imagem de compartilhamento e o livro em PDF
webapp-src/         código-fonte do app (React + Vite) — inclui o motor de decisão em src/domain/engine.ts
api/                função serverless (Vercel) que roda o motor — nunca vai para o navegador
scripts/build-site.mjs   monta a pasta final publicada: landing na raiz + app compilado em /app
scripts/atualizar-rendimentos-fii.mjs   job mensal da aba "Simule FII" (CVM + brapi → JSON estático)
config/fiis-ifix.json    os 10 FIIs em destaque (IFIX) e os parâmetros da lista ampla da busca livre
.github/workflows/  job do GitHub Actions que roda o script acima todo dia 20
docs/               documentação do projeto (comece por docs/README.md)
```

## Computador e instalação como aplicativo (D20)

O app se adapta à tela: no celular continua a coluna única de sempre; a partir de 960 px de
largura as telas de painel (Resultado, Carteira, Simular, Simule Tesouro/FII/BDR) viram duas
colunas e a barra de abas vira um menu lateral fixo à esquerda. Todo o CSS dessa adaptação está no bloco "D20" no
fim de `webapp-src/src/index.css`. O app também pode ser instalado (Chrome/Edge: ícone
"Instalar" na barra de endereço), pelo `webapp-src/public/manifest.webmanifest`. Detalhes em
`docs/07-registro-de-decisoes.md`, decisão D20.

## Por que a hospedagem mudou de GitHub Pages para Vercel

Versões anteriores deste projeto rodavam 100% no GitHub Pages, com o app compilado como um único
arquivo HTML estático (`app/index.html`) contendo *todo* o motor de decisão — matrizes de alocação,
regra de veto, pesos das perguntas — em JavaScript legível por qualquer pessoa que abrisse
"Ver código-fonte" no navegador, ou o próprio repositório no GitHub (que precisa ser público para o
GitHub Pages gratuito funcionar).

Agora o motor de decisão (`webapp-src/src/domain/engine.ts`) só roda dentro da função serverless em
`api/recomendacao.ts`. O app no navegador manda as respostas por `fetch()` e recebe de volta só o
resultado já calculado. **GitHub Pages não hospeda funções serverless** — por isso a publicação
precisa ser em uma plataforma como a Vercel.

## Publicar na Vercel

1. Suba este repositório para o GitHub/GitLab/Bitbucket como **privado**. Isso é importante: mesmo
   com o motor protegido no bundle do navegador, um repositório público ainda expõe o
   `engine.ts` para quem ler o código no próprio GitHub.
2. Em https://vercel.com/new, importe o repositório.
3. A Vercel usa automaticamente o `vercel.json` deste projeto:
   - `buildCommand`: `npm run build` (compila o app em `webapp-src/`, depois monta `dist-site/`
     com a landing + o app compilado em `/app`)
   - `outputDirectory`: `dist-site`
   - a pasta `api/` na raiz é detectada e publicada como funções serverless automaticamente,
     à parte do build estático acima.
4. Deploy. O link final substitui o antigo endereço do GitHub Pages — atualize
   esse endereço em qualquer lugar que ele apareça (bio do Instagram, `og:url`/`og:image` no
   `index.html` da landing, etc.).

### Rodando localmente com a API de verdade

`npm run dev` (Vite puro, só a interface) **não** serve a pasta `api/`. Para testar o fluxo
completo (front + API) localmente:

```bash
npm install -g vercel   # uma vez só
vercel dev
```

### Comandos disponíveis (raiz do projeto)

- `npm run dev` — sobe só o app (Vite), sem a API — útil para mexer na interface rapidamente.
- `npm run build` — build de produção completo (app + montagem de `dist-site/`).
- `npm run atualizar-fii` — roda localmente o job mensal da aba Simule FII (exige `BRAPI_TOKEN` no ambiente). No dia a dia quem roda é o GitHub Actions.
- `npm run test` — roda os testes do app (`webapp-src`) e os do script mensal de FIIs (`scripts/`).
- `npm run typecheck` — checa os tipos do app inteiro e da API juntos.

## Depois de publicar

- **Imagem de compartilhamento (WhatsApp/LinkedIn):** hoje aponta para o endereço do GitHub Pages
  em `index.html` (`og:image`, `og:url`). Depois do deploy na Vercel, troque para o domínio novo.
- **Links:** todos configurados em `index.html`. Para trocar um, procure o texto do botão.
  O livro em PDF fica em `assets/livro-os-tres-potes-de-duda.pdf`: para atualizá-lo, envie um
  arquivo com **o mesmo nome** para a pasta `assets`.
- **Atualizar o app:** edite dentro de `webapp-src/src/`. O deploy (`npm run build`, ou
  automaticamente a cada push se a Vercel estiver conectada ao repositório) já monta a versão
  nova em `/app`.

## Botão para quem já respondeu

Se o navegador já tem uma carteira salva pelo app (mesmo endereço, pasta `/app`), o botão amarelo
da landing passa a dizer **"Ver minha carteira de referência"**. Nos demais casos (visitante novo,
questionário pela metade, outro aparelho, aba anônima ou armazenamento bloqueado) ele mostra o
texto original. A lógica está no final de `script.js` e usa a mesma chave e versão de dados do app
(`carteiraideal.estado`, versão 2, em `webapp-src/src/state/useAppState.ts`). Se o app mudar essa
versão, atualize `VERSAO` em `script.js`.

Nesse caso o link do botão também ganha `?tela=resultado` (`./app/?tela=resultado`), para o app
abrir direto no resultado — em vez de continuar de onde o usuário parou na última vez (ex: no meio
de uma trilha de aprendizagem). O app lê esse parâmetro em `useAppState.ts`, força a tela de
resultado e remove o parâmetro da URL logo em seguida, para não prender a navegação seguinte
dentro do app a essa tela.

## Livro liberado por confiança (bônus para seguidores)

Desde a decisão D11, o botão fica no fim da tela **Aprender** do app (não mais na landing).
O botão "Educação Financeira Infantil" abre um diálogo pedindo para seguir o Instagram. Quem toca em
**Seguir** ou em **Já sigo o perfil** libera o download, e a liberação fica salva no navegador
(`carteiraideal.livroLiberado`). Depois disso, o botão da lista baixa o PDF direto.

- **Não há verificação:** o Instagram não permite checar quem segue. É um convite, não uma proteção.
- **O PDF continua público** em `assets/livro-os-tres-potes-de-duda.pdf`: quem souber o endereço baixa direto.
- **Textos, endereços e lógica:** ficam em `webapp-src/src/ui/MateriaisExtras.tsx` (junto com o botão do
  curso de Candlesticks); os estilos, no fim de `webapp-src/src/index.css`.
- **Quem já tinha liberado na landing** continua liberado: a chave salva no navegador é a mesma.
- **Para liberar o livro para todos** de novo, troque o botão por um link direto para o PDF em `MateriaisExtras.tsx`.
