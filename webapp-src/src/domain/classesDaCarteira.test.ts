import { describe, expect, it } from 'vitest'
import { agruparTesouroDireto, classificarPosicoes, ehClasseValida, observacoesPorClasse, valoresPorClasse } from './classesDaCarteira'
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
  ativo, categoria, quantidade: 10, precoMedio: null, origemPrecoMedio: null, custoTotal, valorAtual, resultado: null, resultadoPct: null, status: 'confere', aguardandoLiquidacao: false,
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

describe('equivalência: tipo novo alocado na classe parecida da carteira sugerida', () => {
  const manual = (ativo: string, valor: number, tipo: string, classe: string): LinhaPosicao => ({ ...linha(ativo, valor, 'rendaFixa', valor), manual: true, tipoManual: tipo, classeManual: classe as never })

  it('CRI conta em LCI / LCA e traz a observação', () => {
    const c = classificarPosicoes([manual('CRI ALFA', 20000, 'cri', 'lciLca')], catalogo, { 'CRI ALFA': 'lciLca' })
    expect(c[0].equivalencia).toMatch(/CRI contado como LCI \/ LCA/)
    expect(valoresPorClasse(c).valores).toEqual({ lciLca: 20000 })
    expect(observacoesPorClasse(c).lciLca).toEqual([{ texto: c[0].equivalencia, ativos: [{ ativo: 'CRI ALFA', valor: 20000 }] }])
  })
  it('vários ativos com a mesma observação ficam juntos numa linha só', () => {
    const c = classificarPosicoes([manual('CRI A', 1000, 'cri', 'lciLca'), manual('CRI B', 500, 'cri', 'lciLca')], catalogo, { 'CRI A': 'lciLca', 'CRI B': 'lciLca' })
    const obs = observacoesPorClasse(c).lciLca!
    expect(obs).toHaveLength(1)
    expect(obs[0].ativos.map((a) => a.ativo)).toEqual(['CRI A', 'CRI B'])
  })
  it('se a pessoa trocar a classe sugerida pelo tipo, a escolha dela manda e a observação some', () => {
    const c = classificarPosicoes([manual('CRI ALFA', 20000, 'cri', 'lciLca')], catalogo, { 'CRI ALFA': 'tesouroIPCA' })
    expect(c[0].equivalencia).toBeUndefined()
    expect(c[0].motivo).toBe('Escolhida por você.')
    expect(valoresPorClasse(c).valores).toEqual({ tesouroIPCA: 20000 })
  })
  it('multimercado é repartido entre FIIs, Ouro, BDRs e Internacionais, sem perder nem criar dinheiro', () => {
    const c = classificarPosicoes([{ ...manual('MULTI X', 10000, 'fundo-multi', 'foraDaRegua'), categoria: 'fundosInvest' }], catalogo, { 'MULTI X': 'foraDaRegua' })
    const { valores } = valoresPorClasse(c)
    expect(valores).toEqual({ fiis: 4000, ouro: 2000, bdrs: 2000, fundosInternacionais: 2000 })
    expect(valores.foraDaRegua).toBeUndefined()
    expect(Object.values(valores).reduce((s, v) => s + (v ?? 0), 0)).toBeCloseTo(10000, 8)
    expect(Object.keys(observacoesPorClasse(c)).sort()).toEqual(['bdrs', 'fiis', 'fundosInternacionais', 'ouro'])
  })
  it('Fundo DI (Tesouro Selic) aparece na linha "Tesouro Direto" da comparação (chave tesouroIPCA)', () => {
    const c = classificarPosicoes([manual('DI X', 3000, 'fundo-di', 'tesouroSelic')], catalogo, { 'DI X': 'tesouroSelic' })
    expect(observacoesPorClasse(c).tesouroIPCA?.[0].ativos).toEqual([{ ativo: 'DI X', valor: 3000 }])
    expect(observacoesPorClasse(c).tesouroSelic).toBeUndefined()
  })
  it('previdência fica fora da régua e sem observação de equivalência', () => {
    const c = classificarPosicoes([manual('PGBL X', 8000, 'pgbl', 'foraDaRegua')], catalogo, { 'PGBL X': 'foraDaRegua' })
    expect(c[0].equivalencia).toBeUndefined()
    expect(valoresPorClasse(c).valores).toEqual({ foraDaRegua: 8000 })
  })
})
