// Testes do job diário de Ações (node --test), D43. Os boletins são simulados: nada de rede.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  FONTE,
  compactar,
  ehCodigoDeAcao,
  executar,
  formatarAcoes,
  formatarHistorico,
  historicoVazio,
  idDoCadastro,
  formatarSeries,
  montarSeries,
  montarBusca,
  montarCadastro,
  montarSetores,
  motivoInvalido,
  normalizarHistorico,
} from './atualizar-acoes.mjs'
import { incorporarPregao } from './atualizar-bdrs.mjs'

const RAIZ_REAL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const CONFIG = {
  conferidoPeloResponsavel: true,
  minimoPregoesHistorico: 3,
  minimoEmpresasParaPublicar: 3,
  minimoCodigosNegociadosNoBoletim: 3,
  horarioCorteBoletim: '21:00',
  diasProcuraBoletim: 5,
  pregoesBusca: 63,
  controle: { tickers: ['PETR4', 'VALE3'], minimo: 2 },
  desdobramentos: {},
  grupoB3Ordem: ['Petróleo, Gás e Biocombustíveis', 'Materiais Básicos', 'Financeiro'],
  setores: [
    { setor: 'Petróleo e gás', grupoB3: 'Petróleo, Gás e Biocombustíveis', empresas: [{ ticker: 'PETR4', nome: 'Petrobras' }, { ticker: 'PRIO3', nome: 'PRIO' }] },
    { setor: 'Mineração', grupoB3: 'Materiais Básicos', empresas: [{ ticker: 'VALE3', nome: 'Vale' }] },
    { setor: 'Bancos', grupoB3: 'Financeiro', empresas: [{ ticker: 'ITUB4', nome: 'Itaú Unibanco' }, { ticker: 'SANB11', nome: 'Santander Brasil', revisar: true }, { ticker: 'XXXX3', nome: 'Sumiu' }] },
  ],
}

/** Instrumento do boletim: [fechamento, volume]. */
const item = (ticker, data, fechamento, volume) => ({ ticker, data, fechamento, minima: fechamento * 0.99, maxima: fechamento * 1.01, volume, quantidade: 1 })

function historicoCom(dias) {
  let h = historicoVazio()
  for (const [data, instrumentos] of dias) h = incorporarPregao(h, data, new Map(instrumentos.map((i) => [i.ticker, i])))
  return h
}

describe('códigos de ação', () => {
  it('aceita ON/PN de 5 caracteres e recusa BDR, FII, ETF, units, fracionário e opções', () => {
    for (const t of ['PETR4', 'VALE3', 'B3SA3', 'ENEV3', 'BRAP4', 'USIM5', 'BRSR6']) assert.equal(ehCodigoDeAcao(t), true, t)
    for (const t of ['AAPL34', 'HGLG11', 'BOVA11', 'KLBN11', 'PETR4F', 'PETRA250', 'PETR1', 'DI1F31', '']) assert.equal(ehCodigoDeAcao(t), false, t)
  })
})

describe('cadastro', () => {
  it('lê o config e guarda setor, nome e a marca de revisão', () => {
    const c = montarCadastro(CONFIG)
    assert.equal(c.size, 6)
    assert.deepEqual(c.get('SANB11'), { nome: 'Santander Brasil', setor: 'Bancos', grupoB3: 'Financeiro', revisar: true })
    assert.equal(c.get('PETR4').revisar, false)
  })
  it('recusa ticker repetido, código inválido e empresa sem nome', () => {
    const base = structuredClone(CONFIG)
    base.setores[1].empresas.push({ ticker: 'PETR4', nome: 'Outra' })
    assert.throws(() => montarCadastro(base), /aparece duas vezes/)
    const ruim = structuredClone(CONFIG)
    ruim.setores[0].empresas[0].ticker = 'PET'
    assert.throws(() => montarCadastro(ruim), /Código inválido/)
    const semNome = structuredClone(CONFIG)
    semNome.setores[0].empresas[0].nome = ''
    assert.throws(() => montarCadastro(semNome), /sem nome/)
  })
  it('o identificador muda quando o cadastro muda', () => {
    const a = idDoCadastro(montarCadastro(CONFIG))
    const alterado = structuredClone(CONFIG)
    alterado.setores[0].empresas[1].nome = 'PRIO S.A.'
    assert.notEqual(a, idDoCadastro(montarCadastro(alterado)))
    assert.equal(a, idDoCadastro(montarCadastro(CONFIG)))
  })
  it('o cadastro real (config/acoes.json) é válido: sem repetição, 30 setores ou mais', () => {
    const real = JSON.parse(fs.readFileSync(path.join(RAIZ_REAL, 'config', 'acoes.json'), 'utf8'))
    const cadastro = montarCadastro(real)
    assert.ok(real.setores.length >= 30, `setores: ${real.setores.length}`)
    assert.ok(cadastro.size >= 200, `empresas: ${cadastro.size}`)
    const grupos = new Set(real.setores.map((s) => s.grupoB3))
    for (const g of grupos) assert.ok(real.grupoB3Ordem.includes(g), `grupo fora da ordem: ${g}`)
  })
})

describe('validação', () => {
  it('recusa preço absurdo, falta de volume e variação impossível', () => {
    assert.match(motivoInvalido({ cotacao: 0.01, volumeMedio: 1, variacao3m: 0 }), /cotação/)
    assert.match(motivoInvalido({ cotacao: 10, volumeMedio: 0, variacao3m: 0 }), /sem negócio/)
    assert.match(motivoInvalido({ cotacao: 10, volumeMedio: 5, variacao3m: -99 }), /variação/)
    assert.equal(motivoInvalido({ cotacao: 10, volumeMedio: 5, variacao3m: null }), null)
  })
})

describe('setores e busca', () => {
  const dias = [
    ['2026-09-29', [item('PETR4', '2026-09-29', 40, 900), item('PRIO3', '2026-09-29', 50, 300), item('VALE3', '2026-09-29', 60, 700), item('ITUB4', '2026-09-29', 35, 800), item('ABCD3', '2026-09-29', 10, 5)]],
    ['2026-09-30', [item('PETR4', '2026-09-30', 41, 1000), item('PRIO3', '2026-09-30', 51, 400), item('VALE3', '2026-09-30', 61, 700), item('ITUB4', '2026-09-30', 36, 800), item('SANB11', '2026-09-30', 25, 100), item('ABCD3', '2026-09-30', 10.2, 5)]],
    ['2026-10-01', [item('PETR4', '2026-10-01', 42, 1100), item('PRIO3', '2026-10-01', 52, 500), item('VALE3', '2026-10-01', 62, 700), item('ITUB4', '2026-10-01', 37, 800), item('SANB11', '2026-10-01', 26, 100), item('ABCD3', '2026-10-01', 10.4, 5)]],
  ]
  const historico = historicoCom(dias)
  const cadastro = montarCadastro(CONFIG)

  it('publica por setor, em ordem de volume, e deixa de fora quem não negociou', () => {
    const r = montarSetores(historico, cadastro, CONFIG)
    assert.deepEqual(r.setores.map((s) => s.setor), ['Petróleo e gás', 'Mineração', 'Bancos'])
    assert.deepEqual(r.setores[0].empresas.map((e) => e.ticker), ['PETR4', 'PRIO3'])
    assert.deepEqual(r.setores[2].empresas.map((e) => e.ticker), ['ITUB4', 'SANB11'])
    assert.deepEqual(r.semNegocio, ['XXXX3'])
    assert.equal(r.setores[0].empresas[0].nome, 'Petrobras')
    assert.equal(r.setores[0].empresas[0].cotacao, 42)
  })

  it('setor sem nenhuma empresa válida não é publicado', () => {
    const sem = structuredClone(CONFIG)
    sem.setores.push({ setor: 'Fantasma', grupoB3: 'Financeiro', empresas: [{ ticker: 'ZZZZ3', nome: 'Zzz' }] })
    const r = montarSetores(historico, montarCadastro(sem), sem)
    assert.ok(!r.setores.some((s) => s.setor === 'Fantasma'))
  })

  it('a busca traz o cadastro, as units do cadastro e códigos de ação de fora (setor Outros, sem nome)', () => {
    const b = montarBusca(historico, cadastro, CONFIG)
    assert.deepEqual(b.map((x) => x.ticker), ['ABCD3', 'ITUB4', 'PETR4', 'PRIO3', 'SANB11', 'VALE3'])
    const fora = b.find((x) => x.ticker === 'ABCD3')
    assert.equal(fora.setor, 'Outros')
    assert.equal(fora.nome, null)
    assert.equal(fora.volumeDia, 5)
    assert.equal(b.find((x) => x.ticker === 'SANB11').setor, 'Bancos')
  })

  it('a busca ignora códigos que não são ação nem estão no cadastro (FII, BDR)', () => {
    const h = historicoCom([['2026-10-01', [item('HGLG11', '2026-10-01', 150, 1000), item('AAPL34', '2026-10-01', 80, 1000), item('PETR4', '2026-10-01', 42, 1000)]]])
    assert.deepEqual(montarBusca(h, cadastro, CONFIG).map((x) => x.ticker), ['PETR4'])
  })

  it('salto de preço não confirmado tira a variação de 3 meses e a faixa de 52 semanas', () => {
    const h = historicoCom([
      ['2026-09-29', [item('PETR4', '2026-09-29', 40, 900)]],
      ['2026-09-30', [item('PETR4', '2026-09-30', 4, 900)]],
      ['2026-10-01', [item('PETR4', '2026-10-01', 4.1, 900)]],
    ])
    const r = montarSetores(h, montarCadastro(CONFIG), CONFIG)
    const petr = r.setores[0].empresas[0]
    assert.equal(petr.variacao3m, null)
    assert.equal(petr.minima52, null)
    assert.equal(r.saltos.get('PETR4')[0].fator, 10)
  })
})

describe('histórico em arquivo', () => {
  it('compactar mantém série longa só do cadastro e corta as demais', () => {
    const dias = Array.from({ length: 30 }, (_, i) => {
      const data = `2026-08-${String(i + 1).padStart(2, '0')}`
      return [data, [item('PETR4', data, 40 + i, 1000), item('ABCD3', data, 10, 5)]]
    })
    const h = compactar(historicoCom(dias), ['PETR4'])
    assert.equal(h.ativos.PETR4.length, 30)
    assert.equal(h.ativos.ABCD3.length, 21)
  })
  it('formatarHistorico gera JSON válido, uma empresa por linha, e volta igual', () => {
    const h = historicoCom([['2026-10-01', [item('PETR4', '2026-10-01', 42, 1100)]]])
    const texto = formatarHistorico(h)
    const lido = JSON.parse(texto)
    assert.deepEqual(normalizarHistorico(lido).ativos, h.ativos)
    assert.match(texto, /\n {4}"PETR4": \[\[/)
  })
  it('formatarAcoes gera JSON válido, inclusive vazio', () => {
    assert.deepEqual(JSON.parse(formatarAcoes({ geradoEm: null, dataPregao: null, setores: [], busca: [] })).setores, [])
    const s = { geradoEm: 'x', setores: [{ setor: 'A', grupoB3: 'B', empresas: [{ ticker: 'PETR4', nome: 'Petrobras' }] }], busca: [{ ticker: 'PETR4' }] }
    assert.deepEqual(JSON.parse(formatarAcoes(s)).setores[0].empresas[0].ticker, 'PETR4')
  })
})

describe('execução de ponta a ponta (boletins simulados)', () => {
  // 5 pregões: 25, 28, 29, 30/09 e 01/10 de 2026.
  const PREGOES = ['2026-09-25', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01']
  const AGORA = new Date('2026-10-02T12:00:00Z') // 09h em Brasília: o boletim de hoje ainda não conta

  function montarRaiz(config = CONFIG, saidaInicial = { geradoEm: null, dataPregao: null, setores: [], busca: [] }) {
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'acoes-teste-'))
    fs.mkdirSync(path.join(raiz, 'config'), { recursive: true })
    fs.mkdirSync(path.join(raiz, 'webapp-src', 'src', 'data'), { recursive: true })
    fs.writeFileSync(path.join(raiz, 'config', 'acoes.json'), JSON.stringify(config))
    fs.writeFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json'), JSON.stringify(saidaInicial))
    return raiz
  }

  const boletim = (data, { semControle = false } = {}) => {
    const i = PREGOES.indexOf(data)
    const lista = [
      item('PETR4', data, 40 + i, 1000), item('PRIO3', data, 50 + i, 400), item('VALE3', data, 60 + i, 700),
      item('ITUB4', data, 35 + i, 800), item('SANB11', data, 25 + i, 100), item('ABCD3', data, 10, 5),
      item('HGLG11', data, 150, 99), item('AAPL34', data, 80, 99),
    ].filter((x) => !(semControle && x.ticker === 'VALE3'))
    return new Map(lista.map((x) => [x.ticker, x]))
  }

  const dependencias = (opcoes = {}) => ({
    agora: AGORA,
    argv: ['node', 'x'],
    esperar: async () => {},
    log: { info: () => {}, warn: () => {} },
    baixar: async (data, pasta) => {
      if (!PREGOES.includes(data)) return null
      const dir = path.join(pasta, data)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'b.xml'), '')
      return path.join(dir, 'b.xml')
    },
    ler: async (xml, aceitar) => {
      const data = path.basename(path.dirname(xml))
      const todos = boletim(data, opcoes)
      return { instrumentos: new Map([...todos].filter(([t]) => aceitar(t))), datas: [data], blocos: todos.size }
    },
  })

  it('monta o acoes.json e o histórico: setores, busca e id do cadastro', async () => {
    const raiz = montarRaiz()
    const r = await executar({ raiz, ...dependencias() })
    assert.equal(r.publicado, true)
    const saida = JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json'), 'utf8'))
    assert.equal(saida.fonte, FONTE)
    assert.equal(saida.dataPregao, '2026-10-01')
    assert.deepEqual(saida.totais, { setores: 3, empresas: 5 })
    assert.equal(saida.cadastroId, idDoCadastro(montarCadastro(CONFIG)))
    assert.deepEqual(saida.setores[0].empresas.map((e) => e.ticker), ['PETR4', 'PRIO3'])
    assert.ok(saida.busca.some((b) => b.ticker === 'ABCD3' && b.setor === 'Outros'))
    assert.ok(!saida.busca.some((b) => b.ticker === 'HGLG11' || b.ticker === 'AAPL34'))
    const hist = JSON.parse(fs.readFileSync(path.join(raiz, 'historico', 'acoes.json'), 'utf8'))
    assert.deepEqual(hist.pregoes, PREGOES)
    assert.equal(hist.ativos.PETR4.length, 5)
  })

  it('grava as séries da análise técnica em public/dados/acoes-series.json: empresas do cadastro, alinhadas pela direita, volume em R$ mil', async () => {
    const raiz = montarRaiz()
    await executar({ raiz, ...dependencias() })
    const s = JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'public', 'dados', 'acoes-series.json'), 'utf8'))
    assert.deepEqual(s.pregoes, PREGOES)
    assert.equal(s.dataPregao, '2026-10-01')
    assert.deepEqual(Object.keys(s.ativos).sort(), ['ITUB4', 'PETR4', 'PRIO3', 'SANB11', 'VALE3'])
    assert.ok(!('ABCD3' in s.ativos), 'código fora do cadastro não entra nas séries')
    assert.equal(s.ativos.PETR4.length, 5)
    assert.deepEqual(s.ativos.PETR4.at(-1), [44, 43.56, 44.44, 1]) // fechamento 40 + 4; volume 1000 reais = 1 mil
    assert.equal(s.referencia, null) // sem historico/etfs.json, não há referência de mercado
  })

  it('segunda execução sem pregão novo refaz as séries se o arquivo sumiu', async () => {
    const raiz = montarRaiz()
    await executar({ raiz, ...dependencias() })
    const arquivo = path.join(raiz, 'webapp-src', 'public', 'dados', 'acoes-series.json')
    fs.rmSync(arquivo)
    const r = await executar({ raiz, ...dependencias() })
    assert.equal(r.publicado, true)
    assert.ok(fs.existsSync(arquivo))
  })

  it('segunda execução sem pregão novo não muda nada', async () => {
    const raiz = montarRaiz()
    await executar({ raiz, ...dependencias() })
    const antes = fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json'), 'utf8')
    const r = await executar({ raiz, ...dependencias() })
    assert.equal(r.publicado, false)
    assert.equal(r.motivo, 'sem pregão novo')
    assert.equal(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json'), 'utf8'), antes)
  })

  it('mudou o cadastro: regrava mesmo sem pregão novo', async () => {
    const raiz = montarRaiz()
    await executar({ raiz, ...dependencias() })
    const novo = structuredClone(CONFIG)
    novo.setores[1].empresas.push({ ticker: 'ABCD3', nome: 'Abcd' })
    fs.writeFileSync(path.join(raiz, 'config', 'acoes.json'), JSON.stringify(novo))
    const r = await executar({ raiz, ...dependencias() })
    assert.equal(r.publicado, true)
    const saida = JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json'), 'utf8'))
    assert.ok(saida.setores[1].empresas.some((e) => e.ticker === 'ABCD3'))
  })

  it('recusa config não conferido', async () => {
    const raiz = montarRaiz({ ...CONFIG, conferidoPeloResponsavel: false })
    await assert.rejects(executar({ raiz, ...dependencias() }), /não foi conferido/)
  })

  it('não publica se as ações de controle não negociaram', async () => {
    const raiz = montarRaiz()
    await assert.rejects(executar({ raiz, ...dependencias({ semControle: true }) }), /ações de controle/)
    const saida = JSON.parse(fs.readFileSync(path.join(raiz, 'webapp-src', 'src', 'data', 'acoes.json'), 'utf8'))
    assert.equal(saida.dataPregao, null)
  })

  it('boletim com a data errada derruba o job sem alterar o arquivo', async () => {
    const raiz = montarRaiz()
    const dep = dependencias()
    dep.ler = async (xml, aceitar) => ({ instrumentos: new Map([...boletim('2026-10-01')].filter(([t]) => aceitar(t))), datas: ['2020-01-01'], blocos: 1 })
    await assert.rejects(executar({ raiz, ...dep }), /trouxe a\(s\) data/)
  })
})

describe('séries para a análise técnica', () => {
  const cadastro = montarCadastro({ setores: [{ setor: 'S', grupoB3: 'G', empresas: [{ ticker: 'AAAA3', nome: 'A' }, { ticker: 'BBBB3', nome: 'B' }] }] })
  const pregoes = ['2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08']
  const hist = (ativos) => ({ pregoes, ativos, ultimoNegocio: {} })

  it('aplica o desdobramento confirmado aos preços anteriores e mantém o volume', () => {
    const h = hist({ AAAA3: [[40, 39, 41, 8_000], [40, 39, 41, 8_000], [10, 9.8, 10.2, 8_000], [10.5, 10, 11, 8_000], [11, 10.5, 11.5, 8_000]] })
    const s = montarSeries(h, cadastro, { desdobramentos: { AAAA3: [{ data: '2026-01-06', fator: 4 }] } })
    assert.deepEqual(s.ativos.AAAA3[0], [10, 9.75, 10.25, 8])
    assert.deepEqual(s.ativos.AAAA3[2], [10, 9.8, 10.2, 8])
    assert.deepEqual(s.alertas, {}, 'salto resolvido não gera alerta')
  })

  it('salto de preço não confirmado vira alerta, e a série segue sem ajuste', () => {
    const h = hist({ AAAA3: [[40, 39, 41, 8_000], [40, 39, 41, 8_000], [10, 9.8, 10.2, 8_000], [10.5, 10, 11, 8_000], [11, 10.5, 11.5, 8_000]] })
    const s = montarSeries(h, cadastro, { desdobramentos: {} })
    assert.equal(s.ativos.AAAA3[0][0], 40)
    assert.deepEqual(s.alertas.AAAA3, [{ data: '2026-01-06', de: 40, para: 10 }])
  })

  it('dia sem negócio fica null, e o ticker sem nenhum negócio não entra', () => {
    const h = hist({ AAAA3: [null, [10, 9, 11, 1_000], null, [10, 9, 11, 1_000], [10, 9, 11, 1_000]], BBBB3: [null, null, null, null, null] })
    const s = montarSeries(h, cadastro, {})
    assert.equal(s.ativos.AAAA3[0], null)
    assert.ok(!('BBBB3' in s.ativos))
  })

  it('referência de mercado vem do histórico dos ETFs, alinhada pelas datas dos pregões das ações', () => {
    const h = hist({ AAAA3: [[10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000]] })
    const etfs = {
      pregoes: ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09'],
      ativos: { BOVA11: [[100, 99, 101, 5_000_000], [101, 100, 102, 5_000_000], [102, 101, 103, 5_000_000], [103, 102, 104, 5_000_000], [104, 103, 105, 5_000_000]] },
    }
    const s = montarSeries(h, cadastro, {}, etfs)
    assert.equal(s.referencia.ticker, 'BOVA11')
    assert.equal(s.referencia.serie[0], null) // 02/01 não existe no histórico dos ETFs
    assert.deepEqual(s.referencia.serie[1], [100, 99, 101, 5_000])
    assert.deepEqual(s.referencia.serie[4], [103, 102, 104, 5_000])
  })

  it('formatarSeries gera JSON válido, uma série por linha e em ordem alfabética', () => {
    const h = hist({ BBBB3: [[10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000]], AAAA3: [[10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000], [10, 9, 11, 1_000]] })
    const texto = formatarSeries({ geradoEm: 'x', dataPregao: '2026-01-08', fonte: 'B3', series: montarSeries(h, cadastro, {}) })
    const obj = JSON.parse(texto)
    assert.deepEqual(Object.keys(obj.ativos), ['AAAA3', 'BBBB3'])
    assert.ok(texto.split('\n').some((l) => l.trim().startsWith('"AAAA3":')))
  })
})
