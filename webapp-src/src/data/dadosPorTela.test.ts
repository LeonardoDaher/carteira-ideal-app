import { describe, expect, it } from 'vitest'
import { CHAVES_DE_DADOS } from './arquivosMercado'
import { DADOS_DA_TELA } from './dadosDaTela'

/**
 * Rede de segurança do carregamento sob demanda (D137). O app só mostra uma tela depois que baixou os arquivos listados em
 * DADOS_DA_TELA. Se alguém criar uma tela ou um componente que lê um SNAPSHOT_* e esquecer de listar o arquivo, em produção a
 * tela quebraria (a constante ainda estaria vazia). Este teste percorre os imports de cada tela, como o bundler faria, e falha
 * apontando o que está faltando. Também falha se a lista tiver arquivo a mais do que a tela alcança (a pessoa baixaria à toa).
 */
const fontes = import.meta.glob<string>('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
const arquivos = new Map(Object.entries(fontes).filter(([caminho]) => !/\.test\.tsx?$/.test(caminho) && !caminho.includes('/testes/')))

function normalizar(caminho: string): string {
  const partes: string[] = []
  for (const p of caminho.split('/')) {
    if (p === '..') partes.pop()
    else if (p !== '.' && p !== '') partes.push(p)
  }
  return partes.join('/')
}
/** O glob devolve '../screens/X.tsx' para outras pastas e './X.ts' para esta (src/data). Tudo vira 'src/...'. */
const caminhoReal = (k: string) => (k.startsWith('./') ? `src/data/${k.slice(2)}` : k.replace(/^\.\.\//, 'src/'))
const porNormal = new Map([...arquivos.keys()].map((k) => [normalizar(caminhoReal(k)), k]))

function resolver(de: string, especificador: string): string | undefined {
  if (!especificador.startsWith('.')) return undefined
  const base = normalizar(`${normalizar(caminhoReal(de)).split('/').slice(0, -1).join('/')}/${especificador}`)
  return [base + '.ts', base + '.tsx', base + '/index.ts', base + '/index.tsx'].map((c) => porNormal.get(c)).find(Boolean)
}

const importa = (fonte: string) =>
  [...fonte.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?from\s+)?['"]([^'"]+)['"]/gm)].filter((m) => !m[1]).map((m) => m[2])

function alcance(raiz: string): Set<string> {
  const visitados = new Set<string>()
  const pilha = [raiz]
  while (pilha.length) {
    const atual = pilha.pop() as string
    if (visitados.has(atual)) continue
    visitados.add(atual)
    for (const e of importa(arquivos.get(atual) ?? '')) {
      const alvo = resolver(atual, e)
      if (alvo) pilha.push(alvo)
    }
  }
  return visitados
}

/** Chaves que os módulos alcançados registram com `registrarDados<...>('chave', ...)`. */
function chavesAlcancadas(raiz: string): string[] {
  const achadas = new Set<string>()
  for (const arq of alcance(raiz)) for (const m of (arquivos.get(arq) ?? '').matchAll(/registrarDados(?:<[^>]*>)?\(\s*'(\w+)'/g)) achadas.add(m[1])
  return [...achadas].sort()
}

const app = arquivos.get('../App.tsx') ?? ''
const telas = [...app.matchAll(/^\s+(\w+): \(\) => <(\w+) /gm)].map((m) => ({ tela: m[1], componente: m[2] }))
function arquivoDaTela(componente: string): string {
  // Tela inicial: import direto. As demais são arquivos próprios: `const X = telaPreguicosa(() => import('./screens/X'), 'X')` (D138).
  const m =
    app.match(new RegExp(`import \\{ ${componente} \\} from '([^']+)'`)) ??
    app.match(new RegExp(`const ${componente} = telaPreguicosa\\(\\(\\) => import\\('([^']+)'\\)`))
  const alvo = m && resolver('../App.tsx', m[1])
  if (!alvo) throw new Error(`não achei o arquivo de ${componente}`)
  return alvo
}

describe('DADOS_DA_TELA cobre exatamente o que cada tela alcança (D137)', () => {
  it('encontrou as telas do App e as chaves de dados', () => {
    expect(telas.length).toBeGreaterThan(20)
    expect(CHAVES_DE_DADOS.length).toBe(20)
  })

  for (const { tela, componente } of telas) {
    it(`${tela}`, () => {
      const alcancadas = chavesAlcancadas(arquivoDaTela(componente))
      const declaradas = [...((DADOS_DA_TELA as Record<string, readonly string[] | undefined>)[tela] ?? [])].sort()
      const faltando = alcancadas.filter((c) => !declaradas.includes(c))
      const sobrando = declaradas.filter((c) => !alcancadas.includes(c))
      expect({ faltando, sobrando }).toEqual({ faltando: [], sobrando: [] })
    })
  }

  it('todas as chaves têm um módulo que as registra (senão o dado baixaria e ninguém o usaria)', () => {
    const registradas = new Set<string>()
    for (const fonte of arquivos.values()) for (const m of fonte.matchAll(/registrarDados(?:<[^>]*>)?\(\s*'(\w+)'/g)) registradas.add(m[1])
    expect([...CHAVES_DE_DADOS].filter((c) => !registradas.has(c))).toEqual([])
  })
})
