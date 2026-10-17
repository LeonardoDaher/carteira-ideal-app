import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes, SnapshotOpcoesBruto } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, ultimo: number, extra: Partial<SerieOpcao> = {}): SerieOpcao => ({
  codigo, tipo, estilo: tipo === 'call' ? 'americana' : 'europeia', strike, vencimento, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 10, volume: 50_000, ...extra,
})

// Formato do pregão real de 16/10/2026 (cadastro e COTAHIST da B3), com poucas séries. O primeiro vencimento é 20/11.
const snapshot: SnapshotOpcoes = {
  geradoEm: '2026-10-17T15:00:00Z',
  dataPregao: '2026-10-16',
  fonte: 'Cadastro de instrumentos e COTAHIST da B3',
  ativos: [
    {
      ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, volumeOpcoes: 9_000_000, lote: 100,
      series: [
        serie('PETRK550', 'call', 55, '2026-11-19', 6.1, { variacao: 2.5 }),
        serie('PETRK600', 'call', 60, '2026-11-19', 2.8, { estilo: 'europeia', variacao: -7.5 }),
        serie('PETRK650', 'call', 65, '2026-11-19', 0.9),
        serie('PETRW600', 'put', 60, '2026-11-19', 2.2),
        serie('PETRL600', 'call', 60, '2026-12-18', 4.1, { dataUltimo: '2026-10-15' }),
      ],
    },
    { ticker: 'VALE3', nome: 'VALE', cotacao: 66, volumeOpcoes: 5_000_000, lote: 100, series: [serie('VALEK660', 'call', 66, '2026-11-19', 3.3)] },
    { ticker: 'BBAS3', nome: 'BRASIL', cotacao: 24, volumeOpcoes: 1_000_000, lote: 100, series: [serie('BBASK240', 'put', 24, '2026-11-19', 0.8)] },
  ],
}

const linhas = () => screen.queryAllByTestId('serie-opcao')
const codigos = () => linhas().map((l) => within(l).getAllByRole('cell')[1].textContent)
const txt = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/ /g, ' ')
const digitar = (rotulo: string, valor: string) => {
  const campo = screen.getByLabelText(rotulo)
  fireEvent.focus(campo)
  fireEvent.change(campo, { target: { value: valor } })
  fireEvent.blur(campo)
}
const todosVencimentos = () => fireEvent.click(screen.getByRole('button', { name: 'Nenhum (mostra todos)' }))

afterEach(() => vi.unstubAllGlobals())

describe('SimuleOpcoes: séries da B3', () => {
  it('abre no ativo mais negociado, só com o primeiro vencimento, e volta ao hub', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByRole('link', { name: '← Simule Ativos' }).getAttribute('href')).toBe('./?tela=simuleAtivos')
    expect(screen.getByText('4 séries de PETR4, de um total de 5')).toBeDefined()
    expect(codigos().sort()).toEqual(['PETRK550', 'PETRK600', 'PETRK650', 'PETRW600'])
    expect(codigos()).not.toContain('PETRL600')
  })

  it('mostra as colunas calculadas: modelo A/E, situação, distância, variação e dias úteis no vencimento', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    const k600 = linhas().find((l) => within(l).queryByText('PETRK600'))!
    const c = within(k600).getAllByRole('cell').map((x) => x.textContent)
    expect(c[2]).toBe('CALL')
    expect(c[3]).toBe('E') // europeia
    expect(c[4]).toBe('60,00')
    expect(c[5]).toBe('ATM')
    expect(c[6]).toBe('0,00')
    expect(c[8]).toBe('−7,50'.replace('−', '-'))
    expect(screen.getByText(/19\/11\/2026 \(22 d\.u\.\)/)).toBeDefined()
    expect(screen.getByText(/18\/12\/2026 \(42 d\.u\.\)/)).toBeDefined()
  })

  it('filtra por faixa de strike (mínimo e máximo)', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    digitar('Strike mínimo', '58')
    expect(screen.getByText('4 séries de PETR4, de um total de 5')).toBeDefined()
    expect(codigos()).not.toContain('PETRK550')
    digitar('Strike máximo', '60')
    expect(screen.getByText('3 séries de PETR4, de um total de 5')).toBeDefined()
    expect(codigos()).not.toContain('PETRK650')
  })

  it('atalho "perto do preço" usa ±% do fechamento', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±5%)' })) // 57 a 63
    expect(codigos().sort()).toEqual(['PETRK600', 'PETRL600', 'PETRW600'])
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±10%)' })) // 54 a 66
    expect(linhas()).toHaveLength(5)
  })

  it('combina strike com tipo, modelo e vencimentos', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    fireEvent.click(screen.getByRole('button', { name: 'Só calls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Europeias' }))
    expect(codigos()).toEqual(['PETRK600'])
    fireEvent.click(screen.getByRole('button', { name: 'Americanas' }))
    expect(codigos().sort()).toEqual(['PETRK550', 'PETRK650', 'PETRL600'])
    fireEvent.click(screen.getByRole('checkbox', { name: /18\/12\/2026/ }))
    expect(codigos()).toEqual(['PETRL600'])
  })

  it('"só último pregão" esconde séries que negociaram em dias anteriores', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    expect(codigos()).toContain('PETRL600')
    fireEvent.click(screen.getByRole('checkbox', { name: /Só séries que negociaram no último pregão/ }))
    expect(codigos()).not.toContain('PETRL600')
  })

  it('ordena ao clicar no cabeçalho e inverte no segundo clique', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: /^Último/ }))
    expect(codigos()).toEqual(['PETRK650', 'PETRW600', 'PETRK600', 'PETRK550'])
    fireEvent.click(screen.getByRole('button', { name: /^Último/ }))
    expect(codigos()).toEqual(['PETRK550', 'PETRK600', 'PETRW600', 'PETRK650'])
    expect(screen.getByRole('columnheader', { name: /Último/ }).getAttribute('aria-sort')).toBe('descending')
  })

  it('avisa quando o mínimo passa do máximo e quando nenhuma série atende', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    digitar('Strike mínimo', '90')
    expect(screen.getByText('Nenhuma série nessa combinação de filtros.')).toBeDefined()
    digitar('Strike máximo', '50')
    expect(screen.getByText('O strike mínimo é maior que o máximo.')).toBeDefined()
  })

  it('busca outros ativos pelo código ou nome e zera os filtros ao trocar', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'Só puts' }))
    expect(linhas()).toHaveLength(1)
    const busca = screen.getByLabelText('Buscar ativo por código ou nome')
    fireEvent.change(busca, { target: { value: 'brasil' } })
    fireEvent.click(within(screen.getByRole('list', { name: 'Ativos encontrados' })).getByRole('button', { name: /BBAS3/ }))
    expect(screen.getByText('1 série de BBAS3, de um total de 1')).toBeDefined()
    expect(codigos()).toEqual(['BBASK240'])
    expect(screen.getByRole('button', { name: 'Calls e puts' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('busca sem resultado explica o que fazer, e Enter escolhe o primeiro achado', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    const busca = screen.getByLabelText('Buscar ativo por código ou nome')
    fireEvent.change(busca, { target: { value: 'xyz' } })
    expect(screen.getByText(/Nenhum ativo com opções encontrado/)).toBeDefined()
    fireEvent.change(busca, { target: { value: 'vale' } })
    fireEvent.keyDown(busca, { key: 'Enter' })
    expect(screen.getByText('1 série de VALE3, de um total de 1')).toBeDefined()
  })

  it('sem dados, mostra o aviso de que ainda não foram carregados', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, ativos: [] }} />)
    expect(screen.getByText('Os dados de opções ainda não foram carregados.')).toBeDefined()
  })
})

describe('SimuleOpcoes: carregamento do arquivo', () => {
  const bruto: SnapshotOpcoesBruto = {
    geradoEm: null, dataPregao: '2026-10-16',
    ativos: [{ ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, volumeOpcoes: 1, lote: 100, series: [['PETRK600', 'C', 'E', 60, '2026-11-19', 2.8, '2026-10-16', null, 30, 300000]] }],
  }

  it('busca dados/opcoes.json e mostra as séries', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, json: async () => bruto })
    vi.stubGlobal('fetch', fetchFalso)
    render(<SimuleOpcoes ctx={ctx} />)
    expect(screen.getByText('Carregando as séries da B3…')).toBeDefined()
    await waitFor(() => expect(codigos()).toEqual(['PETRK600']))
    expect(String(fetchFalso.mock.calls[0][0])).toMatch(/dados\/opcoes\.json$/)
  })

  it('se o arquivo falhar, mostra o erro e deixa tentar de novo', async () => {
    const fetchFalso = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 }).mockResolvedValue({ ok: true, json: async () => bruto })
    vi.stubGlobal('fetch', fetchFalso)
    render(<SimuleOpcoes ctx={ctx} />)
    await screen.findByText('Não consegui carregar as séries agora.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(codigos()).toEqual(['PETRK600']))
  })
})

describe('SimuleOpcoes: estratégias', () => {
  const abrirEstrategias = () => fireEvent.click(screen.getByRole('tab', { name: /Estratégias/ }))

  it('compra de call padrão: perda limitada ao prêmio, ganho sem limite e equilíbrio em strike + prêmio', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(txt('perda-maxima')).toBe('−R$ 150,00')
    expect(txt('ganho-maximo')).toBe('Sem limite')
    expect(txt('equilibrio')).toBe('R$ 31,50')
  })

  it('venda de call descoberta tem perda sem limite e mostra o aviso de risco; venda de put tem ganho limitado ao prêmio', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: 'Venda de call' }))
    expect(txt('perda-maxima')).toBe('Sem limite')
    expect(txt('ganho-maximo')).toBe('R$ 150,00')
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/perda não tem limite/)
    fireEvent.click(screen.getByRole('button', { name: 'Venda de put' }))
    expect(txt('ganho-maximo')).toBe('R$ 150,00')
    expect(txt('perda-maxima')).toBe('−R$ 2.850,00') // strike 30 menos prêmio 1,50, vezes 100
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/obrigado a comprar/)
  })

  it('venda coberta e trava de alta têm ganho limitado', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: 'Trava de alta' }))
    // 100 opções, compra 30 por 1,50 e vende 33 por 0,60: débito 90, ganho máximo 210
    expect(txt('ganho-maximo')).toBe('R$ 210,00')
    expect(txt('perda-maxima')).toBe('−R$ 90,00')
    fireEvent.click(screen.getByRole('button', { name: 'Venda coberta' }))
    expect(txt('ganho-maximo')).not.toBe('Sem limite')
    expect(screen.getByText(/Precisa ter 100 ações/)).toBeDefined()
  })

  it('seleciona séries na tabela e cria a estratégia com elas, trocando compra por venda', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByRole('button', { name: /Criar estratégia com as selecionadas \(0\)/ }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar PETRK600' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar PETRK650' }))
    fireEvent.click(screen.getByRole('button', { name: /Criar estratégia com as selecionadas \(2\)/ }))

    expect(screen.getByText(/Séries escolhidas de/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Séries escolhidas \(2\)/ }).getAttribute('aria-pressed')).toBe('true')
    // compra K600 a 2,80 e compra K650 a 0,90, 100 de cada: débito 370
    expect(txt('perda-maxima')).toBe('−R$ 370,00')
    expect(txt('ganho-maximo')).toBe('Sem limite')

    // vende a K650: trava de alta (compra 60 por 2,80, vende 65 por 0,90): débito 190, ganho máximo 310
    const k650 = screen.getByRole('group', { name: 'Série PETRK650' })
    fireEvent.click(within(k650).getByRole('button', { name: 'Vender' }))
    expect(txt('perda-maxima')).toBe('−R$ 190,00')
    expect(txt('ganho-maximo')).toBe('R$ 310,00')
    expect(txt('equilibrio')).toBe('R$ 61,90')
  })

  it('séries de vencimentos diferentes não calculam e pedem correção', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar PETRK600' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar PETRL600' }))
    fireEvent.click(screen.getByRole('button', { name: /Criar estratégia com as selecionadas \(2\)/ }))
    expect(screen.getByText(/vencimentos diferentes/)).toBeDefined()
    expect(screen.queryByTestId('ganho-maximo')).toBeNull()
  })

  it('mostra as gregas e a passagem do tempo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.getByText(/Gregas da posição \(hoje\)/)).toBeDefined()
    fireEvent.change(screen.getByLabelText(/Passagem do tempo/), { target: { value: '10' } })
    expect(screen.getByText(/Gregas da posição \(daqui a 10 dias úteis\)/)).toBeDefined()
    expect(screen.getByText(/o resultado nesse dia seria/)).toBeDefined()
  })

  it('trava com strikes invertidos pede correção em vez de calcular', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: 'Trava de alta' }))
    digitar('Strike maior', '20')
    expect(screen.getByText(/O strike maior precisa ser maior que o menor/)).toBeDefined()
    expect(screen.queryByTestId('ganho-maximo')).toBeNull()
  })
})
