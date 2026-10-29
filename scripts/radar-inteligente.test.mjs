// Radar de dividendos inteligente (D132): padrão de meses, montagem do arquivo e trava. Sem rede.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { montarRadarInteligente, padraoDeMeses, verificarSanidadeInteligente } from './radar-inteligente-calculo.mjs'
import { gerarRadarInteligente } from './atualizar-radar-inteligente.mjs'

const ev = (dataCom, o = {}) => ({ classe: 'ON', tipo: 'DIVIDENDO', valor: 0.5, dataCom, ...o })
const HOJE = '2026-10-29'

test('padraoDeMeses: conta em quantos dos últimos 3 anos fechados houve data com em cada mês', () => {
  const eventos = [ev('2025-03-10'), ev('2024-03-12'), ev('2023-03-15'), ev('2025-08-01'), ev('2022-03-10'), ev('2026-03-10')]
  const p = padraoDeMeses(eventos, 'PETR3', HOJE)
  assert.equal(p.meses[2], 3) // março: 2023, 2024, 2025 (2022 e 2026 ficam fora da janela)
  assert.equal(p.meses[7], 1) // agosto: só 2025
  assert.equal(p.meses.reduce((a, b) => a + b, 0), 4)
  assert.equal(p.primeiroAno, 2022)
  assert.equal(p.anosComHistorico, 3)
})

test('padraoDeMeses: parcelas na mesma data com contam uma vez; classe e tipo errados ficam fora', () => {
  const eventos = [ev('2025-05-10'), ev('2025-05-10'), ev('2025-05-10', { classe: 'PN' }), ev('2025-06-10', { tipo: 'REST CAP DIN' }), ev('2025-07-10', { tipo: 'JRS CAP PROPRIO' })]
  const p = padraoDeMeses(eventos, 'PETR3', HOJE)
  assert.deepEqual(p.meses, [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0])
})

test('padraoDeMeses: empresa nova tem poucos anos de histórico', () => {
  const p = padraoDeMeses([ev('2025-11-10')], 'PETR3', HOJE)
  assert.equal(p.anosComHistorico, 1)
  assert.equal(padraoDeMeses([], 'PETR3', HOJE).primeiroAno, null)
})

test('montarRadarInteligente: só empresas com algum padrão, em ordem de código', () => {
  const r = montarRadarInteligente({
    hoje: HOJE, falhas: ['ZZZZ3'],
    empresas: [
      { ticker: 'VALE3', nome: 'Vale', setor: 'Mineração', eventos: [ev('2025-03-10')] },
      { ticker: 'ABCD3', nome: 'Abcd', setor: 'X', eventos: [ev('2020-03-10')] }, // fora da janela: sem padrão
      { ticker: 'PETR3', nome: 'Petrobras', setor: 'Petróleo', eventos: [ev('2025-02-10')] },
    ],
  })
  assert.deepEqual(r.empresas.map((e) => e.ticker), ['PETR3', 'VALE3'])
  assert.equal(r.consultadas, 4)
  assert.deepEqual(r.falhas, ['ZZZZ3'])
  assert.equal(r.minimoDeAnos, 2)
})

test('verificarSanidadeInteligente: poucas empresas ou muitas falhas travam', () => {
  const ok = { empresas: new Array(30).fill({}), consultadas: 40, falhas: [] }
  assert.deepEqual(verificarSanidadeInteligente(ok), [])
  assert.equal(verificarSanidadeInteligente({ ...ok, empresas: [] }).length, 1)
  assert.equal(verificarSanidadeInteligente({ ...ok, falhas: new Array(20).fill('A') }).length, 1)
})

test('gerarRadarInteligente: uma chamada por código e falha isolada não derruba', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-int-'))
  fs.mkdirSync(path.join(raiz, 'config'))
  fs.writeFileSync(path.join(raiz, 'config', 'acoes.json'), JSON.stringify({ setores: [{ setor: 'S', empresas: [{ ticker: 'PETR4', nome: 'Petrobras' }, { ticker: 'PETR3' }, { ticker: 'ERRO3' }] }] }))
  const chamadas = []
  const baixar = async (cod) => {
    chamadas.push(cod)
    if (cod === 'ERRO') throw new Error('HTTP 500')
    return { eventos: [ev('2025-03-10', { classe: 'PN' })], historicoDisponivel: true }
  }
  const r = await gerarRadarInteligente({ raiz, baixar, hoje: HOJE, pausaMs: 0, log: () => {} })
  assert.deepEqual(chamadas, ['PETR', 'ERRO'])
  assert.deepEqual(r.empresas.map((e) => e.ticker), ['PETR4'])
  assert.deepEqual(r.falhas, ['ERRO3'])
})
