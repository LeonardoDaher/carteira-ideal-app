/**
 * Radar de dividendos (D130): proventos que a B3 já anunciou e que ainda vão ser pagos, por mês de pagamento. O arquivo chega
 * pronto do job scripts/atualizar-radar-dividendos.mjs; o app só agrupa e mostra. Só fato publicado, sem projeção.
 */

export interface PagamentoAnunciado {
  ticker: string
  nome: string | null
  setor: string | null
  tipo: 'DIVIDENDO' | 'JRS CAP PROPRIO' | 'RENDIMENTO' | string
  /** Valor bruto por ação. */
  valor: number
  /** Último dia com direito (AAAA-MM-DD). */
  dataCom: string
  /** Data de pagamento; null quando a B3 ainda não a definiu. */
  pagamentoEm: string | null
  aprovadoEm: string | null
  referencia: string | null
  /** AAAA-MM do pagamento, ou null sem data. */
  mes: string | null
}

export interface SnapshotRadarDividendos {
  publicado: boolean
  geradoEm: string | null
  dataReferencia: string
  consultadas: number
  comPagamento: number
  falhas: string[]
  pagamentos: PagamentoAnunciado[]
}

export interface GrupoDoMes {
  /** AAAA-MM, ou null para "sem data de pagamento". */
  mes: string | null
  rotulo: string
  pagamentos: PagamentoAnunciado[]
}

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-11" → "novembro de 2026". */
export function rotuloDoMes(mes: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  return m ? `${NOMES_MESES[Number(m[2]) - 1]} de ${m[1]}` : mes
}

export const ROTULO_TIPO_RADAR: Record<string, string> = {
  DIVIDENDO: 'Dividendo',
  'JRS CAP PROPRIO': 'JCP (bruto)',
  RENDIMENTO: 'Rendimento',
}

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** Filtra por código ou nome (sem acento nem caixa) e agrupa por mês de pagamento; "sem data" fica por último. */
export function agruparPorMes(pagamentos: PagamentoAnunciado[], busca = ''): GrupoDoMes[] {
  const q = semAcento(busca)
  const visiveis = q ? pagamentos.filter((p) => semAcento(p.ticker).includes(q) || semAcento(p.nome ?? '').includes(q)) : pagamentos
  const grupos = new Map<string | null, PagamentoAnunciado[]>()
  for (const p of visiveis) grupos.set(p.mes, [...(grupos.get(p.mes) ?? []), p])
  const meses = [...grupos.keys()].filter((m): m is string => m !== null).sort()
  const ordem: (string | null)[] = grupos.has(null) ? [...meses, null] : meses
  return ordem.map((mes) => ({ mes, rotulo: mes === null ? 'Sem data de pagamento definida' : rotuloDoMes(mes), pagamentos: grupos.get(mes) ?? [] }))
}

/** Ainda dá para ter direito: a data com é hoje ou futura. */
export const aindaTemDireito = (p: PagamentoAnunciado, hoje: string) => p.dataCom >= hoje
