import { describe, expect, it } from 'vitest'
import { indexarDestaques } from './destaquesRadares'

const pag = (ticker: string, dataCom: string, pagamentoEm: string | null) => ({ ticker, nome: null, setor: null, tipo: 'DIVIDENDO', valor: 1, dataCom, pagamentoEm, aprovadoEm: null, referencia: null, mes: pagamentoEm?.slice(0, 7) ?? null })

describe('indexarDestaques', () => {
  it('cruza as listas, corta no tamanho do Top e escolhe o pagamento mais próximo', () => {
    const idx = indexarDestaques({
      dividendos: { publicado: true, tamanhoDaLista: 1, ranking: [{ posicao: 1, ticker: 'AAAA3', dy: 0.1 }, { posicao: 2, ticker: 'BBBB3', dy: 0.09 }] as never },
      endividadas: { publicado: false, tamanhoDaLista: 15, ranking: [{ posicao: 1, ticker: 'AAAA3', dlEbitda: 5 }] as never },
      radar: { publicado: true, pagamentos: [pag('AAAA3', '2026-12-01', '2027-02-10'), pag('AAAA3', '2026-10-01', '2026-11-10'), pag('CCCC3', '2026-11-01', null)] },
      hoje: '2026-10-29',
    })
    expect(idx.get('AAAA3')?.dividendos).toEqual({ posicao: 1, dy: 0.1 })
    expect(idx.get('BBBB3')).toBeUndefined()
    expect(idx.get('AAAA3')?.endividada).toBeUndefined()
    expect(idx.get('AAAA3')?.radar).toMatchObject({ total: 2, aindaTemDireito: true })
    expect(idx.get('AAAA3')?.radar?.proximo.pagamentoEm).toBe('2026-11-10')
    expect(idx.get('CCCC3')?.radar?.proximo.pagamentoEm).toBeNull()
  })
})
