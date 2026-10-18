import { describe, expect, it } from 'vitest'
import {
  DIAS_UTEIS_ANO, analisarEstimado, chanceDeExercicio, analisar, cdfNormal, custoDeMontagem, diasAtePrimeiroVencimento, gregas, gregasDaPosicao,
  montarPosicao, precoBs, resultadoAntesDoVencimento, resultadoNoVencimento, temVariosVencimentos, validarEntrada, volatilidadeImplicita,
} from './simulaOpcoes'
import type { EntradaEstrategia, Posicao } from './simulaOpcoes'

const base: EntradaEstrategia = { estrategia: 'compraCall', precoAtivo: 10, strikeBaixo: 10, premioBaixo: 1, strikeAlto: 12, premioAlto: 0.5, quantidade: 100 }
const pos = (o: Partial<EntradaEstrategia>) => montarPosicao({ ...base, ...o })

describe('payoff no vencimento', () => {
  it('compra de call: perde o prêmio abaixo do strike e ganha sem limite acima do equilíbrio', () => {
    const p = pos({})
    expect(resultadoNoVencimento(p, 8)).toBe(-100)
    expect(resultadoNoVencimento(p, 11)).toBeCloseTo(0)
    expect(resultadoNoVencimento(p, 15)).toBe(400)
    expect(analisar(p)).toEqual({ ganhoMaximo: null, perdaMaxima: -100, equilibrios: [11] })
  })

  it('compra de put: ganho máximo com o ativo a zero, perda limitada ao prêmio', () => {
    const p = pos({ estrategia: 'compraPut', premioBaixo: 0.8 })
    expect(analisar(p)).toEqual({ ganhoMaximo: 920, perdaMaxima: -80, equilibrios: [9.2] })
  })

  it('venda de call descoberta: ganho limitado ao prêmio e perda sem limite', () => {
    const p = pos({ estrategia: 'vendaCall', strikeBaixo: 11, premioBaixo: 0.5 })
    expect(analisar(p)).toEqual({ ganhoMaximo: 50, perdaMaxima: null, equilibrios: [11.5] })
    expect(resultadoNoVencimento(p, 20)).toBeCloseTo(-850)
    expect(custoDeMontagem(p)).toBe(50)
  })

  it('venda de put: ganho limitado ao prêmio e perda máxima com o ativo a zero', () => {
    const p = pos({ estrategia: 'vendaPut', strikeBaixo: 10, premioBaixo: 0.8 })
    expect(analisar(p)).toEqual({ ganhoMaximo: 80, perdaMaxima: -920, equilibrios: [9.2] })
    expect(resultadoNoVencimento(p, 12)).toBe(80)
    expect(resultadoNoVencimento(p, 9)).toBeCloseTo(-20)
  })

  it('venda coberta: ganho limitado ao strike mais o prêmio, perda se o ativo cair', () => {
    const p = pos({ estrategia: 'vendaCoberta', strikeBaixo: 11, premioBaixo: 0.5 })
    expect(resultadoNoVencimento(p, 20)).toBeCloseTo(150)
    expect(analisar(p)).toEqual({ ganhoMaximo: 150, perdaMaxima: -950, equilibrios: [9.5] })
    expect(custoDeMontagem(p)).toBe(50)
  })

  it('trava de alta: ganho e perda limitados, equilíbrio entre os strikes', () => {
    const p = pos({ estrategia: 'travaAlta', strikeBaixo: 10, premioBaixo: 1.5, strikeAlto: 12, premioAlto: 0.5 })
    expect(analisar(p)).toEqual({ ganhoMaximo: 100, perdaMaxima: -100, equilibrios: [11] })
    expect(custoDeMontagem(p)).toBe(-100)
  })

  it('trava de baixa: compra a put do strike alto e vende a do baixo', () => {
    const p = pos({ estrategia: 'travaBaixa', strikeBaixo: 10, premioBaixo: 0.4, strikeAlto: 12, premioAlto: 1.4 })
    expect(analisar(p)).toEqual({ ganhoMaximo: 100, perdaMaxima: -100, equilibrios: [11] })
  })
})

describe('validação', () => {
  it('aceita a entrada padrão e recusa quantidade, strike e travas fora de ordem', () => {
    expect(validarEntrada(base)).toBeNull()
    expect(validarEntrada({ ...base, quantidade: 0 })).toMatch(/quantidade/i)
    expect(validarEntrada({ ...base, strikeBaixo: 0 })).toMatch(/strike/i)
    expect(validarEntrada({ ...base, estrategia: 'travaAlta', strikeAlto: 9 })).toMatch(/maior/i)
    expect(validarEntrada({ ...base, estrategia: 'vendaCoberta', precoAtivo: 0 })).toMatch(/preço/i)
  })
})

describe('Black-Scholes', () => {
  it('cdfNormal bate com valores conhecidos', () => {
    expect(cdfNormal(0)).toBeCloseTo(0.5, 6)
    expect(cdfNormal(1.96)).toBeCloseTo(0.975, 3)
    expect(cdfNormal(-1)).toBeCloseTo(0.158655, 5)
  })

  it('preço de referência (S=100, K=100, 1 ano, r=5%, vol=20%): call 10,45 e put 5,57', () => {
    const x = { s: 100, strike: 100, t: 1, r: 0.05, sigma: 0.2 }
    expect(precoBs({ ...x, tipo: 'call' })).toBeCloseTo(10.4506, 3)
    expect(precoBs({ ...x, tipo: 'put' })).toBeCloseTo(5.5735, 3)
  })

  it('paridade put-call e sinais das gregas', () => {
    const x = { s: 100, strike: 105, t: 0.5, r: 0.1, sigma: 0.3 }
    const c = precoBs({ ...x, tipo: 'call' })
    const pt = precoBs({ ...x, tipo: 'put' })
    expect(c - pt).toBeCloseTo(100 - 105 * Math.exp(-0.1 * 0.5), 6)
    const g = gregas({ ...x, tipo: 'call' })
    expect(g.delta).toBeGreaterThan(0)
    expect(g.delta).toBeLessThan(1)
    expect(g.teta).toBeLessThan(0)
    expect(g.vega).toBeGreaterThan(0)
    expect(gregas({ ...x, tipo: 'put' }).delta).toBeCloseTo(g.delta - 1, 8)
  })

  it('no vencimento vale o valor intrínseco', () => {
    expect(precoBs({ tipo: 'call', s: 12, strike: 10, t: 0, r: 0.1, sigma: 0.3 })).toBe(2)
    expect(precoBs({ tipo: 'put', s: 12, strike: 10, t: 0, r: 0.1, sigma: 0.3 })).toBe(0)
  })

  it('volatilidade implícita devolve a vol usada para gerar o prêmio; sem solução devolve null', () => {
    const b = { tipo: 'call' as const, s: 50, strike: 52, t: 0.25, r: 0.12 }
    const premio = precoBs({ ...b, sigma: 0.37 })
    expect(volatilidadeImplicita(b, premio)).toBeCloseTo(0.37, 4)
    expect(volatilidadeImplicita(b, 0)).toBeNull()
    expect(volatilidadeImplicita({ ...b, strike: 10 }, 5)).toBeNull() // abaixo do intrínseco (cerca de 40)
  })
})

describe('antes do vencimento', () => {
  const m = { dias: 30, r: 0.12, sigma: 0.35 }

  it('com o prêmio justo, hoje o resultado é zero; no vencimento coincide com o payoff', () => {
    const premio = precoBs({ tipo: 'call', s: 10, strike: 10, t: 30 / 252, r: 0.12, sigma: 0.35 })
    const p = pos({ premioBaixo: premio })
    expect(resultadoAntesDoVencimento(p, 10, m, 0)).toBeCloseTo(0, 6)
    expect(resultadoAntesDoVencimento(p, 13, m, 30)).toBeCloseTo(resultadoNoVencimento(p, 13), 8)
  })

  it('o tempo corrói a call comprada: com o ativo parado, passar dias reduz o resultado', () => {
    const p = pos({ premioBaixo: 0.5 })
    expect(resultadoAntesDoVencimento(p, 10, m, 15)).toBeLessThan(resultadoAntesDoVencimento(p, 10, m, 0))
  })

  it('gregas da posição: compra de call tem delta positivo e teta negativo; a venda coberta tem teta positivo', () => {
    const g = gregasDaPosicao(pos({}), 10, m)
    expect(g.delta).toBeGreaterThan(0)
    expect(g.teta).toBeLessThan(0)
    const coberta = gregasDaPosicao(pos({ estrategia: 'vendaCoberta', strikeBaixo: 11 }), 10, m)
    expect(coberta.delta).toBeGreaterThan(0)
    expect(coberta.delta).toBeLessThan(100)
    expect(coberta.teta).toBeGreaterThan(0)
  })
})

describe('chance de exercício', () => {
  const base = { s: 100, strike: 100, t: 0.25, r: 0.1, sigma: 0.3 }

  it('call e put no dinheiro ficam perto de metade; a put é o complemento da call', () => {
    const c = chanceDeExercicio({ ...base, tipo: 'call' })
    const p = chanceDeExercicio({ ...base, tipo: 'put' })
    expect(c).toBeGreaterThan(0.4)
    expect(c).toBeLessThan(0.6)
    expect(c + p).toBeCloseTo(1, 10)
  })

  it('put fora do dinheiro tem chance menor, e cai mais ainda com o strike mais longe ou a volatilidade menor', () => {
    const perto = chanceDeExercicio({ ...base, tipo: 'put', strike: 95 })
    const longe = chanceDeExercicio({ ...base, tipo: 'put', strike: 80 })
    const calmo = chanceDeExercicio({ ...base, tipo: 'put', strike: 95, sigma: 0.15 })
    expect(perto).toBeLessThan(0.4)
    expect(longe).toBeLessThan(perto)
    expect(calmo).toBeLessThan(perto)
  })

  it('sem tempo ou sem volatilidade, é 0 ou 1 conforme o dinheiro', () => {
    expect(chanceDeExercicio({ ...base, tipo: 'put', strike: 105, t: 0 })).toBe(1)
    expect(chanceDeExercicio({ ...base, tipo: 'put', strike: 95, t: 0 })).toBe(0)
    expect(chanceDeExercicio({ ...base, tipo: 'call', strike: 95, sigma: 0 })).toBe(1)
  })
})

describe('posições com vencimentos diferentes (calendário)', () => {
  const r = Math.log(1.14)
  const sigma = 0.3
  const preco = (dias: number) => precoBs({ tipo: 'call', s: 60, strike: 60, t: dias / DIAS_UTEIS_ANO, r, sigma })
  const calendario: Posicao = {
    pernas: [
      { tipo: 'call', lado: 'compra', strike: 60, premio: preco(120), quantidade: 100, dias: 120, sigma },
      { tipo: 'call', lado: 'venda', strike: 60, premio: preco(22), quantidade: 100, dias: 22, sigma },
    ],
    acoes: 0,
    precoAcao: 0,
  }
  const mercado = { dias: 22, r, sigma }

  it('reconhece vencimentos diferentes e o primeiro deles', () => {
    expect(temVariosVencimentos(calendario)).toBe(true)
    expect(diasAtePrimeiroVencimento(calendario, 99)).toBe(22)
    expect(temVariosVencimentos({ ...calendario, pernas: calendario.pernas.map((x) => ({ ...x, dias: 22 })) })).toBe(false)
    expect(temVariosVencimentos({ ...calendario, pernas: calendario.pernas.map((x) => ({ ...x, dias: undefined })) })).toBe(false)
  })

  it('hoje, com os preços do próprio modelo, o resultado é zero (cada perna usa o seu prazo)', () => {
    expect(resultadoAntesDoVencimento(calendario, 60, mercado, 0)).toBeCloseTo(0, 6)
  })

  it('na data do primeiro vencimento a perna curta vale o intrínseco e a longa ainda tem valor: ganho no strike, perda limitada longe dele', () => {
    const noMeio = resultadoAntesDoVencimento(calendario, 60, mercado, 22)
    expect(noMeio).toBeGreaterThan(0)
    const longe = resultadoAntesDoVencimento(calendario, 30, mercado, 22)
    const debito = (preco(120) - preco(22)) * 100
    expect(longe).toBeCloseTo(-debito, 0)
  })

  it('o máximo e o mínimo estimados são limitados, com dois equilíbrios', () => {
    const a = analisarEstimado(calendario, 60, mercado)
    expect(a.ganhoMaximo).not.toBeNull()
    expect(a.perdaMaxima).not.toBeNull()
    expect(a.ganhoMaximo!).toBeGreaterThan(0)
    expect(a.perdaMaxima!).toBeLessThan(0)
    expect(a.equilibrios).toHaveLength(2)
    expect(a.equilibrios[0]).toBeLessThan(60)
    expect(a.equilibrios[1]).toBeGreaterThan(60)
  })

  it('com a call longa vendida e a curta comprada, a perda é sem limite', () => {
    const invertido: Posicao = { ...calendario, pernas: calendario.pernas.map((x) => ({ ...x, lado: x.lado === 'compra' ? 'venda' : 'compra' })) }
    expect(analisarEstimado(invertido, 60, mercado).ganhoMaximo).not.toBeNull()
    const soVendida: Posicao = { ...calendario, pernas: [calendario.pernas[0]].map((x) => ({ ...x, lado: 'venda' as const })) }
    expect(analisarEstimado(soVendida, 60, { ...mercado, dias: 120 }).perdaMaxima).toBeNull()
  })

  it('sem prazo próprio nas pernas, o resultado é o de sempre', () => {
    const simples: Posicao = { pernas: [{ tipo: 'call', lado: 'compra', strike: 60, premio: 2, quantidade: 100 }], acoes: 0, precoAcao: 0 }
    const a = resultadoAntesDoVencimento(simples, 62, { dias: 10, r, sigma }, 4)
    const b = resultadoAntesDoVencimento({ pernas: [{ ...simples.pernas[0], dias: 10 }], acoes: 0, precoAcao: 0 }, 62, { dias: 10, r, sigma }, 4)
    expect(a).toBeCloseTo(b, 10)
  })
})
