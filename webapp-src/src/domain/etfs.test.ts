import { describe, expect, it } from 'vitest'
import { agruparPorCategoria, buscarEtfs, regimeIr, textoCambio, textoIrCurto } from './etfs'
import type { EtfBusca, EtfLista } from './etfs'

const etf = (ticker: string, categoria: string, volumeMedio: number): EtfLista => ({
  ticker, nome: ticker, categoria, indice: null, cambio: null, cotacao: 10, dataCotacao: '2026-09-25', volumeMedio, variacao3m: null, minima52: null, maxima52: null,
})

describe('agruparPorCategoria', () => {
  it('segue a ordem do config, com "Outros" no fim e volume dentro da categoria', () => {
    const grupos = agruparPorCategoria(
      [etf('LFTS11', 'Renda fixa', 18e6), etf('XXXX11', 'Outros', 9e9), etf('SMAL11', 'Bolsa brasileira', 280e6), etf('BOVA11', 'Bolsa brasileira', 743e6)],
      ['Bolsa brasileira', 'Bolsa exterior', 'Renda fixa', 'Outros'],
    )
    expect(grupos.map((g) => g.categoria)).toEqual(['Bolsa brasileira', 'Renda fixa', 'Outros'])
    expect(grupos[0].etfs.map((e) => e.ticker)).toEqual(['BOVA11', 'SMAL11'])
  })

  it('categoria fora da ordem do config vai antes de "Outros"', () => {
    const grupos = agruparPorCategoria([etf('A11', 'Outros', 1), etf('B11', 'Nova', 1)], ['Bolsa brasileira'])
    expect(grupos.map((g) => g.categoria)).toEqual(['Nova', 'Outros'])
  })
})

describe('buscarEtfs', () => {
  const busca: EtfBusca[] = [
    { ticker: 'IVVB11', nome: 'iShares S&P 500', categoria: 'Bolsa exterior', cotacao: 453, dataCotacao: '2026-09-25', volumeMedio: 40e6 },
    { ticker: 'SPXI11', nome: 'It Now S&P500 TRN', categoria: 'Bolsa exterior', cotacao: 55, dataCotacao: '2026-09-25', volumeMedio: 1e6 },
    { ticker: 'BOVA11', nome: 'iShares Ibovespa', categoria: 'Bolsa brasileira', cotacao: 180.82, dataCotacao: '2026-09-25', volumeMedio: 743e6 },
  ]
  it('código exato primeiro, depois nome, sem diferenciar acento e caixa', () => {
    expect(buscarEtfs(busca, 'bova11').map((e) => e.ticker)).toEqual(['BOVA11'])
    expect(buscarEtfs(busca, 'ishares').map((e) => e.ticker)).toEqual(['BOVA11', 'IVVB11'])
    expect(buscarEtfs(busca, 's&p').map((e) => e.ticker)).toEqual(['IVVB11', 'SPXI11'])
  })
  it('menos de 2 caracteres não busca', () => {
    expect(buscarEtfs(busca, 'b')).toEqual([])
  })
})

describe('textos de IR e câmbio', () => {
  it('renda fixa tem IR na fonte; as demais categorias, DARF', () => {
    expect(regimeIr('Renda fixa')).toBe('renda-fixa')
    expect(regimeIr('Cripto')).toBe('renda-variavel')
    expect(textoIrCurto('Renda fixa')).toMatch(/retido na fonte/)
    expect(textoIrCurto('Bolsa exterior')).toMatch(/DARF/)
  })
  it('câmbio só com a informação conferida', () => {
    expect(textoCambio(true)?.titulo).toBe('Varia também com o dólar')
    expect(textoCambio(false)?.titulo).toBe('Sem a variação do dólar')
    expect(textoCambio(null)).toBeNull()
  })
})
