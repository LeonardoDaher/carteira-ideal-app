// Ações só da tela (D136): ON (final 3) de empresas do cadastro e empresas que só tinham o código na busca.
// Elas entram na lista por setor, nas séries, nos fundamentos e nos balanços, mas NÃO mudam o universo dos rankings Top 15.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { montarCadastro } from './atualizar-acoes.mjs'
import { empresasDoCadastro as universoDeValor } from './atualizar-acoes-baratas.mjs'
import { empresasDoCadastro as universoDeDividendos } from './atualizar-acoes-dividendos.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(fs.readFileSync(path.join(raiz, 'config', 'acoes.json'), 'utf8'))
const todas = config.setores.flatMap((s) => s.empresas.map((e) => ({ ...e, setor: s.setor })))
const extras = todas.filter((e) => e.extra)

test('cadastro: BBDC3, ITUB3, PETR3 e CMIG3 estão na lista, no mesmo setor da outra classe', () => {
  const cadastro = montarCadastro(config)
  for (const [on, outra] of [['BBDC3', 'BBDC4'], ['ITUB3', 'ITUB4'], ['PETR3', 'PETR4'], ['CMIG3', 'CMIG4']]) {
    assert.ok(cadastro.has(on), `${on} fora do cadastro`)
    assert.equal(cadastro.get(on).setor, cadastro.get(outra).setor)
  }
})

test('cadastro: todo extra é código de ação ON ou PN e não repete', () => {
  assert.ok(extras.length >= 100)
  const vistos = new Set()
  for (const e of extras) {
    assert.match(e.ticker, /^[A-Z]{4}[34]$/, e.ticker)
    assert.ok(!vistos.has(e.ticker), `${e.ticker} repetido`)
    vistos.add(e.ticker)
  }
})

test('cadastro: SAPR4 está na lista, no setor da Sanepar (D141)', () => {
  const cadastro = montarCadastro(config)
  assert.equal(cadastro.get('SAPR4').setor, cadastro.get('SAPR11').setor)
  assert.equal(todas.find((e) => e.ticker === 'SAPR4').extra, true)
})

test('dividendos: os extras ficam fora do ranking, mas entram na lista só do DY de 12 meses (D141)', () => {
  const historico = { pregoes: ['2026-10-30'], ativos: {}, ultimoNegocio: {} }
  const { empresas, somenteDy } = universoDeDividendos({ cadastro: config, historico, cfg: { sessoesLiquidez: 21 } })
  assert.ok(!empresas.some((e) => e.ticker === 'SAPR4'))
  assert.deepEqual(somenteDy.map((e) => e.ticker), extras.map((e) => e.ticker))
})

test('rankings: o universo da triagem de valor e o dos dividendos não mudam com os extras', () => {
  const originais = todas.filter((e) => !e.extra).map((e) => e.ticker)
  assert.deepEqual(universoDeValor(config).map((e) => e.ticker), originais)
  const historico = { pregoes: ['2026-10-30'], ativos: {}, ultimoNegocio: {} }
  const { empresas } = universoDeDividendos({ cadastro: config, historico, cfg: { sessoesLiquidez: 21 } })
  assert.deepEqual(empresas.map((e) => e.ticker), originais)
})

test('fundamentos e balanços: pedem os extras e recebem a marca', () => {
  const com = universoDeValor(config, { incluirExtras: true })
  assert.equal(com.length, todas.length)
  assert.equal(com.find((e) => e.ticker === 'BBDC3').extra, true)
  assert.equal(com.find((e) => e.ticker === 'BBDC4').extra, undefined)
})
