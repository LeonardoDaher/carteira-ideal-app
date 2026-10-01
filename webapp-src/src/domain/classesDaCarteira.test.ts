import { describe, expect, it } from 'vitest'
import { agruparTesouroDireto, classificarPosicoes, ehClasseValida, valoresPorClasse } from './classesDaCarteira'
import { montarCatalogo } from './classificadorAtivo'
import type { LinhaPosicao } from './painelCarteira'

const catalogo = montarCatalogo({
  fiis: [{ ticker: 'MXRF11' }, { ticker: 'HGBS11' }],
  etfs: [
    { ticker: 'IVVB11', nome: 'iShares S&P 500', categoria: 'Bolsa exterior' },
    { ticker: 'GOLD11', nome: 'Trend Ouro', categoria: 'Ouro, dólar e commodities' },
    { ticker: 'BOVA11', nome: 'iShares Ibovespa', categoria: 'Bolsa brasileira' },
  ],
  bdrs: [{ ticker: 'AAPL34', tipo: 'acao' }, { ticker: 'BACW39', tipo: 'etf' }],
})

const linha = (ativo: string, valorAtual: number | null, categoria: LinhaPosicao['categoria'] = null, custoTotal: number | null = null): LinhaPosicao => ({
  ativo, categoria, quantidade: 10, precoMedio: null, custoTotal, valorAtual, resultado: null, resultadoPct: null, status: 'confere', aguardandoLiquidacao: false,
})

describe('classificarPosicoes', () => {
  it('a aba da Posição manda: unit com final 11 na aba Ações é ação (o classificador sozinho não saberia)', () => {
    const [a] = classificarPosicoes([linha('TAEE11', 1000, 'acoes')], catalogo, {})
    expect(a).toMatchObject({ classe: 'acoesETFs', origem: 'posicao', precisaConfirmar: false })
  })
  it('FII, ETF internacional, ouro e Tesouro pelo catálogo e pelo nome', () => {
    const r = classificarPosicoes(
      [linha('MXRF11', 500, 'fundos'), linha('IVVB11', 400, 'etf'), linha('GOLD11', 300, 'etf'), linha('TESOURO SELIC 2031', 200, 'tesouro'), linha('TESOURO PREFIXADO 2029', 100, 'tesouro')],
      catalogo,
      {},
    )
    expect(Object.fromEntries(r.map((x) => [x.ativo, x.classe]))).toEqual({
      MXRF11: 'fiis', IVVB11: 'fundosInternacionais', GOLD11: 'ouro', 'TESOURO SELIC 2031': 'tesouroSelic', 'TESOURO PREFIXADO 2029': 'tesouroPrefixado',
    })
    expect(r.every((x) => !x.precisaConfirmar)).toBe(true)
  })
  it('BDR comum é BDR; BDR de ETF (final 39) é fundo internacional, mesmo na aba BDR', () => {
    const r = classificarPosicoes([linha('AAPL34', 100, 'bdr'), linha('BACW39', 100, 'bdr')], catalogo, {})
    expect(r.find((x) => x.ativo === 'AAPL34')!.classe).toBe('bdrs')
    expect(r.find((x) => x.ativo === 'BACW39')).toMatchObject({ classe: 'fundosInternacionais', precisaConfirmar: true })
  })
  it('o que é duvidoso NÃO é chutado: ficou sem classe ou pede confirmação', () => {
    const r = classificarPosicoes([linha('XXXX11', 100, 'fundos'), linha('BOVA11', 100, 'etf'), linha('CDB BANCO X', 100, null, 100)], catalogo, {})
    const por = Object.fromEntries(r.map((x) => [x.ativo, x]))
    expect(por.XXXX11).toMatchObject({ classe: null, precisaConfirmar: true }) // terminação 11 fora das listas
    expect(por.BOVA11).toMatchObject({ classe: 'acoesETFs', precisaConfirmar: true }) // provável, mas pede conferência
    expect(por['CDB BANCO X']).toMatchObject({ classe: 'foraDaRegua', precisaConfirmar: true }) // CDB sem liquidez diária informada
  })
  it('a escolha da pessoa vence qualquer dedução', () => {
    const [a] = classificarPosicoes([linha('XXXX11', 100, 'fundos')], catalogo, { XXXX11: 'fiis' })
    expect(a).toMatchObject({ classe: 'fiis', origem: 'pessoa', precisaConfirmar: false })
    const [b] = classificarPosicoes([linha('TAEE11', 100, 'acoes')], catalogo, { TAEE11: 'fiis' })
    expect(b.classe).toBe('fiis') // até contra a aba da Posição: quem manda é a pessoa
  })
  it('usa o valor atual; sem ele, o custo; sem nenhum dos dois, o ativo não entra', () => {
    const r = classificarPosicoes([linha('MXRF11', 500, 'fundos'), linha('HGBS11', null, 'fundos', 300), linha('VALE3', null, 'acoes', null), linha('PETR4', 0, 'acoes')], catalogo, {})
    expect(r.map((x) => [x.ativo, x.valor])).toEqual([['MXRF11', 500], ['HGBS11', 300]])
  })
  it('ordena do maior para o menor valor', () => {
    const r = classificarPosicoes([linha('A', 10, 'acoes'), linha('B', 90, 'acoes'), linha('C', 50, 'acoes')], catalogo, {})
    expect(r.map((x) => x.ativo)).toEqual(['B', 'C', 'A'])
  })
})

describe('valoresPorClasse e agruparTesouroDireto', () => {
  it('soma por classe e separa os pendentes (sem classe) com o valor que ficou de fora', () => {
    const r = valoresPorClasse(classificarPosicoes([linha('MXRF11', 500, 'fundos'), linha('HGBS11', 100, 'fundos'), linha('XXXX11', 70, 'fundos')], catalogo, {}))
    expect(r.valores).toEqual({ fiis: 600 })
    expect(r.pendentes.map((p) => p.ativo)).toEqual(['XXXX11'])
    expect(r.valorPendente).toBe(70)
  })
  it('soma Selic + IPCA+ + Prefixado numa fatia só, como a tela Carteira exibe a carteira sugerida', () => {
    expect(agruparTesouroDireto({ tesouroSelic: 100, tesouroIPCA: 200, tesouroPrefixado: 50, fiis: 10 })).toEqual({ tesouroIPCA: 350, fiis: 10 })
  })
  it('sem Tesouro, devolve igual', () => {
    const v = { fiis: 10 }
    expect(agruparTesouroDireto(v)).toBe(v)
  })
  it('ehClasseValida só aceita as classes conhecidas', () => {
    expect(ehClasseValida('fiis')).toBe(true)
    expect(ehClasseValida('foraDaRegua')).toBe(true)
    expect(ehClasseValida('inventada')).toBe(false)
    expect(ehClasseValida(42)).toBe(false)
  })
})
