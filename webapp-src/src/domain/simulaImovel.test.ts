import { describe, expect, it } from 'vitest'
import {
  calcularCet,
  inputsDoSnapshot,
  inputsPadrao,
  pontoDeVirada,
  reaisCompacto,
  simularComparativoImobiliario,
  tabelaFinanciamento,
  validarInputs,
} from './simulaImovel'

const perto = (a: number, b: number, tol = 0.05) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol)

describe('tabelaFinanciamento', () => {
  it('SAC: amortização constante, parcela decrescente e saldo zerado no fim', () => {
    const t = tabelaFinanciamento(400_000, 10.5, 360, 'SAC')
    expect(t).toHaveLength(360)
    perto(t[0].amortizacao, 400_000 / 360)
    perto(t[0].juros, 400_000 * (0.105 / 12))
    expect(t[1].parcela).toBeLessThan(t[0].parcela)
    expect(t.at(-1)!.saldoDevedor).toBe(0)
    perto(t.reduce((s, l) => s + l.amortizacao, 0), 400_000, 0.01)
  })

  it('Price: parcela constante pela fórmula PMT e saldo zerado no fim', () => {
    const t = tabelaFinanciamento(400_000, 10.5, 360, 'PRICE')
    const im = 0.105 / 12
    const pmt = (400_000 * im) / (1 - Math.pow(1 + im, -360))
    perto(t[0].parcela, pmt, 0.01)
    perto(t[200].parcela, pmt, 0.01)
    expect(t.at(-1)!.saldoDevedor).toBe(0)
    perto(t.reduce((s, l) => s + l.amortizacao, 0), 400_000, 0.01)
  })

  it('juros zero: amortiza em partes iguais; sem valor financiado, tabela vazia', () => {
    const t = tabelaFinanciamento(120_000, 0, 120, 'PRICE')
    perto(t[0].parcela, 1000, 0.001)
    expect(tabelaFinanciamento(0, 10, 360, 'SAC')).toEqual([])
  })
})

describe('calcularCet', () => {
  it('sem custos extras, o CET é a taxa efetiva da nominal informada', () => {
    const t = tabelaFinanciamento(300_000, 12, 240, 'PRICE')
    const cet = calcularCet(300_000, t.map((l) => l.parcela))
    perto(cet, (Math.pow(1 + 0.12 / 12, 12) - 1) * 100, 0.01)
  })

  it('com seguros e tarifa, o CET passa da taxa efetiva', () => {
    const t = tabelaFinanciamento(300_000, 12, 240, 'PRICE')
    const cet = calcularCet(300_000, t.map((l) => l.parcela + 80))
    expect(cet).toBeGreaterThan((Math.pow(1 + 0.12 / 12, 12) - 1) * 100 + 0.1)
  })
})

describe('validarInputs', () => {
  it('aceita o padrão e recusa entradas impossíveis', () => {
    expect(validarInputs(inputsPadrao())).toEqual([])
    expect(validarInputs(inputsPadrao({ entrada: 600_000 })).join(' ')).toMatch(/entrada/i)
    expect(validarInputs(inputsPadrao({ horizonteAnos: 0 })).join(' ')).toMatch(/horizonte/i)
    expect(validarInputs(inputsPadrao({ mesContemplacao: 500 })).join(' ')).toMatch(/contempla/i)
    expect(validarInputs(inputsPadrao({ lance: -1 })).join(' ')).toMatch(/lance/i)
    expect(validarInputs(inputsPadrao({ valorImovel: Number.NaN })).length).toBeGreaterThan(0)
  })

  it('a função pública lança Error em português para entrada inválida', () => {
    expect(() => simularComparativoImobiliario({ valorImovel: 0 })).toThrow(/valor do imóvel/i)
  })
})

// Com rendimento, valorização, inflação e juros em zero, cada real que entra (capital inicial + orçamento
// mensal de referência) ou vira patrimônio ou vira custo. Se a contabilidade tiver um furo, estes testes quebram.
const SEM_TAXAS = {
  rendimentoAA: 0,
  aplicarIR: false,
  inflacaoAA: 0,
  valorizacaoImovelAA: 0,
  reajusteAluguelAA: 0,
  reajusteConsorcioAA: 0,
  custosPropriedadeAA: 1,
}

describe('conservação de dinheiro (taxas zeradas)', () => {
  it('os três cenários fecham o mesmo total: patrimônio + custo = capital inicial + orçamento', () => {
    // Aluguel: tudo o que não é aluguel é investido, então patrimônio + aluguel pago = K0 + Σ orçamento.
    // Financiamento e consórcio: patrimônio + custo total = K0 + Σ orçamento. Os três totais têm de ser iguais.
    const r = simularComparativoImobiliario({ ...SEM_TAXAS, horizonteAnos: 10, jurosNominalAA: 9 })
    const { financiamento: f, aluguel: a, consorcio: c } = r.cenarios
    const totalAluguel = a.patrimonioFinal + a.custoTotal
    perto(f.patrimonioFinal + f.custoTotal, totalAluguel, 1)
    perto(c.patrimonioFinal + c.custoTotal, totalAluguel, 1)
  })

  it('Financiamento: patrimônio = capital inicial + orçamento − (juros + seguros + tarifa + custos)', () => {
    const r = simularComparativoImobiliario({ ...SEM_TAXAS, horizonteAnos: 10, jurosNominalAA: 9, mesContemplacao: 24 })
    const c = r.cenarios.financiamento
    // pago de bolso = K0 + Σ desembolsos; o que vira patrimônio é o imóvel − dívida + fundo (que guarda a folga)
    // patrimônio + custo total = K0 + Σ orçamento = pago + folga investida
    const folga = c.fundoLiquido
    perto(c.patrimonioFinal + c.custoTotal, c.totalPagoDeBolso + folga, 0.5)
  })

  it('Consórcio: com lance, ITBI e complemento a conta fecha', () => {
    const r = simularComparativoImobiliario({
      ...SEM_TAXAS,
      horizonteAnos: 15,
      lance: 60_000,
      regraLance: 'prazo',
      mesContemplacao: 30,
      jurosNominalAA: 9,
    })
    const c = r.cenarios.consorcio
    perto(c.patrimonioFinal + c.custoTotal, c.totalPagoDeBolso + c.fundoLiquido, 1)
  })

  it('Consórcio, lance abatendo a parcela: a conta também fecha', () => {
    const r = simularComparativoImobiliario({
      ...SEM_TAXAS,
      horizonteAnos: 15,
      lance: 60_000,
      regraLance: 'parcela',
      mesContemplacao: 30,
    })
    const c = r.cenarios.consorcio
    perto(c.patrimonioFinal + c.custoTotal, c.totalPagoDeBolso + c.fundoLiquido, 1)
  })
})

describe('regras do racional', () => {
  const r = simularComparativoImobiliario({})

  it('o vencedor é o de maior patrimônio e o ranking está em ordem', () => {
    const p = (k: 'financiamento' | 'aluguel' | 'consorcio') => r.cenarios[k].patrimonioFinal
    expect(p(r.vencedor)).toBe(Math.max(p('financiamento'), p('aluguel'), p('consorcio')))
    expect(r.ranking[0]).toBe(r.vencedor)
    expect(p(r.ranking[0])).toBeGreaterThanOrEqual(p(r.ranking[1]))
    expect(p(r.ranking[1])).toBeGreaterThanOrEqual(p(r.ranking[2]))
    perto(r.vantagemSobreSegundo, p(r.ranking[0]) - p(r.ranking[1]), 0.01)
  })

  it('a série mensal tem N+1 pontos e o último bate com o patrimônio final', () => {
    expect(r.serieMensal).toHaveLength(20 * 12 + 1)
    const fim = r.serieMensal.at(-1)!
    perto(fim.financiamento, r.cenarios.financiamento.patrimonioFinal, 0.02)
    perto(fim.aluguel, r.cenarios.aluguel.patrimonioFinal, 0.02)
    perto(fim.consorcio, r.cenarios.consorcio.patrimonioFinal, 0.02)
  })

  it('antes da contemplação o consórcio não tem imóvel nem dívida na série: nunca fica abaixo do capital investido', () => {
    const c = simularComparativoImobiliario({ mesContemplacao: 36 })
    const antes = c.serieMensal.slice(0, 36)
    expect(antes.every((p) => p.consorcio >= c.capitalInicial - 0.01)).toBe(true)
    expect(Math.min(...c.serieMensal.map((p) => p.consorcio))).toBeGreaterThan(0)
  })

  it('mês 0: o financiamento já perdeu o ITBI/cartório; quem aluga mantém todo o capital', () => {
    const zero = r.serieMensal[0]
    perto(zero.aluguel, r.capitalInicial, 0.01)
    perto(zero.financiamento, 100_000, 0.01)
  })

  it('o CET fica acima dos juros efetivos por causa de seguros e tarifa', () => {
    expect(r.financiamento.cetAA).toBeGreaterThan((Math.pow(1 + 0.105 / 12, 12) - 1) * 100)
    perto(r.financiamento.financiado, 400_000, 0.01)
    expect(r.financiamento.primeiraParcela).toBeGreaterThan(r.financiamento.ultimaParcela)
  })

  it('SAC e Price dão resultados diferentes, ambos válidos', () => {
    const price = simularComparativoImobiliario({ sistema: 'PRICE' })
    expect(price.cenarios.financiamento.patrimonioFinal).not.toBe(r.cenarios.financiamento.patrimonioFinal)
    expect(price.financiamento.primeiraParcela).toBeLessThan(r.financiamento.primeiraParcela)
  })

  it('quando o horizonte passa do prazo do financiamento, a dívida zera', () => {
    const longo = simularComparativoImobiliario({ horizonteAnos: 35, prazoFinanciamentoAnos: 20 })
    expect(longo.cenarios.financiamento.saldoDevedor).toBe(0)
    expect(longo.avisos.join(' ')).toMatch(/quitado/)
  })

  it('horizonte menor que o prazo: sobra saldo devedor e ele é descontado', () => {
    const c = simularComparativoImobiliario({ horizonteAnos: 10 }).cenarios.financiamento
    expect(c.saldoDevedor).toBeGreaterThan(0)
    perto(c.patrimonioFinal, c.imovel - c.saldoDevedor + c.fundoLiquido, 0.05)
  })

  it('valorização maior favorece quem compra; rendimento maior favorece quem aluga', () => {
    const sobe = simularComparativoImobiliario({ valorizacaoImovelAA: 12 })
    expect(sobe.cenarios.financiamento.patrimonioFinal).toBeGreaterThan(r.cenarios.financiamento.patrimonioFinal)
    expect(sobe.cenarios.aluguel.patrimonioFinal).toBeCloseTo(r.cenarios.aluguel.patrimonioFinal, 0)
    const rende = simularComparativoImobiliario({ rendimentoAA: 14 })
    expect(rende.cenarios.aluguel.patrimonioFinal).toBeGreaterThan(r.cenarios.aluguel.patrimonioFinal)
  })

  it('IR: a taxa líquida informada (sem IR) rende mais que a bruta', () => {
    const semIr = simularComparativoImobiliario({ aplicarIR: false })
    expect(semIr.cenarios.aluguel.patrimonioFinal).toBeGreaterThan(r.cenarios.aluguel.patrimonioFinal)
  })

  it('custos de venda reduzem quem tem imóvel e não mexem em quem aluga', () => {
    const ambos = r
    expect(ambos.patrimonioComCustosVenda.financiamento).toBeLessThan(ambos.patrimonioSemCustosVenda.financiamento)
    expect(ambos.patrimonioComCustosVenda.consorcio).toBeLessThan(ambos.patrimonioSemCustosVenda.consorcio)
    expect(ambos.patrimonioComCustosVenda.aluguel).toBe(ambos.patrimonioSemCustosVenda.aluguel)
    const com = simularComparativoImobiliario({ descontarCustosVenda: true })
    expect(com.cenarios.financiamento.patrimonioFinal).toBe(r.patrimonioComCustosVenda.financiamento)
  })

  it('lance: abater o prazo e abater a parcela reduzem a dívida, cada um do seu jeito', () => {
    const base = { lance: 50_000, mesContemplacao: 24, horizonteAnos: 10 }
    const a = simularComparativoImobiliario({ ...base, regraLance: 'prazo' }).cenarios.consorcio
    const b = simularComparativoImobiliario({ ...base, regraLance: 'parcela' }).cenarios.consorcio
    const semLance = simularComparativoImobiliario({ mesContemplacao: 24, horizonteAnos: 10 }).cenarios.consorcio
    expect(a.saldoDevedor).toBeLessThan(semLance.saldoDevedor)
    expect(b.saldoDevedor).toBeLessThan(semLance.saldoDevedor)
    // Abater o prazo tira parcelas do FIM da fila; abater a parcela reduz cada parcela já. O valor econômico é o
    // mesmo (o patrimônio sem taxas é igual), mas no parcela o dinheiro sobra antes e a dívida do horizonte fica maior.
    expect(a.saldoDevedor).toBeLessThan(b.saldoDevedor)
    expect(b.fundoLiquido).toBeGreaterThan(a.fundoLiquido)
  })

  it('contemplar mais cedo significa mais tempo morando: o consórcio melhora com a valorização', () => {
    const cedo = simularComparativoImobiliario({ valorizacaoImovelAA: 9, mesContemplacao: 12 }).cenarios.consorcio.patrimonioFinal
    const tarde = simularComparativoImobiliario({ valorizacaoImovelAA: 9, mesContemplacao: 120 }).cenarios.consorcio.patrimonioFinal
    expect(cedo).toBeGreaterThan(tarde)
  })

  it('consórcio quitado antes do horizonte não deixa dívida', () => {
    const c = simularComparativoImobiliario({ prazoConsorcioMeses: 120, horizonteAnos: 15 }).cenarios.consorcio
    expect(c.saldoDevedor).toBe(0)
  })

  it('expõe a sensibilidade à data de contemplação, só com meses possíveis', () => {
    const s = r.sensibilidadeContemplacao!
    expect(s.map((x) => x.mes)).toEqual([12, 36, 60, 120, 180])
    const curto = simularComparativoImobiliario({ prazoConsorcioMeses: 100, horizonteAnos: 20 }).sensibilidadeContemplacao!
    expect(Math.max(...curto.map((x) => x.mes))).toBeLessThanOrEqual(100)
  })

  it('o orçamento de referência é o maior desembolso: o 1º mês é o do financiamento', () => {
    expect(r.orcamentoReferencia[0]).toBeGreaterThanOrEqual(r.financiamento.primeiraParcela)
  })
})

describe('ponto de virada', () => {
  it('na valorização encontrada, financiar e alugar empatam', () => {
    const entrada = inputsPadrao()
    const pv = pontoDeVirada(entrada)
    expect(pv.financiamentoVsAluguel).not.toBeNull()
    const v = pv.financiamentoVsAluguel!
    const r = simularComparativoImobiliario({ valorizacaoImovelAA: v })
    const dif = r.patrimonioSemCustosVenda.financiamento - r.patrimonioSemCustosVenda.aluguel
    expect(Math.abs(dif)).toBeLessThan(5_000)
  })

  it('acima do ponto de virada financiar vence o aluguel; abaixo, o contrário', () => {
    const v = pontoDeVirada(inputsPadrao()).financiamentoVsAluguel!
    const acima = simularComparativoImobiliario({ valorizacaoImovelAA: v + 1.5 }).patrimonioSemCustosVenda
    const abaixo = simularComparativoImobiliario({ valorizacaoImovelAA: v - 1.5 }).patrimonioSemCustosVenda
    expect(acima.financiamento).toBeGreaterThan(acima.aluguel)
    expect(abaixo.financiamento).toBeLessThan(abaixo.aluguel)
  })

  it('devolve null quando a ordem não muda no intervalo testado', () => {
    const pv = pontoDeVirada(inputsPadrao({ rendimentoAA: 40 }))
    expect(pv.financiamentoVsAluguel).toBeNull()
  })
})

describe('exemplo do racional: R$ 500 mil, entrada 20%, 10,5% a.a., aluguel R$ 2.500, consórcio 16%, rendimento 10%, 20 anos', () => {
  it('roda inteiro e produz um vencedor com todos os números preenchidos', () => {
    const r = simularComparativoImobiliario({})
    for (const k of ['financiamento', 'aluguel', 'consorcio'] as const) {
      const c = r.cenarios[k]
      expect(Number.isFinite(c.patrimonioFinal)).toBe(true)
      expect(Number.isFinite(c.totalPagoDeBolso)).toBe(true)
      expect(c.patrimonioFinalHoje).toBeLessThan(c.patrimonioFinal)
    }
    expect(['financiamento', 'aluguel', 'consorcio']).toContain(r.vencedor)
    expect(r.consorcio.parcelaInicial).toBeCloseTo((500_000 * 1.16) / 200, 2)
  })
})

describe('inputsDoSnapshot e reaisCompacto', () => {
  const base = { geradoEm: null, indicadores: {}, derivados: {}, tesouro: { dataBase: null, titulos: [] } }

  it('usa a projeção de longo prazo do Focus como ponto de partida', () => {
    const p = inputsDoSnapshot({ ...base, focus: { data: '2026-09-25', ipca: { 2027: 4.3, 2030: 3.5 }, selic: { 2027: 12, 2030: 10 } } })
    expect(p).toEqual({ rendimentoAA: 10, inflacaoAA: 3.5, valorizacaoImovelAA: 3.5, reajusteAluguelAA: 3.5, reajusteConsorcioAA: 3.5 })
  })

  it('sem Focus, não muda nada', () => {
    expect(inputsDoSnapshot(base)).toEqual({})
  })

  it('formata valores curtos para o gráfico', () => {
    expect(reaisCompacto(1_500_000)).toBe('R$ 1,5 mi')
    expect(reaisCompacto(800_000)).toBe('R$ 800 mil')
    expect(reaisCompacto(0)).toBe('R$ 0')
    expect(reaisCompacto(-250_000)).toBe('−R$ 250 mil')
  })
})

describe('contabilidade item a item (a conta que o cliente lê precisa fechar)', () => {
  const casos: [string, Parameters<typeof simularComparativoImobiliario>[0]][] = [
    ['padrão', {}],
    ['Price', { sistema: 'PRICE' }],
    ['rendimento e valorização altos', { rendimentoAA: 14, valorizacaoImovelAA: 8 }],
    ['horizonte maior que o prazo do financiamento', { horizonteAnos: 35, prazoFinanciamentoAnos: 20 }],
    ['lance abatendo a parcela', { lance: 60_000, regraLance: 'parcela', mesContemplacao: 24 }],
    ['lance abatendo o prazo, horizonte curto', { lance: 60_000, mesContemplacao: 60, horizonteAnos: 12 }],
    ['com custos de venda', { descontarCustosVenda: true }],
    ['taxa já líquida (sem IR)', { aplicarIR: false }],
    ['consórcio quitado antes do horizonte', { prazoConsorcioMeses: 120, horizonteAnos: 15 }],
    ['reajustes e inflação altos', { reajusteConsorcioAA: 7, inflacaoAA: 6, reajusteAluguelAA: 6 }],
    ['sem entrada nem aluguel', { entrada: 0, aluguelMensal: 0 }],
  ]

  it.each(casos)('%s: patrimônio = colocado − custos + valorização + rendimento − IR − custos de venda', (_nome, entrada) => {
    const r = simularComparativoImobiliario(entrada)
    for (const k of ['financiamento', 'aluguel', 'consorcio'] as const) {
      const c = r.detalhe.contabilidade[k]
      expect(Math.abs(c.diferenca), `${k}: diferença ${c.diferenca}`).toBeLessThanOrEqual(1)
      expect(c.patrimonioFinal).toBe(r.cenarios[k].patrimonioFinal)
    }
  })

  it('os três cenários usam exatamente o mesmo dinheiro (capital inicial + orçamento)', () => {
    const { financiamento: f, aluguel: a, consorcio: c } = simularComparativoImobiliario({}).detalhe.contabilidade
    expect(f.totalColocado).toBe(a.totalColocado)
    expect(c.totalColocado).toBe(a.totalColocado)
  })

  it('os itens do financiamento somam o custo total e o pago de bolso', () => {
    const r = simularComparativoImobiliario({})
    const d = r.detalhe.financiamento
    perto(d.itbiCartorio + d.jurosPagos + d.seguroMip + d.seguroDfi + d.tarifas + d.custosPropriedade, r.cenarios.financiamento.custoTotal, 0.05)
    perto(d.entrada + d.itbiCartorio + d.parcelasPagas + d.seguroMip + d.seguroDfi + d.tarifas + d.custosPropriedade, r.cenarios.financiamento.totalPagoDeBolso, 0.05)
    perto(d.amortizacaoPaga + d.jurosPagos, d.parcelasPagas, 0.05)
    perto(d.entrada + d.amortizacaoPaga + d.saldoDevedor, 500_000, 0.05) // entrada + principal pago + dívida = valor do imóvel
  })

  it('os itens do consórcio somam o custo total', () => {
    const r = simularComparativoImobiliario({ lance: 40_000 })
    const d = r.detalhe.consorcio
    perto(
      d.taxaAdministracao + d.fundoReserva + d.aluguelAteContemplacao + d.itbiCartorio + d.custosPropriedade + d.reajusteDasParcelas,
      r.cenarios.consorcio.custoTotal,
      0.05,
    )
    // taxa de administração e fundo de reserva guardam a proporção 15 : 1
    perto(d.taxaAdministracao / d.fundoReserva, 15, 0.01)
  })

  it('o reajuste das parcelas é zero sem correção e positivo com correção', () => {
    const zero = simularComparativoImobiliario({ reajusteConsorcioAA: 0, inflacaoAA: 0 }).detalhe.consorcio.reajusteDasParcelas
    expect(Math.abs(zero)).toBeLessThan(0.05)
    const com = simularComparativoImobiliario({ reajusteConsorcioAA: 6 }).detalhe.consorcio.reajusteDasParcelas
    expect(com).toBeGreaterThan(1000)
  })

  it('investimentos: aportado + rendimento − retirado − IR = saldo líquido; sem rendimento, o IR é zero', () => {
    const r = simularComparativoImobiliario({})
    for (const k of ['financiamento', 'aluguel', 'consorcio'] as const) {
      const v = r.detalhe.investimentos[k]
      perto(v.aportado + v.rendimentoBruto - v.retirado - v.irPago, v.saldoLiquido, 0.05)
    }
    const semGanho = simularComparativoImobiliario({ rendimentoAA: 0 })
    for (const k of ['financiamento', 'aluguel', 'consorcio'] as const) expect(semGanho.detalhe.investimentos[k].irPago).toBe(0)
  })

  it('custos de venda aparecem na contabilidade só quando a opção está ligada', () => {
    expect(simularComparativoImobiliario({}).detalhe.contabilidade.financiamento.custosDeVenda).toBe(0)
    expect(simularComparativoImobiliario({ descontarCustosVenda: true }).detalhe.contabilidade.financiamento.custosDeVenda).toBeGreaterThan(0)
  })
})

describe('decomposição da vantagem', () => {
  it.each([[{}], [{ rendimentoAA: 14 }], [{ valorizacaoImovelAA: 12 }], [{ descontarCustosVenda: true }]])(
    'custos + valorização + rendimento líquido (+ venda) entre 1º e 2º somam exatamente a vantagem (%j)',
    (entrada) => {
      const r = simularComparativoImobiliario(entrada)
      const [p, s] = r.ranking
      const a = r.detalhe.contabilidade[p]
      const b = r.detalhe.contabilidade[s]
      const soma =
        b.custos - a.custos + (a.valorizacaoImovel - b.valorizacaoImovel) + (a.rendimentoBruto - a.irSobreRendimento - (b.rendimentoBruto - b.irSobreRendimento)) + (b.custosDeVenda - a.custosDeVenda)
      perto(soma, r.vantagemSobreSegundo, 1)
    },
  )
})

describe('de onde vem o dinheiro aplicado', () => {
  it('total aplicado = capital inicial + aportes mensais; o aluguel e o consórcio começam com a entrada + ITBI, o financiamento começa do zero', () => {
    const r = simularComparativoImobiliario({})
    for (const k of ['financiamento', 'aluguel', 'consorcio'] as const) {
      const v = r.detalhe.investimentos[k]
      perto(v.capitalInicial + v.aportesMensais, v.aportado, 0.02)
    }
    expect(r.detalhe.investimentos.financiamento.capitalInicial).toBe(0)
    expect(r.detalhe.investimentos.aluguel.capitalInicial).toBe(120_000) // entrada 100.000 + ITBI/cartório 20.000
    expect(r.detalhe.investimentos.consorcio.capitalInicial).toBe(120_000)
  })

  it('o aporte do mês 1 é o orçamento de referência menos o gasto do caminho, e o orçamento é o maior desembolso', () => {
    const r = simularComparativoImobiliario({})
    const orc = r.detalhe.orcamentoInicial
    expect(orc.valor).toBe(r.orcamentoReferencia[0])
    // nos primeiros meses quem mais desembolsa é o consórcio: parcela (2.900) + aluguel (2.500)
    expect(orc.definidoPor).toBe('consorcio')
    perto(orc.valor, 5_400, 0.01)
    const a = r.detalhe.investimentos.aluguel
    perto(a.gastoPrimeiroMes, 2_500, 0.01)
    perto(a.primeiroAporte, 2_900, 0.01)
    expect(r.detalhe.investimentos.consorcio.primeiroAporte).toBe(0) // quem define o orçamento não aporta no mês 1
    for (const k of ['financiamento', 'aluguel', 'consorcio'] as const) {
      const v = r.detalhe.investimentos[k]
      perto(v.gastoPrimeiroMes + v.primeiroAporte, orc.valor, 0.02)
    }
  })

  it('os aportes do aluguel são positivos e menores que o orçamento total de 20 anos', () => {
    const a = simularComparativoImobiliario({}).detalhe.investimentos.aluguel
    expect(a.aportesMensais).toBeGreaterThan(0)
    expect(a.aportesMensais).toBeLessThan(5_400 * 240)
  })
})
