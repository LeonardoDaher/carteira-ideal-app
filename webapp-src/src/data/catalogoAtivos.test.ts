import { describe, expect, it } from 'vitest'
import { classificarAtivo } from '../domain/classificadorAtivo'
import { CATALOGO_ATIVOS } from './catalogoAtivos'

// Com os dados REAIS do app (os mesmos JSONs dos simuladores), não com dados de teste.
describe('CATALOGO_ATIVOS (dados reais do app)', () => {
  it('as listas não estão vazias', () => {
    expect(CATALOGO_ATIVOS.fiis.size).toBeGreaterThan(100)
    expect(CATALOGO_ATIVOS.etfs.size).toBeGreaterThan(20)
    expect(CATALOGO_ATIVOS.bdrs.size).toBeGreaterThan(100)
  })
  it('reconhece ativos conhecidos de cada tipo', () => {
    expect(classificarAtivo('MXRF11', CATALOGO_ATIVOS)).toMatchObject({ classe: 'fiis', confianca: 'alta' })
    expect(classificarAtivo('IVVB11', CATALOGO_ATIVOS)).toMatchObject({ classe: 'fundosInternacionais', confianca: 'alta' })
    expect(classificarAtivo('AAPL34', CATALOGO_ATIVOS)).toMatchObject({ classe: 'bdrs', confianca: 'alta' })
  })
  it('ação comum é reconhecida pela terminação, sem precisar do catálogo', () => {
    expect(classificarAtivo('PETR4', CATALOGO_ATIVOS)).toMatchObject({ classe: 'acoesETFs', confianca: 'alta' })
  })
})
