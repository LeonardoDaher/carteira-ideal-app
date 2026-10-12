import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Resultado } from './Resultado'
import { gerarRecomendacao } from '../domain/engine'
import type { AppCtx } from '../state/useAppState'
import type { RespostasArquitetura, RespostasQuestionario } from '../domain/types'

const suit: RespostasQuestionario = {
  objetivo: 'c', prazo: 'd', tolerancia: 'd', reserva: 'd', patrimonio: 'c', experiencia: 'c', reacao: 'c',
}
const alta: RespostasArquitetura = {
  capacidadeFinanceira: 'c', passivoDividas: 'c', janelaLiquidez: 'c',
  comportamentoEstresse: 'c', dependenciaRenda: 'c', capitalHumano: 'c', eficienciaFiscal: 'c',
}

function contexto(arq: RespostasArquitetura) {
  return {
    resultado: gerarRecomendacao(suit, { idade: 35 }, arq),
    respostasArquitetura: arq,
    abrirDetalheAtivo: () => {},
    limparDados: () => {},
    setScreen: () => {},
  } as unknown as AppCtx
}

describe('Resultado: score e veto sem contradição (D78)', () => {
  it('com veto, não mostra "Capacidade real: alta" solta: explica o motivo do veto', () => {
    render(<Resultado ctx={contexto({ ...alta, janelaLiquidez: 'a' })} />)
    const explicacao = screen.getByTestId('explicacao-veto')
    const texto = explicacao.textContent!.replace(/\s+/g, ' ')
    expect(texto).toContain('Regra de veto aplicada')
    expect(texto).toContain('Pelo score, sua capacidade seria alta')
    expect(texto).toContain('você vai precisar de parte do dinheiro em até 24 meses')
    expect(texto).not.toContain('Capacidade real:')
  })

  it('junta os motivos quando mais de um pilar veta', () => {
    render(<Resultado ctx={contexto({ ...alta, capacidadeFinanceira: 'a', passivoDividas: 'a', janelaLiquidez: 'a' })} />)
    const texto = screen.getByTestId('explicacao-veto').textContent!.replace(/\s+/g, ' ')
    expect(texto).toContain('a sua reserva cobre menos de 3 meses, você tem dívida cara ou passivo em dólar e você vai precisar de parte do dinheiro em até 24 meses')
  })

  it('sem veto, mostra a linha de sempre: capacidade real e score', () => {
    render(<Resultado ctx={contexto(alta)} />)
    expect(screen.queryByTestId('explicacao-veto')).toBeNull()
    expect(screen.getByText(/Capacidade real: alta \(score 18\/18\)/)).toBeTruthy()
  })

  it('o nome do perfil 7 aparece como "Quase Arrojado"', () => {
    render(<Resultado ctx={contexto({ ...alta, capacidadeFinanceira: 'a' })} />)
    expect(screen.getByText(/Arrojado Travado \(Quase Arrojado\)/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('Falso Arrojado')
  })

  it('o aviso que explica o veto aparece na lista "Por que esse exemplo?"', () => {
    render(<Resultado ctx={contexto({ ...alta, capacidadeFinanceira: 'a' })} />)
    expect(screen.getByText(/Carteira levada a Defensivo porque sua reserva cobre menos de 3 meses/)).toBeTruthy()
  })
})
