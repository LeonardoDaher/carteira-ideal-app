import { normalizarBusca } from './rendaFii'

/** BDR da lista (os 35 de ações e os 5 de ETF), gerado por scripts/atualizar-bdrs.mjs (D19, fonte B3 desde a D24). */
export interface BdrLista {
  ticker: string
  nome: string
  setor: string
  cotacao: number
  dataCotacao: string
  /** Variação (%) entre o primeiro e o último fechamento dos últimos 3 meses. */
  variacao3m: number | null
  /** Variação (%) do último pregão contra o anterior; ausente em arquivos antigos, `null` se não negociou nos dois. */
  variacaoDia?: number | null
  /** Volume financeiro médio (R$) dos últimos 21 pregões completos. */
  volumeMedio: number
  minima52: number | null
  maxima52: number | null
  /** Quantas ações cada BDR representa (0,05 = 20 BDRs por ação). */
  acoesPorBdr: number | null
}

/** BDR da busca: dado resumido do histórico próprio (D24), sem média nem variação. */
export interface BdrBusca {
  ticker: string
  tipo: 'acao' | 'etf'
  nome: string | null
  setor: string
  /** Fechamento do último negócio. */
  cotacao: number
  /** Data do último negócio (D24). Ausente nos arquivos gerados pela brapi. */
  dataCotacao?: string
  /** Volume financeiro (R$) só do último pregão. */
  volumeDia: number
}

export interface SnapshotBdrs {
  geradoEm: string | null
  dataPregao: string | null
  /** Fonte do preço e do volume (D24): "B3 - Boletim de Preços (BVBG.086)". Ausente na versão da brapi. */
  fonte?: string
  pregoesNoHistorico?: number
  sessoesLiquidez?: number
  criterio?: { maxAcoes: number; maxEtfs: number; pisoVolumeAcoes: number; pisoVolumeEtfs: number }
  acoes: BdrLista[]
  etfs: BdrLista[]
  busca?: BdrBusca[]
}

export interface GrupoBdr {
  setor: string
  bdrs: BdrLista[]
}

/**
 * Agrupa por setor. Dentro do setor, ordem por volume médio (o critério da lista, D19);
 * setores com mais BDRs primeiro, "Outros" por último. Nunca por variação ou preço.
 */
export function agruparPorSetor(bdrs: BdrLista[]): GrupoBdr[] {
  const mapa = new Map<string, BdrLista[]>()
  for (const b of bdrs) {
    const setor = b.setor || 'Outros'
    if (!mapa.has(setor)) mapa.set(setor, [])
    mapa.get(setor)!.push(b)
  }
  return [...mapa]
    .map(([setor, lista]) => ({ setor, bdrs: [...lista].sort((a, b) => b.volumeMedio - a.volumeMedio) }))
    .sort((a, b) => {
      if (a.setor === 'Outros') return 1
      if (b.setor === 'Outros') return -1
      return b.bdrs.length - a.bdrs.length || a.setor.localeCompare(b.setor, 'pt-BR')
    })
}

/** Busca por código ou parte do nome, em todos os BDRs. Código exato primeiro. Até 8 resultados. */
export function buscarBdrs(busca: BdrBusca[], termo: string, limite = 8): BdrBusca[] {
  const t = normalizarBusca(termo)
  if (t.length < 2) return []
  const pontuar = (b: BdrBusca) => {
    if (b.ticker === t) return 0
    if (b.ticker.startsWith(t)) return 1
    if (b.nome && normalizarBusca(b.nome).includes(t)) return 2
    if (b.ticker.includes(t)) return 3
    return null
  }
  return busca
    .map((b) => ({ b, p: pontuar(b) }))
    .filter((x): x is { b: BdrBusca; p: number } => x.p !== null)
    .sort((x, y) => x.p - y.p || x.b.ticker.localeCompare(y.b.ticker))
    .slice(0, limite)
    .map((x) => x.b)
}

/** 0,05 → "20 BDRs = 1 ação"; 1 → "1 BDR = 1 ação"; 2 → "1 BDR = 2 ações". */
export function textoProporcao(acoesPorBdr: number | null, tipo: 'acao' | 'etf' = 'acao'): string | null {
  if (acoesPorBdr == null || !(acoesPorBdr > 0)) return null
  const unidade = (n: number) => (tipo === 'etf' ? (n === 1 ? 'cota do ETF' : 'cotas do ETF') : n === 1 ? 'ação' : 'ações')
  if (acoesPorBdr >= 1) {
    const n = Math.round(acoesPorBdr * 100) / 100
    return `1 BDR = ${n.toLocaleString('pt-BR')} ${unidade(n)}`
  }
  const bdrs = Math.round(1 / acoesPorBdr)
  return `${bdrs.toLocaleString('pt-BR')} BDRs = 1 ${unidade(1)}`
}

export interface SimulacaoCompra {
  quantidade: number
  investido: number
  sobra: number
  /** Ações (ou cotas do ETF) equivalentes, quando a proporção é conhecida. */
  equivalente: number | null
}

/** Quantos BDRs inteiros o valor compra ao preço de fechamento, sem custos. Só aritmética. */
export function simularCompra(valor: number, cotacao: number, acoesPorBdr: number | null = null): SimulacaoCompra | null {
  if (!(valor > 0) || !(cotacao > 0)) return null
  const quantidade = Math.floor(valor / cotacao + 1e-9)
  const investido = Math.round(quantidade * cotacao * 100) / 100
  return {
    quantidade,
    investido,
    sobra: Math.round((valor - investido) * 100) / 100,
    equivalente: acoesPorBdr != null && acoesPorBdr > 0 ? Math.round(quantidade * acoesPorBdr * 100) / 100 : null,
  }
}

/** 12,3 → "+12,3%"; −4 → "−4,0%". */
export function formatarVariacao(pct: number): string {
  const texto = Math.abs(pct).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${pct > 0 ? '+' : pct < 0 ? '−' : ''}${texto}%`
}

export const VALORES_PADRAO = [1000, 5000, 10000] as const
