import { describe, expect, it } from 'vitest'
import { DIAS_UTEIS_NO_MES, passoDaCall, passoDaPut } from './roda'
import { precoBs } from './simulaOpcoes'
import type { SerieOpcao } from './opcoes'

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, ultimo: number, vencimento = '2026-11-19'): SerieOpcao => ({
  codigo, tipo, estilo: 'americana', strike, vencimento, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 10, volume: 1000,
})
const r = Math.log(1.14)
// Put de strike 57 a 22 dias úteis, cotada pelo modelo com volatilidade de 30% (o ativo vale 60).
const premioPut = precoBs({ tipo: 'put', s: 60, strike: 57, t: 22 / 252, r, sigma: 0.3 })
const put = serie('PETRW570', 'put', 57, premioPut)

describe('passo da put', () => {
  it('calcula o caixa, o prêmio, o rendimento e o preço efetivo se for exercida', () => {
    const p = passoDaPut(put, 60, 22, r, 100)
    expect(p.caixa).toBeCloseTo(5700, 6)
    expect(p.premioTotal).toBeCloseTo(premioPut * 100, 6)
    expect(p.rendimentoNoPrazo).toBeCloseTo(premioPut / 57, 8)
    expect(p.custoEfetivo).toBeCloseTo(57 - premioPut, 8)
    expect(p.descontoSobreAtivo).toBeCloseTo((60 - (57 - premioPut)) / 60, 8)
  })

  it('leva o rendimento a 21 dias úteis pela regra de três', () => {
    const p = passoDaPut(put, 60, 42, r, 100)
    expect(p.rendimentoPorMes).toBeCloseTo(p.rendimentoNoPrazo * (DIAS_UTEIS_NO_MES / 42), 10)
  })

  it('a volatilidade implícita volta ao 30% usado para cotar, e a chance de exercício é a da put fora do dinheiro', () => {
    const p = passoDaPut(put, 60, 22, r, 100)
    expect(p.volatilidade).toBeCloseTo(0.3, 3)
    expect(p.chanceDeExercicio!).toBeGreaterThan(0.1)
    expect(p.chanceDeExercicio!).toBeLessThan(0.4)
    // mais perto do preço, mais chance
    const perto = passoDaPut(serie('X', 'put', 59, precoBs({ tipo: 'put', s: 60, strike: 59, t: 22 / 252, r, sigma: 0.3 })), 60, 22, r, 100)
    expect(perto.chanceDeExercicio!).toBeGreaterThan(p.chanceDeExercicio!)
  })

  it('sem prazo, não inventa rendimento por mês nem chance', () => {
    const p = passoDaPut(put, 60, 0, r, 100)
    expect(p.rendimentoPorMes).toBe(0)
    expect(p.chanceDeExercicio).toBeNull()
  })
})

describe('passo da call depois do exercício', () => {
  // Call de strike 60 vencendo 20 dias úteis depois da put (42 de hoje), a 30% de volatilidade, com o ativo a 60.
  const ultimoCall = precoBs({ tipo: 'call', s: 60, strike: 60, t: 42 / 252, r, sigma: 0.3 })
  const call = serie('PETRL600', 'call', 60, ultimoCall, '2026-12-18')

  it('estima o prêmio com o ativo no strike da put e o prazo que sobra depois do vencimento dela', () => {
    const c = passoDaCall(call, put, 60, 22, 42, r, 100)
    expect(c.diasDaCall).toBe(20)
    expect(c.volatilidade).toBeCloseTo(0.3, 3)
    expect(c.premioEstimado).toBeCloseTo(precoBs({ tipo: 'call', s: 57, strike: 60, t: 20 / 252, r, sigma: 0.3 }), 4)
    expect(c.premioEstimado).toBeLessThan(ultimoCall) // menos prazo e ativo mais baixo: vale menos que hoje
  })

  it('o giro completo soma a diferença entre os strikes e os dois prêmios', () => {
    const c = passoDaCall(call, put, 60, 22, 42, r, 100)
    const esperado = (60 - 57 + premioPut + c.premioEstimado) * 100
    expect(c.ganhoDoGiroCompleto).toBeCloseTo(esperado, 6)
    expect(c.rendimentoDoGiroCompleto).toBeCloseTo(esperado / 5700, 8)
  })

  it('o equilíbrio das ações é o strike da put menos os dois prêmios', () => {
    const c = passoDaCall(call, put, 60, 22, 42, r, 100)
    expect(c.equilibrioDasAcoes).toBeCloseTo(57 - premioPut - c.premioEstimado, 8)
    expect(c.equilibrioDasAcoes).toBeLessThan(57 - premioPut)
  })

  it('uma call com strike acima do da put tem menos chance de ser exercida que uma com strike no da put', () => {
    const acima = serie('C63', 'call', 63, 1, '2026-12-18')
    const igual = serie('C57', 'call', 57, 3, '2026-12-18')
    expect(passoDaCall(acima, put, 60, 22, 42, r, 100).chanceDeExercicio).toBeLessThan(passoDaCall(igual, put, 60, 22, 42, r, 100).chanceDeExercicio)
  })

  it('call no mesmo vencimento da put ainda usa pelo menos um dia', () => {
    expect(passoDaCall({ ...call, vencimento: put.vencimento }, put, 60, 22, 22, r, 100).diasDaCall).toBe(1)
  })
})
