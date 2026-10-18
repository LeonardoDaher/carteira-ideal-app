// Testes do job diário de BDRs (node --test), versão com o Boletim de Preços da B3 (D24).
// Os blocos XML imitam o boletim real (BVBG.086.01) e a brapi imita as respostas conferidas
// em 25/09/2026 (listagem de BDRs e nome longo do AAPL34 com a proporção).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  FONTE,
  aplicarConsulta,
  aplicarDesdobramentos,
  aplicarListagem,
  atualizarAcompanhados,
  compactar,
  consumoDoMes,
  criarFiltroBdr,
  ehDerivativo,
  detectarSaltos,
  executar,
  extrairNome,
  extrairProporcao,
  fatorSugerido,
  filaDeConsultas,
  formatarHistorico,
  historicoVazio,
  incorporarPregao,
  metricas,
  variacaoDoDia,
  montarBusca,
  montarItem,
  motivoInvalido,
  normalizarHistorico,
  precisaRevisar,
  selecionar,
  setorDe,
  tipoPorCodigo,
  volumeMedio,
} from './atualizar-bdrs.mjs'

const RAIZ_REAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = {
  excluir: { tickers: ['ROXO34', 'XPBR31'] },
  revisados: { tickers: ['AURA33'] },
  setores: { 'Electronic Technology': 'Semicondutores e hardware', 'Non-Energy Minerals': 'Mineração e metais' },
  setorPorTicker: { AURA33: 'Mineração de ouro' },
  gruposEtf: { BSLV39: 'Metais preciosos' },
  nomes: {},
  acompanharAcoes: 2,
  acompanharEtfs: 1,
  pregoesBusca: 63,
}
const instr = (lista) => new Map(lista.map(([ticker, fechamento, volume]) => [ticker, { ticker, fechamento, minima: fechamento, maxima: fechamento, volume }]))
const serieDe = (h, t) => h.ativos[t]

describe('regras mantidas da D19', () => {
  it('separa ações (31 a 35), ETFs (39) e o resto', () => {
    assert.equal(tipoPorCodigo('AAPL34'), 'acao')
    assert.equal(tipoPorCodigo('XPBR31'), 'acao')
    assert.equal(tipoPorCodigo('BSLV39'), 'etf')
    assert.equal(tipoPorCodigo('PETR4'), null)
    assert.equal(tipoPorCodigo('BOVA11'), null)
    assert.equal(tipoPorCodigo('AAPL34F'), null)
  })
  it('pede revisão só dos 31 a 33 sem decisão', () => {
    assert.equal(precisaRevisar('JBSS32', ['ROXO34'], ['AURA33']), true)
    assert.equal(precisaRevisar('AURA33', ['ROXO34'], ['AURA33']), false)
    assert.equal(precisaRevisar('AAPL34', [], []), false)
  })
  it('lê a proporção e limpa o nome do recibo', () => {
    const nome = 'Apple Inc. Shs Unsponsored Brazilian Depository Receipt Repr 0.05 Sh'
    assert.equal(extrairProporcao(nome), 0.05)
    assert.equal(extrairProporcao('GLOBAL X URANIUM ETF'), null)
    assert.equal(extrairNome(nome, 'AAPL34'), 'Apple Inc.')
    assert.equal(extrairNome(nome, 'AAPL34', { AAPL34: 'Apple' }), 'Apple')
  })
  it('traduz o setor, com correção manual e grupo de ETF', () => {
    assert.deepEqual(setorDe('AURA33', 'acao', 'Non-Energy Minerals', CONFIG), { setor: 'Mineração de ouro', semMapa: false })
    assert.deepEqual(setorDe('AAPL34', 'acao', 'Electronic Technology', CONFIG), { setor: 'Semicondutores e hardware', semMapa: false })
    assert.deepEqual(setorDe('XXXX34', 'acao', 'Novo Setor', CONFIG), { setor: 'Novo Setor', semMapa: true })
    assert.deepEqual(setorDe('BURA39', 'etf', 'Miscellaneous', CONFIG), { setor: 'Outros', semMapa: true })
  })
  it('recusa dado implausível e seleciona por volume acima do piso', () => {
    const base = { cotacao: 50, volumeMedio: 1e6, variacao3m: 5 }
    assert.equal(motivoInvalido(base), null)
    assert.match(motivoInvalido({ ...base, cotacao: 0 }), /cotação/)
    assert.match(motivoInvalido({ ...base, volumeMedio: 0 }), /volume/)
    assert.match(motivoInvalido({ ...base, variacao3m: -95 }), /variação/)
    const itens = [
      { ticker: 'A', volumeMedio: 5e5 },
      { ticker: 'B', volumeMedio: 2e6 },
      { ticker: 'C', volumeMedio: 1e5 },
    ]
    assert.deepEqual(selecionar(itens, 5, 3e5).map((i) => i.ticker), ['B', 'A'])
  })
})

describe('filtro de BDR (correção da primeira carga, 27/09/2026)', () => {
  it('recusa futuros de juros e FRAs com vencimento em 2031 a 2035, que têm o formato de BDR', () => {
    for (const t of ['DI1F31', 'DI1F32', 'DI1N31', 'FRCF31', 'FRCV31', 'DAPK35', 'DDIF33']) {
      assert.equal(tipoPorCodigo(t), t.endsWith('39') ? 'etf' : 'acao', `${t} tem formato de BDR`)
      assert.equal(ehDerivativo(t), true, t)
    }
    for (const t of ['AAPL34', 'CHVX34', 'BKNG34', 'D1DG34', 'BSIL39']) assert.equal(ehDerivativo(t), false, t)
    assert.equal(ehDerivativo('XYZF31', { derivativos: { prefixos: ['XYZ'] } }), true)
  })
  it('com a listagem da brapi no cadastro, só passa o que está nela', () => {
    const filtro = criarFiltroBdr({ AAPL34: { setorBrapi: 'Electronic Technology' }, BSIL39: { listado: true }, ZZZZ34: { nome: 'Só consulta' } })
    assert.equal(filtro('AAPL34'), 'acao')
    assert.equal(filtro('BSIL39'), 'etf')
    assert.equal(filtro('ZZZZ34'), null)
    assert.equal(filtro('DI1F31'), null)
  })
  it('sem listagem nenhuma, vale o formato menos os derivativos', () => {
    const filtro = criarFiltroBdr({})
    assert.equal(filtro('KOCH34'), 'acao')
    assert.equal(filtro('FRCF31'), null)
  })
})

describe('incorporarPregao (séries alinhadas pela direita)', () => {
  it('acrescenta o pregão novo no fim e cria a série só com negócio', () => {
    let h = historicoVazio()
    h = incorporarPregao(h, '2026-09-24', instr([['AAPL34', 87, 1e6], ['KOCH34', null, 0]]))
    h = incorporarPregao(h, '2026-09-25', instr([['AAPL34', 88, 2e6], ['MSFT34', 40, 5e5]]))
    assert.deepEqual(h.pregoes, ['2026-09-24', '2026-09-25'])
    assert.deepEqual(serieDe(h, 'AAPL34'), [[87, 87, 87, 1e6], [88, 88, 88, 2e6]])
    assert.deepEqual(serieDe(h, 'MSFT34'), [[40, 40, 40, 5e5]]) // começa no dia 25
    assert.equal(h.ativos.KOCH34, undefined) // sem negócio, sem série
    assert.deepEqual(h.ultimoNegocio.AAPL34, ['2026-09-25', 88])
  })
  it('na carga inicial, prepende pregões antigos sem desalinhar séries curtas', () => {
    let h = historicoVazio()
    h = incorporarPregao(h, '2026-09-25', instr([['AAPL34', 88, 2e6], ['MSFT34', 40, 5e5]]))
    h = incorporarPregao(h, '2026-09-24', instr([['AAPL34', 87, 1e6]])) // MSFT34 não negociou
    h = incorporarPregao(h, '2026-09-23', instr([['AAPL34', 86, 1e6], ['MSFT34', 39, 4e5]]))
    assert.deepEqual(h.pregoes, ['2026-09-23', '2026-09-24', '2026-09-25'])
    assert.deepEqual(serieDe(h, 'AAPL34').map((v) => v?.[0] ?? null), [86, 87, 88])
    assert.deepEqual(serieDe(h, 'MSFT34').map((v) => v?.[0] ?? null), [39, null, 40])
    assert.deepEqual(h.ultimoNegocio.MSFT34, ['2026-09-25', 40]) // pregão antigo não sobrescreve
  })
  it('substitui um pregão já guardado e corta no máximo de pregões', () => {
    let h = historicoVazio()
    for (const [d, p] of [['2026-09-22', 1], ['2026-09-23', 2], ['2026-09-24', 3]]) h = incorporarPregao(h, d, instr([['AAPL34', p, 1]]), 2)
    assert.deepEqual(h.pregoes, ['2026-09-23', '2026-09-24'])
    assert.deepEqual(serieDe(h, 'AAPL34').map((v) => v[0]), [2, 3])
    h = incorporarPregao(h, '2026-09-24', instr([['AAPL34', 3.5, 1]]), 2)
    assert.deepEqual(serieDe(h, 'AAPL34').map((v) => v[0]), [2, 3.5])
  })
})

describe('desdobramentos', () => {
  const datas = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24']
  const serie = [[100, 99, 101, 1e6], null, [102, 100, 103, 1e6], [10.3, 10, 10.5, 1e6]]
  it('detecta o salto de preço pulando dias sem negócio e sugere o fator', () => {
    const saltos = detectarSaltos(serie, datas)
    assert.equal(saltos.length, 1)
    assert.equal(saltos[0].data, '2026-09-24')
    assert.equal(saltos[0].fator, 10)
    assert.equal(saltos[0].indiceDaDireita, 0)
    assert.equal(fatorSugerido(10, 100), 0.1) // grupamento 10 para 1
    assert.deepEqual(detectarSaltos([[100, 1, 1, 1], [70, 1, 1, 1]], datas.slice(0, 2)), []) // queda de 30%: não é salto
  })
  it('ajusta os preços anteriores à data pelo fator, sem mexer no volume', () => {
    const ajustada = aplicarDesdobramentos(serie, datas, [{ data: '2026-09-24', fator: 10 }])
    assert.deepEqual(ajustada[0], [10, 9.9, 10.1, 1e6])
    assert.equal(ajustada[3], serie[3])
    assert.deepEqual(detectarSaltos(ajustada, datas), [])
  })
})

describe('metricas', () => {
  const montar = (n, preco = (i) => 100 + i, volume = () => 1e6) => {
    const h = historicoVazio()
    h.pregoes = Array.from({ length: n }, (_, i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`)
    h.ativos.AAPL34 = Array.from({ length: n }, (_, i) => [preco(i), preco(i) - 1, preco(i) + 1, volume(i)])
    return h
  }
  it('calcula volume médio de 21 pregões, variação de 3 meses e faixa de 52 semanas', () => {
    const h = montar(260)
    const m = metricas(h, 'AAPL34')
    assert.equal(m.cotacao, 359)
    assert.equal(m.volumeMedio, 1e6)
    assert.equal(m.variacao3m, Math.round((359 / 296 - 1) * 1000) / 10) // base: 63 pregões antes do último
    assert.equal(m.minima52, 107) // janela dos 252 últimos: preço 108 - 1
    assert.equal(m.maxima52, 360)
  })
  it('dia sem negócio conta como volume zero; série curta não tem variação nem faixa', () => {
    const h = montar(30, () => 50, (i) => (i % 2 ? 2e6 : 0))
    assert.equal(volumeMedio(h.ativos.AAPL34, 30), Math.round((11 * 2e6) / 21)) // 11 dias com negócio entre os 21 últimos
    assert.ok(true)
    const m = metricas(h, 'AAPL34')
    assert.equal(m.variacao3m, null)
    assert.equal(m.minima52, null)
  })
  it('salto não confirmado apaga variação e faixa; confirmado, volta com o preço ajustado', () => {
    const h = montar(260, (i) => (i < 250 ? 200 : 20))
    const semConfirmar = metricas(h, 'AAPL34')
    assert.equal(semConfirmar.saltos.length, 1)
    assert.equal(semConfirmar.variacao3m, null)
    assert.equal(semConfirmar.minima52, null)
    const config = { desdobramentos: { AAPL34: [{ data: h.pregoes[250], fator: 10 }] } }
    const confirmado = metricas(h, 'AAPL34', config)
    assert.equal(confirmado.saltos.length, 0)
    assert.equal(confirmado.variacao3m, 0)
    assert.equal(confirmado.minima52, 19)
  })
  it('monta o item com nome, setor e proporção do cadastro, sem múltiplos de avaliação', () => {
    const h = montar(30)
    h.cadastro.AAPL34 = { nome: 'Apple Inc.', setorBrapi: 'Electronic Technology', acoesPorBdr: 0.05 }
    const { item, semMapa, semNome } = montarItem('AAPL34', 'acao', h, CONFIG)
    assert.equal(item.nome, 'Apple Inc.')
    assert.equal(item.setor, 'Semicondutores e hardware')
    assert.equal(item.acoesPorBdr, 0.05)
    assert.equal(semMapa, false)
    assert.equal(semNome, false)
    assert.deepEqual(Object.keys(item), ['ticker', 'nome', 'setor', 'cotacao', 'dataCotacao', 'variacao3m', 'variacaoDia', 'volumeMedio', 'minima52', 'maxima52', 'acoesPorBdr'])
    const semCadastro = montarItem('AAPL34', 'acao', { ...h, cadastro: {} }, CONFIG)
    assert.equal(semCadastro.item.nome, 'AAPL34')
    assert.equal(semCadastro.semNome, true)
  })
})

describe('acompanhados, compactação e busca', () => {
  const h = historicoVazio()
  h.pregoes = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`)
  const cheia = (vol) => Array.from({ length: 30 }, () => [10, 10, 10, vol])
  h.ativos = { AAPL34: cheia(9e6), MSFT34: cheia(8e6), NVDC34: cheia(7e6), ROXO34: cheia(99e6), BSLV39: cheia(1e6), IBIT39: cheia(2e6) }
  h.ativos.RARO34 = [[5, 5, 5, 100], ...Array(29).fill(null)]
  h.ultimoNegocio = { AAPL34: ['2026-08-30', 10], ROXO34: ['2026-08-30', 10], RARO34: ['2026-08-01', 5], VELHO34: ['2026-05-01', 3] }
  h.cadastro = { AAPL34: { nome: 'Apple Inc.', setorBrapi: 'Electronic Technology' }, ...Object.fromEntries(['MSFT34', 'NVDC34', 'ROXO34', 'BSLV39', 'IBIT39', 'RARO34'].map((t) => [t, { listado: true }])), VELHO34: { nome: 'Velho', listado: true } }
  it('escolhe os mais negociados de cada tipo, sem os excluídos, mais os obrigatórios', () => {
    assert.deepEqual(atualizarAcompanhados(h, CONFIG, ['NVDC34']), ['AAPL34', 'IBIT39', 'MSFT34', 'NVDC34'])
  })
  it('mantém quem já era acompanhado enquanto estiver até o dobro do limite', () => {
    assert.ok(atualizarAcompanhados({ ...h, acompanhados: ['NVDC34'] }, CONFIG).includes('NVDC34'))
  })
  it('corta as séries dos demais para 21 pregões e apaga o que ficou sem negócio', () => {
    const c = compactar(h, ['AAPL34'])
    assert.equal(c.ativos.AAPL34.length, 30)
    assert.equal(c.ativos.MSFT34.length, 21)
    assert.equal(c.ativos.RARO34, undefined) // último negócio há 29 pregões
    assert.deepEqual(c.ultimoNegocio.RARO34, ['2026-08-01', 5]) // continua na busca
    assert.equal(c.ultimoNegocio.VELHO34, undefined) // antes do histórico
    assert.equal(c.cadastro.VELHO34, undefined)
  })
  it('busca: todos com negócio recente, menos os excluídos, com data do último negócio', () => {
    const busca = montarBusca(h, CONFIG)
    assert.deepEqual(busca.map((b) => b.ticker), ['AAPL34', 'RARO34', 'VELHO34'].filter((t) => t !== 'VELHO34'))
    const aapl = busca[0]
    assert.deepEqual(aapl, { ticker: 'AAPL34', tipo: 'acao', nome: 'Apple Inc.', setor: 'Semicondutores e hardware', cotacao: 10, dataCotacao: '2026-08-30', volumeDia: 9e6 })
    assert.equal(busca[1].volumeDia, 0)
  })
})

describe('cadastro pela brapi', () => {
  it('zera o consumo na virada do mês', () => {
    assert.deepEqual(consumoDoMes({ mes: '2026-09', requisicoes: 50, ultimaListagem: '2026-09-20' }, '2026-09-28').requisicoes, 50)
    assert.deepEqual(consumoDoMes({ mes: '2026-09', requisicoes: 50, ultimaListagem: '2026-09-20' }, '2026-10-01'), { mes: '2026-10', requisicoes: 0, ultimaListagem: '2026-09-20' })
  })
  it('a listagem atualiza nome curto e setor de todos os BDRs', () => {
    const c = aplicarListagem({ AAPL34: { nome: 'Apple Inc.', acoesPorBdr: 0.05 } }, [
      { stock: 'AAPL34', name: 'APPLE', sector: 'Electronic Technology' },
      { stock: 'KOCH34', name: 'KOCH34', sector: 'Consumer Non-Durables' },
      { stock: 'PETR4', name: 'PETROBRAS', sector: 'Energy Minerals' },
    ])
    assert.deepEqual(c.AAPL34, { nome: 'Apple Inc.', acoesPorBdr: 0.05, listado: true, nomeLista: 'APPLE', setorBrapi: 'Electronic Technology' })
    assert.equal(c.KOCH34.nomeLista, null)
    assert.equal(c.PETR4, undefined)
  })
  it('fila: salto depois da última consulta, nunca consultado, consulta vencida', () => {
    const cadastro = {
      AAPL34: { proporcaoEm: '2026-09-01' },
      MSFT34: { proporcaoEm: '2026-06-01' },
      NVDC34: { proporcaoEm: '2026-09-20' },
      AMZO34: { proporcaoEm: '2026-09-25' },
    }
    const fila = filaDeConsultas(['AAPL34', 'MSFT34', 'NVDC34', 'AMZO34', 'GOGL34'], cadastro, { NVDC34: '2026-09-24', AMZO34: '2026-09-24' }, '2026-09-26', 60, 10)
    assert.deepEqual(fila, ['NVDC34', 'GOGL34', 'MSFT34'])
    assert.deepEqual(filaDeConsultas(['GOGL34', 'MSFT34'], cadastro, {}, '2026-09-26', 60, 1), ['GOGL34'])
  })
  it('a consulta grava nome longo e proporção e avisa se a proporção mudou', () => {
    const r = aplicarConsulta({ AAPL34: { acoesPorBdr: 0.1, setorBrapi: 'X' } }, 'AAPL34', { longName: 'Apple Inc. Shs Unsponsored Brazilian Depository Receipt Repr 0.05 Sh' }, '2026-09-26')
    assert.deepEqual(r.cadastro.AAPL34, { acoesPorBdr: 0.05, setorBrapi: 'X', nome: 'Apple Inc.', proporcaoEm: '2026-09-26' })
    assert.deepEqual(r.mudou, { de: 0.1, para: 0.05 })
  })
})

describe('arquivo do histórico', () => {
  it('gera JSON válido, um BDR por linha, e volta igual pela normalização', () => {
    let h = historicoVazio()
    h = incorporarPregao(h, '2026-09-25', instr([['AAPL34', 88, 2e6], ['MSFT34', 40, 5e5]]))
    h.cadastro.AAPL34 = { nome: 'Apple Inc.' }
    const texto = formatarHistorico(h)
    assert.match(texto, /\n {4}"AAPL34": \[\[88,88,88,2000000\]\]/)
    assert.deepEqual(normalizarHistorico(JSON.parse(texto)), { ...h, acompanhados: [] })
    assert.deepEqual(normalizarHistorico(null), historicoVazio())
  })
})

// ---------------------------------------------------------------------------------------
// Ponta a ponta: carga inicial, dia a dia, feriado, desdobramento e brapi com teto
// ---------------------------------------------------------------------------------------

const blocoXml = (ticker, data, preco, volume) =>
  [
    '<PricRpt>',
    '  <TradDt>',
    `    <Dt>${data}</Dt>`,
    '  </TradDt>',
    '  <SctyId>',
    `    <TckrSymb>${ticker}</TckrSymb>`,
    '  </SctyId>',
    '  <FinInstrmAttrbts>',
    preco ? `    <NtlFinVol Ccy="BRL">${volume}</NtlFinVol>` : '',
    preco ? `    <MinPric Ccy="BRL">${(preco * 0.99).toFixed(2)}</MinPric>` : '',
    preco ? `    <MaxPric Ccy="BRL">${(preco * 1.01).toFixed(2)}</MaxPric>` : '',
    preco ? `    <LastPric Ccy="BRL">${preco}</LastPric>` : '',
    '  </FinInstrmAttrbts>',
    '</PricRpt>',
  ]
    .filter(Boolean)
    .join('\n')

// Mercado sintético: preço sobe 0,1% por pregão; AAPL34 desdobra 1 para 10 em 2026-09-15.
const MERCADO = {
  AAPL34: { preco: 90, volume: 30e6 },
  MSFT34: { preco: 60, volume: 20e6 },
  NVDC34: { preco: 40, volume: 25e6 },
  AMZO34: { preco: 50, volume: 15e6 },
  GOGL34: { preco: 45, volume: 12e6 },
  ROXO34: { preco: 12, volume: 90e6 }, // excluído
  NOVO32: { preco: 60, volume: 1e6 }, // código 32 sem decisão: pede revisão
  BSLV39: { preco: 100, volume: 2e6 },
  IBIT39: { preco: 70, volume: 3e6 },
  BURA39: { preco: 35, volume: 1e6 },
  RARO34: { preco: 8, volume: 2000, soSegunda: true }, // só negocia às segundas
  KOCH34: { preco: 25, volume: 0, nunca: true }, // listado, sem negócio
  DI1F31: { preco: 86000, volume: 18e9, futuro: true }, // futuro de DI: formato de BDR, não é BDR
  FRCV31: { preco: 4.2, volume: 9e6, futuro: true }, // FRA de cupom
  NOVA34: { preco: 30, volume: 5e6, foraDaBrapi: true }, // formato de BDR, fora da listagem da brapi
}
const FERIADOS = new Set(['2026-09-07'])

function precoEm(ticker, data, indice) {
  const m = MERCADO[ticker]
  const bruto = m.preco * 1.001 ** indice
  return Math.round((ticker === 'AAPL34' && data >= '2026-09-15' ? bruto / 10 : bruto) * 100) / 100
}

function prepararRaiz(ajustes = {}) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'bdrs-e2e-'))
  const config = JSON.parse(fs.readFileSync(path.join(RAIZ_REAL, 'config', 'bdrs.json'), 'utf8'))
  Object.assign(config, { minimoBdrsNegociadosNoBoletim: 5, minimoAcoesParaPublicar: 3, minimoEtfsParaPublicar: 2, pisoVolumeAcoes: 300000, pisoVolumeEtfs: 100000, acompanharAcoes: 4, acompanharEtfs: 2, pausaEntreDownloadsMs: 0 }, ajustes)
  config.brapi = { ...config.brapi, pausaEntreRequisicoesMs: 0, minimoNaListagem: 3, tetoMensal: 12, maxConsultasCargaInicial: 5 }
  fs.mkdirSync(path.join(raiz, 'config'))
  fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
  fs.writeFileSync(path.join(raiz, 'config', 'bdrs.json'), JSON.stringify(config))
  fs.writeFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'bdrs.json'), JSON.stringify({ geradoEm: '2026-09-25T22:00:00Z', dataPregao: '2026-09-25', acoes: [], etfs: [], busca: [] }))
  return { raiz, config }
}

function dependencias() {
  const chamadas = []
  const todasDatas = []
  const baixar = async (data, pastaTemp) => {
    if (FERIADOS.has(data)) return null
    if (!todasDatas.includes(data)) todasDatas.push(data)
    const indice = Date.parse(data) / 86_400_000 // cresce com a data, igual para todas as execuções
    const blocos = Object.entries(MERCADO).map(([t, m]) => {
      const dia = new Date(`${data}T12:00:00Z`).getUTCDay()
      const negocia = !m.nunca && (!m.soSegunda || dia === 1)
      return blocoXml(t, data, negocia ? precoEm(t, data, indice - 20000) : null, m.volume)
    })
    const pasta = path.join(pastaTemp, data)
    fs.mkdirSync(pasta, { recursive: true })
    const xml = path.join(pasta, 'BVBG.086.01_teste.xml')
    fs.writeFileSync(xml, `<?xml version="1.0"?>\n<Document>\n<BizGrpDtls>\n${blocos.join('\n')}\n</BizGrpDtls>\n</Document>\n`)
    return xml
  }
  const chamar = async (url) => {
    chamadas.push(url)
    if (url.includes('/quote/list')) {
      return {
        stocks: Object.keys(MERCADO).filter((t) => !MERCADO[t].futuro && !MERCADO[t].foraDaBrapi).map((t) => ({ stock: t, name: t === 'KOCH34' ? 'KOCH34' : `${t.slice(0, 4)} INC`, sector: t.endsWith('39') ? 'Miscellaneous' : 'Electronic Technology', type: 'bdr' })),
      }
    }
    const ticker = decodeURIComponent(url.split('/').pop())
    return { results: [{ symbol: ticker, longName: `${ticker.slice(0, 4)} Corp Shs Unsponsored Brazilian Depository Receipt Repr ${ticker === 'AAPL34' ? '0.005' : '0.05'} Sh` }] }
  }
  const linhas = []
  const log = { info: (l) => linhas.push(l), warn: (l) => linhas.push(l) }
  return { baixar, chamar, chamadas, linhas, log, esperar: async () => {} }
}

describe('ponta a ponta com boletins sintéticos', () => {
  const { raiz } = prepararRaiz()
  const dep = dependencias()
  const lerSaida = () => JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'bdrs.json'), 'utf8'))
  const lerHistorico = () => JSON.parse(fs.readFileSync(path.join(raiz, 'historico', 'bdrs.json'), 'utf8'))
  const AGORA = new Date('2026-09-26T01:30:00Z') // 25/09, 22h30 de Brasília

  it('carga inicial: histórico, lista, busca e cadastro dentro do teto da brapi', async () => {
    const r = await executar({ raiz, agora: AGORA, argv: ['--carga-inicial=90'], token: 'x', ...dep })
    assert.equal(r.publicado, true)
    const saida = lerSaida()
    assert.equal(saida.fonte, FONTE)
    assert.equal(saida.dataPregao, '2026-09-25')
    assert.equal(saida.pregoesNoHistorico, 90)
    assert.deepEqual(saida.acoes.map((i) => i.ticker), ['AAPL34', 'NVDC34', 'MSFT34', 'AMZO34', 'GOGL34', 'NOVO32'])
    assert.deepEqual(saida.etfs.map((i) => i.ticker), ['IBIT39', 'BSLV39', 'BURA39'])
    assert.ok(!JSON.stringify(saida).includes('ROXO34'), 'excluído não aparece nem na busca')
    for (const t of ['DI1F31', 'FRCV31', 'NOVA34']) assert.ok(!JSON.stringify(saida).includes(t), `${t} não é publicado`)
    assert.ok(!JSON.stringify(lerHistorico()).includes('DI1F31'), 'futuro nem entra no histórico')
    const aapl = saida.acoes[0]
    assert.equal(aapl.variacao3m, null, 'desdobramento sem confirmação apaga a variação')
    assert.equal(aapl.acoesPorBdr, 0.005)
    assert.equal(aapl.nome, 'AAPL Corp')
    assert.equal(aapl.setor, 'Semicondutores e hardware')
    const msft = saida.acoes.find((i) => i.ticker === 'MSFT34')
    assert.ok(msft.variacao3m > 0 && msft.variacao3m < 10)
    assert.equal(msft.minima52, null, 'faixa de 52 semanas só com 240 pregões')
    const raro = saida.busca.find((b) => b.ticker === 'RARO34')
    assert.equal(raro.volumeDia, 0)
    assert.equal(raro.dataCotacao, '2026-09-21') // última segunda
    assert.ok(!saida.busca.some((b) => b.ticker === 'KOCH34'), 'sem negócio no período, fora da busca')
    const h = lerHistorico()
    assert.equal(h.brapi.requisicoes, dep.chamadas.length)
    assert.ok(h.brapi.requisicoes <= 12)
    assert.equal(h.ativos.AAPL34.length, 90)
    assert.equal(h.ativos.BURA39.length, 90, 'publicado: série longa')
    assert.equal(h.ativos.RARO34.length, 21, 'fora dos acompanhados: série curta')
    assert.ok(dep.linhas.some((l) => l.startsWith('[desdobramento] AAPL34') && l.includes('"data": "2026-09-15", "fator": 10')))
    assert.ok(dep.linhas.some((l) => l.startsWith('[revisar] NOVO32')))
    assert.ok(dep.linhas.some((l) => l.includes('2026-09-07: sem pregão')))
  })

  it('dia seguinte: acrescenta um pregão; repetir no mesmo dia não muda nada', async () => {
    const antes = dep.chamadas.length
    const agora = new Date('2026-09-29T01:30:00Z') // segunda 28/09, 22h30
    const r = await executar({ raiz, agora, argv: [], token: 'x', ...dep })
    assert.equal(r.publicado, true)
    assert.equal(lerSaida().dataPregao, '2026-09-28')
    assert.equal(lerHistorico().pregoes.length, 91, 'carga de 90 + 1 pregão novo (cabe nos 260)')
    assert.ok(dep.chamadas.length - antes <= 6)
    const segunda = await executar({ raiz, agora, argv: [], token: 'x', ...dep })
    assert.equal(segunda.publicado, false)
    assert.equal(segunda.motivo, 'sem pregão novo')
  })

  it('sem token e com desdobramento confirmado: publica com o cadastro guardado e a variação volta', async () => {
    const arquivo = path.join(raiz, 'config', 'bdrs.json')
    const config = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
    config.desdobramentos.AAPL34 = [{ data: '2026-09-15', fator: 10 }]
    fs.writeFileSync(arquivo, JSON.stringify(config))
    const antes = dep.chamadas.length
    const r = await executar({ raiz, agora: new Date('2026-09-30T01:30:00Z'), argv: [], token: undefined, ...dep })
    assert.equal(r.publicado, true)
    assert.equal(dep.chamadas.length, antes)
    const aapl = lerSaida().acoes.find((i) => i.ticker === 'AAPL34')
    assert.ok(aapl.variacao3m > 0 && aapl.variacao3m < 10, `variação ajustada: ${aapl.variacao3m}`)
    assert.equal(aapl.nome, 'AAPL Corp')
  })

  it('arquivo publicado com futuros é regravado mesmo sem pregão novo (autocorreção)', async () => {
    const arquivo = path.join(raiz, 'webapp-src', 'src', 'data', 'bdrs.json')
    const saida = lerSaida()
    saida.acoes.unshift({ ...saida.acoes[0], ticker: 'DI1F31' })
    fs.writeFileSync(arquivo, JSON.stringify(saida))
    const h = lerHistorico()
    h.ativos.DI1F31 = h.ativos.AAPL34
    h.ultimoNegocio.DI1F31 = h.ultimoNegocio.AAPL34
    fs.writeFileSync(path.join(raiz, 'historico', 'bdrs.json'), JSON.stringify(h))
    const r = await executar({ raiz, agora: new Date('2026-09-30T01:30:00Z'), argv: [], token: undefined, ...dep })
    assert.equal(r.publicado, true)
    assert.ok(!JSON.stringify(lerSaida()).includes('DI1F31'))
    assert.ok(!JSON.stringify(lerHistorico()).includes('DI1F31'), 'limpo também do histórico')
    const denovo = await executar({ raiz, agora: new Date('2026-09-30T01:30:00Z'), argv: [], token: undefined, ...dep })
    assert.equal(denovo.motivo, 'sem pregão novo')
  })

  it('data antiga sem resposta da B3 não trava o job se uma mais nova responde; a mais recente sem resposta falha', async () => {
    const baixarOriginal = dep.baixar
    const timeout = Object.assign(new Error('sem resposta da B3 em 180 s.'), { name: 'TimeoutError' })
    const semResposta = (datas) => async (data, pasta) => {
      if (datas.includes(data)) throw timeout
      return baixarOriginal(data, pasta)
    }
    const r = await executar({ raiz, agora: new Date('2026-10-02T01:30:00Z'), argv: [], token: undefined, ...dep, baixar: semResposta(['2026-09-30']) })
    assert.equal(r.publicado, true)
    assert.equal(lerSaida().dataPregao, '2026-10-01')
    assert.ok(dep.linhas.some((l) => l.includes('2026-09-30') && l.includes('Data antiga ignorada')))
    await assert.rejects(
      () => executar({ raiz, agora: new Date('2026-10-03T01:30:00Z'), argv: [], token: undefined, ...dep, baixar: semResposta(['2026-10-02']) }),
      /2026-10-02: sem resposta da B3.*NÃO atualizado/,
    )
  })

  it('para sem gravar se o histórico for curto demais', async () => {
    const outra = prepararRaiz()
    await assert.rejects(() => executar({ raiz: outra.raiz, agora: AGORA, argv: [], token: undefined, ...dependencias(), baixar: async () => null }), /Rode a carga inicial/)
  })
})

describe('variacaoDoDia', () => {
  const dia = (fechamento) => [fechamento, fechamento, fechamento, 1e6]

  it('compara o último pregão com o anterior, em %', () => {
    assert.equal(variacaoDoDia([dia(100), dia(102)], 1), 2)
    assert.equal(variacaoDoDia([dia(100), dia(98.5)], 1), -1.5)
  })
  it('sem negócio no último pregão ou no anterior, não há variação do dia', () => {
    assert.equal(variacaoDoDia([dia(100), dia(101), null], 1), null) // último negócio foi há um pregão
    assert.equal(variacaoDoDia([dia(100), null, dia(101)], 2), null) // não negociou no dia anterior
    assert.equal(variacaoDoDia([dia(100)], 0), null)
  })
  it('salto de desdobramento não vira variação do dia', () => {
    assert.equal(variacaoDoDia([dia(200), dia(20)], 1), null)
    assert.equal(variacaoDoDia([dia(100), dia(102)], 1, true), null)
  })
  it('metricas publica variacaoDia', () => {
    const h = historicoVazio()
    h.pregoes = ['2026-01-02', '2026-01-05']
    h.ativos.AAPL34 = [dia(100), dia(101)]
    assert.equal(metricas(h, 'AAPL34').variacaoDia, 1)
  })
})
