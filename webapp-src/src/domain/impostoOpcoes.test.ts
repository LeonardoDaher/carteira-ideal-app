import { describe, expect, it } from 'vitest'
import { apurarMeses, vencimentoDarf } from './impostoOpcoes'
import type { OperacaoIr } from './impostoOpcoes'

const op = (data: string, resultado: number, categoria: 'swing' | 'daytrade' = 'swing', vendido = 0): OperacaoIr => ({ id: data + resultado + categoria, data, categoria, descricao: '', resultado, vendido })

describe('imposto sobre opções', () => {
  it('swing: 15% sobre o ganho do mês, sem isenção de R$ 20 mil', () => {
    const [m] = apurarMeses([op('2026-10-05', 1000), op('2026-10-20', 500)])
    expect(m.impostoSwing).toBe(225)
    expect(m.darf).toBe(225)
  })
  it('day trade: 20% separado do swing', () => {
    const [m] = apurarMeses([op('2026-10-05', 1000, 'daytrade')])
    expect(m.impostoDayTrade).toBe(200)
    expect(m.irrfDayTrade).toBe(10)
    expect(m.darf).toBe(190)
  })
  it('prejuízo do mês compensa o ganho dos meses seguintes, só na mesma categoria', () => {
    const r = apurarMeses([op('2026-10-05', -800), op('2026-10-06', 300, 'daytrade'), op('2026-11-10', 1000)])
    expect(r[0].prejuizoSwingSeguinte).toBe(800)
    expect(r[1].compensadoSwing).toBe(800)
    expect(r[1].baseSwing).toBe(200)
    expect(r[1].impostoSwing).toBe(30)
    expect(r[0].impostoDayTrade).toBe(60)
  })
  it('IRRF de 0,005% sobre o vendido abate o imposto', () => {
    const [m] = apurarMeses([op('2026-10-05', 1000, 'swing', 20000)])
    expect(m.irrfSwing).toBe(1)
    expect(m.darf).toBe(149)
  })
  it('DARF abaixo de R$ 10 acumula para o mês seguinte', () => {
    const r = apurarMeses([op('2026-10-05', 50), op('2026-11-05', 100)])
    expect(r[0].darf).toBe(0)
    expect(r[0].acumuladoSeguinte).toBe(7.5)
    expect(r[1].darf).toBe(22.5)
  })
  it('sobra de IRRF vira crédito', () => {
    const [a, b] = apurarMeses([op('2026-10-05', 10, 'swing', 400000), op('2026-11-05', 1000)])
    expect(a.darf).toBe(0)
    expect(a.creditoSeguinte).toBeGreaterThan(0)
    expect(b.darf).toBeLessThan(150)
  })
  it('vencimento: último dia útil do mês seguinte', () => {
    expect(vencimentoDarf('2026-10')).toBe('2026-11-30') // segunda
    expect(vencimentoDarf('2026-11')).toBe('2026-12-31') // quinta
    expect(vencimentoDarf('2026-07')).toBe('2026-08-31') // segunda
    expect(vencimentoDarf('2026-04')).toBe('2026-05-29') // 31/05 é domingo
  })
})
