// Meus Ativos: apuração mensal do imposto de renda sobre a renda variável (bolsa brasileira), derivada
// do livro de lançamentos. Mostra o isentômetro (vendas de ações no mês contra R$ 20 mil), o resultado
// de cada operação, a compensação de prejuízos e o valor do DARF (código 6015).
//
// Regras aplicadas (operações comuns, "swing trade"):
//   - Ações: 15% sobre o lucro; lucro isento no mês em que o TOTAL vendido em ações é de até R$ 20.000.
//   - ETFs e BDRs: 15%, sem isenção. FIIs: 20%, sem isenção.
//   - Day trade (compra e venda do mesmo ativo no mesmo dia): 20%, sem isenção, prejuízo próprio.
//   - Prejuízo de ações, ETFs e BDRs compensa entre si; o de FII só compensa FII; o de day trade só day trade.
//   - Lucro isento (ações até R$ 20 mil) não abate prejuízo acumulado; prejuízo em mês isento acumula.
//   - DARF abaixo de R$ 10 não se paga: o valor soma ao do mês seguinte em que houver imposto.
// Não considera: IRRF "dedo-duro" (abatimento), feriados no vencimento, custos de aquisição em carteiras
// herdadas, nem cripto e ativos do exterior. Resultado é uma estimativa para conferência, não a declaração.
//
// Módulo puro: sem rede, sem React, sem localStorage.
import type { CatalogoAtivos, ClasseCarteira } from './classificadorAtivo'
import { ehTickerDeBolsa, ordenarLancamentos } from './lancamentos'
import type { Lancamento } from './lancamentos'

export type CategoriaIR = 'acao' | 'fii' | 'etf' | 'bdr'

export const LIMITE_ISENCAO_ACOES = 20_000
export const DARF_MINIMO = 10
const ALIQUOTA_COMUM = 0.15
const ALIQUOTA_FII = 0.2
const ALIQUOTA_DAYTRADE = 0.2
const EPS = 1e-9

const centavos = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Categoria de IR de um ativo a partir da classe da carteira; null = não dá para saber (fica de fora e é avisado). */
export function categoriaIR(ativo: string, classe: ClasseCarteira | null, catalogo: CatalogoAtivos): CategoriaIR | null {
  if (!ehTickerDeBolsa(ativo)) return null
  if (classe === 'fiis') return 'fii'
  if (classe === 'bdrs') return 'bdr'
  if (catalogo.etfs.has(ativo) || catalogo.bdrs.get(ativo)?.tipo === 'etf') return 'etf'
  if (classe === 'acoesETFs') return 'acao'
  return null
}

export interface ResultadosMes {
  acoes: number
  etfs: number
  bdrs: number
  fiis: number
  daytrade: number
}

export interface MesIR {
  /** AAAA-MM */
  mes: string
  /** Total vendido em ações (operações comuns), sem descontar taxas: é o que se compara com R$ 20 mil. */
  vendasAcoes: number
  /** true = houve venda de ações e o total ficou dentro do limite de isenção. */
  dentroDaIsencao: boolean
  /** Lucro de ações que ficou isento neste mês. */
  lucroIsento: number
  resultados: ResultadosMes
  /** Prejuízo de meses anteriores usado para abater lucro neste mês. */
  prejuizoCompensado: number
  imposto: number
  /** Valor da guia, já somado ao que estava represado por ser menor que R$ 10. null = não há DARF neste mês. */
  darf: number | null
  /** Último dia útil do mês seguinte (sem considerar feriados), AAAA-MM-DD. */
  vencimento: string | null
  /** Imposto que ficou para o mês seguinte por somar menos de R$ 10. */
  represado: number
}

export interface ApuracaoIR {
  meses: MesIR[]
  prejuizoAcumulado: { comum: number; fii: number; daytrade: number }
  /** Ativos com venda que ficaram de fora porque não foi possível saber se são ação, FII, ETF ou BDR. */
  semCategoria: string[]
  /** Vendas maiores que a quantidade que o histórico mostra: faltam compras, e o lucro desse ativo pode estar errado. */
  historicoIncompleto: { ativo: string; mes: string }[]
}

type Operacao = Pick<Lancamento, 'data' | 'tipo' | 'ativo' | 'quantidade' | 'valor' | 'taxas' | 'instituicao'>

/**
 * Day trade: no mesmo dia, instituição e ativo, a menor das quantidades (compradas, vendidas) é day trade.
 * Devolve o resultado dessa parte e as operações restantes, que seguem pelo preço médio normal.
 */
function separarDayTrade(ops: Operacao[], categorias: Map<string, CategoriaIR>) {
  const grupos = new Map<string, { compras: Operacao[]; vendas: Operacao[] }>()
  const restantes: Operacao[] = []
  for (const o of ops) {
    if ((o.tipo !== 'compra' && o.tipo !== 'venda') || !categorias.has(o.ativo)) {
      restantes.push(o)
      continue
    }
    const k = `${o.data}|${o.ativo}|${o.instituicao ?? ''}`
    const g = grupos.get(k) ?? { compras: [], vendas: [] }
    ;(o.tipo === 'compra' ? g.compras : g.vendas).push(o)
    grupos.set(k, g)
  }
  const dayTrade: { mes: string; ativo: string; resultado: number }[] = []
  for (const { compras, vendas } of grupos.values()) {
    const qC = compras.reduce((s, o) => s + o.quantidade, 0)
    const qV = vendas.reduce((s, o) => s + o.quantidade, 0)
    const qDT = Math.min(qC, qV)
    if (qDT <= EPS) {
      restantes.push(...compras, ...vendas)
      continue
    }
    const fC = qDT / qC
    const fV = qDT / qV
    const custo = compras.reduce((s, o) => s + o.valor + o.taxas, 0) * fC
    const receita = vendas.reduce((s, o) => s + o.valor - o.taxas, 0) * fV
    const ref = compras[0]
    dayTrade.push({ mes: ref.data.slice(0, 7), ativo: ref.ativo, resultado: receita - custo })
    for (const o of compras) if (1 - fC > EPS) restantes.push({ ...o, quantidade: o.quantidade * (1 - fC), valor: o.valor * (1 - fC), taxas: o.taxas * (1 - fC) })
    for (const o of vendas) if (1 - fV > EPS) restantes.push({ ...o, quantidade: o.quantidade * (1 - fV), valor: o.valor * (1 - fV), taxas: o.taxas * (1 - fV) })
  }
  return { dayTrade, restantes }
}

function ultimoDiaUtilDoMesSeguinte(mes: string): string {
  const ano = Number(mes.slice(0, 4))
  const m = Number(mes.slice(5, 7))
  const d = new Date(Date.UTC(ano, m + 1, 0)) // dia 0 do mês seguinte ao seguinte = último dia do mês seguinte
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

function tributar(resultado: number, prejuizo: number, aliquota: number) {
  if (resultado < 0) return { imposto: 0, prejuizo: prejuizo - resultado, compensado: 0 }
  const compensado = Math.min(prejuizo, resultado)
  return { imposto: (resultado - compensado) * aliquota, prejuizo: prejuizo - compensado, compensado }
}

export function apurarImpostoRenda(lancamentos: Lancamento[], categoriaDe: (ativo: string) => CategoriaIR | null): ApuracaoIR {
  const categorias = new Map<string, CategoriaIR>()
  const semCategoria = new Set<string>()
  for (const l of lancamentos) {
    if (!ehTickerDeBolsa(l.ativo) || categorias.has(l.ativo) || semCategoria.has(l.ativo)) continue
    const c = categoriaDe(l.ativo)
    if (c) categorias.set(l.ativo, c)
    else if (l.tipo === 'venda') semCategoria.add(l.ativo)
  }

  const { dayTrade, restantes } = separarDayTrade(
    lancamentos.filter((l) => categorias.has(l.ativo)),
    categorias,
  )

  // Preço médio por ativo: mesma convenção de derivarPosicoes (taxas somam ao custo na compra e abatem na venda).
  const estado = new Map<string, { q: number; custo: number }>()
  const vendas: { mes: string; categoria: CategoriaIR; valor: number; resultado: number }[] = []
  const historicoIncompleto: ApuracaoIR['historicoIncompleto'] = []
  for (const l of ordenarLancamentos(restantes as Lancamento[])) {
    const s = estado.get(l.ativo) ?? { q: 0, custo: 0 }
    estado.set(l.ativo, s)
    if (l.tipo === 'saldoInicial' || l.tipo === 'compra' || l.tipo === 'bonificacao') {
      s.q += l.quantidade
      s.custo += l.valor + l.taxas
    } else if (l.tipo === 'ajusteQuantidade') {
      s.q = Math.max(0, s.q + l.quantidade)
    } else if (l.tipo === 'venda') {
      const vendida = Math.min(l.quantidade, s.q)
      if (l.quantidade - s.q > EPS) historicoIncompleto.push({ ativo: l.ativo, mes: l.data.slice(0, 7) })
      let resultado = 0
      if (vendida > EPS) {
        const custoBaixado = (s.custo / s.q) * vendida
        resultado = (l.valor - l.taxas) * (vendida / l.quantidade) - custoBaixado
        s.q -= vendida
        s.custo -= custoBaixado
      }
      if (s.q < EPS) {
        s.q = 0
        s.custo = 0
      }
      vendas.push({ mes: l.data.slice(0, 7), categoria: categorias.get(l.ativo)!, valor: l.valor, resultado })
    }
  }

  const meses = [...new Set([...vendas.map((v) => v.mes), ...dayTrade.map((d) => d.mes)])].sort()
  const pool = { comum: 0, fii: 0, daytrade: 0 }
  let represado = 0
  const saida: MesIR[] = []
  for (const mes of meses) {
    const dosVendas = vendas.filter((v) => v.mes === mes)
    const soma = (c: CategoriaIR, campo: 'valor' | 'resultado') => dosVendas.filter((v) => v.categoria === c).reduce((s, v) => s + v[campo], 0)
    const resultados: ResultadosMes = {
      acoes: soma('acao', 'resultado'),
      etfs: soma('etf', 'resultado'),
      bdrs: soma('bdr', 'resultado'),
      fiis: soma('fii', 'resultado'),
      daytrade: dayTrade.filter((d) => d.mes === mes).reduce((s, d) => s + d.resultado, 0),
    }
    const vendasAcoes = soma('acao', 'valor')
    const dentroDaIsencao = vendasAcoes > 0 && vendasAcoes <= LIMITE_ISENCAO_ACOES
    const lucroIsento = dentroDaIsencao && resultados.acoes > 0 ? resultados.acoes : 0

    const comum = tributar(resultados.acoes - lucroIsento + resultados.etfs + resultados.bdrs, pool.comum, ALIQUOTA_COMUM)
    const fii = tributar(resultados.fiis, pool.fii, ALIQUOTA_FII)
    const dt = tributar(resultados.daytrade, pool.daytrade, ALIQUOTA_DAYTRADE)
    pool.comum = comum.prejuizo
    pool.fii = fii.prejuizo
    pool.daytrade = dt.prejuizo

    const imposto = centavos(comum.imposto + fii.imposto + dt.imposto)
    let darf: number | null = null
    if (imposto > 0) {
      const total = centavos(imposto + represado)
      if (total >= DARF_MINIMO) {
        darf = total
        represado = 0
      } else {
        represado = total
      }
    }
    saida.push({
      mes,
      vendasAcoes,
      dentroDaIsencao,
      lucroIsento,
      resultados,
      prejuizoCompensado: comum.compensado + fii.compensado + dt.compensado,
      imposto,
      darf,
      vencimento: darf !== null ? ultimoDiaUtilDoMesSeguinte(mes) : null,
      represado,
    })
  }

  return { meses: saida, prejuizoAcumulado: pool, semCategoria: [...semCategoria].sort(), historicoIncompleto }
}
