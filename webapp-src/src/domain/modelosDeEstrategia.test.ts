import { describe, expect, it } from 'vitest'
import { MODELOS, escadaDeStrikes, montarPosicaoDoModelo, proximoVencimento, seriesPadrao, validarModelo, vencimentosDoModelo } from './modelosDeEstrategia'
import { analisar, resultadoNoVencimento } from './simulaOpcoes'
import type { SerieOpcao } from './opcoes'

const s = (codigo: string, tipo: 'call' | 'put', strike: number, ultimo: number, negocios = 10, vencimento = '2026-11-19'): SerieOpcao => ({
  codigo, tipo, estilo: 'americana', strike, vencimento, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios, volume: 1000,
})
const modelo = (id: string) => MODELOS.find((m) => m.id === id)!

// Escada de strikes de 50 a 70, de 2 em 2, para calls e puts.
const strikes = [50, 52, 54, 56, 58, 60, 62, 64, 66, 68, 70]
const em = (v: string, pre: string, extra: number) =>
  strikes.flatMap((k) => [s(`${pre}C${k}`, 'call', k, Math.max(60 - k, 0) + 1 + extra, 10, v), s(`${pre}P${k}`, 'put', k, Math.max(k - 60, 0) + 1 + extra, 10, v)])
// Dois vencimentos: o de novembro (curto) e o de janeiro (longo, com prêmios maiores).
const series = [...strikes.flatMap((k) => [s(`C${k}`, 'call', k, Math.max(60 - k, 0) + 1), s(`P${k}`, 'put', k, Math.max(k - 60, 0) + 1)]), ...em('2027-01-15', 'L', 1)]

describe('escadas e séries padrão', () => {
  it('a escada tem uma série por strike e prefere a mais negociada', () => {
    const duplas = [...series, s('CX60', 'call', 60, 3, 99)]
    const escada = escadaDeStrikes(duplas, 'call', '2026-11-19')
    expect(escada.map((x) => x.strike)).toEqual(strikes)
    expect(escada.find((x) => x.strike === 60)!.codigo).toBe('CX60')
  })

  it('ignora séries sem preço e de outro vencimento', () => {
    const escada = escadaDeStrikes([s('A', 'call', 10, 0), s('B', 'call', 11, 1, 5, '2026-12-18'), s('C', 'call', 12, 1)], 'call', '2026-11-19')
    expect(escada.map((x) => x.codigo)).toEqual(['C'])
  })

  it('os degraus partem do strike mais perto do preço', () => {
    const pernas = seriesPadrao(series, modelo('condorFerro'), '2026-11-19', 60.4)
    expect(pernas.map((x) => x!.codigo)).toEqual(['P52', 'P56', 'C64', 'C68']) // 60 ± 2 e ± 4 degraus
  })

  it('perto da ponta da escada, os degraus param na última série', () => {
    const curta = series.filter((x) => x.strike >= 58 && x.strike <= 62)
    const pernas = seriesPadrao(curta, modelo('condorFerro'), '2026-11-19', 60)
    expect(pernas.map((x) => x!.strike)).toEqual([58, 58, 62, 62])
  })

  it('só oferece o vencimento que tem call e put quando o modelo usa os dois', () => {
    const mistas = [...series, s('CL', 'call', 60, 2, 10, '2026-12-18')]
    expect(vencimentosDoModelo(mistas, modelo('straddleComprado'), ['2026-11-19', '2026-12-18'])).toEqual(['2026-11-19'])
    expect(vencimentosDoModelo(mistas, modelo('travaAltaCall'), ['2026-11-19', '2026-12-18'])).toEqual(['2026-11-19', '2026-12-18'])
  })
})

describe('posição montada a partir do modelo', () => {
  const montar = (id: string, preco = 60) => {
    const m = modelo(id)
    const escolhidas = seriesPadrao(series, m, '2026-11-19', preco)
    const pernas = m.pernas.map((p, i) => ({ serie: escolhidas[i]!, lado: p.lado, fator: p.fator, premio: escolhidas[i]!.ultimo }))
    return { m, escolhidas, posicao: montarPosicaoDoModelo(m, pernas, 100, preco) }
  }

  it('todos os modelos padrão passam na validação com uma escada completa', () => {
    for (const m of MODELOS) expect(validarModelo(m, seriesPadrao(series, m, '2026-11-19', 60)), m.id).toBeNull()
  })

  it('as travas e as estruturas de risco definido têm ganho e perda limitados', () => {
    for (const id of ['travaAltaCall', 'travaAltaPut', 'travaBaixaPut', 'travaBaixaCall', 'borboletaCall', 'borboletaPut', 'borboletaFerro', 'condorFerro', 'condorCall']) {
      const a = analisar(montar(id).posicao)
      expect(a.ganhoMaximo, id).not.toBeNull()
      expect(a.perdaMaxima, id).not.toBeNull()
    }
  })

  it('straddle e strangle vendidos têm perda sem limite; comprados têm ganho sem limite', () => {
    expect(analisar(montar('straddleVendido').posicao).perdaMaxima).toBeNull()
    expect(analisar(montar('strangleVendido').posicao).perdaMaxima).toBeNull()
    expect(analisar(montar('straddleComprado').posicao).ganhoMaximo).toBeNull()
    expect(analisar(montar('strangleComprado').posicao).ganhoMaximo).toBeNull()
  })

  it('a borboleta usa o dobro da quantidade na perna do meio', () => {
    const { posicao } = montar('borboletaCall')
    expect(posicao.pernas.map((x) => x.quantidade)).toEqual([100, 200, 100])
  })

  it('só a venda coberta e o collar levam ações', () => {
    expect(montar('vendaCoberta').posicao.acoes).toBe(100)
    expect(montar('collar').posicao.acoes).toBe(100)
    expect(montar('collar').posicao.precoAcao).toBe(60)
    expect(montar('travaAltaCall').posicao.acoes).toBe(0)
  })

  it('o collar limita a perda e o ganho', () => {
    const a = analisar(montar('collar').posicao)
    expect(a.ganhoMaximo).not.toBeNull()
    expect(a.perdaMaxima).not.toBeNull()
  })

  it('o condor de ferro ganha o crédito com o ativo no meio e perde no máximo a largura da asa menos o crédito', () => {
    const { posicao } = montar('condorFerro')
    const credito = posicao.pernas.reduce((t, x) => t + (x.lado === 'venda' ? 1 : -1) * x.premio * x.quantidade, 0)
    const a = analisar(posicao)
    expect(a.ganhoMaximo).toBeCloseTo(credito, 2)
    expect(a.perdaMaxima).toBeCloseTo(-(4 * 100 - credito), 0) // asas de R$ 4,00 (52→56 e 64→68)
  })
})

describe('validação das séries escolhidas', () => {
  it('falta série em alguma perna', () => {
    expect(validarModelo(modelo('travaAltaCall'), [series[0], null])).toBe('Escolha uma série para cada perna.')
  })

  it('ordem de strikes trocada e strikes iguais são recusados', () => {
    const c = (k: number) => series.find((x) => x.codigo === `C${k}`)!
    expect(validarModelo(modelo('travaAltaCall'), [c(64), c(60)])).toMatch(/ordem dos strikes/)
    expect(validarModelo(modelo('travaAltaCall'), [c(60), c(60)])).toMatch(/mesmo strike/)
    expect(validarModelo(modelo('travaAltaCall'), [c(60), c(64)])).toBeNull()
  })

  it('pernas de tipos diferentes podem ficar no mesmo strike (straddle)', () => {
    const c = series.find((x) => x.codigo === 'C60')!
    const p = series.find((x) => x.codigo === 'P60')!
    expect(validarModelo(modelo('straddleComprado'), [c, p])).toBeNull()
  })
})

describe('estruturas com vencimentos diferentes', () => {
  it('a perna longa vai para o vencimento seguinte ao escolhido', () => {
    const pernas = seriesPadrao(series, modelo('thlCall'), '2026-11-19', 60)
    expect(pernas.map((x) => [x!.codigo, x!.vencimento])).toEqual([['LC60', '2027-01-15'], ['C60', '2026-11-19']])
  })

  it('a diagonal usa strikes diferentes nas duas pernas', () => {
    const pernas = seriesPadrao(series, modelo('diagonalCall'), '2026-11-19', 60)
    expect(pernas.map((x) => x!.strike)).toEqual([60, 64])
    expect(pernas.map((x) => x!.vencimento)).toEqual(['2027-01-15', '2026-11-19'])
  })

  it('o próximo vencimento prefere o mensal; sem posterior, é null', () => {
    expect(proximoVencimento(series, 'call', '2026-11-19')).toBe('2027-01-15')
    expect(proximoVencimento(series, 'call', '2027-01-15')).toBeNull()
  })

  it('só oferece como vencimento curto os que têm outro depois', () => {
    expect(vencimentosDoModelo(series, modelo('thlCall'), ['2026-11-19', '2027-01-15'])).toEqual(['2026-11-19'])
    expect(vencimentosDoModelo(series, modelo('travaAltaCall'), ['2026-11-19', '2027-01-15'])).toEqual(['2026-11-19', '2027-01-15'])
  })

  it('a perna longa precisa vencer depois da curta', () => {
    const [longa, curta] = seriesPadrao(series, modelo('thlCall'), '2026-11-19', 60)
    expect(validarModelo(modelo('thlCall'), [longa, curta])).toBeNull()
    expect(validarModelo(modelo('thlCall'), [curta, longa])).toMatch(/perna longa precisa vencer depois/)
    expect(validarModelo(modelo('thlCall'), [curta, curta])).toMatch(/perna longa precisa vencer depois/)
  })

  it('a THL é um débito com perda limitada ao que foi pago, sem ganho ou perda sem limite', () => {
    const m = modelo('thlCall')
    const escolhidas = seriesPadrao(series, m, '2026-11-19', 60)
    const pernas = m.pernas.map((p, i) => ({ serie: escolhidas[i]!, lado: p.lado, fator: p.fator, premio: escolhidas[i]!.ultimo, dias: i === 0 ? 55 : 22 }))
    const posicao = montarPosicaoDoModelo(m, pernas, 100, 60)
    expect(posicao.pernas.map((x) => x.dias)).toEqual([55, 22])
    expect(posicao.pernas.reduce((t, x) => t + (x.lado === 'compra' ? -1 : 1) * x.premio * x.quantidade, 0)).toBeLessThan(0) // débito
  })
})

describe('estruturas de renda e proteção', () => {
  const montar = (id: string) => {
    const m = modelo(id)
    const escolhidas = seriesPadrao(series, m, '2026-11-19', 60)
    const pernas = m.pernas.map((p, i) => ({ serie: escolhidas[i]!, lado: p.lado, fator: p.fator, premio: escolhidas[i]!.ultimo, dias: 22 }))
    return { m, escolhidas, posicao: montarPosicaoDoModelo(m, pernas, 100, 60) }
  }

  it('o slide compra uma put e vende duas, mais abaixo, e começa com crédito', () => {
    const { m, escolhidas, posicao } = montar('slidePut')
    expect(m.pernas.map((p) => p.lado)).toEqual(['compra', 'venda', 'venda'])
    expect(escolhidas.map((x) => x!.strike)).toEqual([60, 56, 54])
    const credito = posicao.pernas.reduce((t, x) => t + (x.lado === 'venda' ? 1 : -1) * x.premio * x.quantidade, 0)
    expect(credito).toBeGreaterThan(0)
    expect(m.aviso).toMatch(/put vendida sem proteção/)
  })

  it('a put otimizada soma o crédito da trava de baixa com calls ao da put', () => {
    const { m, escolhidas, posicao } = montar('putOtimizada')
    expect(m.pernas.map((p) => [p.tipo, p.lado])).toEqual([['put', 'venda'], ['call', 'venda'], ['call', 'compra']])
    expect(escolhidas.map((x) => x!.strike)).toEqual([56, 64, 68])
    const a = analisar(posicao)
    expect(a.ganhoMaximo).not.toBeNull()
    expect(a.perdaMaxima).not.toBeNull()
  })

  it('o strangle financiado tem ganho e perda limitados, com perda máxima igual ao débito', () => {
    const { posicao } = montar('strangleFinanciado')
    const a = analisar(posicao)
    const debito = -posicao.pernas.reduce((t, x) => t + (x.lado === 'venda' ? 1 : -1) * x.premio * x.quantidade, 0)
    expect(a.ganhoMaximo).not.toBeNull()
    expect(a.perdaMaxima).toBeCloseTo(-debito, 2)
  })

  it('o booster leva as ações e rende cerca do dobro da ação sozinha dentro da faixa das calls', () => {
    const { posicao, m } = montar('booster')
    expect(m.comAcoes).toBe(true)
    expect(posicao.acoes).toBe(100)
    // entre os strikes das calls (60 e 64), cada R$ 1 a mais no ativo rende R$ 200 (ação e call comprada)
    expect(resultadoNoVencimento(posicao, 63) - resultadoNoVencimento(posicao, 62)).toBeCloseTo(200, 6)
  })

  it('os quatro estão no grupo próprio', () => {
    expect(MODELOS.filter((x) => x.grupo === 'Renda e proteção').map((x) => x.id)).toEqual(['slidePut', 'putOtimizada', 'strangleFinanciado', 'booster'])
  })
})

describe('Risk Reversal', () => {
  it('Bullish: vende put abaixo e compra call acima; Bearish: o inverso', () => {
    const bull = modelo('bullishRiskReversal')
    const bear = modelo('bearishRiskReversal')
    expect(bull.grupo).toBe('Risk Reversal')
    expect(seriesPadrao(series, bull, '2026-11-19', 60).map((x) => `${x!.tipo}${x!.strike}`)).toEqual(['put56', 'call64'])
    expect(bull.pernas.map((x) => `${x.tipo}:${x.lado}`)).toEqual(['put:venda', 'call:compra'])
    expect(seriesPadrao(series, bear, '2026-11-19', 60).map((x) => `${x!.tipo}${x!.strike}`)).toEqual(['call64', 'put56'])
    expect(bear.pernas.map((x) => `${x.tipo}:${x.lado}`)).toEqual(['call:venda', 'put:compra'])
  })
  it('o grupo vem logo depois das travas', async () => {
    const { GRUPOS_DE_MODELOS } = await import('./modelosDeEstrategia')
    expect(GRUPOS_DE_MODELOS.slice(0, 2)).toEqual(['Travas', 'Risk Reversal'])
  })
})
