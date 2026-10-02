// @vitest-environment node
import { describe, expect, it } from 'vitest'
// @ts-expect-error os tipos do Node não estão no tsconfig do app; só este teste lê o CSS do disco
import { readFileSync } from 'node:fs'

const css: string = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
const bloco = css.slice(css.indexOf('@container mc-posicoes'))

describe('Meus Ativos: a linha da posição cabe em uma linha só em cartão largo', () => {
  it('a lista é um container; a regra vale pela largura do cartão (não da tela)', () => {
    expect(css).toMatch(/\.mc-posicoes \{ container-type: inline-size; container-name: mc-posicoes; \}/)
    expect(css).toContain('@container mc-posicoes (min-width: 720px)')
  })
  it('em cartão largo: cabeçalho à esquerda, os 3 números à direita, e a linha extra (vencimento/taxa) embaixo', () => {
    expect(bloco).toMatch(/\.mc-posicao \{[^}]*flex-direction: row/)
    expect(bloco).toMatch(/\.mc-pos-topo \{[^}]*flex: 1 1 0/)
    expect(bloco).toMatch(/\.mc-pos-numeros \{[^}]*flex: 0 0 360px/)
    expect(bloco).toMatch(/\.mc-pos-extra \{[^}]*flex: 1 1 100%/)
  })
  it('no celular não há regra de linha única fora do container (continua em duas linhas)', () => {
    const antes = css.slice(0, css.indexOf('@container mc-posicoes'))
    expect(antes).toMatch(/\.mc-posicao \{ display: flex; flex-direction: column;/)
  })
  it('é só layout: sem tamanho de letra', () => {
    expect(bloco).not.toMatch(/font-size/)
  })
})
