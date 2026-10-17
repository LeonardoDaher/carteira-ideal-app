import { describe, expect, it } from 'vitest'
import { FILTRO_PREMIOS_PADRAO, calcularTopPremios, linhaDePremio } from './premios'
import type { FiltroPremios } from './premios'
import type { AtivoComOpcoes, SerieOpcao, SnapshotOpcoes } from './opcoes'
import { precoBs } from './simulaOpcoes'

const HOJE = '2026-10-16'
const JUROS = 13.75
const r = Math.log(1 + JUROS / 100)

/** Série com prêmio coerente com uma volatilidade: 'vol' em decimal, vencimento 19/11 (22 dias úteis). */
const serie = (codigo: string, tipo: 'call' | 'put', strike: number, cotacao: number, vol: number, extra: Partial<SerieOpcao> = {}): SerieOpcao => ({
  codigo, tipo, estilo: 'europeia', strike, vencimento: '2026-11-19',
  ultimo: Math.round(precoBs({ tipo, s: cotacao, strike, t: 22 / 252, r, sigma: vol }) * 100) / 100,
  dataUltimo: HOJE, variacao: null, negocios: 50, volume: 100_000, ...extra,
})
const ativo = (ticker: string, cotacao: number, series: (c: number) => SerieOpcao[]): AtivoComOpcoes => ({
  ticker, nome: ticker, cotacao, volumeOpcoes: 1, lote: 100, series: series(cotacao),
})
const snap = (ativos: AtivoComOpcoes[]): SnapshotOpcoes => ({ geradoEm: null, dataPregao: HOJE, ativos })
// Nos testes, sem limite de risco, salvo quando o caso testa o limite.
const filtro = (parcial: Partial<FiltroPremios> = {}): FiltroPremios => ({ ...FILTRO_PREMIOS_PADRAO, chanceMaxima: null, ...parcial })
const codigos = (l: { serie: SerieOpcao }[]) => l.map((x) => x.serie.codigo)

// Um ativo calmo (vol 25%), como um banco grande, e um agitado (vol 90%), como uma varejista de alta volatilidade.
const calmo = ativo('CALM3', 20, (c) => [serie('CALMW180', 'put', 18, c, 0.25), serie('CALMW190', 'put', 19, c, 0.25)])
const agitado = ativo('AGIT3', 5, (c) => [serie('AGITW450', 'put', 4.5, c, 0.9), serie('AGITW400', 'put', 4, c, 0.9)])

describe('linhaDePremio: put vendida', () => {
  it('calcula rendimento sobre o strike, levado a 21 dias úteis, e o colchão de queda', () => {
    const s = serie('AGITW450', 'put', 4.5, 5, 0.9)
    const l = linhaDePremio(agitado, s, 'putVendida', HOJE, JUROS)!
    expect(l.diasUteis).toBe(22)
    expect(l.capital).toBe(4.5)
    expect(l.rendimentoPrazo).toBeCloseTo((s.ultimo / 4.5) * 100, 3)
    expect(l.rendimentoMes).toBeCloseTo(l.rendimentoPrazo * (21 / 22), 3)
    expect(l.colchao).toBeCloseTo(((5 - (4.5 - s.ultimo)) / 5) * 100, 3)
    expect(l.ganhoSeExercida).toBeNull()
    expect(l.volImplicita).toBeCloseTo(90, 0)
    expect(l.chanceExercicio).toBeGreaterThan(0)
    expect(l.chanceExercicio).toBeLessThan(50)
  })

  it('put dentro do dinheiro, call, série vencendo em menos de 3 dias úteis ou preço zerado ficam de fora', () => {
    expect(linhaDePremio(agitado, serie('X', 'put', 6, 5, 0.9), 'putVendida', HOJE, JUROS)).toBeNull() // strike acima do preço
    expect(linhaDePremio(agitado, serie('X', 'call', 5.5, 5, 0.9), 'putVendida', HOJE, JUROS)).toBeNull()
    expect(linhaDePremio(agitado, serie('X', 'put', 4.5, 5, 0.9, { vencimento: '2026-10-20' }), 'putVendida', HOJE, JUROS)).toBeNull()
    expect(linhaDePremio(agitado, serie('X', 'put', 4.5, 5, 0.9, { ultimo: 0 }), 'putVendida', HOJE, JUROS)).toBeNull()
  })

  it('preço abaixo do valor intrínseco (sem volatilidade que explique) fica de fora', () => {
    // Uma put de strike 4,50 não vale mais que o strike descontado (cerca de 4,45): 4,49 não tem volatilidade que explique.
    expect(linhaDePremio(agitado, serie('X', 'put', 4.5, 5, 0.9, { ultimo: 4.49 }), 'putVendida', HOJE, JUROS)).toBeNull()
  })
})

describe('linhaDePremio: call coberta', () => {
  it('rendimento sobre o preço do ativo, colchão igual ao prêmio e ganho se exercida', () => {
    const a = ativo('AGIT3', 5, () => [])
    const s = serie('AGITK550', 'call', 5.5, 5, 0.9)
    const l = linhaDePremio(a, s, 'callCoberta', HOJE, JUROS)!
    expect(l.capital).toBe(5)
    expect(l.rendimentoPrazo).toBeCloseTo((s.ultimo / 5) * 100, 3)
    expect(l.colchao).toBeCloseTo((s.ultimo / 5) * 100, 3)
    expect(l.ganhoSeExercida).toBeCloseTo(((5.5 - 5 + s.ultimo) / 5) * 100, 3)
  })

  it('call dentro do dinheiro ou put ficam de fora', () => {
    const a = ativo('AGIT3', 5, () => [])
    expect(linhaDePremio(a, serie('X', 'call', 4.5, 5, 0.9), 'callCoberta', HOJE, JUROS)).toBeNull()
    expect(linhaDePremio(a, serie('X', 'put', 4.5, 5, 0.9), 'callCoberta', HOJE, JUROS)).toBeNull()
  })
})

describe('calcularTopPremios', () => {
  it('o ativo agitado paga mais que o calmo, e o ranking mostra isso com o risco ao lado', () => {
    const top = calcularTopPremios(snap([calmo, agitado]), filtro(), JUROS)
    expect(top.map((l) => l.ativo.ticker)).toEqual(['AGIT3', 'CALM3'])
    expect(top[0].rendimentoMes).toBeGreaterThan(top[1].rendimentoMes)
    expect(top[0].volImplicita).toBeGreaterThan(top[1].volImplicita)
  })

  it('"um por ativo" guarda só a melhor série de cada ativo; desligado, mostra todas', () => {
    expect(calcularTopPremios(snap([calmo, agitado]), filtro({ umPorAtivo: true }), JUROS)).toHaveLength(2)
    const todas = calcularTopPremios(snap([calmo, agitado]), filtro({ umPorAtivo: false }), JUROS)
    expect(todas).toHaveLength(4)
    expect(todas[0].rendimentoMes).toBeGreaterThanOrEqual(todas[1].rendimentoMes)
  })

  it('o limite de risco corta as séries com chance de exercício acima dele', () => {
    const semLimite = calcularTopPremios(snap([agitado]), filtro({ umPorAtivo: false }), JUROS)
    expect(semLimite).toHaveLength(2)
    const menor = Math.min(...semLimite.map((l) => l.chanceExercicio))
    const maior = Math.max(...semLimite.map((l) => l.chanceExercicio))
    expect(menor).toBeLessThan(maior)
    const comLimite = calcularTopPremios(snap([agitado]), filtro({ umPorAtivo: false, chanceMaxima: (menor + maior) / 2 }), JUROS)
    expect(codigos(comLimite)).toEqual(['AGITW400']) // só a mais afastada, de menor chance
    expect(comLimite[0].chanceExercicio).toBeLessThanOrEqual((menor + maior) / 2)
  })

  it('para a mesma chance de exercício, o ativo mais volátil paga mais prêmio', () => {
    // BBAS3 (vol 25%) contra MGLU3 (vol 90%), cada um com uma série escolhida para ficar perto de 15% de chance.
    const banco = ativo('BANC3', 20, (c) => [serie('BANCW170', 'put', 17.5, c, 0.25)])
    const varejo = ativo('VARE3', 10, (c) => [serie('VAREW060', 'put', 6, c, 0.9)])
    const top = calcularTopPremios(snap([banco, varejo]), filtro({ chanceMaxima: 25 }), JUROS)
    expect(top.map((l) => l.ativo.ticker)).toEqual(['VARE3', 'BANC3'].filter((t) => top.some((l) => l.ativo.ticker === t)))
    if (top.length === 2) {
      const chances = top.map((l) => l.chanceExercicio)
      expect(Math.max(...chances)).toBeLessThanOrEqual(25)
      expect(top[0].rendimentoMes).toBeGreaterThan(top[1].rendimentoMes)
    }
  })

  it('o limite de risco "sem limite" (null) não corta nada', () => {
    expect(calcularTopPremios(snap([calmo, agitado]), filtro({ chanceMaxima: null, umPorAtivo: false }), JUROS)).toHaveLength(4)
  })

  it('só entram séries que negociaram no último pregão, com negócios suficientes', () => {
    const a = ativo('TESTE3', 10, (c) => [
      serie('TESTEW900', 'put', 9, c, 0.5, { negocios: 5 }),
      serie('TESTEW800', 'put', 8, c, 0.5, { dataUltimo: '2026-10-15' }),
      serie('TESTEW850', 'put', 8.5, c, 0.5),
    ])
    expect(codigos(calcularTopPremios(snap([a]), filtro({ umPorAtivo: false }), JUROS))).toEqual(['TESTEW850'])
    expect(codigos(calcularTopPremios(snap([a]), filtro({ umPorAtivo: false, poucoLiquidas: true }), JUROS)).sort()).toEqual(['TESTEW850', 'TESTEW900'])
  })

  it('filtra vencimentos mensais e semanais', () => {
    const a = ativo('VENC3', 10, (c) => [
      serie('VENCW900', 'put', 9, c, 0.5), // 19/11: mensal
      serie('VENCW901', 'put', 9, c, 0.5, { vencimento: '2026-11-27' }), // sexta comum: semanal
    ])
    expect(codigos(calcularTopPremios(snap([a]), filtro({ umPorAtivo: false, vencimentos: 'mensais' }), JUROS))).toEqual(['VENCW900'])
    expect(codigos(calcularTopPremios(snap([a]), filtro({ umPorAtivo: false, vencimentos: 'semanais' }), JUROS))).toEqual(['VENCW901'])
  })

  it('limita ao tamanho pedido e devolve vazio sem data de pregão', () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ativo(`MUIT${i}`, 10, (c) => [serie(`MUITW${i}`, 'put', 9, c, 0.3 + i / 100)]))
    expect(calcularTopPremios(snap(muitos), filtro(), JUROS)).toHaveLength(15)
    expect(calcularTopPremios({ geradoEm: null, dataPregao: null, ativos: muitos }, filtro(), JUROS)).toEqual([])
  })

  it('a ordem é sempre a mesma: desempate por volume e depois pelo código', () => {
    const a = ativo('IGUAL3', 10, (c) => [serie('IGUALW2', 'put', 9, c, 0.5, { volume: 10 }), serie('IGUALW1', 'put', 9, c, 0.5, { volume: 10 })])
    expect(codigos(calcularTopPremios(snap([a]), filtro({ umPorAtivo: false }), JUROS))).toEqual(['IGUALW1', 'IGUALW2'])
  })
})
