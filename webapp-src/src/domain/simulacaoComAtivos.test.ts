import { describe, expect, it } from 'vitest'
import { toleranciaPp } from './carteiraAtual'
import { baseDaCarteira, simularAporteDado, simularAporteParaAtingir } from './simulacaoComAtivos'
import { carteiraVazia } from './carteiraSalva'
import { CATALOGO_VAZIO } from './classificadorAtivo'
import type { Carteira } from './types'

const ref: Carteira = { tesouroIPCA: 60, acoesETFs: 40 }

describe('simularAporteParaAtingir: quanto investir, sem vender nada, para chegar à carteira sugerida', () => {
  it('a classe mais acima do alvo define o total; a outra recebe o que falta', () => {
    // Tesouro 7.000 (alvo 60%) => total 11.666,67; Ações precisa de 40% = 4.666,67 (tem 3.000)
    const r = simularAporteParaAtingir({ tesouroIPCA: 7000, acoesETFs: 3000 }, ref, 'exato')
    expect(r.aporteTotal).toBeCloseTo(1666.67, 2)
    expect(r.patrimonioFinal).toBeCloseTo(11666.67, 2)
    const por = Object.fromEntries(r.linhas.map((l) => [l.classe, l]))
    expect(por.tesouroIPCA.aporte).toBe(0)
    expect(por.acoesETFs.aporte).toBeCloseTo(1666.67, 2)
    expect(por.tesouroIPCA.pctFinal).toBeCloseTo(60, 1)
    expect(por.acoesETFs.pctFinal).toBeCloseTo(40, 1)
    expect(r.ancora).toBe('tesouroIPCA')
  })
  it('já na carteira sugerida: nada a investir e nenhuma classe "limita"', () => {
    const r = simularAporteParaAtingir({ tesouroIPCA: 6000, acoesETFs: 4000 }, ref, 'exato')
    expect(r.aporteTotal).toBe(0)
    expect(r.ancora).toBeNull()
  })
  it('classe sem nada: recebe o necessário (ex.: tem só Tesouro e a carteira pede 40% de ações)', () => {
    const r = simularAporteParaAtingir({ tesouroIPCA: 6000 }, ref, 'exato')
    expect(r.aporteTotal).toBeCloseTo(4000, 2)
    expect(r.linhas.find((l) => l.classe === 'acoesETFs')!.aporte).toBeCloseTo(4000, 2)
  })
  it('o que está FORA da carteira sugerida (e classe sem alvo) fica de fora da conta e é mostrado à parte', () => {
    const r = simularAporteParaAtingir({ tesouroIPCA: 6000, acoesETFs: 4000, foraDaRegua: 5000, cripto: 700 }, ref, 'exato')
    expect(r.foraDaBase).toBe(5700)
    expect(r.patrimonioBase).toBe(10000)
    expect(r.aporteTotal).toBe(0)
  })
  it('sem ativos nas classes da carteira sugerida: sem base', () => {
    expect(simularAporteParaAtingir({}, ref, 'exato').temBase).toBe(false)
    const r = simularAporteParaAtingir({ foraDaRegua: 9000 }, ref, 'exato')
    expect(r.temBase).toBe(false)
    expect(r.foraDaBase).toBe(9000)
  })
  it('faixa de tolerância: exige menos dinheiro que o percentual exato e cada classe fica dentro do alvo', () => {
    const valores = { tesouroIPCA: 7000, acoesETFs: 3000 }
    const exato = simularAporteParaAtingir(valores, ref, 'exato')
    const faixa = simularAporteParaAtingir(valores, ref, 'faixa')
    expect(faixa.aporteTotal).toBeLessThanOrEqual(exato.aporteTotal)
    for (const l of faixa.linhas) expect(Math.abs(l.pctFinal - l.alvoPct)).toBeLessThanOrEqual(toleranciaPp(l.alvoPct) + 0.05)
  })
  it('a faixa já cumprida não pede nada (7% de diferença cabe na tolerância de 12 pp de 60%)', () => {
    const r = simularAporteParaAtingir({ tesouroIPCA: 6700, acoesETFs: 3300 }, ref, 'faixa')
    expect(r.aporteTotal).toBe(0)
  })

  it('PROPRIEDADES (muitos casos): nunca manda vender, a soma fecha no centavo e o resultado cai no alvo (exato) ou na faixa', () => {
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
      for (const modo of ['exato', 'faixa'] as const) {
        const r = simularAporteParaAtingir(valores, referencia, modo)
        if (!r.temBase) continue
        const soma$ = r.linhas.reduce((s, l) => s + l.aporte, 0)
        expect(Math.abs(soma$ - r.aporteTotal)).toBeLessThan(0.006)
        for (const l of r.linhas) {
          expect(l.aporte).toBeGreaterThanOrEqual(0)
          expect(l.final).toBeGreaterThanOrEqual(l.atual - 0.005)
          const folga = modo === 'exato' ? 0.02 : toleranciaPp(l.alvoPct) + 0.02
          expect(Math.abs(l.pctFinal - l.alvoPct)).toBeLessThanOrEqual(folga)
        }
      }
      const e = simularAporteParaAtingir(valores, referencia, 'exato')
      const f = simularAporteParaAtingir(valores, referencia, 'faixa')
      if (e.temBase) expect(f.aporteTotal).toBeLessThanOrEqual(e.aporteTotal + 0.01)
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
