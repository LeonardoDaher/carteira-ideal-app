import test from 'node:test'
import assert from 'node:assert/strict'
import { lerTabelaFluxo, lerValor, mesclar } from './atualizar-fluxo.mjs'

const CAB = ['Data', 'Estrangeiro', 'Institucional', 'Pessoa física', 'Inst. Financeira', 'Outros']
const linha = (d, v) => `<tr>\n<td>${d}</td>${v.map((x) => `<td class="right nw">\n  ${x}\n</td>`).join('')}</tr>`
function pagina(n, cabecalho = CAB, extra = '') {
  const dias = Array.from({ length: n }, (_, i) => {
    const dt = new Date(Date.UTC(2026, 10, 11) - i * 86400000)
    return linha(`${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}/${dt.getUTCFullYear()}`, ['-370,02 mi', '228,04 mi', '56,89 mi', '127,12 mi', '-42,02 mi'])
  })
  return `<html><table class="normal-table" id="flow"><thead><tr>${cabecalho.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${dias.join('\n')}${extra}</tbody></table></html>`
}

test('valores: milhares, vírgula, sinal e formato inesperado', () => {
  assert.equal(lerValor('1.434,19 mi'), 1434.19)
  assert.equal(lerValor('-1.009,84 mi'), -1009.84)
  assert.equal(lerValor('0,00 mi'), 0)
  assert.throws(() => lerValor('1,2 bi'))
  assert.throws(() => lerValor('-'))
})

test('tabela: lê os 5 tipos, em ordem crescente de data', () => {
  const r = lerTabelaFluxo(pagina(120))
  assert.equal(r.length, 120)
  assert.ok(r[0].data < r.at(-1).data)
  assert.equal(r.at(-1).data, '2026-11-11')
  assert.deepEqual(r.at(-1), { data: '2026-11-11', estrangeiro: -370.02, institucional: 228.04, pessoaFisica: 56.89, instFinanceira: 127.12, outros: -42.02 })
})

test('layout mudou, página curta ou linha estranha: falha em vez de gravar lixo', () => {
  assert.throws(() => lerTabelaFluxo('<html>sem tabela</html>'), /não encontrada/)
  assert.throws(() => lerTabelaFluxo(pagina(120, ['Data', 'Outros', 'Estrangeiro', 'Institucional', 'Pessoa física', 'Inst. Financeira'])), /Colunas/)
  assert.throws(() => lerTabelaFluxo(pagina(20)), /incompleta/)
  assert.throws(() => lerTabelaFluxo(pagina(120, CAB, linha('01/01/2026', ['x', '1,00 mi', '1,00 mi', '1,00 mi', '1,00 mi']))), /fora do formato/i)
})

test('mesclar: novo substitui a mesma data e mantém o mais antigo', () => {
  const a = [{ data: '2025-01-02', estrangeiro: 1 }, { data: '2026-11-10', estrangeiro: 2 }]
  const n = [{ data: '2026-11-10', estrangeiro: 9 }, { data: '2026-11-11', estrangeiro: 3 }]
  assert.deepEqual(mesclar(a, n).map((r) => [r.data, r.estrangeiro]), [['2025-01-02', 1], ['2026-11-10', 9], ['2026-11-11', 3]])
})
