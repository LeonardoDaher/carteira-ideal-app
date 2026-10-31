import { describe, expect, it } from 'vitest'
import { analisarBalanco } from './balancos'
import type { EmpresaBalanco, Trimestre } from './balancos'
import { dividaLiquida, dividaLiquidaSobreEbitda, faixaDoRoe, lucroDosAcionistas, roe, tetoDividaEbitda } from './indicadoresComuns'

describe('indicadoresComuns', () => {
  it('lucro dos acionistas ignora controladores ausentes ou zerados', () => {
    expect(lucroDosAcionistas({ lucroControladores: 80, lucroLiquido: 100 })).toBe(80)
    expect(lucroDosAcionistas({ lucroControladores: 0, lucroLiquido: 100 })).toBe(100)
    expect(lucroDosAcionistas({ lucroControladores: null, lucroLiquido: 100 })).toBe(100)
  })
  it('dívida líquida e razão sobre o EBITDA', () => {
    expect(dividaLiquida({ divida: 500, caixa: 200 })).toBe(300)
    expect(dividaLiquida({ divida: null, caixa: 200 })).toBeNull()
    expect(dividaLiquidaSobreEbitda(300, 100)).toBe(3)
    expect(dividaLiquidaSobreEbitda(300, 0)).toBeNull()
    expect(dividaLiquidaSobreEbitda(300, -10)).toBeNull()
  })
  it('ROE sobre o patrimônio médio e faixas', () => {
    expect(roe(30, 220, 180)).toBeCloseTo(0.15)
    expect(roe(30, 200, null)).toBeCloseTo(0.15)
    expect(roe(30, -5, null)).toBeNull()
    expect(faixaDoRoe(0.15)).toBe('alto')
    expect(faixaDoRoe(0.1)).toBe('moderado')
    expect(faixaDoRoe(0.05)).toBe('baixo')
  })
  it('teto de endividamento sobe nos setores alavancados', () => {
    expect(tetoDividaEbitda('Energia Elétrica')).toBe(5)
    expect(tetoDividaEbitda('Mineração')).toBe(3.5)
  })
})

describe('a análise dos balanços usa as mesmas contas', () => {
  const tri = (periodo: string, rotulo: string): Trimestre => ({
    periodo, rotulo, tipo: 'ITR', dtReceb: null, link: null, consolidacao: 'consolidada', receita: 1000, ebit: 150, ebitda: 200, lucroLiquido: 100, lucroControladores: 90,
    ativoTotal: 5000, patrimonioLiquido: 2200, plControladores: 2000, caixa: 100, divida: 700,
  })
  const e: EmpresaBalanco = { ticker: 'T3', nome: 'T', setor: 'Mineração', financeira: false, cnpj: '1', proxima: null, trimestres: [['2025-03-31', '1T25'], ['2025-06-30', '2T25'], ['2025-09-30', '3T25'], ['2025-12-31', '4T25'], ['2026-03-31', '1T26']].map(([p, r]) => tri(p!, r!)) }
  it('ROE de 12 meses e dívida líquida ÷ EBITDA batem com o módulo comum', () => {
    const a = analisarBalanco(e)!
    const ult = a.trimestres.length - 1
    expect(a.linhas.find((l) => l.chave === 'roe')!.valores[ult]).toBeCloseTo(roe(360, 2000, 2000)!)
    expect(a.linhas.find((l) => l.chave === 'dividaEbitda')!.valores[ult]).toBeCloseTo(dividaLiquidaSobreEbitda(600, 800)!)
  })
})
