import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'
import type { SnapshotAcoesEndividadas } from '../domain/acoesEndividadas'
import type { RespostaTop15 } from '../domain/acessoTop15'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const serie = (codigo: string, strike: number, ultimo: number): SerieOpcao => ({
  codigo, tipo: 'put', estilo: 'europeia', strike, vencimento: '2026-11-19', ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 20, volume: 50_000,
})

// Duas puts no dinheiro (vencimento mensal de 19/11): PETR4, muito endividada, e BBAS3 (banco: fora da lista de dívida).
const snapshot: SnapshotOpcoes = {
  geradoEm: null,
  dataPregao: '2026-10-16',
  ativos: [
    { ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, volumeOpcoes: 9_000_000, lote: 100, series: [serie('PETRW600', 60, 2.2)] },
    { ticker: 'BBAS3', nome: 'BRASIL', cotacao: 24, volumeOpcoes: 1_000_000, lote: 100, series: [serie('BBASW240', 24, 0.8)] },
  ],
}

const endividadas = {
  publicado: true,
  tamanhoDaLista: 1,
  dataCorte: '2026-10-05',
  dataPrecos: '2026-10-16',
  ranking: [{ ticker: 'PETR4', dlEbitda: 9.5, posicao: 1 }],
  restante: [{ ticker: 'VALE3', nome: 'VALE', setor: 'Mineração', posicao: 2, dlEbitda: 1.2 }],
  semEbitdaPositivo: [],
} as unknown as SnapshotAcoesEndividadas

const baratasOk = (tickers: string[]) =>
  vi.fn().mockResolvedValue({ ok: true, snapshot: { publicado: true, ranking: tickers.map((ticker) => ({ ticker })) } } as unknown as RespostaTop15)
const comCodigo = { getItem: async () => 'CI-ABCD-EFGH' }
const semCodigo = { getItem: async () => null }

const abrirTop = () => {
  fireEvent.click(screen.getByRole('tab', { name: /Top 15 prêmios/ }))
  fireEvent.click(within(screen.getByRole('group', { name: 'Risco máximo' })).getByRole('button', { name: 'Sem limite' }))
}
const linhas = () => screen.queryAllByTestId('linha-premio')
const series = () => linhas().map((l) => within(l).getAllByRole('cell')[3].textContent)
const dividas = () => screen.queryAllByTestId('celula-divida').map((c) => (c.textContent ?? '').replace(/ /g, ' '))

describe('Top 15 prêmios cruzado com a dívida das empresas', () => {
  it('mostra dívida líquida ÷ EBITDA e a posição na lista, com aviso para as mais endividadas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} endividadas={endividadas} carregarBaratas={baratasOk([])} armazenamento={semCodigo} />)
    abrirTop()
    expect(series()).toEqual(['PETRW600', 'BBASW240'])
    expect(dividas()).toEqual(['9,5x 1ª mais endividada', '—']) // PETR4 no Top; BBAS3 (banco) fora do universo
    expect(screen.getByRole('columnheader', { name: /Dív\. líq\.\/EBITDA/ })).toBeDefined()
  })

  it('o limite de dívida tira as empresas acima dele e mantém as sem dado', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} endividadas={endividadas} carregarBaratas={baratasOk([])} armazenamento={semCodigo} />)
    abrirTop()
    fireEvent.click(screen.getByRole('button', { name: 'Até 5x' }))
    expect(series()).toEqual(['BBASW240'])
    fireEvent.click(screen.getByRole('button', { name: 'Até 3x' }))
    expect(series()).toEqual(['BBASW240'])
    fireEvent.click(within(screen.getByRole('group', { name: 'Limite de dívida' })).getByRole('button', { name: 'Sem limite' }))
    expect(series()).toEqual(['PETRW600', 'BBASW240'])
  })

  it('sem a lista de dívida publicada, a coluna e o filtro não aparecem', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} endividadas={{ ...endividadas, publicado: false }} carregarBaratas={baratasOk([])} armazenamento={semCodigo} />)
    abrirTop()
    expect(screen.queryByRole('group', { name: 'Limite de dívida' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: /Dív\. líq\.\/EBITDA/ })).toBeNull()
  })
})

describe('Top 15 prêmios cruzado com o Top 15 mais baratas (lista restrita por código)', () => {
  it('com o código já liberado neste aparelho, marca as empresas da lista e deixa filtrar por elas', async () => {
    const carregar = baratasOk(['BBAS3'])
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} endividadas={endividadas} carregarBaratas={carregar} armazenamento={comCodigo} />)
    abrirTop()
    await waitFor(() => expect(screen.getAllByTestId('selo-barata')).toHaveLength(1))
    expect(carregar).toHaveBeenCalledWith('CI-ABCD-EFGH')
    const linhaBbas = linhas().find((l) => within(l).queryByText('BBASW240'))!
    expect(within(linhaBbas).getByTestId('selo-barata').textContent).toBe('Top 15 mais baratas')

    fireEvent.click(screen.getByRole('checkbox', { name: /Só as empresas do Top 15 mais baratas/ }))
    expect(series()).toEqual(['BBASW240'])
  })

  it('sem código, nada é pedido ao servidor e a nota explica como liberar, sem mostrar a lista', async () => {
    const carregar = baratasOk(['BBAS3'])
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} endividadas={endividadas} carregarBaratas={carregar} armazenamento={semCodigo} />)
    abrirTop()
    const nota = await screen.findByTestId('nota-baratas')
    expect(within(nota).getByRole('link', { name: 'Simule Ações' }).getAttribute('href')).toBe('./?tela=simuleAcoes')
    expect(carregar).not.toHaveBeenCalled()
    expect(screen.queryByTestId('selo-barata')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /Top 15 mais baratas/ })).toBeNull()
  })

  it('código que o servidor recusa não quebra o ranking: só avisa que não conseguiu conferir', async () => {
    const carregar = vi.fn().mockResolvedValue({ ok: false, motivo: 'invalido' } as RespostaTop15)
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} endividadas={endividadas} carregarBaratas={carregar} armazenamento={comCodigo} />)
    abrirTop()
    expect(await screen.findByText(/Não consegui conferir o Top 15 mais baratas agora/)).toBeDefined()
    expect(screen.queryByTestId('selo-barata')).toBeNull()
    expect(series()).toEqual(['PETRW600', 'BBASW240'])
  })
})
