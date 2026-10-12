import { describe, expect, it } from 'vitest'
import { gerarRecomendacao } from './engine'
import type { Carteira, Letra, PerfilInvestidor, RespostasArquitetura, RespostasQuestionario } from './types'

// Teste de propriedade do motor (D79): "piorar uma resposta nunca aumenta o risco da carteira".
//
// "Piorar" = trocar a resposta pela letra logo abaixo numa pergunta em que letra maior quer dizer
// mais capacidade ou tolerância de risco: prazo, tolerância, reserva, patrimônio, experiência e
// reação (suitability) e os seis pilares que pontuam (arquitetura). "Objetivo" fica de fora (não
// é uma escala: reserva, bem, patrimônio, aposentadoria) e o Pilar 7 não pode mudar nada.
// "Risco" é a soma de ouro, FIIs, ações, BDRs, internacionais e cripto, a mesma do teto do suitability.
//
// A conferência é exaustiva na arquitetura (3^6 x 3 do Pilar 7 = 2.187) e amostrada, com semente
// fixa, no suitability. Resultado medido com o motor 2026.10.12-D78: o risco SOBE em alguns casos
// (a carteira de quem declarou menos capacidade fica com mais risco que a de quem declarou mais).
// Causas: (1) o corte do teto mantinha o piso de cada classe e ficava abaixo do teto; (2) o limite
// de 10% por classe (sem experiência) e o piso de liquidez cortavam de novo o que já tinha sido
// cortado; (3) arredondamento de 1 a 2 pontos. Este teste TRAVA o estado atual: o número de
// aumentos de 2 pontos ou mais e o maior aumento não podem crescer. Quando o motor for corrigido,
// os limites devem ser apertados (a correção proposta leva os aumentos a menos de um terço).

const RISCO = ['ouro', 'fiis', 'acoesETFs', 'bdrs', 'fundosInternacionais', 'cripto'] as const
const risco = (c: Carteira) => RISCO.reduce((s, k) => s + (c[k] ?? 0), 0)
const soma = (c: Carteira) => Object.values(c).reduce((s: number, v) => s + (v ?? 0), 0)

const L4: Letra[] = ['a', 'b', 'c', 'd']
const L3 = ['a', 'b', 'c'] as const
const SUIT = ['prazo', 'tolerancia', 'reserva', 'patrimonio', 'experiencia', 'reacao'] as const
const ARQ = ['capacidadeFinanceira', 'passivoDividas', 'janelaLiquidez', 'comportamentoEstresse', 'dependenciaRenda', 'capitalHumano'] as const
const TETO: Record<PerfilInvestidor, number> = { Conservador: 30, Moderado: 55, Arrojado: 100 }

/** Gerador pseudoaleatório determinístico (LCG), para a amostra ser sempre a mesma. */
function amostraDeSuitability(quantidade: number): RespostasQuestionario[] {
  let semente = 20261012
  const sorteio = () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const letras = () => L4[Math.floor(sorteio() * 4)]
  return Array.from({ length: quantidade }, () => ({
    objetivo: letras(), prazo: letras(), tolerancia: letras(), reserva: letras(),
    patrimonio: letras(), experiencia: letras(), reacao: letras(),
  }))
}

function arquitetura(n: number): RespostasArquitetura {
  const r: Record<string, string> = {}
  let x = n
  for (const k of [...ARQ, 'eficienciaFiscal']) {
    r[k] = L3[x % 3]
    x = Math.floor(x / 3)
  }
  return r as unknown as RespostasArquitetura
}

const SUITABILITIES = amostraDeSuitability(40)
const COMBINACOES_ARQUITETURA = 3 ** 7
/** Os seis pilares que pontuam; o Pilar 7 é o último dígito de `arquitetura(n)`, então n < 729 o deixa em 'a'. */
const SEM_PILAR_7 = 3 ** 6
const IDADE = { idade: 35 }

describe('propriedades do motor (D79)', () => {
  it('o Pilar 7 (eficiência fiscal) não muda nenhum percentual', () => {
    for (const s of SUITABILITIES) {
      for (let n = 0; n < SEM_PILAR_7; n++) {
        const a = arquitetura(n)
        const ref = gerarRecomendacao(s, IDADE, { ...a, eficienciaFiscal: 'a' }).carteira
        for (const letra of ['b', 'c'] as const) {
          expect(gerarRecomendacao(s, IDADE, { ...a, eficienciaFiscal: letra }).carteira).toEqual(ref)
        }
      }
    }
  }, 60_000)

  it('toda carteira soma 100, não tem classe negativa, cripto só para Arrojado e risco dentro do teto', () => {
    let casos = 0
    for (const s of SUITABILITIES) {
      for (let n = 0; n < COMBINACOES_ARQUITETURA; n++) {
        const r = gerarRecomendacao(s, IDADE, arquitetura(n))
        casos++
        expect(soma(r.carteira)).toBe(100)
        expect(Object.values(r.carteira).every((v) => (v ?? 0) >= 0)).toBe(true)
        if (r.perfilFinal !== 'Arrojado') expect(r.carteira.cripto ?? 0).toBe(0)
        // +1: a normalização final para 100 pode arredondar um ponto.
        expect(risco(r.carteira)).toBeLessThanOrEqual(TETO[r.perfilFinal] + 1)
      }
    }
    expect(casos).toBe(SUITABILITIES.length * COMBINACOES_ARQUITETURA)
  }, 60_000)

  it('piorar uma resposta quase nunca aumenta o risco (trava o estado atual; ver o cabeçalho)', () => {
    let comparacoes = 0
    let aumentos = 0 // de 2 pontos ou mais
    let maior = 0
    for (const s of SUITABILITIES) {
      for (let n = 0; n < SEM_PILAR_7; n++) {
        // o Pilar 7 não importa (conferido acima): fica fixo em 'a'
        const a = arquitetura(n)
        const base = risco(gerarRecomendacao(s, IDADE, a).carteira)
        for (const k of ARQ) {
          const i = L3.indexOf(a[k] as (typeof L3)[number])
          if (i === 0) continue
          const r = risco(gerarRecomendacao(s, IDADE, { ...a, [k]: L3[i - 1] }).carteira)
          comparacoes++
          if (r - base >= 2) { aumentos++; maior = Math.max(maior, r - base) }
        }
        for (const k of SUIT) {
          const i = L4.indexOf(s[k])
          if (i === 0) continue
          const r = risco(gerarRecomendacao({ ...s, [k]: L4[i - 1] }, IDADE, a).carteira)
          comparacoes++
          if (r - base >= 2) { aumentos++; maior = Math.max(maior, r - base) }
        }
      }
    }
    console.log(`[monotonia] comparações=${comparacoes} aumentos>=2pp=${aumentos} maior=${maior}pp`)
    expect(comparacoes).toBeGreaterThan(200_000)
    expect(aumentos).toBeLessThanOrEqual(LIMITE_AUMENTOS)
    expect(maior).toBeLessThanOrEqual(LIMITE_MAIOR_AUMENTO)
  }, 120_000)
})

// Medidos com o motor 2026.10.12-D78 (amostra e semente acima). Só podem DIMINUIR.
const LIMITE_AUMENTOS = 2507
const LIMITE_MAIOR_AUMENTO = 8
