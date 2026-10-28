// Testes do aviso de preço teto com o app fechado (D127): validação do pedido, as duas funções da API, o núcleo do job
// (scripts/avisar-preco-teto.mjs) e uma rodada com os dados reais publicados. Redis e envio são falsos: nada sai da máquina.
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { carregarTs } from './ts-loader.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'ALLOWED_ORIGIN', 'VAPID_PUBLIC_KEY']) delete process.env[k]
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.falso'
process.env.UPSTASH_REDIS_REST_TOKEN = 'token-falso'

// Redis falso na memória, atrás do mesmo endpoint REST que o código usa (/pipeline).
const banco = new Map()
const conjuntos = new Map()
function comando([nome, ...a]) {
  switch (nome) {
    case 'GET': return banco.get(a[0]) ?? null
    case 'MGET': return a.map((k) => banco.get(k) ?? null)
    case 'SET': banco.set(a[0], a[1]); return 'OK'
    case 'DEL': return banco.delete(a[0]) ? 1 : 0
    case 'SADD': { const s = conjuntos.get(a[0]) ?? new Set(); s.add(a[1]); conjuntos.set(a[0], s); return 1 }
    case 'SREM': return conjuntos.get(a[0])?.delete(a[1]) ? 1 : 0
    case 'SMEMBERS': return [...(conjuntos.get(a[0]) ?? [])]
    case 'INCR': { const n = Number(banco.get(a[0]) ?? 0) + 1; banco.set(a[0], String(n)); return n }
    case 'EXPIRE': return 1
    default: throw new Error(`comando não simulado: ${nome}`)
  }
}
globalThis.fetch = async (_url, init) => {
  const lista = JSON.parse(init.body)
  return { ok: true, status: 200, json: async () => lista.map((c) => ({ result: comando(c) })) }
}

const api = await carregarTs(path.join(RAIZ, 'api'), ['_push.ts', 'push-chave.ts', 'push-inscrever.ts', '_redis.ts'])
const dom = await carregarTs(path.join(RAIZ, 'webapp-src', 'src'), ['domain/precoTetoLote.ts'])
test.after(async () => { await api.limpar(); await dom.limpar() })

const push = api.modulos['_push.ts']
const { default: chaveHandler } = api.modulos['push-chave.ts']
const { default: inscreverHandler } = api.modulos['push-inscrever.ts']
const { pipeline } = api.modulos['_redis.ts']
const { avisoDoAparelho, calcularItensPrecoTeto, mapaDePrecos, premissasDoSnapshotMercado } = dom.modulos['domain/precoTetoLote.ts']
const { executar } = await import('./avisar-preco-teto.mjs')

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123'
const CHAVES = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' }
const pedido = (extra = {}) => ({ inscricao: { endpoint: ENDPOINT, keys: CHAVES }, tickers: ['CMIG4', 'BBAS3'], taxa: 0.06, ...extra })

function resFalsa() {
  const r = { statusCode: null, cabecalhos: {}, corpo: undefined }
  r.setHeader = (k, v) => { r.cabecalhos[k.toLowerCase()] = v }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.corpo = b; return r }
  r.end = () => r
  return r
}
let ipN = 0
async function chamar(handler, { metodo = 'POST', corpo } = {}) {
  const r = resFalsa()
  await handler({ method: metodo, headers: { 'x-forwarded-for': `203.0.113.${(ipN += 1)}` }, body: corpo, socket: { remoteAddress: '1.1.1.1' } }, r)
  return r
}

test('só aceita endereços dos serviços de push dos navegadores (nada de SSRF)', () => {
  for (const ok of [ENDPOINT, 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/Q', 'https://wns2-par02p.notify.windows.com/w/?token=x']) {
    assert.equal(push.hostDePushValido(ok), true, ok)
  }
  for (const ruim of ['http://fcm.googleapis.com/x', 'https://exemplo.com/x', 'https://fcm.googleapis.com.evil.com/x', 'https://127.0.0.1/x', 'https://fcm.googleapis.com:8443/x', 'https://u:p@fcm.googleapis.com/x', 'javascript:alert(1)', '', null, 42]) {
    assert.equal(push.hostDePushValido(ruim), false, String(ruim))
  }
})

test('validarPedido: aceita o pedido bom e recusa códigos, taxa e chaves fora do padrão', () => {
  assert.equal(push.validarPedido(pedido()).ok, true)
  assert.equal(push.validarPedido(pedido({ tickers: ['bbas3'] })).ok, false)
  assert.equal(push.validarPedido(pedido({ tickers: ['<script>'] })).ok, false)
  assert.equal(push.validarPedido(pedido({ tickers: Array.from({ length: 61 }, (_, i) => `ABCD${i % 10}`) })).ok, false)
  assert.equal(push.validarPedido(pedido({ taxa: 0.5 })).ok, false)
  assert.equal(push.validarPedido(pedido({ inscricao: { endpoint: ENDPOINT, keys: { p256dh: '!!', auth: CHAVES.auth } } })).ok, false)
  assert.deepEqual(push.validarPedido(pedido({ tickers: ['CMIG4', 'CMIG4'] })).pedido.tickers, ['CMIG4'])
})

test('GET /api/push-chave: 503 sem a variável e 200 com a chave pública', async () => {
  assert.equal((await chamar(chaveHandler, { metodo: 'GET' })).statusCode, 503)
  process.env.VAPID_PUBLIC_KEY = 'BChavePublicaDeTeste'
  const r = await chamar(chaveHandler, { metodo: 'GET' })
  assert.equal(r.statusCode, 200)
  assert.deepEqual(r.corpo, { chave: 'BChavePublicaDeTeste' })
  assert.equal((await chamar(chaveHandler, { metodo: 'POST' })).statusCode, 405)
})

test('POST /api/push-inscrever: grava o aparelho, mantém quem já foi avisado e DELETE apaga', async () => {
  const id = push.idDoEndpoint(ENDPOINT)
  assert.equal((await chamar(inscreverHandler, { corpo: pedido({ avisados: ['CMIG4'] }) })).statusCode, 204)
  let reg = JSON.parse(banco.get(push.chaveDoAparelho(id)))
  assert.deepEqual(reg.tickers, ['CMIG4', 'BBAS3'])
  assert.deepEqual(reg.avisados, ['CMIG4'])
  assert.ok(conjuntos.get(push.CHAVE_INDICE).has(id))

  // Segunda chamada: o servidor manda no que já avisou (ignora o `avisados` do aparelho) e descarta quem saiu da lista.
  await chamar(inscreverHandler, { corpo: pedido({ tickers: ['BBAS3'], avisados: [] }) })
  reg = JSON.parse(banco.get(push.chaveDoAparelho(id)))
  assert.deepEqual(reg.tickers, ['BBAS3'])
  assert.deepEqual(reg.avisados, [])

  assert.equal((await chamar(inscreverHandler, { metodo: 'DELETE', corpo: { inscricao: { endpoint: ENDPOINT } } })).statusCode, 204)
  assert.equal(banco.has(push.chaveDoAparelho(id)), false)
  assert.equal(conjuntos.get(push.CHAVE_INDICE).has(id), false)
})

test('POST /api/push-inscrever recusa pedido inválido e método errado', async () => {
  assert.equal((await chamar(inscreverHandler, { corpo: { inscricao: { endpoint: 'https://exemplo.com/x', keys: CHAVES }, tickers: [], taxa: 0.06 } })).statusCode, 400)
  assert.equal((await chamar(inscreverHandler, { metodo: 'GET' })).statusCode, 405)
})

// ---------- núcleo do job ----------

function itemFalso(ticker, status, extra = {}) {
  return { ticker, status, mensagem: `${ticker} abaixo do teto.`, ressalva: null, ...extra }
}
const mapa = (...itens) => new Map(itens.map((i) => [i.ticker, i]))

async function cadastrar(ticker, extra = {}) {
  const endpoint = `https://fcm.googleapis.com/fcm/send/${ticker}`
  const id = push.idDoEndpoint(endpoint)
  const reg = { inscricao: { endpoint, keys: CHAVES }, tickers: [ticker], taxa: 0.06, avisados: [], atualizadoEm: 'x', ...extra }
  banco.set(push.chaveDoAparelho(id), JSON.stringify(reg))
  conjuntos.set(push.CHAVE_INDICE, (conjuntos.get(push.CHAVE_INDICE) ?? new Set()).add(id))
  return id
}
const limparBanco = () => { banco.clear(); conjuntos.clear() }
const rodar = (opcoes) => executar({ redis: pipeline, avisoDoAparelho, hostValido: push.hostDePushValido, ...opcoes })

test('job: avisa quem entrou abaixo do teto, uma vez só, e volta a avisar se sair e entrar de novo', async () => {
  limparBanco()
  const id = await cadastrar('AAAA3')
  const enviados = []
  const enviar = async (_ins, payload) => { enviados.push(payload); return 201 }
  let itens = mapa(itemFalso('AAAA3', 'abaixo-do-teto'))

  let r = await rodar({ calcular: () => itens, enviar })
  assert.equal(r.enviados, 1)
  assert.equal(enviados[0].titulo, 'AAAA3 abaixo do preço teto')
  assert.deepEqual(JSON.parse(banco.get(push.chaveDoAparelho(id))).avisados, ['AAAA3'])

  r = await rodar({ calcular: () => itens, enviar })
  assert.equal(r.enviados, 0, 'não repete o aviso')

  itens = mapa(itemFalso('AAAA3', 'aguardando'))
  await rodar({ calcular: () => itens, enviar })
  assert.deepEqual(JSON.parse(banco.get(push.chaveDoAparelho(id))).avisados, [], 'saiu da zona: some da lista')

  itens = mapa(itemFalso('AAAA3', 'abaixo-do-teto'))
  r = await rodar({ calcular: () => itens, enviar })
  assert.equal(r.enviados, 1, 'entrou de novo: avisa de novo')
})

test('job: falha de envio não marca como avisado; endereço morto (410) apaga o aparelho', async () => {
  limparBanco()
  const id = await cadastrar('BBBB3')
  const itens = mapa(itemFalso('BBBB3', 'abaixo-do-teto'))
  let r = await rodar({ calcular: () => itens, enviar: async () => 500 })
  assert.equal(r.falhas, 1)
  assert.deepEqual(JSON.parse(banco.get(push.chaveDoAparelho(id))).avisados, [], 'tenta de novo na próxima')

  r = await rodar({ calcular: () => itens, enviar: async () => { const e = new Error('gone'); e.statusCode = 410; throw e } })
  assert.equal(r.removidos, 1)
  assert.equal(banco.has(push.chaveDoAparelho(id)), false)
  assert.equal(conjuntos.get(push.CHAVE_INDICE).has(id), false)
})

test('job: vários de uma vez viram uma só notificação; registro vencido sai do índice; endereço inválido é descartado', async () => {
  limparBanco()
  const id = await cadastrar('CCCC3', { tickers: ['CCCC3', 'DDDD3'] })
  conjuntos.get(push.CHAVE_INDICE).add('fantasma') // sem registro (expirou)
  await cadastrar('EEEE3', { inscricao: { endpoint: 'https://exemplo.com/x', keys: CHAVES } })
  const enviados = []
  const itens = mapa(itemFalso('CCCC3', 'abaixo-do-teto'), itemFalso('DDDD3', 'abaixo-do-teto'))
  const r = await rodar({ calcular: () => itens, enviar: async (_i, p) => { enviados.push(p); return 201 } })
  assert.equal(enviados.length, 1)
  assert.match(enviados[0].titulo, /2 ações abaixo do preço teto/)
  assert.equal(r.removidos, 2)
  assert.equal(conjuntos.get(push.CHAVE_INDICE).has('fantasma'), false)
  assert.deepEqual(JSON.parse(banco.get(push.chaveDoAparelho(id))).avisados.sort(), ['CCCC3', 'DDDD3'])
})

test('job: --simular não envia nem grava; --teste manda o aviso de teste sem mexer em quem foi avisado', async () => {
  limparBanco()
  const id = await cadastrar('FFFF3')
  const itens = mapa(itemFalso('FFFF3', 'abaixo-do-teto'))
  let n = 0
  await rodar({ calcular: () => itens, enviar: async () => { n++; return 201 }, modo: 'simular' })
  assert.equal(n, 0)
  assert.deepEqual(JSON.parse(banco.get(push.chaveDoAparelho(id))).avisados, [])
  const enviados = []
  await rodar({ calcular: () => itens, enviar: async (_i, p) => { enviados.push(p); return 201 }, modo: 'teste' })
  assert.match(enviados[0].titulo, /Teste/)
  assert.deepEqual(JSON.parse(banco.get(push.chaveDoAparelho(id))).avisados, [])
})

test('job: sem aparelhos inscritos não faz nada', async () => {
  limparBanco()
  const r = await rodar({ calcular: () => { throw new Error('não deveria calcular') }, enviar: async () => 201 })
  assert.equal(r.aparelhos, 0)
})

// ---------- dados reais ----------

test('com os dados publicados, o cálculo do job roda e produz o mesmo tipo de resultado da tela', async () => {
  const { readFileSync } = await import('node:fs')
  const lerJson = (rel) => JSON.parse(readFileSync(path.join(RAIZ, rel), 'utf8'))
  const fundamentos = lerJson('webapp-src/public/dados/fundamentos.json')
  const precoDe = mapaDePrecos(lerJson('webapp-src/src/data/acoes.json'))
  const dy = lerJson('webapp-src/src/data/acoesDividendos.json').dyPorTicker ?? {}
  const premissas = premissasDoSnapshotMercado(lerJson('webapp-src/src/data/mercadoOficial.json'))
  const itens = calcularItensPrecoTeto({ fundamentos, precoDe, premissas, dyDe: (t) => dy[t] ?? null, taxa: 0.06 })
  assert.ok(itens.size > 100, `só ${itens.size} ações calculadas`)
  const verdes = [...itens.values()].filter((i) => i.status === 'abaixo-do-teto')
  // Quem está verde e ainda não foi avisado recebe o aviso; quem já foi avisado não.
  const todos = verdes.map((i) => i.ticker)
  const novo = avisoDoAparelho(itens, { tickers: todos, taxa: 0.06, avisados: [] })
  assert.equal(novo.aviso === null, todos.length === 0)
  const jaAvisado = avisoDoAparelho(itens, { tickers: todos, taxa: 0.06, avisados: todos })
  assert.equal(jaAvisado.aviso, null)
})
