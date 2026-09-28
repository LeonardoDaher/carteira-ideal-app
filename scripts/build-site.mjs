// Monta a pasta final que a Vercel publica como site estático (dist-site/).
//
// Antes desse script, já rodou (via "npm run build:app"): tsc -b && vite build dentro de
// webapp-src, gerando webapp-src/dist/index.html — o app inteiro compilado num único
// arquivo HTML (vite-plugin-singlefile), sem o motor de decisão (engine.ts) dentro dele.
//
// Este script só organiza os arquivos finais, replicando a estrutura que já existia no
// GitHub Pages (landing na raiz + app em "./app/"), para o link "./app/" continuar
// funcionando sem precisar mudar nada no index.html da landing nem no script.js.
//
// A pasta api/ NÃO entra aqui: ela fica na raiz do repositório e a Vercel a detecta e
// publica como funções serverless automaticamente, à parte deste build estático.
import { cp, mkdir, rm, access, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const saida = path.join(raiz, 'dist-site')
const appCompilado = path.join(raiz, 'webapp-src', 'dist', 'index.html')

async function existe(caminho) {
  try {
    await access(caminho)
    return true
  } catch {
    return false
  }
}

const DOMINIO = 'https://carteiraideal.app.br'

/** Páginas do sitemap, relativas ao domínio (D26). */
export const PAGINAS_SITEMAP = ['/', '/app/']

/** Monta o sitemap.xml. lastmod = data do build (a Vercel publica a cada commit dos jobs). */
export function montarSitemap(paginas, data) {
  const dia = data.toISOString().slice(0, 10)
  const urls = paginas
    .map((p) => `  <url>\n    <loc>${DOMINIO}${p}</loc>\n    <lastmod>${dia}</lastmod>\n  </url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

async function main() {
  if (!(await existe(appCompilado))) {
    console.error(
      '[build-site] Não encontrei webapp-src/dist/index.html — rode "npm run build:app" antes deste script.',
    )
    process.exit(1)
  }

  await rm(saida, { recursive: true, force: true })
  await mkdir(saida, { recursive: true })

  // 1) Landing page (arquivos estáticos da raiz do projeto)
  // robots.txt entrou na D26 (SEO).
  // google5f0b815b0517184a.html: arquivo de verificação do Google Search Console (D26). Precisa ficar
  // na raiz do site publicado e nunca pode ser apagado, senão a propriedade perde a verificação.
  const arquivosLanding = ['index.html', 'style.css', 'script.js', 'assets', 'robots.txt', 'google5f0b815b0517184a.html']
  for (const nome of arquivosLanding) {
    const origem = path.join(raiz, nome)
    if (await existe(origem)) {
      await cp(origem, path.join(saida, nome), { recursive: true })
    } else {
      console.warn(`[build-site] Aviso: "${nome}" não encontrado na raiz, pulando.`)
    }
  }

  // 2) App compilado, dentro de /app — mesma URL relativa que a landing já usa ("./app/").
  // Copia a pasta dist inteira (D20): além do index.html, ela traz o que o Vite copia de
  // webapp-src/public — manifest.webmanifest e ícones, usados para instalar o app.
  await mkdir(path.join(saida, 'app'), { recursive: true })
  await cp(path.dirname(appCompilado), path.join(saida, 'app'), { recursive: true })

  // 3) sitemap.xml (D26): lista as páginas que o Google deve conhecer. Os endereços com
  // ?tela= ficam de fora de propósito: para o Google, hoje, são a mesma página do app.
  // Quando as páginas próprias das ferramentas e das aulas existirem (Etapa 3 da D26),
  // basta acrescentá-las em PAGINAS_SITEMAP.
  await writeFile(path.join(saida, 'sitemap.xml'), montarSitemap(PAGINAS_SITEMAP, new Date()))

  console.log(`[build-site] Site montado em ${path.relative(raiz, saida)}/ (landing + app/)`)
}

// Só roda o build quando chamado direto (node scripts/build-site.mjs); importado pelos
// testes, apenas expõe montarSitemap.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
