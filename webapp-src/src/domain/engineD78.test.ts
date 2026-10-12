import { describe, expect, it } from 'vitest'
import { VERSAO_MOTOR, gerarRecomendacao, pilaresQueVetam } from './engine'
import type { RespostasArquitetura, RespostasQuestionario } from './types'

// D78: trilha de auditoria (regras acionadas e versão do motor), motivo do veto em linguagem
// simples e o novo nome do perfil 7 ("Quase Arrojado").

const suitArrojado: RespostasQuestionario = {
  objetivo: 'c', prazo: 'd', tolerancia: 'd', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'c',
}
const alta: RespostasArquitetura = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'c',
  comportamentoEstresse: 'c', dependenciaRenda: 'c', capitalHumano: 'c', eficienciaFiscal: 'c',
}
const dados = { idade: 35 }

describe('D78 — trilha de auditoria e veto explicado', () => {
  it('todo resultado traz a versão do motor', () => {
    expect(VERSAO_MOTOR).toMatch(/^\d{4}\.\d{2}\.\d{2}-D\d+$/)
    expect(gerarRecomendacao(suitArrojado, dados, alta).versaoMotor).toBe(VERSAO_MOTOR)
    // também no caminho sem as perguntas de arquitetura
    expect(gerarRecomendacao(suitArrojado, dados).versaoMotor).toBe(VERSAO_MOTOR)
  })

  it('sem veto e sem travas, nenhuma regra é acionada', () => {
    const r = gerarRecomendacao(suitArrojado, dados, alta)
    expect(r.regrasAcionadas).toEqual([])
    expect(r.pilaresDoVeto).toBeUndefined()
  })

  it('cada pilar que veta entra nas regras e em pilaresDoVeto, na ordem das perguntas', () => {
    const r = gerarRecomendacao(suitArrojado, dados, { ...alta, janelaLiquidez: 'a', capacidadeFinanceira: 'a' })
    expect(r.vetoAplicado).toBe(true)
    expect(r.pilaresDoVeto).toEqual(['capacidadeFinanceira', 'janelaLiquidez'])
    expect(r.regrasAcionadas).toEqual(expect.arrayContaining(['veto:capacidadeFinanceira', 'veto:janelaLiquidez']))
    expect(r.regrasAcionadas!.indexOf('veto:capacidadeFinanceira')).toBeLessThan(r.regrasAcionadas!.indexOf('veto:janelaLiquidez'))
  })

  it('o veto por liquidez registra também a troca de prazo; o por dívida registra o aviso', () => {
    const p3 = gerarRecomendacao(suitArrojado, dados, { ...alta, janelaLiquidez: 'a' })
    expect(p3.regrasAcionadas).toEqual(expect.arrayContaining(['veto:janelaLiquidez', 'prazo:janela-24-meses']))
    const p2 = gerarRecomendacao(suitArrojado, dados, { ...alta, passivoDividas: 'a' })
    expect(p2.regrasAcionadas).toEqual(expect.arrayContaining(['veto:passivoDividas', 'aviso:divida-cara']))
    expect(p2.regrasAcionadas).not.toContain('prazo:janela-24-meses')
  })

  it('o primeiro aviso explica o veto em linguagem simples, com o motivo de cada pilar', () => {
    const r = gerarRecomendacao(suitArrojado, dados, { ...alta, capacidadeFinanceira: 'a', passivoDividas: 'a', janelaLiquidez: 'a' })
    const primeiro = r.alertas[0]
    expect(primeiro).toContain('Carteira levada a Defensivo porque')
    expect(primeiro).toContain('sua reserva cobre menos de 3 meses')
    expect(primeiro).toContain('dívida cara')
    expect(primeiro).toContain('em até 24 meses')
    expect(primeiro).toContain('nova avaliação')
  })

  it('teto, piso de liquidez e travas de patrimônio e experiência entram na trilha', () => {
    const conservador: RespostasQuestionario = { objetivo: 'a', prazo: 'd', tolerancia: 'a', reserva: 'a', patrimonio: 'b', experiencia: 'a', reacao: 'a' }
    const r = gerarRecomendacao(conservador, dados, alta)
    expect(r.regrasAcionadas).toEqual(expect.arrayContaining(['teto:suitability-conservador', 'piso:liquidez-sem-reserva']))
    const iniciante = gerarRecomendacao({ ...suitArrojado, experiencia: 'a' }, dados, alta)
    expect(iniciante.regrasAcionadas).toContain('limite:sem-experiencia')
    const pobre = gerarRecomendacao({ ...suitArrojado, patrimonio: 'a' }, dados, alta)
    expect(pobre.regrasAcionadas).toContain('limite:patrimonio-baixo')
  })

  it('as travas do suitability (prazo curto, reação ansiosa, idade) entram na trilha', () => {
    // 25 pontos no suitability: Arrojado de verdade, para as travas poderem rebaixá-lo
    const arrojadoPleno: RespostasQuestionario = { objetivo: 'd', prazo: 'd', tolerancia: 'd', reserva: 'd', patrimonio: 'd', experiencia: 'd', reacao: 'd' }
    expect(gerarRecomendacao(arrojadoPleno, dados, alta).perfilFinal).toBe('Arrojado')
    expect(gerarRecomendacao({ ...arrojadoPleno, prazo: 'a' }, dados, alta).regrasAcionadas).toContain('rebaixa:prazo-curto-arrojado')
    expect(gerarRecomendacao({ ...arrojadoPleno, reacao: 'a' }, dados, alta).regrasAcionadas).toContain('limite:reacao-ansiosa')
    expect(gerarRecomendacao(arrojadoPleno, { idade: 65 }, alta).regrasAcionadas).toContain('rebaixa:idade-aposentadoria')
  })

  it('pilaresQueVetam lista só os pilares duros em [A]', () => {
    expect(pilaresQueVetam(alta)).toEqual([])
    expect(pilaresQueVetam({ ...alta, comportamentoEstresse: 'a', dependenciaRenda: 'a' })).toEqual([])
    expect(pilaresQueVetam({ ...alta, passivoDividas: 'a' })).toEqual(['passivoDividas'])
    // [B] não veta: só [A]
    expect(pilaresQueVetam({ ...alta, capacidadeFinanceira: 'b', passivoDividas: 'b', janelaLiquidez: 'b' })).toEqual([])
    expect(pilaresQueVetam({ capacidadeFinanceira: 'a', passivoDividas: 'b', janelaLiquidez: 'a', comportamentoEstresse: 'c', dependenciaRenda: 'c', capitalHumano: 'c', eficienciaFiscal: 'c' })).toEqual(['capacidadeFinanceira', 'janelaLiquidez'])
  })

  it('o perfil 7 passou a se chamar "Quase Arrojado"', () => {
    const r = gerarRecomendacao(suitArrojado, dados, { ...alta, capacidadeFinanceira: 'a' })
    expect(r.perfilFinalCarteira).toBe('7. Arrojado Travado (Quase Arrojado)')
    expect(JSON.stringify(r)).not.toContain('Falso Arrojado')
  })

  it('o score com veto continua alto: a explicação existe justamente para não parecer contradição', () => {
    const r = gerarRecomendacao(suitArrojado, dados, { ...alta, janelaLiquidez: 'a' })
    expect(r.capacidadeReal).toBe('alta')
    expect(r.perfilPatrimonial).toBe('Defensivo')
    expect(r.pilaresDoVeto).toEqual(['janelaLiquidez'])
  })
})
