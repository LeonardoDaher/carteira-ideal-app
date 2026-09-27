import { normalizarBusca } from './rendaFii'

/** ETF da lista (os 40 de maior volume), gerado por scripts/atualizar-etfs.mjs (D23). */
export interface EtfLista {
  ticker: string
  nome: string
  categoria: string
  /** Índice que o ETF acompanha (config manual); null se não informado. */
  indice: string | null
  /** Só bolsa exterior: true = varia também com o dólar; false = sem a variação do dólar. */
  cambio: boolean | null
  cotacao: number
  dataCotacao: string
  /** Volume financeiro médio (R$) dos últimos 21 pregões; dia sem negócio conta como zero. */
  volumeMedio: number
  /** Variação (%) do fechamento em 63 pregões; null com histórico curto. */
  variacao3m: number | null
  minima52: number | null
  maxima52: number | null
}

/** ETF da busca: todos os ETFs com cotação, com os campos resumidos. */
export interface EtfBusca {
  ticker: string
  nome: string
  categoria: string
  cotacao: number
  dataCotacao: string
  volumeMedio: number
}

export interface SnapshotEtfs {
  geradoEm: string | null
  dataPregao: string | null
  fonte?: string
  pregoesNoHistorico?: number
  sessoesLiquidez?: number
  criterio?: { maxEtfs: number; pisoVolume: number }
  ordemCategorias?: string[]
  etfs: EtfLista[]
  busca?: EtfBusca[]
}

export interface GrupoEtf {
  categoria: string
  etfs: EtfLista[]
}

const ORDEM_PADRAO = ['Bolsa brasileira', 'Bolsa exterior', 'Renda fixa', 'Ouro, dólar e commodities', 'Cripto', 'Outros']

/**
 * Agrupa por categoria, na ordem do config (a mesma para todo mundo, não por desempenho).
 * Dentro da categoria, ordem por volume médio, o critério da lista. Categorias vazias somem.
 */
export function agruparPorCategoria(etfs: EtfLista[], ordem: string[] = ORDEM_PADRAO): GrupoEtf[] {
  const mapa = new Map<string, EtfLista[]>()
  for (const e of etfs) {
    const categoria = e.categoria || 'Outros'
    if (!mapa.has(categoria)) mapa.set(categoria, [])
    mapa.get(categoria)!.push(e)
  }
  const posicao = (c: string) => {
    const i = ordem.indexOf(c)
    return i === -1 ? (c === 'Outros' ? Number.MAX_SAFE_INTEGER : ordem.length) : i
  }
  return [...mapa]
    .map(([categoria, lista]) => ({ categoria, etfs: [...lista].sort((a, b) => b.volumeMedio - a.volumeMedio) }))
    .sort((a, b) => posicao(a.categoria) - posicao(b.categoria) || a.categoria.localeCompare(b.categoria, 'pt-BR'))
}

/** Busca por código ou parte do nome. Código exato primeiro. Até 8 resultados. */
export function buscarEtfs(busca: EtfBusca[], termo: string, limite = 8): EtfBusca[] {
  const t = normalizarBusca(termo)
  if (t.length < 2) return []
  const pontuar = (e: EtfBusca) => {
    if (e.ticker === t) return 0
    if (e.ticker.startsWith(t)) return 1
    if (normalizarBusca(e.nome).includes(t)) return 2
    if (e.ticker.includes(t)) return 3
    return null
  }
  return busca
    .map((e) => ({ e, p: pontuar(e) }))
    .filter((x): x is { e: EtfBusca; p: number } => x.p !== null)
    .sort((x, y) => x.p - y.p || x.e.ticker.localeCompare(y.e.ticker))
    .slice(0, limite)
    .map((x) => x.e)
}

export type RegimeIr = 'renda-fixa' | 'renda-variavel'

/** ETF de renda fixa tem IR retido na fonte; os demais seguem a regra de renda variável. */
export function regimeIr(categoria: string): RegimeIr {
  return categoria === 'Renda fixa' ? 'renda-fixa' : 'renda-variavel'
}

/**
 * Frase curta do IR para o cartão, conforme o regime (regras conferidas em 27/09/2026; D23).
 * A explicação completa fica no aviso fixo da tela.
 */
export function textoIrCurto(categoria: string): string {
  return regimeIr(categoria) === 'renda-fixa'
    ? 'ETF de renda fixa: o IR é retido na fonte na venda, de 15% a 25% conforme o prazo médio da carteira do fundo.'
    : 'Na venda com lucro, 15% de IR pago pelo investidor por DARF, sem a isenção de R$ 20 mil por mês das ações.'
}

/** Texto da linha de câmbio, só para bolsa exterior com a informação conferida. */
export function textoCambio(cambio: boolean | null): { titulo: string; detalhe: string } | null {
  if (cambio === true) {
    return {
      titulo: 'Varia também com o dólar',
      detalhe: 'Mesmo que o índice fique parado, a alta ou a queda do dólar muda o preço em reais.',
    }
  }
  if (cambio === false) {
    return {
      titulo: 'Sem a variação do dólar',
      detalhe: 'O fundo acompanha o índice em reais, com proteção cambial: a alta ou a queda do dólar não entra no preço.',
    }
  }
  return null
}
