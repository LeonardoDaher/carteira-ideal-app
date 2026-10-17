import { describe, expect, it } from 'vitest'
import { diasAte, faixaPerto, filtrarSeries, FILTRO_VAZIO, limitesDeStrike, moneyness, vencimentosDe } from './opcoes'
import type { SerieOpcao } from './opcoes'

const s = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string): SerieOpcao => ({ codigo, tipo, strike, vencimento, premio: 1, negocios: 5, volume: 1000 })
const series = [
  s('A', 'call', 30, '2026-11-20'), s('B', 'call', 35, '2026-11-20'), s('C', 'put', 35, '2026-11-20'),
  s('D', 'call', 40, '2026-12-18'), s('E', 'put', 28, '2026-12-18'),
]
const codigos = (l: SerieOpcao[]) => l.map((x) => x.codigo)

describe('filtrarSeries', () => {
  it('sem filtro devolve tudo', () => expect(filtrarSeries(series, FILTRO_VAZIO)).toHaveLength(5))

  it('filtra pela faixa de strike com limites incluídos', () => {
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMin: 30, strikeMax: 35 }))).toEqual(['A', 'B', 'C'])
  })

  it('aceita só o mínimo ou só o máximo', () => {
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMin: 36 }))).toEqual(['D'])
    expect(codigos(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMax: 29 }))).toEqual(['E'])
  })

  it('combina strike, tipo e vencimento', () => {
    expect(codigos(filtrarSeries(series, { tipo: 'put', vencimento: '2026-11-20', strikeMin: 30, strikeMax: 40 }))).toEqual(['C'])
  })

  it('faixa sem séries dá lista vazia', () => {
    expect(filtrarSeries(series, { ...FILTRO_VAZIO, strikeMin: 50, strikeMax: 60 })).toEqual([])
  })
})

describe('apoios', () => {
  it('faixaPerto calcula ±pct% do preço', () => expect(faixaPerto(60, 10)).toEqual({ strikeMin: 54, strikeMax: 66 }))

  it('vencimentos distintos em ordem e limites de strike', () => {
    expect(vencimentosDe(series)).toEqual(['2026-11-20', '2026-12-18'])
    expect(limitesDeStrike(series)).toEqual({ min: 28, max: 40 })
    expect(limitesDeStrike([])).toBeNull()
  })

  it('moneyness: call e put em lados opostos', () => {
    expect(moneyness('call', 30, 35)).toBe('dentro')
    expect(moneyness('call', 40, 35)).toBe('fora')
    expect(moneyness('put', 40, 35)).toBe('dentro')
    expect(moneyness('put', 30, 35)).toBe('fora')
    expect(moneyness('call', 35.2, 35)).toBe('no')
  })

  it('diasAte conta dias corridos', () => {
    expect(diasAte('2026-11-20', '2026-10-16')).toBe(35)
    expect(diasAte('2026-10-10', '2026-10-16')).toBe(-6)
  })
})
