// @vitest-environment node
import { describe, expect, it } from 'vitest'
// @ts-expect-error os tipos do Node não estão no tsconfig do app; só este teste usa o disco
import { readFileSync } from 'node:fs'

const css: string = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

// Os gráficos de opções seguem o desenho e as cores do gráfico do Simule Tesouro Direto (GraficoJuros): as mesmas classes
// (grade, eixo, guia pontilhada, ponto com contorno do fundo) e as cores --grafico-selic (âmbar, as calls), --grafico-ipca (azul, as
// puts) e --grafico-con (verde, calls e puts somadas), que mudam com o tema claro ou escuro.

describe('cores dos gráficos de opções (as do Simule Tesouro)', () => {
  it('âmbar, azul e verde existem no tema escuro e, com tom mais escuro, no claro', () => {
    for (const cor of ['--grafico-selic', '--grafico-ipca', '--grafico-con']) {
      expect(css.match(new RegExp(`${cor}:`, 'g'))?.length).toBeGreaterThanOrEqual(2) // escuro e claro
    }
    expect(css).toMatch(/:root\[data-theme='light'\]\s*\{[^}]*--grafico-selic:\s*oklch\(58%/)
  })

  it('não há mais uma paleta própria por vencimento: o vencimento se distingue pelo traço, e não pela cor', () => {
    expect(css).not.toMatch(/--grafico-v[1-8]/)
  })

  it('as classes do gráfico do Tesouro que os de opções reaproveitam existem', () => {
    for (const classe of ['.grafico-juros {', '.grafico-juros-grade', '.grafico-juros-eixo', '.grafico-juros-linha', '.grafico-juros-guia', '.grafico-juros-ponto', '.grafico-juros-leitura'])
      expect(css).toContain(classe)
  })
})
