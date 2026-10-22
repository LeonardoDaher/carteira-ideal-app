import { describe, expect, it } from 'vitest'
import {
  analisarSerie, atrPct, cenariosDePreco, curvaDI, dataVencimentoDI, diasUteisAproximados, ehDiaUtil, feriadosNacionais, ifr, mediaMovel, puDI, resultadoDI,
  resultadoPosicao, resumoCurva, rotuloVencimento, taxaATermo, taxaDoPU,
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
    expect(dataVencimentoDI('2027-01')).toBe('2027-01-04') // 1º/01 é feriado (sexta); o próximo dia útil é segunda
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

describe('dias úteis e feriados', () => {
  it('feriados móveis de 2026 seguem a Páscoa de 5 de abril', () => {
    const f = feriadosNacionais(2026)
    expect(f.has('2026-02-16')).toBe(true) // segunda de Carnaval
    expect(f.has('2026-02-17')).toBe(true) // terça de Carnaval
    expect(f.has('2026-04-03')).toBe(true) // sexta-feira santa
    expect(f.has('2026-06-04')).toBe(true) // Corpus Christi
  })

  it('Consciência Negra é feriado nacional só a partir de 2024; 24 e 31 de dezembro são dias úteis', () => {
    expect(feriadosNacionais(2026).has('2026-11-20')).toBe(true)
    expect(feriadosNacionais(2023).has('2023-11-20')).toBe(false)
    expect(ehDiaUtil(new Date('2026-12-24T12:00:00Z'))).toBe(true)
    expect(ehDiaUtil(new Date('2026-12-25T12:00:00Z'))).toBe(false)
  })

  it('conta os dias úteis descontando feriados e fim de semana', () => {
    // 24, 28, 29, 30, 31 de dezembro e 4 de janeiro (25/12 e 1º/01 são feriados)
    expect(diasUteisAproximados('2026-12-23', '2027-01-04')).toBe(6)
  })
})

describe('taxaATermo', () => {
  it('curva plana tem taxa a termo igual à taxa', () => {
    expect(taxaATermo(10, 252, 10, 504)).toBeCloseTo(10, 6)
  })

  it('de 10% em 1 ano para 11% em 2 anos, a termo é cerca de 12,01%', () => {
    expect(taxaATermo(10, 252, 11, 504)).toBeCloseTo(12.0091, 3)
  })

  it('sem prazo entre os vértices, não há taxa a termo', () => {
    expect(taxaATermo(10, 252, 11, 252)).toBeNull()
  })
})

describe('curvaDI', () => {
  const dataPregao = '2026-10-21'
  const contrato = (ticker: string, vencimento: string, taxa: number) => ({
    ticker,
    vencimento,
    ajuste: puDI(taxa, diasUteisAproximados(dataPregao, dataVencimentoDI(vencimento))),
    ajusteAnterior: null,
    abertura: null,
    maxima: null,
    minima: null,
    ultimo: null,
    volume: null,
    posicaoAberta: null,
  })

  it('recupera a taxa de cada vencimento a partir do PU de ajuste, em ordem de vencimento', () => {
    const curva = curvaDI([contrato('DI1F28', '2028-01', 12), contrato('DI1F27', '2027-01', 12), contrato('DI1N27', '2027-07', 12)], dataPregao)
    expect(curva.map((p) => p.ticker)).toEqual(['DI1F27', 'DI1N27', 'DI1F28'])
    for (const p of curva) expect(p.taxa).toBeCloseTo(12, 6)
    expect(curva[0].taxaATermo).toBeNull()
    expect(curva[1].taxaATermo).toBeCloseTo(12, 5)
  })

  it('deixa de fora vencimentos com menos de 5 dias úteis e descreve a curva plana', () => {
    const curva = curvaDI([contrato('DI1V26', '2026-10', 12), contrato('DI1F27', '2027-01', 12), contrato('DI1N27', '2027-07', 12.1)], dataPregao)
    expect(curva.map((p) => p.ticker)).toEqual(['DI1F27', 'DI1N27'])
    expect(resumoCurva(curva)?.formato).toBe('plana')
  })

  it('curva que sobe é inclinada para cima; que desce, para baixo', () => {
    const sobe = curvaDI([contrato('DI1F27', '2027-01', 12), contrato('DI1N27', '2027-07', 13), contrato('DI1F28', '2028-01', 14)], dataPregao)
    expect(resumoCurva(sobe)?.formato).toBe('inclinada para cima')
    const desce = curvaDI([contrato('DI1F27', '2027-01', 14), contrato('DI1N27', '2027-07', 13), contrato('DI1F28', '2028-01', 12)], dataPregao)
    expect(resumoCurva(desce)?.formato).toBe('inclinada para baixo')
  })
})
