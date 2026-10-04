import { describe, expect, it } from 'vitest'
import { SEM_FILTROS, aplicarQualidade, buscarExclusao, formatarMultiplo, formatarPercentual, formatarReaisCompacto, selecionarTop } from './acoesBaratas'
import type { ExclusaoTriagem, ItemRanking } from './acoesBaratas'

const item = (ticker: string, posicao: number, passa: [boolean, boolean, boolean] = [true, true, true]): ItemRanking => ({
  posicao, ticker, nome: `Empresa ${ticker}`, setor: 'Mineração', cotacao: 10, dataCotacao: '2026-09-30', nota: 1 - posicao / 100,
  plSobreValorDeMercado: 1.1, fcoSobreEv: 0.15, ebitAjustadoSobreEv: 0.13, pvp: 0.9, mktcap: 7e9, ev: 1e10, ebitAjustado: 1.4e9, fcoLtm: 1.5e9, lucroLtm: 1e9,
  roic: 0.12, dlEbitda: 1.2, caixaLiquido: false, passaRoic: passa[0], passaDlEbitda: passa[1], passaFco: passa[2], coberturaJuros: 4.2, semDespesaFinanceira: false, passaCobertura: true, exerciciosAnalisados: 5, exerciciosComLucro: 5, exerciciosComFco: 5, passaConsistencia: true, volatilidade: 0.3, volumeMedio: 5e7,
  demonstracao: { doc: 'ITR', dtRefer: '2026-06-30', dtReceb: '2026-08-12', linkDoc: 'https://exemplo/doc' }, metodoValorDeMercado: 'por_classe',
})

const TODOS = { roic: true, dlEbitda: true, fco: true, cobertura: true, consistencia: true }

describe('filtros de qualidade', () => {
  const ranking = [item('AAAA3', 1, [false, true, true]), item('BBBB3', 2), item('CCCC3', 3, [true, false, true]), item('DDDD3', 4, [true, true, false]), item('EEEE3', 5)]

  it('sem filtros devolve tudo, na ordem do ranking', () => {
    expect(aplicarQualidade(ranking, SEM_FILTROS).map((r) => r.ticker)).toEqual(['AAAA3', 'BBBB3', 'CCCC3', 'DDDD3', 'EEEE3'])
  })
  it('cada filtro retira só quem reprova nele, sem mudar a ordem nem a posição', () => {
    expect(aplicarQualidade(ranking, { ...SEM_FILTROS, roic: true }).map((r) => r.ticker)).toEqual(['BBBB3', 'CCCC3', 'DDDD3', 'EEEE3'])
    expect(aplicarQualidade(ranking, { ...SEM_FILTROS, dlEbitda: true }).map((r) => r.ticker)).toEqual(['AAAA3', 'BBBB3', 'DDDD3', 'EEEE3'])
    const todos = aplicarQualidade(ranking, TODOS)
    expect(todos.map((r) => [r.ticker, r.posicao])).toEqual([['BBBB3', 2], ['EEEE3', 5]])
  })
  it('seleciona o topo depois dos filtros e informa quantos foram retirados', () => {
    const r = selecionarTop(ranking, TODOS, 15)
    expect(r.lista).toHaveLength(2)
    expect(r.retiradosPorQualidade).toBe(3)
    expect(selecionarTop(ranking, SEM_FILTROS, 3).lista.map((x) => x.ticker)).toEqual(['AAAA3', 'BBBB3', 'CCCC3'])
  })
  it('cobertura de juros e consistência filtram por conta própria e combinam com os demais', () => {
    const r = [
      { ...item('AAAA3', 1), passaCobertura: false },
      { ...item('BBBB3', 2), passaConsistencia: false },
      { ...item('CCCC3', 3), passaCobertura: false, passaConsistencia: false },
      item('DDDD3', 4),
    ]
    expect(aplicarQualidade(r, { ...SEM_FILTROS, cobertura: true }).map((x) => x.ticker)).toEqual(['BBBB3', 'DDDD3'])
    expect(aplicarQualidade(r, { ...SEM_FILTROS, consistencia: true }).map((x) => x.ticker)).toEqual(['AAAA3', 'DDDD3'])
    expect(aplicarQualidade(r, { ...SEM_FILTROS, cobertura: true, consistencia: true }).map((x) => x.ticker)).toEqual(['DDDD3'])
  })
  it('não altera o array original', () => {
    const copia = [...ranking]
    aplicarQualidade(ranking, TODOS)
    expect(ranking).toEqual(copia)
  })
})

describe('busca de exclusões e formatação', () => {
  const ex: ExclusaoTriagem[] = [
    { ticker: 'MGLU3', nome: 'Magazine Luiza', setor: 'Varejo', etapa: 'lucro', codigo: 'prejuizo_12m', motivo: 'Sem lucro.' },
    { ticker: 'ITUB4', nome: 'Itaú Unibanco', setor: 'Bancos', etapa: 'universo', codigo: 'setor_excluido', motivo: 'Banco.' },
  ]
  it('acha por código ou nome, ignorando acento e caixa; exige 2 caracteres', () => {
    expect(buscarExclusao(ex, 'mglu').map((e) => e.ticker)).toEqual(['MGLU3'])
    expect(buscarExclusao(ex, 'itau').map((e) => e.ticker)).toEqual(['ITUB4'])
    expect(buscarExclusao(ex, 'm')).toEqual([])
  })
  it('formata percentual, múltiplo e reais compactos no padrão brasileiro', () => {
    expect(formatarPercentual(0.1234)).toBe('12,3%')
    expect(formatarPercentual(null)).toBe('—')
    expect(formatarMultiplo(1.366)).toBe('1,4x')
    expect(formatarReaisCompacto(7.42e9)).toBe('R$ 7,4 bi')
    expect(formatarReaisCompacto(-2.5e6)).toBe('−R$ 3 mi')
    expect(formatarReaisCompacto(undefined)).toBe('—')
  })
})
