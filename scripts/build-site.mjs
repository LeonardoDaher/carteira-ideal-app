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
import { gerarPaginas } from './gerar-paginas.mjs'
import { conferirHtml, injetarCspMeta } from './csp-hashes.mjs'
import { readdir, readFile } from 'node:fs/promises'

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

/** Todos os .html de uma pasta, recursivamente. */
async function htmlsDe(pasta) {
  const achados = []
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, e.name)
    if (e.isDirectory()) achados.push(...(await htmlsDe(caminho)))
    else if (e.name.endsWith('.html')) achados.push(caminho)
  }
  return achados
}

/**
 * CSP por hash (D87): cada HTML publicado recebe uma <meta> com o hash dos seus scripts inline. Roda por
 * último, depois que todo HTML está pronto (landing, app e páginas geradas), e confere o resultado.
 * Se uma página tiver atributo de evento inline ou URL "javascript:", o build falha de propósito.
 */
export async function protegerScripts(pasta) {
  const arquivos = await htmlsDe(pasta)
  for (const arquivo of arquivos) {
    const nome = path.relative(pasta, arquivo)
    const html = await readFile(arquivo, 'utf8')
    const novo = injetarCspMeta(html, nome)
    const problemas = conferirHtml(novo)
    if (problemas.length > 0) throw new Error(`[csp] ${nome}: ${problemas.join('; ')}`)
    await writeFile(arquivo, novo)
  }
  return arquivos.length
}

/**
 * Monta o sitemap.xml a partir de [{ caminho, lastmod }] (D26).
 * Os endereços com ?tela= ficam de fora de propósito: para o Google, são a mesma página do app.
 */
export function montarSitemap(entradas) {
  const urls = entradas
    .map((e) => `  <url>\n    <loc>${DOMINIO}${e.caminho}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
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
  // paginas.css é o estilo das páginas geradas (Etapa 3).
  const arquivosLanding = ['index.html', 'style.css', 'paginas.css', 'script.js', 'assets', 'robots.txt', 'google5f0b815b0517184a.html', 'manifest.webmanifest', 'privacidade', 'painel.html']
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

  // 3) Páginas estáticas para o Google (D26, Etapa 3): ferramentas, aulas, guias de ativos e taxas
  // do Tesouro. Se o gerador falhar, o site sai do mesmo jeito (só sem as páginas novas) e o erro
  // aparece bem visível no log: um problema de SEO não pode impedir a publicação dos dados semanais.
  const hoje = new Date().toISOString().slice(0, 10)
  const entradasSitemap = [
    { caminho: '/', lastmod: hoje },
    { caminho: '/app/', lastmod: hoje },
  ]
  let geradas = 0
  try {
    const paginas = await gerarPaginas({ raiz })
    for (const pg of paginas) {
      const pasta = path.join(saida, ...pg.caminho.split('/').filter(Boolean))
      await mkdir(pasta, { recursive: true })
      await writeFile(path.join(pasta, 'index.html'), pg.html)
      entradasSitemap.push({ caminho: pg.caminho, lastmod: pg.lastmod })
    }
    geradas = paginas.length
  } catch (erro) {
    console.error('[build-site] ATENÇÃO: as páginas estáticas de SEO NÃO foram geradas:', erro)
  }

  // 4) sitemap.xml (D26)
  await writeFile(path.join(saida, 'sitemap.xml'), montarSitemap(entradasSitemap))

  // 5) CSP por hash dos scripts inline (D87). Tem de ser o último passo que mexe em HTML.
  const protegidas = await protegerScripts(saida)
  console.log(`[build-site] CSP: ${protegidas} páginas com a política de scripts por hash`)

  console.log(`[build-site] Site montado em ${path.relative(raiz, saida)}/ (landing + app/ + ${geradas} páginas estáticas)`)
}

// Só roda o build quando chamado direto (node scripts/build-site.mjs); importado pelos
// testes, apenas expõe montarSitemap.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
