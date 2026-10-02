// @vitest-environment node
// (o Vitest zera o conteúdo de arquivos .css importados; por isso o CSS é lido direto do disco)
import { describe, expect, it } from 'vitest'
// @ts-expect-error os tipos do Node não estão no tsconfig do app; só este teste usa o disco
import { readFileSync } from 'node:fs'

const css: string = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

// Trava de LEGIBILIDADE da Minha Carteira. A tela chegou a ter 23 de 31 regras de letra entre 10 e 13 px,
// com texto cinza de contraste médio, e a pessoa não conseguia ler. Este teste falha se isso voltar.
const bloco = css.slice(css.indexOf('Minha Carteira (D36)'))

function oklchParaLuminancia(l: number, c: number, h: number): number {
  const a = c * Math.cos((h * Math.PI) / 180)
  const b = c * Math.sin((h * Math.PI) / 180)
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3
  const k = (x: number) => Math.max(0, Math.min(1, x))
  return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(bl)
}
const luminanciaRgb = (r: number, g: number, b: number) => {
  const lin = (v: number) => ((v / 255) <= 0.04045 ? v / 255 / 12.92 : (((v / 255) + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const contraste = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
function token(nome: string, tema: 'escuro' | 'claro'): [number, number, number] {
  const trecho = tema === 'escuro' ? bloco.slice(0, bloco.indexOf("[data-theme='light']")) : bloco.slice(bloco.indexOf("[data-theme='light']"))
  const m = new RegExp(`${nome}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`).exec(trecho)
  if (!m) throw new Error(`token ${nome} não encontrado (${tema})`)
  return [Number(m[1]) / 100, Number(m[2]), Number(m[3])]
}

describe('legibilidade da Minha Carteira', () => {
  it('mesma escala de letra do Meu Mês: nenhuma letra abaixo de 12 px (só o eixo dos meses chega a 11,5) e nada de texto de cartão acima de 16 px, fora os números de destaque', () => {
    const tamanhos = [...bloco.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]))
    expect(tamanhos.length).toBeGreaterThan(20)
    expect(Math.min(...tamanhos)).toBeGreaterThanOrEqual(11.5)
    expect(tamanhos.filter((t) => t < 12)).toHaveLength(1) // só o eixo dos meses
    // escala do Meu Mês: 12 (texto), 14 (itens), 15 (abertura/botões), 16 (títulos e campos); 19 e 30 são só os números de destaque
    const permitidos = new Set([11.5, 12, 14, 15, 16, 19, 30])
    expect([...new Set(tamanhos)].filter((t) => !permitidos.has(t))).toEqual([])
  })
  it('campos de digitação com 16 px (abaixo disso o iPhone dá zoom ao tocar)', () => {
    const campo = /\.mc-campo \{[^}]*font-size:\s*([\d.]+)px/.exec(bloco)
    expect(Number(campo![1])).toBeGreaterThanOrEqual(16)
  })
  it('o texto secundário usa o token claro da tela, não o cinza médio do app', () => {
    expect(bloco).not.toContain('var(--text-muted)')
    expect(bloco).toContain('var(--mc-suave)')
  })
  it('contraste do texto secundário: pelo menos 7:1 (nível AAA) nos dois temas, inclusive sob o brilho amarelo do fundo', () => {
    const escuro = oklchParaLuminancia(...token('--mc-suave', 'escuro'))
    for (const fundoPagina of [[14, 16, 22], [70, 60, 10]]) {
      // cartão: rgba(12, 14, 20, 0.8) sobre o fundo da página
      const [r, g, b] = [12, 14, 20].map((v, i) => Math.round(v * 0.8 + fundoPagina[i] * 0.2))
      expect(contraste(escuro, luminanciaRgb(r, g, b))).toBeGreaterThanOrEqual(7)
    }
    const claro = oklchParaLuminancia(...token('--mc-suave', 'claro'))
    // cartão: branco a 88% sobre o fundo claro
    const fundoClaro = [255, 255, 255].map((v, i) => Math.round(v * 0.88 + [236, 238, 243][i] * 0.12)) as [number, number, number]
    expect(contraste(claro, luminanciaRgb(...fundoClaro))).toBeGreaterThanOrEqual(7)
  })
})
