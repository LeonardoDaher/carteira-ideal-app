import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AprenderVideo } from './AprenderVideo'
import { Trilha } from './Trilha'
import { Aprender } from './Aprender'
import { aulaDisponivel, aulasDisponiveis, encontrarTrilha, totalDeAulas } from '../data/trilhas'
import type { AppCtx } from '../state/useAppState'

const trilha = encontrarTrilha('sair-das-dividas')!

describe('Trilha "Sair das dívidas" (D21, Etapa 4)', () => {
  it('existe como trilha 3, com 9 aulas em texto já disponíveis', () => {
    expect(trilha.numero).toBe(3)
    expect(totalDeAulas(trilha)).toBe(9)
    expect(aulasDisponiveis(trilha)).toBe(9)
    expect(trilha.topicos.flatMap((t) => t.aulas).every((a) => a.texto && a.texto.length >= 3)).toBe(true)
  })

  it('aula sem vídeo e sem texto continua "em breve"', () => {
    expect(aulaDisponivel({ id: 'x', titulo: 'X', duracao: '2 min', resumo: '' })).toBe(false)
    expect(aulaDisponivel({ id: 'x', titulo: 'X', duracao: '2 min', resumo: '', texto: ['a'] })).toBe(true)
  })

  it('aparece no Aprender e mostra as 9 aulas com vídeo', () => {
    const ctx = { abrirTrilha: vi.fn(), trilhaSelecionadaId: 'sair-das-dividas', screen: 'trilha', setScreen: vi.fn() } as unknown as AppCtx
    const { unmount } = render(<Aprender ctx={ctx} />)
    fireEvent.click(screen.getByText('Sair das dívidas').closest('button')!)
    expect(ctx.abrirTrilha).toHaveBeenCalledWith('sair-das-dividas')
    unmount()

    render(<Trilha ctx={ctx} />)
    expect(screen.getAllByText('2 min')).toHaveLength(9)
    expect(screen.queryAllByText(/^Leitura/)).toHaveLength(0)
    expect(screen.queryByText('Em breve')).toBeNull()
  })

  it('aula com vídeo: player do Short em formato vertical e o texto segue abaixo', () => {
    const ctx = {
      aulaAtualRef: { trilhaId: 'sair-das-dividas', topicoId: 'entender-a-divida', aulaId: 'registrato' },
      setScreen: vi.fn(),
      abrirAula: vi.fn(),
      voltarDaAula: vi.fn(),
      screen: 'aprenderVideo',
    } as unknown as AppCtx
    const { container } = render(<AprenderVideo ctx={ctx} />)
    const iframe = container.querySelector('iframe') as HTMLIFrameElement
    expect(iframe.src).toBe('https://www.youtube.com/embed/JLuz-UN9tqo')
    expect(screen.queryByText('Vídeo em breve')).toBeNull()
    expect(screen.getByText(/conta gov.br, nível prata ou ouro/)).toBeTruthy()
  })

  it('aula em texto: parágrafos, fontes oficiais e botão para o Meu Mês', () => {
    const ctx = {
      aulaAtualRef: { trilhaId: 'sair-das-dividas', topicoId: 'entender-a-divida', aulaId: 'registrato' },
      setScreen: vi.fn(),
      abrirAula: vi.fn(),
      voltarDaAula: vi.fn(),
      screen: 'aprenderVideo',
    } as unknown as AppCtx
    render(<AprenderVideo ctx={ctx} />)
    expect(screen.queryByText('Vídeo em breve')).toBeNull()
    expect(screen.getByText(/conta gov.br, nível prata ou ouro/)).toBeTruthy()
    const link = screen.getByRole('link', { name: /Registrato/ }) as HTMLAnchorElement
    expect(link.href).toContain('bcb.gov.br')
    expect(link.target).toBe('_blank')
    expect(screen.getByText(/não indica banco nem produto de crédito/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir o Meu Mês' }))
    expect(ctx.setScreen).toHaveBeenCalledWith('meuMes')
  })

  it('última aula: leva ao questionário (ou a refazê-lo, para quem já tem resultado)', () => {
    const ref = { trilhaId: 'sair-das-dividas', topicoId: 'negociar-e-recomecar', aulaId: 'depois-da-ultima-parcela' }
    const semResultado = { aulaAtualRef: ref, resultado: null, iniciarQuestionario: vi.fn(), setScreen: vi.fn(), screen: 'aprenderVideo' } as unknown as AppCtx
    const { unmount } = render(<AprenderVideo ctx={semResultado} />)
    expect(screen.getByText(/Você concluiu todas as aulas/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fazer o questionário da Carteira Ideal' }))
    expect(semResultado.iniciarQuestionario).toHaveBeenCalled()
    unmount()

    const comResultado = { aulaAtualRef: ref, resultado: {}, limparDados: vi.fn(), setScreen: vi.fn(), screen: 'aprenderVideo' } as unknown as AppCtx
    render(<AprenderVideo ctx={comResultado} />)
    fireEvent.click(screen.getByRole('button', { name: 'Refazer o questionário da Carteira Ideal' }))
    expect(comResultado.limparDados).toHaveBeenCalled()
  })

  it('as trilhas de investimento continuam com o aviso de sempre', () => {
    const ctx = {
      aulaAtualRef: { trilhaId: 'conhecendo-os-ativos', topicoId: 'renda-fixa', aulaId: 'tesouroSelic' },
      setScreen: vi.fn(),
      screen: 'aprenderVideo',
    } as unknown as AppCtx
    render(<AprenderVideo ctx={ctx} />)
    expect(screen.getByText(/sem caráter de recomendação de compra ou venda/)).toBeTruthy()
    expect(screen.getByText('Sobre esta aula')).toBeTruthy()
  })
})
