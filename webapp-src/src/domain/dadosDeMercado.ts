/**
 * Aba "Dados de mercado" do Simule Ações: fluxo de investidor estrangeiro e posição de aluguel (empréstimo) de ações.
 * Só funções puras e tipos; os arquivos são lidos pela tela (`useArquivoDados`).
 */

/** Um pregão do fluxo de investimento na B3, em R$ milhões (positivo = entrada, negativo = saída). */
export interface RegistroFluxo {
  data: string // AAAA-MM-DD
  estrangeiro: number
  institucional: number
  pessoaFisica: number
  instFinanceira: number
  outros: number
}

export interface SnapshotFluxo {
  /** Quando o job gerou o arquivo (ISO). */
  geradoEm: string | null
  /** De onde vêm os números (texto mostrado na tela). */
  fonte: string
  /** Do mais antigo para o mais recente. */
  registros: RegistroFluxo[]
}

/** Uma ação no aluguel (empréstimo de ativos) da B3. */
export interface RegistroAluguel {
  ticker: string
  nome?: string
  /** Valor do saldo em aberto, em reais. */
  saldoFinanceiro: number
  /** Variação do saldo em relação ao dia anterior (fração: 0,05 = +5%). */
  variacaoDia?: number | null
  /** Quantidade de ações emprestadas. */
  saldoQuantidade?: number | null
  /** Taxa média anual do aluguel (fração). */
  taxaMedia?: number | null
}

export interface SnapshotAluguel {
  geradoEm: string | null
  dataReferencia: string | null
  fonte: string
  registros: RegistroAluguel[]
}

export type Periodo = 'mes' | 'ano' | '30' | '90'

export const ROTULO_PERIODO: Record<Periodo, string> = { mes: 'No mês', ano: 'No ano', '30': '30 pregões', '90': '90 pregões' }

/** Registros de um período, terminando no último pregão disponível. */
export function recortar(registros: RegistroFluxo[], periodo: Periodo): RegistroFluxo[] {
  const ultimo = registros[registros.length - 1]
  if (!ultimo) return []
  if (periodo === 'mes') return registros.filter((r) => r.data.slice(0, 7) === ultimo.data.slice(0, 7))
  if (periodo === 'ano') return registros.filter((r) => r.data.slice(0, 4) === ultimo.data.slice(0, 4))
  return registros.slice(-Number(periodo))
}

export function somar(registros: RegistroFluxo[], campo: keyof Omit<RegistroFluxo, 'data'> = 'estrangeiro'): number {
  return registros.reduce((s, r) => s + r[campo], 0)
}

/** Média móvel simples: o ponto i usa os últimos `janela` valores; antes de haver janela cheia, devolve null. */
export function mediaMovel(valores: number[], janela: number): (number | null)[] {
  return valores.map((_, i) => {
    if (i + 1 < janela) return null
    let s = 0
    for (let k = i + 1 - janela; k <= i; k++) s += valores[k]
    return s / janela
  })
}

/** Quantos pregões seguidos, até o último, o saldo teve o mesmo sinal (positivo conta como entrada). */
export function sequenciaAtual(registros: RegistroFluxo[]): { dias: number; entrada: boolean } | null {
  const ultimo = registros[registros.length - 1]
  if (!ultimo || ultimo.estrangeiro === 0) return null
  const entrada = ultimo.estrangeiro > 0
  let dias = 0
  for (let i = registros.length - 1; i >= 0 && registros[i].estrangeiro > 0 === entrada && registros[i].estrangeiro !== 0; i--) dias++
  return { dias, entrada }
}

/** "−R$ 1,7 bi", "R$ 85,9 mi": valor em milhões de reais, com sinal explícito para saída. */
export function formatarMilhoes(valorEmMilhoes: number, comSinal = true): string {
  const abs = Math.abs(valorEmMilhoes)
  const texto = abs >= 1000 ? `${(abs / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi` : `${abs.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`
  const sinal = valorEmMilhoes < 0 ? '−' : comSinal && valorEmMilhoes > 0 ? '+' : ''
  return `${sinal}R$ ${texto}`
}

/** "R$ 4,2 bi", "R$ 850 mi": valor em reais (saldo do aluguel). */
export function formatarReaisCurto(valor: number): string {
  if (valor >= 1e9) return `R$ ${(valor / 1e9).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bi`
  if (valor >= 1e6) return `R$ ${(valor / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: valor >= 1e7 ? 0 : 1 })} mi`
  return `R$ ${Math.round(valor / 1000).toLocaleString('pt-BR')} mil`
}

/** As ações com maior saldo alugado, em ordem decrescente (empates por código). */
export function maisAlugadas(registros: RegistroAluguel[], quantas = 15): RegistroAluguel[] {
  return [...registros]
    .filter((r) => Number.isFinite(r.saldoFinanceiro) && r.saldoFinanceiro > 0)
    .sort((a, b) => b.saldoFinanceiro - a.saldoFinanceiro || a.ticker.localeCompare(b.ticker))
    .slice(0, quantas)
}

/** Quanto cada ação pesa no saldo total listado (fração). Usa o total de todos os registros, não só os mostrados. */
export function pesoNoTotal(registros: RegistroAluguel[]): Map<string, number> {
  const total = registros.reduce((s, r) => s + (r.saldoFinanceiro > 0 ? r.saldoFinanceiro : 0), 0)
  return new Map(registros.map((r) => [r.ticker, total > 0 ? Math.max(0, r.saldoFinanceiro) / total : 0]))
}

/** Dia AAAA-MM-DD em dd/mm/aaaa. */
export function dataBR(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export interface TotalMes {
  /** AAAA-MM */
  mes: string
  /** Saldo do estrangeiro no mês, em R$ milhões (positivo = entrada). */
  estrangeiro: number
}

/** Saldo do estrangeiro mês a mês; os `quantos` meses mais recentes, do mais antigo para o mais novo. */
export function totaisPorMes(registros: RegistroFluxo[], quantos = 12): TotalMes[] {
  const mapa = new Map<string, number>()
  for (const r of registros) mapa.set(r.data.slice(0, 7), (mapa.get(r.data.slice(0, 7)) ?? 0) + r.estrangeiro)
  return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, estrangeiro]) => ({ mes, estrangeiro })).slice(-quantos)
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** "2026-11" em "nov/26". */
export function rotuloMes(mes: string): string {
  const [a, m] = mes.split('-')
  return `${MESES[Number(m) - 1]}/${a.slice(2)}`
}

/** Candle diário do índice: [data, abertura, máxima, mínima, fechamento, volume]. */
export type BarraIndice = [string, number, number, number, number, number]

/** Remove o primeiro mês quando a série começa no meio dele (o saldo ficaria incompleto frente ao índice). */
export function semPrimeiroMesIncompleto(registros: RegistroFluxo[]): RegistroFluxo[] {
  const primeiro = registros[0]
  if (!primeiro || Number(primeiro.data.slice(8, 10)) <= 7) return registros
  return registros.filter((r) => r.data.slice(0, 7) !== primeiro.data.slice(0, 7))
}

/** Variação do índice em cada mês: fechamento do último pregão do mês ÷ fechamento do último pregão do mês anterior − 1 (usa só barras até `ate`). */
export function variacaoMensal(barras: BarraIndice[], meses: string[], ate: string): Map<string, number> {
  const fech = barras.filter((b) => b[0] <= ate).sort((a, b) => a[0].localeCompare(b[0]))
  const out = new Map<string, number>()
  for (const mes of meses) {
    const noMes = fech.filter((b) => b[0].slice(0, 7) === mes)
    const antes = fech.filter((b) => b[0].slice(0, 7) < mes)
    if (!noMes.length || !antes.length) continue
    out.set(mes, noMes[noMes.length - 1][4] / antes[antes.length - 1][4] - 1)
  }
  return out
}

export interface ParMes {
  mes: string
  /** Saldo do estrangeiro, R$ milhões. */
  fluxo: number
  /** Variação do índice no mês (fração). */
  variacao: number
}

/** Só os meses que têm fluxo e índice. */
export function parear(totais: TotalMes[], variacoes: Map<string, number>): ParMes[] {
  return totais.filter((t) => variacoes.has(t.mes)).map((t) => ({ mes: t.mes, fluxo: t.estrangeiro, variacao: variacoes.get(t.mes) as number }))
}

/** Correlação de Pearson entre fluxo e variação (precisa de 3 meses ou mais). */
export function correlacao(pares: ParMes[]): number | null {
  const n = pares.length
  if (n < 3) return null
  const mx = pares.reduce((s, p) => s + p.fluxo, 0) / n
  const my = pares.reduce((s, p) => s + p.variacao, 0) / n
  let sxy = 0, sxx = 0, syy = 0
  for (const p of pares) { sxy += (p.fluxo - mx) * (p.variacao - my); sxx += (p.fluxo - mx) ** 2; syy += (p.variacao - my) ** 2 }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null
}

/** Em quantos meses o índice andou no mesmo sentido do estrangeiro (entrou e subiu, ou saiu e caiu). */
export function mesmoSentido(pares: ParMes[]): { iguais: number; total: number } {
  const validos = pares.filter((p) => p.fluxo !== 0 && p.variacao !== 0)
  return { iguais: validos.filter((p) => p.fluxo > 0 === p.variacao > 0).length, total: validos.length }
}

export type TipoInvestidor = 'estrangeiro' | 'institucional' | 'pessoaFisica' | 'instFinanceira' | 'outros'

export const TIPOS_INVESTIDOR: { campo: TipoInvestidor; rotulo: string }[] = [
  { campo: 'estrangeiro', rotulo: 'Estrangeiro' },
  { campo: 'institucional', rotulo: 'Institucional' },
  { campo: 'pessoaFisica', rotulo: 'Pessoa física' },
  { campo: 'instFinanceira', rotulo: 'Inst. financeira' },
  { campo: 'outros', rotulo: 'Outros' },
]

export type TotalMesTodos = { mes: string } & Record<TipoInvestidor, number>

/** Saldo de cada tipo de investidor por mês (R$ milhões); os `quantos` meses mais recentes, do mais antigo para o mais novo. */
export function totaisPorMesTodos(registros: RegistroFluxo[], quantos = 12): TotalMesTodos[] {
  const mapa = new Map<string, TotalMesTodos>()
  for (const r of registros) {
    const mes = r.data.slice(0, 7)
    const t = mapa.get(mes) ?? { mes, estrangeiro: 0, institucional: 0, pessoaFisica: 0, instFinanceira: 0, outros: 0 }
    for (const { campo } of TIPOS_INVESTIDOR) t[campo] += r[campo]
    mapa.set(mes, t)
  }
  return [...mapa.values()].sort((a, b) => a.mes.localeCompare(b.mes)).slice(-quantos)
}

/**
 * Duas séries no mesmo gráfico, cada uma com a sua escala, mas com o ZERO na mesma altura.
 * `p` é a fração da altura que fica acima do zero; a posição de um valor é (p − valor/span), de 0 (topo) a 1 (base).
 */
export function escalasAlinhadas(a: number[], b: number[]): { p: number; spanA: number; spanB: number } {
  const ext = (v: number[]) => ({ mx: Math.max(0, ...v), mn: Math.min(0, ...v) })
  const ea = ext(a)
  const eb = ext(b)
  const frac = (e: { mx: number; mn: number }) => (e.mx - e.mn > 0 ? e.mx / (e.mx - e.mn) : 0.5)
  const p = Math.min(0.9, Math.max(0.1, frac(ea), frac(eb)))
  const span = (e: { mx: number; mn: number }) => Math.max(e.mx / p, -e.mn / (1 - p), 1e-9)
  return { p, spanA: span(ea), spanB: span(eb) }
}
