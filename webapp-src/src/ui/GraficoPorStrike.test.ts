import { describe, expect, it } from 'vitest'
import { tetoDoEixo } from './GraficoPorStrike'

describe('tetoDoEixo', () => {
  it('sobe o máximo para um número redondo, sem sobrar muito espaço', () => {
    expect(tetoDoEixo(11_393)).toBe(12_000)
    expect(tetoDoEixo(100)).toBe(100)
    expect(tetoDoEixo(101)).toBe(120)
    expect(tetoDoEixo(37)).toBe(40)
    expect(tetoDoEixo(7)).toBe(8)
    expect(tetoDoEixo(0.9)).toBeCloseTo(1)
  })

  it('nunca fica abaixo do máximo e passa no máximo 25% dele', () => {
    for (const m of [1, 1.01, 2.4, 13, 99, 123, 5_000, 48_890, 1_234_567]) {
      const teto = tetoDoEixo(m)
      expect(teto).toBeGreaterThanOrEqual(m)
      expect(teto / m).toBeLessThanOrEqual(1.26)
    }
  })

  it('sem valor positivo, devolve 1 (eixo vazio ainda tem escala)', () => {
    expect(tetoDoEixo(0)).toBe(1)
    expect(tetoDoEixo(-5)).toBe(1)
  })
})
