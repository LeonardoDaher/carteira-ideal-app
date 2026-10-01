import { describe, expect, it } from 'vitest'
import { classificarAtivo, montarCatalogo, precisaConfirmar } from './classificadorAtivo'

const catalogo = montarCatalogo({
  fiis: [{ ticker: 'MXRF11' }, { ticker: 'GGRC11' }],
  etfs: [
    { ticker: 'BOVA11', nome: 'iShares Ibovespa', categoria: 'Bolsa brasileira' },
    { ticker: 'IVVB11', nome: 'iShares S&P 500', categoria: 'Bolsa exterior' },
    { ticker: 'HASH11', nome: 'Hashdex Nasdaq Crypto', categoria: 'Cripto' },
    { ticker: 'GOLD11', nome: 'Trend Ouro', categoria: 'Ouro, dólar e commodities' },
    { ticker: 'USDB11', nome: 'Trend Dólar', categoria: 'Ouro, dólar e commodities' },
    { ticker: 'IMAB11', nome: 'It Now IMA-B', categoria: 'Renda fixa' },
  ],
  bdrs: [
    { ticker: 'AAPL34', tipo: 'acao' },
    { ticker: 'BACW39', tipo: 'etf' },
  ],
})

const classe = (s: string) => classificarAtivo(s, catalogo)

describe('Tesouro pelo nome', () => {
  it.each([
    ['Tesouro Selic 2029', 'tesouroSelic'],
    ['LFT 2027', 'tesouroSelic'],
    ['Tesouro IPCA+ 2035', 'tesouroIPCA'],
    ['NTN-B Principal 2045', 'tesouroIPCA'],
    ['Tesouro Prefixado 2029', 'tesouroPrefixado'],
    ['Tesouro Prefixado com Juros Semestrais 2035', 'tesouroPrefixado'],
    ['LTN 2028', 'tesouroPrefixado'],
  ])('%s -> %s (alta)', (nome, esperado) => {
    const c = classe(nome)
    expect(c.classe).toBe(esperado)
    expect(c.confianca).toBe('alta')
    expect(precisaConfirmar(c)).toBe(false)
  })

  it('Tesouro Renda+ vira IPCA+ mas pede confirmação', () => {
    const c = classe('Tesouro Renda+ 2065')
    expect(c.classe).toBe('tesouroIPCA')
    expect(precisaConfirmar(c)).toBe(true)
  })

  it('"Tesouro Direto" sem tipo não adivinha', () => {
    const c = classe('Tesouro Direto')
    expect(c.classe).toBeNull()
    expect(c.alternativas).toContain('tesouroSelic')
  })

  it('CDB IPCA+ não é confundido com Tesouro IPCA+', () => {
    expect(classe('CDB IPCA+ 2030').classe).not.toBe('tesouroIPCA')
  })
})

describe('Renda fixa privada pelo nome', () => {
  it('LCI e LCA', () => {
    expect(classe('LCI Banco Inter').classe).toBe('lciLca')
    expect(classe('LCA 95% CDI').classe).toBe('lciLca')
  })
  it('CDB com liquidez diária é a classe da régua', () => {
    const c = classe('CDB Liquidez Diária Nubank')
    expect(c.classe).toBe('cdbLiquidez')
    expect(precisaConfirmar(c)).toBe(false)
  })
  it('CDB sem indicação vai para fora da régua, pedindo confirmação, oferecendo a classe', () => {
    const c = classe('CDB Banco Master 2027')
    expect(c.classe).toBe('foraDaRegua')
    expect(precisaConfirmar(c)).toBe(true)
    expect(c.alternativas).toContain('cdbLiquidez')
  })
  it('CRI, debênture e previdência ficam fora da régua', () => {
    for (const n of ['CRI Gafisa', 'Debênture Vale', 'PGBL Bradesco', 'Fundo Multimercado XP']) {
      expect(classe(n).classe).toBe('foraDaRegua')
    }
  })
})

describe('Ticker', () => {
  it('ações pela terminação, inclusive fracionário e com nome junto', () => {
    expect(classe('BBSE3').classe).toBe('acoesETFs')
    expect(classe('PETR4F').classe).toBe('acoesETFs')
    expect(classe('wege3 - WEG').classe).toBe('acoesETFs')
  })
  it('FII pelo catálogo', () => {
    const c = classe('mxrf11')
    expect(c.classe).toBe('fiis')
    expect(c.confianca).toBe('alta')
  })
  it('BDR de ação e BDR de ETF', () => {
    expect(classe('AAPL34').classe).toBe('bdrs')
    const e = classe('BACW39')
    expect(e.classe).toBe('fundosInternacionais')
    expect(precisaConfirmar(e)).toBe(true)
  })
  it('BDR por terminação mesmo fora do catálogo', () => {
    expect(classe('TSLA34').classe).toBe('bdrs')
    expect(classe('XXXX39').classe).toBe('fundosInternacionais')
  })
  it.each([
    ['IVVB11', 'fundosInternacionais', false],
    ['HASH11', 'cripto', false],
    ['GOLD11', 'ouro', false],
    ['BOVA11', 'acoesETFs', true],
    ['USDB11', 'foraDaRegua', true],
    ['IMAB11', 'foraDaRegua', true],
  ])('ETF %s -> %s (confirmar: %s)', (t, esperado, confirmar) => {
    const c = classe(t)
    expect(c.classe).toBe(esperado)
    expect(precisaConfirmar(c)).toBe(confirmar)
  })
  it('terminação 11 desconhecida não é adivinhada', () => {
    const c = classe('KLBN11')
    expect(c.classe).toBeNull()
    expect(c.alternativas).toEqual(expect.arrayContaining(['fiis', 'acoesETFs']))
  })
})

describe('Cripto, ouro e desconhecidos', () => {
  it('cripto pelo nome', () => {
    expect(classe('Bitcoin').classe).toBe('cripto')
    expect(classe('ETH').classe).toBe('cripto')
  })
  it('ouro pelo nome pede confirmação', () => {
    const c = classe('Ouro')
    expect(c.classe).toBe('ouro')
    expect(precisaConfirmar(c)).toBe(true)
  })
  it('vazio e desconhecido', () => {
    expect(classe('').classe).toBeNull()
    expect(classe('algo estranho').classe).toBeNull()
  })
  it('sem catálogo, ainda funciona pelo nome e pela terminação', () => {
    expect(classificarAtivo('Tesouro Selic').classe).toBe('tesouroSelic')
    expect(classificarAtivo('VALE3').classe).toBe('acoesETFs')
  })
})

describe('Ticker com dígito no meio', () => {
  it('B3SA3 é ação; A1MD34 é BDR', () => {
    expect(classe('B3SA3')).toMatchObject({ classe: 'acoesETFs', confianca: 'alta' })
    expect(classe('A1MD34')).toMatchObject({ classe: 'bdrs', confianca: 'alta' })
  })
  it('reconhece o ticker no meio de um texto com o nome do produto', () => {
    expect(classe('B3SA3 - B3 S.A. - BRASIL, BOLSA, BALCAO').classe).toBe('acoesETFs')
  })
})
