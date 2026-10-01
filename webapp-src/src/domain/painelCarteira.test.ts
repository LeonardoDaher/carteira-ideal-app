import { describe, expect, it } from 'vitest'
import type { EventoFuturo, ItemPosicaoB3 } from './importacao/planilha'
import { mesclarLancamentos, type LancamentoNovo } from './lancamentos'
import { capitalAplicadoPorMes, composicaoPorCategoria, mesesAte, montarPainel, proventosPorMes, proximosProventos, variacaoPct } from './painelCarteira'

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
