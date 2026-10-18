import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { datasAProcessar, historicoVazio, incorporarPregao } from './atualizar-etfs.mjs'
import { barrasDaBrapi, candidatosReserva, complementarComBrapi, formatarHistorico, formatarPrecos, precosDoDia, preencherComBarras, universoDosFiis, ultimosPregoes } from './atualizar-fiis-historico.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'fiis-preco.json'), 'utf8'))

const instrumento = (ticker, fechamento, volume, extra = {}) => [ticker, { ticker, fechamento, minima: fechamento - 1, maxima: fechamento + 1, volume, ...extra }]

test('configuração: parâmetros coerentes entre si e com a triagem de FIIs baratos', () => {
  const triagem = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'fii-baratos.json'), 'utf8'))
  assert.ok(cfg.maxPregoesGuardados >= triagem.dados.pregoesPrecoDiario, 'o histórico guarda pelo menos a janela que a triagem lê')
  assert.equal(cfg.minimoPregoesParaUsar, triagem.dados.minimoPregoesPrecoDiario)
  assert.ok(cfg.diasProcuraBoletim >= 3)
  assert.match(cfg.horarioCorteBoletim, /^\d{2}:\d{2}$/)
})

test('universo: fundos do job de FIIs mais os extras, em maiúsculas e sem duplicar', () => {
  const u = universoDosFiis({ fundos: [{ ticker: 'hglg11', nome: 'CSHG Logística' }, { ticker: 'MXRF11', nome: 'Maxi Renda' }, { nome: 'sem código' }] }, ['xpml11', 'MXRF11'])
  assert.deepEqual([...u], [['HGLG11', 'CSHG Logística'], ['MXRF11', 'Maxi Renda'], ['XPML11', '']])
  assert.equal(universoDosFiis(undefined).size, 0)
})

test('histórico: um valor por pregão alinhado com as datas, null para quem não negociou, fundo novo entra com null nos dias antigos e o excesso de pregões é cortado', () => {
  const universo = new Map([['AAAA11', 'A'], ['BBBB11', 'B']])
  let h = historicoVazio()
  h = incorporarPregao(h, '2026-10-01', new Map([instrumento('AAAA11', 10, 1000.4)]), universo, 3)
  h = incorporarPregao(h, '2026-10-02', new Map([instrumento('AAAA11', 11, 2000), instrumento('BBBB11', 20, 500)]), universo, 3)
  assert.deepEqual(h.pregoes, ['2026-10-01', '2026-10-02'])
  assert.deepEqual(h.ativos.AAAA11, [[10, 9, 11, 1000.4], [11, 10, 12, 2000]])
  assert.deepEqual(h.ativos.BBBB11, [null, [20, 19, 21, 500]], 'fundo que só negociou no 2º dia: null no 1º')
  h = incorporarPregao(h, '2026-10-05', new Map([instrumento('AAAA11', 12, 3000)]), universo, 3)
  h = incorporarPregao(h, '2026-10-06', new Map([instrumento('AAAA11', 13, 4000)]), universo, 3)
  assert.deepEqual(h.pregoes, ['2026-10-02', '2026-10-05', '2026-10-06'], 'guarda só os 3 pregões mais recentes')
  assert.equal(h.ativos.BBBB11.length, 3)
  // repetir o mesmo pregão substitui, não duplica
  const h2 = incorporarPregao(h, '2026-10-06', new Map([instrumento('AAAA11', 99, 1)]), universo, 3)
  assert.equal(h2.pregoes.length, 3)
  assert.equal(h2.ativos.AAAA11.at(-1)[0], 99)
})

test('últimos pregões de um fundo: alinhados com as datas, [fechamento, volume] ou null, e nulo se o fundo não está no histórico', () => {
  const universo = new Map([['AAAA11', 'A']])
  let h = historicoVazio()
  for (const [d, f, v] of [['2026-10-01', 10, 100], ['2026-10-02', null, 0], ['2026-10-05', 12, 300], ['2026-10-06', 13, 400]]) {
    h = incorporarPregao(h, d, new Map(f === null ? [] : [instrumento('AAAA11', f, v)]), universo)
  }
  const r = ultimosPregoes(h, 'AAAA11', 3)
  assert.deepEqual(r.datas, ['2026-10-02', '2026-10-05', '2026-10-06'])
  assert.deepEqual(r.serie, [null, [12, 300], [13, 400]])
  assert.deepEqual(ultimosPregoes(h, 'AAAA11', 10).datas.length, 4, 'pede mais que o histórico tem: devolve o que há')
  assert.equal(ultimosPregoes(h, 'ZZZZ11', 3).serie, null)
  assert.deepEqual(ultimosPregoes({ pregoes: [], ativos: {} }, 'AAAA11', 3), { datas: [], serie: null })
  assert.equal(ultimosPregoes(undefined, 'AAAA11', 3).serie, null)
})

test('arquivo do histórico: JSON válido, um fundo por linha, ordenado, e lido de volta igual', () => {
  const universo = new Map([['BBBB11', 'B'], ['AAAA11', 'A "com aspas"']])
  let h = historicoVazio()
  h = incorporarPregao(h, '2026-10-01', new Map([instrumento('BBBB11', 20, 500), instrumento('AAAA11', 10, 1000)]), universo)
  h = incorporarPregao(h, '2026-10-02', new Map([instrumento('AAAA11', 11, 2000)]), universo)
  const texto = formatarHistorico(h)
  const lido = JSON.parse(texto)
  assert.deepEqual(lido.pregoes, h.pregoes)
  assert.deepEqual(lido.ativos, h.ativos)
  assert.deepEqual(lido.nomes, h.nomes)
  const linhas = texto.split('\n')
  assert.ok(linhas.findIndex((l) => l.includes('"AAAA11": [')) < linhas.findIndex((l) => l.includes('"BBBB11": [')), 'ordenado por código')
  assert.match(texto, /^\{\n {2}"_leia":/)
  assert.ok(texto.endsWith('}\n'))
})

// ---------------------------------------------------------------------------------------
// Complemento pela brapi (fundos líquidos que o boletim da B3 não traz)
// ---------------------------------------------------------------------------------------

const unix = (data) => Date.parse(`${data}T13:00:00Z`) / 1000 // 10h em Brasília
const corpoBrapi = (barras) => ({ results: [{ historicalDataPrice: barras }] })

test('configuração da reserva brapi: ativa, com piso de liquidez e limite de requisições por execução', () => {
  assert.equal(cfg.reservaBrapi.ativa, true)
  assert.ok(cfg.reservaBrapi.volumeMinimoBrapi >= 100_000)
  assert.ok(cfg.reservaBrapi.maxRequisicoes > 0 && cfg.reservaBrapi.maxRequisicoes <= 50, 'poucas requisições por dia: a cota da brapi é compartilhada com o job mensal de FIIs')
})

test('candidatos: só fundo líquido na brapi que o histórico do boletim não tem (ou sem negócio na janela)', () => {
  const universo = new Map([['BOLE11', 'no boletim'], ['SUMI11', 'fora do boletim'], ['ILIQ11', 'fora e ilíquido'], ['PARA11', 'no histórico, sem negócio']])
  let h = historicoVazio()
  h = incorporarPregao(h, '2026-10-05', new Map([instrumento('BOLE11', 10, 1000)]), universo)
  h = incorporarPregao(h, '2026-10-06', new Map([instrumento('BOLE11', 10, 1000)]), universo)
  const snapshot = { fundos: [{ ticker: 'BOLE11', volumeMediano: 5e6 }, { ticker: 'SUMI11', volumeMediano: 2e6 }, { ticker: 'ILIQ11', volumeMediano: 10_000 }, { ticker: 'PARA11', volumeMediano: 900_000 }, { ticker: 'sem11', volumeMedio: 400_000 }] }
  assert.deepEqual(candidatosReserva(h, snapshot, { volumeMinimo: 300_000 }), ['SUMI11', 'PARA11', 'SEM11'])
})

test('barras da brapi: só as com preço, volume em reais (cotas × fechamento) e data em Brasília', () => {
  const barras = barrasDaBrapi(corpoBrapi([
    { date: unix('2026-10-05'), close: 10, low: 9.5, high: 10.5, volume: 1000 },
    { date: unix('2026-10-06'), close: 11, volume: 0 },
    { date: unix('2026-10-07'), close: null, volume: 5 },
    { date: 'x', close: 10, volume: 1 },
  ]))
  assert.deepEqual(barras, [
    { data: '2026-10-05', fechamento: 10, minima: 9.5, maxima: 10.5, volume: 10_000 },
    { data: '2026-10-06', fechamento: 11, minima: 11, maxima: 11, volume: 0 },
  ])
  assert.deepEqual(barrasDaBrapi({}), [])
  assert.deepEqual(barrasDaBrapi(undefined), [])
})

test('preencher: completa só os dias sem dado e com negócio; nunca sobrescreve o que o boletim trouxe nem inventa pregão', () => {
  const universo = new Map([['BOLE11', 'x'], ['SUMI11', 'y']])
  let h = historicoVazio()
  for (const d of ['2026-10-01', '2026-10-02', '2026-10-05']) h = incorporarPregao(h, d, new Map([instrumento('BOLE11', 10, 1000), ...(d === '2026-10-05' ? [instrumento('SUMI11', 77, 500)] : [])]), universo)
  const barras = [
    { data: '2026-10-01', fechamento: 50, minima: 49, maxima: 51, volume: 2e6 },
    { data: '2026-10-02', fechamento: 51, minima: 50, maxima: 52, volume: 0 }, // sem negócio: continua null
    { data: '2026-10-03', fechamento: 52, minima: 51, maxima: 53, volume: 1e6 }, // sábado: não é pregão do histórico
    { data: '2026-10-05', fechamento: 99, minima: 98, maxima: 100, volume: 3e6 }, // o boletim já trouxe este dia
  ]
  const r = preencherComBarras(h, 'SUMI11', barras)
  assert.equal(r.preenchidos, 1)
  assert.deepEqual(r.historico.ativos.SUMI11, [[50, 49, 51, 2e6], null, [77, 76, 78, 500]])
  assert.deepEqual(h.ativos.SUMI11, [null, null, [77, 76, 78, 500]], 'o histórico original não é alterado')
  // fundo totalmente fora do histórico entra com a série alinhada
  const novo = preencherComBarras(h, 'FORA11', [{ data: '2026-10-02', fechamento: 8, minima: 8, maxima: 8, volume: 1e5 }])
  assert.deepEqual(novo.historico.ativos.FORA11, [null, [8, 8, 8, 1e5], null])
  assert.equal(preencherComBarras(h, 'FORA11', []).preenchidos, 0)
})

test('complementar: pede à brapi só os candidatos, respeita o limite, e falha de rede, 429 e falta de token nunca derrubam o job', async () => {
  const universo = new Map([['AAAA11', 'a'], ['BBBB11', 'b'], ['CCCC11', 'c']])
  let h = historicoVazio()
  h = incorporarPregao(h, '2026-10-05', new Map(), universo)
  h = incorporarPregao(h, '2026-10-06', new Map(), universo)
  const urls = []
  const resposta = (corpo, status = 200) => ({ ok: status === 200, status, json: async () => corpo })
  const fetchOk = async (url, opcoes) => {
    urls.push(url)
    assert.match(opcoes.headers.Authorization, /^Bearer segredo$/)
    return resposta(corpoBrapi([{ date: unix('2026-10-06'), close: 20, low: 19, high: 21, volume: 100 }]))
  }
  const logs = []
  const base = { historico: h, token: 'segredo', pausaMs: 0, log: (m) => logs.push(m) }
  const r = await complementarComBrapi({ ...base, candidatos: ['AAAA11', 'BBBB11'], fetchImpl: fetchOk })
  assert.deepEqual(r.completados, ['AAAA11', 'BBBB11'])
  assert.equal(r.requisicoes, 2)
  assert.match(urls[0], /^https:\/\/brapi\.dev\/api\/quote\/AAAA11\?range=3mo&interval=1d$/)
  assert.deepEqual(r.historico.ativos.AAAA11, [null, [20, 19, 21, 2000]])
  // limite de requisições por execução
  const lim = await complementarComBrapi({ ...base, candidatos: ['AAAA11', 'BBBB11', 'CCCC11'], maxRequisicoes: 2, fetchImpl: fetchOk })
  assert.equal(lim.requisicoes, 2)
  assert.ok(logs.some((l) => /além do limite de 2/.test(l)))
  // 429: para sem continuar; erro de rede: segue com o próximo; sem token: nem tenta
  let chamadas = 0
  const r429 = await complementarComBrapi({ ...base, candidatos: ['AAAA11', 'BBBB11'], fetchImpl: async () => (chamadas++, resposta({}, 429)) })
  assert.deepEqual([r429.completados, chamadas], [[], 1])
  const rRede = await complementarComBrapi({ ...base, candidatos: ['AAAA11', 'BBBB11'], fetchImpl: async (u) => { if (u.includes('AAAA11')) throw new Error('rede'); return resposta(corpoBrapi([{ date: unix('2026-10-06'), close: 5, volume: 10 }])) } })
  assert.deepEqual(rRede.completados, ['BBBB11'])
  const rSemToken = await complementarComBrapi({ ...base, token: undefined, candidatos: ['AAAA11'], fetchImpl: async () => { throw new Error('não deveria chamar') } })
  assert.deepEqual([rSemToken.completados, rSemToken.requisicoes], [[], 0])
  assert.ok(logs.some((l) => /BRAPI_TOKEN não definido/.test(l)))
  assert.equal((await complementarComBrapi({ ...base, candidatos: [], fetchImpl: fetchOk })).requisicoes, 0)
})

test('arquivo do histórico guarda a lista dos fundos complementados pela brapi (ordenada, sem repetição)', () => {
  const h = historicoVazio()
  const lido = JSON.parse(formatarHistorico(h, ['MALL11', 'BBPO11', 'MALL11']))
  assert.deepEqual(lido.complementadosPelaBrapi, ['BBPO11', 'MALL11'])
  assert.deepEqual(JSON.parse(formatarHistorico(h)).complementadosPelaBrapi, [])
  assert.deepEqual(JSON.parse(formatarHistorico({ ...h, complementadosPelaBrapi: ['XXXX11'] })).complementadosPelaBrapi, ['XXXX11'])
})

test('datas a processar: no dia a dia, só as que faltam, da mais antiga para a mais nova; na carga inicial, as mais novas primeiro', () => {
  const candidatas = ['2026-10-06', '2026-10-05', '2026-10-02', '2026-10-01']
  assert.deepEqual(datasAProcessar(candidatas, ['2026-10-02', '2026-10-01']), ['2026-10-05', '2026-10-06'])
  assert.deepEqual(datasAProcessar(candidatas, ['2026-10-06']), [])
  assert.deepEqual(datasAProcessar(candidatas, [], true), candidatas)
})

test('precosDoDia (cotação do dia para o app)', async (t) => {
  const dia = (fechamento) => [fechamento, fechamento, fechamento, 1e6]
  const hist = (ativos) => ({ pregoes: ['2026-10-14', '2026-10-15', '2026-10-16'], nomes: {}, ativos })

  await t.test('último fechamento, data e variação do último pregão contra o anterior', () => {
    const p = precosDoDia(hist({ HGLG11: [dia(100), dia(101), dia(102.02)] }))
    assert.equal(p.dataPregao, '2026-10-16')
    assert.deepEqual(p.fundos.HGLG11, [102.02, 1.01, '2026-10-16'])
  })
  await t.test('fundo que não negociou no último pregão mantém o último preço, com a data dele e sem variação', () => {
    const p = precosDoDia(hist({ XPLG11: [dia(10), dia(10.5), null] }))
    assert.deepEqual(p.fundos.XPLG11, [10.5, null, '2026-10-15'])
  })
  await t.test('sem negócio no dia anterior ou salto de desdobramento: sem variação; fundo sem preço some', () => {
    const p = precosDoDia(hist({ AAAA11: [dia(10), null, dia(11)], BBBB11: [dia(100), dia(100), dia(10)], CCCC11: [null, null, null] }))
    assert.equal(p.fundos.AAAA11[1], null)
    assert.equal(p.fundos.BBBB11[1], null)
    assert.equal(p.fundos.CCCC11, undefined)
  })
  await t.test('o arquivo do app é JSON válido, um fundo por linha', () => {
    const p = precosDoDia(hist({ HGLG11: [dia(100), dia(101), dia(102)], XPLG11: [dia(10), dia(10), dia(10)] }))
    const texto = formatarPrecos(p, '2026-10-17T00:00:00.000Z')
    assert.deepEqual(JSON.parse(texto).fundos.XPLG11, [10, 0, '2026-10-16'])
    assert.equal(texto.split('\n').filter((l) => l.includes('11"')).length, 2)
  })
})
