import { describe, expect, it } from 'vitest'
import { aplicarCalibradoresSuaves, calcularPerfilPatrimonial, gerarRecomendacao } from './engine'
import type { Carteira, RespostasArquitetura, RespostasQuestionario } from './types'

function carteiraSoma100(carteira: Record<string, number | undefined>) {
  return Object.values(carteira).reduce((s: number, v) => s + (v ?? 0), 0)
}

describe('gerarRecomendacao', () => {
  it('classifica como Conservador quando todas as respostas são "a"', () => {
    const respostas: RespostasQuestionario = {
      objetivo: 'a',
      prazo: 'a',
      tolerancia: 'a',
      reserva: 'a',
      patrimonio: 'a',
      experiencia: 'a',
      reacao: 'a',
    }
    const resultado = gerarRecomendacao(respostas, { idade: 30 })
    expect(resultado.perfilBase).toBe('Conservador')
    expect(resultado.perfilFinal).toBe('Conservador')
    expect(carteiraSoma100(resultado.carteira)).toBe(100)
  })

  it('rebaixa perfil Arrojado para Moderado quando o prazo é curto', () => {
    const respostas: RespostasQuestionario = {
      objetivo: 'd',
      prazo: 'a', // prazo curto
      tolerancia: 'd',
      reserva: 'd',
      patrimonio: 'd',
      experiencia: 'd',
      reacao: 'd',
    }
    const resultado = gerarRecomendacao(respostas, { idade: 30 })
    expect(resultado.perfilBase).toBe('Arrojado')
    expect(resultado.perfilFinal).toBe('Moderado')
  })

  it('remove ativos de diversificação quando o patrimônio é muito baixo', () => {
    const respostas: RespostasQuestionario = {
      objetivo: 'd',
      prazo: 'd',
      tolerancia: 'd',
      reserva: 'd',
      patrimonio: 'a', // até R$ 5 mil
      experiencia: 'd',
      reacao: 'd',
    }
    const resultado = gerarRecomendacao(respostas, { idade: 30 })
    expect(resultado.carteira.fiis).toBeUndefined()
    expect(resultado.carteira.acoesETFs).toBeUndefined()
    expect(carteiraSoma100(resultado.carteira)).toBe(100)
  })

  it('limita ativos de risco a 10% quando não há experiência prévia', () => {
    const respostas: RespostasQuestionario = {
      objetivo: 'd',
      prazo: 'd',
      tolerancia: 'd',
      reserva: 'd',
      patrimonio: 'd',
      experiencia: 'a', // nenhuma experiência
      reacao: 'd',
    }
    const resultado = gerarRecomendacao(respostas, { idade: 30 })
    for (const ativo of ['acoesETFs', 'bdrs', 'fiis', 'ouro', 'fundosInternacionais', 'cripto'] as const) {
      const valor = resultado.carteira[ativo]
      if (valor !== undefined) expect(valor).toBeLessThanOrEqual(10)
    }
  })

  it('sempre devolve uma carteira que soma exatamente 100%', () => {
    const respostas: RespostasQuestionario = {
      objetivo: 'b',
      prazo: 'c',
      tolerancia: 'b',
      reserva: 'b',
      patrimonio: 'c',
      experiencia: 'c',
      reacao: 'b',
    }
    const resultado = gerarRecomendacao(respostas, { idade: 45 })
    expect(carteiraSoma100(resultado.carteira)).toBe(100)
  })

  it('inclui Tesouro Prefixado no prazo médio e Tesouro IPCA+ no prazo longo', () => {
    const base: RespostasQuestionario = {
      objetivo: 'b',
      prazo: 'b', // prazo médio
      tolerancia: 'b',
      reserva: 'c',
      patrimonio: 'c',
      experiencia: 'c',
      reacao: 'b',
    }
    const medio = gerarRecomendacao(base, { idade: 35 })
    expect(medio.prazo).toBe('medio')
    expect(medio.carteira.tesouroPrefixado).toBeGreaterThan(0)
    expect(medio.carteira.tesouroIPCA).toBeUndefined()

    const longo = gerarRecomendacao({ ...base, prazo: 'd' }, { idade: 35 })
    expect(longo.prazo).toBe('longo')
    expect(longo.carteira.tesouroIPCA).toBeGreaterThan(0)
    expect(longo.carteira.tesouroPrefixado).toBeUndefined()
  })
})

describe('calcularPerfilPatrimonial', () => {
  const respostasBaixa: RespostasArquitetura = {
    capacidadeFinanceira: 'a',
    passivoDividas: 'a',
    janelaLiquidez: 'a',
    comportamentoEstresse: 'a',
    dependenciaRenda: 'a',
    capitalHumano: 'a',
    eficienciaFiscal: 'a',
  }
  const respostasMedia: RespostasArquitetura = {
    capacidadeFinanceira: 'b',
    passivoDividas: 'b',
    janelaLiquidez: 'b',
    comportamentoEstresse: 'b',
    dependenciaRenda: 'b',
    capitalHumano: 'b',
    eficienciaFiscal: 'b',
  }
  const respostasAlta: RespostasArquitetura = {
    capacidadeFinanceira: 'c',
    passivoDividas: 'c',
    janelaLiquidez: 'c',
    comportamentoEstresse: 'c',
    dependenciaRenda: 'c',
    capitalHumano: 'c',
    eficienciaFiscal: 'c',
  }

  it('soma o score de 6 (todo a) a 18 (todo c); o Pilar 7 não pontua', () => {
    expect(calcularPerfilPatrimonial('Arrojado', respostasBaixa).scoreArquitetura).toBe(6)
    expect(calcularPerfilPatrimonial('Arrojado', respostasMedia).scoreArquitetura).toBe(12)
    expect(calcularPerfilPatrimonial('Arrojado', respostasAlta).scoreArquitetura).toBe(18)
  })

  it('aplica a regra de veto quando um pilar-restrição-dura vem como "a", mesmo com suitability Arrojado', () => {
    const resultado = calcularPerfilPatrimonial('Arrojado', { ...respostasAlta, capacidadeFinanceira: 'a' })
    expect(resultado.vetoAplicado).toBe(true)
    expect(resultado.perfilPatrimonial).toBe('Defensivo')
  })

  it('lê a matriz 3x3: capacidade alta + suitability Arrojado = Crescimento Pleno', () => {
    const resultado = calcularPerfilPatrimonial('Arrojado', respostasAlta)
    expect(resultado.capacidadeReal).toBe('alta')
    expect(resultado.perfilPatrimonial).toBe('Crescimento Pleno')
  })

  it('capacidade alta + suitability Conservador dá vetor Crescimento Pleno (o teto de risco do suitability é aplicado na carteira, não no vetor)', () => {
    const resultado = calcularPerfilPatrimonial('Conservador', respostasAlta)
    expect(resultado.perfilPatrimonial).toBe('Crescimento Pleno')
    expect(resultado.perfilFinalCarteira).toBe('3. Conservador Acúmulo')
  })

  it('os 9 Perfis-Mãe são todos alcançáveis (D73): vetor pela capacidade x suitability', () => {
    const veto = { ...respostasAlta, capacidadeFinanceira: 'a' as const }
    const nomes = new Set<string>()
    for (const suit of ['Conservador', 'Moderado', 'Arrojado'] as const) {
      for (const r of [respostasBaixa, respostasMedia, respostasAlta, veto]) {
        nomes.add(calcularPerfilPatrimonial(suit, r).perfilFinalCarteira)
      }
    }
    expect(nomes.size).toBe(9)
    expect(calcularPerfilPatrimonial('Conservador', respostasMedia).perfilFinalCarteira).toBe('2. Conservador Renda')
    expect(calcularPerfilPatrimonial('Moderado', respostasAlta).perfilFinalCarteira).toBe('6. Moderado Expansão')
  })

  it('devolve o Perfil Final da Carteira (1 a 9) e não só o Perfil Patrimonial — cliente vê o nome do perfil-mãe', () => {
    // respostasBaixa tem [A] nos pilares duros (veto) e, por isso, é sempre Defensivo.
    expect(calcularPerfilPatrimonial('Conservador', respostasBaixa).perfilFinalCarteira).toBe('1. Conservador Puro')
    expect(calcularPerfilPatrimonial('Conservador', respostasMedia).perfilFinalCarteira).toBe('2. Conservador Renda')
    expect(calcularPerfilPatrimonial('Conservador', respostasAlta).perfilFinalCarteira).toBe('3. Conservador Acúmulo')
    expect(calcularPerfilPatrimonial('Moderado', respostasBaixa).perfilFinalCarteira).toBe('4. Moderado Defensivo')
    expect(calcularPerfilPatrimonial('Moderado', respostasMedia).perfilFinalCarteira).toBe('5. Moderado Renda (Equilíbrio)')
    expect(calcularPerfilPatrimonial('Moderado', respostasAlta).perfilFinalCarteira).toBe('6. Moderado Expansão')
    expect(calcularPerfilPatrimonial('Arrojado', respostasBaixa).perfilFinalCarteira).toBe('7. Arrojado Travado (Falso Arrojado)')
    expect(calcularPerfilPatrimonial('Arrojado', respostasMedia).perfilFinalCarteira).toBe('8. Arrojado Gerador de Renda')
    expect(calcularPerfilPatrimonial('Arrojado', respostasAlta).perfilFinalCarteira).toBe('9. Arrojado Pleno / Global')
  })

  it('regra de veto: suitability Arrojado + veto vira "7. Arrojado Travado (Falso Arrojado)", não "9. Arrojado Pleno / Global"', () => {
    const resultado = calcularPerfilPatrimonial('Arrojado', { ...respostasAlta, capacidadeFinanceira: 'a' })
    expect(resultado.perfilPatrimonial).toBe('Defensivo')
    expect(resultado.perfilFinalCarteira).toBe('7. Arrojado Travado (Falso Arrojado)')
  })

  it('gerarRecomendacao propaga perfilFinalCarteira para a tela de Resultado', () => {
    const respostasSuitability: RespostasQuestionario = {
      objetivo: 'c', prazo: 'd', tolerancia: 'c', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'c',
    }
    const resultado = gerarRecomendacao(respostasSuitability, { idade: 35 }, respostasMedia)
    expect(resultado.perfilFinalCarteira).toBeDefined()
    expect(resultado.perfilFinalCarteira).toContain(resultado.perfilFinal === 'Moderado' ? 'Moderado' : resultado.perfilFinal)
  })

  it('gerarRecomendacao inclui o perfil patrimonial quando as 7 respostas de arquitetura são passadas', () => {
    const respostasSuitability: RespostasQuestionario = {
      objetivo: 'c', prazo: 'd', tolerancia: 'c', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'c',
    }
    const resultado = gerarRecomendacao(respostasSuitability, { idade: 35 }, respostasMedia)
    expect(resultado.perfilPatrimonial).toBeDefined()
    expect(resultado.scoreArquitetura).toBe(12)
  })

  const suitModerado: RespostasQuestionario = {
    objetivo: 'b', prazo: 'd', tolerancia: 'b', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'c',
  }
  const suitArrojado: RespostasQuestionario = {
    objetivo: 'd', prazo: 'd', tolerancia: 'd', reserva: 'd', patrimonio: 'd', experiencia: 'd', reacao: 'c',
  }

  it('a carteira-modelo vem do vetor patrimonial e do prazo; o suitability só limita o risco', () => {
    const dados = { idade: 35 }
    // respostasMedia tem Pilar 3 = "b" (gasto entre 3 e 5 anos): o prazo "longo" do
    // suitability cai para "médio" (D73). Nesse prazo o Equilibrado não chega ao teto do
    // Moderado, então Moderado e Arrojado recebem a mesma carteira.
    const r1 = gerarRecomendacao(suitModerado, dados, respostasMedia)
    const r2 = gerarRecomendacao(suitArrojado, dados, respostasMedia)
    expect(r1.perfilPatrimonial).toBe('Equilibrado')
    expect(r2.perfilPatrimonial).toBe('Equilibrado')
    expect(r1.perfilFinal).not.toBe(r2.perfilFinal)
    expect(r1.prazo).toBe('medio')
    expect(r2.prazo).toBe('medio')
    expect(r1.carteira).toEqual(r2.carteira)
  })

  it('no prazo longo o suitability Moderado não recebe cripto; o Arrojado recebe (cripto só para Arrojado)', () => {
    const dados = { idade: 35 }
    const longa = { ...respostasMedia, janelaLiquidez: 'c' as const }
    const r1 = gerarRecomendacao(suitModerado, dados, longa)
    const r2 = gerarRecomendacao(suitArrojado, dados, longa)
    expect(r1.prazo).toBe('longo')
    expect(r1.carteira.cripto ?? 0).toBe(0)
    expect(r2.carteira.cripto ?? 0).toBeGreaterThan(0)
    expect(carteiraSoma100(r1.carteira)).toBe(100)
  })
})

describe('aplicarCalibradoresSuaves', () => {
  // Carteira-modelo de referência: Perfil Patrimonial Equilibrado, prazo longo.
  const carteiraBase: Carteira = {
    tesouroSelic: 10, tesouroIPCA: 20, tesouroPrefixado: 5, ouro: 10, fiis: 12,
    acoesETFs: 17, bdrs: 5, fundosInternacionais: 5, cripto: 3, lciLca: 13,
  }
  const respostasTodoB: RespostasArquitetura = {
    capacidadeFinanceira: 'b', passivoDividas: 'b', janelaLiquidez: 'b',
    comportamentoEstresse: 'b', dependenciaRenda: 'b', capitalHumano: 'b', eficienciaFiscal: 'b',
  }
  function soma(c: Carteira) {
    return Object.values(c).reduce((s: number, v) => s + (v ?? 0), 0)
  }

  it('não move percentual quando os 4 pilares suaves vêm todos como "b" (só sobra o aviso informativo do Pilar 7)', () => {
    const { carteira, alertas } = aplicarCalibradoresSuaves(carteiraBase, respostasTodoB)
    expect(carteira).toEqual(carteiraBase)
    expect(alertas).toHaveLength(1)
    expect(alertas[0]).toContain('simplificada')
  })

  it('Pilar 4 = "a" reduz Ações/BDRs/Internacionais/Cripto e redireciona para Ouro, preservando a soma', () => {
    const { carteira, alertas } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, comportamentoEstresse: 'a' })
    expect(carteira.acoesETFs!).toBeLessThan(carteiraBase.acoesETFs!)
    expect(carteira.ouro!).toBeGreaterThan(carteiraBase.ouro!)
    expect(soma(carteira)).toBe(soma(carteiraBase))
    expect(alertas.length).toBeGreaterThan(0)
  })

  it('Pilar 4 = "c" eleva Ações/BDRs a partir do Tesouro Selic', () => {
    const { carteira } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, comportamentoEstresse: 'c' })
    expect(carteira.acoesETFs!).toBeGreaterThan(carteiraBase.acoesETFs!)
    expect(carteira.bdrs!).toBeGreaterThan(carteiraBase.bdrs!)
    expect(soma(carteira)).toBe(soma(carteiraBase))
  })

  it('Pilar 5 = "a" prioriza FIIs sobre Ações', () => {
    const { carteira, alertas } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, dependenciaRenda: 'a' })
    expect(carteira.fiis!).toBeGreaterThan(carteiraBase.fiis!)
    expect(carteira.acoesETFs!).toBeLessThan(carteiraBase.acoesETFs!)
    expect(soma(carteira)).toBe(soma(carteiraBase))
    expect(alertas.length).toBeGreaterThan(0)
  })

  it('Pilar 5 = "c" prioriza Ações sobre FIIs (acúmulo, não renda)', () => {
    const { carteira } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, dependenciaRenda: 'c' })
    expect(carteira.acoesETFs!).toBeGreaterThan(carteiraBase.acoesETFs!)
    expect(carteira.fiis!).toBeLessThan(carteiraBase.fiis!)
  })

  it('Pilar 6 = "a" (renda oscilante) migra parte do Prefixado para o IPCA+', () => {
    const { carteira } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, capitalHumano: 'a' })
    expect(carteira.tesouroIPCA!).toBeGreaterThan(carteiraBase.tesouroIPCA!)
    expect(carteira.tesouroPrefixado ?? 0).toBeLessThan(carteiraBase.tesouroPrefixado!)
    expect(soma(carteira)).toBe(soma(carteiraBase))
  })

  it('Pilar 6 = "c" (renda ultra estável) eleva Ações/BDRs a partir do Tesouro Selic', () => {
    const { carteira } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, capitalHumano: 'c' })
    expect(carteira.acoesETFs!).toBeGreaterThan(carteiraBase.acoesETFs!)
    expect(carteira.bdrs!).toBeGreaterThan(carteiraBase.bdrs!)
    expect(soma(carteira)).toBe(soma(carteiraBase))
  })

  it('Pilar 7 nunca move percentual — PGBL/VGBL são invólucros, não classes de ativo', () => {
    const { carteira: carteiraA } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, eficienciaFiscal: 'a' })
    const { carteira: carteiraC } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, eficienciaFiscal: 'c' })
    expect(carteiraA).toEqual(carteiraBase)
    expect(carteiraC).toEqual(carteiraBase)
  })

  it('Pilar 7 gera um alerta por resposta (a: PGBL; b: compare com VGBL; c: confira o modelo), todas mutuamente exclusivas', () => {
    const al = (l: 'a' | 'b' | 'c') => aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, eficienciaFiscal: l }).alertas
    expect(al('a').some((a) => a.includes('PGBL'))).toBe(true)
    expect(al('b').some((a) => a.includes('simplificada'))).toBe(true)
    expect(al('c').some((a) => a.includes('Confira'))).toBe(true)
    expect(al('a')).toHaveLength(1)
    expect(al('b')).toHaveLength(1)
    expect(al('c')).toHaveLength(1)
  })

  it('Pilar 7 não pontua: trocar só a resposta dele não muda score, capacidade nem perfil', () => {
    for (const l of ['a', 'b', 'c'] as const) {
      const r = calcularPerfilPatrimonial('Arrojado', { ...respostasTodoB, eficienciaFiscal: l })
      expect(r.scoreArquitetura).toBe(12)
      expect(r.perfilFinalCarteira).toBe('8. Arrojado Gerador de Renda')
    }
  })

  it('calibradores que aumentam risco (Pilar 4 [C], Pilar 6 [C]) não rodam em carteira Defensiva', () => {
    const defensivoCurto: Carteira = { tesouroSelic: 55, cdbLiquidez: 25, tesouroIPCA: 5, tesouroPrefixado: 5, ouro: 6, bdrs: 1, fundosInternacionais: 1, fiis: 2 }
    const ousado: RespostasArquitetura = { ...respostasTodoB, comportamentoEstresse: 'c', capitalHumano: 'c' }
    const { carteira } = aplicarCalibradoresSuaves(defensivoCurto, ousado, { permitirAumentoRisco: false })
    expect(carteira).toEqual(defensivoCurto)
    // sem a trava (comportamento antigo), eles aumentam o risco
    expect(aplicarCalibradoresSuaves(defensivoCurto, ousado).carteira.acoesETFs ?? 0).toBeGreaterThan(0)
  })

  it('Pilar 4 [C] não aumenta ações se a reação do suitability é de quem se abala com quedas', () => {
    const { carteira } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, comportamentoEstresse: 'c' }, { reacaoCalma: false })
    expect(carteira).toEqual(carteiraBase)
  })

  it('nunca deixa uma classe negativa mesmo com carteiras pequenas (ex.: perfil Defensivo curto)', () => {
    const carteiraPequena: Carteira = { tesouroSelic: 55, cdbLiquidez: 25, tesouroIPCA: 5, tesouroPrefixado: 5, ouro: 10 }
    const respostasTodoA: RespostasArquitetura = { ...respostasTodoB, comportamentoEstresse: 'a', dependenciaRenda: 'a', capitalHumano: 'a' }
    const { carteira } = aplicarCalibradoresSuaves(carteiraPequena, respostasTodoA)
    for (const valor of Object.values(carteira)) {
      expect(valor ?? 0).toBeGreaterThanOrEqual(0)
    }
    expect(soma(carteira)).toBe(soma(carteiraPequena))
  })

  it('integrado a gerarRecomendacao: Pilar 4 = "a" reduz a fatia de Ações na carteira final', () => {
    const respostasSuitability: RespostasQuestionario = {
      objetivo: 'c', prazo: 'd', tolerancia: 'c', reserva: 'd', patrimonio: 'd', experiencia: 'c', reacao: 'c',
    }
    const comCalma = gerarRecomendacao(respostasSuitability, { idade: 35 }, respostasTodoB)
    const comTrauma = gerarRecomendacao(respostasSuitability, { idade: 35 }, { ...respostasTodoB, comportamentoEstresse: 'a' })
    expect(comTrauma.carteira.acoesETFs ?? 0).toBeLessThan(comCalma.carteira.acoesETFs ?? 0)
    expect(carteiraSoma100(comTrauma.carteira)).toBe(100)
    expect(comTrauma.alertas.some((a) => a.includes('mais volátil'))).toBe(true)
  })
})
