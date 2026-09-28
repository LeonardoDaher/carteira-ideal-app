// Carrega arquivos TypeScript do app (webapp-src/src) dentro de scripts Node, sem duplicar conteúdo.
//
// Por quê: as páginas estáticas do SEO (D26, Etapa 3) precisam ler os MESMOS textos que o app usa
// (data/trilhas.ts, data/analises/*.ts, data/assets.ts, domain/mercadoOficial.ts). Se o texto fosse
// copiado para um segundo lugar, mudaria num e ficaria velho no outro. Aqui o TypeScript é apenas
// transpilado (types apagados) para uma pasta temporária e importado como módulo comum.
//
// Só funciona para arquivos que não dependam de bundler (imports relativos, sem JSON nem CSS).
// O pacote "typescript" já é dependência de desenvolvimento do projeto e a Vercel o instala no build.
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const RE_IMPORT_RELATIVO = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+?)\2/g

/** Acrescenta ".js" nos imports relativos sem extensão (o Node ESM exige). */
export function reescreverImports(codigo) {
  return codigo.replace(RE_IMPORT_RELATIVO, (todo, prefixo, aspas, caminho) =>
    /\.(m?js|json)$/.test(caminho) ? todo : `${prefixo}${aspas}${caminho}.js${aspas}`,
  )
}

/**
 * Transpila os arquivos (e os que eles importam por caminho relativo) e devolve os módulos.
 * @param {string} raizSrc  pasta webapp-src/src
 * @param {string[]} entradas caminhos relativos a raizSrc, ex.: 'data/trilhas.ts'
 * @returns {Promise<{ modulos: Record<string, any>, limpar: () => Promise<void> }>}
 */
export async function carregarTs(raizSrc, entradas) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'carteira-ideal-ts-'))
  await writeFile(path.join(tmp, 'package.json'), '{"type":"module"}')

  const feitos = new Set()
  async function transpilar(rel) {
    const relTs = rel.replace(/\.js$/, '.ts')
    if (feitos.has(relTs)) return
    feitos.add(relTs)
    const origem = path.join(raizSrc, relTs)
    const fonte = await readFile(origem, 'utf8')
    const saida = ts.transpileModule(fonte, {
      fileName: origem,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        verbatimModuleSyntax: false,
        isolatedModules: true,
      },
    }).outputText
    const codigo = reescreverImports(saida)
    const destino = path.join(tmp, relTs.replace(/\.ts$/, '.js'))
    await mkdir(path.dirname(destino), { recursive: true })
    await writeFile(destino, codigo)
    // Segue os imports relativos que sobraram depois de apagar os tipos.
    for (const m of codigo.matchAll(RE_IMPORT_RELATIVO)) {
      const alvo = path.posix.normalize(path.posix.join(path.posix.dirname(relTs), m[3]))
      await transpilar(alvo)
    }
  }

  for (const e of entradas) await transpilar(e)

  const modulos = {}
  for (const e of entradas) {
    const arquivo = path.join(tmp, e.replace(/\.ts$/, '.js'))
    modulos[e] = await import(pathToFileURL(arquivo).href)
  }
  return { modulos, limpar: () => rm(tmp, { recursive: true, force: true }) }
}
