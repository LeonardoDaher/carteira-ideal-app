import { describe, expect, it } from 'vitest'
import {
  anosDoEixo,
  formatarTaxa,
  inicioDoPeriodo,
  jurosReais,
  leiturasMensais,
  mesAno,
  recortar,
  titulosAVenda,
  topoDoEixo,
  valorEm,
  vigenteDesde,
} from './mercadoOficial'
import type { SerieHistorica, SnapshotMercado, TituloTesouro } from './mercadoOficial'

const SELIC: SerieHistorica = {
  nome: 'Selic meta',
  unidade: '% a.a.',
  degrau: true,
  pontos: [
    ['2024-01-01', 11.75],
    ['2024-09-19', 10.75],
    ['2025-06-19', 15],
    ['2026-09-24', 15],
  ],
}
const IPCA: SerieHistorica = {
  nome: 'IPCA 12 meses',
  unidade: '%',
  degrau: false,
  pontos: [
    ['2026-06-01', 5.3],
    ['2026-07-01', 5.2],
    ['2026-08-01', 5.1],
  ],
}

const titulo = (p: Partial<TituloTesouro>): TituloTesouro => ({
  nome: 'X', tipo: 'X', familia: 'Tesouro IPCA+', indexador: 'ipca', tipoTaxa: 'jurosReais', cupom: 'sem cupom',
  vencimento: '2035-05-15', aVenda: true, taxaCompra: 7.45, puCompra: 2090, taxaVenda: 7.57, puVenda: 2070, ...p,
})

describe('formatarTaxa', () => {
  it('diz a régua de cada família junto com o número', () => {
    expect(formatarTaxa({ tipoTaxa: 'jurosReais', indexador: 'ipca', taxaCompra: 7.45 })).toBe('IPCA + 7,45%')
    expect(formatarTaxa({ tipoTaxa: 'nominal', indexador: 'prefixado', taxaCompra: 14.1 })).toBe('14,10% a.a.')
    expect(formatarTaxa({ tipoTaxa: 'agioSobreSelic', indexador: 'selic', taxaCompra: 0.0512 })).toBe('Selic + 0,0512%')
    expect(formatarTaxa({ tipoTaxa: 'agioSobreSelic', indexador: 'selic', taxaCompra: -0.02 })).toBe('Selic − 0,02%')
    expect(formatarTaxa({ tipoTaxa: 'nominal', indexador: 'prefixado', taxaCompra: null })).toBe('só resgate')
  })
})

describe('titulosAVenda', () => {
  it('filtra a família, tira os só-resgate e ordena por vencimento, não por taxa', () => {
    const s = {
      tesouro: {
        dataBase: '2026-09-21',
        titulos: [
          titulo({ nome: 'B', vencimento: '2045-05-15', taxaCompra: 9 }),
          titulo({ nome: 'A', vencimento: '2029-05-15', taxaCompra: 7 }),
          titulo({ nome: 'C', vencimento: '2026-08-15', aVenda: false, taxaCompra: null }),
          titulo({ nome: 'D', familia: 'Tesouro Selic' }),
        ],
      },
    } as unknown as SnapshotMercado
    expect(titulosAVenda(s, 'Tesouro IPCA+').map((t) => t.nome)).toEqual(['A', 'B'])
  })
})

describe('histórico', () => {
  it('valorEm devolve o valor vigente na data (degrau)', () => {
    expect(valorEm(SELIC.pontos, '2023-12-31')).toBeNull()
    expect(valorEm(SELIC.pontos, '2024-12-31')).toBe(10.75)
    expect(valorEm(SELIC.pontos, '2025-06-19')).toBe(15)
  })

  it('vigenteDesde acha a última mudança', () => {
    expect(vigenteDesde(SELIC)).toBe('2025-06-19')
    expect(vigenteDesde(undefined)).toBeNull()
  })

  it('período conta a partir do último dado e não passa do início da série', () => {
    expect(inicioDoPeriodo('2026-09-24', '5a', '1999-03-05')).toBe('2021-09-24')
    expect(inicioDoPeriodo('2026-09-24', 'tudo', '1999-03-05')).toBe('1999-03-05')
    expect(inicioDoPeriodo('2026-09-24', '10a', '2020-01-01')).toBe('2020-01-01')
  })

  it('recortar põe o valor vigente no início do período', () => {
    expect(recortar(SELIC, '2025-01-01', '2026-09-24')).toEqual([
      ['2025-01-01', 10.75],
      ['2025-06-19', 15],
      ['2026-09-24', 15],
    ])
  })

  it('leituras mensais: Selic do fim do mês, IPCA do mês ou "a divulgar"', () => {
    const l = leiturasMensais(SELIC, IPCA, '2026-07-01', '2026-09-24')
    expect(l.map((x) => x.mes)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01'])
    expect(l[1]).toMatchObject({ selic: 15, ipca12m: 5.1, jurosReais: jurosReais(15, 5.1), data: '2026-08-31' })
    expect(l[2]).toMatchObject({ data: '2026-09-24', ipca12m: null, jurosReais: null })
  })

  it('eixos: topo em múltiplo de 5 e anos espaçados pela extensão', () => {
    expect(topoDoEixo([14.25, 5.1])).toBe(15)
    expect(topoDoEixo([45])).toBe(45)
    expect(anosDoEixo('2021-09-24', '2026-09-24')).toEqual([2022, 2023, 2024, 2025, 2026])
    expect(anosDoEixo('1999-03-05', '2026-09-24')).toEqual([2000, 2005, 2010, 2015, 2020, 2025])
  })

  it('mesAno em português', () => {
    expect(mesAno('2026-08-01')).toBe('ago/2026')
  })
})
