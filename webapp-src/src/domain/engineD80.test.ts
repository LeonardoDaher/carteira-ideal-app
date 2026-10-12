import { describe, expect, it } from 'vitest'
import { VERSAO_MOTOR, gerarRecomendacao } from './engine'
import type { Carteira, RespostasArquitetura, RespostasQuestionario } from './types'

// D80: o corte do teto do suitability fecha EXATAMENTE no teto (maiores restos) e o limite de 10%
// por classe de quem nunca investiu roda antes do teto.

const RISCO = ['ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as const
const risco = (c: Carteira) => RISCO.reduce((s, k) => s + (c[k] ?? 0), 0)

const alta: RespostasArquitetura = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'c',
  comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
}
// Moderado (18 pontos), prazo curto, com reserva, experiência básica, reação calma.
const moderadoCurto: RespostasQuestionario = {
  objetivo: 'c', prazo: 'a', tolerancia: 'c', reserva: 'c', patrimonio: 'c', experiencia: 'c', reacao: 'c',
}

describe('D80 — teto fecha exatamente e limite de 10% antes do teto', () => {
  it('a versão do motor registra a mudança', () => {
    // D80 trouxe a mudança; a versão do motor segue em frente (D81...), então só o formato é conferido.
    expect(VERSAO_MOTOR).toMatch(/^2026\.10\.\d+-D\d+$/)
  })

  it('Crescimento Pleno de curto prazo (50% de risco) cortado pelo teto do Moderado (35%) fica em 35%, não em 32%', () => {
    const r = gerarRecomendacao(moderadoCurto, { idade: 35 }, alta)
    expect(r.perfilPatrimonial).toBe('Crescimento Pleno')
    expect(r.regrasAcionadas).toContain('teto:suitability-moderado')
    expect(risco(r.carteira)).toBe(35)
  })

  it('quem nunca investiu tem cada classe de risco em no máximo 10%, e quem declara mais capacidade não recebe menos risco', () => {
    const s: RespostasQuestionario = { objetivo: 'a', prazo: 'a', tolerancia: 'd', reserva: 'b', patrimonio: 'b', experiencia: 'a', reacao: 'd' }
    const a: RespostasArquitetura = {
      capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'c',
      comportamentoEstresse: 'c', dependenciaRenda: 'b', capitalHumano: 'a', eficienciaFiscal: 'a',
    }
    const maisCapaz = gerarRecomendacao(s, { idade: 35 }, a)
    const menosCapaz = gerarRecomendacao(s, { idade: 35 }, { ...a, capacidadeFinanceira: 'b' })
    for (const r of [maisCapaz, menosCapaz]) {
      for (const k of ['acoesETFs', 'bdrs', 'fiis', 'ouro', 'fundosInternacionais', 'cripto'] as const) {
        expect(r.carteira[k] ?? 0).toBeLessThanOrEqual(10)
      }
    }
    expect(risco(maisCapaz.carteira)).toBeGreaterThanOrEqual(risco(menosCapaz.carteira))
  })
})
