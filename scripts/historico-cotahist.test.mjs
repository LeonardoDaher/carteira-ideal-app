import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  agruparPorTicker, ajustarCandles, buscarEventosB3, combinarEventos, confirmarEventosB3, detectarEventos, emitenteDoTicker, eventosDaB3,
  formatarHistoricoTicker, lerLinhaCotahist, linhaDoCandle, saltosRestantes, URL_EVENTOS_B3,
} from './historico-cotahist.mjs'

/** Monta uma linha de 245 colunas do COTAHIST. Preços em reais (2 casas implícitas), volume em reais. */
function linha({ data = '20250120', bdi = '02', codigo = 'PETR4', mercado = '010', abertura = 37.22, maxima = 37.43, minima = 37.11, ultimo = 37.28, quantidade = 1000, volume = 37000, tipo = '01' }) {
  const num = (v, n) => String(Math.round(v * 100)).padStart(n, '0')
  const parte = (texto, n) => texto.padEnd(n, ' ')
  return (
    tipo + data + bdi + parte(codigo, 12) + mercado + parte('PETROBRAS', 12) + parte('PN', 10) + '   ' + 'R$  ' +
    num(abertura, 13) + num(maxima, 13) + num(minima, 13) + num((maxima + minima) / 2, 13) + num(ultimo, 13) + num(ultimo, 13) + num(ultimo, 13) +
    '00010' + String(quantidade).padStart(18, '0') + num(volume, 18) + ''.padEnd(245 - 188, ' ')
  )
}

const candle = (data, ultimo, extra = {}) => ({ data, abertura: ultimo, maxima: ultimo * 1.01, minima: ultimo * 0.99, ultimo, quantidade: 1_000_000, volume: 10_000_000, ...extra })

/** 30 pregões estáveis seguidos de um pregão de evento. */
function serieComEvento(evento) {
  const dias = Array.from({ length: 30 }, (_, i) => candle(`2025-03-${String(i + 1).padStart(2, '0')}`, 30))
  return [...dias, evento]
}

describe('lerLinhaCotahist', () => {
  it('lê data, código, preços, quantidade e volume de uma linha do mercado à vista', () => {
    const p = lerLinhaCotahist(linha({}))
    assert.equal(p.data, '2025-01-20')
    assert.equal(p.codigo, 'PETR4')
    assert.equal(p.bdi, '02')
    assert.equal(p.abertura, 37.22)
    assert.equal(p.maxima, 37.43)
    assert.equal(p.minima, 37.11)
    assert.equal(p.ultimo, 37.28)
    assert.equal(p.quantidade, 1000)
    assert.equal(p.volume, 37000)
  })

  it('ignora cabeçalho, rodapé, outros mercados e outros lotes', () => {
    assert.equal(lerLinhaCotahist(linha({ tipo: '00' })), null)
    assert.equal(lerLinhaCotahist(linha({ tipo: '99' })), null)
    assert.equal(lerLinhaCotahist(linha({ mercado: '070' })), null)
    assert.equal(lerLinhaCotahist(linha({ bdi: '78' })), null)
    assert.equal(lerLinhaCotahist('curta'), null)
  })
})

describe('agruparPorTicker', () => {
  it('ordena por data, separa os códigos e soma o volume do fracionário', () => {
    const papeis = [
      lerLinhaCotahist(linha({ data: '20250121', ultimo: 38, volume: 1000 })),
      lerLinhaCotahist(linha({ data: '20250120', ultimo: 37, volume: 2000 })),
      lerLinhaCotahist(linha({ data: '20250120', codigo: 'PETR4F', bdi: '96', volume: 500 })),
      lerLinhaCotahist(linha({ data: '20250120', codigo: 'VALE3', ultimo: 60 })),
      lerLinhaCotahist(linha({ data: '20250120', codigo: 'XXXX3', ultimo: 5 })),
    ]
    const m = agruparPorTicker(papeis, new Set(['PETR4', 'VALE3']))
    assert.deepEqual([...m.keys()].sort(), ['PETR4', 'VALE3'])
    assert.deepEqual(m.get('PETR4').map((c) => c.data), ['2025-01-20', '2025-01-21'])
    assert.equal(m.get('PETR4')[0].volume, 2500)
    assert.equal(m.get('PETR4')[0].ultimo, 37)
  })
})

describe('detectarEventos', () => {
  it('desdobramento 1:3: preço cai a um terço, as ações negociadas triplicam e o volume em reais fica normal', () => {
    const e = detectarEventos(serieComEvento(candle('2025-04-01', 10.1, { abertura: 10, quantidade: 3_000_000, volume: 10_500_000 })))
    assert.deepEqual(e, [{ data: '2025-04-01', fator: 3 }])
  })

  it('grupamento 10:1: preço sobe dez vezes e as ações negociadas diminuem', () => {
    const e = detectarEventos(serieComEvento(candle('2025-04-01', 298, { abertura: 305, quantidade: 200_000, volume: 20_000_000 })))
    assert.deepEqual(e, [{ data: '2025-04-01', fator: 0.1 }])
  })

  it('queda forte por notícia (volume em reais dispara) não é desdobramento', () => {
    const e = detectarEventos(serieComEvento(candle('2025-04-01', 7.4, { abertura: 7.5, quantidade: 6_000_000, volume: 45_000_000 })))
    assert.deepEqual(e, [])
  })

  it('variação grande que não é um fator inteiro não é evento', () => {
    const e = detectarEventos(serieComEvento(candle('2025-04-01', 17.5, { abertura: 17.6, quantidade: 2_000_000, volume: 10_000_000 })))
    assert.deepEqual(e, [])
  })

  it('série sem saltos não gera evento e com pouco histórico não gera evento', () => {
    assert.deepEqual(detectarEventos(Array.from({ length: 40 }, (_, i) => candle(`2025-05-${String((i % 28) + 1).padStart(2, '0')}`, 30 + i * 0.1))), [])
    assert.deepEqual(detectarEventos([candle('2025-04-01', 30), candle('2025-04-02', 10, { abertura: 10, quantidade: 3_000_000 })]), [])
  })
})

describe('combinarEventos e ajustarCandles', () => {
  it('o evento do config prevalece sobre o da B3 do mesmo dia (até 3 dias de diferença)', () => {
    const r = combinarEventos([{ data: '2025-04-02', fator: 3 }], [{ data: '2025-04-01', fator: 3 }, { data: '2025-08-01', fator: 2 }])
    assert.deepEqual(r, [{ data: '2025-04-02', fator: 3, origem: 'config' }, { data: '2025-08-01', fator: 2, origem: 'b3' }])
  })

  it('divide só os preços anteriores à data do evento e acumula vários eventos', () => {
    const cs = [candle('2025-01-01', 30), candle('2025-03-01', 30), candle('2025-05-01', 10)]
    const r = ajustarCandles(cs, [{ data: '2025-02-01', fator: 3 }, { data: '2025-04-01', fator: 2 }])
    assert.equal(r[0].ultimo, 5)
    assert.equal(r[1].ultimo, 15)
    assert.equal(r[2].ultimo, 10)
    assert.equal(r[0].volume, 10_000_000)
    assert.equal(r[0].quantidade, 1_000_000)
  })

  it('sem eventos devolve os mesmos candles', () => {
    const cs = [candle('2025-01-01', 30)]
    assert.equal(ajustarCandles(cs, []), cs)
  })
})

describe('saltosRestantes e formato do arquivo', () => {
  it('lista saltos de fechamento maiores que o limite', () => {
    const s = saltosRestantes([candle('2025-01-01', 10), candle('2025-01-02', 10.5), candle('2025-01-03', 20)])
    assert.deepEqual(s, [{ data: '2025-01-03', de: 10.5, para: 20 }])
  })

  it('a linha do candle tem data, abertura, máxima, mínima, fechamento e volume em R$ mil', () => {
    assert.deepEqual(linhaDoCandle({ data: '2025-01-02', abertura: 10.004, maxima: 10.5, minima: 9.9, ultimo: 10.2, volume: 1_234_567 }), ['2025-01-02', 10, 10.5, 9.9, 10.2, 1235])
    assert.deepEqual(linhaDoCandle({ data: '2025-01-02', abertura: 0.5556, maxima: 0.6, minima: 0.5, ultimo: 0.55, volume: 100 }).slice(1, 3), [0.556, 0.6])
  })

  it('o arquivo é um JSON válido com um candle por linha', () => {
    const texto = formatarHistoricoTicker({
      ticker: 'PETR4', fonte: 'B3', geradoEm: '2026-10-22T00:00:00.000Z', eventos: [{ data: '2025-04-01', fator: 3, origem: 'detectado' }], saltos: [],
      candles: [candle('2025-01-02', 30), candle('2025-01-03', 31)],
    })
    const j = JSON.parse(texto)
    assert.equal(j.ticker, 'PETR4')
    assert.equal(j.de, '2025-01-02')
    assert.equal(j.ate, '2025-01-03')
    assert.equal(j.barras.length, 2)
    assert.equal(j.barras[0].length, 6)
    assert.equal(texto.split('\n').filter((l) => l.startsWith('    ["2025')).length, 2)
  })
})

describe('eventos oficiais da B3', () => {
  const resposta = (stockDividends) => [{ code: 'ANIM', stockDividends }]
  const ev = (label, factor, lastDatePrior, isinCode = 'BRANIMACNOR6') => ({ assetIssued: isinCode, isinCode, label, factor, lastDatePrior, approvedOn: lastDatePrior, remarks: '' })
  const dias = (n, preco) => Array.from({ length: n }, (_, i) => candle(`2025-03-${String(i + 1).padStart(2, '0')}`, preco))

  it('converte desdobramento e bonificação (em %) e grupamento (razão) no fator de ações novas por antiga', () => {
    const r = eventosDaB3(resposta([
      ev('DESDOBRAMENTO', '200,00000000000', '18/02/2021'),
      ev('BONIFICACAO', '5,00000000000', '29/12/2025'),
      ev('GRUPAMENTO', '0,10000000000', '24/05/2024'),
      ev('DESDOBRAMENTO', '7.900,00000000000', '14/04/2025'),
      ev('CISAO', '10,0', '14/04/2025'),
    ]), 'BRANIMACNOR6')
    assert.deepEqual(r.map((e) => [e.ultimaDataCom, Number(e.fator.toFixed(6))]), [['2021-02-18', 3], ['2025-12-29', 1.05], ['2024-05-24', 0.1], ['2025-04-14', 80]])
  })

  it('usa só os eventos do ISIN do papel, e os do emissor inteiro se nenhum tem o ISIN', () => {
    const lista = resposta([ev('DESDOBRAMENTO', '100,0', '01/03/2024', 'BRXXXXACNOR1'), ev('DESDOBRAMENTO', '200,0', '01/04/2024', 'BRXXXXACNPR1')])
    assert.deepEqual(eventosDaB3(lista, 'BRXXXXACNPR1').map((e) => e.fator), [3])
    assert.equal(eventosDaB3(lista, 'BRXXXXCDAM00').length, 2)
  })

  it('resposta que não é a esperada devolve null; sem eventos devolve lista vazia', () => {
    assert.equal(eventosDaB3(null, 'X'), null)
    assert.equal(eventosDaB3([], 'X'), null)
    assert.equal(eventosDaB3('<html>', 'X'), null)
    assert.deepEqual(eventosDaB3(resposta([]), 'X'), [])
  })

  it('aplica o evento da B3 no primeiro pregão depois da data com, se o preço confirma', () => {
    const cs = [...dias(10, 30), candle('2025-03-13', 10, { abertura: 10 })]
    const { eventos, divergentes } = confirmarEventosB3(cs, [{ ultimaDataCom: '2025-03-10', fator: 3, rotulo: 'DESDOBRAMENTO' }])
    assert.deepEqual(eventos, [{ data: '2025-03-13', fator: 3 }])
    assert.deepEqual(divergentes, [])
  })

  it('o que a B3 não lista não é ajustado: queda de 44% com volume normal (ANIM3 em 26/10/2026) segue como queda', () => {
    const cs = [...dias(10, 5), candle('2025-03-13', 2.8, { abertura: 2.5 })]
    assert.deepEqual(confirmarEventosB3(cs, []).eventos, [])
    assert.equal(ajustarCandles(cs, [])[0].ultimo, 5)
  })

  it('evento da B3 que o preço não confirma vai para divergentes e não é aplicado', () => {
    const cs = [...dias(10, 30), candle('2025-03-13', 30)]
    const { eventos, divergentes } = confirmarEventosB3(cs, [{ ultimaDataCom: '2025-03-10', fator: 3, rotulo: 'DESDOBRAMENTO' }])
    assert.deepEqual(eventos, [])
    assert.equal(divergentes.length, 1)
  })

  it('desdobramento e grupamento na mesma data com valem pelo produto (VIVT3: 80 x 0,025 = 2; TIMS3: 100 x 0,01 = nada)', () => {
    const vivt = [...dias(10, 51), candle('2025-03-13', 25.5, { abertura: 25.4 })]
    const par = [{ ultimaDataCom: '2025-03-10', fator: 80, rotulo: 'DESDOBRAMENTO' }, { ultimaDataCom: '2025-03-10', fator: 0.025, rotulo: 'GRUPAMENTO' }]
    assert.deepEqual(confirmarEventosB3(vivt, par).eventos, [{ data: '2025-03-13', fator: 2 }])
    const tims = [...dias(10, 22), candle('2025-03-13', 22.6)]
    const nulo = [{ ultimaDataCom: '2025-03-10', fator: 100, rotulo: 'DESDOBRAMENTO' }, { ultimaDataCom: '2025-03-10', fator: 0.01, rotulo: 'GRUPAMENTO' }]
    const r = confirmarEventosB3(tims, nulo)
    assert.deepEqual(r.eventos, [])
    assert.deepEqual(r.divergentes, [])
  })

  it('bonificação pequena é aplicada sem conferência de preço; evento fora do período ou futuro é ignorado', () => {
    const cs = dias(10, 30)
    assert.deepEqual(confirmarEventosB3(cs, [{ ultimaDataCom: '2025-03-05', fator: 1.05, rotulo: 'BONIFICACAO' }]).eventos, [{ data: '2025-03-06', fator: 1.05 }])
    assert.deepEqual(confirmarEventosB3(cs, [{ ultimaDataCom: '2020-01-01', fator: 3, rotulo: 'DESDOBRAMENTO' }]).eventos, [])
    assert.deepEqual(confirmarEventosB3(cs, [{ ultimaDataCom: '2025-03-10', fator: 3, rotulo: 'DESDOBRAMENTO' }]).eventos, [])
  })

  it('busca: monta a URL com o emissor em base64 e devolve null em erro, corpo vazio ou JSON inválido', async () => {
    assert.equal(emitenteDoTicker('ANIM3'), 'ANIM')
    assert.equal(emitenteDoTicker('BPAC11'), 'BPAC')
    const url = URL_EVENTOS_B3('ANIM')
    assert.match(url, /GetListedSupplementCompany\//)
    assert.deepEqual(JSON.parse(Buffer.from(url.split('/').pop(), 'base64').toString()), { issuingCompany: 'ANIM', language: 'pt-br' })
    const resp = (ok, texto) => async () => ({ ok, text: async () => texto })
    assert.deepEqual(await buscarEventosB3('ANIM', resp(true, '[{"a":1}]')), [{ a: 1 }])
    assert.equal(await buscarEventosB3('ANIM', resp(true, '')), null)
    assert.equal(await buscarEventosB3('ANIM', resp(true, '<html>')), null)
    assert.equal(await buscarEventosB3('ANIM', resp(false, '[]')), null)
    assert.equal(await buscarEventosB3('ANIM', async () => { throw new Error('rede') }), null)
  })
})
