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
