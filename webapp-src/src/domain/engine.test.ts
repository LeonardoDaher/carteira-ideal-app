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

  it('soma o score de 7 (todo a) a 21 (todo c)', () => {
    expect(calcularPerfilPatrimonial('Arrojado', respostasBaixa).scoreArquitetura).toBe(7)
    expect(calcularPerfilPatrimonial('Arrojado', respostasMedia).scoreArquitetura).toBe(14)
    expect(calcularPerfilPatrimonial('Arrojado', respostasAlta).scoreArquitetura).toBe(21)
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

  it('capacidade alta + suitability Conservador ainda fica Defensivo (o mais conservador prevalece)', () => {
    const resultado = calcularPerfilPatrimonial('Conservador', respostasAlta)
    expect(resultado.perfilPatrimonial).toBe('Defensivo')
  })

  it('devolve o Perfil Final da Carteira (1 a 9) e não só o Perfil Patrimonial — cliente vê o nome do perfil-mãe', () => {
    // MATRIZ_PATRIMONIAL (pré-existente) já limita o suitability Conservador sempre ao
    // vetor Defensivo ("o mais conservador prevalece" — ver teste acima), então só o
    // perfil 1 é alcançável por essa via para o Conservador; os perfis 2 e 3 existem no
    // nome do mapa (para o caso de essa trava mudar no futuro) mas não são alcançados aqui.
    expect(calcularPerfilPatrimonial('Conservador', respostasBaixa).perfilFinalCarteira).toBe('1. Conservador Puro')
    expect(calcularPerfilPatrimonial('Conservador', respostasMedia).perfilFinalCarteira).toBe('1. Conservador Puro')
    expect(calcularPerfilPatrimonial('Conservador', respostasAlta).perfilFinalCarteira).toBe('1. Conservador Puro')
    expect(calcularPerfilPatrimonial('Moderado', respostasBaixa).perfilFinalCarteira).toBe('4. Moderado Defensivo')
    expect(calcularPerfilPatrimonial('Moderado', respostasMedia).perfilFinalCarteira).toBe('5. Moderado Renda (Equilíbrio)')
    expect(calcularPerfilPatrimonial('Moderado', respostasAlta).perfilFinalCarteira).toBe('5. Moderado Renda (Equilíbrio)')
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
    expect(resultado.scoreArquitetura).toBe(14)
  })

  it('a carteira-modelo depende do perfil patrimonial e do prazo, não do suitability bruto', () => {
    const dados = { idade: 35 }
    // Duas combinações diferentes que caem em "Equilibrado" pela matriz 3x3: capacidade
    // média + suitability Moderado, e capacidade média + suitability Arrojado.
    const respostasModerado: RespostasQuestionario = {
      objetivo: 'b', prazo: 'd', tolerancia: 'b', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'c',
    }
    const respostasArrojado: RespostasQuestionario = {
      objetivo: 'd', prazo: 'd', tolerancia: 'd', reserva: 'd', patrimonio: 'd', experiencia: 'd', reacao: 'c',
    }
    const r1 = gerarRecomendacao(respostasModerado, dados, respostasMedia)
    const r2 = gerarRecomendacao(respostasArrojado, dados, respostasMedia)
    expect(r1.perfilPatrimonial).toBe('Equilibrado')
    expect(r2.perfilPatrimonial).toBe('Equilibrado')
    expect(r1.perfilFinal).not.toBe(r2.perfilFinal) // suitability diferente...
    expect(r1.prazo).toBe(r2.prazo) // ...mesmo prazo (longo)...
    // ...e, como nenhuma trava rígida (reserva/patrimônio/experiência) diverge entre os
    // dois cenários, a carteira final é idêntica: quem escolhe a carteira-modelo é o
    // Perfil Patrimonial (Equilibrado) x prazo (longo), não o suitability bruto.
    expect(r1.carteira).toEqual(r2.carteira)
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

  it('não altera a carteira quando os 4 pilares suaves vêm todos como "b"', () => {
    const { carteira, alertas } = aplicarCalibradoresSuaves(carteiraBase, respostasTodoB)
    expect(carteira).toEqual(carteiraBase)
    expect(alertas).toHaveLength(0)
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

  it('Pilar 7 = "a" ou "c" gera um alerta informativo sobre o veículo (PGBL/VGBL)', () => {
    const { alertas: alertasA } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, eficienciaFiscal: 'a' })
    const { alertas: alertasC } = aplicarCalibradoresSuaves(carteiraBase, { ...respostasTodoB, eficienciaFiscal: 'c' })
    expect(alertasA.some((a) => a.includes('PGBL'))).toBe(true)
    expect(alertasC.some((a) => a.includes('VGBL'))).toBe(true)
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
