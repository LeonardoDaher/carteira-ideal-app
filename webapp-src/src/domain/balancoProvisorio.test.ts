import { describe, expect, it } from 'vitest'
import type { EmpresaFundamentos, PeriodoFundamental } from './analiseFundamentalista'
import type { EmpresaBalanco, Trimestre } from './balancos'
import { aplicarBalancoNovo, trimestreSeguinte } from './balancoProvisorio'

const ttm: PeriodoFundamental = { periodoAte: '2026-06-30', consolidacao: 'consolidada', receita: 1000, lucroBruto: 400, ebit: 200, ebitda: 250, depreciacao: 50, resultadoFinanceiro: -10, despesaFinanceira: 30, equivalencia: 0, lucroLiquido: 100, lucroControladores: 90, fco: 180, capex: 60, dividendosPagos: 40, ativoTotal: 2000, ativoCirculante: 800, passivoCirculante: 500, caixa: 300, divida: 400, patrimonioLiquido: 900, plControladores: 850, minoritarios: 50, link: null }

const empresa = (extra: Partial<EmpresaFundamentos> = {}): EmpresaFundamentos => ({
  ticker: 'ALFA3', nome: 'Alfa', setor: 'Indústria', financeira: false, cnpj: '1',
  ultimaDemonstracao: { doc: 'ITR', dtRefer: '2026-06-30', dtReceb: '2026-08-10', versao: 1, link: null },
  anual: [], ttm, acoes: null, alertas: [], ...extra,
})

const tri = (periodo: string, rotulo: string, extra: Partial<Trimestre> = {}): Trimestre => ({
  periodo, rotulo, tipo: 'ITR', dtReceb: '2025-11-10', link: null, consolidacao: 'consolidada', receita: 200, ebit: null, ebitda: null, fco: null, capex: null, dividendosPagos: null,
  lucroLiquido: 20, lucroControladores: 18, ativoTotal: 1900, patrimonioLiquido: 880, plControladores: 830, caixa: null, divida: null, ...extra,
})

const provisorio = (extra: Partial<Trimestre> = {}) => tri('2026-09-30', '3T26', { dtReceb: '2026-11-12', receita: 300, lucroLiquido: 40, lucroControladores: 36, ativoTotal: 2100, patrimonioLiquido: 950, plControladores: 900, provisorio: true, ...extra })

const balanco = (trimestres: Trimestre[], extra: Partial<EmpresaBalanco> = {}): EmpresaBalanco => ({ ticker: 'ALFA3', nome: null, setor: null, financeira: false, cnpj: '1', trimestres, proxima: null, ...extra })

describe('trimestreSeguinte', () => {
  it('avança um trimestre', () => {
    expect(trimestreSeguinte('2026-03-31')).toBe('2026-06-30')
    expect(trimestreSeguinte('2026-06-30')).toBe('2026-09-30')
    expect(trimestreSeguinte('2026-09-30')).toBe('2026-12-31')
    expect(trimestreSeguinte('2026-12-31')).toBe('2027-03-31')
  })
})

describe('aplicarBalancoNovo', () => {
  const dosTres = [tri('2025-09-30', '3T25'), tri('2026-06-30', '2T26'), provisorio()]

  it('sem balanço da empresa ou sem nada novo, devolve a mesma empresa', () => {
    const e = empresa()
    expect(aplicarBalancoNovo(e, undefined)).toBe(e)
    expect(aplicarBalancoNovo(e, balanco([tri('2025-09-30', '3T25'), tri('2026-06-30', '2T26')]))).toBe(e)
  })

  it('empresa não financeira: 12 meses somam o trimestre novo e tiram o mesmo trimestre do ano anterior; balanço vem do trimestre', () => {
    const nova = aplicarBalancoNovo(empresa(), balanco(dosTres))
    expect(nova.balancoNovo).toEqual({ situacao: 'provisorio-b3', periodo: '2026-09-30', rotulo: '3T26', dtReceb: '2026-11-12', aproximada: false })
    expect(nova.ttm?.periodoAte).toBe('2026-09-30')
    expect(nova.ttm?.receita).toBe(1000 + 300 - 200)
    expect(nova.ttm?.lucroLiquido).toBe(100 + 40 - 20)
    expect(nova.ttm?.lucroControladores).toBe(90 + 36 - 18)
    expect(nova.ttm?.ativoTotal).toBe(2100)
    expect(nova.ttm?.patrimonioLiquido).toBe(950)
    expect(nova.ttm?.plControladores).toBe(900)
    expect(nova.ttm?.minoritarios).toBe(50)
    // o que a B3 não traz continua dos 12 meses da CVM
    expect(nova.ttm?.ebit).toBe(200)
    expect(nova.ttm?.divida).toBe(400)
    // não mexe na empresa original
    expect(empresa().ttm?.receita).toBe(1000)
  })

  it('data aproximada (sem o aviso da B3) é repassada', () => {
    const nova = aplicarBalancoNovo(empresa(), balanco([tri('2025-09-30', '3T25'), provisorio({ dataAproximada: true })]))
    expect(nova.balancoNovo?.aproximada).toBe(true)
  })

  it('instituição financeira: só o aviso, números da CVM', () => {
    const e = empresa({ financeira: true })
    const nova = aplicarBalancoNovo(e, balanco(dosTres))
    expect(nova.balancoNovo?.situacao).toBe('aguardando-cvm')
    expect(nova.ttm).toBe(e.ttm)
  })

  it('sem o trimestre do ano anterior, base diferente ou dado faltando: só o aviso', () => {
    expect(aplicarBalancoNovo(empresa(), balanco([provisorio()])).balancoNovo?.situacao).toBe('aguardando-cvm')
    expect(aplicarBalancoNovo(empresa(), balanco([tri('2025-09-30', '3T25', { consolidacao: 'individual' }), provisorio()])).balancoNovo?.situacao).toBe('aguardando-cvm')
    expect(aplicarBalancoNovo(empresa(), balanco([tri('2025-09-30', '3T25'), provisorio({ lucroControladores: null })])).balancoNovo?.situacao).toBe('aguardando-cvm')
    expect(aplicarBalancoNovo(empresa({ ttm: { ...ttm, consolidacao: 'individual' } }), balanco(dosTres)).balancoNovo?.situacao).toBe('aguardando-cvm')
  })

  it('só vale para o trimestre imediatamente seguinte ao último da CVM', () => {
    const e = empresa({ ultimaDemonstracao: { doc: 'ITR', dtRefer: '2026-03-31', dtReceb: null, versao: 1, link: null }, ttm: { ...ttm, periodoAte: '2026-03-31' } })
    expect(aplicarBalancoNovo(e, balanco(dosTres))).toBe(e)
  })

  it('marcador do job: balanço novo aguardando a CVM vira aviso, sem números', () => {
    const b = balanco([tri('2026-06-30', '2T26')], { aguardandoCvm: { periodo: '2026-09-30', rotulo: '3T26', dtReceb: '2026-11-12' } })
    const nova = aplicarBalancoNovo(empresa({ financeira: true }), b)
    expect(nova.balancoNovo).toEqual({ situacao: 'aguardando-cvm', periodo: '2026-09-30', rotulo: '3T26', dtReceb: '2026-11-12', aproximada: false })
    // já publicado pela CVM: o marcador antigo não vale
    const e = empresa({ ultimaDemonstracao: { doc: 'ITR', dtRefer: '2026-09-30', dtReceb: null, versao: 1, link: null } })
    expect(aplicarBalancoNovo(e, b)).toBe(e)
  })
})
