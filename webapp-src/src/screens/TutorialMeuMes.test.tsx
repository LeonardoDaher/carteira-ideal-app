import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AprenderVideo } from './AprenderVideo'
import { Trilha } from './Trilha'
import { Aprender } from './Aprender'
import { aulasDisponiveis, aulasEmOrdem, encontrarTrilha, totalDeAulas } from '../data/trilhas'
import type { AppCtx } from '../state/useAppState'

const trilha = encontrarTrilha('tutorial-meu-mes')!

/** Os 17 títulos da série de vídeos do Meu Mês, na ordem de gravação. */
const TITULOS = [
  'Abrindo o Meu Mês e começando pelo salário',
  'Cadastrando as contas de todo mês',
  'Contas do ano viram cofrinhos (IPVA, IPTU, seguro)',
  'Conta de todo mês paga no cartão de crédito',
  'Conta do ano no cartão: à vista ou parcelada',
  'Minhas dívidas: cadastrando cada dívida',
  'Cartão de crédito: o seu teto e o semáforo',
  'Primeiro mês no app: trazendo a fatura do mês passado',
  'Os três potes: Guardar, Fazer Crescer e Gastar',
  'Dia do salário: ticando as contas',
  'Lançando compras no cartão: à vista, sem juros e com juros',
  'Compras à vista do mês de uma vez (sem anotar uma por uma)',
  'Modo Recuperação: as regras para sair da dívida cara',
  'Plano de quitação: avalanche ou bola de neve',
  'Pacto de não parcelar e como negociar as dívidas',
  'Reserva parada com dívida cara, e a vitória',
  'Cópia de segurança: salvar, restaurar e começar de novo',
]

describe('Trilha "Tutorial Meu Mês" (D28)', () => {
  it('existe como trilha 4, com as 17 aulas da série, na ordem, já disponíveis em texto', () => {
    expect(trilha.numero).toBe(4)
    expect(trilha.titulo).toBe('Tutorial Meu Mês')
    expect(totalDeAulas(trilha)).toBe(17)
    expect(aulasDisponiveis(trilha)).toBe(17)
    expect(aulasEmOrdem(trilha).map((x) => x.aula.titulo)).toEqual(TITULOS)
  })

  it('ids das aulas são únicos e todas têm texto, resumo e o botão para o Meu Mês', () => {
    const aulas = aulasEmOrdem(trilha).map((x) => x.aula)
    expect(new Set(aulas.map((a) => a.id)).size).toBe(17)
    for (const a of aulas) {
      expect(a.texto && a.texto.length >= 3).toBe(true)
      expect(a.resumo.length).toBeGreaterThan(20)
      expect(a.acao).toBe('meuMes')
      // Vídeo (YouTube Shorts) publicado em todas as aulas; o texto continua abaixo do player.
      expect(a.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/)
      expect(a.formato).toBe('vertical')
    }
  })

  it('não promete resultado nem cita banco, e não atribui certificação', () => {
    const tudo = aulasEmOrdem(trilha).flatMap((x) => [x.aula.titulo, x.aula.resumo, ...(x.aula.texto ?? [])]).join(' ')
    expect(tudo).not.toMatch(/garantid|sem risco|renda certa|invista em|CNPI|ANBIMA|CEA\b/i)
    expect(tudo).not.toMatch(/Nubank|Itaú|Bradesco|Santander|Inter\b|C6/i)
  })

  it('aparece no Aprender e, na trilha, mostra as 17 aulas com vídeo', () => {
    const ctx = { abrirTrilha: vi.fn(), trilhaSelecionadaId: 'tutorial-meu-mes', screen: 'trilha', setScreen: vi.fn() } as unknown as AppCtx
    const { unmount } = render(<Aprender ctx={ctx} />)
    expect(screen.getByText('Trilha 4')).toBeTruthy()
    expect(screen.getByText('17 de 17 aulas disponíveis')).toBeTruthy()
    fireEvent.click(screen.getByText('Tutorial Meu Mês').closest('button')!)
    expect(ctx.abrirTrilha).toHaveBeenCalledWith('tutorial-meu-mes')
    unmount()

    render(<Trilha ctx={ctx} />)
    expect(screen.getAllByText(/^[12] min$/)).toHaveLength(17)
    expect(screen.queryAllByText(/^Leitura/)).toHaveLength(0)
    expect(screen.getByText('17. Cópia de segurança: salvar, restaurar e começar de novo')).toBeTruthy()
    expect(screen.queryByText('Em breve')).toBeNull()
  })

  it('aula do tutorial: texto, botão para o Meu Mês e aviso próprio; a última encerra a trilha', () => {
    const ctx = {
      aulaAtualRef: { trilhaId: 'tutorial-meu-mes', topicoId: 'cadastrar-contas', aulaId: 'contas-de-todo-mes' },
      setScreen: vi.fn(),
      abrirAula: vi.fn(),
      voltarDaAula: vi.fn(),
      screen: 'aprenderVideo',
    } as unknown as AppCtx
    const { unmount } = render(<AprenderVideo ctx={ctx} />)
    expect(screen.getByText(/Tutorial de uso do Meu Mês/)).toBeTruthy()
    expect(screen.queryByText(/não indica banco/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o Meu Mês' }))
    expect(ctx.setScreen).toHaveBeenCalledWith('meuMes')
    fireEvent.click(screen.getByRole('button', { name: /Próxima aula: Contas do ano viram cofrinhos/ }))
    expect(ctx.abrirAula).toHaveBeenCalledWith('tutorial-meu-mes', 'cadastrar-contas', 'contas-do-ano-cofrinhos')
    unmount()

    const ultima = { ...ctx, aulaAtualRef: { trilhaId: 'tutorial-meu-mes', topicoId: 'seguranca-dos-dados', aulaId: 'copia-de-seguranca' } } as unknown as AppCtx
    render(<AprenderVideo ctx={ultima} />)
    expect(screen.getByText(/Você concluiu todas as aulas/)).toBeTruthy()
  })

  it('a trilha do tutorial oferece o manual em PDF no topo da lista; as aulas e as outras trilhas não (D35)', () => {
    const ctx = { abrirTrilha: vi.fn(), trilhaSelecionadaId: 'tutorial-meu-mes', screen: 'trilha', setScreen: vi.fn() } as unknown as AppCtx
    const { unmount } = render(<Trilha ctx={ctx} />)
    const link = screen.getByRole('link', { name: /Manual completo do Meu Mês/ })
    expect(link.getAttribute('href')).toBe('../assets/manual-meu-mes.pdf')
    expect(link.getAttribute('download')).toBe('Manual-do-Meu-Mes-Carteira-Ideal.pdf')
    unmount()

    const outra = { ...ctx, trilhaSelecionadaId: 'sair-das-dividas' } as unknown as AppCtx
    const { unmount: unmount2 } = render(<Trilha ctx={outra} />)
    expect(screen.queryByRole('link', { name: /Manual completo do Meu Mês/ })).toBeNull()
    unmount2()

    const base = { setScreen: vi.fn(), abrirAula: vi.fn(), voltarDaAula: vi.fn(), screen: 'aprenderVideo' }
    render(
      <AprenderVideo ctx={{ ...base, aulaAtualRef: { trilhaId: 'tutorial-meu-mes', topicoId: 'cadastrar-contas', aulaId: 'contas-de-todo-mes' } } as unknown as AppCtx} />,
    )
    expect(screen.queryByRole('link', { name: /Manual completo do Meu Mês/ })).toBeNull()
  })

  it('aulas de dívida do tutorial levam o aviso de "não é assessoria jurídica" e as fontes oficiais', () => {
    const ctx = {
      aulaAtualRef: { trilhaId: 'tutorial-meu-mes', topicoId: 'modo-recuperacao', aulaId: 'pacto-e-negociar' },
      setScreen: vi.fn(),
      abrirAula: vi.fn(),
      voltarDaAula: vi.fn(),
      screen: 'aprenderVideo',
    } as unknown as AppCtx
    render(<AprenderVideo ctx={ctx} />)
    expect(screen.getByText(/não indica banco nem produto de crédito/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Registrato/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /consumidor.gov.br/ })).toBeTruthy()
    const dividas = aulasEmOrdem(trilha).filter((x) => x.aula.aviso === 'dividas').map((x) => x.aula.id)
    expect(dividas).toEqual(['minhas-dividas', 'modo-recuperacao', 'plano-de-quitacao', 'pacto-e-negociar', 'reserva-parada-e-vitoria'])
  })
})
