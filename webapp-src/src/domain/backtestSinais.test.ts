import { describe, expect, it } from 'vitest'
import type { Barra } from './analiseTecnica'
import { agrupar, resumir, simular } from './backtestSinais'

const b = (i: number, abe: number, fech: number, max: number, min: number): Barra => ({ data: `2025-01-${String(i + 1).padStart(2, '0')}`, abe, fech, max, min, vol: 1000 })
const parado = (de: number, n: number, p = 100): Barra[] => Array.from({ length: n }, (_, k) => b(de + k, p, p, p + 0.5, p - 0.5))

// candle de sinal no índice 0: gatilho 101 (máxima), stop 99 (mínima), risco de 2 na entrada em 101
const sinalC = { indice: 0, lado: 'compra' as const, gatilho: 101, stop: 99 }

describe('simular', () => {
  it('compra: aciona no gatilho, sobe e termina no tempo com o resultado em R', () => {
    const barras = [b(0, 100, 100.8, 101, 99.5), b(1, 100.8, 102, 102.5, 100.8), ...Array.from({ length: 25 }, (_, k) => b(2 + k, 103, 103, 103.5, 102.5))]
    const o = simular(barras, sinalC)!
    expect(o.indiceEntrada).toBe(1)
    expect(o.entrada).toBe(101)
    expect(o.saida).toBe('tempo')
    expect(o.r).toBeCloseTo((103 - 101) / 2, 6)
    expect(o.bateu1R).toBe(true)
    expect(o.riscoPct).toBeCloseTo((2 / 101) * 100, 6)
  })

  it('gap de abertura acima do gatilho: entra na abertura e o risco cresce', () => {
    const barras = [b(0, 100, 100.8, 101, 99.5), b(1, 102, 102, 102.5, 101.5), ...parado(2, 25, 102)]
    const o = simular(barras, sinalC)!
    expect(o.entrada).toBe(102)
    expect(o.riscoPct).toBeCloseTo((3 / 102) * 100, 6)
  })

  it('stop tocado depois da entrada: perde 1R, ou mais se abrir abaixo do stop', () => {
    const barras = [b(0, 100, 100.8, 101, 99.5), b(1, 101, 101.5, 101.8, 101), b(2, 101.2, 99.2, 101.2, 98.9), ...parado(3, 25, 99)]
    expect(simular(barras, sinalC)!.r).toBeCloseTo(-1, 6)
    const gapBaixo = [b(0, 100, 100.8, 101, 99.5), b(1, 101, 101.5, 101.8, 101), b(2, 98, 97.5, 98.5, 97), ...parado(3, 25, 97.5)]
    expect(simular(gapBaixo, sinalC)!.r).toBeCloseTo((98 - 101) / 2, 6)
  })

  it('stop e gatilho no mesmo candle: assume o stop', () => {
    const barras = [b(0, 100, 100.8, 101, 99.5), b(1, 100.5, 100, 101.5, 98.5), ...parado(2, 25, 100)]
    const o = simular(barras, sinalC)!
    expect(o.saida).toBe('stop')
    expect(o.r).toBeCloseTo(-1, 6)
  })

  it('stop perdido antes do gatilho, gatilho nunca acionado ou futuro curto: sem operação', () => {
    expect(simular([b(0, 100, 100.8, 101, 99.5), b(1, 99.5, 99, 100, 98.5), ...parado(2, 25, 99)], sinalC)).toBeNull()
    expect(simular([b(0, 100, 100.8, 101, 99.5), ...parado(1, 30, 100)], sinalC)).toBeNull()
    expect(simular([b(0, 100, 100.8, 101, 99.5), b(1, 100.8, 102, 102.5, 100.8), b(2, 102, 102, 103, 101)], sinalC)).toBeNull()
  })

  it('venda é o espelho da compra', () => {
    const s = { indice: 0, lado: 'venda' as const, gatilho: 99, stop: 101 }
    const barras = [b(0, 100, 99.2, 100.5, 99), b(1, 99.2, 98, 99.2, 97.5), ...Array.from({ length: 25 }, (_, k) => b(2 + k, 97, 97, 97.5, 96.5))]
    const o = simular(barras, s)!
    expect(o.entrada).toBe(99)
    expect(o.r).toBeCloseTo((99 - 97) / 2, 6)
    expect(o.bateu1R).toBe(true)
  })
})

describe('resumir e agrupar', () => {
  const op = (r: number, bateu1R: boolean, saida: 'stop' | 'tempo', riscoPct = 4) => ({ indiceSinal: 0, indiceEntrada: 1, dataEntrada: '2025-01-02', lado: 'compra' as const, entrada: 100, stop: 96, riscoPct, r, saida, bateu1R, favoravelR: 0, retornoSemStopPct: 0 })
  it('média, erro, taxas e risco mediano', () => {
    const r = resumir([op(1, true, 'tempo'), op(-1, false, 'stop'), op(2, true, 'tempo')])
    expect(r.n).toBe(3)
    expect(r.mediaR).toBeCloseTo(2 / 3, 6)
    expect(r.taxa1R).toBeCloseTo(2 / 3, 6)
    expect(r.taxaStop).toBeCloseTo(1 / 3, 6)
    expect(r.erroR).toBeGreaterThan(0)
    expect(resumir([]).n).toBe(0)
  })
  it('agrupa por chave', () => {
    const g = agrupar([op(1, true, 'tempo'), op(-1, false, 'stop', 8)], (o) => (o.riscoPct > 5 ? 'alto' : 'baixo'))
    expect(g.alto.n).toBe(1)
    expect(g.baixo.mediaR).toBe(1)
  })
})
