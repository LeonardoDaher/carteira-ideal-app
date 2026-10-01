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

  it('posse anterior ao período importado: sugere saldo inicial com a quantidade que falta', () => {
    // a pessoa tem 50 hoje, mas o histórico só mostra uma venda de 100: ela já tinha 150 antes do período
    const c = conferir([L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, valor: 1000 })], [P('VALE3', 50)])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'faltaSaldoAnterior', faltante: 150, dataSugeridaSaldo: '2025-09-04' })
  })
  it('posse anterior que continua em custódia: a falta é a diferença para a Posição', () => {
    const c = conferir([L({ quantidade: 20, valor: 200 })], [P('VALE3', 150)])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'faltaSaldoAnterior', faltante: 130 })
  })
  it('ativo só na Posição (sem nenhum lançamento): saldo entra antes do início do livro', () => {
    const c = conferir([L({ data: '2025-09-05', ativo: 'BBAS3' })], [P('BBAS3', 100), P('B3SA3', 100)])
    expect(item(c, 'B3SA3')).toMatchObject({ status: 'faltaSaldoAnterior', faltante: 100, dataSugeridaSaldo: '2025-09-04' })
  })
  it('ativo que a Posição NÃO tem (já zerado) fica de fora: nem confere, nem pendência', () => {
    const c = conferir([L({}), L({ data: '2026-09-10', tipo: 'venda', valor: 1100, preco: 11 }), L({ ativo: 'BBAS3' })], [P('BBAS3', 100)])
    expect(c.itens.map((i) => i.ativo)).toEqual(['BBAS3'])
    expect(c.foraDaPosicao.map((f) => f.ativo)).toEqual(['VALE3'])
  })
  it('se não está na Posição, é zero: mesmo com lançamentos que não fecham (vendas ou conversões fora do histórico), NÃO é inconsistência', () => {
    // o histórico mostra 300 de BRML3, mas a Posição não tem BRML3: foi vendido ou convertido. É zero e não interessa.
    const c = conferir([L({ ativo: 'BRML3', quantidade: 300, valor: 3000 }), L({ ativo: 'VALE3' })], [P('VALE3', 100)])
    expect(c.resumo).toEqual({ confere: 1, faltaSaldoAnterior: 0, inconsistente: 0 })
    expect(c.itens.map((i) => i.ativo)).toEqual(['VALE3'])
    expect(c.foraDaPosicao).toEqual([{ ativo: 'BRML3', quantidadeLancamentos: 300, naoLiquidado: 0 }])
  })
  it('compra recente (ainda não liquidada) de ativo que não está na Posição: fica em foraDaPosicao com o que está a caminho', () => {
    const c = conferir([L({ ativo: 'CMIN3', data: '2026-09-30', quantidade: 100, valor: 500, preco: 5 })], [P('VALE3', 10)])
    expect(c.foraDaPosicao).toEqual([{ ativo: 'CMIN3', quantidadeLancamentos: 0, naoLiquidado: 100 }])
  })
  it('só com ativos zerados e nenhuma Posição relevante: nenhum item e nada pendente', () => {
    const c = conferir([L({}), L({ data: '2026-09-10', tipo: 'venda', valor: 1100, preco: 11 })], [])
    expect(c.itens).toEqual([])
    expect(c.resumo).toEqual({ confere: 0, faltaSaldoAnterior: 0, inconsistente: 0 })
  })

  it('lançamentos a mais que a custódia: inconsistente, com explicação', () => {
    const c = conferir([L({ quantidade: 115, valor: 1150 })], [P('VALE3', 100)])
    expect(item(c, 'VALE3').status).toBe('inconsistente')
    expect(item(c, 'VALE3').explicacao).toContain('15 a mais')
  })
  it('vendeu e recomprou, e a Posição tem menos que isso: o saldo final não explica o histórico (inconsistente)', () => {
    const c = conferir([L({ data: '2026-09-01', tipo: 'venda', valor: 1000 }), L({ data: '2026-09-02', quantidade: 100 })], [P('VALE3', 50)])
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
    const c = conferir([L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, valor: 1000 })], [P('VALE3', 50)])
    const s = criarSaldoInicial(item(c, 'VALE3'), 8)!
    expect(s).toMatchObject({ tipo: 'saldoInicial', ativo: 'VALE3', quantidade: 150, preco: 8, valor: 1200, data: '2025-09-04', origem: 'manual' })
  })
  it('não cria para quem já confere ou com preço inválido', () => {
    const c = conferir([L({})], [P('VALE3', 100)])
    expect(criarSaldoInicial(item(c, 'VALE3'), 8)).toBeNull()
    const f = conferir([L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, valor: 1000 })], [P('VALE3', 50)])
    expect(criarSaldoInicial(item(f, 'VALE3'), 0)).toBeNull()
    expect(criarSaldoInicial(item(f, 'VALE3'), -1)).toBeNull()
  })
  it('depois de lançar o saldo, o ativo confere, a venda tem saldo e o resultado realizado usa o preço médio informado', () => {
    let livro: Livro = { lancamentos: mesclarLancamentos([], [L({ data: '2025-09-05', tipo: 'venda', quantidade: 100, preco: 12, valor: 1200 })]).lancamentos, excluidas: [] }
    const posicao = [P('VALE3', 50)]
    expect(derivarPosicoes(livro.lancamentos).avisos).toHaveLength(1)
    const c1 = conferirComPosicao(livro.lancamentos, posicao, DATA)
    livro = adicionarLancamento(livro, criarSaldoInicial(item(c1, 'VALE3'), 8)!).livro
    const c2 = conferirComPosicao(livro.lancamentos, posicao, DATA)
    expect(item(c2, 'VALE3').status).toBe('confere')
    const d = derivarPosicoes(livro.lancamentos)
    expect(d.avisos).toEqual([])
    expect(d.posicoes[0].quantidade).toBe(50)
    expect(d.posicoes[0].resultadoRealizado).toBeCloseTo(1200 - 800, 8)
  })
})

describe('o que fazer com cada pendência: excesso e saldo necessário', () => {
  it('lançamentos a mais que a Posição: informa o excesso (para dar baixa) e não há saldo faltando', () => {
    const c = conferir([L({ quantidade: 115, valor: 1150 })], [P('VALE3', 100)])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'inconsistente', excesso: 15, saldoNecessario: 0, faltante: 0 })
  })
  it('ativo que a Posição já não tem mais é zero: não gera excesso nem pendência', () => {
    const c = conferir([L({ ativo: 'BRML3', quantidade: 300, valor: 3000 })], [P('VALE3', 10)])
    expect(c.itens.map((i) => i.ativo)).toEqual(['VALE3'])
    expect(c.itens.some((i) => i.ativo === 'BRML3')).toBe(false)
  })
  it('vendas que superam o histórico e a Posição não explica: informa o saldo anterior que o histórico exige', () => {
    // vendeu 100 antes de comprar 100 e a Posição tem 50: o histórico exige ter tido 100 antes
    const c = conferir([L({ data: '2026-09-01', tipo: 'venda', valor: 1000 }), L({ data: '2026-09-02', quantidade: 100 })], [P('VALE3', 50)])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'inconsistente', saldoNecessario: 100, excesso: 0 })
  })
  it('quem confere não tem nem excesso nem saldo necessário', () => {
    const c = conferir([L({})], [P('VALE3', 100)])
    expect(item(c, 'VALE3')).toMatchObject({ status: 'confere', excesso: 0, saldoNecessario: 0 })
  })
  it('criarSaldoInicial também serve para a pendência inconsistente que exige saldo anterior', () => {
    const c = conferir([L({ data: '2026-09-01', tipo: 'venda', valor: 1000 }), L({ data: '2026-09-02', quantidade: 100 })], [P('VALE3', 50)])
    const s = criarSaldoInicial(item(c, 'VALE3'), 8)!
    expect(s).toMatchObject({ tipo: 'saldoInicial', quantidade: 100, preco: 8, valor: 800, origem: 'manual' })
  })
  it('criarSaldoInicial devolve null para o que só tem excesso (aí o caminho é a baixa)', () => {
    const c = conferir([L({ quantidade: 115, valor: 1150 })], [P('VALE3', 100)])
    expect(criarSaldoInicial(item(c, 'VALE3'), 8)).toBeNull()
  })
  it('depois de uma baixa do excesso, o ativo confere (a venda precisa estar fora do prazo de liquidação D+2)', () => {
    const livro = mesclarLancamentos([], [L({ quantidade: 115, valor: 1150 })]).lancamentos
    // baixa dentro do prazo D+2 (29/09): ainda não liquidada, a conferência não a conta
    const dentro = mesclarLancamentos(livro, [L({ data: '2026-09-29', tipo: 'venda', quantidade: 15, preco: 10, valor: 150, origem: 'manual' })]).lancamentos
    expect(conferirComPosicao(dentro, [P('VALE3', 100)], DATA).itens.find((i) => i.ativo === 'VALE3')!.status).toBe('inconsistente')
    // baixa anterior ao prazo (25/09): já conta
    const fora = mesclarLancamentos(livro, [L({ data: '2026-09-25', tipo: 'venda', quantidade: 15, preco: 10, valor: 150, origem: 'manual' })]).lancamentos
    expect(conferirComPosicao(fora, [P('VALE3', 100)], DATA).itens.find((i) => i.ativo === 'VALE3')!.status).toBe('confere')
  })
})
