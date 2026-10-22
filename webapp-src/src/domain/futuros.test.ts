import { describe, expect, it } from 'vitest'
import {
  analisarSerie, atrPct, cenariosDePreco, dataVencimentoDI, diasUteisAproximados, ifr, mediaMovel, puDI, resultadoDI,
  resultadoPosicao, rotuloVencimento, taxaDoPU,
} from './futuros'
import type { Candle } from './futuros'

describe('resultadoPosicao', () => {
  it('mini índice comprado: 1.000 pontos de alta em 2 contratos = R$ 400 (R$ 0,20 por ponto)', () => {
    const r = resultadoPosicao({ lado: 'compra', contratos: 2, entrada: 130_000, saida: 131_000, multiplicador: 0.2, margemPorContrato: 100 })
    expect(r.porContrato).toBe(1000)
    expect(r.total).toBeCloseTo(400, 6)
    expect(r.margemTotal).toBe(200)
    expect(r.sobreMargemPct).toBeCloseTo(200, 6)
  })

  it('vendido ganha quando o preço cai e perde quando sobe', () => {
    const cai = resultadoPosicao({ lado: 'venda', contratos: 1, entrada: 5.5, saida: 5.4, multiplicador: 10_000, margemPorContrato: 0 })
    expect(cai.total).toBeCloseTo(1000, 6)
    const sobe = resultadoPosicao({ lado: 'venda', contratos: 1, entrada: 5.5, saida: 5.6, multiplicador: 10_000, margemPorContrato: 0 })
    expect(sobe.total).toBeCloseTo(-1000, 6)
  })

  it('sem margem informada, não calcula percentual sobre a margem', () => {
    const r = resultadoPosicao({ lado: 'compra', contratos: 1, entrada: 100, saida: 110, multiplicador: 1, margemPorContrato: 0 })
    expect(r.sobreMargemPct).toBeNull()
    expect(r.variacaoPct).toBeCloseTo(10, 6)
  })
})

describe('cenariosDePreco', () => {
  it('aplica a variação e arredonda para o tick', () => {
    const c = cenariosDePreco(130_000, [-1, 1], 5)
    expect(c).toEqual([
      { pct: -1, preco: 128_700 },
      { pct: 1, preco: 131_300 },
    ])
  })
})

describe('DI1', () => {
  it('PU e taxa são inversos', () => {
    const pu = puDI(12.5, 252)
    expect(pu).toBeCloseTo(100_000 / 1.125, 4)
    expect(taxaDoPU(pu, 252)).toBeCloseTo(12.5, 6)
  })

  it('dias úteis aproximados: exclui a data inicial, inclui a final e pula fim de semana', () => {
    // 2026-10-22 (quinta) até 2026-10-26 (segunda): sexta e segunda
    expect(diasUteisAproximados('2026-10-22', '2026-10-26')).toBe(2)
    expect(diasUteisAproximados('2026-10-26', '2026-10-22')).toBe(0)
  })

  it('o vencimento é o primeiro dia útil do mês', () => {
    expect(dataVencimentoDI('2027-01')).toBe('2027-01-01') // sexta (feriado ignorado de propósito)
    expect(dataVencimentoDI('2026-08')).toBe('2026-08-03') // 1º/08/2026 é sábado
  })

  it('comprado ganha com a queda da taxa; vendido, com a alta', () => {
    const base = { contratos: 1, taxaEntrada: 12.5, diasAteVencimento: 252, diasNaPosicao: 0, margemPorContrato: 0 }
    expect(resultadoDI({ ...base, lado: 'compra', taxaSaida: 12 }).total).toBeGreaterThan(0)
    expect(resultadoDI({ ...base, lado: 'compra', taxaSaida: 13 }).total).toBeLessThan(0)
    expect(resultadoDI({ ...base, lado: 'venda', taxaSaida: 13 }).total).toBeGreaterThan(0)
  })

  it('sem mudar a taxa, o tempo passando já dá ganho ao comprado (o PU rende a taxa)', () => {
    const r = resultadoDI({ lado: 'compra', contratos: 1, taxaEntrada: 12, taxaSaida: 12, diasAteVencimento: 252, diasNaPosicao: 21, margemPorContrato: 0 })
    expect(r.total).toBeGreaterThan(0)
  })
})

describe('indicadores', () => {
  it('média móvel só aparece com candles suficientes', () => {
    expect(mediaMovel([1, 2, 3, 4], 3)).toEqual([null, null, 2, 3])
  })

  it('IFR: série só de altas dá 100; só de quedas dá 0; sem candles suficientes é null', () => {
    const alta = Array.from({ length: 30 }, (_, i) => 100 + i)
    const baixa = Array.from({ length: 30 }, (_, i) => 100 - i)
    expect(ifr(alta)).toBe(100)
    expect(ifr(baixa)).toBe(0)
    expect(ifr([1, 2, 3])).toBeNull()
  })

  it('ATR em % do preço', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, i) => [`2026-01-${String(i + 1).padStart(2, '0')}`, 100, 102, 98, 100, 10])
    expect(atrPct(candles)).toBeCloseTo(4, 6)
  })
})

function serie(fechamentos: number[]): Candle[] {
  return fechamentos.map((c, i) => [`d${i}`, c, c * 1.01, c * 0.99, c, 100 + i])
}

describe('analisarSerie', () => {
  it('precisa de pelo menos 63 candles', () => {
    expect(analisarSerie(serie(Array.from({ length: 62 }, (_, i) => 100 + i)))).toBeNull()
  })

  it('preço subindo de forma consistente é leitura de alta', () => {
    const a = analisarSerie(serie(Array.from({ length: 100 }, (_, i) => 100 + i)))
    expect(a?.leitura).toBe('alta')
    expect(a?.posicao52s).toBeGreaterThan(90)
    expect(a?.motivos.length).toBeGreaterThan(3)
  })

  it('preço caindo de forma consistente é leitura de baixa', () => {
    expect(analisarSerie(serie(Array.from({ length: 100 }, (_, i) => 200 - i)))?.leitura).toBe('baixa')
  })

  it('preço andando de lado é lateral', () => {
    const lado = Array.from({ length: 100 }, (_, i) => 100 + (i % 2 ? 0.5 : -0.5))
    expect(analisarSerie(serie(lado))?.leitura).toBe('lateral')
  })

  it('suporte e resistência vêm dos últimos 20 candles', () => {
    const a = analisarSerie(serie(Array.from({ length: 100 }, (_, i) => 100 + i)))!
    expect(a.minima20).toBeCloseTo(180 * 0.99, 6)
    expect(a.maxima20).toBeCloseTo(199 * 1.01, 6)
  })
})

describe('rotuloVencimento', () => {
  it('abrevia o mês', () => {
    expect(rotuloVencimento('2026-12')).toBe('dez/26')
    expect(rotuloVencimento('2027-01')).toBe('jan/27')
  })
})
