// Testes do script diário de BDRs (node --test). Os dados imitam as respostas reais da brapi
// conferidas em 25/09/2026 (listagem de BDRs e AAPL34 com range=3mo).
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  dataDoPonto,
  escolherCandidatos,
  extrairNome,
  extrairProporcao,
  montarBusca,
  montarItem,
  motivoInvalido,
  precisaRevisar,
  pregoesCompletos,
  selecionar,
  setorDe,
  tipoPorCodigo,
  variacaoPeriodo,
  volumeFinanceiroDoDia,
} from './atualizar-bdrs.mjs'

const CONFIG = {
  candidatosAcoes: 3,
  candidatosEtfs: 1,
  horarioCorteFechamento: '18:30',
  excluir: { tickers: ['ROXO34', 'XPBR31'] },
  revisados: { tickers: ['AURA33'] },
  setores: { 'Electronic Technology': 'Semicondutores e hardware', 'Non-Energy Minerals': 'Mineração e metais' },
  setorPorTicker: { AURA33: 'Mineração de ouro' },
  gruposEtf: { BSLV39: 'Metais preciosos' },
  nomes: {},
}

// Trecho da listagem real (volume = quantidade de papéis)
const LISTA = [
  { stock: 'ROXO34', close: 11.79, volume: 2445703, sector: 'Finance', type: 'bdr' },
  { stock: 'NFLX34', close: 7.41, volume: 365938, sector: 'Technology Services', type: 'bdr' },
  { stock: 'XPBR31', close: 105.52, volume: 513500, sector: 'Finance', type: 'bdr' },
  { stock: 'JBSS32', close: 60.47, volume: 752922, sector: 'Consumer Non-Durables', type: 'bdr' },
  { stock: 'AURA33', close: 146.6, volume: 272597, sector: 'Non-Energy Minerals', type: 'bdr' },
  { stock: 'MUTC34', close: 938.8, volume: 63361, sector: 'Electronic Technology', type: 'bdr' },
  { stock: 'AAPL34', close: 87.94, volume: 44241, sector: 'Electronic Technology', type: 'bdr' },
  { stock: 'BURA39', close: 35.3, volume: 21802, sector: 'Miscellaneous', type: 'bdr' },
  { stock: 'BSLV39', close: 100.11, volume: 13828, sector: 'Miscellaneous', type: 'bdr' },
]

// Últimos pregões do AAPL34 (date em segundos Unix = meia-noite de Brasília)
const HISTORICO = [
  { date: 1789959600, close: 86.5, volume: 230133 }, // 21/09
  { date: 1790046000, close: 86.7, volume: 193591 }, // 22/09
  { date: 1790132400, close: 87.17, volume: 201114 }, // 23/09
  { date: 1790218800, close: 87.03, volume: 332383 }, // 24/09
  { date: 1790305200, close: 87.84, volume: 42540 }, // 25/09, pregão em andamento
]
const DURANTE_PREGAO = new Date('2026-09-25T15:45:16Z') // 12h45 em Brasília
const DEPOIS_DO_FECHAMENTO = new Date('2026-09-25T22:00:00Z') // 19h em Brasília

describe('tipoPorCodigo', () => {
  it('separa ações (31 a 35), ETFs (39) e o resto', () => {
    assert.equal(tipoPorCodigo('AAPL34'), 'acao')
    assert.equal(tipoPorCodigo('XPBR31'), 'acao')
    assert.equal(tipoPorCodigo('AURA33'), 'acao')
    assert.equal(tipoPorCodigo('BSLV39'), 'etf')
    assert.equal(tipoPorCodigo('PETR4'), null)
    assert.equal(tipoPorCodigo('ABCD36'), null)
  })
})

describe('precisaRevisar', () => {
  it('avisa só dos 31 a 33 que ninguém decidiu ainda', () => {
    assert.equal(precisaRevisar('JBSS32', ['XPBR31'], ['AURA33']), true)
    assert.equal(precisaRevisar('XPBR31', ['XPBR31'], ['AURA33']), false)
    assert.equal(precisaRevisar('AURA33', ['XPBR31'], ['AURA33']), false)
    assert.equal(precisaRevisar('AAPL34', [], []), false)
  })
})

describe('volumeFinanceiroDoDia', () => {
  it('multiplica papéis pelo fechamento', () => {
    assert.equal(Math.round(volumeFinanceiroDoDia(LISTA[5])), Math.round(63361 * 938.8))
    assert.equal(volumeFinanceiroDoDia({ close: 10, volume: 0 }), 0)
  })
})

describe('escolherCandidatos', () => {
  const r = escolherCandidatos(LISTA, CONFIG, ['AAPL34', 'ROXO34'])
  it('tira os excluídos, mesmo se obrigatórios', () => {
    assert.ok(!r.acoes.includes('ROXO34'))
    assert.ok(!r.acoes.includes('XPBR31'))
  })
  it('ordena pelo volume em reais, não em papéis', () => {
    // MUTC34 (R$ 59 mi) passa na frente do NFLX34 (R$ 2,7 mi), que tem mais papéis
    assert.ok(r.acoes.includes('MUTC34'))
    assert.ok(!r.acoes.includes('NFLX34'))
  })
  it('inclui obrigatórios fora do topo do dia', () => {
    assert.ok(r.acoes.includes('AAPL34'))
  })
  it('separa ETFs pelo mesmo critério', () => {
    assert.deepEqual(r.etfs, ['BSLV39'])
  })
  it('pede revisão do JBSS32, mas não da AURA33 já revisada', () => {
    assert.deepEqual(r.revisar, ['JBSS32'])
  })
})

describe('pregoesCompletos', () => {
  it('descarta o pregão em andamento antes do corte', () => {
    const p = pregoesCompletos(HISTORICO, DURANTE_PREGAO)
    assert.equal(p.length, 4)
    assert.equal(dataDoPonto(p[p.length - 1]), '2026-09-24')
  })
  it('mantém o pregão do dia depois do fechamento', () => {
    const p = pregoesCompletos(HISTORICO, DEPOIS_DO_FECHAMENTO)
    assert.equal(p.length, 5)
    assert.equal(dataDoPonto(p[p.length - 1]), '2026-09-25')
  })
  it('tolera histórico ausente ou com pontos inválidos', () => {
    assert.deepEqual(pregoesCompletos(undefined), [])
    assert.equal(pregoesCompletos([{ date: 1, close: null }], DEPOIS_DO_FECHAMENTO).length, 0)
  })
})

describe('variacaoPeriodo', () => {
  it('compara o primeiro e o último fechamento', () => {
    assert.equal(variacaoPeriodo([{ close: 80 }, { close: 88 }]), 10)
    assert.equal(variacaoPeriodo([{ close: 80 }]), null)
  })
})

describe('extrairProporcao e extrairNome', () => {
  const nome = 'Apple Inc. Shs Unsponsored Brazilian Depository Receipt Repr 0.05 Sh'
  it('lê quantas ações cada BDR representa', () => {
    assert.equal(extrairProporcao(nome), 0.05)
    assert.equal(extrairProporcao('GLOBAL X URANIUM ETF'), null)
  })
  it('limpa o texto técnico do recibo', () => {
    assert.equal(extrairNome(nome, 'AAPL34'), 'Apple Inc.')
    assert.equal(extrairNome('GLOBAL X URANIUM ETF', 'BURA39'), 'GLOBAL X URANIUM ETF')
    assert.equal(extrairNome('MSFT34', 'MSFT34'), 'MSFT34')
    assert.equal(extrairNome(nome, 'AAPL34', { AAPL34: 'Apple' }), 'Apple')
  })
})

describe('setorDe', () => {
  it('usa a correção manual antes da tradução', () => {
    assert.deepEqual(setorDe('AURA33', 'acao', 'Non-Energy Minerals', CONFIG), { setor: 'Mineração de ouro', semMapa: false })
    assert.deepEqual(setorDe('MUTC34', 'acao', 'Electronic Technology', CONFIG), { setor: 'Semicondutores e hardware', semMapa: false })
  })
  it('marca o que falta traduzir ou agrupar', () => {
    assert.deepEqual(setorDe('NFLX34', 'acao', 'Technology Services', CONFIG), { setor: 'Technology Services', semMapa: true })
    assert.deepEqual(setorDe('BURA39', 'etf', 'Miscellaneous', CONFIG), { setor: 'Outros', semMapa: true })
    assert.deepEqual(setorDe('BSLV39', 'etf', 'Miscellaneous', CONFIG), { setor: 'Metais preciosos', semMapa: false })
  })
})

describe('montarItem', () => {
  const resultado = {
    longName: 'Apple Inc. Shs Unsponsored Brazilian Depository Receipt Repr 0.05 Sh',
    regularMarketPrice: 87.84,
    fiftyTwoWeekLow: 63.42,
    fiftyTwoWeekHigh: 88.51,
    priceEarnings: 37.9,
    historicalDataPrice: HISTORICO,
  }
  it('usa só pregões completos para cotação, data e volume', () => {
    const { item } = montarItem('AAPL34', 'acao', resultado, LISTA[6], CONFIG, DURANTE_PREGAO)
    assert.equal(item.cotacao, 87.03)
    assert.equal(item.dataCotacao, '2026-09-24')
    const esperado = (86.5 * 230133 + 86.7 * 193591 + 87.17 * 201114 + 87.03 * 332383) / 4
    assert.equal(item.volumeMedio, Math.round(esperado))
    assert.equal(item.acoesPorBdr, 0.05)
    assert.equal(item.nome, 'Apple Inc.')
  })
  it('não publica múltiplos de avaliação (telas descritivas, D19)', () => {
    const { item } = montarItem('AAPL34', 'acao', resultado, LISTA[6], CONFIG, DEPOIS_DO_FECHAMENTO)
    assert.equal('priceEarnings' in item, false)
    assert.equal('earningsPerShare' in item, false)
  })
})

describe('motivoInvalido', () => {
  const base = { cotacao: 50, volumeMedio: 1_000_000, variacao3m: 5 }
  it('aceita dado plausível', () => assert.equal(motivoInvalido(base), null))
  it('recusa cotação, volume e variação absurdos', () => {
    assert.match(motivoInvalido({ ...base, cotacao: 0 }), /cotação/)
    assert.match(motivoInvalido({ ...base, volumeMedio: 0 }), /volume/)
    assert.match(motivoInvalido({ ...base, variacao3m: 900 }), /variação/)
  })
})

describe('selecionar', () => {
  it('respeita piso e máximo, em ordem de volume', () => {
    const itens = [
      { ticker: 'A', volumeMedio: 500_000 },
      { ticker: 'B', volumeMedio: 5_000_000 },
      { ticker: 'C', volumeMedio: 200_000 },
      { ticker: 'D', volumeMedio: 2_000_000 },
    ]
    assert.deepEqual(selecionar(itens, 2, 300_000).map((i) => i.ticker), ['B', 'D'])
    assert.deepEqual(selecionar(itens, 10, 300_000).map((i) => i.ticker), ['B', 'D', 'A'])
  })
})

describe('montarBusca', () => {
  const lista = [
    ...LISTA,
    { stock: 'GLXU39', name: 'GLOBAL X URANIUM ETF', close: 60.47, volume: 752922, sector: 'Consumer Non-Durables', type: 'bdr' },
    { stock: 'PETR4', close: 36, volume: 1000, sector: 'Energy Minerals', type: 'stock' },
    { stock: 'ZZZZ34', close: 0, volume: 0, sector: 'Finance', type: 'bdr' },
  ]
  const busca = montarBusca(lista, CONFIG, [{ ticker: 'AAPL34', nome: 'Apple Inc.' }])
  const por = (t) => busca.find((b) => b.ticker === t)
  it('traz todos os BDRs, menos os excluídos e os sem cotação', () => {
    assert.equal(por('ROXO34'), undefined)
    assert.equal(por('XPBR31'), undefined)
    assert.equal(por('PETR4'), undefined)
    assert.equal(por('ZZZZ34'), undefined)
    assert.ok(por('NFLX34'))
    assert.equal(por('BSLV39').tipo, 'etf')
  })
  it('usa o nome publicado, o da listagem ou nenhum', () => {
    assert.equal(por('AAPL34').nome, 'Apple Inc.')
    assert.equal(por('GLXU39').nome, 'GLOBAL X URANIUM ETF')
    assert.equal(por('MUTC34').nome, null)
  })
  it('traz setor traduzido e volume do dia em reais', () => {
    assert.equal(por('AURA33').setor, 'Mineração de ouro')
    assert.equal(por('BSLV39').setor, 'Metais preciosos')
    assert.equal(por('MUTC34').volumeDia, Math.round(63361 * 938.8))
  })
  it('sai em ordem alfabética de código', () => {
    const codigos = busca.map((b) => b.ticker)
    assert.deepEqual(codigos, [...codigos].sort())
  })
})
