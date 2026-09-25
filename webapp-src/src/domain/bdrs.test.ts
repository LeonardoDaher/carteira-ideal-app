import { describe, expect, it } from 'vitest'
import { agruparPorSetor, buscarBdrs, formatarVariacao, simularCompra, textoProporcao } from './bdrs'
import type { BdrBusca, BdrLista } from './bdrs'

const bdr = (ticker: string, setor: string, volumeMedio: number): BdrLista => ({
  ticker, nome: ticker, setor, cotacao: 50, dataCotacao: '2026-09-25', variacao3m: 1, volumeMedio, minima52: 40, maxima52: 60, acoesPorBdr: 0.05,
})

describe('agruparPorSetor', () => {
  it('ordena por volume dentro do setor e deixa "Outros" por último', () => {
    const grupos = agruparPorSetor([
      bdr('AAAA34', 'Financeiro', 1_000_000),
      bdr('BBBB34', 'Software e internet', 5_000_000),
      bdr('CCCC34', 'Software e internet', 9_000_000),
      bdr('DDDD34', 'Outros', 50_000_000),
    ])
    expect(grupos.map((g) => g.setor)).toEqual(['Software e internet', 'Financeiro', 'Outros'])
    expect(grupos[0].bdrs.map((b) => b.ticker)).toEqual(['CCCC34', 'BBBB34'])
  })
})

describe('buscarBdrs', () => {
  const busca: BdrBusca[] = [
    { ticker: 'AAPL34', tipo: 'acao', nome: 'Apple Inc.', setor: 'Semicondutores e hardware', cotacao: 87, volumeDia: 1 },
    { ticker: 'AMZO34', tipo: 'acao', nome: null, setor: 'Varejo e e-commerce', cotacao: 64, volumeDia: 1 },
    { ticker: 'BSLV39', tipo: 'etf', nome: 'ISHARES SILVER TRUST', setor: 'Metais preciosos', cotacao: 100, volumeDia: 1 },
  ]
  it('acha por código, por começo de código e por nome, sem acento nem caixa', () => {
    expect(buscarBdrs(busca, 'aapl34').map((b) => b.ticker)).toEqual(['AAPL34'])
    expect(buscarBdrs(busca, 'a').length).toBe(0) // precisa de 2 letras
    expect(buscarBdrs(busca, 'am').map((b) => b.ticker)).toEqual(['AMZO34'])
    expect(buscarBdrs(busca, 'apple').map((b) => b.ticker)).toEqual(['AAPL34'])
    expect(buscarBdrs(busca, 'silver').map((b) => b.ticker)).toEqual(['BSLV39'])
  })
})

describe('textoProporcao', () => {
  it('escreve a proporção como o investidor fala', () => {
    expect(textoProporcao(0.05)).toBe('20 BDRs = 1 ação')
    expect(textoProporcao(1)).toBe('1 BDR = 1 ação')
    expect(textoProporcao(2)).toBe('1 BDR = 2 ações')
    expect(textoProporcao(0.1, 'etf')).toBe('10 BDRs = 1 cota do ETF')
    expect(textoProporcao(null)).toBeNull()
  })
})

describe('simularCompra', () => {
  it('compra só BDRs inteiros e mostra a sobra', () => {
    expect(simularCompra(5000, 87.84, 0.05)).toEqual({ quantidade: 56, investido: 4919.04, sobra: 80.96, equivalente: 2.8 })
  })
  it('sem proporção conhecida, não calcula o equivalente', () => {
    expect(simularCompra(1000, 100)?.equivalente).toBeNull()
  })
  it('valor menor que o preço compra zero; valores inválidos não simulam', () => {
    expect(simularCompra(50, 87.84)?.quantidade).toBe(0)
    expect(simularCompra(0, 87.84)).toBeNull()
  })
})

describe('formatarVariacao', () => {
  it('põe sinal e uma casa decimal', () => {
    expect(formatarVariacao(12.34)).toBe('+12,3%')
    expect(formatarVariacao(-4)).toBe('−4,0%')
    expect(formatarVariacao(0)).toBe('0,0%')
  })
})
