import { describe, expect, it } from 'vitest'
import { buscarParesCustoZero, vencimentosComCallEPut } from './custoZero'
import type { SerieOpcao } from './opcoes'

const s = (codigo: string, tipo: 'call' | 'put', strike: number, ultimo: number, vencimento = '2026-12-18'): SerieOpcao => ({
  codigo, tipo, estilo: 'americana', strike, vencimento, ultimo, dataUltimo: '2026-11-05', variacao: null, negocios: 5, volume: 1000,
})
const series = [s('C66', 'call', 66, 1.5), s('C62', 'call', 62, 2.6), s('P56', 'put', 56, 1.52), s('P58', 'put', 58, 2.55), s('P70', 'put', 70, 1.5)]

describe('custo zero', () => {
  it('alta: compra call e vende put com saldo dentro da tolerância', () => {
    const r = buscarParesCustoZero(series, 'alta', '2026-12-18', 60, 0.05)
    expect(r.map((x) => `${x.compra.codigo}/${x.venda.codigo}`)).toEqual(['C66/P56', 'C62/P58'])
    expect(r[0].saldo).toBe(0.02)
    expect(r[1].saldo).toBe(-0.05)
  })
  it('exclui put com strike acima da call', () => {
    const r = buscarParesCustoZero(series, 'alta', '2026-12-18', 60, 0.05)
    expect(r.some((x) => x.venda.codigo === 'P70')).toBe(false)
  })
  it('baixa: compra put e vende call', () => {
    const r = buscarParesCustoZero(series, 'baixa', '2026-12-18', 60, 0.05)
    expect(r[0].compra.tipo).toBe('put')
    expect(r[0].venda.tipo).toBe('call')
  })
  it('respeita a faixa de strike nas duas pontas', () => {
    const f = (min: number | null, max: number | null) => buscarParesCustoZero(series, 'alta', '2026-12-18', 60, 0.05, 10, { strikeMin: min, strikeMax: max }).map((x) => x.compra.codigo)
    expect(f(null, null)).toEqual(['C66', 'C62'])
    expect(f(60, null)).toEqual([]) // as puts 56 e 58 ficam fora
    expect(f(null, 64)).toEqual(['C62'])
    expect(f(55, 65)).toEqual(['C62'])
  })
  it('modo crédito: aceita qualquer crédito e põe o maior primeiro', () => {
    const sem = { strikeMin: null, strikeMax: null }
    const r = buscarParesCustoZero(series, 'alta', '2026-12-18', 60, 0, 10, sem, 'credito')
    expect(r.every((x) => x.saldo >= 0)).toBe(true)
    expect(r[0].saldo).toBe(r.map((x) => x.saldo).sort((a, b) => b - a)[0])
    expect(r.map((x) => `${x.compra.codigo}/${x.venda.codigo}`)).toContain('C66/P58') // crédito de 1,05
    expect(r[0].saldo).toBeGreaterThan(1)
    // no modo zero esse par não aparece
    expect(buscarParesCustoZero(series, 'alta', '2026-12-18', 60, 0.05).some((x) => x.compra.codigo === 'C66' && x.venda.codigo === 'P58')).toBe(false)
  })
  it('modo crédito na baixa: compra put e vende call recebendo a diferença', () => {
    const r = buscarParesCustoZero(series, 'baixa', '2026-12-18', 60, 0, 10, { strikeMin: null, strikeMax: null }, 'credito')
    expect(r[0]).toMatchObject({ saldo: 1.08 })
    expect(`${r[0].compra.codigo}/${r[0].venda.codigo}`).toBe('P56/C62')
    expect(r.every((x) => x.saldo >= 0 && x.compra.tipo === 'put' && x.venda.tipo === 'call')).toBe(true)
  })
  it('lista vencimentos com call e put', () => {
    expect(vencimentosComCallEPut([...series, s('C1', 'call', 60, 1, '2027-01-15')])).toEqual(['2026-12-18'])
  })
})
