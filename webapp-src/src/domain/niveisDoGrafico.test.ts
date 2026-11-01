import { describe, expect, it } from 'vitest'
import type { Barra } from './analiseTecnica'
import { aberturaDaSemana, bollinger, caixaDaBase, gapsAbertos, larguraDasBandas, mediaDe200Semanas, regimeDasBandas } from './niveisDoGrafico'

/** Dias úteis consecutivos a partir de uma segunda-feira (2025-10-06). */
function dia(i: number): string {
  const d = new Date('2025-10-06T12:00:00Z')
  let n = 0
  while (n < i) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++
  }
  return d.toISOString().slice(0, 10)
}

const barra = (i: number, fech: number, extra: Partial<Barra> = {}): Barra => ({ data: dia(i), fech, min: fech * 0.99, max: fech * 1.01, vol: 1000, ...extra })

describe('bollinger', () => {
  it('em série constante as bandas colapsam na média; começa só com a janela cheia', () => {
    const b = bollinger(Array.from({ length: 30 }, () => 10), 21, 2)
    expect(b.meio[19]).toBeNull()
    expect(b.superior[19]).toBeNull()
    expect(b.meio[20]).toBe(10)
    expect(b.superior[25]).toBeCloseTo(10, 10)
    expect(b.inferior[25]).toBeCloseTo(10, 10)
  })

  it('usa o desvio-padrão populacional: série alternando 9 e 11 dá desvio 1 e bandas em ±2', () => {
    const f = Array.from({ length: 22 }, (_, i) => (i % 2 === 0 ? 9 : 11))
    const b = bollinger(f, 20, 2)
    const i = f.length - 1
    expect(b.meio[i]).toBeCloseTo(10, 10)
    expect((b.superior[i] as number) - (b.meio[i] as number)).toBeCloseTo(2, 10)
    expect((b.meio[i] as number) - (b.inferior[i] as number)).toBeCloseTo(2, 10)
  })

  it('regime: bandas apertadas depois de um período largo são "estreitas"; alargando de repente são "abrindo"', () => {
    const volatil = Array.from({ length: 80 }, (_, i) => 20 + (i % 2 === 0 ? 3 : -3))
    const calmo = Array.from({ length: 40 }, () => 20)
    expect(regimeDasBandas(bollinger([...volatil, ...calmo]))).toBe('estreitas')
    const abre = [...volatil, ...calmo, 20, 21, 24]
    expect(regimeDasBandas(bollinger(abre))).toBe('abrindo')
    expect(regimeDasBandas(bollinger([1, 2, 3]))).toBeNull()
    expect(larguraDasBandas(bollinger([...volatil, ...calmo])).at(-1)).toBeCloseTo(0, 10)
  })
})

describe('aberturaDaSemana', () => {
  it('pega o primeiro pregão da semana do último candle e a abertura real quando existe', () => {
    const b = Array.from({ length: 8 }, (_, i) => barra(i, 10 + i))
    b[5] = { ...b[5], abe: 14.5 } // 06/10 + 5 pregões = segunda-feira 13/10
    const a = aberturaDaSemana(b)
    expect(a?.data).toBe(dia(5))
    expect(a?.preco).toBe(14.5)
    expect(a?.real).toBe(true)
    expect(a?.rotulo).toBe('abertura da semana de 13/10')
  })

  it('sem abertura real usa o fechamento da sexta anterior e avisa que é aproximada', () => {
    const b = Array.from({ length: 8 }, (_, i) => barra(i, 10 + i))
    const a = aberturaDaSemana(b)
    expect(a?.real).toBe(false)
    expect(a?.preco).toBe(14)
  })

  it('poucos candles devolvem null', () => {
    expect(aberturaDaSemana([barra(0, 10)])).toBeNull()
  })
})

describe('gapsAbertos', () => {
  it('gap de alta ainda aberto: espaço entre a máxima de um dia e a mínima do seguinte, com o ponto médio', () => {
    const b = [barra(0, 10), barra(1, 10.1), barra(2, 11, { min: 10.8, max: 11.2 }), barra(3, 11.1, { min: 10.9, max: 11.3 })]
    const g = gapsAbertos(b)
    expect(g).toHaveLength(1)
    expect(g[0].tipo).toBe('alta')
    expect(g[0].inferior).toBeCloseTo(10.1 * 1.01, 6)
    expect(g[0].superior).toBeCloseTo(10.8, 6)
    expect(g[0].meio).toBeCloseTo((10.1 * 1.01 + 10.8) / 2, 6)
    expect(g[0].preenchido).toBeCloseTo(0, 6)
  })

  it('o gap fecha quando um pregão posterior volta à borda de onde ele partiu', () => {
    const b = [barra(0, 10), barra(1, 11, { min: 10.8, max: 11.2 }), barra(2, 10.2, { min: 10.0, max: 10.9 })]
    expect(gapsAbertos(b)).toHaveLength(0)
  })

  it('preenchimento parcial encolhe o espaço aberto', () => {
    const b = [barra(0, 10, { min: 9.9, max: 10.1 }), barra(1, 11, { min: 10.9, max: 11.1 }), barra(2, 10.6, { min: 10.5, max: 11.0 })]
    const g = gapsAbertos(b)
    expect(g).toHaveLength(1)
    expect(g[0].superior).toBeCloseTo(10.5, 6)
    expect(g[0].preenchido).toBeCloseTo(0.4 / 0.8, 6)
  })

  it('gap de baixa e gap pequeno (abaixo de 0,8%) são tratados corretamente', () => {
    const baixa = [barra(0, 10, { min: 9.9, max: 10.1 }), barra(1, 9, { min: 8.8, max: 9.2 }), barra(2, 9.1, { min: 8.9, max: 9.3 })]
    const g = gapsAbertos(baixa)
    expect(g[0].tipo).toBe('baixa')
    expect(g[0].superior).toBeCloseTo(9.9, 6)
    const pequeno = [barra(0, 10, { min: 9.9, max: 10.1 }), barra(1, 10.2, { min: 10.12, max: 10.3 })]
    expect(gapsAbertos(pequeno)).toHaveLength(0)
  })
})

describe('mediaDe200Semanas', () => {
  it('só existe com 200 semanas de histórico e é a média dos fechamentos semanais', () => {
    const poucas = Array.from({ length: 100 }, (_, i) => barra(i, 10))
    expect(mediaDe200Semanas(poucas)).toBeNull()
    const muitas = Array.from({ length: 1100 }, (_, i) => barra(i, 20))
    const m = mediaDe200Semanas(muitas)
    expect(m?.preco).toBeCloseTo(20, 10)
    expect(m?.semanas).toBeGreaterThanOrEqual(200)
  })
})

describe('caixaDaBase', () => {
  it('acha a base lateral mais longa terminando no último candle', () => {
    const subida = Array.from({ length: 10 }, (_, i) => barra(i, 8 + i * 0.2))
    const lateral = Array.from({ length: 20 }, (_, i) => barra(10 + i, 10 + (i % 3) * 0.1))
    const c = caixaDaBase([...subida, ...lateral])
    expect(c).not.toBeNull()
    expect(c!.candles).toBeGreaterThanOrEqual(20)
    expect(c!.rompeu).toBeNull()
    expect(c!.indiceFim).toBe(29)
    expect(c!.topo).toBeGreaterThan(c!.fundo)
  })

  it('sem 12 candles laterais, ou com tendência forte, não há base', () => {
    expect(caixaDaBase(Array.from({ length: 30 }, (_, i) => barra(i, 10 + i)))).toBeNull()
    expect(caixaDaBase(Array.from({ length: 8 }, (_, i) => barra(i, 10)))).toBeNull()
  })

  it('o último candle fechando acima da base marca o rompimento, e a caixa termina no candle anterior', () => {
    const lateral = Array.from({ length: 20 }, (_, i) => barra(i, 10 + (i % 3) * 0.05))
    const rompe = barra(20, 12, { min: 11.8, max: 12.2 })
    const c = caixaDaBase([...lateral, rompe])
    expect(c?.rompeu).toBe('acima')
    expect(c?.indiceFim).toBe(19)
  })
})
