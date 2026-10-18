import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, ultimo: number, extra: Partial<SerieOpcao> = {}): SerieOpcao => ({
  codigo, tipo, estilo: 'europeia', strike, vencimento, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 20, volume: 50_000, ...extra,
})

// Pregão de 16/10/2026. Vencimento de 19/11/2026: 22 dias úteis (mensal).
const snapshot: SnapshotOpcoes = {
  geradoEm: null,
  dataPregao: '2026-10-16',
  ativos: [
    {
      ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, dataCotacao: '2026-10-16', variacao: 1.69, volumeOpcoes: 9_000_000, lote: 100,
      series: [
        serie('PETRW600', 'put', 60, '2026-11-19', 2.2),
        serie('PETRW550', 'put', 55, '2026-11-19', 0.5),
        serie('PETRK600', 'call', 60, '2026-11-19', 2.8),
        serie('PETRK650', 'call', 65, '2026-11-19', 0.9),
        serie('PETRK550', 'call', 55, '2026-11-19', 6.1), // dentro do dinheiro: fora da call coberta
        serie('PETRL600', 'call', 60, '2026-12-18', 4.1, { dataUltimo: '2026-10-15' }), // não negociou no último pregão
      ],
    },
    { ticker: 'VALE3', nome: 'VALE', cotacao: 66, volumeOpcoes: 5_000_000, lote: 100, series: [serie('VALEK660', 'call', 66, '2026-11-19', 3.3)] },
    { ticker: 'BBAS3', nome: 'BRASIL', cotacao: 24, volumeOpcoes: 1_000_000, lote: 100, series: [serie('BBASW240', 'put', 24, '2026-11-19', 0.8)] },
  ],
}

const abrirTop = () => fireEvent.click(screen.getByRole('tab', { name: /Top 15 prêmios/ }))
const semLimite = () => fireEvent.click(within(screen.getByRole('group', { name: 'Risco máximo' })).getByRole('button', { name: 'Sem limite' }))
const linhas = () => screen.queryAllByTestId('linha-premio')
const celulas = (l: HTMLElement) => within(l).getAllByRole('cell').map((c) => (c.textContent ?? '').replace(/ /g, ' '))
const series = () => linhas().map((l) => celulas(l)[3])

describe('SimuleOpcoes: Top 15 prêmios', () => {
  it('abre na venda de put, com limite de risco de 25%, e avisa quando nada atende (as puts de exemplo estão no dinheiro)', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    expect(screen.getByRole('button', { name: 'Até 25%' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Vender put' }).getAttribute('aria-pressed')).toBe('true')
    // PETRW600 e BBASW240 estão no dinheiro (chance perto de 50%); só a PETRW550 fica abaixo do limite.
    expect(series()).toEqual(['PETRW550'])
  })

  it('sem limite de risco, ordena as puts pelo rendimento em 21 dias úteis, e calcula prazo, mês e colchão', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    expect(series()).toEqual(['PETRW600', 'BBASW240']) // uma série por ativo: a melhor de PETR4 (600) e a de BBAS3
    const w600 = celulas(linhas()[0])
    expect(w600[2]).toMatch(/PETR4.*R\$\s60,00/)
    expect(w600[4]).toBe('60,00') // strike
    expect(w600[5]).toBe('19/11/2026 (22)')
    expect(w600[6]).toBe('2,20') // prêmio
    expect(w600[7]).toBe('3,67') // 2,20 ÷ 60 até o vencimento
    expect(w600[8]).toBe('3,50') // levado a 21 dias úteis: × 21 ÷ 22
    expect(w600[9]).toBe('3,67') // colchão: a queda até o strike (zero) mais o prêmio
  })

  it('para o mesmo ativo, o limite de risco troca a série ATM por uma mais afastada, que paga menos', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    fireEvent.click(screen.getByRole('checkbox', { name: /Só a melhor série de cada ativo/ }))
    expect(series().filter((c) => c.startsWith('PETR'))).toEqual(['PETRW600', 'PETRW550'])
  })

  it('venda coberta de call: só calls a partir do preço, com a coluna de ganho se exercida', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    fireEvent.click(screen.getByRole('button', { name: 'Vender call coberta' }))
    semLimite()
    expect(screen.getByRole('columnheader', { name: /Se exercida/ })).toBeDefined()
    expect(series()).toEqual(['VALEK660', 'PETRK600']) // VALE3 paga 5,0% contra 4,7% da PETR4; a K550 (dentro do dinheiro) e a L600 (parada) ficam fora
    const petr = celulas(linhas()[1])
    expect(petr[7]).toBe('4,67') // 2,80 ÷ 60
    expect(petr[10]).toBe('4,67') // ganho se exercida: strike igual ao preço, só o prêmio
  })

  it('filtra por vencimentos mensais e semanais', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    fireEvent.click(screen.getByRole('button', { name: 'Semanais' }))
    expect(screen.getByText('Nenhuma série atende aos filtros.')).toBeDefined() // todas as séries de exemplo vencem na quinta mensal
    fireEvent.click(screen.getByRole('button', { name: 'Mensais' }))
    expect(series()).toEqual(['PETRW600', 'BBASW240'])
  })

  it('"Simular" numa put leva às estratégias com a série já vendida e o aviso de risco', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    fireEvent.click(screen.getByRole('button', { name: 'Simular a venda de PETRW600' }))
    expect(screen.getByRole('button', { name: /Séries escolhidas \(1\)/ }).getAttribute('aria-pressed')).toBe('true')
    const grupo = screen.getByRole('group', { name: 'Série PETRW600' })
    expect(within(grupo).getByRole('button', { name: 'Vender' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/vendidas/)
  })

  it('"Simular" numa call coberta abre a venda coberta com o strike e o prêmio da série', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    fireEvent.click(screen.getByRole('button', { name: 'Vender call coberta' }))
    semLimite()
    fireEvent.click(screen.getByRole('button', { name: 'Simular a venda de PETRK600' }))
    expect(screen.getByRole('button', { name: 'Venda coberta' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/Venda coberta com a série/)).toBeDefined()
    expect((screen.getByLabelText('Série da perna 1') as HTMLSelectElement).value).toBe('PETRK600')
    expect((screen.getByLabelText('Preço da perna 1') as HTMLInputElement).value).toBe('2,80')
    expect((screen.getByLabelText('Preço do ativo hoje') as HTMLInputElement).value).toBe('60,00')
  })

  it('o "voltar" do navegador, a partir das estratégias abertas pelo ranking, volta ao ranking', async () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    fireEvent.click(screen.getByRole('button', { name: 'Simular a venda de PETRW600' }))
    expect(screen.getByTestId('monte-estrategia')).toBeDefined()
    window.history.back()
    await waitFor(() => expect(screen.getByRole('group', { name: 'Risco máximo' })).toBeDefined())
    expect(screen.queryByTestId('monte-estrategia')).toBeNull()
  })

  it('explica o método e os limites', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    expect(screen.getByText('Como o ranking é calculado')).toBeDefined()
    expect(screen.getByText(/Quem paga o maior prêmio, para um mesmo risco\?/)).toBeDefined()
  })
})

describe('SimuleOpcoes: Top 15 prêmios, venda montada na própria linha (V)', () => {
  const txt = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/ /g, ' ')
  const vender = (codigo: string) => fireEvent.click(screen.getByRole('button', { name: `Vender ${codigo}` }))

  it('cada linha tem o V (vermelho) na frente e o Simular continua no fim', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    const primeira = linhas()[0]
    expect(within(primeira).getAllByRole('cell')[0].textContent).toBe('V')
    expect(within(primeira).getByRole('button', { name: /^Simular a venda de/ })).toBeDefined()
    expect(screen.queryByRole('button', { name: /^Comprar / })).toBeNull() // só a venda: o ranking é de quem vende
  })

  it('V numa put monta a venda ali mesmo, sem sair do ranking, com ganho limitado ao prêmio', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    expect(screen.queryByTestId('operacao-da-serie')).toBeNull()
    vender('PETRW600')
    expect(screen.getByText('Venda de put: PETRW600')).toBeDefined()
    expect(txt('ganho-maximo')).toBe('R$ 220,00') // 2,20 × 100
    expect(txt('perda-maxima')).toBe('−R$ 5.780,00')
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/obrigado a comprar/)
    expect(screen.getByRole('tab', { name: /Top 15 prêmios/ }).getAttribute('aria-selected')).toBe('true') // continua na mesma aba
    expect(linhas().length).toBeGreaterThan(0)
  })

  it('V numa call do ranking de calls cobertas monta a venda coberta, com as ações', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    fireEvent.click(screen.getByRole('button', { name: 'Vender call coberta' }))
    semLimite()
    vender('PETRK600')
    expect(screen.getByText('Venda coberta: PETRK600')).toBeDefined()
    expect(txt('ganho-maximo')).toBe('R$ 280,00') // ações a 60, call de strike 60 a 2,80: só o prêmio
    expect(txt('perda-maxima')).toBe('−R$ 5.720,00') // as ações a zero, menos o prêmio
    expect(screen.getByText(/Precisa ter 100 ações/)).toBeDefined()
    expect(screen.queryByTestId('aviso-risco')).toBeNull() // coberta: sem o aviso de perda sem limite
  })

  it('clicar de novo no V, ou em Fechar, desfaz a operação', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    vender('PETRW600')
    expect(screen.getByTestId('operacao-da-serie')).toBeDefined()
    vender('PETRW600')
    expect(screen.queryByTestId('operacao-da-serie')).toBeNull()
    vender('BBASW240')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTestId('operacao-da-serie')).toBeNull()
  })

  it('o Simular continua levando a série para a aba Estratégias', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirTop()
    semLimite()
    fireEvent.click(screen.getByRole('button', { name: 'Simular a venda de PETRW600' }))
    expect(screen.getByTestId('monte-estrategia')).toBeDefined()
    expect(screen.getByRole('button', { name: /Séries escolhidas \(1\)/ }).getAttribute('aria-pressed')).toBe('true')
  })
})
