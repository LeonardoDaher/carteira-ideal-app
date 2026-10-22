import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  agruparPorTicker, ajustarCandles, combinarEventos, detectarEventos, formatarHistoricoTicker, lerLinhaCotahist, linhaDoCandle, saltosRestantes,
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
  it('o evento do config prevalece sobre o detectado do mesmo dia (até 3 dias de diferença)', () => {
    const r = combinarEventos([{ data: '2025-04-02', fator: 3 }], [{ data: '2025-04-01', fator: 3 }, { data: '2025-08-01', fator: 2 }])
    assert.deepEqual(r, [{ data: '2025-04-02', fator: 3, origem: 'config' }, { data: '2025-08-01', fator: 2, origem: 'detectado' }])
  })

  it('descarta o evento detectado cuja data está em "ignorarEventos"', () => {
    assert.deepEqual(combinarEventos([], [{ data: '2023-01-12', fator: 4 }], ['2023-01-12']), [])
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
