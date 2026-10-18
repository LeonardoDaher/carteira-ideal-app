import { normalizarBusca } from './rendaFii'

/** Empresa do cadastro (config/acoes.json) com dado válido, gerada por scripts/atualizar-acoes.mjs (D43). */
export interface Acao {
  ticker: string
  nome: string
  cotacao: number
  dataCotacao: string
  /** Variação (%) do preço entre o primeiro e o último fechamento dos últimos 3 meses. Sem proventos. */
  variacao3m: number | null
  /** Variação (%) do último pregão contra o anterior; ausente em arquivos antigos, `null` se não negociou nos dois. */
  variacaoDia?: number | null
  /** Volume financeiro médio (R$) dos últimos 21 pregões. */
  volumeMedio: number
  minima52: number | null
  maxima52: number | null
}

export interface SetorAcoes {
  setor: string
  /** Um dos 10 setores econômicos da classificação da B3. */
  grupoB3: string
  empresas: Acao[]
}

/** Código da busca: todo código de ação com negócio recente, inclusive os fora do cadastro (setor "Outros"). */
export interface AcaoBusca {
  ticker: string
  nome: string | null
  setor: string
  cotacao: number
  dataCotacao?: string
  /** Volume financeiro (R$) só do último pregão. */
  volumeDia: number
}

export interface SnapshotAcoes {
  geradoEm: string | null
  dataPregao: string | null
  fonte?: string
  cadastroId?: string
  pregoesNoHistorico?: number
  sessoesLiquidez?: number
  totais?: { setores: number; empresas: number }
  gruposOrdem?: string[]
  setores: SetorAcoes[]
  busca: AcaoBusca[]
}

export interface GrupoAcoes {
  grupo: string
  setores: SetorAcoes[]
  empresas: number
}

/** Agrupa os setores nos grandes setores da B3, na ordem do config; grupo desconhecido vai para o fim. */
export function agruparPorGrupo(setores: SetorAcoes[], ordem: string[] = []): GrupoAcoes[] {
  const mapa = new Map<string, SetorAcoes[]>()
  for (const g of ordem) mapa.set(g, [])
  for (const s of setores) {
    if (!mapa.has(s.grupoB3)) mapa.set(s.grupoB3, [])
    mapa.get(s.grupoB3)!.push(s)
  }
  return [...mapa]
    .filter(([, lista]) => lista.length > 0)
    .map(([grupo, lista]) => ({ grupo, setores: lista, empresas: lista.reduce((n, s) => n + s.empresas.length, 0) }))
}

/** Quantos setores e empresas a tela mostra (calculado da lista, que é o que a pessoa vê). */
export function totaisDe(setores: SetorAcoes[]): { setores: number; empresas: number } {
  return { setores: setores.length, empresas: setores.reduce((n, s) => n + s.empresas.length, 0) }
}

/** Busca por código ou parte do nome, em todos os códigos. Código exato primeiro. Até 8 resultados. */
export function buscarAcoes(busca: AcaoBusca[], termo: string, limite = 8): AcaoBusca[] {
  const t = normalizarBusca(termo)
  if (t.length < 2) return []
  const pontuar = (b: AcaoBusca) => {
    if (b.ticker === t) return 0
    if (b.ticker.startsWith(t)) return 1
    if (b.nome && normalizarBusca(b.nome).includes(t)) return 2
    if (b.ticker.includes(t)) return 3
    return null
  }
  return busca
    .map((b) => ({ b, p: pontuar(b) }))
    .filter((x): x is { b: AcaoBusca; p: number } => x.p !== null)
    .sort((x, y) => x.p - y.p || x.b.ticker.localeCompare(y.b.ticker))
    .slice(0, limite)
    .map((x) => x.b)
}

export interface SimulacaoAcoes {
  quantidade: number
  /** Lotes de 100 ações (mercado padrão). */
  lotes: number
  /** Ações que sobram fora do lote, compradas no mercado fracionário (1 a 99). */
  fracionario: number
  investido: number
  sobra: number
}

/** Quantas ações inteiras o valor compra ao preço de fechamento, sem custos. Só aritmética. */
export function simularCompraAcoes(valor: number, cotacao: number): SimulacaoAcoes | null {
  if (!(valor > 0) || !(cotacao > 0)) return null
  const quantidade = Math.floor(valor / cotacao + 1e-9)
  const investido = Math.round(quantidade * cotacao * 100) / 100
  return {
    quantidade,
    lotes: Math.floor(quantidade / 100),
    fracionario: quantidade % 100,
    investido,
    sobra: Math.round((valor - investido) * 100) / 100,
  }
}
