import { describe, expect, it } from 'vitest'
import {
  formatarCompetencia,
  formatarData,
  mediaRendimentos,
  mesesDeAtraso,
  rendimentoBase,
  rendimentoMensalPct,
  tabelaSimulacao,
  ultimoRendimento,
} from './rendaFii'
import type { FundoFii } from './rendaFii'

const fundo: FundoFii = {
  ticker: 'GGRC11',
  nome: 'FUNDO DE EXEMPLO',
  cotacao: 9.02,
  dataCotacao: '2026-09-19',
  rendimentos: [
    { competencia: '2026-07', valorPorCota: 0.1 },
    { competencia: '2026-06', valorPorCota: 0.09 },
    { competencia: '2026-05', valorPorCota: 0.11 },
  ],
}

describe('rendaFii', () => {
  it('usa o mês mais recente como último rendimento', () => {
    expect(ultimoRendimento(fundo)).toEqual({ competencia: '2026-07', valorPorCota: 0.1 })
  })

  it('calcula a média dos 3 últimos meses', () => {
    expect(mediaRendimentos(fundo, 3)).toBeCloseTo(0.1, 10)
  })

  it('faz a média com os meses disponíveis quando há menos de 3', () => {
    expect(mediaRendimentos({ ...fundo, rendimentos: fundo.rendimentos.slice(0, 2) }, 3)).toBeCloseTo(0.095, 10)
    expect(mediaRendimentos({ ...fundo, rendimentos: [] }, 3)).toBeNull()
  })

  it('escolhe a base do cálculo', () => {
    expect(rendimentoBase(fundo, 'ultimo')).toBe(0.1)
    expect(rendimentoBase(fundo, 'media3')).toBeCloseTo(0.1, 10)
  })

  it('reproduz a tabela da imagem de referência e mostra o investimento necessário', () => {
    const tabela = tabelaSimulacao(9.02, 0.1)
    expect(tabela.map((l) => l.cotas)).toEqual([10, 50, 100, 500, 1000, 5000])
    expect(tabela.map((l) => l.rendaMensal)).toEqual([1, 5, 10, 50, 100, 500])
    expect(tabela.at(-1)?.investimento).toBeCloseTo(45100, 6)
  })

  it('não inventa investimento quando a cotação está indisponível', () => {
    expect(tabelaSimulacao(null, 0.1)[0].investimento).toBeNull()
  })

  it('calcula o rendimento mensal sobre a cota', () => {
    expect(rendimentoMensalPct(0.1, 9.02)).toBeCloseTo(1.1086, 3)
    expect(rendimentoMensalPct(0.1, 0)).toBeNull()
  })

  it('formata competência, data e atraso', () => {
    expect(formatarCompetencia('2026-07')).toBe('jul/2026')
    expect(formatarCompetencia('lixo')).toBe('lixo')
    expect(formatarData('2026-09-19T12:00:00Z')).toBe('19/09/2026')
    expect(mesesDeAtraso('2026-07', new Date(2026, 8, 24))).toBe(2)
  })
})
