// @vitest-environment node
import { describe, expect, it } from 'vitest'
// @ts-expect-error os tipos do Node não estão no tsconfig do app; só este teste usa o disco
import { readFileSync } from 'node:fs'

const css: string = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

// Os gráficos de opções seguem o desenho e as cores do gráfico do Simule Tesouro Direto (GraficoJuros): as mesmas classes
// (grade, eixo, guia pontilhada, ponto com contorno do fundo) e as cores --grafico-selic (âmbar), --grafico-ipca (azul) e
// --grafico-con (verde), que mudam com o tema claro ou escuro.

describe('paleta dos gráficos de opções', () => {
  it('as três primeiras cores são as do Simule Tesouro (âmbar, azul e verde)', () => {
    expect(css).toMatch(/--grafico-v1:\s*var\(--grafico-selic\)/)
    expect(css).toMatch(/--grafico-v2:\s*var\(--grafico-ipca\)/)
    expect(css).toMatch(/--grafico-v3:\s*var\(--grafico-con\)/)
  })

  it('as cinco cores extras existem nos dois temas, e as três do Tesouro herdam dele nos dois', () => {
    for (const n of [4, 5, 6, 7, 8]) expect(css.match(new RegExp(`--grafico-v${n}:`, 'g'))).toHaveLength(2) // escuro e claro
    for (const n of [1, 2, 3]) expect(css.match(new RegExp(`--grafico-v${n}:`, 'g'))).toHaveLength(1)
  })

  it('as classes do gráfico do Tesouro que os de opções reaproveitam existem', () => {
    for (const classe of ['.grafico-juros {', '.grafico-juros-grade', '.grafico-juros-eixo', '.grafico-juros-linha', '.grafico-juros-guia', '.grafico-juros-ponto', '.grafico-juros-leitura', '.grafico-juros-marca'])
      expect(css).toContain(classe)
  })
})
