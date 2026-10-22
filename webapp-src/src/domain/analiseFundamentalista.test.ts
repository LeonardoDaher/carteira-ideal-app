import { describe, expect, it } from 'vitest'
import {
  analisarFundamentos, cagr, descontarFluxo, fcoCoerente, interpolar, medianaSetorial, multiplosDe, premissasDaSelic, valorDeMercado,
} from './analiseFundamentalista'
import type { EmpresaFundamentos, PeriodoFundamental } from './analiseFundamentalista'

/** Período em R$ mil. */
function periodo(p: Partial<PeriodoFundamental> & { exercicio?: string }): PeriodoFundamental {
  return {
    consolidacao: 'consolidada', receita: 1_000_000, lucroBruto: 400_000, ebit: 200_000, ebitda: 250_000, depreciacao: 50_000, resultadoFinanceiro: -40_000,
    despesaFinanceira: 40_000, equivalencia: 0, lucroLiquido: 120_000, lucroControladores: 120_000, fco: 180_000, capex: 90_000, dividendosPagos: 50_000,
    ativoTotal: 2_000_000, ativoCirculante: 600_000, passivoCirculante: 300_000, caixa: 150_000, divida: 400_000, patrimonioLiquido: 1_000_000,
    plControladores: 1_000_000, minoritarios: 0, acoes: 100_000_000, link: null, ...p,
  }
}

function empresa(opc: { ticker?: string; setor?: string; financeira?: boolean; ajuste?: (i: number) => Partial<PeriodoFundamental>; ttm?: Partial<PeriodoFundamental> | null; alertas?: string[]; acoes?: number } = {}): EmpresaFundamentos {
  const anos = [2021, 2022, 2023, 2024, 2025]
  const anual = anos.map((a, i) => periodo({ exercicio: `${a}-12-31`, receita: 1_000_000 * Math.pow(1.08, i), ebit: 200_000 * Math.pow(1.08, i), ebitda: 250_000 * Math.pow(1.08, i), lucroLiquido: 120_000 * Math.pow(1.08, i), lucroControladores: 120_000 * Math.pow(1.08, i), ...opc.ajuste?.(i) }))
  const ticker = opc.ticker ?? 'TESTE3'
  const acoes = opc.acoes ?? 100_000_000
  return {
    ticker, nome: `Empresa ${ticker}`, setor: opc.setor ?? 'Indústria', financeira: opc.financeira ?? false, cnpj: '1',
    ultimaDemonstracao: { doc: 'ITR', dtRefer: '2026-06-30', dtReceb: '2026-08-10', versao: 1, link: null },
    anual,
    ttm: opc.ttm === null ? null : periodo({ periodoAte: '2026-06-30', receita: 1_480_000, ebit: 300_000, ebitda: 360_000, lucroLiquido: 190_000, lucroControladores: 190_000, ...opc.ttm }),
    acoes: { classes: [{ classe: 'ON', ticker, quantidade: acoes, precoAproximado: false }], documento: 'ITR de 2026-06-30', ajusteUnidade: null, ajusteDesdobramento: null, pvpImplicito: 1.2 },
    alertas: opc.alertas ?? [],
  }
}

const precoFixo = (preco: number) => (t: string) => (t.startsWith('PAR') || t === 'TESTE3' || t === 'BANCO4' ? preco : null)

/** Quatro pares do mesmo setor, com P/L e P/VP próximos de 8× e 1×. */
function pares(setor = 'Indústria') {
  return ['PAR1', 'PAR2', 'PAR3', 'PAR4', 'PAR5'].map((t) => empresa({ ticker: `${t}3`, setor }))
}

describe('utilidades', () => {
  it('interpolar: linear por partes, com as pontas fixas', () => {
    const p: [number, number][] = [[0, 10], [10, 50], [20, 90]]
    expect(interpolar(-5, p)).toBe(10)
    expect(interpolar(5, p)).toBe(30)
    expect(interpolar(15, p)).toBe(70)
    expect(interpolar(99, p)).toBe(90)
  })

  it('cagr só existe com início e fim positivos', () => {
    expect(cagr(100, 200, 5)).toBeCloseTo(0.1487, 4)
    expect(cagr(-10, 200, 5)).toBeNull()
    expect(cagr(100, 0, 5)).toBeNull()
    expect(cagr(null, 200, 5)).toBeNull()
  })

  it('descontarFluxo: fluxo constante a 10% vale 10× o fluxo (perpetuidade sem crescimento)', () => {
    expect(descontarFluxo(100, 0, 0, 0.1)).toBeCloseTo(1000, 6)
  })

  it('descontarFluxo: um fluxo que cresce vale mais; uma taxa maior vale menos', () => {
    expect(descontarFluxo(100, 0.05, 0.03, 0.12)).toBeGreaterThan(descontarFluxo(100, 0, 0.03, 0.12))
    expect(descontarFluxo(100, 0.05, 0.03, 0.15)).toBeLessThan(descontarFluxo(100, 0.05, 0.03, 0.12))
  })

  it('premissasDaSelic ancora o desconto na Selic e o crescimento no IPCA de longo prazo', () => {
    const p = premissasDaSelic(13.75, 3.5)
    expect(p.taxaDesconto?.base).toBeCloseTo(0.1475, 6)
    expect(p.taxaDesconto?.pessimista).toBeCloseTo(0.1675, 6)
    expect(p.crescimentoTerminal?.base).toBeCloseTo(0.04, 6)
    expect(premissasDaSelic(null)).toEqual({})
  })

  it('fcoCoerente: caixa operacional acima de 2× o EBITDA é incoerente', () => {
    expect(fcoCoerente(periodo({ fco: 400_000, ebitda: 250_000 }))).toBe(true)
    expect(fcoCoerente(periodo({ fco: 600_000, ebitda: 250_000 }))).toBe(false)
    expect(fcoCoerente(periodo({ fco: null }))).toBe(false)
    expect(fcoCoerente(periodo({ fco: 5_000_000, ebitda: null, ebit: null }))).toBe(true) // sem referência, não se julga
  })
})

describe('mercado e múltiplos', () => {
  it('valor de mercado em R$ mil: cada classe pelo seu preço', () => {
    const e = empresa()
    e.acoes!.classes = [
      { classe: 'ON', ticker: 'TESTE3', quantidade: 100_000_000, precoAproximado: false },
      { classe: 'PN', ticker: 'TESTE4', quantidade: 50_000_000, precoAproximado: false },
    ]
    const m = valorDeMercado(e, (t) => ({ TESTE3: 10, TESTE4: 8 })[t] ?? null)
    expect(m.valorMercado).toBe((100_000_000 * 10 + 50_000_000 * 8) / 1000)
    expect(m.acoes).toBe(150_000_000)
    expect(m.aproximado).toBe(false)
  })

  it('classe sem preço usa o da outra e marca aproximado', () => {
    const e = empresa()
    e.acoes!.classes = [
      { classe: 'ON', ticker: 'TESTE3', quantidade: 100, precoAproximado: false },
      { classe: 'PN', ticker: 'TESTE4', quantidade: 100, precoAproximado: false },
    ]
    const m = valorDeMercado(e, (t) => (t === 'TESTE3' ? 10 : null))
    expect(m.aproximado).toBe(true)
  })

  it('capital implausível: sem valor de mercado e sem múltiplos', () => {
    const e = empresa({ alertas: ['capital_implausivel'] })
    expect(valorDeMercado(e, precoFixo(10)).valorMercado).toBeNull()
    expect(multiplosDe(e, precoFixo(10)).pl).toBeNull()
  })

  it('P/L, P/VP e EV/EBITDA a partir do TTM', () => {
    const e = empresa()
    const m = multiplosDe(e, precoFixo(10)) // valor de mercado: 100 mi ações × R$ 10 = R$ 1 bi = 1.000.000 mil
    expect(m.pl).toBeCloseTo(1_000_000 / 190_000, 6)
    expect(m.pvp).toBeCloseTo(1, 6)
    expect(m.evEbitda).toBeCloseTo((1_000_000 + 250_000) / 360_000, 6)
    expect(m.pVendas).toBeCloseTo(1_000_000 / 1_480_000, 6)
  })

  it('lucro negativo não gera P/L', () => {
    expect(multiplosDe(empresa({ ttm: { lucroLiquido: -10, lucroControladores: -10 } }), precoFixo(10)).pl).toBeNull()
  })

  it('mediana do setor precisa de ao menos 4 empresas com o múltiplo', () => {
    const alvo = empresa()
    const com = medianaSetorial(alvo, [alvo, ...pares()], precoFixo(10))
    expect(com.n).toBe(5)
    expect(com.medianas.pl).not.toBeNull()
    const poucos = medianaSetorial(alvo, [alvo, ...pares().slice(0, 3)], precoFixo(10))
    expect(poucos.medianas.pl).toBeNull()
    const outroSetor = medianaSetorial(alvo, [alvo, ...pares('Outro setor')], precoFixo(10))
    expect(outroSetor.n).toBe(0)
  })
})

describe('analisarFundamentos', () => {
  const analisar = (e: EmpresaFundamentos, preco = 10, todas?: EmpresaFundamentos[]) => analisarFundamentos({ empresa: e, precoDe: precoFixo(preco), todas: todas ?? [e, ...pares(e.setor)] })!

  it('sem exercícios, não analisa', () => {
    const e = empresa()
    e.anual = []
    expect(analisarFundamentos({ empresa: e, precoDe: precoFixo(10), todas: [e] })).toBeNull()
  })

  it('três cenários em ordem, com valor justo, margem de segurança e preço de entrada coerentes', () => {
    const a = analisar(empresa(), 6)
    const vj = a.valorJusto
    expect(vj.aplicavel).toBe(true)
    const [pess, base, otim] = vj.cenarios.map((c) => c.valorJusto as number)
    expect(pess).toBeLessThan(base)
    expect(base).toBeLessThan(otim)
    expect(vj.faixa).toEqual({ minimo: pess, maximo: otim })
    expect(vj.margemSegurancaPct).toBeCloseTo((1 - 6 / base) * 100, 6)
    expect(vj.potencialBasePct).toBeCloseTo((base / 6 - 1) * 100, 6)
    expect(vj.precoEntrada).toBeCloseTo(base * 0.75, 6)
    // potencial e margem de segurança são conceitos diferentes
    expect(vj.potencialBasePct).not.toBeCloseTo(vj.margemSegurancaPct as number, 3)
  })

  it('preço mais baixo gera margem de segurança maior e nota de valuation maior', () => {
    const barato = analisar(empresa(), 4)
    const caro = analisar(empresa(), 30)
    expect(barato.valorJusto.margemSegurancaPct as number).toBeGreaterThan(caro.valorJusto.margemSegurancaPct as number)
    expect(barato.pontuacao.valuation.nota as number).toBeGreaterThan(caro.pontuacao.valuation.nota as number)
  })

  it('as notas A, B e C pesam 40/35/25 e a nota total é a média ponderada', () => {
    const a = analisar(empresa(), 6)
    const { qualidade, valuation, risco, total, pesos } = a.pontuacao
    expect(pesos).toEqual({ qualidade: 0.4, valuation: 0.35, risco: 0.25 })
    const esperado = Math.round((qualidade.nota! * 0.4 + valuation.nota! * 0.35 + risco.nota! * 0.25) / 1)
    expect(total).toBe(esperado)
    expect(a.pontuacao.parcial).toBe(false)
  })

  it('pesos configuráveis mudam a nota total', () => {
    const e = empresa()
    const padrao = analisarFundamentos({ empresa: e, precoDe: precoFixo(6), todas: [e, ...pares()] })!
    const soQualidade = analisarFundamentos({ empresa: e, precoDe: precoFixo(6), todas: [e, ...pares()], premissas: { pesos: { qualidade: 1, valuation: 0, risco: 0 } } })!
    expect(soQualidade.pontuacao.total).toBe(soQualidade.pontuacao.qualidade.nota)
    expect(soQualidade.pontuacao.total).not.toBe(padrao.pontuacao.total)
  })

  it('taxa de desconto maior reduz o valor justo', () => {
    const e = empresa()
    const todas = [e, ...pares()]
    const baixa = analisarFundamentos({ empresa: e, precoDe: precoFixo(6), todas, premissas: premissasDaSelic(10, 3.5) })!
    const alta = analisarFundamentos({ empresa: e, precoDe: precoFixo(6), todas, premissas: premissasDaSelic(16, 3.5) })!
    const base = (x: typeof baixa) => x.valorJusto.cenarios.find((c) => c.cenario === 'base')!.valorJusto as number
    expect(base(alta)).toBeLessThan(base(baixa))
  })

  it('caixa operacional incoerente (mais de 2× o EBITDA) não vira fluxo de caixa livre nem valor justo por DCF', () => {
    const e = empresa({ ajuste: () => ({ fco: 5_000_000, capex: 100_000 }), ttm: { fco: 5_000_000, capex: 100_000 } })
    const a = analisarFundamentos({ empresa: e, precoDe: precoFixo(10), todas: [e] })!
    expect(a.alertas.map((x) => x.id)).toContain('fco-incoerente')
    expect(a.endividamentoECaixa.find((i) => i.id === 'fcf')!.valor).toBeNull()
    expect(a.valorJusto.aplicavel).toBe(false) // sem pares no setor, só o DCF seria possível
    expect(a.endividamentoECaixa.find((i) => i.id === 'conversao')!.valor).toBeNull()
  })

  it('prejuízo persistente: alerta crítico, categoria "evitar" e nenhuma recomendação de entrada', () => {
    const e = empresa({ ajuste: () => ({ lucroLiquido: -50_000, lucroControladores: -50_000, ebit: -10_000, ebitda: 30_000 }), ttm: { lucroLiquido: -80_000, lucroControladores: -80_000 } })
    const a = analisar(e, 5)
    expect(a.alertas.find((x) => x.id === 'lucro-negativo')?.gravidade).toBe('critico')
    expect(a.categoria).toBe('evitar')
    expect(a.recomendacao.categoria).toBe('evitar-novos')
  })

  it('endividamento alto dispara alerta crítico; setor de energia tem régua mais folgada', () => {
    const alavancada = (setor: string) => empresa({ setor, ajuste: () => ({ divida: 1_500_000 }), ttm: { divida: 1_500_000, ebitda: 360_000, ebit: 300_000 } })
    const industria = analisar(alavancada('Indústria'))
    const energia = analisar(alavancada('Energia elétrica'))
    // dívida líquida de 1.350.000 sobre EBITDA de 360.000 = 3,75×
    expect(industria.alertas.map((x) => x.id)).toContain('endividamento')
    expect(energia.alertas.map((x) => x.id)).not.toContain('endividamento')
  })

  it('diluição: ações que sobem 40% geram alerta crítico', () => {
    const e = empresa({ ajuste: (i) => ({ acoes: 100_000_000 * (1 + i * 0.1) }), acoes: 140_000_000 })
    e.anual[0].acoes = 100_000_000
    const a = analisar(e)
    expect(a.alertas.find((x) => x.id === 'diluicao')?.gravidade).toBe('critico')
  })

  it('capital implausível: sem valor de mercado, sem valor justo e conclusão "dados insuficientes", nunca "evitar"', () => {
    const a = analisar(empresa({ alertas: ['capital_implausivel'] }))
    expect(a.mercado.valorMercado).toBeNull()
    expect(a.valorJusto.aplicavel).toBe(false)
    expect(a.categoria).toBe('neutra')
    expect(a.recomendacao.categoria).toBe('manter-acompanhar')
    expect(a.recomendacao.justificativa.join(' ')).toMatch(/Dados insuficientes para conclusão/)
    expect(a.dados.limitacoes.join(' ')).toMatch(/implausível/)
  })

  it('instituição financeira: P/VP justo, sem EBITDA nem dívida líquida', () => {
    const e = empresa({ ticker: 'BANCO4', setor: 'Bancos', financeira: true, ajuste: () => ({ ebit: null, ebitda: null, fco: null, capex: null, divida: null, caixa: null, ativoCirculante: null, passivoCirculante: null }), ttm: { ebit: null, ebitda: null, fco: null, capex: null, divida: null, caixa: null, ativoCirculante: null, passivoCirculante: null } })
    const a = analisar(e, 8, [e, ...pares('Bancos').map((p) => ({ ...p, financeira: true }))])
    const base = a.valorJusto.cenarios.find((c) => c.cenario === 'base')!
    expect(base.metodos.map((m) => m.nome)).toContain('P/VP justo (ROE sustentável)')
    expect(a.endividamentoECaixa.map((i) => i.id)).toEqual(['pl-ativo'])
    expect(a.multiplos.map((m) => m.id)).not.toContain('ev-ebitda')
    expect(a.dados.limitacoes.join(' ')).toMatch(/instituição financeira/i)
  })

  it('o valor ausente na demonstração aparece como "dados insuficientes", não como zero', () => {
    const e = empresa({ ajuste: () => ({ capex: null }), ttm: { capex: null } })
    const a = analisar(e)
    const fcf = a.endividamentoECaixa.find((i) => i.id === 'fcf')!
    expect(fcf.valor).toBeNull()
    expect(fcf.interpretacao).toMatch(/insuficientes/)
  })

  it('cada indicador traz fórmula, fonte e data de referência', () => {
    const a = analisar(empresa())
    for (const i of [...a.rentabilidade, ...a.endividamentoECaixa, ...a.multiplos, ...a.dividendos.indicadores]) {
      expect(i.formula.length).toBeGreaterThan(10)
      expect(i.fonte).toMatch(/CVM/)
      expect(i.dataReferencia).toBe('2026-06-30')
      expect(i.interpretacao.length).toBeGreaterThan(5)
    }
  })

  it('o histórico traz 5 exercícios e a coluna de 12 meses, com margens e LPA', () => {
    const a = analisar(empresa())
    expect(a.historico).toHaveLength(6)
    expect(a.historico.at(-1)!.ttm).toBe(true)
    expect(a.historico[1].crescimentoReceita).toBeCloseTo(0.08, 6)
    expect(a.historico[0].margemEbit).toBeCloseTo(0.2, 6)
    expect(a.historico[0].lpa).toBeCloseTo((120_000 * 1000) / 100_000_000, 6)
    expect(a.cagr.receita).toBeCloseTo(0.08, 6)
    expect(a.cagr.anos).toBe(4)
  })

  it('vantagem competitiva e governança são indícios financeiros e dizem o que não sabem', () => {
    const a = analisar(empresa())
    expect(a.vantagem.limite).toMatch(/não análise do negócio/)
    expect(a.governanca.itens.some((i) => /Dados insuficientes para conclusão/.test(i.situacao))).toBe(true)
    expect(a.crescimento.origem).toMatch(/Dados insuficientes|dados insuficientes/)
  })

  it('riscos: três específicos e três externos do setor, com monitoramento', () => {
    const a = analisar(empresa({ setor: 'Petróleo e gás' }))
    expect(a.riscos.especificos).toHaveLength(3)
    expect(a.riscos.externos).toHaveLength(3)
    expect(a.riscos.externos[0].titulo).toMatch(/petr[oó]leo/i)
    for (const r of [...a.riscos.especificos, ...a.riscos.externos]) expect(r.monitorar.length).toBeGreaterThan(3)
  })

  it('dividendos: payout e cobertura pelo fluxo de caixa livre', () => {
    const a = analisar(empresa())
    const payout = a.dividendos.indicadores.find((i) => i.id === 'payout')!
    expect(payout.valor).toBeCloseTo(50_000 / 190_000, 6)
    expect(a.dividendos.aplicavel).toBe(true)
  })

  it('sem linguagem de promessa', () => {
    const texto = JSON.stringify(analisar(empresa()))
    expect(texto).not.toMatch(/garant|certeza de|vai subir|vai valorizar|lucro certo/i)
  })

  it('nenhum campo sai com NaN ou Infinity', () => {
    for (const e of [empresa(), empresa({ ttm: null }), empresa({ financeira: true, setor: 'Bancos' })]) {
      const t = JSON.stringify(analisar(e))
      expect(t).not.toMatch(/NaN|Infinity/)
    }
  })
})
