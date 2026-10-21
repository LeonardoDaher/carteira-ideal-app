import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { baixarBoletim } from './b3-boletim.mjs'

const resposta = (corpo) => ({ ok: true, arrayBuffer: async () => corpo.buffer.slice(corpo.byteOffset, corpo.byteOffset + corpo.byteLength) })
const lixo = () => Buffer.alloc(4096, 'x') // maior que o zip vazio da B3, mas não é um zip

test('baixarBoletim: zip corrompido é baixado de novo e, se persistir, o job falha sem gravar nada', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'b3-teste-'))
  let chamadas = 0
  const fetchImpl = async () => {
    chamadas++
    return resposta(lixo())
  }
  await assert.rejects(() => baixarBoletim('2026-10-20', pasta, { fetchImpl, pausaMs: 0, tentativasZip: 3 }))
  assert.equal(chamadas, 3, 'uma tentativa inicial e duas novas')
  assert.deepEqual(fs.readdirSync(pasta), [], 'não deixa arquivo temporário para trás')
  fs.rmSync(pasta, { recursive: true, force: true })
})

test('baixarBoletim: corrompido na primeira vez e zip vazio (dia sem pregão) na segunda devolve null', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'b3-teste-'))
  const respostas = [lixo(), Buffer.alloc(22)]
  const fetchImpl = async () => resposta(respostas.shift())
  assert.equal(await baixarBoletim('2026-10-20', pasta, { fetchImpl, pausaMs: 0 }), null)
  fs.rmSync(pasta, { recursive: true, force: true })
})
