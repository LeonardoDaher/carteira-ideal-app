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
const CINCO: ChaveCarro[] = ['avista', 'financiamento', 'consorcio', 'locacao', 'semCarro']
const COM_DINHEIRO = { dinheiroDisponivel: 130_000 } // carro de 100.000 + emplacamento de 1,5%

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
    expect(inputsCarroDoSnapshot(snap)).toEqual({ rendimentoAA: 10.5, inflacaoAA: 3.5, reajusteConsorcioAA: 3.5, locacaoReajusteAA: 3.5 })
    expect(inputsCarroDoSnapshot({ indicadores: {} } as unknown as SnapshotMercado)).toEqual({})
  })
})

describe('locação como quinto caminho e escolha dos caminhos (D69)', () => {
  const perto = (a: number, b: number, tol = 0.05) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

  it('sem escolher caminhos, o resultado é o de antes: a locação fica de fora e não mexe em nada', () => {
    const a = simularComparativoCarro(COM_DINHEIRO)
    const b = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: TODAS })
    expect(a.rotas).toEqual(['financiamento', 'semCarro', 'consorcio', 'avista'])
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    // mexer só nos campos da locação não pode alterar os quatro caminhos de antes
    const c = simularComparativoCarro({ ...COM_DINHEIRO, locacaoMensal: 9_999, locacaoCaucao: 20_000, locacaoComprarNoFim: true })
    for (const k of TODAS) expect(c.cenarios[k].patrimonioFinal).toBe(a.cenarios[k].patrimonioFinal)
    expect(c.orcamentoReferencia).toEqual(a.orcamentoReferencia)
  })

  it('com os cinco caminhos, a locação entra no ranking e no gráfico', () => {
    const r = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO })
    expect([...r.rotas].sort()).toEqual([...CINCO].sort())
    expect([...r.ranking].sort()).toEqual([...CINCO].sort())
    expect(r.serieMensal[0]).toHaveProperty('locacao')
    expect(r.serieMensal).toHaveLength(61)
  })

  it('a contabilidade fecha na locação, pura e com compra no fim, com e sem deságio, caução, taxa e km excedente', () => {
    const base = { ...COM_DINHEIRO, caminhos: CINCO }
    const casos: Partial<InputsCarro>[] = [
      {},
      { locacaoComprarNoFim: true },
      { locacaoComprarNoFim: true, descontarCustosVenda: true },
      { locacaoCaucao: 0 },
      { locacaoTaxaEntrada: 1_500, locacaoCaucao: 4_000 },
      { locacaoKmRodado: 3_500, locacaoKmIncluido: 2_000, locacaoKmExcedente: 1.2 },
      { locacaoComprarNoFim: true, locacaoValorCompra: 20_000 },
      { aplicarIR: false },
      { horizonteAnos: 1, mesContemplacao: 6 },
      { horizonteAnos: 9, locacaoComprarNoFim: true },
    ]
    for (const c of casos) {
      const r = simularComparativoCarro({ ...base, ...c })
      for (const k of r.rotas) expect(Math.abs(r.detalhe.contabilidade[k].diferenca)).toBeLessThan(0.05)
    }
  })

  it('a locação não tem o carro, a menos que compre no fim; a compra usa o valor do contrato e a transferência', () => {
    const pura = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO })
    expect(pura.cenarios.locacao.carro).toBe(0)
    expect(pura.detalhe.locacao.compra.feita).toBe(false)
    const comp = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoComprarNoFim: true, locacaoValorCompra: 40_000 })
    expect(comp.detalhe.locacao.compra.feita).toBe(true)
    expect(comp.detalhe.locacao.compra.valorCompra).toBe(40_000)
    expect(comp.cenarios.locacao.carro).toBe(comp.cenarios.avista.carro) // mesma idade, mesmo valor de mercado
    perto(comp.detalhe.locacao.compra.transferencia, comp.cenarios.locacao.carro * 0.015, 0.02)
    // comprar por menos do que o veículo vale deixa mais patrimônio do que não comprar, e por mais deixa menos
    const barato = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoComprarNoFim: true, locacaoValorCompra: 1_000 })
    const caro = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoComprarNoFim: true, locacaoValorCompra: 90_000 })
    expect(barato.cenarios.locacao.patrimonioFinal).toBeGreaterThan(pura.cenarios.locacao.patrimonioFinal)
    expect(caro.cenarios.locacao.patrimonioFinal).toBeLessThan(pura.cenarios.locacao.patrimonioFinal)
  })

  it('a mensalidade inclui IPVA, seguro e manutenção; o uso e o quilômetro excedente são por conta de quem aluga', () => {
    const r = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoKmRodado: 2_500 }) // 500 km acima do incluído
    const d = r.detalhe.locacao
    expect(d.kmExcedentePago).toBeGreaterThan(0)
    expect(d.usoPago).toBeGreaterThan(0)
    // 500 km × R$ 0,80 no 1º ano, reajustado por ano: o total passa de 12 × 400
    expect(d.kmExcedentePago).toBeGreaterThan(60 * 400)
    const sem = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoKmRodado: 1_000 })
    expect(sem.detalhe.locacao.kmExcedentePago).toBe(0)
    // total pago = mensalidades + excedente + uso
    perto(r.cenarios.locacao.custoTotal, d.mensalidadesPagas + d.kmExcedentePago + d.usoPago + d.taxaEntrada, 0.05)
    // mensalidade reajustada uma vez por ano
    perto(d.mensalidadeFinal, 3_000 * Math.pow(1.045, 4), 0.05)
  })

  it('a caução volta no fim e não é custo; a taxa de entrada não volta', () => {
    const sem = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoCaucao: 0, locacaoTaxaEntrada: 0, aplicarIR: false })
    const com = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoCaucao: 5_000, locacaoTaxaEntrada: 0, aplicarIR: false })
    // sem custo, a caução só tira o rendimento de R$ 5.000 durante o período
    expect(com.cenarios.locacao.custoTotal).toBe(sem.cenarios.locacao.custoTotal)
    expect(com.cenarios.locacao.patrimonioFinal).toBeLessThan(sem.cenarios.locacao.patrimonioFinal)
    const taxa = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: CINCO, locacaoCaucao: 0, locacaoTaxaEntrada: 2_000, aplicarIR: false })
    perto(taxa.cenarios.locacao.custoTotal - sem.cenarios.locacao.custoTotal, 2_000, 0.02)
  })

  it('o orçamento de referência considera só os caminhos escolhidos: à vista × consórcio não sente a locação', () => {
    const par = { ...COM_DINHEIRO, caminhos: ['avista', 'consorcio'] as ChaveCarro[] }
    const base = simularComparativoCarro(par)
    // mudar a locação e o financiamento por completo não pode mexer no par
    const sem = simularComparativoCarro({ ...par, locacaoMensal: 1, jurosMensalPct: 4 })
    expect(sem.cenarios.avista.patrimonioFinal).toBe(base.cenarios.avista.patrimonioFinal)
    expect(sem.cenarios.consorcio.patrimonioFinal).toBe(base.cenarios.consorcio.patrimonioFinal)
    expect(sem.orcamentoReferencia).toEqual(base.orcamentoReferencia)
    // e a locação, quando escolhida, pode definir o orçamento
    const comLoc = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: ['locacao', 'semCarro'], locacaoMensal: 8_000 })
    expect(comLoc.detalhe.orcamentoInicial.definidoPor).toBe('locacao')
    expect(comLoc.detalhe.investimentos.locacao.primeiroAporte).toBe(0)
  })

  it('qualquer par de caminhos funciona: ranking só com os escolhidos e contabilidade fechando', () => {
    for (let a = 0; a < CINCO.length; a++) {
      for (let b = a + 1; b < CINCO.length; b++) {
        const par = [CINCO[a], CINCO[b]]
        const r = simularComparativoCarro({ ...COM_DINHEIRO, caminhos: par, lance: 10_000 })
        expect([...r.ranking].sort()).toEqual([...par].sort())
        expect(par).toContain(r.vencedor)
        for (const k of r.rotas) expect(Math.abs(r.detalhe.contabilidade[k].diferenca)).toBeLessThan(0.05)
      }
    }
  })

  it('validação: menos de dois, inválido, repetido, à vista sem dinheiro e valores da locação', () => {
    expect(validarInputsCarro(inputsCarroPadrao({ caminhos: ['locacao'] })).join(' ')).toMatch(/pelo menos dois caminhos/)
    expect(validarInputsCarro(inputsCarroPadrao({ caminhos: ['locacao', 'locacao'] })).join(' ')).toMatch(/caminho inválido/)
    expect(validarInputsCarro(inputsCarroPadrao({ caminhos: ['locacao', 'xis' as ChaveCarro] })).join(' ')).toMatch(/caminho inválido/)
    expect(validarInputsCarro(inputsCarroPadrao({ caminhos: ['avista', 'locacao'] })).join(' ')).toMatch(/não dá para comprar à vista/)
    expect(validarInputsCarro(inputsCarroPadrao({ caminhos: ['avista', 'locacao'], ...COM_DINHEIRO }))).toEqual([])
    expect(validarInputsCarro(inputsCarroPadrao({ locacaoMensal: -1 })).join(' ')).toMatch(/locação/)
    expect(validarInputsCarro(inputsCarroPadrao({ locacaoComprarNoFim: true, locacaoValorCompra: 0 })).join(' ')).toMatch(/valor da compra/)
    expect(() => simularComparativoCarro({ caminhos: ['semCarro'] })).toThrow(/pelo menos dois caminhos/)
  })

  it('ponto de virada: contra "sem carro" como antes; contra a locação, na mensalidade; e é um empate de verdade', () => {
    const i = inputsCarroPadrao({ ...COM_DINHEIRO, caminhos: CINCO })
    const pv = pontoDeViradaCarro(i)
    expect(pv.contraLocacao).toBeDefined()
    expect(pv.financiamento).not.toBeNull()
    const ponto = pv.contraLocacao!.financiamento
    expect(ponto).not.toBeNull()
    const lider = (m: number) => {
      const r = simularComparativoCarro({ ...i, locacaoMensal: m, descontarCustosVenda: false })
      return r.patrimonioSemCustosVenda.financiamento >= r.patrimonioSemCustosVenda.locacao ? 'financiamento' : 'locacao'
    }
    expect(lider(ponto! - 50)).not.toBe(lider(ponto! + 50))
    // sem "sem carro" na comparação, os pontos contra ele não existem; sem locação, não há contraLocacao
    const semSem = pontoDeViradaCarro(inputsCarroPadrao({ ...COM_DINHEIRO, caminhos: ['financiamento', 'locacao'] }))
    expect(semSem.financiamento).toBeNull()
    expect(semSem.contraLocacao).toBeDefined()
    expect(pontoDeViradaCarro(inputsCarroPadrao({ ...COM_DINHEIRO })).contraLocacao).toBeUndefined()
  })

  it('a sensibilidade à contemplação só existe com o consórcio na comparação', () => {
    expect(simularComparativoCarro({ ...COM_DINHEIRO, caminhos: ['locacao', 'semCarro'] }).sensibilidadeContemplacao).toEqual([])
    expect(simularComparativoCarro({ ...COM_DINHEIRO, caminhos: ['locacao', 'consorcio'] }).sensibilidadeContemplacao!.length).toBeGreaterThan(0)
  })

  it('aviso quando o dinheiro não cobre caução, taxa e compra no fim', () => {
    const r = simularComparativoCarro({ caminhos: ['locacao', 'semCarro'], entrada: 5_000, valorCarro: 100_000, locacaoCaucao: 40_000, locacaoTaxaEntrada: 5_000 })
    expect(r.avisos.join(' ')).toMatch(/Na locação, o dinheiro aplicado não cobriu/)
  })
})
