import { describe, expect, it } from 'vitest'
import {
  adicionarLancamento,
  desfazerProventosEmPares,
  corrigirLancamento,
  excluirLancamento,
  type Livro,
  ehTickerDeBolsa,
  somarDiasUteis,
  derivarPosicoes,
  mesclarLancamentos,
  validarLancamento,
  type Lancamento,
  type LancamentoNovo,
} from './lancamentos'

const L = (o: Partial<LancamentoNovo>): LancamentoNovo => ({
  data: '2026-01-10', tipo: 'compra', ativo: 'VALE3', quantidade: 10, preco: 10, valor: 100, taxas: 0, origem: 'manual', ...o,
})
const comId = (ls: LancamentoNovo[]): Lancamento[] => mesclarLancamentos([], ls).lancamentos

describe('derivarPosicoes', () => {
  it('preço médio ponderado de duas compras, com taxas no custo', () => {
    const { posicoes } = derivarPosicoes(comId([L({}), L({ data: '2026-02-10', quantidade: 30, preco: 14, valor: 420, taxas: 2 })]))
    expect(posicoes[0].quantidade).toBe(40)
    expect(posicoes[0].custoTotal).toBeCloseTo(522, 8)
    expect(posicoes[0].precoMedio).toBeCloseTo(13.05, 8)
  })
  it('venda realiza resultado sobre o preço médio e mantém o preço médio da sobra', () => {
    const { posicoes } = derivarPosicoes(
      comId([L({ quantidade: 10, valor: 100 }), L({ data: '2026-03-01', tipo: 'venda', quantidade: 4, preco: 15, valor: 60, taxas: 1 })]),
    )
    expect(posicoes[0].quantidade).toBe(6)
    expect(posicoes[0].precoMedio).toBeCloseTo(10, 8)
    expect(posicoes[0].resultadoRealizado).toBeCloseTo(60 - 1 - 40, 8)
  })
  it('vender tudo zera custo e preço médio', () => {
    const { posicoes } = derivarPosicoes(comId([L({}), L({ data: '2026-03-01', tipo: 'venda', quantidade: 10, preco: 12, valor: 120 })]))
    expect(posicoes[0]).toMatchObject({ quantidade: 0, custoTotal: 0, precoMedio: 0 })
  })
  it('venda maior que o saldo: avisa (histórico incompleto) e não deixa quantidade negativa', () => {
    const { posicoes, avisos } = derivarPosicoes(comId([L({ quantidade: 5, valor: 50 }), L({ data: '2026-03-01', tipo: 'venda', quantidade: 8, preco: 12, valor: 96 })]))
    expect(avisos).toEqual([{ ativo: 'VALE3', data: '2026-03-01', tipo: 'vendaSemSaldo', faltou: 3 }])
    expect(posicoes[0].quantidade).toBe(0)
    expect(posicoes[0].resultadoRealizado).toBeCloseTo(96 * (5 / 8) - 50, 8)
  })
  it('na mesma data, a compra vale antes da venda mesmo listada depois', () => {
    const { avisos } = derivarPosicoes(
      comId([L({ data: '2026-03-01', tipo: 'venda', quantidade: 10, preco: 12, valor: 120 }), L({ data: '2026-03-01' })]),
    )
    expect(avisos).toEqual([])
  })
  it('desdobramento e grupamento mudam a quantidade sem mudar o custo total', () => {
    const base = L({ quantidade: 10, valor: 100 })
    const split = derivarPosicoes(comId([base, L({ data: '2026-02-01', tipo: 'ajusteQuantidade', quantidade: 10, preco: 0, valor: 0 })])).posicoes[0]
    expect(split.quantidade).toBe(20)
    expect(split.precoMedio).toBeCloseTo(5, 8)
    const grup = derivarPosicoes(comId([base, L({ data: '2026-02-01', tipo: 'ajusteQuantidade', quantidade: -9, preco: 0, valor: 0 })])).posicoes[0]
    expect(grup.quantidade).toBe(1)
    expect(grup.precoMedio).toBeCloseTo(100, 8)
  })
  it('bonificação soma custo; provento soma só em proventos', () => {
    const p = derivarPosicoes(
      comId([L({}), L({ data: '2026-02-01', tipo: 'bonificacao', quantidade: 1, preco: 10, valor: 10 }), L({ data: '2026-02-02', tipo: 'provento', quantidade: 10, preco: 0, valor: 7, subtipo: 'dividendo' })]),
    ).posicoes[0]
    expect(p.quantidade).toBe(11)
    expect(p.custoTotal).toBeCloseTo(110, 8)
    expect(p.proventos).toBe(7)
  })
})

describe('mesclarLancamentos', () => {
  it('duas compras idênticas no mesmo dia valem as duas', () => {
    const r = mesclarLancamentos([], [L({}), L({})])
    expect(r.adicionados).toBe(2)
    expect(new Set(r.lancamentos.map((l) => l.id)).size).toBe(2)
  })
  it('reimportar não duplica; período sobreposto só acrescenta o novo', () => {
    const a = mesclarLancamentos([], [L({}), L({}), L({ data: '2026-02-01' })])
    const b = mesclarLancamentos(a.lancamentos, [L({}), L({}), L({ data: '2026-02-01' }), L({ data: '2026-03-01' })])
    expect(b.adicionados).toBe(1)
    expect(b.repetidos).toBe(3)
    expect(b.lancamentos).toHaveLength(4)
  })
  it('se o arquivo traz uma ocorrência a mais do que já existe, acrescenta só a diferença', () => {
    const a = mesclarLancamentos([], [L({})])
    const b = mesclarLancamentos(a.lancamentos, [L({}), L({})])
    expect(b.adicionados).toBe(1)
  })
  it('devolve ordenado por data', () => {
    const r = mesclarLancamentos([], [L({ data: '2026-03-01' }), L({ data: '2026-01-01' })])
    expect(r.lancamentos.map((l) => l.data)).toEqual(['2026-01-01', '2026-03-01'])
  })
})

describe('validarLancamento', () => {
  it('aceita lançamentos coerentes', () => {
    expect(validarLancamento(L({}))).toBeNull()
    expect(validarLancamento(L({ tipo: 'provento', quantidade: 0, preco: 0, valor: 5 }))).toBeNull()
    expect(validarLancamento(L({ tipo: 'ajusteQuantidade', quantidade: -3, preco: 0, valor: 0 }))).toBeNull()
  })
  it.each([
    [{ data: '05/03/2026' }, 'data'],
    [{ ativo: '  ' }, 'ativo'],
    [{ quantidade: 0 }, 'quantidade'],
    [{ preco: 0 }, 'preco'],
    [{ tipo: 'provento' as const, valor: 0 }, 'valor'],
  ])('rejeita %j', (parcial, campo) => {
    expect(validarLancamento(L(parcial))?.campo).toBe(campo)
  })
})

describe('somarDiasUteis e ehTickerDeBolsa', () => {
  it('pula fins de semana, para trás e para frente', () => {
    expect(somarDiasUteis('2026-09-02', -2)).toBe('2026-08-31') // quarta -> segunda
    expect(somarDiasUteis('2026-09-01', -2)).toBe('2026-08-28') // terça -> sexta
    expect(somarDiasUteis('2026-08-28', 2)).toBe('2026-09-01') // sexta -> terça
    expect(somarDiasUteis('2026-09-02', 0)).toBe('2026-09-02')
  })
  it('reconhece ticker de bolsa e não confunde com Tesouro', () => {
    expect(ehTickerDeBolsa('MXRF11')).toBe(true)
    expect(ehTickerDeBolsa('PETR4')).toBe(true)
    expect(ehTickerDeBolsa('TESOURO SELIC 2031')).toBe(false)
    expect(ehTickerDeBolsa('PETRC300')).toBe(false)
  })
})

describe('conciliação Movimentação x Negociação', () => {
  // Negociação em 31/08 (seg); a mesma compra liquida na Movimentação em 02/09 (qua).
  const neg = (o: Partial<LancamentoNovo>) => L({ origem: 'b3-negociacao', data: '2026-08-31', ...o })
  const mov = (o: Partial<LancamentoNovo>) => L({ origem: 'b3-movimentacao', data: '2026-09-02', ...o })

  it('a mesma compra nos dois extratos conta uma vez só, em qualquer ordem', () => {
    const a = mesclarLancamentos(mesclarLancamentos([], [neg({})]).lancamentos, [mov({})])
    const b = mesclarLancamentos(mesclarLancamentos([], [mov({})]).lancamentos, [neg({})])
    expect(a.lancamentos.map((l) => l.origem)).toEqual(['b3-negociacao'])
    expect(b.lancamentos.map((l) => l.origem)).toEqual(['b3-negociacao'])
    expect(a.cobertos).toBe(1) // veio depois e já estava coberto
    expect(b.substituidos).toBe(1) // já estava no livro e foi trocado pela Negociação
    expect(derivarPosicoes(a.lancamentos).posicoes[0].quantidade).toBe(10)
  })
  it('a Negociação manda na data: fica a data do negócio, não a da liquidação', () => {
    const r = mesclarLancamentos(mesclarLancamentos([], [mov({})]).lancamentos, [neg({})])
    expect(r.lancamentos[0].data).toBe('2026-08-31')
  })
  it('liquidação cujo negócio é ANTERIOR ao período da Negociação fica (única fonte)', () => {
    // liquida 01/09 (terça) -> negócio 28/08 (sexta), antes da janela que começa em 31/08
    const r = mesclarLancamentos([], [neg({}), mov({ data: '2026-09-01', ativo: 'RBRX11' })])
    expect(r.lancamentos.map((l) => l.ativo).sort()).toEqual(['RBRX11', 'VALE3'])
    expect(r.cobertos).toBe(0)
  })
  it('Tesouro e renda fixa nunca são descartados, mesmo dentro do período', () => {
    const r = mesclarLancamentos([], [neg({}), mov({ ativo: 'TESOURO SELIC 2031', quantidade: 0.08, preco: 19718.79, valor: 1577.5 })])
    expect(r.lancamentos.some((l) => l.ativo === 'TESOURO SELIC 2031')).toBe(true)
  })
  it('proventos da Movimentação não são afetados pela conciliação', () => {
    const r = mesclarLancamentos([], [neg({}), mov({ tipo: 'provento', valor: 5, quantidade: 10, preco: 0.5 })])
    expect(r.lancamentos.filter((l) => l.tipo === 'provento')).toHaveLength(1)
  })
  it('sem Negociação no livro, a Movimentação é mantida inteira', () => {
    const r = mesclarLancamentos([], [mov({}), mov({ ativo: 'BBAS3' })])
    expect(r.lancamentos).toHaveLength(2)
  })
})

describe('mesmo provento vindo de dois extratos', () => {
  it('não duplica quando só o preço unitário (arredondado) difere', () => {
    const base = { tipo: 'provento' as const, ativo: 'BBDC3', data: '2026-09-15', quantidade: 200, valor: 52.04, subtipo: 'jcp' as const }
    const daMov = L({ ...base, preco: 0.315, origem: 'b3-movimentacao' })
    const dosRecebidos = L({ ...base, preco: 0.32, origem: 'b3-proventos' })
    const r = mesclarLancamentos(mesclarLancamentos([], [daMov]).lancamentos, [dosRecebidos])
    expect(r.adicionados).toBe(0)
    expect(r.repetidos).toBe(1)
    expect(r.lancamentos).toHaveLength(1)
  })
  it('dois proventos diferentes no mesmo dia (valores distintos) continuam sendo dois', () => {
    const base = { tipo: 'provento' as const, ativo: 'BBDC3', data: '2026-09-15', quantidade: 200, subtipo: 'jcp' as const, preco: 0.3 }
    const r = mesclarLancamentos([], [L({ ...base, valor: 50 }), L({ ...base, valor: 60 })])
    expect(r.lancamentos).toHaveLength(2)
  })
})

describe('editar, excluir e lançar manualmente', () => {
  const importado = (o: Partial<LancamentoNovo> = {}) => L({ origem: 'b3-negociacao', ...o })
  const livroCom = (ls: LancamentoNovo[]): Livro => ({ lancamentos: mesclarLancamentos([], ls).lancamentos, excluidas: [] })

  it('excluir um lançamento importado: reimportar o extrato NÃO o traz de volta', () => {
    const livro = livroCom([importado(), importado({ ativo: 'BBAS3' })])
    const apagado = excluirLancamento(livro, livro.lancamentos[0].id)
    expect(apagado.lancamentos).toHaveLength(1)
    expect(apagado.excluidas).toHaveLength(1)
    const re = mesclarLancamentos(apagado.lancamentos, [importado(), importado({ ativo: 'BBAS3' })], apagado.excluidas)
    expect(re.adicionados).toBe(0)
    expect(re.lancamentos).toHaveLength(1)
  })
  it('de duas compras idênticas importadas, excluir uma e reimportar não recria nem duplica', () => {
    const livro = livroCom([importado(), importado()])
    const um = excluirLancamento(livro, livro.lancamentos[0].id)
    const re = mesclarLancamentos(um.lancamentos, [importado(), importado()], um.excluidas)
    expect(re.adicionados).toBe(0)
    expect(re.lancamentos).toHaveLength(1)
  })
  it('um terceiro negócio idêntico, que o extrato passou a trazer, entra normalmente', () => {
    const livro = livroCom([importado(), importado()])
    const um = excluirLancamento(livro, livro.lancamentos[0].id)
    const re = mesclarLancamentos(um.lancamentos, [importado(), importado(), importado()], um.excluidas)
    expect(re.adicionados).toBe(1)
    expect(new Set(re.lancamentos.map((l) => l.id)).size).toBe(re.lancamentos.length)
  })
  it('excluir um lançamento manual não deixa rastro; id inexistente não faz nada', () => {
    const m = adicionarLancamento({ lancamentos: [], excluidas: [] }, L({}))
    const r = excluirLancamento(m.livro, m.livro.lancamentos[0].id)
    expect(r.lancamentos).toEqual([])
    expect(r.excluidas).toEqual([])
    expect(excluirLancamento(m.livro, 'nao-existe')).toBe(m.livro)
  })

  it('corrigir: o original sai, a versão corrigida entra como manual e a reimportação não traz o errado de volta', () => {
    const livro = livroCom([importado({ preco: 99, valor: 990 })])
    const { livro: novo, problema } = corrigirLancamento(livro, livro.lancamentos[0].id, { preco: 10, valor: 100 })
    expect(problema).toBeNull()
    expect(novo.lancamentos).toHaveLength(1)
    expect(novo.lancamentos[0]).toMatchObject({ preco: 10, valor: 100, origem: 'manual' })
    const re = mesclarLancamentos(novo.lancamentos, [importado({ preco: 99, valor: 990 })], novo.excluidas)
    expect(re.adicionados).toBe(0)
    expect(re.lancamentos).toHaveLength(1)
  })
  it('correção inválida devolve o problema e não altera o livro', () => {
    const livro = livroCom([importado()])
    const r = corrigirLancamento(livro, livro.lancamentos[0].id, { quantidade: 0 })
    expect(r.problema?.campo).toBe('quantidade')
    expect(r.livro).toBe(livro)
  })
  it('lançamento manual: duas compras iguais entram as duas (digitar não é reimportar)', () => {
    let livro: Livro = { lancamentos: [], excluidas: [] }
    livro = adicionarLancamento(livro, L({})).livro
    livro = adicionarLancamento(livro, L({})).livro
    expect(livro.lancamentos).toHaveLength(2)
    expect(new Set(livro.lancamentos.map((l) => l.id)).size).toBe(2)
    expect(derivarPosicoes(livro.lancamentos).posicoes[0].quantidade).toBe(20)
  })
  it('lançamento manual: ativo vira maiúsculo, valida e é a origem manual', () => {
    const ok = adicionarLancamento({ lancamentos: [], excluidas: [] }, L({ ativo: ' vale3 ' }))
    expect(ok.livro.lancamentos[0]).toMatchObject({ ativo: 'VALE3', origem: 'manual' })
    const ruim = adicionarLancamento({ lancamentos: [], excluidas: [] }, L({ preco: 0 }))
    expect(ruim.problema?.campo).toBe('preco')
    expect(ruim.livro.lancamentos).toEqual([])
  })
  it('lançamento manual nunca é descartado pela conciliação Movimentação x Negociação', () => {
    const base = livroCom([importado({ data: '2026-08-31' })])
    const r = adicionarLancamento(base, L({ data: '2026-09-02', origem: 'b3-movimentacao' } as Partial<LancamentoNovo>))
    const comNeg = mesclarLancamentos(r.livro.lancamentos, [importado({ data: '2026-08-31', ativo: 'BBAS3' })])
    expect(comNeg.lancamentos.filter((l) => l.origem === 'manual')).toHaveLength(1)
  })
})

describe('conciliação com a nota de negociação (nota > Negociação > Movimentação)', () => {
  const dia = '2026-09-30'
  const nota = (o: Partial<LancamentoNovo>) => L({ origem: 'b3-nota', data: dia, ativo: 'HGBS11', ...o })
  const neg = (o: Partial<LancamentoNovo>) => L({ origem: 'b3-negociacao', data: dia, ativo: 'HGBS11', ...o })
  const mov = (o: Partial<LancamentoNovo>) => L({ origem: 'b3-movimentacao', data: '2026-10-02', ativo: 'HGBS11', ...o })
  // a B3 agrega as duas execuções da nota (10 + 5) num negócio só (15)
  const duasExecucoes = [nota({ quantidade: 10, valor: 100 }), nota({ quantidade: 5, valor: 50 })]
  const agregado = neg({ quantidade: 15, valor: 150 })

  it('a nota substitui o negócio agregado da Negociação, em qualquer ordem, e fica cada execução', () => {
    const a = mesclarLancamentos(mesclarLancamentos([], [agregado]).lancamentos, duasExecucoes)
    const b = mesclarLancamentos(mesclarLancamentos([], duasExecucoes).lancamentos, [agregado])
    for (const r of [a, b]) {
      expect(r.lancamentos.map((l) => `${l.origem}:${l.quantidade}`).sort()).toEqual(['b3-nota:10', 'b3-nota:5'])
      expect(derivarPosicoes(r.lancamentos).posicoes[0].quantidade).toBe(15)
    }
    expect(a.substituidos).toBe(1)
    expect(b.cobertos).toBe(1)
  })
  it('a liquidação da Movimentação (data do negócio = liquidação − 2 dias úteis) também é coberta pela nota', () => {
    const r = mesclarLancamentos([], [...duasExecucoes, mov({ quantidade: 15, valor: 150 })])
    expect(r.lancamentos.every((l) => l.origem === 'b3-nota')).toBe(true)
    expect(r.cobertos).toBe(1)
  })
  it('a nota cobre só (data, ativo): outros ativos do mesmo dia seguem vindo da Negociação', () => {
    const r = mesclarLancamentos([], [...duasExecucoes, neg({ ativo: 'VALE3' }), neg({ data: '2026-09-29', quantidade: 3, valor: 30 })])
    expect(r.lancamentos.map((l) => `${l.origem}:${l.ativo}:${l.data}`).sort()).toEqual([
      'b3-negociacao:HGBS11:2026-09-29',
      'b3-negociacao:VALE3:2026-09-30',
      'b3-nota:HGBS11:2026-09-30',
      'b3-nota:HGBS11:2026-09-30',
    ])
  })
  it('as taxas da nota entram no custo e baixam o preço médio correto', () => {
    const r = mesclarLancamentos([], [nota({ quantidade: 10, preco: 10, valor: 100, taxas: 0.5 })])
    const p = derivarPosicoes(r.lancamentos).posicoes[0]
    expect(p.custoTotal).toBeCloseTo(100.5, 8)
    expect(p.precoMedio).toBeCloseTo(10.05, 8)
  })
  it('reimportar a mesma nota não duplica', () => {
    const a = mesclarLancamentos([], duasExecucoes)
    const b = mesclarLancamentos(a.lancamentos, duasExecucoes)
    expect(b.adicionados).toBe(0)
    expect(b.lancamentos).toHaveLength(2)
  })
})

describe('ehTickerDeBolsa: dígitos no meio do código (B3SA3, BDRs, ETFs)', () => {
  it.each(['B3SA3', 'A1MD34', 'M1RN34', 'D1IS34', 'B5P211', 'IB5M11', 'PETR4', 'MXRF11', 'KLBN11'])('%s é ticker', (t) => {
    expect(ehTickerDeBolsa(t)).toBe(true)
  })
  it.each(['PETRS300', 'MGLUT430', 'TESOURO SELIC 2031', 'LFT2029', 'IPCA2035', 'B3SA3 - B3 S.A. - BRASIL, BOLSA, BALCAO', 'ABC', '1ABC4', '', 'petr4'])('%j não é ticker', (t) => {
    expect(ehTickerDeBolsa(t)).toBe(false)
  })
  it('a Movimentação de B3SA3 é coberta pela Negociação (antes não era, por B3SA3 não parecer ticker)', () => {
    const neg = L({ ativo: 'B3SA3', origem: 'b3-negociacao', data: '2026-08-31' })
    const mov = L({ ativo: 'B3SA3', origem: 'b3-movimentacao', data: '2026-09-02' })
    const r = mesclarLancamentos(mesclarLancamentos([], [neg]).lancamentos, [mov])
    expect(r.lancamentos).toHaveLength(1)
    expect(r.cobertos).toBe(1)
  })
})

describe('o MESMO provento em dois extratos (Movimentação x Proventos recebidos), mesmo com data ou instituição diferentes', () => {
  const prov = (o: Partial<LancamentoNovo>): LancamentoNovo => ({
    data: '2026-08-14', tipo: 'provento', subtipo: 'rendimento', ativo: 'MXRF11', quantidade: 250, preco: 0.1, valor: 25, taxas: 0, instituicao: 'XP INVESTIMENTOS', origem: 'b3-movimentacao', ...o,
  })
  const mov = (o: Partial<LancamentoNovo> = {}) => prov({ origem: 'b3-movimentacao', ...o })
  const rec = (o: Partial<LancamentoNovo> = {}) => prov({ origem: 'b3-proventos', ...o })
  const ativos = (r: { lancamentos: { origem: string; data: string }[] }) => r.lancamentos.map((l) => `${l.origem}@${l.data}`)

  it('um dia de diferença na data e outra instituição: é um pagamento só, e fica o dos Proventos recebidos', () => {
    const r = mesclarLancamentos([], [mov({ data: '2026-08-15' }), rec({ data: '2026-08-14', instituicao: 'CLEAR CORRETORA', quantidade: 250.0001 })])
    expect(ativos(r)).toEqual(['b3-proventos@2026-08-14'])
  })
  it('vale em qualquer ordem de importação', () => {
    const a = mesclarLancamentos(mesclarLancamentos([], [mov({ data: '2026-08-15' })]).lancamentos, [rec()])
    const b = mesclarLancamentos(mesclarLancamentos([], [rec()]).lancamentos, [mov({ data: '2026-08-15' })])
    expect(ativos(a)).toEqual(['b3-proventos@2026-08-14'])
    expect(ativos(b)).toEqual(['b3-proventos@2026-08-14'])
    expect(a.substituidos).toBe(1) // o da Movimentação já estava guardado e foi substituído
    expect(b.cobertos).toBe(1) // o da Movimentação nem chegou a entrar
  })
  it('com mais de 4 dias de diferença, são pagamentos diferentes e ficam os dois', () => {
    const r = mesclarLancamentos([], [mov({ data: '2026-08-20' }), rec({ data: '2026-08-14' })])
    expect(r.lancamentos).toHaveLength(2)
  })
  it('valores diferentes, ou ativos diferentes: ficam os dois', () => {
    expect(mesclarLancamentos([], [mov({ valor: 25.5 }), rec()]).lancamentos).toHaveLength(2)
    expect(mesclarLancamentos([], [mov({ ativo: 'HGLG11' }), rec()]).lancamentos).toHaveLength(2)
  })
  it('só na Movimentação (sem Proventos recebidos): ela fica, é a única fonte', () => {
    expect(mesclarLancamentos([], [mov(), mov({ data: '2026-09-14' })]).lancamentos).toHaveLength(2)
  })
  it('dois pagamentos iguais da MESMA fonte nunca são fundidos (legítimos: dois lotes, duas contas)', () => {
    expect(mesclarLancamentos([], [rec(), rec({ data: '2026-08-16' })]).lancamentos).toHaveLength(2)
    expect(mesclarLancamentos([], [mov(), mov({ data: '2026-08-16' })]).lancamentos).toHaveLength(2)
  })
  it('não mexe em compras e vendas', () => {
    const c = (o: Partial<LancamentoNovo>): LancamentoNovo => ({ data: '2026-08-14', tipo: 'compra', ativo: 'VALE3', quantidade: 10, preco: 5, valor: 50, taxas: 0, origem: 'b3-movimentacao', ...o })
    expect(mesclarLancamentos([], [c({}), c({ origem: 'b3-proventos' })]).lancamentos).toHaveLength(2)
  })
  it('reimportar os mesmos arquivos não muda nada (idempotente)', () => {
    const uma = mesclarLancamentos([], [mov({ data: '2026-08-15' }), rec()])
    const duas = mesclarLancamentos(uma.lancamentos, [mov({ data: '2026-08-15' }), rec()])
    expect(duas.lancamentos).toEqual(uma.lancamentos)
  })
})

describe('desfazerProventosEmPares: transferência de custódia não é dinheiro recebido', () => {
  const p = (o: Partial<LancamentoNovo> = {}): LancamentoNovo => ({
    data: '2026-08-04', tipo: 'provento', subtipo: 'rendimento', ativo: 'FIIA11', quantidade: 100, preco: 0.1, valor: 21.16, taxas: 0, instituicao: 'XP INVESTIMENTOS', origem: 'b3-movimentacao', ...o,
  })
  const valores = (ls: LancamentoNovo[]) => ls.map((l) => `${l.data}:${l.ativo}:${l.valor}`)

  it('o mesmo provento repetido duas vezes se cancela: não sobra nenhum', () => {
    const r = desfazerProventosEmPares([p(), p()])
    expect(r.mantidos).toEqual([])
    expect(r.descartados).toHaveLength(2)
  })
  it('o pagamento verdadeiro (outra data) fica; só o par some', () => {
    const r = desfazerProventosEmPares([p(), p(), p({ data: '2026-08-07' })])
    expect(valores(r.mantidos)).toEqual(['2026-08-07:FIIA11:21.16'])
  })
  it('de três cópias sobra uma; de quatro, nenhuma', () => {
    expect(desfazerProventosEmPares([p(), p(), p()]).mantidos).toHaveLength(1)
    expect(desfazerProventosEmPares([p(), p(), p(), p()]).mantidos).toHaveLength(0)
  })
  it('a instituição e a quantidade não importam: a transferência tem a corretora de origem num lado e a de destino no outro', () => {
    const r = desfazerProventosEmPares([p({ instituicao: 'CLEAR CORRETORA' }), p({ instituicao: 'XP INVESTIMENTOS', quantidade: 100.5 })])
    expect(r.mantidos).toEqual([])
  })
  it('data, ativo, valor ou tipo de provento diferentes: não são o mesmo pagamento, ficam todos', () => {
    expect(desfazerProventosEmPares([p(), p({ data: '2026-08-05' })]).mantidos).toHaveLength(2)
    expect(desfazerProventosEmPares([p(), p({ ativo: 'FIIB11' })]).mantidos).toHaveLength(2)
    expect(desfazerProventosEmPares([p(), p({ valor: 21.17 })]).mantidos).toHaveLength(2)
    expect(desfazerProventosEmPares([p({ subtipo: 'dividendo' }), p({ subtipo: 'jcp' })]).mantidos).toHaveLength(2)
  })
  it('só vale para a Movimentação: Proventos recebidos, planilha e digitados à mão nunca são desfeitos', () => {
    for (const origem of ['b3-proventos', 'arquivo', 'manual'] as const) expect(desfazerProventosEmPares([p({ origem }), p({ origem })]).mantidos).toHaveLength(2)
  })
  it('compras e vendas idênticas e repetidas (legítimas) nunca são tocadas', () => {
    const c = (): LancamentoNovo => ({ data: '2026-08-04', tipo: 'compra', ativo: 'VALE3', quantidade: 10, preco: 5, valor: 50, taxas: 0, origem: 'b3-movimentacao' })
    expect(desfazerProventosEmPares([c(), c()]).mantidos).toHaveLength(2)
  })
  it('é idempotente: aplicar de novo não muda nada', () => {
    const uma = desfazerProventosEmPares([p(), p(), p({ data: '2026-08-07' })]).mantidos
    expect(desfazerProventosEmPares(uma).mantidos).toEqual(uma)
  })
  it('caso do agosto real: os pares somavam 2 x 542,31 e, sem eles, o mês bate com a B3 (812,99)', () => {
    // mesma estrutura do mês que originou a regra (valores e ativos inventados que reproduzem as somas)
    const unicos: [string, string, number][] = [['2026-08-31', 'AAA3', 22.4], ['2026-08-14', 'BBB11', 100], ['2026-08-13', 'CCC11', 300.5], ['2026-08-07', 'DDD11', 390.09]]
    const pares: [string, string, number][] = [['2026-08-04', 'EEE11', 21.16], ['2026-08-05', 'FFF3', 2.84], ['2026-08-10', 'GGG3', 396.65]]
    const mov = [...unicos.map(([data, ativo, valor]) => p({ data, ativo, valor })), ...pares.flatMap(([data, ativo, valor]) => [p({ data, ativo, valor }), p({ data, ativo, valor })])]
    const soma = (ls: LancamentoNovo[]) => ls.reduce((s, l) => s + l.valor, 0)
    const sujo = soma(mov)
    const limpo = soma(desfazerProventosEmPares(mov).mantidos)
    expect(sujo - limpo).toBeCloseTo(2 * (21.16 + 2.84 + 396.65), 8) // o excesso é exatamente 2 x (uma cópia de cada par)
    expect(limpo).toBeCloseTo(22.4 + 100 + 300.5 + 390.09, 8)
  })
})
