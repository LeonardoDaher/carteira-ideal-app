import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { carregarTs } from './ts-loader.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { modulos, limpar } = await carregarTs(path.join(RAIZ, 'api'), ['_limite.ts'])
test.after(() => limpar())
const L = modulos['_limite.ts']

test('chave: só hash do IP, com sal, nunca o IP', () => {
  const k = L.chaveDeChamadas('203.0.113.7', 'sal')
  assert.match(k, /^recomendacao:chamadas:[0-9a-f]{24}$/)
  assert.ok(!k.includes('203') && !k.includes('113'))
  assert.notEqual(L.chaveDeChamadas('203.0.113.7', 'outro-sal'), k)
  assert.notEqual(L.chaveDeChamadas('203.0.113.8', 'sal'), k)
})

test('limite: 60 chamadas passam, a 61ª trava; outro IP não é afetado; a janela vence em 15 minutos e conta da primeira chamada', async () => {
  assert.equal([L.MAX_CHAMADAS, L.JANELA_CHAMADAS_SEGUNDOS].join(), '60,900')
  let agora = 1_000_000
  const c = L.contadorEmMemoria(() => agora)
  for (let i = 1; i <= 60; i++) assert.equal(await L.passouDoLimite(c, 'a'), false, `chamada ${i}`)
  assert.equal(await L.passouDoLimite(c, 'a'), true, '61ª chamada')
  assert.equal(await L.passouDoLimite(c, 'a'), true)
  assert.equal(await L.passouDoLimite(c, 'b'), false, 'outro IP')
  agora += 899_000
  assert.equal(await L.passouDoLimite(c, 'a'), true, 'ainda dentro da janela, que não é renovada a cada chamada')
  agora += 2_000
  assert.equal(await L.passouDoLimite(c, 'a'), false, 'janela vencida: recomeça')
})

test('falha aberta: erro na contagem nunca bloqueia a chamada', async () => {
  const quebrado = { incrementar: async () => { throw new Error('Redis fora') } }
  assert.equal(await L.passouDoLimite(quebrado, 'a'), false)
})

test('Redis: INCR + EXPIRE NX numa ida só; se o Redis falhar, a reserva em memória continua contando', async () => {
  const enviados = []
  const redis = L.contadorRedis(async (cmds) => { enviados.push(cmds); return [7, 1] })
  assert.equal(await redis.incrementar('k', 900), 7)
  assert.deepEqual(enviados[0], [['INCR', 'k'], ['EXPIRE', 'k', 900, 'NX']])

  const fora = { incrementar: async () => { throw new Error('Redis fora') } }
  const c = L.contadorComReserva(fora, L.contadorEmMemoria())
  for (let i = 0; i < 61; i++) await c.incrementar('k', 900)
  assert.equal(await L.passouDoLimite(c, 'k'), true, 'com o Redis fora, a reserva ainda limita')
  // com o Redis ativo, vale o maior entre os dois (instâncias diferentes da função compartilham o Redis)
  const alto = { incrementar: async () => 59 }
  assert.equal(await L.contadorComReserva(alto, L.contadorEmMemoria()).incrementar('x', 900), 59)
})
