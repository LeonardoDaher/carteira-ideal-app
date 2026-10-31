/**
 * Radar de dividendos inteligente (D132): em que meses do ano cada empresa costuma pagar, pelo que pagou nos últimos anos,
 * cruzado com o que já foi anunciado (a agenda). É projeção estatística simples e SEM valor: o app não diz quanto vai pagar
 * nem promete que vai pagar. O padrão chega pronto do job scripts/atualizar-radar-inteligente.mjs; aqui só se monta a grade.
 */
import type { BaseDaData, PagamentoAnunciado } from './radarDividendos'

export interface EmpresaDoRadar {
  ticker: string
  nome: string | null
  setor: string | null
  /** Em quantos dos últimos `anos` anos fechados houve data com em cada mês (0 a anos), de janeiro a dezembro. */
  meses: number[]
  anosComHistorico: number
}

export interface SnapshotRadarInteligente {
  publicado: boolean
  geradoEm: string | null
  dataReferencia: string
  anos: number
  minimoDeAnos: number
  consultadas: number
  falhas: string[]
  empresas: EmpresaDoRadar[]
}

/** pago: já aconteceu; confirmado: anunciado e ainda por vir; provável: só o padrão histórico, ainda não anunciado. */
export type StatusDoMes = 'pago' | 'confirmado' | 'provavel'

export interface CelulaDoMes {
  status: StatusDoMes
  /** Só no provável: em quantos dos últimos anos houve pagamento nesse mês. */
  anos?: number
}

export interface LinhaDoRadar {
  ticker: string
  nome: string | null
  setor: string | null
  /** 12 posições, de janeiro a dezembro; null = nada esperado. */
  celulas: (CelulaDoMes | null)[]
}

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

function mediana(v: number[]): number | null {
  if (!v.length) return null
  const o = [...v].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/**
 * Quantos meses a data de pagamento costuma vir depois da data com, por empresa (mediana dos prazos já conhecidos, em meses
 * inteiros), e a mediana geral para quem não tem nenhum prazo conhecido. Serve só para deslocar o provável na visão "Data pagamento".
 */
export function atrasoEmMeses(pagamentos: PagamentoAnunciado[]): { porTicker: Map<string, number>; geral: number } {
  const prazos = new Map<string, number[]>()
  for (const p of pagamentos) {
    if (!p.pagamentoEm) continue
    prazos.set(p.ticker, [...(prazos.get(p.ticker) ?? []), diasEntre(p.dataCom, p.pagamentoEm)])
  }
  const porTicker = new Map<string, number>()
  for (const [t, v] of prazos) porTicker.set(t, Math.max(0, Math.round((mediana(v) ?? 0) / 30)))
  const geral = Math.max(0, Math.round((mediana([...prazos.values()].flat()) ?? 0) / 30))
  return { porTicker, geral }
}

/**
 * Monta a grade de um ano. Para cada empresa e mês:
 *  - anunciado na agenda, na base escolhida (data com ou data de pagamento): "pago" se a data já passou, "confirmado" se não;
 *  - senão, "provável" se o padrão tem o mês em pelo menos `minimoDeAnos` anos e o mês ainda não passou (a partir do mês de hoje).
 * Na base "pagamento" o padrão (que é de data com) é deslocado pelo prazo costumeiro entre data com e pagamento da empresa.
 * Só voltam as empresas com alguma célula no ano.
 */
export function montarGrade(opts: {
  radar: SnapshotRadarInteligente
  agenda: PagamentoAnunciado[]
  ano: number
  base: BaseDaData
  hoje: string
  busca?: string
  setor?: string
}): LinhaDoRadar[] {
  const { radar, agenda, ano, base, hoje, busca = '', setor = '' } = opts
  const q = semAcento(busca)
  const atraso = atrasoEmMeses(agenda)
  const porTicker = new Map<string, PagamentoAnunciado[]>()
  for (const p of agenda) porTicker.set(p.ticker, [...(porTicker.get(p.ticker) ?? []), p])
  const mesDeHoje = Number(hoje.slice(5, 7))
  const anoDeHoje = Number(hoje.slice(0, 4))

  const tickers = new Map<string, EmpresaDoRadar>(radar.empresas.map((e) => [e.ticker, e]))
  for (const t of porTicker.keys()) if (!tickers.has(t)) tickers.set(t, { ticker: t, nome: porTicker.get(t)![0].nome, setor: porTicker.get(t)![0].setor, meses: Array.from({ length: 12 }, () => 0), anosComHistorico: 0 })

  const linhas: LinhaDoRadar[] = []
  for (const e of tickers.values()) {
    if (setor && e.setor !== setor) continue
    if (q && !semAcento(e.ticker).includes(q) && !semAcento(e.nome ?? '').includes(q)) continue
    const deslocamento = base === 'pagamento' ? (atraso.porTicker.get(e.ticker) ?? atraso.geral) : 0
    const celulas: (CelulaDoMes | null)[] = []
    for (let m = 1; m <= 12; m++) {
      const chave = `${ano}-${String(m).padStart(2, '0')}`
      const anunciados = (porTicker.get(e.ticker) ?? []).filter((p) => (base === 'com' ? p.dataCom.slice(0, 7) : p.pagamentoEm?.slice(0, 7)) === chave)
      if (anunciados.length) {
        // "Pago" é só o que já caiu na conta (data de pagamento passada), em qualquer das duas visões: data com passada com
        // pagamento ainda por vir continua "anunciado". Sem data de pagamento, também é anunciado.
        celulas.push({ status: anunciados.every((p) => p.pagamentoEm !== null && p.pagamentoEm < hoje) ? 'pago' : 'confirmado' })
        continue
      }
      const passou = ano < anoDeHoje || (ano === anoDeHoje && m < mesDeHoje)
      const anos = e.meses[(m - 1 - deslocamento + 24) % 12]
      celulas.push(!passou && anos >= radar.minimoDeAnos ? { status: 'provavel', anos } : null)
    }
    if (celulas.some(Boolean)) linhas.push({ ticker: e.ticker, nome: e.nome, setor: e.setor, celulas })
  }
  return linhas.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

export const setoresDoRadar = (radar: SnapshotRadarInteligente): string[] =>
  [...new Set(radar.empresas.map((e) => e.setor).filter((s): s is string => Boolean(s)))].sort((a, b) => a.localeCompare(b))
