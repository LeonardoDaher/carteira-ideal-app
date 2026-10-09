import { describe, expect, it } from 'vitest'
import { gerarRecomendacao } from './engine'
import type { Carteira, RespostasArquitetura, RespostasQuestionario } from './types'

// D73: correções do motor (matriz de perfis completa, suitability como teto de risco,
// Pilar 3 mandando no prazo, calibradores sem furar o veto, piso de liquidez e Pilar 7
// sem pontuação).

function soma(c: Carteira) {
  return Object.values(c).reduce((s: number, v) => s + (v ?? 0), 0)
}

const alta: RespostasArquitetura = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'c',
  comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
}

const SUITABILITY: Record<'Conservador' | 'Moderado' | 'Arrojado', RespostasQuestionario> = {
  Conservador: { objetivo: 'a', prazo: 'd', tolerancia: 'a', reserva: 'c', patrimonio: 'b', experiencia: 'b', reacao: 'a' },
  Moderado: { objetivo: 'b', prazo: 'd', tolerancia: 'b', reserva: 'c', patrimonio: 'c', experiencia: 'c', reacao: 'c' },
  Arrojado: { objetivo: 'c', prazo: 'd', tolerancia: 'd', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'c' },
}

function suit(perfil: keyof typeof SUITABILITY, extra: Partial<RespostasQuestionario> = {}): RespostasQuestionario {
  return { ...SUITABILITY[perfil], ...extra }
}

const dados = { idade: 35 }
const ATIVOS_RISCO = ['ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as const

function risco(c: Carteira) {
  return ATIVOS_RISCO.reduce((s, k) => s + (c[k] ?? 0), 0)
}

describe('D73 — correções do motor', () => {
  it('as perguntas de suitability de teste caem nos perfis esperados', () => {
    expect(gerarRecomendacao(suit('Conservador'), dados).perfilBase).toBe('Conservador')
    expect(gerarRecomendacao(suit('Moderado'), dados).perfilBase).toBe('Moderado')
    expect(gerarRecomendacao(suit('Arrojado'), dados).perfilBase).toBe('Arrojado')
  })

  it('Pilar 3 = "a" força o modelo de curto prazo mesmo com prazo longo no suitability', () => {
    const r = gerarRecomendacao(suit('Moderado'), dados, { ...alta, janelaLiquidez: 'a' })
    expect(r.prazo).toBe('curto')
    expect(r.perfilPatrimonial).toBe('Defensivo')
    expect(risco(r.carteira)).toBeLessThanOrEqual(10)
    expect(r.alertas.some((a) => a.includes('24 meses'))).toBe(true)
  })

  it('Pilar 3 = "b" derruba prazo longo para médio, mas não mexe em prazo curto ou médio', () => {
    expect(gerarRecomendacao(suit('Moderado'), dados, { ...alta, janelaLiquidez: 'b' }).prazo).toBe('medio')
    expect(gerarRecomendacao(suit('Moderado', { prazo: 'a' }), dados, { ...alta, janelaLiquidez: 'b' }).prazo).toBe('curto')
    expect(gerarRecomendacao(suit('Moderado', { prazo: 'b' }), dados, { ...alta, janelaLiquidez: 'b' }).prazo).toBe('medio')
    expect(gerarRecomendacao(suit('Moderado'), dados, alta).prazo).toBe('longo')
  })

  it('o suitability é teto de risco: Conservador com capacidade alta (perfil 3) fica dentro do teto e sem cripto', () => {
    for (const prazo of ['a', 'b', 'd'] as const) {
      const r = gerarRecomendacao(suit('Conservador', { prazo }), dados, alta)
      expect(r.perfilFinalCarteira).toBe('3. Conservador Acúmulo')
      const teto = { curto: 10, medio: 20, longo: 30 }[r.prazo]
      expect(risco(r.carteira)).toBeLessThanOrEqual(teto)
      expect(r.carteira.cripto ?? 0).toBe(0)
      expect(soma(r.carteira)).toBe(100)
    }
  })

  it('o suitability é teto de risco: Moderado com capacidade alta (perfil 6) fica dentro do teto e sem cripto', () => {
    for (const prazo of ['a', 'b', 'd'] as const) {
      const r = gerarRecomendacao(suit('Moderado', { prazo }), dados, alta)
      expect(r.perfilFinalCarteira).toBe('6. Moderado Expansão')
      const teto = { curto: 35, medio: 45, longo: 55 }[r.prazo]
      expect(risco(r.carteira)).toBeLessThanOrEqual(teto)
      expect(r.carteira.cripto ?? 0).toBe(0)
      expect(soma(r.carteira)).toBe(100)
    }
  })

  it('o Arrojado não tem teto: mantém a carteira Crescimento Pleno de longo prazo inteira', () => {
    const r = gerarRecomendacao(suit('Arrojado'), dados, alta)
    expect(r.perfilFinalCarteira).toBe('9. Arrojado Pleno / Global')
    expect(r.carteira.cripto).toBe(5)
    expect(r.carteira.acoesETFs).toBe(17)
  })

  it('piso de liquidez: sem reserva, Selic + CDB fica em pelo menos 20% DEPOIS de normalizar', () => {
    for (const perfil of ['Conservador', 'Moderado', 'Arrojado'] as const) {
      for (const prazo of ['a', 'b', 'd'] as const) {
        const r = gerarRecomendacao(suit(perfil, { reserva: 'a', prazo }), dados, alta)
        const liq = (r.carteira.tesouroSelic ?? 0) + (r.carteira.cdbLiquidez ?? 0)
        expect(liq).toBeGreaterThanOrEqual(20)
        expect(soma(r.carteira)).toBe(100)
        for (const v of Object.values(r.carteira)) expect(v ?? 0).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('Pilar 1 = "a" com reserva declarada no suitability: avisa da divergência (e o veto já deixa a liquidez em 25% ou mais)', () => {
    const r = gerarRecomendacao(suit('Moderado', { reserva: 'd' }), dados, { ...alta, capacidadeFinanceira: 'a' })
    expect(r.alertas.some((a) => a.includes('divergiram'))).toBe(true)
    expect((r.carteira.tesouroSelic ?? 0) + (r.carteira.cdbLiquidez ?? 0)).toBeGreaterThanOrEqual(25)
    const semDivergencia = gerarRecomendacao(suit('Moderado', { reserva: 'a' }), dados, { ...alta, capacidadeFinanceira: 'a' })
    expect(semDivergencia.alertas.some((a) => a.includes('divergiram'))).toBe(false)
  })

  it('capacidade baixa SEM veto (score 9: pilares duros "b" e suaves "a") continua Defensivo; 10 já é média', () => {
    const base: RespostasArquitetura = {
      capacidadeFinanceira: 'b', passivoDividas: 'b', janelaLiquidez: 'b',
      comportamentoEstresse: 'a', dependenciaRenda: 'a', capitalHumano: 'a', eficienciaFiscal: 'b',
    }
    const r9 = gerarRecomendacao(suit('Arrojado'), dados, base)
    expect(r9.scoreArquitetura).toBe(9)
    expect(r9.vetoAplicado).toBe(false)
    expect(r9.capacidadeReal).toBe('baixa')
    expect(r9.perfilPatrimonial).toBe('Defensivo')
    const r10 = gerarRecomendacao(suit('Arrojado'), dados, { ...base, capitalHumano: 'b' })
    expect(r10.scoreArquitetura).toBe(10)
    expect(r10.capacidadeReal).toBe('media')
    expect(r10.perfilPatrimonial).toBe('Equilibrado')
  })

  it('o excesso cortado pelo teto vai para o Tesouro Selic no prazo curto e para o IPCA+ nos demais', () => {
    const curto = gerarRecomendacao(suit('Moderado', { prazo: 'a' }), dados, alta)
    expect(curto.carteira.tesouroSelic ?? 0).toBeGreaterThan(30) // Crescimento Pleno curto tem 30
    expect(curto.carteira.tesouroIPCA).toBe(5)
    const longo = gerarRecomendacao(suit('Moderado'), dados, alta)
    expect(longo.carteira.tesouroSelic).toBe(5)
    expect(longo.carteira.tesouroIPCA ?? 0).toBeGreaterThan(15) // Crescimento Pleno longo tem 15
  })

  it('Pilar 2 = "a" avisa para quitar a dívida cara antes de investir', () => {
    const r = gerarRecomendacao(suit('Moderado'), dados, { ...alta, passivoDividas: 'a' })
    expect(r.vetoAplicado).toBe(true)
    expect(r.alertas.some((a) => a.includes('quitar dívida cara'))).toBe(true)
  })

  it('veto + Pilar 4 [C] + Pilar 6 [C]: a carteira vetada não ganha ações nem BDRs a mais', () => {
    const base: RespostasArquitetura = { ...alta, capacidadeFinanceira: 'a' }
    const comOusadia = gerarRecomendacao(suit('Moderado', { prazo: 'a' }), dados, { ...base, comportamentoEstresse: 'c', capitalHumano: 'c' })
    const semOusadia = gerarRecomendacao(suit('Moderado', { prazo: 'a' }), dados, base)
    expect(comOusadia.carteira).toEqual(semOusadia.carteira)
  })

  it('Pilar 4 [C] com reação de suitability ansiosa não aumenta ações e avisa', () => {
    const r = gerarRecomendacao(suit('Moderado', { reacao: 'b' }), dados, { ...alta, comportamentoEstresse: 'c' })
    const ref = gerarRecomendacao(suit('Moderado', { reacao: 'b' }), dados, alta)
    expect(r.carteira.acoesETFs).toBe(ref.carteira.acoesETFs)
    expect(r.alertas.some((a) => a.includes('te abalam'))).toBe(true)
  })

  it('alerta de sucessão só a partir dos 50 anos', () => {
    expect(gerarRecomendacao(suit('Moderado'), { idade: 49 }, alta).alertas.some((a) => a.includes('sucessório'))).toBe(false)
    expect(gerarRecomendacao(suit('Moderado'), { idade: 50 }, alta).alertas.some((a) => a.includes('sucessório'))).toBe(true)
  })

  it('varredura: as 2.187 combinações x 3 suitabilities somam 100%, sem negativos, dentro do teto e com piso de liquidez', () => {
    const L = ['a', 'b', 'c'] as const
    const tetos = { Conservador: { curto: 10, medio: 20, longo: 30 }, Moderado: { curto: 35, medio: 45, longo: 55 } }
    for (const perfil of ['Conservador', 'Moderado', 'Arrojado'] as const) {
      for (let i = 0; i < 2187; i++) {
        const d: (typeof L)[number][] = []
        let x = i
        for (let k = 0; k < 7; k++) {
          d.push(L[x % 3])
          x = Math.floor(x / 3)
        }
        const arq: RespostasArquitetura = {
          capacidadeFinanceira: d[0], passivoDividas: d[1], janelaLiquidez: d[2],
          comportamentoEstresse: d[3], dependenciaRenda: d[4], capitalHumano: d[5], eficienciaFiscal: d[6],
        }
        // reserva 'a' no suitability liga o piso de liquidez em todas as combinações
        const r = gerarRecomendacao(suit(perfil, { reserva: i % 2 === 0 ? 'a' : 'c' }), dados, arq)
        expect(soma(r.carteira)).toBe(100)
        for (const v of Object.values(r.carteira)) expect(v ?? 0).toBeGreaterThanOrEqual(0)
        if (perfil !== 'Arrojado') {
          expect(risco(r.carteira)).toBeLessThanOrEqual(tetos[perfil][r.prazo])
          expect(r.carteira.cripto ?? 0).toBe(0)
        }
        if (i % 2 === 0 || arq.capacidadeFinanceira === 'a') {
          expect((r.carteira.tesouroSelic ?? 0) + (r.carteira.cdbLiquidez ?? 0)).toBeGreaterThanOrEqual(20)
        }
      }
    }
  })
})
