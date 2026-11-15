import test from 'node:test'
import assert from 'node:assert/strict'
import { acoesPorEmpresa, enriquecer, ibovNaJanela, precoEVolume } from './aluguel-preco.mjs'

// 25 pregões; a série da ação começa 2 pregões depois (alinhada pela direita)
const pregoes = Array.from({ length: 25 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`)
const serie = Array.from({ length: 23 }, (_, i) => [100 + i, 0, 0, 1000]) // fecha 100..122, volume R$ 1.000 mil
const series = { pregoes, ativos: { PETR4: serie } }
const fundamentos = { empresas: { PETR4: { ticker: 'PETR4', acoes: { classes: [{ quantidade: 600 }, { quantidade: 400 }] } } } }
const barras = pregoes.map((d, i) => [d, 0, 0, 0, 1000 + i * 10, 0])

test('preço: usa a janela que termina na data e respeita o alinhamento pela direita', () => {
  const r = precoEVolume(series, 'PETR4', '2026-10-25') // último ponto da série (índice 22, fecha 122)
  assert.ok(Math.abs(r.var20 - (122 / 102 - 1)) < 1e-9) // 20 pregões antes: índice 2 (fecha 102)
  assert.equal(r.volumeMedio, 1000)
  assert.equal(precoEVolume(series, 'PETR4', '2026-10-05'), null) // pouca história antes da data
  assert.equal(precoEVolume(series, 'XXXX3', '2026-10-25'), null)
})

test('capital: soma as classes da empresa e vale para PETR3 e PETR4', () => {
  assert.equal(acoesPorEmpresa(fundamentos).get('PETR'), 1000)
})

test('ibovespa na mesma janela', () => {
  const r = ibovNaJanela(barras, '2026-10-25')
  assert.ok(Math.abs(r.var20 - (1240 / 1040 - 1)) < 1e-9)
  assert.equal(r.de, '2026-10-05')
})

test('enriquecer: % do capital, dias de volume e janela; ação sem dados fica nula', () => {
  const snap = {
    dataReferencia: '2026-10-25',
    registros: [
      { ticker: 'PETR4', saldoFinanceiro: 3_000_000, saldoQuantidade: 50 },
      { ticker: 'ZZZZ3', saldoFinanceiro: 10, saldoQuantidade: 1 },
    ],
  }
  const r = enriquecer(snap, { fundamentos, series, ibov: { barras } })
  assert.equal(r.registros[0].capital, 0.05)
  assert.equal(r.registros[0].diasDeVolume, 3) // R$ 3.000 mil ÷ R$ 1.000 mil por pregão
  assert.ok(r.registros[0].var20 > 0.19 && r.registros[0].var20 < 0.2)
  assert.deepEqual([r.registros[1].capital, r.registros[1].diasDeVolume, r.registros[1].var20], [null, null, null])
  assert.equal(r.janela.ate, '2026-10-25')
})
