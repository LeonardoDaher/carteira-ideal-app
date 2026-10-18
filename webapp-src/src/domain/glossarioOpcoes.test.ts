import { describe, expect, it } from 'vitest'
import { GLOSSARIO, buscarNoGlossario } from './glossarioOpcoes'

const nomes = (lista: { termo: string }[]) => lista.map((t) => t.termo)

describe('glossário de opções', () => {
  it('tem os termos que aparecem nas telas', () => {
    const termos = nomes(GLOSSARIO)
    for (const t of ['Call', 'Put', 'Strike', 'Prêmio', 'Vencimento', 'Exercício', 'Crédito e débito', 'Perna', 'Trava', 'Rolagem', 'Roda', 'Delta', 'Gama', 'Teta', 'Vega', 'Volatilidade implícita', 'Margem de garantia', 'Último preço'])
      expect(termos, t).toContain(t)
  })

  it('não repete termos e todos têm explicação', () => {
    const termos = nomes(GLOSSARIO)
    expect(new Set(termos).size).toBe(termos.length)
    for (const t of GLOSSARIO) expect(t.explicacao.length, t.termo).toBeGreaterThan(30)
  })

  it('a busca ignora acento e maiúscula e acha pelo nome, pelo sinônimo e pela explicação', () => {
    expect(nomes(buscarNoGlossario('PREMIO'))[0]).toBe('Prêmio')
    expect(nomes(buscarNoGlossario('opção de compra'))[0]).toBe('Call')
    expect(nomes(buscarNoGlossario('theta'))[0]).toBe('Teta')
    expect(nomes(buscarNoGlossario('ITM'))[0]).toBe('Dentro, no e fora do dinheiro')
    expect(nomes(buscarNoGlossario('margem'))).toContain('Venda descoberta') // só na explicação
  })

  it('o nome exato vem antes do que só cita a palavra', () => {
    const r = nomes(buscarNoGlossario('call'))
    expect(r[0]).toBe('Call')
    expect(r.length).toBeGreaterThan(1)
  })

  it('busca vazia devolve tudo, e sem resultado devolve vazio', () => {
    expect(buscarNoGlossario('  ')).toHaveLength(GLOSSARIO.length)
    expect(buscarNoGlossario('xyzxyz')).toEqual([])
  })

  it('os textos não prometem resultado', () => {
    const tudo = GLOSSARIO.flatMap((t) => [t.explicacao, t.exemplo ?? '']).join(' ').toLowerCase()
    expect(tudo).not.toMatch(/garantid|sem risco|lucro certo|certeza de/)
  })
})
