import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuestionarioArquitetura } from './QuestionarioArquitetura'
import { PERGUNTAS_ARQUITETURA } from '../data/perguntasArquitetura'
import { CHAVE_ORCAMENTO } from '../state/useOrcamento'
import type { AppCtx } from '../state/useAppState'
import type { Orcamento } from '../domain/orcamento'

const orcamento: Orcamento = {
  salario: 5000,
  reserva: 10000,
  potes: { guardar: 0, crescer: 0 },
  contas: [{ id: 'aluguel', nome: 'Aluguel', valor: 2000, tipo: 'mensal' }],
  pagamentos: {},
  cartao: { teto: 0, compras: [] },
  recuperacao: {
    ligadoManual: false,
    dividas: [
      { id: 'd', nome: 'Cheque', tipo: 'cheque-especial', saldo: 800, saldoInicial: 800, jurosMensal: 8, parcelaMinima: 100 },
    ],
    metodo: 'avalanche',
    pactoDesde: null,
  },
}

function ctxNaPergunta(indice: number, respostas: AppCtx['respostasArquitetura'] = {}) {
  return {
    perguntaArquiteturaAtual: PERGUNTAS_ARQUITETURA[indice],
    passoArquitetura: indice,
    totalPerguntas: 7,
    totalPerguntasCombinado: 14,
    respostasArquitetura: respostas,
    responderPerguntaArquitetura: vi.fn(),
    voltarPerguntaArquitetura: vi.fn(),
  } as unknown as AppCtx
}

beforeEach(() => localStorage.clear())

describe('QuestionarioArquitetura com a ponte do Meu Mês', () => {
  it('sem Meu Mês, as perguntas ficam como sempre', async () => {
    render(<QuestionarioArquitetura ctx={ctxNaPergunta(0)} />)
    await Promise.resolve()
    expect(screen.queryByRole('note', { name: 'Sugestão do Meu Mês' })).toBeNull()
    expect(screen.queryByText('Sugestão do Meu Mês')).toBeNull()
  })

  it('Pilar 1: mostra a sugestão com o motivo, sem marcar a opção', async () => {
    localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 1, orcamento }))
    const ctx = ctxNaPergunta(0)
    render(<QuestionarioArquitetura ctx={ctx} />)

    expect(await screen.findByText(/a opção B combina/)).toBeTruthy()
    expect(screen.getByText(/paga 4,7 meses do seu custo de vida/)).toBeTruthy()
    expect(screen.getByText(/A resposta é sua/)).toBeTruthy()

    const sugerida = screen.getByText('Sugestão do Meu Mês').closest('button')!
    expect(sugerida.textContent).toContain('De 3 a 12 meses')
    expect(sugerida.className).not.toContain('selected')
    expect(ctx.responderPerguntaArquitetura).not.toHaveBeenCalled()
  })

  it('Pilar 2: dívida cara no Meu Mês sugere [A]; a pessoa pode escolher outra', async () => {
    localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 1, orcamento }))
    const ctx = ctxNaPergunta(1)
    render(<QuestionarioArquitetura ctx={ctx} />)

    expect(await screen.findByText(/a opção A combina/)).toBeTruthy()
    expect(screen.getByText(/uma dívida cara/)).toBeTruthy()

    fireEvent.click(screen.getByText(/Zero dívidas/).closest('button')!)
    expect(ctx.responderPerguntaArquitetura).toHaveBeenCalledWith('c')
  })

  it('a partir do Pilar 3, nada muda', async () => {
    localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 1, orcamento }))
    render(<QuestionarioArquitetura ctx={ctxNaPergunta(2)} />)
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.queryByText('Sugestão do Meu Mês')).toBeNull()
  })

  it('Meu Mês com versão desconhecida é ignorado', async () => {
    localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 99, orcamento }))
    render(<QuestionarioArquitetura ctx={ctxNaPergunta(0)} />)
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.queryByText('Sugestão do Meu Mês')).toBeNull()
  })
})
