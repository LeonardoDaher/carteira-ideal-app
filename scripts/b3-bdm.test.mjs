import test from 'node:test'
import assert from 'node:assert/strict'
import { fluxoDoDia, lerParticipacao, lerPosicoesEmAberto } from './b3-bdm.mjs'

const PART = `Dados acumulados do início do mês até o dia 04/11/2026.
Tipos de investidores Compras (R$) mil Participação (%) Vendas (R$) mil Participação (%)
Institucionais 19.829.219 11,36 19.302.515 11,06
Instituições Financeiras 1.507.830 0,86 1.355.366 0,78
Investidor Estrangeiro 55.480.108 31,79 57.538.314 32,97
Investidores Individuais 9.929.209 5,69 8.738.661 5,01
Outros 516.522 0,30 328.034 0,19`

test('participação: acumulado = compras − vendas em R$ milhões', () => {
  const p = lerParticipacao(PART)
  assert.equal(p.data, '2026-11-04')
  assert.ok(Math.abs(p.acumulado.estrangeiro - -2058.206) < 1e-6)
  assert.ok(Math.abs(p.acumulado.institucional - 526.704) < 1e-6)
})

test('fluxo do dia: diferença para o acumulado anterior do mesmo mês', () => {
  const acum = { '2026-11-03': { estrangeiro: -300 }, '2026-10-30': { estrangeiro: 999 } }
  assert.equal(fluxoDoDia('2026-11-04', { estrangeiro: -2058.2 }, acum).estrangeiro, -1758.2)
  assert.equal(fluxoDoDia('2026-12-01', { estrangeiro: 50 }, acum).estrangeiro, 50)
})

test('posições em aberto: só ações e units, linhas Total', () => {
  const t = `06/11/2026 PETR4 BRPETRACNPR6 PETROLEO BRASILEIRO S.A. PETROBRAS PN N2 Registro 130.246.071 52,8329 6.881.271.820,75
06/11/2026 PETR4 BRPETRACNPR6 PETROLEO BRASILEIRO S.A. PETROBRAS PN N2 Total 210.327.379 - 11.278.915.319,73
06/11/2026 A1AP34 BRA1APBDR001 ADVANCE AUTO PARTS INC DRN Total 1.831 - 27.945,83`
  const r = lerPosicoesEmAberto(t)
  assert.equal(r.dataReferencia, '2026-11-06')
  assert.equal(r.registros.length, 1)
  assert.deepEqual([r.registros[0].ticker, r.registros[0].saldoQuantidade, r.registros[0].saldoFinanceiro], ['PETR4', 210327379, 11278915319.73])
})

import { acrescentarHistorico } from './b3-bdm.mjs'

test('histórico: acrescenta o retrato, mantém a ordem e substitui a mesma data', () => {
  const r1 = [{ ticker: 'PETR4', saldoFinanceiro: 11278915319.73, saldoQuantidade: 210327379 }]
  let h = acrescentarHistorico(undefined, '2026-11-06', r1)
  assert.deepEqual(h.retratos[0], { data: '2026-11-06', acoes: { PETR4: [11278915320, 210327379] } })
  h = acrescentarHistorico(h, '2026-10-30', [{ ticker: 'PETR4', saldoFinanceiro: 1000, saldoQuantidade: 5 }])
  assert.deepEqual(h.retratos.map((x) => x.data), ['2026-10-30', '2026-11-06'])
  h = acrescentarHistorico(h, '2026-11-06', [{ ticker: 'VALE3', saldoFinanceiro: 7, saldoQuantidade: null }])
  assert.equal(h.retratos.length, 2)
  assert.deepEqual(h.retratos[1].acoes, { VALE3: [7, null] })
})
