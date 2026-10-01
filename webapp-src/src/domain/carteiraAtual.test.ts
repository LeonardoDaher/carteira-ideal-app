import { describe, expect, it } from 'vitest'
import {
  compararComReferencia,
  distribuirAporte,
  resumirPosicoes,
  toleranciaPp,
  valoresPorClasse,
  type Posicao,
} from './carteiraAtual'
import type { Carteira } from './types'

// "5. Moderado Renda (Equilíbrio)" não importa aqui: usamos uma referência qualquer que soma 100.
const REF: Carteira = {
  tesouroSelic: 15, tesouroIPCA: 25, tesouroPrefixado: 10, ouro: 6, fiis: 11,
  acoesETFs: 12, bdrs: 4, fundosInternacionais: 4, lciLca: 13,
}

// Carteira dos prints do Investidor10 (FIIs 4.388,58 / Tesouro 3.065,40 / Ações 2.359,58).
const VALORES = { fiis: 4388.58, tesouroSelic: 3065.4, acoesETFs: 2359.58 }

const pos = (o: Partial<Posicao>): Posicao => ({
  id: 'x', entrada: 'X', quantidade: 1, precoMedio: 100, classe: 'acoesETFs', ...o,
})

describe('resumirPosicoes', () => {
  it('usa cotação quando existe e preço médio quando não existe', () => {
    const r = resumirPosicoes([
      pos({ entrada: 'BBSE3', quantidade: 31, precoMedio: 35.15, cotacao: 39.29 }),
      pos({ entrada: 'CDB X', quantidade: 1, precoMedio: 1000 }),
    ])
    expect(r.patrimonio).toBeCloseTo(31 * 39.29 + 1000, 2)
    expect(r.investido).toBeCloseTo(31 * 35.15 + 1000, 2)
    expect(r.semCotacao).toEqual(['CDB X'])
    expect(r.rentabilidadePct).toBeCloseTo((r.lucro / r.investido) * 100, 6)
  })
  it('lista vazia não divide por zero', () => {
    expect(resumirPosicoes([]).rentabilidadePct).toBeNull()
  })
})

describe('compararComReferencia', () => {
  const c = compararComReferencia(VALORES, REF)

  it('percentuais atuais fecham 100 e batem com o print', () => {
    expect(c.patrimonio).toBeCloseTo(9813.56, 2)
    const soma = c.linhas.reduce((s, l) => s + l.pctAtual, 0)
    expect(soma).toBeCloseTo(100, 6)
    expect(c.linhas.find((l) => l.classe === 'fiis')!.pctAtual).toBeCloseTo(44.72, 1)
    expect(c.linhas.find((l) => l.classe === 'acoesETFs')!.pctAtual).toBeCloseTo(24.04, 1)
  })

  it('classes da referência sem posição aparecem como "abaixo" com o valor que falta', () => {
    const ipca = c.linhas.find((l) => l.classe === 'tesouroIPCA')!
    expect(ipca.valor).toBe(0)
    expect(ipca.situacao).toBe('abaixo')
    expect(ipca.difReais).toBeCloseTo(-0.25 * c.patrimonio, 2)
  })

  it('FIIs muito acima do alvo', () => {
    const fiis = c.linhas.find((l) => l.classe === 'fiis')!
    expect(fiis.situacao).toBe('acima')
    expect(fiis.difPp).toBeCloseTo(44.72 - 11, 1)
  })

  it('aderência = 100 − metade da soma dos desvios absolutos', () => {
    const somaAbs = c.linhas.reduce((s, l) => s + Math.abs(l.difPp), 0)
    expect(c.aderencia).toBeCloseTo(100 - somaAbs / 2, 6)
    expect(c.aderencia!).toBeGreaterThan(0)
    expect(c.aderencia!).toBeLessThan(100)
  })

  it('carteira idêntica à referência tem aderência 100 e tudo "dentro"', () => {
    const valores = Object.fromEntries(Object.entries(REF).map(([k, v]) => [k, v! * 100]))
    const igual = compararComReferencia(valores, REF)
    expect(igual.aderencia).toBeCloseTo(100, 6)
    expect(igual.linhas.every((l) => l.situacao === 'dentro')).toBe(true)
  })

  it('tolerância: mínimo de 2 pp, ou 20% do alvo se maior', () => {
    expect(toleranciaPp(3)).toBe(2)
    expect(toleranciaPp(25)).toBe(5)
  })

  it('cripto 3% com 4% na carteira continua "dentro"', () => {
    const r = compararComReferencia({ cripto: 4, tesouroSelic: 96 }, { cripto: 3, tesouroSelic: 97 })
    expect(r.linhas.find((l) => l.classe === 'cripto')!.situacao).toBe('dentro')
  })

  it('fora da régua pesa contra a aderência e aparece separado', () => {
    const r = compararComReferencia({ tesouroSelic: 50, foraDaRegua: 50 }, { tesouroSelic: 100 })
    expect(r.foraDaReguaPct).toBeCloseTo(50, 6)
    expect(r.aderencia).toBeCloseTo(50, 6)
    expect(r.linhas.find((l) => l.classe === 'foraDaRegua')!.situacao).toBe('acima')
  })

  it('sem patrimônio: aderência nula, sem NaN', () => {
    const r = compararComReferencia({}, REF)
    expect(r.aderencia).toBeNull()
    expect(r.linhas.every((l) => Number.isFinite(l.pctAtual) && Number.isFinite(l.difReais))).toBe(true)
  })

  it('referência que não soma 100 é normalizada', () => {
    const r = compararComReferencia({ tesouroSelic: 100 }, { tesouroSelic: 50, fiis: 50 })
    expect(r.linhas.find((l) => l.classe === 'fiis')!.pctReferencia).toBeCloseTo(50, 6)
  })

  it('valoresPorClasse soma posições da mesma classe', () => {
    const v = valoresPorClasse([
      pos({ quantidade: 2, precoMedio: 10, classe: 'fiis' }),
      pos({ quantidade: 1, precoMedio: 5, cotacao: 7, classe: 'fiis' }),
    ])
    expect(v.fiis).toBeCloseTo(27, 6)
  })
})

describe('distribuirAporte', () => {
  it('soma exatamente o aporte, em centavos, e nunca aloca em classe acima do alvo', () => {
    const aloc = distribuirAporte(VALORES, REF, 1000)
    const centavos = aloc.reduce((s, a) => s + Math.round(a.valor * 100), 0)
    expect(centavos).toBe(100000)
    expect(aloc.find((a) => a.classe === 'fiis')).toBeUndefined()
    expect(aloc.find((a) => a.classe === 'acoesETFs')).toBeUndefined() // 24% contra alvo de 12%
    expect(aloc[0].classe).toBe('tesouroIPCA') // a maior falta recebe mais
  })

  it('só recebe quem está abaixo do alvo depois do aporte', () => {
    const v = { fiis: 5000, tesouroIPCA: 1000 }
    const aloc = distribuirAporte(v, { fiis: 50, tesouroIPCA: 50 }, 2000)
    // novo total 8000 -> alvo 4000 cada; FIIs já tem 5000 (acima) -> tudo para o IPCA+
    expect(aloc).toEqual([{ classe: 'tesouroIPCA', valor: 2000 }])
  })

  it('aporte pequeno com muitas classes não perde centavo', () => {
    const aloc = distribuirAporte({}, REF, 0.07)
    expect(aloc.reduce((s, a) => s + Math.round(a.valor * 100), 0)).toBe(7)
  })

  it('aporte zero, negativo ou NaN devolve vazio', () => {
    expect(distribuirAporte(VALORES, REF, 0)).toEqual([])
    expect(distribuirAporte(VALORES, REF, -5)).toEqual([])
    expect(distribuirAporte(VALORES, REF, NaN)).toEqual([])
  })

  it('não distribui para fora da régua nem para classes de alvo zero', () => {
    const aloc = distribuirAporte({ foraDaRegua: 1000 }, { tesouroSelic: 100 }, 100)
    expect(aloc).toEqual([{ classe: 'tesouroSelic', valor: 100 }])
  })
})
