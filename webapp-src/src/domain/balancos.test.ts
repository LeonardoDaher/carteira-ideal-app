import { describe, expect, it } from 'vitest'
import { analisarBalanco, divulgadosRecentes, itensDoRadar, pendentes, variar } from './balancos'
import type { EmpresaBalanco, SnapshotBalancos, Trimestre } from './balancos'

const tri = (periodo: string, rotulo: string, lucro: number, receita = 1000, dtReceb: string | null = null): Trimestre => ({
  periodo, rotulo, tipo: 'ITR', dtReceb, link: null, consolidacao: 'consolidada', receita, ebit: lucro, ebitda: lucro, fco: null, capex: null, dividendosPagos: null, lucroLiquido: lucro, lucroControladores: lucro,
  ativoTotal: 5000, patrimonioLiquido: 2000, plControladores: 2000, caixa: 100, divida: 400,
})

const empresa = (trimestres: Trimestre[], proxima: EmpresaBalanco['proxima'] = null): EmpresaBalanco => ({ ticker: 'TESTE3', nome: 'Teste', setor: 'Setor', financeira: false, cnpj: '1', trimestres, proxima })

describe('variar', () => {
  it('descreve a virada quando o sinal muda', () => {
    expect(variar(-5, 10).texto).toBe('de lucro para prejuízo')
    expect(variar(5, -10).texto).toBe('de prejuízo para lucro')
  })
  it('calcula percentual e tom', () => {
    const v = variar(50, 100)
    expect(v.pct).toBeCloseTo(-0.5)
    expect(v.tom).toBe('ruim')
    expect(variar(50, 100, { maiorEMelhor: false }).tom).toBe('bom')
  })
})

describe('analisarBalanco', () => {
  const periodos = [['2025-03-31', '1T25'], ['2025-06-30', '2T25'], ['2025-09-30', '3T25'], ['2025-12-31', '4T25'], ['2026-03-31', '1T26'], ['2026-06-30', '2T26']] as const
  it('compara com o mesmo trimestre do ano anterior e marca lucro 50% menor como ponto de atenção', () => {
    const lucros = [100, 200, 100, 100, 150, 100]
    const a = analisarBalanco(empresa(periodos.map(([p, r], i) => tri(p, r, lucros[i]!))))!
    expect(a.anoAnterior?.rotulo).toBe('2T25')
    const lucro = a.linhas.find((l) => l.chave === 'lucro')!
    expect(lucro.contraAnoAnterior.pct).toBeCloseTo(-0.5)
    expect(a.destaques[0]!.tom).toBe('ruim')
    expect(a.resumo).toContain('−50%')
  })
  it('sem trimestres não há análise', () => {
    expect(analisarBalanco(empresa([]))).toBeNull()
  })
})

describe('radar', () => {
  const proxima = { periodo: '2026-09-30', rotulo: '3T26', tipo: 'ITR' as const, estimativa: '2026-11-05', prazoLegal: '2026-11-14', base: 'historico' as const, anosNaBase: 3 }
  const snap = (e: EmpresaBalanco): SnapshotBalancos => ({ versao: '1', geradoEm: '', dataCorte: '2026-10-30', fonte: '', excluidas: [], empresas: { [e.ticker]: e } })
  const base = [tri('2026-06-30', '2T26', 100, 1000, '2026-08-06')]

  it('quem tem estimativa futura vai divulgar; estimativa passada vira aguardando', () => {
    const futuro = itensDoRadar(snap(empresa(base, proxima)), '2026-10-30')
    expect(pendentes(futuro)[0]!.situacao).toBe('vai-divulgar')
    const passado = itensDoRadar(snap(empresa(base, proxima)), '2026-11-20')
    expect(passado[0]!.situacao).toBe('aguardando')
    expect(passado[0]!.foraDoPrazo).toBe(true)
  })
  it('estimativa de trimestre já divulgado é ignorada e a empresa entra nos divulgados recentes', () => {
    const e = empresa([...base, tri('2026-09-30', '3T26', 100, 1000, '2026-10-28')], proxima)
    const itens = itensDoRadar(snap(e), '2026-10-30')
    expect(pendentes(itens)).toHaveLength(0)
    expect(divulgadosRecentes(itens, '2026-10-30')).toHaveLength(1)
  })
})

describe('análises horizontal e vertical', () => {
  const periodos = [['2025-03-31', '1T25'], ['2025-06-30', '2T25'], ['2025-09-30', '3T25'], ['2025-12-31', '4T25'], ['2026-03-31', '1T26'], ['2026-06-30', '2T26']] as const
  const a = analisarBalanco(empresa(periodos.map(([p, r], i) => ({ ...tri(p, r, i === 5 ? 50 : 100), receita: i === 5 ? 1500 : 1000 }))))!

  it('horizontal compara com o mesmo trimestre do ano anterior e deixa vazio o que não tem base', () => {
    const receita = a.horizontal.find((l) => l.chave === 'h-receita')!
    expect(receita.valores.slice(0, 4)).toEqual([null, null, null, null])
    expect(receita.valores[5]).toBeCloseTo(0.5)
    expect(a.horizontal.find((l) => l.chave === 'h-lucro')!.valores[5]).toBeCloseTo(-0.5)
  })
  it('vertical mostra cada conta como parte da receita e do ativo', () => {
    expect(a.vertical.find((l) => l.chave === 'v-lucro')!.valores[0]).toBeCloseTo(0.1)
    expect(a.vertical.find((l) => l.chave === 'v-pl-ativo')!.valores[0]).toBeCloseTo(0.4)
  })
})
