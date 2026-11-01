import { describe, expect, it } from 'vitest'
import type { Barra } from './analiseTecnica'
import { linhasDeTendencia, valorDaLinha } from './linhasDeTendencia'

function dia(i: number): string {
  const d = new Date('2025-01-06T12:00:00Z')
  let n = 0
  while (n < i) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++
  }
  return d.toISOString().slice(0, 10)
}
const barra = (i: number, c: number): Barra => ({ data: dia(i), fech: c, max: c + 0.5, min: c - 0.5, vol: 1000 })

/** Preço que sobe 0,3 por candle com ondas de 20 candles e 4 de amplitude: fundos e topos em retas paralelas. */
const subindo = (n: number): Barra[] => Array.from({ length: n }, (_, i) => barra(i, 100 + 0.3 * i + 4 * Math.cos((2 * Math.PI * i) / 20)))
const caindo = (n: number): Barra[] => Array.from({ length: n }, (_, i) => barra(i, 200 - 0.3 * i + 4 * Math.cos((2 * Math.PI * i) / 20)))

describe('linhasDeTendencia', () => {
  it('poucos candles não geram linha', () => {
    expect(linhasDeTendencia(subindo(30))).toEqual([])
  })

  it('LTA liga os fundos ascendentes, com vários toques, e a reta passa pelos pivôs', () => {
    const l = linhasDeTendencia(subindo(90)).find((x) => x.tipo === 'LTA')
    expect(l).toBeDefined()
    expect(l!.toques).toBeGreaterThanOrEqual(3)
    expect(l!.inclinacao).toBeCloseTo(0.3, 2)
    expect(valorDaLinha(l!, l!.i2)).toBeCloseTo(l!.p2, 6)
    expect(l!.rompida).toBeNull()
    expect(l!.explicacao).toContain('LTA ligando os fundos')
    expect(l!.deslocamentoRetorno).toBeGreaterThan(0)
    expect(linhasDeTendencia(subindo(90)).some((x) => x.tipo === 'LTB')).toBe(false)
  })

  it('LTB liga os topos descendentes', () => {
    const l = linhasDeTendencia(caindo(100)).find((x) => x.tipo === 'LTB')
    expect(l).toBeDefined()
    expect(l!.inclinacao).toBeCloseTo(-0.3, 2)
    expect(l!.deslocamentoRetorno).toBeLessThan(0)
    expect(linhasDeTendencia(caindo(100)).some((x) => x.tipo === 'LTA')).toBe(false)
  })

  it('fechamento bem abaixo da LTA marca a ruptura; muito tempo depois a linha é descartada', () => {
    const base = subindo(90)
    const quebra = [...base, ...Array.from({ length: 4 }, (_, k) => barra(90 + k, 112 - k * 2))]
    const l = linhasDeTendencia(quebra).find((x) => x.tipo === 'LTA')
    expect(l?.rompida).not.toBeNull()
    expect(l!.distanciaPct).toBeLessThan(-1)
    const velha = [...quebra, ...Array.from({ length: 40 }, (_, k) => barra(94 + k, 104))]
    expect(linhasDeTendencia(velha).find((x) => x.tipo === 'LTA')).toBeUndefined()
  })

  it('um fundo que fura a reta entre os dois pivôs invalida essa reta', () => {
    const b = subindo(90)
    b[30] = { ...b[30], min: b[30].min - 3 } // fundo de i=30 afundado: a reta 10-70 passaria por cima dele
    const l = linhasDeTendencia(b).find((x) => x.tipo === 'LTA')
    if (l) expect(l.i1).not.toBe(10)
  })
})
