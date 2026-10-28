import { describe, expect, it } from 'vitest'
import type { AnaliseFundamentalista, EmpresaFundamentos, PeriodoFundamental, Recomendacao } from './analiseFundamentalista'
import { calcularPrecoTeto, tetoBazin, tetoGraham, tickersParaAvisar } from './precoTeto'

function periodo(p: Partial<PeriodoFundamental>): PeriodoFundamental {
  return {
    consolidacao: 'consolidada', receita: null, lucroBruto: null, ebit: null, ebitda: null, depreciacao: null, resultadoFinanceiro: null,
    despesaFinanceira: null, equivalencia: null, lucroLiquido: null, lucroControladores: null, fco: null, capex: null, dividendosPagos: null,
    ativoTotal: null, ativoCirculante: null, passivoCirculante: null, caixa: null, divida: null, patrimonioLiquido: null, plControladores: null,
    minoritarios: null, link: null, ...p,
  }
}

// 1.000.000 de ações; valores em R$ mil. Dividendos de R$ 3,00 por ação por ano = R$ 3.000 mil.
const ACOES = 1_000_000
function empresa(p: { dividendos?: (number | null)[]; lucro?: number; pl?: number }): EmpresaFundamentos {
  const divs = p.dividendos ?? [3000, 3000, 3000, 3000, 3000]
  return {
    ticker: 'ALFA3', nome: 'Alfa', setor: 'Indústria', financeira: false, cnpj: '1',
    ultimaDemonstracao: { doc: 'DFP', dtRefer: '2025-12-31', dtReceb: null, versao: 1, link: null },
    anual: divs.map((d, i) => periodo({ exercicio: String(2021 + i), dividendosPagos: d })),
    ttm: periodo({ lucroControladores: p.lucro ?? 10_000, plControladores: p.pl ?? 20_000 }),
    acoes: null, alertas: [],
  }
}

function analise(p: { valorJusto?: number | null; categoria?: AnaliseFundamentalista['categoria']; critico?: boolean; rec?: Recomendacao }): AnaliseFundamentalista {
  const vj = p.valorJusto === undefined ? 60 : p.valorJusto
  return {
    ticker: 'ALFA3', nome: 'Alfa',
    mercado: { preco: 40, valorMercado: null, ev: null, acoes: ACOES, aproximado: false },
    valorJusto: {
      aplicavel: vj !== null, motivo: null, faixa: null, confianca: 'media', confiancaMotivos: [], margemSegurancaPct: null, potencialBasePct: null, precoEntrada: null,
      cenarios: vj === null ? [] : [{ cenario: 'base', valorJusto: vj, potencialPct: null, metodos: [], premissas: '', invalidacao: '' }],
    },
    categoria: p.categoria ?? 'neutra',
    recomendacao: { categoria: p.rec ?? 'considerar-entrada', justificativa: ['Justificativa da fundamentalista.'], reavaliar: [] },
    alertas: p.critico ? [{ id: 'x', titulo: 'Lucro negativo', detalhe: '', gravidade: 'critico' }] : [],
  } as unknown as AnaliseFundamentalista
}

describe('Bazin', () => {
  it('divide o dividendo médio por ação pela taxa de 6%', () => {
    const b = tetoBazin(empresa({}), ACOES, 40, null, 0.06)
    expect(b.dividendoMedio).toBeCloseTo(3, 6)
    expect(b.teto).toBeCloseTo(50, 6)
    expect(b.curto).toBe(false)
  })

  it('usa a taxa escolhida', () => {
    expect(tetoBazin(empresa({}), ACOES, 40, null, 0.1).teto).toBeCloseTo(30, 6)
  })

  it('com menos de 3 exercícios cai para os proventos de 12 meses da B3 e marca histórico curto', () => {
    const b = tetoBazin(empresa({ dividendos: [3000, null, null, null, null] }), ACOES, 40, 0.09, 0.06)
    expect(b.dividendoMedio).toBeCloseTo(3.6, 6)
    expect(b.teto).toBeCloseTo(60, 6)
    expect(b.curto).toBe(true)
  })

  it('não se aplica sem dividendos', () => {
    const b = tetoBazin(empresa({ dividendos: [0, 0, 0, 0, 0] }), ACOES, 40, null, 0.06)
    expect(b.aplicavel).toBe(false)
    expect(b.teto).toBeNull()
  })

  it('trata dividendo lançado como saída de caixa (sinal negativo) pelo valor absoluto', () => {
    expect(tetoBazin(empresa({ dividendos: [-3000, -3000, -3000] }), ACOES, 40, null, 0.06).teto).toBeCloseTo(50, 6)
  })
})

describe('Bazin: dividendos por exercício e dividendos recentes', () => {
  it('lista o dividendo por ação de cada exercício e o DY de 12 meses', () => {
    const b = tetoBazin(empresa({}), ACOES, 40, 0.075, 0.06)
    expect(b.porExercicio).toHaveLength(5)
    expect(b.porExercicio[0]).toEqual({ ano: '2021', valor: 3 })
    expect(b.dy12m).toBe(0.075)
    expect(b.recenteMenor).toBe(false)
  })

  it('avisa quando os 12 meses pagaram menos de 70% da média', () => {
    // média R$ 3,00; 12 meses: 5% de R$ 40 = R$ 2,00 (67%)
    expect(tetoBazin(empresa({}), ACOES, 40, 0.05, 0.06).recenteMenor).toBe(true)
    // 6% de R$ 40 = R$ 2,40 (80%)
    expect(tetoBazin(empresa({}), ACOES, 40, 0.06, 0.06).recenteMenor).toBe(false)
  })

  it('sem DY da B3 não há aviso nem DY', () => {
    const b = tetoBazin(empresa({}), ACOES, 40, null, 0.06)
    expect(b.dy12m).toBeNull()
    expect(b.recenteMenor).toBe(false)
  })
})

describe('Graham', () => {
  it('calcula a raiz de 22,5 × LPA × VPA', () => {
    // LPA 10, VPA 20: raiz de 22,5 × 200 = 67,08
    const g = tetoGraham(empresa({ lucro: 10_000, pl: 20_000 }), ACOES)
    expect(g.teto).toBeCloseTo(Math.sqrt(22.5 * 10 * 20), 6)
  })

  it('não se aplica com lucro ou patrimônio negativo', () => {
    expect(tetoGraham(empresa({ lucro: -1 }), ACOES).aplicavel).toBe(false)
    expect(tetoGraham(empresa({ pl: -1 }), ACOES).aplicavel).toBe(false)
  })
})

describe('regras de consistência com a análise fundamentalista', () => {
  const e = empresa({})

  it('liga o aviso quando o preço está abaixo do teto e a fundamentalista não objeta', () => {
    const r = calcularPrecoTeto({ empresa: e, analise: analise({ valorJusto: 60 }), preco: 40 })
    expect(r.status).toBe('abaixo-do-teto')
    expect(r.objecoes).toEqual([])
    expect(r.grahamConfirma).toBe(true)
  })

  it('não liga o aviso quando o preço está acima do valor justo base, mesmo abaixo do teto de Bazin', () => {
    const r = calcularPrecoTeto({ empresa: e, analise: analise({ valorJusto: 30 }), preco: 40 })
    expect(r.status).toBe('vetado')
    expect(r.objecoes[0]).toMatch(/acima do valor justo base/)
  })

  it('não liga o aviso sem valor justo calculado', () => {
    const r = calcularPrecoTeto({ empresa: e, analise: analise({ valorJusto: null }), preco: 40 })
    expect(r.status).toBe('vetado')
  })

  it('não liga o aviso com categoria "evitar" nem com alerta crítico', () => {
    expect(calcularPrecoTeto({ empresa: e, analise: analise({ categoria: 'evitar' }), preco: 40 }).status).toBe('vetado')
    expect(calcularPrecoTeto({ empresa: e, analise: analise({ critico: true }), preco: 40 }).status).toBe('vetado')
  })

  it('marca "perto" até 5% acima do teto e "aguardando" além disso', () => {
    expect(calcularPrecoTeto({ empresa: e, analise: analise({}), preco: 52 }).status).toBe('perto')
    const longe = calcularPrecoTeto({ empresa: e, analise: analise({}), preco: 70 })
    expect(longe.status).toBe('aguardando')
    expect(longe.distanciaPct).toBeCloseTo(40, 6)
  })

  it('dividendo recente abaixo de 70% da média vira ressalva, mas não tira o verde (a fundamentalista é o juiz)', () => {
    // média R$ 3,00 (teto R$ 50); 12 meses: 5% de R$ 40 = R$ 2,00
    const r = calcularPrecoTeto({ empresa: e, analise: analise({ valorJusto: 60 }), preco: 40, dyB3: 0.05 })
    expect(r.status).toBe('abaixo-do-teto')
    expect(r.ressalva).toMatch(/70% da média/)
    expect(r.bazin.tetoRecente).toBeCloseTo(2 / 0.06 * 1, 6)
    expect(calcularPrecoTeto({ empresa: e, analise: analise({ valorJusto: 60 }), preco: 40, dyB3: 0.06 }).ressalva).toBeNull()
  })

  it('só acende o verde quando a leitura final da fundamentalista é "considerar entrada"', () => {
    for (const rec of ['aguardar-preco', 'manter-acompanhar', 'reduzir-exposicao', 'evitar-novos'] as const) {
      const r = calcularPrecoTeto({ empresa: e, analise: analise({ rec }), preco: 40 })
      expect(r.status).toBe('vetado')
      expect(r.objecoes[0]).toContain('A análise fundamentalista diz')
    }
    expect(calcularPrecoTeto({ empresa: e, analise: analise({ rec: 'considerar-entrada' }), preco: 40 }).status).toBe('abaixo-do-teto')
  })

  it('"perto do teto" (amarelo) não aparece quando a fundamentalista diz evitar ou reduzir', () => {
    expect(calcularPrecoTeto({ empresa: e, analise: analise({ rec: 'evitar-novos' }), preco: 52 }).status).toBe('aguardando')
    expect(calcularPrecoTeto({ empresa: e, analise: analise({ rec: 'reduzir-exposicao' }), preco: 52 }).status).toBe('aguardando')
  })

  it('quando a fundamentalista vê margem e o preço está acima do teto, a mensagem explica que só avisa quando as duas concordam', () => {
    const r = calcularPrecoTeto({ empresa: e, analise: analise({ rec: 'considerar-entrada' }), preco: 70 })
    expect(r.status).toBe('aguardando')
    expect(r.mensagem).toMatch(/só liga quando as duas concordam/)
  })

  it('sem dividendos o gatilho passa a ser Graham', () => {
    const r = calcularPrecoTeto({ empresa: empresa({ dividendos: [0, 0, 0] }), analise: analise({ valorJusto: 80 }), preco: 60 })
    expect(r.gatilho).toBe('graham')
    expect(r.status).toBe('abaixo-do-teto')
  })

  it('sem nenhum método aplicável, não há teto', () => {
    const r = calcularPrecoTeto({ empresa: empresa({ dividendos: [0, 0, 0], lucro: -5 }), analise: analise({}), preco: 40 })
    expect(r.status).toBe('sem-teto')
    expect(r.tetoGatilho).toBeNull()
  })
})

describe('tickersParaAvisar', () => {
  const item = (ticker: string, status: 'abaixo-do-teto' | 'aguardando') => ({ ticker, status }) as never
  it('avisa só quem acabou de entrar abaixo do teto', () => {
    const r = tickersParaAvisar([item('A', 'abaixo-do-teto'), item('B', 'abaixo-do-teto'), item('C', 'aguardando')], ['A'])
    expect(r.avisar).toEqual(['B'])
    expect(r.avisados).toEqual(['A', 'B'])
  })

  it('quem saiu da zona volta a ser avisado ao entrar de novo', () => {
    const saiu = tickersParaAvisar([item('A', 'aguardando')], ['A'])
    expect(saiu.avisados).toEqual([])
    expect(tickersParaAvisar([item('A', 'abaixo-do-teto')], saiu.avisados).avisar).toEqual(['A'])
  })
})
