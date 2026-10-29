import { describe, expect, it } from 'vitest'
import { apuracaoParaCsv, apurarImpostoRenda, categoriaIR } from './impostoRenda'
import type { CategoriaIR } from './impostoRenda'
import { CATALOGO_VAZIO } from './classificadorAtivo'
import type { Lancamento } from './lancamentos'

let n = 0
function op(tipo: 'compra' | 'venda', data: string, ativo: string, quantidade: number, preco: number, taxas = 0): Lancamento {
  return { id: `t${n++}`, data, tipo, ativo, quantidade, preco, valor: quantidade * preco, taxas, origem: 'manual' }
}

const cat = (m: Record<string, CategoriaIR>) => (a: string) => m[a] ?? null

describe('apurarImpostoRenda', () => {
  it('ação: vendas até R$ 20 mil no mês ficam isentas', () => {
    const r = apurarImpostoRenda(
      [op('compra', '2026-01-10', 'PETR4', 100, 30), op('venda', '2026-02-10', 'PETR4', 100, 40)],
      cat({ PETR4: 'acao' }),
    )
    const m = r.meses[0]
    expect(m.mes).toBe('2026-02')
    expect(m.vendasAcoes).toBe(4000)
    expect(m.dentroDaIsencao).toBe(true)
    expect(m.lucroIsento).toBeCloseTo(1000)
    expect(m.imposto).toBe(0)
    expect(m.darf).toBeNull()
  })

  it('ação: acima de R$ 20 mil paga 15% sobre o lucro e vence no último dia útil do mês seguinte', () => {
    const r = apurarImpostoRenda(
      [op('compra', '2026-01-10', 'VALE3', 1000, 50), op('venda', '2026-02-10', 'VALE3', 1000, 60)],
      cat({ VALE3: 'acao' }),
    )
    const m = r.meses[0]
    expect(m.dentroDaIsencao).toBe(false)
    expect(m.imposto).toBe(1500)
    expect(m.darf).toBe(1500)
    expect(m.vencimento).toBe('2026-03-31')
  })

  it('FII paga 20% e não tem isenção; taxas abatem o lucro', () => {
    const r = apurarImpostoRenda(
      [op('compra', '2026-01-10', 'MXRF11', 100, 10, 5), op('venda', '2026-02-10', 'MXRF11', 100, 12, 5)],
      cat({ MXRF11: 'fii' }),
    )
    expect(r.meses[0].resultados.fiis).toBeCloseTo(1200 - 5 - (1000 + 5))
    expect(r.meses[0].imposto).toBeCloseTo(38)
  })

  it('prejuízo de ação compensa lucro de ETF, mas o de FII não compensa ação', () => {
    const lancs = [
      op('compra', '2026-01-05', 'VALE3', 1000, 50),
      op('venda', '2026-01-20', 'VALE3', 1000, 45), // -5.000, vendas > 20 mil
      op('compra', '2026-01-05', 'MXRF11', 100, 10),
      op('venda', '2026-01-20', 'MXRF11', 100, 5), // -500 FII
      op('compra', '2026-02-05', 'BOVA11', 1000, 100),
      op('venda', '2026-02-20', 'BOVA11', 1000, 110), // +10.000 ETF
    ]
    const r = apurarImpostoRenda(lancs, cat({ VALE3: 'acao', MXRF11: 'fii', BOVA11: 'etf' }))
    const fev = r.meses[1]
    expect(fev.prejuizoCompensado).toBeCloseTo(5000)
    expect(fev.imposto).toBeCloseTo(750) // (10.000 - 5.000) * 15%
    expect(r.prejuizoAcumulado.fii).toBeCloseTo(500)
    expect(r.prejuizoAcumulado.comum).toBe(0)
  })

  it('lucro isento não abate prejuízo acumulado', () => {
    const lancs = [
      op('compra', '2026-01-05', 'VALE3', 1000, 50),
      op('venda', '2026-01-20', 'VALE3', 1000, 45), // -5.000
      op('compra', '2026-02-05', 'PETR4', 100, 30),
      op('venda', '2026-02-20', 'PETR4', 100, 40), // +1.000, vendas 4 mil: isento
    ]
    const r = apurarImpostoRenda(lancs, cat({ VALE3: 'acao', PETR4: 'acao' }))
    expect(r.meses[1].lucroIsento).toBeCloseTo(1000)
    expect(r.prejuizoAcumulado.comum).toBeCloseTo(5000)
  })

  it('day trade: 20%, e a sobra do dia segue pelo preço médio', () => {
    const lancs = [
      op('compra', '2026-03-02', 'PETR4', 100, 30), // estoque
      op('compra', '2026-03-10', 'PETR4', 100, 32),
      op('venda', '2026-03-10', 'PETR4', 150, 35),
    ]
    const r = apurarImpostoRenda(lancs, cat({ PETR4: 'acao' }))
    const m = r.meses[0]
    // day trade: 100 compradas a 32 e 100 das 150 vendidas a 35 = +300
    expect(m.resultados.daytrade).toBeCloseTo(300)
    expect(m.imposto).toBeCloseTo(60)
    // sobra: 50 vendidas a 35 contra PM 30 = +250 (swing, vendas 1.750: isento)
    expect(m.resultados.acoes).toBeCloseTo(250)
    expect(m.lucroIsento).toBeCloseTo(250)
  })

  it('DARF abaixo de R$ 10 soma ao mês seguinte', () => {
    const lancs = [
      op('compra', '2026-01-05', 'MXRF11', 100, 10),
      op('venda', '2026-01-20', 'MXRF11', 100, 10.2), // +20 -> 4,00
      op('compra', '2026-02-05', 'HGLG11', 100, 10),
      op('venda', '2026-02-20', 'HGLG11', 100, 11), // +100 -> 20,00
    ]
    const r = apurarImpostoRenda(lancs, cat({ MXRF11: 'fii', HGLG11: 'fii' }))
    expect(r.meses[0].darf).toBeNull()
    expect(r.meses[0].represado).toBeCloseTo(4)
    expect(r.meses[1].darf).toBeCloseTo(24)
    expect(r.meses[1].represado).toBe(0)
  })

  it('avisa venda sem saldo e ativo sem categoria', () => {
    const r = apurarImpostoRenda(
      [op('venda', '2026-01-20', 'PETR4', 100, 40), op('venda', '2026-01-21', 'XPTO11', 10, 10)],
      cat({ PETR4: 'acao' }),
    )
    expect(r.historicoIncompleto).toEqual([{ ativo: 'PETR4', mes: '2026-01' }])
    expect(r.semCategoria).toEqual(['XPTO11'])
  })
})

describe('apuracaoParaCsv', () => {
  it('gera o CSV do ano com vírgula decimal', () => {
    const r = apurarImpostoRenda(
      [op('compra', '2026-01-10', 'VALE3', 1000, 50), op('venda', '2026-02-10', 'VALE3', 1000, 60)],
      cat({ VALE3: 'acao' }),
    )
    const linhas = apuracaoParaCsv(r.meses, '2026').trim().split('\r\n')
    expect(linhas).toHaveLength(2)
    expect(linhas[1]).toBe('2026-02;60000,00;não;0,00;10000,00;0,00;0,00;0,00;0,00;0,00;1500,00;1500,00;2026-03-31')
    expect(apuracaoParaCsv(r.meses, '2025').trim().split('\r\n')).toHaveLength(1)
  })
})

describe('categoriaIR', () => {
  it('mapeia a classe da carteira', () => {
    expect(categoriaIR('MXRF11', 'fiis', CATALOGO_VAZIO)).toBe('fii')
    expect(categoriaIR('AAPL34', 'bdrs', CATALOGO_VAZIO)).toBe('bdr')
    expect(categoriaIR('PETR4', 'acoesETFs', CATALOGO_VAZIO)).toBe('acao')
    expect(categoriaIR('Tesouro Selic 2029', 'tesouroSelic', CATALOGO_VAZIO)).toBeNull()
    expect(categoriaIR('XPTO11', null, CATALOGO_VAZIO)).toBeNull()
  })
  it('ticker de ETF no catálogo vira etf', () => {
    const cat = { ...CATALOGO_VAZIO, etfs: new Map([['BOVA11', { nome: 'Ibovespa', categoria: 'Bolsa brasileira' }]]) }
    expect(categoriaIR('BOVA11', 'acoesETFs', cat)).toBe('etf')
  })
})
