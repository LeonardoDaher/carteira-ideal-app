import { describe, expect, it } from 'vitest'
import { vistaValida, zoomarVista } from './GraficoPrecoAcao'

describe('vista do gráfico de preço (ampliar e mover)', () => {
  it('mantém a janela dentro do histórico', () => {
    expect(vistaValida({ qtd: 500, desloc: 10 }, 260)).toEqual({ qtd: 260, desloc: 0 })
    expect(vistaValida({ qtd: 100, desloc: 999 }, 260)).toEqual({ qtd: 100, desloc: 160 })
    expect(vistaValida({ qtd: 2, desloc: -5 }, 260)).toEqual({ qtd: 15, desloc: 0 })
    expect(vistaValida({ qtd: 120, desloc: 0 }, 10)).toEqual({ qtd: 10, desloc: 0 })
  })

  it('aproximar ancorado na ponta direita mantém o último candle e reduz a quantidade', () => {
    const v = zoomarVista({ qtd: 120, desloc: 0 }, 260, 1 / 1.18, 1)
    expect(v.qtd).toBeLessThan(120)
    expect(v.desloc).toBe(0)
  })

  it('afastar e aproximar sempre mudam ao menos um candle e respeitam os limites', () => {
    expect(zoomarVista({ qtd: 15, desloc: 0 }, 260, 0.5, 0.5).qtd).toBe(15)
    expect(zoomarVista({ qtd: 259, desloc: 0 }, 260, 1.01, 0.5).qtd).toBe(260)
    expect(zoomarVista({ qtd: 100, desloc: 0 }, 1000, 1.01, 0.5).qtd).toBe(101)
  })

  it('o candle sob o ponteiro fica no mesmo ponto ao ampliar', () => {
    const antes = { qtd: 100, desloc: 50 }
    const total = 400
    const ancora = 0.25
    const candleAntes = total - antes.desloc - antes.qtd + ancora * antes.qtd
    const depois = zoomarVista(antes, total, 0.5, ancora)
    const candleDepois = total - depois.desloc - depois.qtd + ancora * depois.qtd
    expect(Math.abs(candleDepois - candleAntes)).toBeLessThan(1)
  })
})
