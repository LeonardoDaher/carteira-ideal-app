import { describe, expect, it } from 'vitest'
import type { EventoFuturo, ItemPosicaoB3 } from './importacao/planilha'
import { mesclarLancamentos, type LancamentoNovo } from './lancamentos'
import { agruparPosicoes, capitalAplicadoPorMes, composicaoPorCategoria, mesesAte, montarPainel, proventosPorMes, proximosProventos, variacaoPct } from './painelCarteira'

const L = (o: Partial<LancamentoNovo>): LancamentoNovo => ({
  data: '2026-03-02', tipo: 'compra', ativo: 'VALE3', quantidade: 100, preco: 10, valor: 1000, taxas: 0, origem: 'b3-negociacao', ...o,
})
const livro = (...ls: LancamentoNovo[]) => mesclarLancamentos([], ls).lancamentos
const P = (ativo: string, quantidade: number, valorAtualizado: number, categoria: ItemPosicaoB3['categoria'] = 'acoes'): ItemPosicaoB3 => ({
  ativo, categoria, quantidade, precoFechamento: valorAtualizado / quantidade, valorAtualizado, valorAplicado: null,
})
const DATA_POS = '2026-09-30'

describe('montarPainel: sem Posição', () => {
  const p = montarPainel(livro(L({}), L({ ativo: 'BBAS3', quantidade: 10, preco: 20, valor: 200 })), null, null)
  it('lista as posições abertas pelo histórico, maiores primeiro, com preço médio', () => {
    expect(p.linhas.map((l) => l.ativo)).toEqual(['VALE3', 'BBAS3'])
    expect(p.linhas[0]).toMatchObject({ quantidade: 100, precoMedio: 10, custoTotal: 1000, valorAtual: null, status: 'semPosicao' })
  })
  it('só há capital aplicado: sem patrimônio e sem resultado (não há preço de mercado)', () => {
    expect(p.resumo).toEqual({ capitalAplicado: 1200, patrimonio: null, dataPosicao: null, resultado: null })
  })
  it('posição zerada some da lista', () => {
    const q = montarPainel(livro(L({}), L({ data: '2026-04-01', tipo: 'venda', valor: 1100, preco: 11 })), null, null)
    expect(q.linhas).toEqual([])
    expect(q.resumo.capitalAplicado).toBe(0)
  })
})

describe('montarPainel: com Posição da B3', () => {
  it('histórico que confere: preço médio, valor atual e resultado', () => {
    const p = montarPainel(livro(L({})), [P('VALE3', 100, 1500)], DATA_POS)
    expect(p.linhas[0]).toMatchObject({ ativo: 'VALE3', status: 'confere', precoMedio: 10, custoTotal: 1000, valorAtual: 1500, resultado: 500, resultadoPct: 50 })
    expect(p.resumo.patrimonio).toBe(1500)
    expect(p.resumo.resultado).toEqual({ valor: 500, pct: 50, cobertura: 1 })
  })
  it('histórico incompleto: mostra o valor, NÃO inventa preço médio nem resultado', () => {
    const p = montarPainel(livro(L({ quantidade: 20, valor: 200 })), [P('VALE3', 150, 1500)], DATA_POS)
    expect(p.linhas[0]).toMatchObject({ status: 'faltaSaldoAnterior', precoMedio: null, custoTotal: null, resultado: null, valorAtual: 1500 })
    expect(p.resumo.resultado).toBeNull()
  })
  it('o resultado cobre só a parte com custo conhecido, e diz qual (cobertura)', () => {
    const p = montarPainel(livro(L({})), [P('VALE3', 100, 1500), P('BBAS3', 100, 3000)], DATA_POS)
    expect(p.resumo.patrimonio).toBe(4500)
    expect(p.resumo.resultado!.valor).toBe(500) // só VALE3 tem custo
    expect(p.resumo.resultado!.cobertura).toBeCloseTo(1500 / 4500, 8)
  })
  it('negócio ainda não liquidado (D+2): mostra o preço médio, sem resultado até a custódia igualar', () => {
    const l = livro(L({}), L({ data: '2026-09-30', quantidade: 10, preco: 12, valor: 120 }))
    const p = montarPainel(l, [P('VALE3', 100, 1500)], DATA_POS)
    expect(p.linhas[0]).toMatchObject({ status: 'confere', aguardandoLiquidacao: true, resultado: null })
    expect(p.linhas[0].precoMedio).toBeCloseTo(1120 / 110, 8)
  })
  it('comprado há pouco e fora da custódia: aparece, sem valor de mercado', () => {
    const l = livro(L({}), L({ ativo: 'CMIN3', data: '2026-09-30', quantidade: 100, preco: 5, valor: 500 }))
    const p = montarPainel(l, [P('VALE3', 100, 1500)], DATA_POS)
    const novo = p.linhas.find((x) => x.ativo === 'CMIN3')!
    expect(novo).toMatchObject({ status: 'semPosicao', aguardandoLiquidacao: true, valorAtual: null, precoMedio: 5 })
    expect(p.resumo.patrimonio).toBe(1500) // não soma o que não está na custódia
  })
  it('a mesma ação em duas instituições soma na Posição', () => {
    const p = montarPainel(livro(L({ quantidade: 150, valor: 1500 })), [P('VALE3', 100, 1000), P('VALE3', 50, 500)], DATA_POS)
    expect(p.linhas).toHaveLength(1)
    expect(p.linhas[0]).toMatchObject({ quantidade: 150, valorAtual: 1500, status: 'confere' })
  })
  it('prejuízo: resultado negativo e percentual negativo', () => {
    const p = montarPainel(livro(L({})), [P('VALE3', 100, 800)], DATA_POS)
    expect(p.linhas[0]).toMatchObject({ resultado: -200, resultadoPct: -20 })
  })
})

describe('montarPainel: ativo que a Posição não tem (já zerado) não aparece em lugar nenhum', () => {
  // histórico: VALE3 (está na Posição) e BRML3/BEEF11, que a pessoa já não tem (vendidos ou convertidos fora do histórico)
  const lancs = livro(
    L({}),
    L({ ativo: 'BRML3', quantidade: 300, preco: 10, valor: 3000 }),
    L({ ativo: 'BEEF11', quantidade: 100, preco: 20, valor: 2000 }),
  )
  const p = montarPainel(lancs, [P('VALE3', 100, 1500)], DATA_POS)

  it('não entra na lista de posições', () => {
    expect(p.linhas.map((l) => l.ativo)).toEqual(['VALE3'])
    expect(p.ativosAtuais).toEqual(['VALE3'])
  })
  it('não infla o total investido: só o custo do que a pessoa tem hoje', () => {
    expect(p.resumo.capitalAplicado).toBe(1000)
    expect(p.resumo.patrimonio).toBe(1500)
  })
  it('não distorce o resultado nem a cobertura', () => {
    expect(p.resumo.resultado).toEqual({ valor: 500, pct: 50, cobertura: 1 })
  })
  it('a compra recente ainda não liquidada de um ativo fora da Posição aparece, e o ativo antigo zerado continua de fora', () => {
    const l2 = livro(L({}), L({ ativo: 'BRML3', quantidade: 300, valor: 3000 }), L({ ativo: 'CMIN3', data: '2026-09-30', quantidade: 100, preco: 5, valor: 500 }))
    const q = montarPainel(l2, [P('VALE3', 100, 1500)], DATA_POS)
    expect(q.linhas.map((l) => l.ativo).sort()).toEqual(['CMIN3', 'VALE3'])
    expect(q.linhas.find((l) => l.ativo === 'CMIN3')).toMatchObject({ aguardandoLiquidacao: true, quantidade: 100, precoMedio: 5 })
  })
  it('a série do gráfico, quando restrita aos ativos atuais, ignora o histórico dos zerados', () => {
    const todos = capitalAplicadoPorMes(lancs, '2026-10', 3)
    const soAtuais = capitalAplicadoPorMes(lancs, '2026-10', 3, new Set(p.ativosAtuais))
    expect(todos[2].valor).toBe(6000) // 1000 + 3000 + 2000, com os zerados inflando
    expect(soAtuais[2].valor).toBe(1000) // só VALE3
  })
  it('sem restrição, a série continua mostrando todo o histórico (comportamento sem Posição)', () => {
    expect(capitalAplicadoPorMes(lancs, '2026-10', 1)[0].valor).toBe(6000)
  })
})

describe('origem do preço médio: informado, valor aplicado da B3 ou calculado', () => {
  const tesouro = (aplicado: number | null): ItemPosicaoB3 => ({ ativo: 'TESOURO IPCA+ 2045', categoria: 'tesouro', quantidade: 40, precoFechamento: null, valorAtualizado: 5000, valorAplicado: aplicado })

  it('Tesouro: o custo vem do valor aplicado da B3, sem precisar de nenhum lançamento', () => {
    const p = montarPainel([], [tesouro(4000)], DATA_POS)
    expect(p.linhas[0]).toMatchObject({ origemPrecoMedio: 'b3', precoMedio: 100, custoTotal: 4000, resultado: 1000, resultadoPct: 25, status: 'confere' })
    expect(p.resumo.resultado).toEqual({ valor: 1000, pct: 25, cobertura: 1 })
  })
  it('sem valor aplicado e sem histórico, o preço médio é desconhecido (e falta o preço de compra)', () => {
    const p = montarPainel([], [tesouro(null)], DATA_POS)
    expect(p.linhas[0]).toMatchObject({ origemPrecoMedio: null, precoMedio: null, resultado: null, status: 'faltaSaldoAnterior' })
  })
  it('o preço informado pela pessoa vale mais que o calculado', () => {
    const calculado = montarPainel(livro(L({})), [P('VALE3', 100, 1500)], DATA_POS).linhas[0]
    expect(calculado).toMatchObject({ origemPrecoMedio: 'calculado', precoMedio: 10 })
    const informado = montarPainel(livro(L({})), [P('VALE3', 100, 1500)], DATA_POS, { VALE3: 12.5 }).linhas[0]
    expect(informado).toMatchObject({ origemPrecoMedio: 'informado', precoMedio: 12.5, custoTotal: 1250, resultado: 250, resultadoPct: 20 })
  })
  it('o preço informado vale mais que o valor aplicado da B3', () => {
    const l = montarPainel([], [tesouro(4000)], DATA_POS, { 'TESOURO IPCA+ 2045': 90 }).linhas[0]
    expect(l).toMatchObject({ origemPrecoMedio: 'informado', precoMedio: 90, custoTotal: 3600 })
  })
  it('informar o preço resolve o ativo com histórico incompleto: passa a ter resultado e deixa de faltar', () => {
    const lancs = livro(L({ quantidade: 20, valor: 200 }))
    const antes = montarPainel(lancs, [P('VALE3', 100, 1500)], DATA_POS).linhas[0]
    expect(antes).toMatchObject({ status: 'faltaSaldoAnterior', precoMedio: null, resultado: null })
    const depois = montarPainel(lancs, [P('VALE3', 100, 1500)], DATA_POS, { VALE3: 10 }).linhas[0]
    expect(depois).toMatchObject({ status: 'confere', precoMedio: 10, resultado: 500 })
  })
  it('informar o preço de um ativo não mexe nos outros', () => {
    const lancs = livro(L({ quantidade: 20, valor: 200 }), L({ ativo: 'BBAS3', quantidade: 20, valor: 400, preco: 20 }))
    const p = montarPainel(lancs, [P('VALE3', 100, 1500), P('BBAS3', 100, 3000)], DATA_POS, { VALE3: 10 })
    expect(p.linhas.find((l) => l.ativo === 'BBAS3')).toMatchObject({ status: 'faltaSaldoAnterior', precoMedio: null })
  })
  it('compra recente ainda não liquidada: o preço informado também dá resultado (é o custo de hoje)', () => {
    const lancs = livro(L({}), L({ data: '2026-09-30', quantidade: 10, preco: 12, valor: 120 }))
    expect(montarPainel(lancs, [P('VALE3', 100, 1500)], DATA_POS).linhas[0].resultado).toBeNull() // calculado: espera liquidar
    expect(montarPainel(lancs, [P('VALE3', 100, 1500)], DATA_POS, { VALE3: 10 }).linhas[0].resultado).toBe(500)
  })
  it('sem Posição, o preço informado também vale (e o total investido usa ele)', () => {
    const p = montarPainel(livro(L({})), null, null, { VALE3: 15 })
    expect(p.linhas[0]).toMatchObject({ origemPrecoMedio: 'informado', precoMedio: 15, custoTotal: 1500 })
    expect(p.resumo.capitalAplicado).toBe(1500)
  })
  it('o preço informado de um ativo que não está na Posição é ignorado', () => {
    const p = montarPainel(livro(L({})), [P('BBAS3', 10, 100)], DATA_POS, { VALE3: 99 })
    expect(p.linhas.map((l) => l.ativo)).toEqual(['BBAS3'])
  })
})

describe('agruparPosicoes: por tipo de ativo, como na Área do Investidor da B3', () => {
  const pos4 = [P('VALE3', 600, 600), P('BBAS3', 200, 200), P('MXRF11', 150, 150, 'fundos'), P('AAPL34', 50, 50, 'bdr')]
  const grupos = agruparPosicoes(montarPainel([], pos4, DATA_POS).linhas)

  it('um grupo por categoria, do maior para o menor valor, com quantos ativos tem', () => {
    expect(grupos.map((g) => [g.chave, g.ativos])).toEqual([['acoes', 2], ['fundos', 1], ['bdr', 1]])
    expect(grupos.map((g) => g.rotulo)).toEqual(['Ações', 'FIIs e fundos', 'BDRs'])
  })
  it('valor e fatia da carteira de cada grupo (somam 100%)', () => {
    expect(grupos.map((g) => g.valor)).toEqual([800, 150, 50])
    expect(grupos.map((g) => g.pct)).toEqual([80, 15, 5])
    expect(grupos.reduce((s, g) => s + g.pct, 0)).toBeCloseTo(100, 8)
  })
  it('dentro do grupo, os ativos saem do maior para o menor valor', () => {
    expect(grupos[0].linhas.map((l) => l.ativo)).toEqual(['VALE3', 'BBAS3'])
  })
  it('compras recentes ainda não liquidadas ficam num grupo à parte, sempre por último', () => {
    const lancs = livro(L({ ativo: 'CMIN3', data: '2026-09-30', quantidade: 100, preco: 5, valor: 500 }))
    const g = agruparPosicoes(montarPainel(lancs, [P('VALE3', 10, 100)], DATA_POS).linhas)
    expect(g.map((x) => x.chave)).toEqual(['acoes', 'recentes'])
    expect(g[1]).toMatchObject({ ativos: 1, valor: 0, pct: 0 })
  })
  it('sem posições: nenhum grupo; sem valor: fatia zero sem dividir por zero', () => {
    expect(agruparPosicoes([])).toEqual([])
    const g = agruparPosicoes(montarPainel(livro(L({})), null, null).linhas)
    expect(g.every((x) => Number.isFinite(x.pct))).toBe(true)
  })
})

describe('composicaoPorCategoria', () => {
  it('agrupa pelas categorias da B3, em ordem decrescente, somando 100%', () => {
    const c = composicaoPorCategoria([P('VALE3', 10, 600), P('HGBS11', 10, 300, 'fundos'), P('AAPL34', 10, 100, 'bdr'), P('PETR4', 10, 200)])
    expect(c.map((x) => x.rotulo)).toEqual(['Ações', 'FIIs e fundos', 'BDRs'])
    expect(c[0]).toMatchObject({ categoria: 'acoes', valor: 800, pct: (800 / 1200) * 100 })
    expect(c.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 8)
  })
  it('sem posição: vazio', () => {
    expect(composicaoPorCategoria(null)).toEqual([])
    expect(composicaoPorCategoria([])).toEqual([])
  })
})

describe('séries mensais', () => {
  it('mesesAte devolve os N meses terminando no informado, atravessando o ano', () => {
    expect(mesesAte('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(mesesAte('2026-10', 1)).toEqual(['2026-10'])
  })
  it('capital aplicado refaz o histórico mês a mês (custo do que se tinha no fim de cada mês)', () => {
    const l = livro(L({ data: '2026-07-10' }), L({ data: '2026-09-05', quantidade: 50, valor: 600, preco: 12 }), L({ data: '2026-10-02', tipo: 'venda', quantidade: 100, preco: 11, valor: 1100 }))
    const s = capitalAplicadoPorMes(l, '2026-10', 5)
    // Em out. vendeu 100 das 150 cotas pelo PREÇO MÉDIO (1.600 / 150 = 10,67): sobra 50 × 10,67 = 533,33 de custo.
    expect(s.map((p) => [p.rotulo, Math.round(p.valor * 100) / 100])).toEqual([['Jun', 0], ['Jul', 1000], ['Ago', 1000], ['Set', 1600], ['Out', 533.33]])
  })
  it('sem lançamentos antes do período: zeros, sem quebrar', () => {
    expect(capitalAplicadoPorMes([], '2026-10', 3).map((p) => p.valor)).toEqual([0, 0, 0])
  })
  it('proventos somam por mês de pagamento e ignoram o que não é provento', () => {
    const l = livro(
      L({ tipo: 'provento', data: '2026-09-10', valor: 25, quantidade: 100, preco: 0.25, subtipo: 'rendimento' }),
      L({ tipo: 'provento', data: '2026-09-25', ativo: 'BBAS3', valor: 40, quantidade: 10, preco: 4, subtipo: 'jcp' }),
      L({ tipo: 'provento', data: '2025-01-10', valor: 99, quantidade: 1, preco: 99, subtipo: 'dividendo' }), // fora da janela
      L({ data: '2026-09-03' }),
    )
    const s = proventosPorMes(l, '2026-10', 3)
    expect(s.map((p) => [p.mes, p.valor])).toEqual([['2026-08', 0], ['2026-09', 65], ['2026-10', 0]])
  })
  it('variacaoPct: null sem base, negativa quando cai', () => {
    expect(variacaoPct(110, 100)).toBeCloseTo(10, 8)
    expect(variacaoPct(50, 100)).toBeCloseTo(-50, 8)
    expect(variacaoPct(10, 0)).toBeNull()
  })
})

describe('proximosProventos', () => {
  const ev = (ativo: string, previsao: string, valorLiquido: number): EventoFuturo => ({ ativo, tipoEvento: 'jcp', previsao, quantidade: 1, precoUnitario: 1, valorLiquido })
  it('acha o próximo pagamento (da data de hoje em diante) e soma o que está a receber', () => {
    const r = proximosProventos([ev('A', '2026-09-20', 5), ev('B', '2026-10-01', 2.84), ev('C', '2026-10-01', 4.23), ev('D', '2026-11-05', 10)], '2026-10-01')!
    expect(r).toEqual({ proximaData: '2026-10-01', totalNaData: 7.07, ativosNaData: 2, totalAReceber: 17.07, ativosAReceber: 3 })
  })
  it('nada futuro ou sem eventos: null', () => {
    expect(proximosProventos([ev('A', '2026-09-20', 5)], '2026-10-01')).toBeNull()
    expect(proximosProventos(null, '2026-10-01')).toBeNull()
  })
})
