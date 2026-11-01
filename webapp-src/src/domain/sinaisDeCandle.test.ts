import { describe, expect, it } from 'vitest'
import type { Barra } from './analiseTecnica'
import { faixaDoStop, sinaisDeCandle, sinalAtivo } from './sinaisDeCandle'

function dia(i: number): string {
  const d = new Date('2025-01-06T12:00:00Z')
  let n = 0
  while (n < i) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++
  }
  return d.toISOString().slice(0, 10)
}

/** Barra com abertura real: [abertura, fechamento, máxima, mínima, volume]. */
const b = (i: number, abe: number, fech: number, max: number, min: number, vol = 1000): Barra => ({ data: dia(i), abe, fech, max, min, vol })

/** 40 candles calmos em torno de 100 (ATR perto de 2, volume 1000). */
function calmo(n = 40): Barra[] {
  return Array.from({ length: n }, (_, i) => b(i, 100, 100, 101, 99))
}

const tipos = (s: ReturnType<typeof sinaisDeCandle>) => s.map((x) => x.tipo)

describe('sinaisDeCandle', () => {
  it('poucos candles não geram sinal; candles calmos também não', () => {
    expect(sinaisDeCandle(calmo(20))).toEqual([])
    expect(sinaisDeCandle(calmo(60))).toEqual([])
  })

  it('barra de ignição de alta: corpo de 1,5 ATR ou mais, volume na média e fechamento no terço superior', () => {
    const s = sinaisDeCandle([...calmo(), b(40, 100, 103.2, 103.4, 100, 1500)])
    const ig = s.find((x) => x.tipo === 'ignicao-alta')
    expect(ig).toBeDefined()
    expect(ig!.lado).toBe('compra')
    expect(ig!.gatilho).toBe(103.4)
    expect(ig!.stop).toBe(100)
    expect(ig!.stopPct).toBeCloseTo((3.4 / 103.4) * 100, 6)
    expect(ig!.faixaDoStop).toBe('curto')
    expect(ig!.situacao).toBe('aguardando')
    expect(ig!.explicacao).toContain('ATR')
  })

  it('barra elefante: a de maior amplitude da janela, com pelo menos 2 ATR', () => {
    const s = sinaisDeCandle([...calmo(), b(40, 100, 105, 105.2, 99.9, 2000)])
    expect(tipos(s)).toContain('elefante-alta')
    expect(tipos(s)).not.toContain('ignicao-alta')
  })

  it('ignição de baixa fecha no terço inferior', () => {
    const s = sinaisDeCandle([...calmo(), b(40, 100, 96.8, 100, 96.6, 1500)])
    const ig = s.find((x) => x.tipo === 'ignicao-baixa')
    expect(ig?.lado).toBe('venda')
    expect(ig?.gatilho).toBe(96.6)
    expect(ig?.stop).toBe(100)
  })

  it('volume abaixo da média de 21 desqualifica a ignição', () => {
    expect(tipos(sinaisDeCandle([...calmo(), b(40, 100, 103.2, 103.4, 100, 300)]))).not.toContain('ignicao-alta')
  })

  it('situação: acionado quando a máxima é superada, invalidado quando o stop é perdido antes, expirado depois de 5 candles', () => {
    const sinal = b(40, 100, 103.2, 103.4, 100, 1500)
    const acionado = sinaisDeCandle([...calmo(), sinal, b(41, 103.2, 104, 104.2, 103)]).find((x) => x.tipo === 'ignicao-alta')
    expect(acionado?.situacao).toBe('acionado')
    const invalidado = sinaisDeCandle([...calmo(), sinal, b(41, 103, 100.2, 103, 99.5)]).find((x) => x.tipo === 'ignicao-alta')
    expect(invalidado?.situacao).toBe('invalidado')
    const parado = Array.from({ length: 6 }, (_, k) => b(41 + k, 102, 102, 103, 101))
    const expirado = sinaisDeCandle([...calmo(), sinal, ...parado]).find((x) => x.tipo === 'ignicao-alta')
    expect(expirado?.situacao).toBe('expirado')
  })

  it('barra ignorada: candle pequeno dentro de uma barra forte de alta', () => {
    const s = sinaisDeCandle([...calmo(), b(40, 100, 103.5, 104, 99.8, 2000), b(41, 103.4, 103.2, 103.8, 102.5, 700)])
    const bi = s.find((x) => x.tipo === 'ignorada-compra')
    expect(bi).toBeDefined()
    expect(bi!.indice).toBe(41)
    expect(bi!.gatilho).toBe(103.8)
    expect(bi!.stop).toBe(102.5)
  })

  it('martelo: sombra inferior longa, fecha no topo, depois de queda e com volume', () => {
    const queda = [100, 99, 98, 97, 96].map((f, k) => b(40 + k, f + 0.5, f, f + 1, f - 1))
    const s = sinaisDeCandle([...calmo(), ...queda, b(45, 95.5, 96, 96.2, 93, 1500)])
    expect(tipos(s)).toContain('martelo')
    // mesmo candle depois de uma alta não é martelo
    const alta = [96, 97, 98, 99, 100].map((f, k) => b(40 + k, f - 0.5, f, f + 1, f - 1))
    expect(tipos(sinaisDeCandle([...calmo(), ...alta, b(45, 99.5, 100, 100.2, 97, 1500)]))).not.toContain('martelo')
  })

  it('engolfo de alta: corpo de alta cobre o corpo de baixa anterior, com mais volume, depois de queda', () => {
    const queda = [100, 99, 98, 97].map((f, k) => b(40 + k, f + 0.5, f, f + 1, f - 1))
    const s = sinaisDeCandle([...calmo(), ...queda, b(44, 97, 95.8, 97.3, 95.5, 1000), b(45, 95.6, 98.4, 98.6, 95.4, 2000)])
    expect(tipos(s)).toContain('engolfo-alta')
  })

  it('trap de fundo: fura o fundo dos últimos 10 candles e fecha de volta acima, em candle de alta', () => {
    const s = sinaisDeCandle([...calmo(), b(40, 99.2, 100.2, 100.6, 97.5, 1200)])
    const t = s.find((x) => x.tipo === 'trap-fundo')
    expect(t).toBeDefined()
    expect(t!.lado).toBe('compra')
    expect(t!.explicacao).toContain('99')
  })

  it('trap de topo e trap de banda superior', () => {
    const s = sinaisDeCandle([...calmo(), b(40, 100.8, 99.9, 103, 99.7, 1200)])
    expect(tipos(s)).toContain('trap-topo')
    expect(tipos(s)).toContain('trap-banda-alta')
  })

  it('sinalAtivo: devolve o mais recente que ainda vale, e nada se o último sinal é antigo', () => {
    const b1 = [...calmo(), b(40, 100, 103.2, 103.4, 100, 1500)]
    const s = sinaisDeCandle(b1)
    expect(sinalAtivo(s, b1.length)?.tipo).toBe('ignicao-alta')
    expect(sinalAtivo(s, b1.length + 10)).toBeNull()
    expect(sinalAtivo([], 50)).toBeNull()
  })
})

describe('faixaDoStop', () => {
  it('régua de aceitação do stop em % do gatilho', () => {
    expect(faixaDoStop(3)).toBe('curto')
    expect(faixaDoStop(5)).toBe('curto')
    expect(faixaDoStop(8)).toBe('medio')
    expect(faixaDoStop(12)).toBe('caro')
    expect(faixaDoStop(25)).toBe('inviavel')
  })
})
