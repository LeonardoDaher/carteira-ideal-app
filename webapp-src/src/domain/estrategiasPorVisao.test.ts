import { describe, expect, it } from 'vitest'
import {
  ESTRUTURAS, ESTRUTURAS_DA_VISAO, chanceDeLucro, descreverPernas, escolhaDaCandidata, gerarCandidatas, melhoresCandidatas,
} from './estrategiasPorVisao'
import type { Candidata, EstruturaId, ParametrosIdeias } from './estrategiasPorVisao'
import type { AtivoComOpcoes, SerieOpcao } from './opcoes'
import { chanceDeExercicio, precoBs } from './simulaOpcoes'
import type { Posicao } from './simulaOpcoes'
import type { Visao } from './tendencia'

const HOJE = '2026-10-16'
const VENC = '2026-11-19' // 22 dias úteis
const JUROS = 13.75
const r = Math.log(1 + JUROS / 100)
const SIGMA = 0.4
const SPOT = 10

/** Série com o prêmio do modelo para a volatilidade de 40% (arredondado a centavo, como no mercado). */
const serie = (tipo: 'call' | 'put', strike: number, extra: Partial<SerieOpcao> = {}): SerieOpcao => ({
  codigo: `${tipo === 'call' ? 'C' : 'P'}${Math.round(strike * 100)}`,
  tipo, estilo: 'europeia', strike, vencimento: VENC,
  ultimo: Math.max(Math.round(precoBs({ tipo, s: SPOT, strike, t: 22 / 252, r, sigma: SIGMA }) * 100) / 100, 0.01),
  dataUltimo: HOJE, variacao: null, negocios: 50, volume: 100_000, ...extra,
})

// Strikes de 7,50 a 13,00 de 0,50 em 0,50, calls e puts.
const strikes = Array.from({ length: 12 }, (_, i) => 7.5 + i * 0.5)
const ativo: AtivoComOpcoes = {
  ticker: 'TESTE3', nome: 'TESTE', cotacao: SPOT, volumeOpcoes: 1, lote: 100,
  series: strikes.flatMap((k) => [serie('call', k), serie('put', k)]),
}
const params: ParametrosIdeias = { vencimento: VENC, hoje: HOJE, jurosAnual: JUROS }
const candidatas = (e: EstruturaId, v: Visao, a = ativo) => gerarCandidatas(a, e, v, params)
const porCodigo = (c: Candidata) => c.pernas.map((p) => p.serie.codigo).join('+')
const achar = (lista: Candidata[], codigos: string) => lista.find((c) => porCodigo(c) === codigos)!
const Q = 100

describe('catálogo de estruturas', () => {
  it('cada visão tem estruturas, e todas existem no catálogo', () => {
    for (const ids of Object.values(ESTRUTURAS_DA_VISAO)) {
      expect(ids.length).toBeGreaterThan(0)
      for (const id of ids) expect(ESTRUTURAS[id].id).toBe(id)
    }
  })
})

describe('medidas de cada estrutura (contas conferidas à mão)', () => {
  it('compra de call: perda é o prêmio, ganho sem teto, equilíbrio em strike + prêmio', () => {
    const c = achar(candidatas('compraCall', 'alta'), 'C1000')
    const prem = serie('call', 10).ultimo
    expect(c.credito).toBeCloseTo(-prem * Q, 6)
    expect(c.perdaMaxima).toBeCloseTo(-prem * Q, 6)
    expect(c.ganhoMaximo).toBeNull()
    expect(c.equilibrios).toEqual([Math.round((10 + prem) * 100) / 100])
  })

  it('trava de alta com calls (débito): ganho = largura − débito, perda = débito', () => {
    const c = achar(candidatas('travaAltaDebito', 'alta'), 'C1000+C1100')
    const debito = serie('call', 10).ultimo - serie('call', 11).ultimo
    expect(c.pernas.map((p) => p.lado)).toEqual(['compra', 'venda'])
    expect(c.perdaMaxima).toBeCloseTo(-debito * Q, 6)
    expect(c.ganhoMaximo).toBeCloseTo((1 - debito) * Q, 6)
    expect(c.equilibrios[0]).toBeCloseTo(10 + debito, 1)
  })

  it('trava de alta com puts (crédito): ganho = crédito, perda = largura − crédito', () => {
    const c = achar(candidatas('travaAltaCredito', 'alta'), 'P900+P800')
    const credito = serie('put', 9).ultimo - serie('put', 8).ultimo
    expect(c.pernas.map((p) => p.lado)).toEqual(['venda', 'compra'])
    expect(c.credito).toBeCloseTo(credito * Q, 6)
    expect(c.ganhoMaximo).toBeCloseTo(credito * Q, 6)
    expect(c.perdaMaxima).toBeCloseTo(-(1 - credito) * Q, 6)
    expect(c.equilibrios[0]).toBeCloseTo(9 - credito, 1)
  })

  it('venda de put: ganho = prêmio, perda = strike − prêmio', () => {
    const c = achar(candidatas('vendaPut', 'alta'), 'P900')
    const prem = serie('put', 9).ultimo
    expect(c.ganhoMaximo).toBeCloseTo(prem * Q, 6)
    expect(c.perdaMaxima).toBeCloseTo(-(9 - prem) * Q, 6)
  })

  it('trava de baixa com puts (débito) e com calls (crédito)', () => {
    const d = achar(candidatas('travaBaixaDebito', 'baixa'), 'P1000+P900')
    const debito = serie('put', 10).ultimo - serie('put', 9).ultimo
    expect(d.pernas.map((p) => p.lado)).toEqual(['compra', 'venda'])
    expect(d.perdaMaxima).toBeCloseTo(-debito * Q, 6)
    expect(d.ganhoMaximo).toBeCloseTo((1 - debito) * Q, 6)

    const k = achar(candidatas('travaBaixaCredito', 'baixa'), 'C1000+C1100')
    const credito = serie('call', 10).ultimo - serie('call', 11).ultimo
    expect(k.pernas.map((p) => p.lado)).toEqual(['venda', 'compra'])
    expect(k.ganhoMaximo).toBeCloseTo(credito * Q, 6)
    expect(k.perdaMaxima).toBeCloseTo(-(1 - credito) * Q, 6)
  })

  it('condor de ferro: ganho = crédito, perda = a maior largura − crédito, dois equilíbrios', () => {
    const c = achar(candidatas('condorDeFerro', 'lateral'), 'P800+P900+C1100+C1200')
    const credito = serie('put', 9).ultimo - serie('put', 8).ultimo + serie('call', 11).ultimo - serie('call', 12).ultimo
    expect(c.pernas.map((p) => p.lado)).toEqual(['compra', 'venda', 'venda', 'compra'])
    expect(c.ganhoMaximo).toBeCloseTo(credito * Q, 6)
    expect(c.perdaMaxima).toBeCloseTo(-(1 - credito) * Q, 6)
    expect(c.equilibrios).toHaveLength(2)
    expect(c.equilibrios[0]).toBeLessThan(9)
    expect(c.equilibrios[1]).toBeGreaterThan(11)
  })

  it('borboleta: vende 2x o centro, ganho máximo no strike do meio, perda = débito', () => {
    const c = achar(candidatas('borboleta', 'lateral'), 'C900+C1000+C1100')
    const debito = serie('call', 9).ultimo - 2 * serie('call', 10).ultimo + serie('call', 11).ultimo
    expect(c.pernas.map((p) => p.fator)).toEqual([1, 2, 1])
    expect(c.perdaMaxima).toBeCloseTo(-debito * Q, 6)
    expect(c.ganhoMaximo).toBeCloseTo((1 - debito) * Q, 6)
    expect(c.equilibrios).toHaveLength(2)
  })

  it('straddle comprado: perda = soma dos prêmios, ganho sem teto, dois equilíbrios', () => {
    const c = achar(candidatas('straddleComprado', 'oscilacao'), 'C1000+P1000')
    const soma = serie('call', 10).ultimo + serie('put', 10).ultimo
    expect(c.perdaMaxima).toBeCloseTo(-soma * Q, 6)
    expect(c.ganhoMaximo).toBeNull()
    expect(c.equilibrios).toHaveLength(2)
  })

  it('strangle comprado: put abaixo e call acima, mais barato que o straddle', () => {
    const c = candidatas('strangleComprado', 'oscilacao')[0]
    expect(c.pernas.map((p) => p.serie.tipo)).toEqual(['put', 'call'])
    expect(c.pernas[0].serie.strike).toBeLessThan(SPOT)
    expect(c.pernas[1].serie.strike).toBeGreaterThan(SPOT)
    const straddle = achar(candidatas('straddleComprado', 'oscilacao'), 'C1000+P1000')
    expect(-c.perdaMaxima).toBeLessThan(-straddle.perdaMaxima)
  })

  it('venda coberta: ganho = (strike − preço + prêmio), perda = preço − prêmio, e a estrutura inclui ter a ação', () => {
    const c = achar(candidatas('vendaCoberta', 'lateral'), 'C1000')
    const prem = serie('call', 10).ultimo
    expect(c.comAcoes).toBe(true)
    expect(c.ganhoMaximo).toBeCloseTo(prem * Q, 6) // strike igual ao preço
    expect(c.perdaMaxima).toBeCloseTo(-(SPOT - prem) * Q, 6)
    const c11 = achar(candidatas('vendaCoberta', 'lateral'), 'C1100')
    expect(c11.ganhoMaximo).toBeCloseTo((1 + serie('call', 11).ultimo) * Q, 6)
  })

  it('todas as estruturas geradas têm risco limitado', () => {
    for (const [visao, ids] of Object.entries(ESTRUTURAS_DA_VISAO) as [Visao, EstruturaId[]][])
      for (const id of ids)
        for (const c of candidatas(id, visao)) {
          expect(Number.isFinite(c.perdaMaxima)).toBe(true)
          expect(c.perdaMaxima).toBeLessThan(0)
        }
  })
})

describe('chance de lucro', () => {
  const posicaoDaCall = (strike: number): Posicao => {
    const premio = serie('call', strike).ultimo
    return { pernas: [{ tipo: 'call', lado: 'compra', strike, premio, quantidade: 100 }], acoes: 0, precoAcao: 0 }
  }

  it('numa compra de call, bate com a chance de o preço passar de strike + prêmio (fórmula fechada, mesma volatilidade)', () => {
    const c = achar(candidatas('compraCall', 'alta'), 'C1000')
    const premio = serie('call', 10).ultimo
    const fechada = chanceDeExercicio({ tipo: 'call', s: SPOT, strike: 10 + premio, t: 22 / 252, r, sigma: c.volImplicita / 100 }) * 100
    expect(c.chanceDeLucro).toBeCloseTo(fechada, 0)
  })

  it('call comprada ATM dá lucro em menos da metade das vezes; venda de put afastada, em bem mais da metade', () => {
    expect(achar(candidatas('compraCall', 'alta'), 'C1000').chanceDeLucro).toBeLessThan(50)
    expect(achar(candidatas('vendaPut', 'alta'), 'P900').chanceDeLucro).toBeGreaterThan(75)
  })

  it('sem tempo ou sem volatilidade, é 0 ou 100 conforme o resultado de hoje', () => {
    const emLucro: Posicao = { pernas: [{ tipo: 'call', lado: 'compra', strike: 9, premio: 0.5, quantidade: 100 }], acoes: 0, precoAcao: 0 }
    expect(chanceDeLucro(emLucro, SPOT, 0, JUROS, 0.4)).toBe(100) // call de strike 9 com o preço em 10: ganha 1 e pagou 0,50
    expect(chanceDeLucro(posicaoDaCall(12), SPOT, 5, JUROS, 0)).toBe(0)
  })
})

describe('filtros e ordenação', () => {
  it('série que não negociou no último pregão ou com poucos negócios não entra', () => {
    const fraco: AtivoComOpcoes = {
      ...ativo,
      series: ativo.series.map((s) => (s.codigo === 'C1000' ? { ...s, negocios: 2 } : s.codigo === 'C1050' ? { ...s, dataUltimo: '2026-10-15' } : s)),
    }
    const lista = candidatas('compraCall', 'alta', fraco).map(porCodigo)
    expect(lista).not.toContain('C1000')
    expect(lista).not.toContain('C1050')
    expect(lista).toContain('C1100') // dentro da janela da estrutura e com negócios
  })

  it('trava com débito maior que a largura (preços incoerentes) não entra', () => {
    const torto: AtivoComOpcoes = { ...ativo, series: ativo.series.map((s) => (s.codigo === 'C1100' ? { ...s, ultimo: 0.01 } : s.codigo === 'C1000' ? { ...s, ultimo: 1.5 } : s)) }
    expect(candidatas('travaAltaDebito', 'alta', torto).map(porCodigo)).not.toContain('C1000+C1100')
  })

  it('trava de débito que custa quase a largura inteira (ganho de centavos) não entra', () => {
    const quase: AtivoComOpcoes = { ...ativo, series: ativo.series.map((s) => (s.codigo === 'C1000' ? { ...s, ultimo: 1.4 } : s.codigo === 'C1100' ? { ...s, ultimo: 0.43 } : s)) }
    // débito de 0,97 para uma largura de 1,00: ganho de R$ 3 contra R$ 97 de risco
    expect(candidatas('travaAltaDebito', 'alta', quase).map(porCodigo)).not.toContain('C1000+C1100')
    expect(candidatas('travaAltaDebito', 'alta').map(porCodigo)).toContain('C1000+C1100') // a trava de preços coerentes continua
  })

  it('vencimento com menos de 3 dias úteis não gera nada', () => {
    expect(gerarCandidatas(ativo, 'compraCall', 'alta', { ...params, vencimento: '2026-10-19' })).toEqual([])
  })

  it('ordena pela chance de lucro, pelo retorno no cenário ou pelo menor risco, e limita a quantidade', () => {
    const porChance = melhoresCandidatas(ativo, 'travaAltaCredito', 'alta', params, 'chance', 3)
    expect(porChance).toHaveLength(3)
    expect(porChance[0].chanceDeLucro).toBeGreaterThanOrEqual(porChance[1].chanceDeLucro)
    expect(porChance[1].chanceDeLucro).toBeGreaterThanOrEqual(porChance[2].chanceDeLucro)

    const porRetorno = melhoresCandidatas(ativo, 'travaAltaDebito', 'alta', params, 'retorno', 3)
    expect(porRetorno[0].retornoNoCenario).toBeGreaterThanOrEqual(porRetorno[1].retornoNoCenario)

    const porRisco = melhoresCandidatas(ativo, 'travaAltaDebito', 'alta', params, 'risco', 3)
    expect(-porRisco[0].perdaMaxima).toBeLessThanOrEqual(-porRisco[1].perdaMaxima)
  })

  it('o cenário da visão de alta rende no ganho; o da lateral é o preço parado; o de baixa, na queda', () => {
    const alta = achar(candidatas('travaAltaDebito', 'alta'), 'C1000+C1100')
    expect(alta.movimentoDoCenario).toBeGreaterThan(0)
    expect(alta.resultadoNoCenario).toBeGreaterThan(0)
    const lateral = candidatas('condorDeFerro', 'lateral')[0]
    expect(lateral.movimentoDoCenario).toBe(0)
    expect(lateral.resultadoNoCenario).toBeCloseTo(lateral.ganhoMaximo!, 6) // parado no meio, o condor ganha o crédito todo
    const baixa = achar(candidatas('travaBaixaDebito', 'baixa'), 'P1000+P900')
    expect(baixa.resultadoNoCenario).toBeGreaterThan(0)
  })
})

describe('texto e escolha para o simulador', () => {
  it('descreve as pernas, com o múltiplo da borboleta e a ação da venda coberta', () => {
    expect(descreverPernas(achar(candidatas('travaAltaDebito', 'alta'), 'C1000+C1100'))).toBe('Compra C1000, vende C1100')
    expect(descreverPernas(achar(candidatas('borboleta', 'lateral'), 'C900+C1000+C1100'))).toBe('Compra C900, vende 2x C1000, compra C1100')
    expect(descreverPernas(achar(candidatas('vendaCoberta', 'lateral'), 'C1000'))).toBe('Tem a ação, vende C1000')
  })

  it('a escolha para o simulador leva lado e múltiplo de cada série', () => {
    const c = achar(candidatas('borboleta', 'lateral'), 'C900+C1000+C1100')
    const e = escolhaDaCandidata(ativo, c)
    expect(e.series.map((s) => s.codigo)).toEqual(['C900', 'C1000', 'C1100'])
    expect(e.detalhes).toEqual({ C900: { lado: 'compra', fator: 1 }, C1000: { lado: 'venda', fator: 2 }, C1100: { lado: 'compra', fator: 1 } })
    expect(e.coberta).toBe(false)
  })
})

describe('estruturas acrescentadas à Tendência (borboletas, condor de calls, put otimizada, slide, strangle financiado, collar e booster)', () => {
  const novas: [EstruturaId, Visao][] = [
    ['borboletaPut', 'lateral'], ['borboletaFerro', 'lateral'], ['condorCall', 'lateral'], ['putOtimizada', 'lateral'],
    ['slidePut', 'alta'], ['booster', 'alta'], ['collar', 'baixa'], ['strangleFinanciado', 'oscilacao'],
  ]

  it('estão no catálogo e na visão certa', () => {
    for (const [id, visao] of novas) {
      expect(ESTRUTURAS[id].id).toBe(id)
      expect(ESTRUTURAS_DA_VISAO[visao]).toContain(id)
    }
  })

  it('cada uma gera candidatas com as séries de teste, todas de risco limitado', () => {
    for (const [id, visao] of novas) {
      const lista = candidatas(id, visao)
      expect(lista.length, id).toBeGreaterThan(0)
      for (const c of lista) expect(c.perdaMaxima, id).toBeLessThan(0)
    }
  })

  it('borboleta de ferro: crédito, strikes iguais nas vendidas e asas de largura igual', () => {
    const c = candidatas('borboletaFerro', 'lateral')[0]
    const [putAsa, putVendida, callVendida, callAsa] = c.pernas.map((p) => p.serie)
    expect(c.pernas.map((p) => p.lado)).toEqual(['compra', 'venda', 'venda', 'compra'])
    expect(putVendida.strike).toBeCloseTo(callVendida.strike, 8)
    expect(putVendida.strike - putAsa.strike).toBeCloseTo(callAsa.strike - callVendida.strike, 8)
    expect(c.credito).toBeGreaterThan(0)
  })

  it('borboleta com puts e condor com calls: débito, ganho limitado', () => {
    for (const [id, pernas] of [['borboletaPut', 3], ['condorCall', 4]] as [EstruturaId, number][]) {
      const c = candidatas(id, 'lateral')[0]
      expect(c.pernas).toHaveLength(pernas)
      expect(c.credito).toBeLessThan(0)
      expect(c.ganhoMaximo).not.toBeNull()
    }
  })

  it('put otimizada: put vendida mais trava de baixa com calls, tudo em crédito', () => {
    const c = candidatas('putOtimizada', 'lateral')[0]
    expect(c.pernas.map((p) => [p.serie.tipo, p.lado])).toEqual([['put', 'venda'], ['call', 'venda'], ['call', 'compra']])
    expect(c.credito).toBeGreaterThan(0)
  })

  it('slide: compra uma put e vende duas mais baixas, com crédito ou custo baixo', () => {
    const c = candidatas('slidePut', 'alta')[0]
    const [alta, meio, baixa] = c.pernas.map((p) => p.serie.strike)
    expect(c.pernas.map((p) => p.lado)).toEqual(['compra', 'venda', 'venda'])
    expect(alta).toBeGreaterThan(meio)
    expect(meio).toBeGreaterThan(baixa)
    expect(c.credito).toBeGreaterThanOrEqual(-0.25 * c.pernas[0].serie.ultimo * Q)
  })

  it('strangle financiado: débito, com as asas vendidas mais afastadas e ganho limitado', () => {
    const c = candidatas('strangleFinanciado', 'oscilacao')[0]
    expect(c.pernas.map((p) => p.lado)).toEqual(['compra', 'venda', 'compra', 'venda'])
    expect(c.credito).toBeLessThan(0)
    expect(c.ganhoMaximo).not.toBeNull()
  })

  it('collar e booster levam as ações e abrem o próprio modelo na aba Estratégias; a venda coberta continua com o atalho', () => {
    const collar = candidatas('collar', 'baixa')[0]
    expect(collar.comAcoes).toBe(true)
    expect(collar.pernas.map((p) => [p.serie.tipo, p.lado])).toEqual([['put', 'compra'], ['call', 'venda']])
    expect(escolhaDaCandidata(ativo, collar)).toMatchObject({ modelo: 'collar', coberta: false })

    const booster = candidatas('booster', 'alta')[0]
    expect(booster.comAcoes).toBe(true)
    expect(booster.pernas.map((p) => [p.serie.tipo, p.lado])).toEqual([['call', 'compra'], ['call', 'venda'], ['put', 'venda']])
    expect(booster.ganhoMaximo).toBeNull() // a ação continua subindo acima da call vendida
    expect(escolhaDaCandidata(ativo, booster)).toMatchObject({ modelo: 'booster', coberta: false })

    const coberta = candidatas('vendaCoberta', 'lateral')[0]
    expect(escolhaDaCandidata(ativo, coberta)).toMatchObject({ coberta: true })
    expect(escolhaDaCandidata(ativo, coberta)).not.toHaveProperty('modelo')
  })
})
