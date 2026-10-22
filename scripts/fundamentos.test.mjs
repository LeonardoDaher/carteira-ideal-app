// Testes do cálculo de fundamentos (D119). Dados da CVM simulados: nada de rede.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ajustarEventosDeAcoes, capitalDaEmpresa, guardaLinha, montarEmpresa } from './fundamentos-calculo.mjs'
import { formatarFundamentos } from './atualizar-fundamentos.mjs'

const CFG = {
  verificacoes: { pvpMinimoPlausivel: 0.05, pvpMaximoPlausivel: 100, maxFracaoSemPreco: 0.5, unidadeAutomatica: { ativa: false } },
  capital: { ajustesManuais: {} },
}
const PRECO = { ref: { ticker: 'TESTE3', fechamento: 10, data: '2026-10-20' }, classes: [{ classe: 'ON', ticker: 'TESTE3', fechamento: 10, data: '2026-10-20' }], volumeMedioEmissor: 1_000_000 }

/** Linha da CVM em R$ (a extração já multiplica pela escala). `p`: ordem, dtIni, dtFim, cons. */
function L(doc, dtRefer, dem, cd, ds, valor, p = {}) {
  const flui = dem !== 'BPA' && dem !== 'BPP'
  const ano = Number(dtRefer.slice(0, 4))
  return {
    doc, dtRefer, versao: 1, dem, cons: p.cons ?? 'con', ordem: p.ordem ?? 'ULTIMO',
    dtIni: flui ? p.dtIni ?? `${ano}-01-01` : null, dtFim: p.dtFim ?? dtRefer, cd, ds, valor, linkDoc: `http://cvm/${doc}${dtRefer}`,
  }
}

/** Demonstrações anuais completas de uma empresa industrial simples, com valores em R$ milhões × 1e6. */
function dfp(ano, v, extra = []) {
  const d = `${ano}-12-31`
  const M = 1e6
  return [
    L('DFP', d, 'DRE', '3.01', 'Receita de Venda de Bens e/ou Serviços', v.receita * M),
    L('DFP', d, 'DRE', '3.03', 'Resultado Bruto', v.bruto * M),
    L('DFP', d, 'DRE', '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', v.ebit * M),
    L('DFP', d, 'DRE', '3.06.02', 'Despesas Financeiras', -v.desp * M),
    L('DFP', d, 'DRE', '3.11', 'Lucro/Prejuízo Consolidado do Período', v.lucro * M),
    L('DFP', d, 'DRE', '3.11.01', 'Atribuído a Sócios da Empresa Controladora', v.lucro * M),
    L('DFP', d, 'DFC', '6.01', 'Caixa Líquido Atividades Operacionais', v.fco * M),
    L('DFP', d, 'DFC', '6.02.01', 'Aquisição de Imobilizado', -v.capex * M),
    L('DFP', d, 'DFC', '6.02.02', 'Aquisição de Participação em Controlada', -500 * M),
    L('DFP', d, 'DFC', '6.03.01', 'Dividendos e JCP Pagos', -v.div * M),
    L('DFP', d, 'DVA', '7.04.01', 'Depreciação, Amortização e Exaustão', -v.dep * M),
    L('DFP', d, 'BPA', '1', 'Ativo Total', v.ativo * M),
    L('DFP', d, 'BPA', '1.01', 'Ativo Circulante', v.ac * M),
    L('DFP', d, 'BPA', '1.01.01', 'Caixa e Equivalentes de Caixa', v.caixa * M),
    L('DFP', d, 'BPP', '2', 'Passivo Total', v.ativo * M),
    L('DFP', d, 'BPP', '2.01', 'Passivo Circulante', v.pc * M),
    L('DFP', d, 'BPP', '2.01.04', 'Empréstimos e Financiamentos', v.dcp * M),
    L('DFP', d, 'BPP', '2.02.01', 'Empréstimos e Financiamentos', v.dlp * M),
    L('DFP', d, 'BPP', '2.03', 'Patrimônio Líquido Consolidado', v.pl * M),
    ...extra,
  ]
}

const BASE = { receita: 1000, bruto: 400, ebit: 200, desp: 40, lucro: 120, fco: 180, capex: 100, div: 60, dep: 50, ativo: 2000, ac: 600, caixa: 150, pc: 300, dcp: 100, dlp: 400, pl: 1000 }
const docs = (anos) => anos.map((a) => ({ doc: 'DFP', dtRefer: `${a}-12-31`, versao: 1, dtReceb: `${a + 1}-03-01`, linkDoc: `http://cvm/DFP${a}-12-31` }))
const capital = (dtRefer, doc = 'DFP', ord = 1_000_000_000, tes = 0) => ({ doc, dtRefer, versao: 1, ordinarias: ord, preferenciais: 0, tesouroOrd: tes, tesouroPref: 0 })

function empresaSimples(opcoes = {}) {
  const anos = [2021, 2022, 2023, 2024, 2025]
  const linhas = anos.flatMap((a, i) => dfp(a, { ...BASE, receita: BASE.receita * (1 + i * 0.1), lucro: BASE.lucro + i * 10 }))
  return {
    ticker: 'TESTE3', nome: 'Teste SA', setor: 'Indústria', financeira: false, cnpj: '00.000.000/0001-00', preco: PRECO, cfg: CFG, dataCorte: '2026-04-15',
    c: { docs: docs(anos), linhas: [...linhas, ...(opcoes.linhasExtras ?? [])], capital: anos.map((a) => capital(`${a}-12-31`)).concat(opcoes.capitalExtra ?? []) },
    ...opcoes.sobrescrever,
  }
}

describe('guardaLinha', () => {
  it('guarda as contas necessárias e as linhas variáveis do fluxo de caixa, e descarta o resto', () => {
    assert.equal(guardaLinha('DRE', '3.11'), true)
    assert.equal(guardaLinha('DFC', '6.02.03'), true)
    assert.equal(guardaLinha('DFC', '6.03.05'), true)
    assert.equal(guardaLinha('BPP', '2.08'), true) // patrimônio líquido de banco
    assert.equal(guardaLinha('BPP', '2.01.04.01.02'), false)
    assert.equal(guardaLinha('DRE', '3.04.02.01'), false)
  })
})

describe('montarEmpresa: exercícios', () => {
  it('lê os cinco exercícios em R$ mil, com EBITDA, CAPEX e dividendos', () => {
    const { empresa, erro } = montarEmpresa(empresaSimples())
    assert.equal(erro, undefined)
    assert.equal(empresa.anual.length, 5)
    const u = empresa.anual.at(-1)
    assert.equal(u.exercicio, '2025-12-31')
    assert.equal(u.receita, 1_400_000)
    assert.equal(u.ebit, 200_000)
    assert.equal(u.ebitda, 250_000) // EBIT + |depreciação (DVA, negativa)|
    assert.equal(u.despesaFinanceira, 40_000)
    assert.equal(u.fco, 180_000)
    assert.equal(u.capex, 100_000) // a aquisição de participação em controlada não é CAPEX
    assert.equal(u.dividendosPagos, 60_000)
    assert.equal(u.divida, 500_000)
    assert.equal(u.caixa, 150_000)
    assert.equal(u.patrimonioLiquido, 1_000_000)
    assert.equal(empresa.ttm.documento, 'DFP de 2025-12-31')
  })

  it('sem linha de CAPEX ou de dividendos, o campo é null e não zero', () => {
    const e = empresaSimples()
    e.c.linhas = e.c.linhas.filter((l) => !/^6\.0[23]/.test(l.cd))
    const { empresa } = montarEmpresa(e)
    assert.equal(empresa.anual.at(-1).capex, null)
    assert.equal(empresa.anual.at(-1).dividendosPagos, null)
  })

  it('exercício reapresentado: vale a coluna PENÚLTIMO da DFP seguinte, e o alerta registra o ano', () => {
    const e = empresaSimples()
    // A DFP de 2023 apresenta 2022 com lucro de 300 (era 130), bem diferente do original.
    e.c.linhas.push(L('DFP', '2023-12-31', 'DRE', '3.11', 'Lucro/Prejuízo Consolidado do Período', 300e6, { ordem: 'PENULTIMO', dtIni: '2022-01-01', dtFim: '2022-12-31' }))
    const { empresa } = montarEmpresa(e)
    const a2022 = empresa.anual.find((x) => x.exercicio === '2022-12-31')
    assert.equal(a2022.lucroLiquido, 300_000)
    assert.ok(empresa.alertas.some((a) => a.startsWith('reapresentado:') && a.includes('2022')))
  })

  it('buraco na série de DFP corta a cadeia em vez de pular exercício', () => {
    const e = empresaSimples()
    e.c.docs = e.c.docs.filter((d) => d.dtRefer !== '2023-12-31')
    const { empresa } = montarEmpresa(e)
    assert.deepEqual(empresa.anual.map((a) => a.exercicio), ['2024-12-31', '2025-12-31'])
    assert.ok(empresa.alertas.includes('exercicios_disponiveis:2'))
  })
})

describe('montarEmpresa: 12 meses (TTM)', () => {
  it('com ITR mais recente, soma o exercício anterior ao acumulado do ano e subtrai o do ano anterior', () => {
    const e = empresaSimples()
    e.c.docs.push({ doc: 'ITR', dtRefer: '2026-06-30', versao: 1, dtReceb: '2026-08-10', linkDoc: 'http://cvm/ITR' })
    const itr = (dem, cd, ds, ate26, ate25, p = {}) => [
      L('ITR', '2026-06-30', dem, cd, ds, ate26, { dtIni: '2026-01-01', dtFim: '2026-06-30', ...p }),
      L('ITR', '2026-06-30', dem, cd, ds, ate25, { ordem: 'PENULTIMO', dtIni: '2025-01-01', dtFim: '2025-06-30', ...p }),
    ]
    const M = 1e6
    e.c.linhas.push(
      ...itr('DRE', '3.01', 'Receita de Venda de Bens e/ou Serviços', 800 * M, 650 * M),
      ...itr('DRE', '3.05', 'Resultado Antes do Resultado Financeiro e dos Tributos', 120 * M, 90 * M),
      ...itr('DRE', '3.11', 'Lucro/Prejuízo Consolidado do Período', 80 * M, 50 * M),
      ...itr('DFC', '6.01', 'Caixa Líquido Atividades Operacionais', 100 * M, 70 * M),
      L('ITR', '2026-06-30', 'BPA', '1', 'Ativo Total', 2200 * M),
      L('ITR', '2026-06-30', 'BPP', '2', 'Passivo Total', 2200 * M),
      L('ITR', '2026-06-30', 'BPP', '2.03', 'Patrimônio Líquido Consolidado', 1100 * M),
      L('ITR', '2026-06-30', 'BPP', '2.02.01', 'Empréstimos e Financiamentos', 300 * M),
    )
    e.c.capital.push(capital('2026-06-30', 'ITR'))
    const { empresa } = montarEmpresa({ ...e, dataCorte: '2026-10-20' })
    assert.equal(empresa.ttm.documento, 'ITR de 2026-06-30')
    assert.equal(empresa.ttm.receita, (1400 + 800 - 650) * 1000) // 1.550 mi
    assert.equal(empresa.ttm.ebit, (200 + 120 - 90) * 1000)
    assert.equal(empresa.ttm.lucroLiquido, (160 + 80 - 50) * 1000)
    assert.equal(empresa.ttm.fco, (180 + 100 - 70) * 1000)
    assert.equal(empresa.ttm.patrimonioLiquido, 1_100_000) // saldo, não fluxo
    assert.equal(empresa.ttm.divida, 300_000)
    assert.equal(empresa.ultimaDemonstracao.doc, 'ITR')
  })
})

describe('montarEmpresa: instituição financeira', () => {
  it('acha o patrimônio líquido (2.08) e o lucro pelo nome, e não publica EBIT, dívida nem caixa operacional', () => {
    const M = 1e6
    const d = '2025-12-31'
    const linhas = [
      L('DFP', d, 'DRE', '3.01', 'Receitas da Intermediação Financeira', 300 * M),
      L('DFP', d, 'DRE', '3.05', 'Resultado Antes dos Tributos sobre o Lucro', 60 * M),
      L('DFP', d, 'DRE', '3.09', 'Lucro ou Prejuízo Líquido Consolidado do Período', 45 * M),
      L('DFP', d, 'DRE', '3.09.01', 'Atribuído a Sócios da Empresa Controladora', 44 * M),
      L('DFP', d, 'DRE', '3.09.02', 'Atribuído a Sócios Não Controladores', 1 * M),
      L('DFP', d, 'DFC', '6.01', 'Caixa Líquido Atividades Operacionais', -900 * M),
      L('DFP', d, 'BPA', '1', 'Ativo Total', 3000 * M),
      L('DFP', d, 'BPP', '2', 'Passivo Total', 3000 * M),
      L('DFP', d, 'BPP', '2.03', 'Passivos Financeiros ao Custo Amortizado', 2400 * M),
      L('DFP', d, 'BPP', '2.08', 'Patrimônio Líquido Consolidado', 250 * M),
      L('DFP', d, 'BPP', '2.08.04', 'Participação dos Acionistas Não Controladores', 10 * M),
    ]
    const { empresa, erro } = montarEmpresa({
      ticker: 'BANCO4', nome: 'Banco', setor: 'Bancos', financeira: true, cnpj: '1', preco: { ...PRECO, ref: { ...PRECO.ref, ticker: 'BANCO4' }, classes: [{ classe: 'PN', ticker: 'BANCO4', fechamento: 10, data: '2026-10-20' }] },
      cfg: CFG, dataCorte: '2026-04-15',
      c: { docs: docs([2025]), linhas, capital: [{ doc: 'DFP', dtRefer: d, versao: 1, ordinarias: 0, preferenciais: 1_000_000_000, tesouroOrd: 0, tesouroPref: 0 }] },
    })
    assert.equal(erro, undefined)
    const a = empresa.anual[0]
    assert.equal(a.patrimonioLiquido, 250_000)
    assert.equal(a.minoritarios, 10_000)
    assert.equal(a.plControladores, 240_000)
    assert.equal(a.lucroLiquido, 45_000)
    assert.equal(a.lucroControladores, 44_000)
    assert.equal(a.ativoTotal, 3_000_000)
    for (const campo of ['ebit', 'ebitda', 'fco', 'capex', 'divida', 'caixa']) assert.equal(a[campo], null, campo)
  })
})

describe('montarEmpresa: exclusões', () => {
  it('sem demonstrações, sem DRE ou defasada, devolve motivo em vez de números', () => {
    assert.equal(montarEmpresa({ ...empresaSimples(), c: { docs: [], linhas: [], capital: [] } }).etapa, 'sem_demonstracao')
    assert.equal(montarEmpresa({ ...empresaSimples(), dataCorte: '2028-01-01' }).etapa, 'demonstracao_defasada')
    const e = empresaSimples()
    e.c.linhas = e.c.linhas.filter((l) => l.cd !== '3.05')
    assert.equal(montarEmpresa(e).etapa, 'sem_dre')
  })
})

describe('capitalDaEmpresa', () => {
  const base = { ticker: 'TESTE3', preco: PRECO, plControladores: 1_000_000, cfg: CFG, dataCorte: '2026-10-20' }

  it('tira as ações em tesouraria', () => {
    const k = capitalDaEmpresa({ ...base, capitais: [capital('2025-12-31', 'DFP', 1_000_000_000, 100_000_000)] })
    assert.equal(k.classes[0].quantidade, 900_000_000)
  })

  it('aplica o ajuste manual de unidade (ações informadas em milhares)', () => {
    const cfg = { ...CFG, capital: { ajustesManuais: { TESTE3: { fatorQuantidade: 1000 } } } }
    const k = capitalDaEmpresa({ ...base, cfg, plControladores: 1_000_000, capitais: [capital('2025-12-31', 'DFP', 1_000_000, 0)] })
    assert.equal(k.classes[0].quantidade, 1_000_000_000)
    assert.equal(k.ajuste, 'manual ×1000')
  })

  it('multiplica pelo desdobramento posterior à data do balanço', () => {
    const k = capitalDaEmpresa({ ...base, capitais: [capital('2026-06-30', 'ITR', 100_000_000, 0)], desdobramentos: [{ data: '2026-08-11', fator: 4 }] })
    assert.equal(k.classes[0].quantidade, 400_000_000)
    assert.equal(k.ajusteDesdobramento, 4)
  })

  it('P/VP implícito fora da faixa vira alerta, sem esconder o número', () => {
    const k = capitalDaEmpresa({ ...base, plControladores: 10, capitais: [capital('2025-12-31')] })
    assert.ok(k.alertas.includes('capital_implausivel'))
  })

  it('sem composição do capital, devolve erro', () => {
    assert.match(capitalDaEmpresa({ ...base, capitais: [] }).erro, /sem composição/)
  })
})

describe('ajustarEventosDeAcoes', () => {
  it('desfaz a bonificação de 100% (×2) nos períodos anteriores', () => {
    const { ajustadas, eventos } = ajustarEventosDeAcoes([1_000, 1_000, 1_000, 2_000, 2_000, 2_000])
    assert.deepEqual(ajustadas, [2_000, 2_000, 2_000, 2_000, 2_000, 2_000])
    assert.deepEqual(eventos, [{ de: 2, para: 3, fator: 2 }])
  })

  it('acumula eventos em momentos diferentes (×1,1 e depois ×2)', () => {
    const { ajustadas, eventos } = ajustarEventosDeAcoes([1_000, 1_100, 2_200, 2_200])
    assert.deepEqual(ajustadas, [2_200, 2_200, 2_200, 2_200])
    assert.equal(eventos.length, 2)
  })

  it('grupamento 10:1 sobe as quantidades antigas na mesma proporção inversa', () => {
    const { ajustadas } = ajustarEventosDeAcoes([10_000, 10_000, 1_000, 1_000])
    assert.deepEqual(ajustadas, [1_000, 1_000, 1_000, 1_000])
  })

  it('emissão de ações que não parece evento (+7%) é mantida como diluição', () => {
    const { ajustadas, eventos } = ajustarEventosDeAcoes([1_000, 1_070])
    assert.deepEqual(ajustadas, [1_000, 1_070])
    assert.equal(eventos.length, 0)
  })

  it('série estável não muda', () => {
    const { ajustadas, eventos } = ajustarEventosDeAcoes([5, 5, 5])
    assert.deepEqual(ajustadas, [5, 5, 5])
    assert.equal(eventos.length, 0)
  })
})

describe('formatarFundamentos', () => {
  it('uma empresa por linha e JSON válido', () => {
    const texto = formatarFundamentos({ versao: '1.0.0', geradoEm: 'x', dataCorte: '2026-10-20', fonte: 'CVM', excluidas: [], empresas: { B: { a: 1 }, A: { a: 2 } } })
    const obj = JSON.parse(texto)
    assert.deepEqual(Object.keys(obj.empresas), ['A', 'B'])
    assert.ok(texto.split('\n').some((l) => l.trim().startsWith('"A":')))
  })
})
