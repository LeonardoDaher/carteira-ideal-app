// Imposto de renda mensal sobre opções (pessoa física, mercado de bolsa). Contas puras, sem rede.
//
// Regras modeladas (apuração mensal, DARF código 6015):
//  - Operações comuns (swing trade): 15% sobre o ganho líquido do mês. Não há a isenção dos R$ 20 mil, que vale só para ações à vista.
//  - Day trade: 20% sobre o ganho líquido do mês, apurado separadamente.
//  - Prejuízo do mês e de meses anteriores abate ganhos futuros da mesma categoria (swing com swing, day trade com day trade).
//  - IRRF ("dedo-duro"): 0,005% sobre o valor das vendas nas operações comuns; 1% sobre o ganho diário líquido no day trade.
//    É abatido do imposto do mês, e a sobra fica de crédito para os meses seguintes.
//  - DARF abaixo de R$ 10,00 não é pago: o valor se acumula para o mês seguinte.
//  - Vencimento: último dia útil do mês seguinte (aqui só se desconta sábado e domingo; feriados ficam de fora).
// Simplificações: o resultado de cada operação é informado já líquido de corretagem e emolumentos; exercício de opção
// (que muda o custo da ação, e não gera resultado da opção) não é tratado; o IRRF abaixo de R$ 1,00 não é acumulado à parte.

export type CategoriaIr = 'swing' | 'daytrade'

export interface OperacaoIr {
  id: string
  /** Data em que o resultado foi realizado (encerramento, venda ou vencimento), AAAA-MM-DD. */
  data: string
  categoria: CategoriaIr
  descricao: string
  /** Ganho (+) ou prejuízo (−) líquido da operação, em reais. */
  resultado: number
  /** Valor vendido (prêmio recebido) em reais, base do IRRF de 0,005% nas operações comuns. */
  vendido: number
  /** 'b3' = veio do extrato enviado; ausente = lançado à mão. */
  origem?: 'b3'
}

export const ALIQUOTA: Record<CategoriaIr, number> = { swing: 0.15, daytrade: 0.2 }
export const IRRF_SWING = 0.00005
export const IRRF_DAYTRADE = 0.01
export const DARF_MINIMO = 10

export interface MesIr {
  /** AAAA-MM */
  mes: string
  resultadoSwing: number
  resultadoDayTrade: number
  /** Prejuízo de meses anteriores usado para abater o ganho do mês. */
  compensadoSwing: number
  compensadoDayTrade: number
  baseSwing: number
  baseDayTrade: number
  impostoSwing: number
  impostoDayTrade: number
  irrfSwing: number
  irrfDayTrade: number
  /** Crédito de IRRF de meses anteriores usado neste mês. */
  creditoUsado: number
  /** DARF acumulado de meses anteriores (menores que R$ 10) somado a este mês. */
  acumuladoAnterior: number
  /** Valor a pagar neste mês de apuração (0 se ficou abaixo do mínimo ou coberto por IRRF). */
  darf: number
  /** Sobra de IRRF que segue para o mês seguinte. */
  creditoSeguinte: number
  /** DARF abaixo de R$ 10 que segue para o mês seguinte. */
  acumuladoSeguinte: number
  /** Prejuízo que segue para compensar nos próximos meses. */
  prejuizoSwingSeguinte: number
  prejuizoDayTradeSeguinte: number
  /** Último dia útil do mês seguinte. */
  vencimento: string
}

const arred = (v: number) => Math.round(v * 100) / 100

export function mesDe(data: string): string {
  return data.slice(0, 7)
}

/** Último dia útil (segunda a sexta) do mês seguinte ao `mes` (AAAA-MM). */
export function vencimentoDarf(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m + 1, 0)) // último dia do mês seguinte (m é 1-based: mês seguinte = índice m)
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function compensar(resultado: number, prejuizo: number): { usado: number; base: number; prejuizoNovo: number } {
  if (resultado <= 0) return { usado: 0, base: 0, prejuizoNovo: prejuizo - resultado }
  const usado = Math.min(prejuizo, resultado)
  return { usado, base: resultado - usado, prejuizoNovo: prejuizo - usado }
}

/** Apuração mês a mês, em ordem cronológica, levando adiante prejuízos, crédito de IRRF e DARF abaixo do mínimo. */
export function apurarMeses(operacoes: OperacaoIr[]): MesIr[] {
  const meses = [...new Set(operacoes.map((o) => mesDe(o.data)))].sort()
  let prejSwing = 0
  let prejDt = 0
  let credito = 0
  let acumulado = 0
  return meses.map((mes) => {
    const doMes = operacoes.filter((o) => mesDe(o.data) === mes)
    const swing = doMes.filter((o) => o.categoria === 'swing')
    const dt = doMes.filter((o) => o.categoria === 'daytrade')
    const resultadoSwing = arred(swing.reduce((t, o) => t + o.resultado, 0))
    const resultadoDayTrade = arred(dt.reduce((t, o) => t + o.resultado, 0))

    const cs = compensar(resultadoSwing, prejSwing)
    const cd = compensar(resultadoDayTrade, prejDt)
    prejSwing = arred(cs.prejuizoNovo)
    prejDt = arred(cd.prejuizoNovo)

    const impostoSwing = arred(cs.base * ALIQUOTA.swing)
    const impostoDayTrade = arred(cd.base * ALIQUOTA.daytrade)

    const irrfSwing = arred(swing.reduce((t, o) => t + Math.max(0, o.vendido), 0) * IRRF_SWING)
    const porDia = new Map<string, number>()
    for (const o of dt) porDia.set(o.data, (porDia.get(o.data) ?? 0) + o.resultado)
    const irrfDayTrade = arred([...porDia.values()].reduce((t, v) => t + Math.max(0, v) * IRRF_DAYTRADE, 0))

    const bruto = impostoSwing + impostoDayTrade - irrfSwing - irrfDayTrade
    const acumuladoAnterior = acumulado
    const creditoAnterior = credito
    let liquido = bruto - creditoAnterior
    let creditoUsado = Math.min(creditoAnterior, Math.max(bruto, 0))
    if (liquido < 0) {
      credito = arred(-liquido)
      liquido = 0
    } else {
      credito = 0
    }
    const devido = arred(liquido + acumulado)
    let darf = 0
    if (devido >= DARF_MINIMO) {
      darf = devido
      acumulado = 0
    } else {
      acumulado = devido
    }
    creditoUsado = arred(creditoUsado)
    return {
      mes, resultadoSwing, resultadoDayTrade,
      compensadoSwing: arred(cs.usado), compensadoDayTrade: arred(cd.usado),
      baseSwing: arred(cs.base), baseDayTrade: arred(cd.base),
      impostoSwing, impostoDayTrade, irrfSwing, irrfDayTrade,
      creditoUsado, acumuladoAnterior, darf,
      creditoSeguinte: credito, acumuladoSeguinte: acumulado,
      prejuizoSwingSeguinte: prejSwing, prejuizoDayTradeSeguinte: prejDt,
      vencimento: vencimentoDarf(mes),
    }
  })
}
