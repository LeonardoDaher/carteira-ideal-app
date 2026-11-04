import assert from 'node:assert/strict'
import test from 'node:test'
import { conferir, detectarSeparador, lerCsv, lerData, lerNumero, mapearColunas, mesclar, montarArquivo } from './importar-indice-historico.mjs'

test('lerData: formatos aceitos, dia inexistente e lixo viram null', () => {
  assert.equal(lerData('04/11/2026'), '2026-11-04')
  assert.equal(lerData('4/11/2026'), '2026-11-04')
  assert.equal(lerData('2026-11-04'), '2026-11-04')
  assert.equal(lerData('2026-11-04T00:00:00'), '2026-11-04')
  for (const ruim of ['31/02/2026', '2026-13-01', 'abc', '', null, '11/04/26']) assert.equal(lerData(ruim), null, String(ruim))
})

test('lerNumero: brasileiro, americano, decimal simples e ambíguo', () => {
  assert.equal(lerNumero('130.123,45'), 130123.45)
  assert.equal(lerNumero('130,123.45'), 130123.45)
  assert.equal(lerNumero('3412,5'), 3412.5)
  assert.equal(lerNumero('3412.5'), 3412.5)
  assert.equal(lerNumero('130123'), 130123)
  assert.equal(lerNumero('1.234.567'), 1234567)
  assert.throws(() => lerNumero('1,234'), /ambíguo/)
  assert.equal(lerNumero('1,234', 'virgula'), 1.234)
  assert.equal(lerNumero('1,234', 'ponto'), 1234)
  for (const ruim of ['', 'abc', '12abc', null]) assert.equal(lerNumero(ruim), null, String(ruim))
})

test('detectarSeparador e mapearColunas (português, inglês e "Último")', () => {
  assert.equal(detectarSeparador('Data;Abertura;Máxima'), ';')
  assert.equal(detectarSeparador('Date,Open,High'), ',')
  assert.deepEqual(mapearColunas(['Data', 'Abertura', 'Máxima', 'Mínima', 'Fechamento', 'Volume']), { data: 0, abertura: 1, maxima: 2, minima: 3, fechamento: 4, volume: 5 })
  assert.deepEqual(mapearColunas(['Date', 'Open', 'High', 'Low', 'Close']), { data: 0, abertura: 1, maxima: 2, minima: 3, fechamento: 4 })
  assert.throws(() => mapearColunas(['Data', 'Fechamento']), /Faltam as colunas: abertura, maxima, minima/)
})

const csv = (linhas) => ['Data;Abertura;Máxima;Mínima;Fechamento', ...linhas].join('\n')

test('lerCsv: ordena por data e converte números brasileiros', () => {
  const b = lerCsv(csv(['05/11/2026;130.500,00;131.000,00;130.000,00;130.800,00', '04/11/2026;130.000,00;130.900,00;129.500,00;130.500,00']))
  assert.deepEqual(b[0], ['2026-11-04', 130000, 130900, 129500, 130500, 0])
  assert.equal(b[1][0], '2026-11-05')
})

test('lerCsv: erra com data repetida, máxima abaixo do fechamento e valor zerado', () => {
  assert.throws(() => lerCsv(csv(['04/11/2026;1,5;2,0;1,0;1,8', '04/11/2026;1,5;2,0;1,0;1,8'])), /aparece duas vezes/)
  assert.throws(() => lerCsv(csv(['04/11/2026;100,5;100,6;100,0;101,0'])), /não cobrem/)
  assert.throws(() => lerCsv(csv(['04/11/2026;0;1;1;1'])), /maiores que zero/)
  assert.throws(() => lerCsv(csv(['31/02/2026;1,5;2,0;1,0;1,8'])), /data inválida/)
  assert.throws(() => lerCsv('Data;Abertura'), /vazio/)
})

function dias(n, inicio = '2025-01-02') {
  const t0 = Date.parse(`${inicio}T12:00:00Z`)
  return Array.from({ length: n }, (_, i) => {
    const f = 100000 + i * 10
    return [new Date(t0 + i * 86_400_000).toISOString().slice(0, 10), f - 5, f + 50, f - 50, f, 0]
  })
}

test('conferir: poucos pregões, data futura e salto de mais de 20% são erros', () => {
  assert.throws(() => conferir(dias(30), '2026-12-31'), /mínimo 60/)
  assert.throws(() => conferir(dias(80), '2025-02-01'), /posterior a hoje/)
  const b = dias(80)
  b[40] = [b[40][0], 130000, 130100, 129900, 130000, 0]
  assert.throws(() => conferir(b, '2026-12-31'), /Salto de/)
  assert.deepEqual(conferir(dias(80), '2026-12-31'), ['Sem coluna de volume: normal para índice, a análise não usa volume.'])
})

test('mesclar: a data nova vence e a ordem é mantida', () => {
  const a = [['2026-11-03', 1, 2, 1, 2, 0], ['2026-11-04', 1, 2, 1, 2, 0]]
  const n = [['2026-11-04', 1, 3, 1, 3, 0], ['2026-11-05', 1, 2, 1, 2, 0]]
  const m = mesclar(a, n)
  assert.deepEqual(m.map((x) => x[0]), ['2026-11-03', '2026-11-04', '2026-11-05'])
  assert.equal(m[1][4], 3)
})

test('montarArquivo: mesmo formato do histórico longo das ações', () => {
  const f = montarArquivo('IBOV', dias(70), new Date('2026-11-04T12:00:00Z'))
  assert.equal(f.ticker, 'IBOV')
  assert.equal(f.de, '2025-01-02')
  assert.deepEqual(f.ajustes, [])
  assert.deepEqual(f.saltosRestantes, [])
  assert.equal(f.barras.length, 70)
  assert.equal(f.barras[0].length, 6)
})
