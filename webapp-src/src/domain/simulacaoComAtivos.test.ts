import { describe, expect, it } from 'vitest'
import { toleranciaPp } from './carteiraAtual'
import { baseDaCarteira, priorizarClasses, simularAporteDado } from './simulacaoComAtivos'
import { carteiraVazia } from './carteiraSalva'
import { CATALOGO_VAZIO } from './classificadorAtivo'
import type { Carteira } from './types'

const ref: Carteira = { tesouroIPCA: 60, acoesETFs: 40 }

describe('priorizarClasses: o que o investidor precisa atacar primeiro', () => {
  it('quem está abaixo do alvo é para atacar; quem passou do alvo é para segurar', () => {
    // 9.000 em Tesouro (90%, alvo 60%, tolerância 12 pp) e 1.000 em Ações (10%, alvo 40%, tolerância 8 pp)
    const r = priorizarClasses({ tesouroIPCA: 9000, acoesETFs: 1000 }, ref)
    expect(r.atacar.map((l) => l.classe)).toEqual(['acoesETFs'])
    expect(r.segurar.map((l) => l.classe)).toEqual(['tesouroIPCA'])
    expect(r.atacar[0].prioridade).toBe(1)
    expect(r.atacar[0].difPp).toBeCloseTo(30, 5)
    expect(r.atacar[0].faltaReais).toBeCloseTo(3000, 2) // 30 pp de R$ 10.000
    expect(r.segurar[0].difPp).toBeCloseTo(-30, 5)
    expect(r.segurar[0].prioridade).toBeNull()
  })
  it('dentro da faixa de tolerância não é nem atacar nem segurar: fica "perto" (10 pp cabe nos 12 pp de 60%)', () => {
    const r = priorizarClasses({ tesouroIPCA: 7000, acoesETFs: 3000 }, ref)
    expect(r.perto.map((l) => l.classe)).toEqual(['tesouroIPCA'])
    expect(r.atacar.map((l) => l.classe)).toEqual(['acoesETFs']) // 10 pp passa dos 8 pp de tolerância de 40%
    expect(r.segurar).toEqual([])
  })
  it('a classe mais distante do alvo é a prioridade 1, depois 2, 3...', () => {
    const tres: Carteira = { tesouroIPCA: 50, fiis: 30, ouro: 20 }
    // hoje: tesouro 75%, fiis 15%, ouro 10% => faltas: fiis 15 pp, ouro 10 pp (a tolerância do ouro é 4 pp)
    const r = priorizarClasses({ tesouroIPCA: 7500, fiis: 1500, ouro: 1000 }, tres)
    expect(r.atacar.map((l) => [l.classe, l.prioridade])).toEqual([['fiis', 1], ['ouro', 2]])
    // empate de distância (15 pp cada): vale a ordem das classes da carteira (ouro vem antes de fiis)
    const empate = priorizarClasses({ tesouroIPCA: 8000, fiis: 1500, ouro: 500 }, tres)
    expect(empate.atacar.map((l) => [l.classe, l.prioridade])).toEqual([['ouro', 1], ['fiis', 2]])
    const r2 = priorizarClasses({ tesouroIPCA: 6000, fiis: 3000, ouro: 0 }, tres)
    expect(r2.atacar.map((l) => [l.classe, l.prioridade])).toEqual([['ouro', 1]])
  })
  it('classe zerada: é para atacar, com 0% preenchido e o valor que falta no patrimônio de hoje', () => {
    const r = priorizarClasses({ tesouroIPCA: 6000 }, ref)
    const acoes = r.linhas.find((l) => l.classe === 'acoesETFs')!
    expect(acoes.situacao).toBe('atacar')
    expect(acoes.pctAtual).toBe(0)
    expect(acoes.preenchidoPct).toBe(0)
    expect(acoes.faltaReais).toBeCloseTo(2400, 2) // 40 pp de R$ 6.000
  })
  it('carteira igual à sugerida: nada a atacar nem a segurar', () => {
    const r = priorizarClasses({ tesouroIPCA: 6000, acoesETFs: 4000 }, ref)
    expect(r.atacar).toEqual([])
    expect(r.segurar).toEqual([])
    expect(r.perto).toHaveLength(2)
    expect(r.linhas.every((l) => l.preenchidoPct === 100)).toBe(true)
  })
  it('o que está FORA da carteira sugerida (e classe sem alvo) fica de fora da conta e é mostrado à parte', () => {
    const r = priorizarClasses({ tesouroIPCA: 6000, acoesETFs: 4000, foraDaRegua: 5000, cripto: 700 }, ref)
    expect(r.foraDaBase).toBe(5700)
    expect(r.patrimonioBase).toBe(10000)
    expect(r.atacar).toEqual([])
  })
  it('sem ativos nas classes da carteira sugerida: sem base', () => {
    expect(priorizarClasses({}, ref).temBase).toBe(false)
    const r = priorizarClasses({ foraDaRegua: 9000 }, ref)
    expect(r.temBase).toBe(false)
    expect(r.foraDaBase).toBe(9000)
  })

  it('PROPRIEDADES (muitos casos): ordem atacar > perto > segurar, prioridades 1..n, faixas coerentes e soma de 100%', () => {
    let semente = 20261002
    const aleatorio = () => ((semente = (semente * 1664525 + 1013904223) % 4294967296) / 4294967296)
    const chaves = ['tesouroIPCA', 'cdbLiquidez', 'lciLca', 'ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as const
    for (let caso = 0; caso < 300; caso++) {
      const pesos = chaves.map(() => (aleatorio() < 0.25 ? 0 : 1 + Math.floor(aleatorio() * 30)))
      if (pesos.every((x) => x === 0)) continue
      const soma = pesos.reduce((s, x) => s + x, 0)
      const referencia: Carteira = {}
      chaves.forEach((k, i) => { if (pesos[i] > 0) referencia[k] = (pesos[i] / soma) * 100 })
      const valores: Record<string, number> = {}
      chaves.forEach((k) => { if (aleatorio() < 0.7) valores[k] = Math.round(aleatorio() * 200000) / 100 + 1000 })
      if (aleatorio() < 0.3) valores.foraDaRegua = 5000
      const r = priorizarClasses(valores, referencia)
      if (!r.temBase) continue
      expect(r.linhas.reduce((s, l) => s + l.pctAtual, 0)).toBeCloseTo(100, 6)
      expect(r.linhas).toEqual([...r.atacar, ...r.perto, ...r.segurar])
      expect(r.atacar.map((l) => l.prioridade)).toEqual(r.atacar.map((_, i) => i + 1))
      for (let i = 1; i < r.atacar.length; i++) expect(r.atacar[i - 1].difPp).toBeGreaterThanOrEqual(r.atacar[i].difPp)
      for (const l of r.atacar) { expect(l.difPp).toBeGreaterThan(toleranciaPp(l.alvoPct)); expect(l.faltaReais).toBeGreaterThan(0) }
      for (const l of r.segurar) { expect(l.difPp).toBeLessThan(-toleranciaPp(l.alvoPct)); expect(l.faltaReais).toBe(0); expect(l.prioridade).toBeNull() }
      for (const l of r.perto) { expect(Math.abs(l.difPp)).toBeLessThanOrEqual(toleranciaPp(l.alvoPct)); expect(l.prioridade).toBeNull() }
      for (const l of r.linhas) { expect(l.preenchidoPct).toBeGreaterThanOrEqual(0); expect(l.preenchidoPct).toBeLessThanOrEqual(100) }

      // Um aporte pequeno nunca vai para uma classe que está para segurar (passou do alvo)
      const aporte = r.patrimonioBase * 0.15
      const dado = simularAporteDado(valores, referencia, aporte)
      const segurar = new Set(r.segurar.map((l) => l.classe))
      for (const a of dado.alocacoes) expect(segurar.has(a.classe)).toBe(false)
      expect(dado.alocacoes.reduce((s, a) => s + a.valor, 0)).toBeCloseTo(aporte, 1)
    }
  })
})

describe('simularAporteDado: "e se eu investir só X agora?"', () => {
  it('distribui entre as classes abaixo do alvo e a aderência não piora', () => {
    const r = simularAporteDado({ tesouroIPCA: 7000, acoesETFs: 3000 }, ref, 1000)
    expect(r.alocacoes).toEqual([{ classe: 'acoesETFs', valor: 1000 }])
    expect(r.aderenciaDepois!).toBeGreaterThan(r.aderenciaAntes!)
  })
  it('aporte zero ou negativo: nada a distribuir', () => {
    expect(simularAporteDado({ tesouroIPCA: 7000 }, ref, 0).alocacoes).toEqual([])
  })
})

describe('baseDaCarteira', () => {
  it('carteira vazia: nenhum valor e nenhum pendente', () => {
    const b = baseDaCarteira(carteiraVazia(), CATALOGO_VAZIO)
    expect(b.valores).toEqual({})
    expect(b.pendentes).toEqual([])
  })
  it('ativo digitado à mão entra na classe escolhida; os três Tesouros viram "Tesouro Direto" (tesouroIPCA)', () => {
    const c = {
      ...carteiraVazia(),
      ativosManuais: [
        { ativo: 'TESOURO SELIC', nome: 'Tesouro Selic', quantidade: 1, precoMedio: 3000, valorAtual: null, classe: 'tesouroSelic' as const },
        { ativo: 'TESOURO IPCA', nome: 'Tesouro IPCA', quantidade: 1, precoMedio: 2000, valorAtual: null, classe: 'tesouroIPCA' as const },
        { ativo: 'CRI X', nome: 'CRI X', quantidade: 1, precoMedio: 1000, valorAtual: null, classe: 'lciLca' as const, tipo: 'cri' },
      ],
    }
    const b = baseDaCarteira(c, CATALOGO_VAZIO)
    expect(b.valores).toEqual({ tesouroIPCA: 5000, lciLca: 1000 })
  })
})
