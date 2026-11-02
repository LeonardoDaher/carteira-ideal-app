// Retenção por coorte e pessoas por tela: /api/evento grava e /api/metricas lê, com um Redis falso em memória
// (HyperLogLog simulado por conjuntos, o que dá a mesma contagem de pessoas distintas em volumes pequenos).
import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { carregarTs } from './ts-loader.mjs'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.falso'
process.env.UPSTASH_REDIS_REST_TOKEN = 'x'
delete process.env.ALLOWED_ORIGIN
process.env.METRICAS_TOKEN = 'token-de-teste-bem-longo-123'

const hll = new Map()
const hashes = new Map()
const contagens = new Map()
globalThis.fetch = async (_url, init) => {
  const comandos = JSON.parse(init.body)
  const resultado = comandos.map(([cmd, chave, ...resto]) => {
    switch (cmd) {
      case 'PFADD': (hll.get(chave) ?? hll.set(chave, new Set()).get(chave)).add(resto[0]); return 1
      case 'PFCOUNT': { const u = new Set(); for (const k of [chave, ...resto]) for (const v of hll.get(k) ?? []) u.add(v); return u.size }
      case 'HINCRBY': { const h = hashes.get(chave) ?? hashes.set(chave, new Map()).get(chave); h.set(resto[0], (h.get(resto[0]) ?? 0) + Number(resto[1])); return 1 }
      case 'HGETALL': return [...(hashes.get(chave) ?? new Map())].flat()
      case 'INCR': { const n = (contagens.get(chave) ?? 0) + 1; contagens.set(chave, n); return n }
      default: return 1
    }
  })
  return { ok: true, json: async () => resultado.map((result) => ({ result })) }
}

const { modulos, limpar } = await carregarTs(path.join(RAIZ, 'api'), ['_cors.ts', '_limite.ts', '_eventos.ts', 'evento.ts', 'metricas.ts'])
test.after(() => limpar())
const E = modulos['_eventos.ts']

function resFalsa() {
  const r = { statusCode: null, corpo: undefined }
  r.setHeader = () => {}
  r.status = (c) => { r.statusCode = c; return r }
  r.json = (b) => { r.corpo = b; return r }
  r.end = () => r
  return r
}
const enviar = async (corpo) => {
  const res = resFalsa()
  await modulos['evento.ts'].default({ method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo, socket: { remoteAddress: '203.0.113.9' } }, res)
  return res
}

test('datas de coorte: válidas e somar dias', () => {
  assert.equal(E.dataValida('2026-02-28'), true)
  assert.equal(E.dataValida('2026-02-30'), false)
  assert.equal(E.dataValida('ontem'), false)
  assert.equal(E.somarDias('2026-02-27', 3), '2026-03-02')
})

test('retenção: quem voltou em até 7 dias entra no percentual da coorte fechada', async () => {
  const hoje = E.dataBrasilia()
  const dia = (n) => E.somarDias(hoje, n)
  // Coorte de 10 dias atrás: 4 pessoas chegaram, 1 voltou 3 dias depois.
  for (const id of ['pessoa-aaa1', 'pessoa-aaa2', 'pessoa-aaa3', 'pessoa-aaa4']) hll.set(`rc:${dia(-10)}:${dia(-10)}`, (hll.get(`rc:${dia(-10)}:${dia(-10)}`) ?? new Set()).add(id))
  hll.set(`rc:${dia(-10)}:${dia(-7)}`, new Set(['pessoa-aaa1']))
  // Hoje: 2 chegam pela primeira vez e 1 da coorte antiga volta (via endpoint de verdade), mas no 10º dia,
  // fora da janela de 7 dias: não entra no percentual de 7 dias.
  assert.equal((await enviar({ evento: 'visita', id: 'pessoa-bbb1', coorte: hoje })).statusCode, 204)
  assert.equal((await enviar({ evento: 'visita', id: 'pessoa-bbb2', coorte: hoje })).statusCode, 204)
  assert.equal((await enviar({ evento: 'visita', id: 'pessoa-aaa2', coorte: dia(-10) })).statusCode, 204)
  // Coorte futura é ignorada
  await enviar({ evento: 'visita', id: 'pessoa-ccc1', coorte: dia(5) })
  assert.equal(hll.has(`rc:${dia(5)}:${hoje}`), false)

  const res = resFalsa()
  await modulos['metricas.ts'].default({ method: 'GET', headers: { authorization: 'Bearer token-de-teste-bem-longo-123' }, query: { dias: '30' }, socket: { remoteAddress: '203.0.113.10' } }, res)
  assert.equal(res.statusCode, 200)
  const ret = res.corpo.retencao
  assert.deepEqual(ret.voltaramEmAte7Dias, { base: 4, voltaram: 1, percentual: 25 })
  assert.equal(ret.voltaramEmAte30Dias.percentual, null, 'nenhuma coorte tem 30 dias ainda')
  const antiga = ret.coortes.find((c) => c.coorte === dia(-10))
  assert.equal(antiga.novos, 4)
  const nova = ret.coortes.find((c) => c.coorte === hoje)
  assert.equal(nova.novos, 2)
  assert.equal(nova.voltaram7, 0)
})

test('pessoas por tela: conta pessoas distintas só das telas conhecidas', async () => {
  await enviar({ evento: 'tela_vista', id: 'pessoa-ddd1', props: { tela: 'meuMes' } })
  await enviar({ evento: 'tela_vista', id: 'pessoa-ddd1', props: { tela: 'meuMes' } })
  await enviar({ evento: 'tela_vista', id: 'pessoa-ddd2', props: { tela: 'meuMes' } })
  await enviar({ evento: 'tela_vista', id: 'pessoa-ddd2', props: { tela: 'telaInventada' } })
  const res = resFalsa()
  await modulos['metricas.ts'].default({ method: 'GET', headers: { authorization: 'Bearer token-de-teste-bem-longo-123' }, query: { dias: '7' }, socket: { remoteAddress: '203.0.113.11' } }, res)
  assert.equal(res.corpo.pessoasPorTela.meuMes, 2)
  assert.equal(res.corpo.pessoasPorTela.telaInventada, undefined)
})

test('novos eventos são aceitos', async () => {
  assert.equal((await enviar({ evento: 'app_instalado', id: 'pessoa-eee1' })).statusCode, 204)
  assert.equal((await enviar({ evento: 'alerta_ativado', id: 'pessoa-eee1' })).statusCode, 204)
  assert.equal((await enviar({ evento: 'nao_existe', id: 'pessoa-eee1' })).statusCode, 400)
})
