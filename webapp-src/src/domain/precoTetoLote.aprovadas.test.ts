import { describe, expect, it } from 'vitest'
import type { PrecoTeto } from './precoTeto'
import { aprovadasNos3Filtros } from './precoTetoLote'

const item = (ticker: string, status: PrecoTeto['status'], selo: PrecoTeto['selo']['tipo']) => ({ ticker, status, selo: { tipo: selo, texto: '' } }) as unknown as PrecoTeto

describe('aprovadasNos3Filtros', () => {
  it('só entra quem está verde (Bazin e Graham) E tem a fundamentalista concordando', () => {
    const r = aprovadasNos3Filtros([
      item('ZZZZ3', 'abaixo-do-teto', 'concorda'),
      item('BBBB3', 'abaixo-do-teto', 'neutro'),
      item('CCCC3', 'abaixo-do-teto', 'alerta'),
      item('DDDD3', 'vetado', 'concorda'),
      item('EEEE3', 'perto', 'concorda'),
      item('FFFF3', 'aguardando', 'concorda'),
      item('GGGG3', 'sem-teto', 'concorda'),
      item('AAAA3', 'abaixo-do-teto', 'concorda'),
    ])
    expect(r.map((i) => i.ticker)).toEqual(['AAAA3', 'ZZZZ3'])
  })

  it('devolve lista vazia quando ninguém passa nos 3 filtros', () => {
    expect(aprovadasNos3Filtros([item('AAAA3', 'abaixo-do-teto', 'alerta')])).toEqual([])
    expect(aprovadasNos3Filtros([])).toEqual([])
  })
})
