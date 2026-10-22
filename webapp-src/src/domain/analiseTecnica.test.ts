import { describe, expect, it } from 'vitest'
import {
  adxSerie, agregar, analisarTecnica, atrSerie, detectarPadroes, ema, estocasticoSerie, macdSerie, montarBarras, pivos, rsiSerie, tendenciaDoPeriodo,
  vieSDaNota, zonasDePreco,
} from './analiseTecnica'
import type { Barra, PontoSerie } from './analiseTecnica'

/** Dias úteis consecutivos (sem feriados) a partir de 2025-10-06. */
function datas(n: number): string[] {
  const saida: string[] = []
  const d = new Date('2025-10-06T12:00:00Z')
  while (saida.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) saida.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return saida
}

/** Série a partir de fechamentos; mínima e máxima a 1% do fechamento, volume fixo de R$ 20 mi (20.000 mil). */
function serieDe(fech: number[], vol = 20_000): { pregoes: string[]; pontos: PontoSerie[] } {
  return { pregoes: datas(fech.length), pontos: fech.map((c) => [c, c * 0.99, c * 1.01, vol]) }
}

const subindo = (n: number, de = 20, passo = 0.1) => Array.from({ length: n }, (_, i) => de + i * passo + Math.sin(i / 3) * 0.3)
const caindo = (n: number, de = 40, passo = 0.1) => Array.from({ length: n }, (_, i) => de - i * passo + Math.sin(i / 3) * 0.3)
const lateral = (n: number, centro = 30) => Array.from({ length: n }, (_, i) => centro + Math.sin(i / 2.2) * 0.9)

function barrasDe(fech: number[]): Barra[] {
  const s = serieDe(fech)
  return montarBarras(s.pregoes, s.pontos).barras
}

describe('indicadores', () => {
  it('IFR de uma série só de altas é 100 e de uma série só de quedas é 0', () => {
    const alta = rsiSerie(Array.from({ length: 30 }, (_, i) => 10 + i))
    expect(alta[29]).toBe(100)
    const queda = rsiSerie(Array.from({ length: 30 }, (_, i) => 50 - i))
    expect(queda[29]).toBe(0)
  })

  it('IFR de uma série constante é 50 e fica nulo antes de 14 candles', () => {
    const r = rsiSerie(Array(30).fill(10))
    expect(r[13]).toBeNull()
    expect(r[29]).toBe(50)
  })

  it('IFR bate com o exemplo clássico de Wilder (14 períodos)', () => {
    const f = [44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931, 46.0328, 45.614, 46.282, 46.282]
    // O primeiro IFR do exemplo de Wilder/StockCharts, no 15º fechamento, é 70,53.
    expect(rsiSerie(f)[14]).toBeCloseTo(70.53, 1)
  })

  it('EMA começa na média simples e reage mais rápido que a SMA a uma virada', () => {
    const v = [...Array(10).fill(10), ...Array(5).fill(20)]
    const e = ema(v, 5)
    expect(e[4]).toBe(10)
    expect(e[3]).toBeNull()
    expect(e[14] as number).toBeGreaterThan(18)
  })

  it('MACD de série em alta é positivo, e o histograma é a linha menos o sinal', () => {
    const f = subindo(120, 10, 0.3)
    const m = macdSerie(f)
    const i = f.length - 1
    expect(m.linha[i] as number).toBeGreaterThan(0)
    expect(m.hist[i]).toBeCloseTo((m.linha[i] as number) - (m.sinal[i] as number), 10)
    expect(m.linha[24]).toBeNull()
    expect(m.linha[25]).not.toBeNull()
  })

  it('estocástico pleno: 100 quando fecha na máxima da janela, 0 na mínima, e começa só com a janela cheia', () => {
    const alta: Barra[] = Array.from({ length: 30 }, (_, i) => ({ data: `d${i}`, fech: 10 + i, min: 9 + i, max: 10 + i, vol: 1 }))
    const e = estocasticoSerie(alta)
    expect(e.k[14]).toBeNull()
    expect(e.k[15]).not.toBeNull()
    expect(e.d[16]).toBeNull()
    expect(e.d[17]).not.toBeNull()
    expect(e.k[29] as number).toBeGreaterThan(90)
    const baixa = alta.map((b, i) => ({ ...b, fech: 40 - i, min: 39 - i, max: 40 - i }))
    expect(estocasticoSerie(baixa).k[29] as number).toBeLessThan(10)
    const plano = alta.map((b) => ({ ...b, fech: 10, min: 10, max: 10 }))
    expect(estocasticoSerie(plano).k[29]).toBe(50)
  })

  it('ATR de barras com amplitude constante de 2 é 2', () => {
    const b: Barra[] = Array.from({ length: 30 }, (_, i) => ({ data: `d${i}`, fech: 10, min: 9, max: 11, vol: 1 }))
    expect(atrSerie(b)[29]).toBeCloseTo(2, 10)
  })

  it('ADX é alto em tendência limpa e baixo em lateralidade', () => {
    const tend = barrasDe(Array.from({ length: 120 }, (_, i) => 10 + i * 0.4))
    const lat = barrasDe(lateral(120))
    expect(adxSerie(tend)[119] as number).toBeGreaterThan(40)
    expect(adxSerie(lat)[119] as number).toBeLessThan(25)
  })
})

describe('barras e períodos', () => {
  it('dia sem negócio repete o fechamento com volume zero e é contado; pregões antes do primeiro negócio saem', () => {
    const pregoes = datas(5)
    const { barras, diasSemNegocio } = montarBarras(pregoes, [null, [10, 9, 11, 5], null, [12, 11, 13, 7], [12, 12, 12, 1]])
    expect(barras).toHaveLength(4)
    expect(diasSemNegocio).toBe(1)
    expect(barras[1]).toMatchObject({ fech: 10, min: 10, max: 10, vol: 0 })
  })

  it('série menor que o número de pregões fica alinhada pela direita', () => {
    const pregoes = datas(10)
    const { barras } = montarBarras(pregoes, [[1, 1, 1, 1], [2, 2, 2, 2]])
    expect(barras.map((b) => b.data)).toEqual(pregoes.slice(8))
  })

  it('agrega em semanas (segunda a sexta) e meses com fechamento do último dia, extremos e soma do volume', () => {
    const b = barrasDe(Array.from({ length: 10 }, (_, i) => 10 + i)) // 2025-10-06 (seg) a 2025-10-17 (sex)
    const s = agregar(b, 'semana')
    expect(s).toHaveLength(2)
    expect(s[0]).toMatchObject({ data: '2025-10-10', fech: 14 })
    expect(s[0].min).toBeCloseTo(10 * 0.99, 10)
    expect(s[0].max).toBeCloseTo(14 * 1.01, 10)
    expect(s[0].vol).toBe(5 * 20_000)
    expect(agregar(b, 'mes')).toHaveLength(1)
  })

  it('pivôs ignoram o fim da série (ainda sem confirmação)', () => {
    const b = barrasDe([1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 6, 7])
    const { altos, baixos } = pivos(b, 2)
    expect(altos.map((p) => p.i)).toEqual([4])
    expect(baixos.map((p) => p.i)).toEqual([7])
  })
})

describe('tendência', () => {
  it('alta, baixa e consolidação em séries sintéticas', () => {
    expect(tendenciaDoPeriodo(barrasDe(subindo(200)), 'diario').leitura).toBe('alta')
    expect(tendenciaDoPeriodo(barrasDe(caindo(200)), 'diario').leitura).toBe('baixa')
    expect(tendenciaDoPeriodo(barrasDe(lateral(200)), 'diario').leitura).toBe('consolidacao')
  })

  it('poucos pregões: dados insuficientes, sem inventar leitura', () => {
    const t = tendenciaDoPeriodo(barrasDe(subindo(30)), 'diario')
    expect(t.leitura).toBe('insuficiente')
    expect(t.explicacao).toMatch(/insuficientes/)
  })

  it('o mensal é sempre marcado como histórico curto', () => {
    const mensal = agregar(barrasDe(subindo(260)), 'mes')
    const t = tendenciaDoPeriodo(mensal, 'mensal')
    expect(t.historicoCurto).toBe(true)
  })
})

describe('zonas e padrões', () => {
  it('acha uma resistência com vários toques e a coloca acima do preço', () => {
    // Sobe até 30, volta a 25, quatro vezes, e termina em 27.
    const ciclo = [...Array.from({ length: 10 }, (_, i) => 25 + i * 0.5), ...Array.from({ length: 10 }, (_, i) => 30 - i * 0.5)]
    const f = [...ciclo, ...ciclo, ...ciclo, ...ciclo, 26, 26.5, 27, 27, 27]
    const b = barrasDe(f)
    const zonas = zonasDePreco(b, 2)
    const res = zonas.find((z) => z.tipo === 'resistencia')
    expect(res).toBeDefined()
    expect(res!.superior).toBeGreaterThan(29.5)
    expect(res!.toques).toBeGreaterThanOrEqual(3)
    expect(res!.distanciaPct).toBeGreaterThan(5)
  })

  it('topo duplo só é confirmado com fechamento abaixo da linha de pescoço', () => {
    const base = (ultimoFech: number) => {
      const f: number[] = []
      for (let i = 0; i < 20; i++) f.push(20 + i * 0.5) // sobe a 29,5
      for (let i = 0; i < 12; i++) f.push(29.5 - i * 0.7) // cai a ~21,8
      for (let i = 0; i < 12; i++) f.push(21.8 + i * 0.65) // sobe a ~29,45
      for (let i = 0; i < 12; i++) f.push(29.45 - i * 0.7) // cai
      f.push(ultimoFech)
      return barrasDe(Array.from({ length: 30 }, () => 20).concat(f))
    }
    const emFormacao = detectarPadroes(base(24)).find((p) => p.nome === 'Topo duplo')
    expect(emFormacao?.confirmacao).toBe('em formacao')
    expect(emFormacao?.objetivo).toBeNull()
    const confirmado = detectarPadroes(base(19)).find((p) => p.nome === 'Topo duplo')
    expect(confirmado?.confirmacao).toBe('confirmado')
    expect(confirmado?.objetivo).toMatch(/R\$/)
  })

  it('série plana não inventa padrão de reversão', () => {
    const nomes = detectarPadroes(barrasDe(Array(120).fill(30))).map((p) => p.nome)
    expect(nomes).not.toContain('Topo duplo')
    expect(nomes).not.toContain('Fundo duplo')
    expect(nomes).not.toContain('Ombro-cabeça-ombro')
  })
})

describe('analisarTecnica', () => {
  it('devolve null com menos de 60 pregões', () => {
    const s = serieDe(subindo(40))
    expect(analisarTecnica({ ticker: 'TESTE3', ...s })).toBeNull()
  })

  it('série em alta: viés de alta, nota alta e hipótese operacional com risco-retorno coerente', () => {
    const s = serieDe(subindo(260, 20, 0.2))
    const a = analisarTecnica({ ticker: 'ALTA3', ...s })!
    expect(a.tendencia.diario.leitura).toBe('alta')
    expect(a.tendencia.semanal.leitura).toBe('alta')
    expect(a.pontuacao.total).toBeGreaterThanOrEqual(55)
    expect(['altista', 'moderadamente-altista']).toContain(a.pontuacao.vies)
    if (a.hipotese) {
      expect(a.hipotese.stop).toBeLessThan(a.hipotese.regiaoEntrada.inferior)
      expect(a.hipotese.alvos[0]).toBeGreaterThan(a.hipotese.regiaoEntrada.superior)
      expect(a.hipotese.riscoRetorno).toBeGreaterThanOrEqual(1)
    } else {
      expect(a.motivoSemHipotese).toBeTruthy()
    }
  })

  it('série em queda: viés de baixa e nenhuma hipótese de compra', () => {
    const a = analisarTecnica({ ticker: 'QUEDA3', ...serieDe(caindo(260, 50, 0.08)) })!
    expect(a.tendencia.diario.leitura).toBe('baixa')
    expect(['baixista', 'moderadamente-baixista']).toContain(a.pontuacao.vies)
    expect(a.hipotese).toBeNull()
    expect(a.motivoSemHipotese).toMatch(/viés/)
  })

  it('a nota é a média ponderada dos cinco componentes (30/20/20/15/15) e fica entre 0 e 100', () => {
    for (const f of [subindo(260), caindo(260), lateral(260)]) {
      const a = analisarTecnica({ ticker: 'X3', ...serieDe(f) })!
      const soma = a.pontuacao.componentes.reduce((s, c) => s + c.peso, 0)
      expect(soma).toBeCloseTo(1, 10)
      expect(a.pontuacao.componentes.map((c) => c.peso)).toEqual([0.3, 0.2, 0.2, 0.15, 0.15])
      const esperada = Math.round(a.pontuacao.componentes.reduce((s, c) => s + c.peso * c.nota, 0))
      expect(a.pontuacao.total).toBe(esperada)
      expect(a.pontuacao.total).toBeGreaterThanOrEqual(0)
      expect(a.pontuacao.total).toBeLessThanOrEqual(100)
      for (const c of a.pontuacao.componentes) {
        expect(c.nota).toBeGreaterThanOrEqual(0)
        expect(c.nota).toBeLessThanOrEqual(100)
      }
    }
  })

  it('salto de preço não confirmado derruba a confiança e entra nos avisos de qualidade', () => {
    const s = serieDe(subindo(260))
    const limpa = analisarTecnica({ ticker: 'A3', ...s })!
    const suja = analisarTecnica({ ticker: 'A3', ...s, alertas: [{ data: '2026-01-10', de: 40, para: 10 }] })!
    expect(suja.confianca.valor).toBeLessThan(limpa.confianca.valor)
    expect(suja.qualidade.avisos.join(' ')).toMatch(/não confirmado/)
  })

  it('liquidez baixa reduz a confiança e bloqueia a hipótese operacional', () => {
    const s = serieDe(subindo(260, 20, 0.08), 100) // R$ 100 mil por dia
    const a = analisarTecnica({ ticker: 'ILIQ3', ...s })!
    expect(a.volume.liquidez).toBe('baixa')
    expect(a.hipotese).toBeNull()
    expect(a.confianca.motivos.join(' ')).toMatch(/Liquidez baixa/)
  })

  it('o horizonte muda os pesos da tendência (longo prazo dá mais peso ao mensal)', () => {
    const s = serieDe(subindo(260))
    const curto = analisarTecnica({ ticker: 'A3', ...s, horizonte: 'curto' })!
    const longo = analisarTecnica({ ticker: 'A3', ...s, horizonte: 'longo' })!
    expect(curto.multitemporal.pesos.diario).toBeGreaterThan(longo.multitemporal.pesos.diario)
    expect(longo.multitemporal.pesos.mensal).toBeGreaterThan(curto.multitemporal.pesos.mensal)
  })

  it('compara com a referência de mercado quando ela existe', () => {
    const s = serieDe(subindo(260, 20, 0.2))
    const ref = serieDe(lateral(260, 100)).pontos
    const a = analisarTecnica({ ticker: 'A3', ...s, referencia: { ticker: 'BOVA11', serie: ref } })!
    expect(a.contexto?.referencia).toBe('BOVA11')
    expect(a.contexto?.relativo63 as number).toBeGreaterThan(0)
    expect(a.contexto?.linhaRelativa).toBe('melhorando')
  })

  it('não usa linguagem de promessa e traz sempre as três hipóteses condicionais', () => {
    const a = analisarTecnica({ ticker: 'A3', ...serieDe(lateral(260)) })!
    expect(a.cenarios.map((c) => c.nome)).toEqual(['altista', 'neutro', 'baixista'])
    const texto = JSON.stringify(a)
    expect(texto).not.toMatch(/garant|certeza de|vai subir|vai cair/i)
  })

  it('mercado sem direção declara a frase de ausência de sinal', () => {
    const a = analisarTecnica({ ticker: 'A3', ...serieDe(lateral(260)) })!
    if (a.conclusao.semSinal) expect(a.conclusao.resumo).toMatch(/Sem sinal técnico suficientemente consistente neste momento/)
    expect(a.pontuacao.vies).toBe(vieSDaNota(a.pontuacao.total))
  })

  it('sinais históricos têm data, direção e, quando há 10 pregões depois, o retorno seguinte', () => {
    const a = analisarTecnica({ ticker: 'A3', ...serieDe(lateral(260)) })!
    expect(a.sinais.length).toBeGreaterThan(0)
    for (const s of a.sinais) {
      expect(s.data).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(['alta', 'baixa']).toContain(s.direcao)
    }
    expect(a.sinais.some((s) => s.retorno10 !== null)).toBe(true)
  })
})
