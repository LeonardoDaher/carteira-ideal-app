import { describe, expect, it } from 'vitest'
import {
  PRESET_TIPO,
  aplicarTipoCarro,
  custosAquisicaoFinanciamento,
  inputsCarroDoSnapshot,
  inputsCarroPadrao,
  pontoDeViradaCarro,
  simularComparativoCarro,
  validarInputsCarro,
  valorDeMercado,
} from './simulaCarro'
import type { ChaveCarro, InputsCarro } from './simulaCarro'
import type { SnapshotMercado } from './mercadoOficial'

const TODAS: ChaveCarro[] = ['avista', 'financiamento', 'consorcio', 'semCarro']

describe('valorDeMercado (depreciação)', () => {
  it('perde mais no 1º ano do que nos seguintes e nunca fica negativo', () => {
    const p = 100_000
    const aos12 = valorDeMercado(p, 12, 14, 9)
    const aos24 = valorDeMercado(p, 24, 14, 9)
    expect(aos12).toBeCloseTo(86_000, 2)
    expect(aos24).toBeCloseTo(78_260, 2)
    expect(p - aos12).toBeGreaterThan(aos12 - aos24)
    expect(valorDeMercado(p, 120, 14, 9)).toBeGreaterThan(0)
  })
  it('é contínua na virada do 12º mês e vale p0 no mês 0', () => {
    expect(valorDeMercado(50_000, 0, 20, 10)).toBe(50_000)
    expect(valorDeMercado(50_000, 12, 20, 10)).toBeCloseTo(valorDeMercado(50_000, 12.0001, 20, 10), 1)
  })
})

describe('contabilidade que fecha (patrimônio = colocado − custos + valorização + rendimento − IR − venda)', () => {
  const cenarios: [string, Partial<InputsCarro>][] = [
    ['padrão 0 km', {}],
    ['seminovo', { tipo: 'seminovo', ...PRESET_TIPO.seminovo }],
    ['com dinheiro para o à vista', { dinheiroDisponivel: 150_000 }],
    ['com custos de venda', { descontarCustosVenda: true, dinheiroDisponivel: 150_000 }],
    ['com lance no consórcio (prazo)', { lance: 15_000, regraLance: 'prazo', mesContemplacao: 12 }],
    ['com lance no consórcio (parcela)', { lance: 15_000, regraLance: 'parcela', mesContemplacao: 12 }],
    ['horizonte maior que o financiamento', { horizonteAnos: 8, prazoFinanciamentoMeses: 36 }],
    ['horizonte curto', { horizonteAnos: 2, mesContemplacao: 10 }],
    ['sem IR e sem depreciação', { aplicarIR: false, deprecAno1Pct: 0, deprecDemaisPct: 0 }],
    ['entrada igual ao valor (sem dívida)', { entrada: 100_000, dinheiroDisponivel: 130_000 }],
  ]
  for (const [nome, parcial] of cenarios) {
    it(`fecha em ${nome}`, () => {
      const r = simularComparativoCarro(parcial)
      for (const c of r.rotas) {
        expect(Math.abs(r.detalhe.contabilidade[c].diferenca), `${c}`).toBeLessThan(0.05)
      }
    })
  }

  it('o dinheiro colocado é igual em todos os caminhos', () => {
    const r = simularComparativoCarro({ dinheiroDisponivel: 150_000 })
    const colocados = TODAS.map((c) => r.detalhe.contabilidade[c].totalColocado)
    expect(new Set(colocados).size).toBe(1)
  })
})

describe('as duas leituras: custo e patrimônio', () => {
  it('custo líquido = dinheiro colocado − patrimônio, e a ordem por custo é a inversa da ordem por patrimônio', () => {
    const r = simularComparativoCarro({ dinheiroDisponivel: 150_000 })
    for (const c of r.rotas) {
      const cen = r.cenarios[c]
      expect(cen.custoLiquido).toBeCloseTo(r.detalhe.contabilidade[c].totalColocado - cen.patrimonioFinal, 1)
    }
    const porCusto = [...r.rotas].sort((a, b) => r.cenarios[a].custoLiquido - r.cenarios[b].custoLiquido)
    expect(porCusto).toEqual(r.ranking)
    expect(r.vencedor).toBe(porCusto[0])
  })

  it('o custo bruto soma custos, depreciação e deságio de revenda (quando ligado)', () => {
    const r = simularComparativoCarro({ descontarCustosVenda: true })
    const f = r.cenarios.financiamento
    expect(f.custoBruto).toBeCloseTo(f.custoTotal + f.depreciacao + r.detalhe.contabilidade.financiamento.custosDeVenda, 1)
    expect(f.custoBrutoMensal).toBeCloseTo(f.custoBruto / 60, 1)
    expect(r.cenarios.semCarro.depreciacao).toBe(0)
  })

  it('o carro perde valor: a "valorização" é negativa e a depreciação é positiva', () => {
    const r = simularComparativoCarro({})
    expect(r.detalhe.contabilidade.financiamento.valorizacaoCarro).toBeLessThan(0)
    expect(r.cenarios.financiamento.depreciacao).toBeGreaterThan(0)
    expect(r.cenarios.financiamento.carro).toBeLessThan(100_000)
    expect(r.detalhe.contabilidade.semCarro.valorizacaoCarro).toBe(0)
  })
})

describe('dinheiro disponível e a rota à vista', () => {
  it('null = só a entrada mais os custos de aquisição, e a rota à vista fica de fora com o quanto falta', () => {
    const i = inputsCarroPadrao({})
    const aq = custosAquisicaoFinanciamento(i)
    const r = simularComparativoCarro({})
    expect(r.capitalInicial).toBeCloseTo(i.entrada + aq.total, 2)
    expect(r.rotas).not.toContain('avista')
    expect(r.avista.disponivel).toBe(false)
    expect(r.avista.necessario).toBeCloseTo(100_000 + 1_500, 2)
    expect(r.avista.falta).toBeCloseTo(r.avista.necessario - r.capitalInicial, 2)
  })

  it('com dinheiro suficiente, a rota à vista entra e o resto fica aplicado', () => {
    const r = simularComparativoCarro({ dinheiroDisponivel: 130_000 })
    expect(r.rotas).toContain('avista')
    expect(r.detalhe.investimentos.avista.capitalInicial).toBeCloseTo(130_000 - 101_500, 2)
    expect(r.detalhe.investimentos.semCarro.capitalInicial).toBeCloseTo(130_000, 2)
  })

  it('rejeita dinheiro menor que a entrada mais os custos de aquisição', () => {
    const erros = validarInputsCarro(inputsCarroPadrao({ dinheiroDisponivel: 20_000 }))
    expect(erros.join(' ')).toMatch(/precisa cobrir ao menos a entrada/)
  })
})

describe('financiamento', () => {
  it('o CET é resultado: fica acima dos juros nominais porque IOF e gravame saem do bolso', () => {
    const r = simularComparativoCarro({ jurosMensalPct: 1.9 })
    const efetivaDosJuros = (Math.pow(1.019, 12) - 1) * 100
    expect(r.financiamento.cetAA).toBeGreaterThan(efetivaDosJuros)
  })
  it('usa Price: parcelas iguais e dívida quitada no prazo', () => {
    const r = simularComparativoCarro({ prazoFinanciamentoMeses: 48, horizonteAnos: 5 })
    expect(r.financiamento.primeiraParcela).toBeCloseTo(r.financiamento.ultimaParcela, 2)
    expect(r.cenarios.financiamento.saldoDevedor).toBe(0)
  })
  it('horizonte menor que o prazo deixa dívida e ela é descontada do patrimônio', () => {
    const r = simularComparativoCarro({ horizonteAnos: 2, prazoFinanciamentoMeses: 60, mesContemplacao: 6 })
    expect(r.cenarios.financiamento.saldoDevedor).toBeGreaterThan(0)
    const f = r.cenarios.financiamento
    expect(f.patrimonioFinal).toBeCloseTo(f.carro - f.saldoDevedor + f.fundoLiquido, 1)
  })
  it('juros maiores pioram o financiamento; quem fica sem carro investe mais, porque a parcela maior eleva o orçamento de referência', () => {
    const baixo = simularComparativoCarro({ jurosMensalPct: 1.2 })
    const alto = simularComparativoCarro({ jurosMensalPct: 2.4 })
    expect(alto.cenarios.financiamento.patrimonioFinal).toBeLessThan(baixo.cenarios.financiamento.patrimonioFinal)
    expect(alto.orcamentoReferencia[0]).toBeGreaterThan(baixo.orcamentoReferencia[0])
    expect(alto.cenarios.semCarro.patrimonioFinal).toBeGreaterThan(baixo.cenarios.semCarro.patrimonioFinal)
    // o dinheiro colocado continua igual em todos os caminhos dentro de cada simulação
    expect(new Set(TODAS.filter((c) => alto.rotas.includes(c)).map((c) => alto.detalhe.contabilidade[c].totalColocado)).size).toBe(1)
  })
})

describe('consórcio', () => {
  it('antes da contemplação não há carro nem dívida na série', () => {
    const r = simularComparativoCarro({ mesContemplacao: 24, horizonteAnos: 5 })
    const antes = r.serieMensal[12]
    const semAntes = r.detalhe.contabilidade.consorcio
    expect(antes.consorcio).toBeLessThan(r.capitalInicial * 2)
    expect(semAntes.valorizacaoCarro).toBeLessThan(0)
    // no mês da contemplação o carro e a dívida entram
    expect(r.serieMensal[24].consorcio).not.toBe(r.serieMensal[23].consorcio)
  })
  it('a carta é corrigida uma vez por ano (no 13º mês) e o preço do carro, continuamente: no mês 12 falta a correção do ano', () => {
    const r = simularComparativoCarro({ inflacaoAA: 4.5, reajusteConsorcioAA: 4.5, mesContemplacao: 12 })
    expect(r.consorcio.cartaNaContemplacao).toBeCloseTo(100_000, 0)
    expect(r.consorcio.precoCarroNaContemplacao).toBeCloseTo(104_500, 0)
    expect(r.consorcio.complementoPago).toBeCloseTo(4_500, 0)
  })
  it('com reajuste da carta acima da inflação do carro, sobra dinheiro para o fundo (complemento negativo)', () => {
    const r = simularComparativoCarro({ inflacaoAA: 3, reajusteConsorcioAA: 12, mesContemplacao: 25 })
    expect(r.consorcio.complementoPago).toBeLessThan(0)
  })
  it('o carro do consórcio só começa a perder valor depois da contemplação', () => {
    const cedo = simularComparativoCarro({ mesContemplacao: 6 })
    const tarde = simularComparativoCarro({ mesContemplacao: 48 })
    expect(cedo.cenarios.consorcio.depreciacao).toBeGreaterThan(tarde.cenarios.consorcio.depreciacao)
  })
  it('lança erro quando a contemplação passa do horizonte', () => {
    expect(() => simularComparativoCarro({ horizonteAnos: 1, mesContemplacao: 24 })).toThrow(/contemplação/)
  })
})

describe('sem carro e o ponto de virada', () => {
  it('um gasto sem carro maior aumenta o custo de quem fica sem carro', () => {
    const a = simularComparativoCarro({ mobilidadeMensal: 1_000 })
    const b = simularComparativoCarro({ mobilidadeMensal: 3_000 })
    expect(b.cenarios.semCarro.custoLiquido).toBeGreaterThan(a.cenarios.semCarro.custoLiquido)
  })
  it('com gasto sem carro muito baixo, ficar sem carro vence; com muito alto, ter o carro vence', () => {
    const barato = simularComparativoCarro({ mobilidadeMensal: 200 })
    const caro = simularComparativoCarro({ mobilidadeMensal: 9_000 })
    expect(barato.vencedor).toBe('semCarro')
    expect(caro.vencedor).not.toBe('semCarro')
  })
  it('o ponto de virada separa os dois mundos', () => {
    const i = inputsCarroPadrao({})
    const pv = pontoDeViradaCarro(i)
    expect(pv.financiamento).not.toBeNull()
    const virada = pv.financiamento as number
    const abaixo = simularComparativoCarro({ mobilidadeMensal: virada - 150 })
    const acima = simularComparativoCarro({ mobilidadeMensal: virada + 150 })
    expect(abaixo.patrimonioSemCustosVenda.semCarro).toBeGreaterThan(abaixo.patrimonioSemCustosVenda.financiamento)
    expect(acima.patrimonioSemCustosVenda.financiamento).toBeGreaterThan(acima.patrimonioSemCustosVenda.semCarro)
  })
  it('à vista não tem ponto de virada quando o dinheiro não cobre o carro', () => {
    expect(pontoDeViradaCarro(inputsCarroPadrao({})).avista).toBeNull()
    expect(pontoDeViradaCarro(inputsCarroPadrao({ dinheiroDisponivel: 150_000 })).avista).not.toBeNull()
  })
})

describe('tipo do carro', () => {
  it('seminovo deprecia menos que 0 km no mesmo valor', () => {
    const zero = simularComparativoCarro({})
    const semi = simularComparativoCarro(aplicarTipoCarro(inputsCarroPadrao({}), 'seminovo'))
    expect(semi.cenarios.financiamento.depreciacao).toBeLessThan(zero.cenarios.financiamento.depreciacao)
  })
  it('trocar o tipo só recarrega os valores de partida dependentes do tipo', () => {
    const i = inputsCarroPadrao({ valorCarro: 80_000, entrada: 20_000 })
    const s = aplicarTipoCarro(i, 'seminovo')
    expect(s.valorCarro).toBe(80_000)
    expect(s.entrada).toBe(20_000)
    expect(s.deprecAno1Pct).toBe(PRESET_TIPO.seminovo.deprecAno1Pct)
  })
})

describe('validação e snapshot', () => {
  it('barra entradas impossíveis em português', () => {
    expect(validarInputsCarro(inputsCarroPadrao({ valorCarro: 0 }))).toContain('Informe o valor do carro.')
    expect(validarInputsCarro(inputsCarroPadrao({ horizonteAnos: 15 }))[0]).toMatch(/1 e 10 anos/)
    expect(validarInputsCarro(inputsCarroPadrao({ entrada: 200_000 }))[0]).toMatch(/entrada/)
    expect(validarInputsCarro(inputsCarroPadrao({}))).toEqual([])
  })
  it('pega Selic e IPCA de longo prazo do Focus, e sem Focus devolve vazio', () => {
    const snap = { focus: { data: '2026-10-02', selic: { '2026': 14, '2028': 10.5 }, ipca: { '2026': 4.8, '2028': 3.5 } }, indicadores: {} } as unknown as SnapshotMercado
    expect(inputsCarroDoSnapshot(snap)).toEqual({ rendimentoAA: 10.5, inflacaoAA: 3.5, reajusteConsorcioAA: 3.5 })
    expect(inputsCarroDoSnapshot({ indicadores: {} } as unknown as SnapshotMercado)).toEqual({})
  })
})
