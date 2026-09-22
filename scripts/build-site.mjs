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
import { cp, mkdir, rm, access } from 'node:fs/promises'
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
  const arquivosLanding = ['index.html', 'style.css', 'script.js', 'assets']
  for (const nome of arquivosLanding) {
    const origem = path.join(raiz, nome)
    if (await existe(origem)) {
      await cp(origem, path.join(saida, nome), { recursive: true })
    } else {
      console.warn(`[build-site] Aviso: "${nome}" não encontrado na raiz, pulando.`)
    }
  }

  // 2) App compilado, dentro de /app — mesma URL relativa que a landing já usa ("./app/")
  await mkdir(path.join(saida, 'app'), { recursive: true })
  await cp(appCompilado, path.join(saida, 'app', 'index.html'))

  console.log(`[build-site] Site montado em ${path.relative(raiz, saida)}/ (landing + app/)`)
}

main()
