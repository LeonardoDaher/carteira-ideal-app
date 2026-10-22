import test from 'node:test'
import assert from 'node:assert/strict'
import { escolherVertice, extrairFuturo, extrairFuturoDoDia, incorporarPregao, historicoVazio, lerTicker, serieContinua } from './atualizar-futuros.mjs'

const bloco = (ticker, extra = '') =>
  `<PricRpt><TradDt><Dt>2026-10-21</Dt></TradDt><SctyId><TckrSymb>${ticker}</TckrSymb></SctyId><FinInstrmAttrbts><AdjstdQt Ccy="BRL">231758</AdjstdQt><PrvsAdjstdQt Ccy="BRL">233755</PrvsAdjstdQt>${extra}</FinInstrmAttrbts></PricRpt>`

test('lerTicker separa produto e vencimento', () => {
  assert.deepEqual(lerTicker('WINV27'), { produto: 'WIN', vencimento: '2027-10' })
  assert.deepEqual(lerTicker('DI1F27'), { produto: 'DI1', vencimento: '2027-01' })
  assert.equal(lerTicker('PETR4'), null)
  assert.equal(lerTicker('BOVA11'), null)
})

test('extrairFuturo lê ajuste, ajuste anterior e, se houver, OHLC e posição em aberto', () => {
  const f = extrairFuturo(bloco('WINV27', '<FrstPric>1</FrstPric><MinPric>2</MinPric><MaxPric>3</MaxPric><LastPric>2.5</LastPric><OpnIntrst>10</OpnIntrst><FinInstrmQty>7</FinInstrmQty>'))
  assert.equal(f.ticker, 'WINV27')
  assert.equal(f.ajuste, 231758)
  assert.equal(f.ajusteAnterior, 233755)
  assert.equal(f.ultimo, 2.5)
  assert.equal(f.posicaoAberta, 10)
  assert.equal(f.volume, 7)
})

test('extrairFuturo ignora quem não tem preço de ajuste (ação, FII)', () => {
  const semAjuste = '<PricRpt><TradDt><Dt>2026-10-21</Dt></TradDt><SctyId><TckrSymb>MXRF11</TckrSymb></SctyId><FinInstrmAttrbts><LastPric>9</LastPric></FinInstrmAttrbts></PricRpt>'
  assert.equal(extrairFuturo(semAjuste), null)
})

test('escolherVertice pega a maior posição em aberto e, no empate, o vencimento mais próximo', () => {
  const itens = [
    { ticker: 'WINZ26', ajuste: 1, posicaoAberta: 5 },
    { ticker: 'WING27', ajuste: 1, posicaoAberta: 9 },
    { ticker: 'WINV26', ajuste: 1, posicaoAberta: 9 },
  ]
  assert.equal(escolherVertice(itens).ticker, 'WINV26')
  assert.equal(escolherVertice([]), null)
})

test('incorporarPregao guarda o vertice do dia, mantém ordem e guarda todos os vencimentos do último dia', () => {
  const dia = (a, oi) => [
    { ticker: 'WINV26', ajuste: a, ajusteAnterior: a - 1, posicaoAberta: oi, abertura: null, maxima: null, minima: null, ultimo: null, volume: null },
    { ticker: 'WINZ26', ajuste: a + 5, ajusteAnterior: a + 4, posicaoAberta: 1, abertura: null, maxima: null, minima: null, ultimo: null, volume: null },
  ]
  let h = incorporarPregao(historicoVazio(), '2026-10-21', dia(100, 10), ['WIN'])
  h = incorporarPregao(h, '2026-10-20', dia(90, 10), ['WIN'])
  assert.deepEqual(h.pregoes, ['2026-10-20', '2026-10-21'])
  assert.equal(h.dias.WIN[0].a, 90)
  assert.equal(h.dias.WIN[1].t, 'WINV26')
  assert.equal(h.ultimoDia.data, '2026-10-21')
  assert.equal(h.ultimoDia.contratos.length, 2)
})

test('serieContinua ajusta o salto da troca de vencimento (back-adjust)', () => {
  const pregoes = ['d1', 'd2', 'd3']
  const dias = [
    { t: 'A', a: 100, p: 99, o: null, h: null, l: null, c: null, v: 1, i: 1 },
    // troca para B: o ajuste anterior de B (110) vira a referência do ajuste de A (100)
    { t: 'B', a: 112, p: 110, o: null, h: null, l: null, c: null, v: 1, i: 1 },
    { t: 'B', a: 121, p: 112, o: null, h: null, l: null, c: null, v: 1, i: 1 },
  ]
  const s = serieContinua(pregoes, dias, 'pontos')
  assert.equal(s.length, 3)
  assert.equal(s[2][4], 121)
  assert.equal(s[1][4], 112)
  assert.equal(s[0][4], 110) // 100 * (110 / 100)
})

test('serieContinua do DI usa a taxa e ignora dias sem negócio', () => {
  const dias = [
    { t: 'X', a: 1, p: 1, o: 12, h: 13, l: 11, c: 12.5, v: 1, i: 1 },
    { t: 'X', a: 1, p: 1, o: null, h: null, l: null, c: null, v: 0, i: 1 },
  ]
  const s = serieContinua(['d1', 'd2'], dias, 'taxa')
  assert.equal(s.length, 1)
  assert.deepEqual(s[0], ['d1', 12, 13, 11, 12.5, 1])
})

test('extrairFuturoDoDia descarta o bloco da sessão da noite, com a data do dia seguinte', () => {
  assert.equal(extrairFuturoDoDia(bloco('BGIX26'), '2026-10-21').ticker, 'BGIX26')
  assert.equal(extrairFuturoDoDia(bloco('BGIX26'), '2026-10-22'), null)
})
