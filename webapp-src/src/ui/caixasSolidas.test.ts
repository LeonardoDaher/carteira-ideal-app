// @vitest-environment node
import { describe, expect, it } from 'vitest'
// @ts-expect-error os tipos do Node não estão no tsconfig do app; só este teste usa o disco
import { readFileSync } from 'node:fs'

const css: string = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const bloco = css.slice(css.indexOf('CAIXAS SÓLIDAS EM TODAS AS TELAS'))
const regra = bloco.slice(bloco.indexOf('.card,'), bloco.indexOf('}', bloco.indexOf('.card,')))

describe('caixas sólidas em todas as telas (mesmo visual de Meus Ativos)', () => {
  it('usam os MESMOS tokens do cartão de Meus Ativos (branco no claro, preto no escuro)', () => {
    expect(bloco).toContain('--caixa-fundo: var(--mc-card)')
    expect(bloco).toContain('--caixa-borda: var(--mc-card-borda)')
    expect(bloco).toContain('--caixa-sombra: var(--mc-card-sombra)')
    expect(css).toMatch(/:root\[data-theme='light'\] \{\s*--mc-card: rgba\(255, 255, 255, 0\.88\)/) // claro: quase branco sólido
    expect(css).toMatch(/:root \{\s*--mc-card: rgba\(12, 14, 20, 0\.8\)/) // escuro: quase preto
  })
  it('cobrem todas as caixas do app (card, card-outline, opções do questionário, alocação, busca, extras, títulos)', () => {
    for (const seletor of ['.card', '.card-outline', '.vehicle-card', '.stat-tile', '.quiz-option', '.alloc-box', '.resultados-busca', '.link-extra', '.titulo-opcao']) {
      expect(regra, seletor).toContain(seletor)
    }
  })
  it('o estado "selecionado" continua em destaque (não vira caixa branca/preta)', () => {
    expect(regra).toContain('.vehicle-card:not(.selected)')
    expect(regra).toContain('.quiz-option:not(.selected)')
    expect(regra).toContain('.titulo-opcao:not(.selecionado)')
  })
  it('não mexe em botões, abas nem chips (continuam no vidro de antes)', () => {
    for (const fora of ['.btn', '.tabbar', '.tab', '.chip', '.icon-btn', '.theme-toggle']) expect(regra).not.toContain(fora)
  })
  it('o bloco é só de cor: sem tamanho de letra (a escala do Meu Mês segue valendo) e sem o cinza médio do app', () => {
    expect(bloco).not.toMatch(/font-size/)
    expect(bloco).not.toContain('var(--text-muted)')
  })
})
