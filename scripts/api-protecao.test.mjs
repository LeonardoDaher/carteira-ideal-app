// Proteção da API (D85): origens permitidas (CORS), limite do /api/evento e token do painel de métricas.
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { carregarTs } from './ts-loader.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Sem credenciais do Redis o módulo usa a contagem em memória, e as métricas ficam desligadas.
delete process.env.UPSTASH_REDIS_REST_URL
delete process.env.UPSTASH_REDIS_REST_TOKEN
delete process.env.KV_REST_API_URL
delete process.env.KV_REST_API_TOKEN
delete process.env.ALLOWED_ORIGIN
process.env.METRICAS_TOKEN = 'token-de-teste-bem-longo-123'

const { modulos, limpar } = await carregarTs(path.join(RAIZ, 'api'), ['_cors.ts', '_limite.ts', 'recomendacao.ts', 'evento.ts', 'metricas.ts'])
test.after(() => limpar())
const C = modulos['_cors.ts']
const L = modulos['_limite.ts']

function resFalsa() {
  const r = { statusCode: null, cabecalhos: {}, corpo: undefined }
  r.setHeader = (k, v) => { r.cabecalhos[k.toLowerCase()] = v }
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.corpo = b; return r }
  r.end = () => r
  return r
}
const req = ({ metodo = 'POST', origin, ip = '203.0.113.9', corpo, headers = {} } = {}) => ({
  method: metodo,
  headers: { 'x-forwarded-for': ip, ...(origin ? { origin } : {}), ...headers },
  body: corpo,
  socket: { remoteAddress: ip },
})

test('origens permitidas: padrão é o domínio definitivo (com e sem www); a variável substitui a lista', () => {
  assert.deepEqual(C.origensPermitidas(undefined), ['https://carteiraideal.app.br', 'https://www.carteiraideal.app.br'])
  assert.deepEqual(C.origensPermitidas(''), ['https://carteiraideal.app.br', 'https://www.carteiraideal.app.br'])
  assert.deepEqual(C.origensPermitidas('https://a.com/, https://b.com'), ['https://a.com', 'https://b.com'])
  assert.deepEqual(C.origensPermitidas('*'), ['*'])
})

test('aplicarCors: origem permitida é ecoada; sem Origin segue sem cabeçalho de origem; origem estranha é barrada', () => {
  let r = resFalsa()
  assert.equal(C.aplicarCors(req({ origin: 'https://carteiraideal.app.br' }), r), true)
  assert.equal(r.cabecalhos['access-control-allow-origin'], 'https://carteiraideal.app.br')
  assert.equal(r.cabecalhos.vary, 'Origin')

  r = resFalsa()
  assert.equal(C.aplicarCors(req({ origin: 'https://www.carteiraideal.app.br/' }), r), true)
  assert.equal(r.cabecalhos['access-control-allow-origin'], 'https://www.carteiraideal.app.br')

  r = resFalsa()
  assert.equal(C.aplicarCors(req(), r), true)
  assert.equal(r.cabecalhos['access-control-allow-origin'], undefined)

  r = resFalsa()
  assert.equal(C.aplicarCors(req({ origin: 'https://site-estranho.example' }), r), false)
  assert.equal(r.cabecalhos['access-control-allow-origin'], undefined)
  assert.equal(r.cabecalhos['access-control-allow-methods'], undefined)

  // parecido, mas diferente: subdomínio e prefixo não valem
  for (const o of ['https://carteiraideal.app.br.evil.com', 'https://evil.carteiraideal.app.br', 'http://carteiraideal.app.br']) {
    assert.equal(C.aplicarCors(req({ origin: o }), resFalsa()), false, o)
  }
})

test('aplicarCors: ALLOWED_ORIGIN="*" libera de forma explícita; lista própria vale no lugar da padrão', () => {
  let r = resFalsa()
  assert.equal(C.aplicarCors(req({ origin: 'https://qualquer.com' }), r, '*'), true)
  assert.equal(r.cabecalhos['access-control-allow-origin'], '*')

  r = resFalsa()
  assert.equal(C.aplicarCors(req({ origin: 'https://carteiraideal.app.br' }), r, 'https://outro.com'), false)
  assert.equal(C.aplicarCors(req({ origin: 'https://outro.com' }), resFalsa(), 'https://outro.com'), true)
})

test('recomendacao: origem estranha recebe 403 (inclusive no preflight); a do próprio site passa até a validação', async () => {
  const { default: handler } = modulos['recomendacao.ts']
  let r = resFalsa()
  await handler(req({ origin: 'https://site-estranho.example', corpo: {} }), r)
  assert.equal(r.statusCode, 403)
  assert.equal(r.cabecalhos['access-control-allow-origin'], undefined)

  r = resFalsa()
  await handler(req({ metodo: 'OPTIONS', origin: 'https://site-estranho.example' }), r)
  assert.equal(r.statusCode, 403)

  r = resFalsa()
  await handler(req({ origin: 'https://carteiraideal.app.br', corpo: {} }), r)
  assert.equal(r.statusCode, 400) // passou pelo CORS e caiu na validação do corpo
  assert.equal(r.cabecalhos['access-control-allow-origin'], 'https://carteiraideal.app.br')

  r = resFalsa()
  await handler(req({ metodo: 'OPTIONS', origin: 'https://carteiraideal.app.br' }), r)
  assert.equal(r.statusCode, 204)
})

test('evento: origem estranha recebe 403; do próprio site, 204; a chave do limite é separada da da recomendação', async () => {
  const { default: handler } = modulos['evento.ts']
  let r = resFalsa()
  await handler(req({ origin: 'https://site-estranho.example', corpo: { evento: 'x' } }), r)
  assert.equal(r.statusCode, 403)

  r = resFalsa()
  await handler(req({ origin: 'https://carteiraideal.app.br', corpo: { evento: 'x' } }), r)
  assert.equal(r.statusCode, 204) // métricas desligadas neste teste

  const a = L.chaveDeChamadas('203.0.113.9', 'sal')
  const b = L.chaveDeChamadas('203.0.113.9', 'sal', 'evento:chamadas')
  assert.match(b, /^evento:chamadas:[0-9a-f]{24}$/)
  assert.notEqual(a, b)
})

test('metricas: sem token ou com token errado (de qualquer tamanho) é 401; token certo passa (503 sem Redis)', async () => {
  const { default: handler } = modulos['metricas.ts']
  const com = (t, ip) => req({ metodo: 'GET', ip, headers: t === undefined ? {} : { authorization: `Bearer ${t}` } })
  let r = resFalsa()
  await handler(com(undefined, '198.51.100.1'), r)
  assert.equal(r.statusCode, 401)

  for (const t of ['x', 'token-de-teste-bem-longo-124', 'token-de-teste-bem-longo-123-extra', '']) {
    r = resFalsa()
    await handler(com(t, '198.51.100.1'), r)
    assert.equal(r.statusCode, 401, `token "${t}"`)
  }

  r = resFalsa()
  await handler(com('token-de-teste-bem-longo-123', '198.51.100.2'), r)
  assert.equal(r.statusCode, 503) // autorizado; o banco de métricas não está configurado no teste
})

test('metricas: depois de 30 tentativas do mesmo IP vem 429, mesmo com o token certo; outro IP não é afetado', async () => {
  const { default: handler } = modulos['metricas.ts']
  const com = (t, ip) => req({ metodo: 'GET', ip, headers: { authorization: `Bearer ${t}` } })
  for (let i = 1; i <= 30; i++) {
    const r = resFalsa()
    await handler(com('errado', '198.51.100.50'), r)
    assert.equal(r.statusCode, 401, `tentativa ${i}`)
  }
  let r = resFalsa()
  await handler(com('errado', '198.51.100.50'), r)
  assert.equal(r.statusCode, 429)
  assert.ok(r.cabecalhos['retry-after'])

  r = resFalsa()
  await handler(com('token-de-teste-bem-longo-123', '198.51.100.50'), r)
  assert.equal(r.statusCode, 429, 'o token certo também espera a janela depois de muitas tentativas')

  r = resFalsa()
  await handler(com('token-de-teste-bem-longo-123', '198.51.100.99'), r)
  assert.equal(r.statusCode, 503)
})
