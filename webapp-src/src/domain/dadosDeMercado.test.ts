import { describe, expect, it } from 'vitest'
import { formatarMilhoes, formatarReaisCurto, maisAlugadas, mediaMovel, pesoNoTotal, recortar, sequenciaAtual, somar } from './dadosDeMercado'
import type { RegistroFluxo } from './dadosDeMercado'

const dia = (data: string, estrangeiro: number): RegistroFluxo => ({ data, estrangeiro, institucional: 0, pessoaFisica: 0, instFinanceira: 0, outros: 0 })

const REGS = [dia('2025-12-30', 100), dia('2026-10-30', -300), dia('2026-11-03', -400), dia('2026-11-04', -1600), dia('2026-11-05', 50)]

describe('recortar e somar', () => {
  it('mês e ano terminam no último pregão', () => {
    expect(recortar(REGS, 'mes').map((r) => r.data)).toEqual(['2026-11-03', '2026-11-04', '2026-11-05'])
    expect(somar(recortar(REGS, 'mes'))).toBe(-1950)
    expect(recortar(REGS, 'ano')).toHaveLength(4)
  })
  it('janela de pregões e lista vazia', () => {
    expect(recortar(REGS, '30')).toHaveLength(5)
    expect(recortar([], 'mes')).toEqual([])
  })
})

describe('mediaMovel', () => {
  it('só começa com a janela cheia', () => {
    expect(mediaMovel([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5])
    expect(mediaMovel([1, 2], 28)).toEqual([null, null])
  })
})

describe('sequenciaAtual', () => {
  it('conta os pregões seguidos de saída ou entrada', () => {
    expect(sequenciaAtual(REGS.slice(0, 4))).toEqual({ dias: 3, entrada: false })
    expect(sequenciaAtual(REGS)).toEqual({ dias: 1, entrada: true })
    expect(sequenciaAtual([dia('2026-11-05', 0)])).toBeNull()
    expect(sequenciaAtual([])).toBeNull()
  })
})

describe('formatação', () => {
  it('milhões e bilhões com sinal', () => {
    expect(formatarMilhoes(-85.91)).toBe('−R$ 85,9 mi')
    expect(formatarMilhoes(-1734.36)).toBe('−R$ 1,7 bi')
    expect(formatarMilhoes(599.44)).toBe('+R$ 599,4 mi')
    expect(formatarMilhoes(599.44, false)).toBe('R$ 599,4 mi')
  })
  it('reais curtos', () => {
    expect(formatarReaisCurto(4.25e9)).toBe('R$ 4,3 bi')
    expect(formatarReaisCurto(850e6)).toBe('R$ 850 mi')
    expect(formatarReaisCurto(52000)).toBe('R$ 52 mil')
  })
})

describe('aluguel', () => {
  const regs = [
    { ticker: 'B3SA3', saldoFinanceiro: 300 },
    { ticker: 'PETR4', saldoFinanceiro: 600 },
    { ticker: 'VALE3', saldoFinanceiro: 100 },
    { ticker: 'ZERO3', saldoFinanceiro: 0 },
  ]
  it('ordena do maior saldo e ignora saldo zero', () => {
    expect(maisAlugadas(regs, 2).map((r) => r.ticker)).toEqual(['PETR4', 'B3SA3'])
    expect(maisAlugadas(regs).map((r) => r.ticker)).not.toContain('ZERO3')
  })
  it('peso no total usa todos os registros', () => {
    expect(pesoNoTotal(regs).get('PETR4')).toBeCloseTo(0.6)
    expect(pesoNoTotal([]).size).toBe(0)
  })
})

describe('mês a mês', () => {
  it('soma por mês e rotula', async () => {
    const { totaisPorMes, rotuloMes } = await import('./dadosDeMercado')
    expect(totaisPorMes(REGS)).toEqual([{ mes: '2025-12', estrangeiro: 100 }, { mes: '2026-10', estrangeiro: -300 }, { mes: '2026-11', estrangeiro: -1950 }])
    expect(totaisPorMes(REGS, 1)).toHaveLength(1)
    expect(rotuloMes('2026-11')).toBe('nov/26')
  })
})

describe('relação com o índice', () => {
  it('variação mensal, pares, sentido e correlação', async () => {
    const m = await import('./dadosDeMercado')
    const barras = [['2026-09-30', 0, 0, 0, 100, 0], ['2026-10-15', 0, 0, 0, 120, 0], ['2026-10-31', 0, 0, 0, 110, 0], ['2026-11-05', 0, 0, 0, 99, 0], ['2026-11-09', 0, 0, 0, 50, 0]] as import('./dadosDeMercado').BarraIndice[]
    const v = m.variacaoMensal(barras, ['2026-09', '2026-10', '2026-11'], '2026-11-06')
    expect(v.has('2026-09')).toBe(false)
    expect(v.get('2026-10')).toBeCloseTo(0.1)
    expect(v.get('2026-11')).toBeCloseTo(-0.1)
    const pares = m.parear([{ mes: '2026-10', estrangeiro: 500 }, { mes: '2026-11', estrangeiro: -400 }, { mes: '2026-12', estrangeiro: 1 }], v)
    expect(pares).toHaveLength(2)
    expect(m.mesmoSentido(pares)).toEqual({ iguais: 2, total: 2 })
    expect(m.correlacao(pares)).toBeNull()
    expect(m.correlacao([{ mes: 'a', fluxo: 1, variacao: 0.01 }, { mes: 'b', fluxo: 2, variacao: 0.02 }, { mes: 'c', fluxo: 3, variacao: 0.03 }])).toBeCloseTo(1)
  })
  it('descarta primeiro mês incompleto', async () => {
    const m = await import('./dadosDeMercado')
    expect(m.semPrimeiroMesIncompleto(REGS.slice(1))).toHaveLength(4)
    expect(m.semPrimeiroMesIncompleto([dia('2025-11-11', 1), dia('2025-12-01', 2)]).map((r) => r.data)).toEqual(['2025-12-01'])
  })
})

describe('todos os tipos por mês', () => {
  it('soma cada tipo no mês', async () => {
    const { totaisPorMesTodos } = await import('./dadosDeMercado')
    const regs = [
      { data: '2026-10-30', estrangeiro: -10, institucional: 4, pessoaFisica: 5, instFinanceira: 1, outros: 0 },
      { data: '2026-11-03', estrangeiro: -20, institucional: 8, pessoaFisica: 10, instFinanceira: 2, outros: 0 },
      { data: '2026-11-04', estrangeiro: 5, institucional: -2, pessoaFisica: -3, instFinanceira: 0, outros: 0 },
    ]
    const t = totaisPorMesTodos(regs)
    expect(t.map((x) => x.mes)).toEqual(['2026-10', '2026-11'])
    expect(t[1]).toEqual({ mes: '2026-11', estrangeiro: -15, institucional: 6, pessoaFisica: 7, instFinanceira: 2, outros: 0 })
    expect(totaisPorMesTodos(regs, 1)).toHaveLength(1)
  })
})

describe('escalas alinhadas', () => {
  it('o zero fica na mesma altura e nenhum valor sai do quadro', async () => {
    const { escalasAlinhadas } = await import('./dadosDeMercado')
    const a = [26000, -18000, 5000]
    const b = [0.126, -0.099, 0.03]
    const { p, spanA, spanB } = escalasAlinhadas(a, b)
    const pos = (v: number, s: number) => p - v / s
    for (const v of a) expect(pos(v, spanA)).toBeGreaterThanOrEqual(-1e-9), expect(pos(v, spanA)).toBeLessThanOrEqual(1 + 1e-9)
    for (const v of b) expect(pos(v, spanB)).toBeGreaterThanOrEqual(-1e-9), expect(pos(v, spanB)).toBeLessThanOrEqual(1 + 1e-9)
    expect(pos(0, spanA)).toBeCloseTo(pos(0, spanB))
    expect(escalasAlinhadas([0, 0], [0, 0]).p).toBeGreaterThan(0)
  })
})

describe('aluguel × preço', () => {
  it('compara as mais alugadas com as demais e ignora saldo pequeno ou sem preço', async () => {
    const { resumoAluguelPreco, mediana } = await import('./dadosDeMercado')
    expect(mediana([])).toBeNull()
    expect(mediana([3, 1, 2])).toBe(2)
    expect(mediana([1, 2, 3, 4])).toBe(2.5)
    const r = (ticker: string, saldo: number, var20: number | null) => ({ ticker, saldoFinanceiro: saldo, var20 })
    const regs = [r('A', 900e6, -0.1), r('B', 800e6, -0.3), r('C', 700e6, 0.1), r('D', 400e6, -0.2), r('E', 100e6, 0), r('F', 10e6, -0.9), r('G', 600e6, null)]
    const res = resumoAluguelPreco(regs, -0.15, 2)
    expect(res.universo).toBe(5)
    expect(res.grupo).toBe(2)
    expect(res.medianaGrupo).toBeCloseTo(-0.2)
    expect(res.medianaDemais).toBeCloseTo(0)
    expect(res.piorQueMercado).toBe(1)
    expect(res.cairam).toBe(2)
  })
})
