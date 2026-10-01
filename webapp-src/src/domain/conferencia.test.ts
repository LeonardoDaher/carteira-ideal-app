import { describe, expect, it } from 'vitest'
import { conferirComPosicao, criarSaldoInicial } from './conferencia'
import type { ItemPosicaoB3 } from './importacao/planilha'
import { adicionarLancamento, derivarPosicoes, mesclarLancamentos, type Livro, type LancamentoNovo } from './lancamentos'

// Posição de 30/09/2026 (quarta). Negócio feito até 28/09 (segunda) já está liquidado (D+2).
const DATA = '2026-09-30'
const L = (o: Partial<LancamentoNovo>): LancamentoNovo => ({
  data: '2026-09-01', tipo: 'compra', ativo: 'VALE3', quantidade: 100, preco: 10, valor: 1000, taxas: 0, origem: 'b3-negociacao', ...o,
})
const P = (ativo: string, quantidade: number): ItemPosicaoB3 => ({
  ativo, categoria: 'acoes', quantidade, precoFechamento: 10, valorAtualizado: quantidade * 10, valorAplicado: null,
})
const conferir = (ls: LancamentoNovo[], pos: ItemPosicaoB3[]) => conferirComPosicao(mesclarLancamentos([], ls).lancamentos, pos, DATA)
const item = (c: ReturnType<typeof conferir>, ativo: string) => c.itens.find((i) => i.ativo === ativo)!

describe('conferirComPosicao', () => {
  it('quantidade dos lançamentos igual à da Posição: confere', () => {
    const c = conferir([L({}), L({ data: '2026-09-10', tipo: 'venda', quantidade: 30, valor: 330 })], [P('VALE3', 70)])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'confere', quantidadePosicao: 70, quantidadeLancamentos: 70, faltante: 0 })
    expect(c.resumo).toEqual({ confere: 1, faltaSaldoAnterior: 0, inconsistente: 0 })
  })

  it('negócio dos últimos dias ainda não liquidou (D+2): não é erro', () => {
    // compra de 29/09 e de 30/09 não aparecem na custódia de 30/09
    const c = conferir([L({}), L({ data: '2026-09-29', quantidade: 9, valor: 90 }), L({ data: '2026-09-30', quantidade: 17, valor: 170 })], [P('VALE3', 100)])
    expect(item(c, 'VALE3').status).toBe('confere')
    expect(item(c, 'VALE3').naoLiquidado).toBe(26)
    expect(item(c, 'VALE3').explicacao).toContain('não liquidados')
  })
  it('compra de 28/09 (segunda) já liquidou em 30/09; se a Posição não a tem, é diferença real', () => {
    const c = conferir([L({}), L({ data: '2026-09-28', quantidade: 10, valor: 100 })], [P('VALE3', 100)])
    expect(item(c, 'VALE3').status).toBe('inconsistente')
  })

  it('venda sem compra no período (posse anterior): sugere saldo inicial com a quantidade que falta', () => {
    const c = conferir([L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, valor: 1000 })], [])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'faltaSaldoAnterior', faltante: 100, dataSugeridaSaldo: '2025-09-04' })
  })
  it('posse anterior que continua em custódia: a falta é a diferença para a Posição', () => {
    const c = conferir([L({ quantidade: 20, valor: 200 })], [P('VALE3', 150)])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'faltaSaldoAnterior', faltante: 130 })
  })
  it('ativo só na Posição (sem nenhum lançamento): saldo entra antes do início do livro', () => {
    const c = conferir([L({ data: '2025-09-05', ativo: 'BBAS3' })], [P('BBAS3', 100), P('B3SA3', 100)])
    expect(item(c, 'B3SA3')).toMatchObject({ status: 'faltaSaldoAnterior', faltante: 100, dataSugeridaSaldo: '2025-09-04' })
  })
  it('ativo zerado e sem pendência não vira item de problema', () => {
    const c = conferir([L({}), L({ data: '2026-09-10', tipo: 'venda', valor: 1100, preco: 11 })], [])
    expect(item(c, 'VALE3').status).toBe('confere')
  })

  it('lançamentos a mais que a custódia: inconsistente, com explicação', () => {
    const c = conferir([L({ quantidade: 115, valor: 1150 })], [P('VALE3', 100)])
    expect(item(c, 'VALE3').status).toBe('inconsistente')
    expect(item(c, 'VALE3').explicacao).toContain('15 a mais')
  })
  it('vendou-recomprou: o saldo final não explica o histórico, inconsistente', () => {
    const c = conferir(
      [L({ data: '2026-09-01', tipo: 'venda', valor: 1000 }), L({ data: '2026-09-02', quantidade: 100 })],
      [],
    )
    expect(item(c, 'VALE3').status).toBe('inconsistente')
  })
  it('lançamento posterior à data da Posição é ignorado', () => {
    const c = conferirComPosicao(mesclarLancamentos([], [L({}), L({ data: '2026-10-05', quantidade: 50, valor: 500 })]).lancamentos, [P('VALE3', 100)], DATA)
    expect(item(c, 'VALE3').status).toBe('confere')
  })
  it('funciona com quantidade fracionária (Tesouro)', () => {
    const t = (q: number): ItemPosicaoB3 => ({ ativo: 'TESOURO SELIC 2031', categoria: 'tesouro', quantidade: q, precoFechamento: null, valorAtualizado: 8000, valorAplicado: 7800 })
    const c = conferir([L({ ativo: 'TESOURO SELIC 2031', quantidade: 0.08, preco: 19718.79, valor: 1577.5 })], [t(0.4)])
    expect(item(c, 'TESOURO SELIC 2031')).toMatchObject({ status: 'faltaSaldoAnterior' })
    expect(item(c, 'TESOURO SELIC 2031').faltante).toBeCloseTo(0.32, 6)
  })
  it('ordena os problemas primeiro', () => {
    const c = conferir([L({ ativo: 'AAAA3' }), L({ ativo: 'BBBB3', quantidade: 5, valor: 50 })], [P('AAAA3', 100), P('BBBB3', 50)])
    expect(c.itens.map((i) => i.ativo)).toEqual(['BBBB3', 'AAAA3'])
  })
})

describe('criarSaldoInicial e o ciclo de correção', () => {
  it('cria o saldo inicial manual com o preço médio informado', () => {
    const c = conferir([L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, valor: 1000 })], [])
    const s = criarSaldoInicial(item(c, 'VALE3'), 8)!
    expect(s).toMatchObject({ tipo: 'saldoInicial', ativo: 'VALE3', quantidade: 100, preco: 8, valor: 800, data: '2025-09-04', origem: 'manual' })
  })
  it('não cria para quem já confere ou com preço inválido', () => {
    const c = conferir([L({})], [P('VALE3', 100)])
    expect(criarSaldoInicial(item(c, 'VALE3'), 8)).toBeNull()
    const f = conferir([L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, valor: 1000 })], [])
    expect(criarSaldoInicial(item(f, 'VALE3'), 0)).toBeNull()
    expect(criarSaldoInicial(item(f, 'VALE3'), -1)).toBeNull()
  })
  it('depois de lançar o saldo, o ativo confere, a venda tem saldo e o resultado realizado usa o preço médio informado', () => {
    let livro: Livro = { lancamentos: mesclarLancamentos([], [L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, preco: 12, valor: 1200 })]).lancamentos, excluidas: [] }
    expect(derivarPosicoes(livro.lancamentos).avisos).toHaveLength(1)
    const c1 = conferirComPosicao(livro.lancamentos, [], DATA)
    livro = adicionarLancamento(livro, criarSaldoInicial(item(c1, 'VALE3'), 8)!).livro
    const c2 = conferirComPosicao(livro.lancamentos, [], DATA)
    expect(item(c2, 'VALE3').status).toBe('confere')
    const d = derivarPosicoes(livro.lancamentos)
    expect(d.avisos).toEqual([])
    expect(d.posicoes[0].resultadoRealizado).toBeCloseTo(1200 - 800, 8)
  })
})
