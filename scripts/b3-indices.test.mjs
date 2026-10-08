import assert from 'node:assert/strict'
import test from 'node:test'
import { INDICES, baixarComposicao, dataBr, lerComposicao, numeroBr, urlComposicao } from './b3-indices.mjs'

const resposta = (results, extra = {}) => ({ page: { pageNumber: 1, pageSize: 200, totalRecords: results.length, totalPages: 1 }, header: { date: '08/10/26', part: '100,000' }, results, ...extra })
const linha = (cod, part, extra = {}) => ({ segment: null, cod, asset: `Ativo ${cod}`, type: 'ON      NM', part, partAcum: null, theoricalQty: '1.335.651.252', ...extra })

test('numeroBr: vírgula decimal, ponto de milhar, e lixo vira null', () => {
  assert.equal(numeroBr('2,256'), 2.256)
  assert.equal(numeroBr('1.335.651.252'), 1335651252)
  assert.equal(numeroBr('100,000'), 100)
  assert.equal(numeroBr('0,045'), 0.045)
  assert.equal(numeroBr('-1,5'), -1.5)
  assert.equal(numeroBr(7.5), 7.5)
  for (const ruim of ['', '-', 'abc', '1,2,3', null, undefined, NaN, '12abc']) assert.equal(numeroBr(ruim), null, String(ruim))
})

test('dataBr: dia/mês/ano com dois ou quatro dígitos; formato errado vira null', () => {
  assert.equal(dataBr('08/10/26'), '2026-10-08')
  assert.equal(dataBr('08/10/2026'), '2026-10-08')
  for (const ruim of ['2026-10-08', '8/10/26', '', null, '31-12-26']) assert.equal(dataBr(ruim), null, String(ruim))
})

test('urlComposicao: parâmetros em JSON base64 (como no site da B3) e índice desconhecido é erro', () => {
  const url = urlComposicao('IFIX')
  assert.ok(url.startsWith('https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/'))
  const params = JSON.parse(Buffer.from(url.split('/').pop(), 'base64').toString('utf8'))
  assert.deepEqual(params, { language: 'pt-br', pageNumber: 1, pageSize: 200, index: 'IFIX', segment: '1' })
  assert.equal(JSON.parse(Buffer.from(urlComposicao('IBOV').split('/').pop(), 'base64').toString('utf8')).index, 'IBOV')
  assert.throws(() => urlComposicao('SMLL'), /Índice desconhecido: SMLL/)
  assert.deepEqual(Object.keys(INDICES), ['IBOV', 'IFIX'])
})

test('lerComposicao: converte pesos, quantidade, tipo e data', () => {
  const r = lerComposicao(resposta([linha('abev3', '2,256', { type: 'ON     ' }), linha('ITUB4', '9,158', { theoricalQty: '' })]))
  assert.equal(r.data, '2026-10-08')
  assert.equal(r.totalRegistros, 2)
  assert.deepEqual(r.componentes[0], { ticker: 'ABEV3', nome: 'Ativo abev3', tipo: 'ON', peso: 2.256, quantidadeTeorica: 1335651252 })
  assert.equal(r.componentes[1].quantidadeTeorica, null)
})

test('lerComposicao: erra, em vez de adivinhar, quando o formato muda ou a resposta está incompleta', () => {
  assert.throws(() => lerComposicao(null), /sem a lista "results"/)
  assert.throws(() => lerComposicao({ header: { date: '08/10/26' } }), /sem a lista "results"/)
  assert.throws(() => lerComposicao(resposta([linha('ABEV3', '1,0')], { header: {} })), /sem data da carteira válida/)
  assert.throws(() => lerComposicao(resposta([linha('', '1,0')])), /código inválido/)
  assert.throws(() => lerComposicao(resposta([linha('AB', '1,0')])), /código inválido/)
  assert.throws(() => lerComposicao(resposta([linha('ABEV3', '1,0'), linha('abev3', '2,0')])), /Código repetido.*ABEV3/)
  assert.throws(() => lerComposicao(resposta([linha('ABEV3', 'x')])), /Peso ilegível para ABEV3/)
  assert.throws(() => lerComposicao(resposta([linha('ABEV3', '101,0')])), /Peso ilegível/)
  assert.throws(() => lerComposicao(resposta([linha('ABEV3', '-1,0')])), /Peso ilegível/)
  assert.throws(() => lerComposicao(resposta([])), /vazia/)
  const incompleta = resposta([linha('ABEV3', '1,0')])
  incompleta.page.totalRecords = 76
  assert.throws(() => lerComposicao(incompleta), /A B3 informa 76 registros, mas vieram 1/)
})

test('baixarComposicao: devolve a leitura com sha256 e tamanho do texto bruto; tenta de novo e desiste com mensagem clara', async () => {
  const corpo = JSON.stringify(resposta([linha('ABEV3', '60,0'), linha('ITUB4', '40,0')]))
  const chamadas = []
  const ok = async (url, init) => { chamadas.push([url, init]); return { ok: true, status: 200, text: async () => corpo } }
  const r = await baixarComposicao('IBOV', { fetchImpl: ok, pausaMs: 0 })
  assert.equal(r.componentes.length, 2)
  assert.equal(r.bytes, Buffer.byteLength(corpo))
  assert.match(r.sha256, /^[0-9a-f]{64}$/)
  assert.equal(chamadas[0][0], urlComposicao('IBOV'))

  let n = 0
  const instavel = async () => (++n < 3 ? { ok: false, status: 503, text: async () => '' } : { ok: true, status: 200, text: async () => corpo })
  assert.equal((await baixarComposicao('IFIX', { fetchImpl: instavel, pausaMs: 0 })).componentes.length, 2)
  assert.equal(n, 3, 'dois 503 e o terceiro acerta')

  await assert.rejects(baixarComposicao('IFIX', { fetchImpl: async () => ({ ok: false, status: 500, text: async () => '' }), pausaMs: 0, tentativas: 2 }), /Não foi possível obter a carteira do IFIX na B3: HTTP 500/)
  await assert.rejects(baixarComposicao('IFIX', { fetchImpl: async () => ({ ok: true, status: 200, text: async () => '<html>' }), pausaMs: 0, tentativas: 1 }), /Não foi possível obter a carteira do IFIX/)
  await assert.rejects(baixarComposicao('XXXX', { fetchImpl: ok }), /Índice desconhecido/)
})
