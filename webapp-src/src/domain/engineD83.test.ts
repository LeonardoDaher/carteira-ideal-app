import { describe, expect, it } from 'vitest'
import { VERSAO_MOTOR, gerarRecomendacao, pilaresQueVetam, vetoAplicado } from './engine'
import type { Carteira, RespostasArquitetura, RespostasQuestionario } from './types'

// D83: o veto do Pilar 3 [A] depende da parte do dinheiro que será sacada em até 24 meses.
// 'a' (mais da metade) mantém o veto; 'b' (de um quarto à metade) não veta e usa o prazo curto;
// 'c' (menos de um quarto) não veta e usa, no máximo, o prazo médio.

const RISCO = ['ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as const
const risco = (c: Carteira) => RISCO.reduce((s, k) => s + (c[k] ?? 0), 0)
const liquidez = (c: Carteira) => (c.tesouroSelic ?? 0) + (c.cdbLiquidez ?? 0)

const prazoLongo: RespostasQuestionario = {
  objetivo: 'c', prazo: 'd', tolerancia: 'd', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'd',
}
const saqueEm24: RespostasArquitetura = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'a',
  comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
}
const dados = { idade: 35 }

describe('D83 — parte do saque em até 24 meses', () => {
  it('a versão do motor registra a mudança', () => {
    expect(VERSAO_MOTOR).toMatch(/^2026\.10\.\d+-D\d+$/)
  })

  it('sem a resposta de complemento (estado salvo antigo), o comportamento é o de antes: veta e usa prazo curto', () => {
    const r = gerarRecomendacao(prazoLongo, dados, saqueEm24)
    expect(r.vetoAplicado).toBe(true)
    expect(r.pilaresDoVeto).toEqual(['janelaLiquidez'])
    expect(r.prazo).toBe('curto')
    expect(r.perfilPatrimonial).toBe('Defensivo')
    expect(r.regrasAcionadas).toContain('prazo:janela-24-meses')
  })

  it('mais da metade ([A]) mantém o veto', () => {
    const r = gerarRecomendacao(prazoLongo, dados, { ...saqueEm24, parteDoSaque: 'a' })
    expect(r.vetoAplicado).toBe(true)
    expect(r.prazo).toBe('curto')
    expect(risco(r.carteira)).toBeLessThanOrEqual(10)
  })

  it('de um quarto até a metade ([B]) não veta: vetor pela capacidade (Equilibrado), prazo curto e metade em liquidez', () => {
    const r = gerarRecomendacao(prazoLongo, dados, { ...saqueEm24, parteDoSaque: 'b' })
    expect(r.vetoAplicado).toBe(false)
    expect(r.pilaresDoVeto).toBeUndefined()
    expect(r.prazo).toBe('curto')
    expect(r.perfilPatrimonial).toBe('Equilibrado') // score 13 (o [A] do Pilar 3 vale 1 ponto)
    expect(r.regrasAcionadas).toContain('prazo:saque-medio-24-meses')
    expect(r.regrasAcionadas).not.toContain('prazo:janela-24-meses')
    expect(liquidez(r.carteira)).toBeGreaterThanOrEqual(45)
    expect(r.alertas.some((a) => a.includes('Não tratamos isso como veto'))).toBe(true)
  })

  it('menos de um quarto ([C]) não veta e usa no máximo o prazo médio', () => {
    const r = gerarRecomendacao(prazoLongo, dados, { ...saqueEm24, parteDoSaque: 'c' })
    expect(r.vetoAplicado).toBe(false)
    expect(r.prazo).toBe('medio')
    expect(r.perfilPatrimonial).toBe('Equilibrado') // score 13 (o [A] do Pilar 3 vale 1 ponto)
    expect(r.regrasAcionadas).toContain('prazo:saque-pequeno-24-meses')
    // quem já tinha prazo curto ou médio não é "elevado"
    expect(gerarRecomendacao({ ...prazoLongo, prazo: 'a' }, dados, { ...saqueEm24, parteDoSaque: 'c' }).prazo).toBe('curto')
    expect(gerarRecomendacao({ ...prazoLongo, prazo: 'b' }, dados, { ...saqueEm24, parteDoSaque: 'c' }).prazo).toBe('medio')
  })

  it('o veto menos rígido não vale para os outros pilares: reserva curta ou dívida cara seguem vetando', () => {
    const r = gerarRecomendacao(prazoLongo, dados, { ...saqueEm24, parteDoSaque: 'c', capacidadeFinanceira: 'a' })
    expect(r.vetoAplicado).toBe(true)
    expect(r.pilaresDoVeto).toEqual(['capacidadeFinanceira'])
    expect(pilaresQueVetam({ ...saqueEm24, parteDoSaque: 'b', passivoDividas: 'a' })).toEqual(['passivoDividas'])
    expect(vetoAplicado({ ...saqueEm24, parteDoSaque: 'b' })).toBe(false)
  })

  it('a parte do saque é ignorada quando o Pilar 3 não é [A]', () => {
    for (const janela of ['b', 'c'] as const) {
      const base = { ...saqueEm24, janelaLiquidez: janela }
      const ref = gerarRecomendacao(prazoLongo, dados, base)
      for (const parte of ['a', 'b', 'c'] as const) {
        expect(gerarRecomendacao(prazoLongo, dados, { ...base, parteDoSaque: parte })).toEqual(ref)
      }
    }
  })

  it('um saque menor nunca dá carteira com menos risco do que um saque maior (veto menos rígido, não mais)', () => {
    for (const s of [prazoLongo, { ...prazoLongo, tolerancia: 'b', reacao: 'b' } as RespostasQuestionario]) {
      const a = risco(gerarRecomendacao(s, dados, { ...saqueEm24, parteDoSaque: 'a' }).carteira)
      const b = risco(gerarRecomendacao(s, dados, { ...saqueEm24, parteDoSaque: 'b' }).carteira)
      expect(b).toBeGreaterThanOrEqual(a)
    }
  })
})
