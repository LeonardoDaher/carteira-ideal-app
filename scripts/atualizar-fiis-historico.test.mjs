import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { datasAProcessar, historicoVazio, incorporarPregao } from './atualizar-etfs.mjs'
import { formatarHistorico, universoDosFiis, ultimosPregoes } from './atualizar-fiis-historico.mjs'

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

test('datas a processar: no dia a dia, só as que faltam, da mais antiga para a mais nova; na carga inicial, as mais novas primeiro', () => {
  const candidatas = ['2026-10-06', '2026-10-05', '2026-10-02', '2026-10-01']
  assert.deepEqual(datasAProcessar(candidatas, ['2026-10-02', '2026-10-01']), ['2026-10-05', '2026-10-06'])
  assert.deepEqual(datasAProcessar(candidatas, ['2026-10-06']), [])
  assert.deepEqual(datasAProcessar(candidatas, [], true), candidatas)
})
