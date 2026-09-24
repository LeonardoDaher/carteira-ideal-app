import { describe, expect, it } from 'vitest'
import {
  acharIndisponivel,
  buscarFundos,
  fundosEmDestaque,
  nomeCurto,
  normalizarBusca,
  formatarCompetencia,
  formatarData,
  mesesDeAtraso,
  rendimentoMensalPct,
  tabelaSimulacao,
  ultimoRendimento,
} from './rendaFii'
import type { FundoFii, SnapshotRendimentosFii } from './rendaFii'

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

const f = (ticker: string, nome: string): FundoFii => ({
  ticker,
  nome,
  cotacao: 100,
  dataCotacao: '2026-10-17',
  rendimentos: [{ competencia: '2026-08', valorPorCota: 0.8 }],
})

// Ordem do arquivo: destaques primeiro, depois maior patrimônio
const lista = [
  f('KNRI11', 'FUNDO DE INVESTIMENTO IMOBILIÁRIO KINEA RENDA IMOBILIÁRIA'),
  f('HGLG11', 'FUNDO DE INVESTIMENTO IMOBILIÁRIO PÁTRIA LOG'),
  f('KNSC11', 'FUNDO DE INVESTIMENTO IMOBILIÁRIO KINEA SECURITIES'),
  f('HGRU11', 'FUNDO DE INVESTIMENTO IMOBILIÁRIO PÁTRIA RENDA URBANA'),
  f('RBRL11', 'RBR LOG FII'),
]

describe('busca livre (D12)', () => {
  it('normaliza acento, caixa e espaços', () => {
    expect(normalizarBusca('  kinéa   rend ')).toBe('KINEA REND')
  })

  it('acha pelo código completo ou só pelas 4 letras', () => {
    expect(buscarFundos(lista, 'hglg11').map((x) => x.ticker)).toEqual(['HGLG11'])
    expect(buscarFundos(lista, 'HGLG')[0].ticker).toBe('HGLG11')
  })

  it('código exato vem antes de código parecido, que vem antes de nome', () => {
    expect(buscarFundos(lista, 'HG').map((x) => x.ticker)).toEqual(['HGLG11', 'HGRU11'])
    expect(buscarFundos(lista, 'log').map((x) => x.ticker)).toEqual(['HGLG11', 'RBRL11'])
  })

  it('acha por parte do nome sem acento', () => {
    expect(buscarFundos(lista, 'patria').map((x) => x.ticker)).toEqual(['HGLG11', 'HGRU11'])
    expect(buscarFundos(lista, 'kinea').map((x) => x.ticker)).toEqual(['KNRI11', 'KNSC11'])
  })

  it('não busca com menos de 2 caracteres e respeita o limite', () => {
    expect(buscarFundos(lista, 'k')).toEqual([])
    expect(buscarFundos(lista, 'fundo', 2)).toHaveLength(2)
  })

  it('destaques seguem a lista do arquivo; arquivo antigo usa os 10 primeiros', () => {
    const snap: SnapshotRendimentosFii = { geradoEm: null, vigenciaIfix: null, destaques: ['HGLG11', 'SUMIU11'], fundos: lista }
    expect(fundosEmDestaque(snap).map((x) => x.ticker)).toEqual(['HGLG11'])
    expect(fundosEmDestaque({ ...snap, destaques: undefined })).toHaveLength(5)
  })

  it('encontra fundo indisponível só pelo código', () => {
    const snap: SnapshotRendimentosFii = {
      geradoEm: null,
      vigenciaIfix: null,
      fundos: [],
      indisponiveis: [{ ticker: 'ABCD11', nome: 'X', motivo: 'rendimento-atipico' }],
    }
    expect(acharIndisponivel(snap, 'abcd')?.motivo).toBe('rendimento-atipico')
    expect(acharIndisponivel(snap, 'abc')).toBeNull()
  })

  it('encurta o nome por extenso da CVM', () => {
    expect(nomeCurto('FUNDO DE INVESTIMENTO IMOBILIÁRIO KINEA RENDA IMOBILIÁRIA - RESPONSABILIDADE LIMITADA')).toBe('KINEA RENDA IMOBILIÁRIA')
    expect(nomeCurto('FII - FII PATRIA LOG')).toBe('PATRIA LOG')
    expect(nomeCurto('RBR LOG FII')).toBe('RBR LOG')
    expect(nomeCurto('FII')).toBe('FII')
  })
})
