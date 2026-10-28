import { describe, expect, it } from 'vitest'
import { ATIVOS } from './assets'
import { SUBSTITUTOS } from './substitutos'

describe('SUBSTITUTOS', () => {
  it('traz alternativas para toda classe da carteira', () => {
    for (const chave of Object.keys(ATIVOS) as (keyof typeof ATIVOS)[]) {
      expect(SUBSTITUTOS[chave].length, chave).toBeGreaterThan(0)
    }
  })

  it('não repete um ativo como substituto de si mesmo', () => {
    for (const [chave, lista] of Object.entries(SUBSTITUTOS)) {
      const nomes = lista.map((s) => s.nome)
      expect(new Set(nomes).size, chave).toBe(nomes.length)
    }
  })
})
