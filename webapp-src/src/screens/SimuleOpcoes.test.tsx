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
      ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, dataCotacao: '2026-10-16', variacao: 1.69, volumeOpcoes: 9_000_000, lote: 100,
      series: [
        serie('PETRK550', 'call', 55, '2026-11-19', 6.1, { variacao: 2.5 }),
        serie('PETRK600', 'call', 60, '2026-11-19', 2.8, { estilo: 'europeia', variacao: -7.5 }),
        serie('PETRK650', 'call', 65, '2026-11-19', 0.9),
        serie('PETRW600', 'put', 60, '2026-11-19', 2.2),
        serie('PETRL600', 'call', 60, '2026-12-18', 4.1, { dataUltimo: '2026-10-15' }),
        serie('PETRZ600', 'call', 60, '2027-06-18', 9.9), // além dos próximos 6 meses: não aparece
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

describe('SimuleOpcoes: compra e venda de call e put montadas nas séries da B3', () => {
  const operar = (acao: 'Comprar' | 'Vender', codigo: string) => fireEvent.click(screen.getByRole('button', { name: `${acao} ${codigo}` }))

  it('não há painel até clicar em C ou V, e a tabela continua na tela depois', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.queryByTestId('operacao-da-serie')).toBeNull()
    operar('Comprar', 'PETRK600')
    expect(screen.getByTestId('operacao-da-serie')).toBeDefined()
    expect(codigos().sort()).toEqual(['PETRK550', 'PETRK600', 'PETRK650', 'PETRW600']) // segue na aba das séries
    expect(screen.getByRole('tab', { name: /Séries da B3/ }).getAttribute('aria-selected')).toBe('true')
  })

  it('compra de call: perda limitada ao prêmio, ganho sem limite e equilíbrio em strike + prêmio', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    operar('Comprar', 'PETRK600') // 100 opções a R$ 2,80, o último preço da série
    expect(screen.getByText('Compra de call: PETRK600')).toBeDefined()
    expect(txt('perda-maxima')).toBe('−R$ 280,00')
    expect(txt('ganho-maximo')).toBe('Sem limite')
    expect(txt('equilibrio')).toBe('R$ 62,80')
    expect(screen.queryByTestId('aviso-risco')).toBeNull()
  })

  it('venda de call descoberta: ganho limitado ao prêmio, perda sem limite e aviso de risco', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    operar('Vender', 'PETRK600')
    expect(txt('ganho-maximo')).toBe('R$ 280,00')
    expect(txt('perda-maxima')).toBe('Sem limite')
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/perda não tem limite/)
  })

  it('compra de put: ganho até o ativo ir a zero e perda limitada ao prêmio', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    operar('Comprar', 'PETRW600') // put a R$ 2,20
    expect(screen.getByText('Compra de put: PETRW600')).toBeDefined()
    expect(txt('perda-maxima')).toBe('−R$ 220,00')
    expect(txt('ganho-maximo')).toBe('R$ 5.780,00')
    expect(txt('equilibrio')).toBe('R$ 57,80')
  })

  it('venda de put: ganho limitado ao prêmio e perda grande se o ativo for a zero, com aviso', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    operar('Vender', 'PETRW600')
    expect(txt('ganho-maximo')).toBe('R$ 220,00')
    expect(txt('perda-maxima')).toBe('−R$ 5.780,00')
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/obrigado a comprar/)
  })

  it('trocar entre comprar e vender, e clicar de novo ou em Fechar, desfaz a operação', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    operar('Comprar', 'PETRK600')
    operar('Vender', 'PETRK600')
    expect(screen.getByRole('button', { name: 'Vender PETRK600' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Comprar PETRK600' }).getAttribute('aria-pressed')).toBe('false')
    operar('Vender', 'PETRK600')
    expect(screen.queryByTestId('operacao-da-serie')).toBeNull()
    operar('Comprar', 'PETRK650')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByTestId('operacao-da-serie')).toBeNull()
  })

  it('o prêmio, a quantidade e o preço do ativo podem ser alterados', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    operar('Comprar', 'PETRK600')
    digitar('Preço da série (prêmio)', '3')
    expect(txt('perda-maxima')).toBe('−R$ 300,00')
    digitar('Quantidade de opções', '200')
    expect(txt('perda-maxima')).toBe('−R$ 600,00')
    expect((screen.getByLabelText('Preço do ativo hoje') as HTMLInputElement).value).toBe('60,00') // vem do fechamento
  })

  it('mostra as gregas e a passagem do tempo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    operar('Comprar', 'PETRK600')
    expect(screen.getByText(/Gregas da posição \(hoje\)/)).toBeDefined()
    fireEvent.change(screen.getByLabelText(/Passagem do tempo/), { target: { value: '10' } })
    expect(screen.getByText(/Gregas da posição \(daqui a 10 dias úteis\)/)).toBeDefined()
    expect(screen.getByText(/o resultado nesse dia seria/)).toBeDefined()
  })

  it('não há mais "criar estratégia com as selecionadas": as estruturas ficam na aba Estratégias', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.queryByRole('button', { name: /Criar estratégia/ })).toBeNull()
    expect(screen.getByText(/Travas, borboletas e condors ficam na aba Estratégias/)).toBeDefined()
  })
})

describe('SimuleOpcoes: aba Estratégias (monte sua estratégia)', () => {
  const abrirEstrategias = () => fireEvent.click(screen.getByRole('tab', { name: /Estratégias/ }))
  const modelo = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }))

  it('abre na trava de alta com calls, escolhendo as séries pelo preço do ativo, com o ganho e a perda limitados', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.getByTestId('monte-estrategia').textContent).toMatch(/^Monte sua estratégia/)
    expect(screen.getByRole('button', { name: 'Trava de alta (com calls)' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Série da perna 1') as HTMLSelectElement).value).toBe('PETRK600') // strike 60 = preço
    expect((screen.getByLabelText('Série da perna 2') as HTMLSelectElement).value).toBe('PETRK650')
    // compra 60 a 2,80 e vende 65 a 0,90, 100 de cada: débito 190, ganho máximo 310
    expect(txt('perda-maxima')).toBe('−R$ 190,00')
    expect(txt('ganho-maximo')).toBe('R$ 310,00')
    expect(txt('equilibrio')).toBe('R$ 61,90')
  })

  it('só há travas, borboletas, condors, volatilidade e estruturas com ações: compra e venda simples ficam nas séries', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    for (const nome of ['Trava de alta (com puts)', 'Trava de baixa (com puts)', 'Trava de baixa (com calls)', 'Borboleta de calls', 'Borboleta de ferro', 'Condor de ferro', 'Condor de calls', 'Trava horizontal de puts (THL)', 'Trava diagonal de puts', 'Slide com put', 'Put vendida otimizada (put + trava de baixa com calls)', 'Strangle comprado financiado (risco menor)', 'Booster (ações + trava de alta financiada por put)', 'Straddle comprado', 'Strangle vendido', 'Venda coberta', 'Collar (proteção com custo menor)'])
      expect(screen.getByRole('button', { name: nome })).toBeDefined()
    for (const nome of ['Compra de call', 'Venda de call', 'Compra de put', 'Venda de put']) expect(screen.queryByRole('button', { name: nome })).toBeNull()
  })

  it('borboleta de calls vende o dobro no meio e limita o ganho e a perda', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    modelo('Borboleta de calls')
    // compra 55 a 6,10, vende 2x 60 a 2,80, compra 65 a 0,90: débito 140; ganho máximo com o ativo em 60: 500 − 140
    expect(within(screen.getByRole('group', { name: /^Perna 2/ })).getByText('200 opções')).toBeDefined()
    expect(txt('perda-maxima')).toBe('−R$ 140,00')
    expect(txt('ganho-maximo')).toBe('R$ 360,00')
  })

  it('straddle comprado usa uma call e uma put, tem dois equilíbrios e só oferece vencimentos com os dois tipos', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    modelo('Straddle comprado')
    expect(txt('perda-maxima')).toBe('−R$ 500,00')
    expect(txt('ganho-maximo')).toBe('Sem limite')
    expect(txt('equilibrio')).toBe('R$ 55,00 e R$ 65,00')
    // 18/12 só tem call: não aparece para quem precisa de put
    expect(within(screen.getByRole('group', { name: 'Vencimento da estratégia' })).getAllByRole('button')).toHaveLength(1)
  })

  it('estruturas vendidas sem proteção mostram o aviso de risco', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.queryByTestId('aviso-risco')).toBeNull()
    modelo('Straddle vendido')
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/pode ser muito maior/)
    expect(txt('perda-maxima')).toBe('Sem limite')
  })

  it('venda coberta e collar contam as ações', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    modelo('Venda coberta')
    expect(screen.getAllByText(/Precisa ter 100 ações/).length).toBeGreaterThan(0)
    expect(txt('ganho-maximo')).not.toBe('Sem limite')
    // call vendida de strike 65 a 0,90, ações a 60: ganho máximo (5 + 0,90) × 100
    expect(txt('ganho-maximo')).toBe('R$ 590,00')
  })

  it('o booster leva ações, avisa do risco da put vendida e diz que a montagem segue a definição mais comum', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    modelo('Booster (ações + trava de alta financiada por put)')
    expect(screen.getAllByText(/Precisa ter 100 ações/).length).toBeGreaterThan(0)
    expect(screen.getByTestId('aviso-risco').textContent).toMatch(/put vendida sem proteção/)
    expect(screen.getByText(/definição mais comum/)).toBeDefined()
  })

  it('o passo a passo por objetivo: escolhe o que quer, vê as estruturas com a razão e o risco, e monta a escolhida', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    const caixa = within(screen.getByTestId('objetivos'))
    expect(screen.queryByTestId('sugestoes-do-objetivo')).toBeNull()
    fireEvent.click(caixa.getByRole('button', { name: 'Renda com prêmios' }))
    const sugestoes = within(screen.getByTestId('sugestoes-do-objetivo'))
    expect(sugestoes.getByText('Condor de ferro')).toBeDefined()
    expect(sugestoes.getByText('Venda coberta')).toBeDefined()
    expect(sugestoes.getAllByText('Exige ter as ações').length).toBeGreaterThan(0)
    expect(sugestoes.getAllByText('Risco grande se for contra').length).toBeGreaterThan(0) // slide e put otimizada
    expect(screen.getByTestId('cuidado-do-objetivo').textContent).toMatch(/Nenhuma estrutura garante renda/)
    fireEvent.click(sugestoes.getByRole('button', { name: 'Montar Venda coberta' }))
    expect(screen.getByRole('button', { name: 'Venda coberta' }).getAttribute('aria-pressed')).toBe('true') // na lista completa
    expect(sugestoes.getByRole('button', { name: 'Montar Venda coberta' }).textContent).toBe('Em montagem')
    expect(screen.getAllByText(/Precisa ter 100 ações/).length).toBeGreaterThan(0)
  })

  it('trocar de objetivo troca a lista, e clicar de novo no mesmo objetivo recolhe', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    const caixa = within(screen.getByTestId('objetivos'))
    fireEvent.click(caixa.getByRole('button', { name: 'Apostar na alta' }))
    expect(within(screen.getByTestId('sugestoes-do-objetivo')).getByText('Trava de alta (com calls)')).toBeDefined()
    fireEvent.click(caixa.getByRole('button', { name: 'Lucrar com movimento forte' }))
    expect(within(screen.getByTestId('sugestoes-do-objetivo')).getByText('Straddle comprado')).toBeDefined()
    expect(within(screen.getByTestId('sugestoes-do-objetivo')).queryByText('Trava de alta (com calls)')).toBeNull()
    fireEvent.click(caixa.getByRole('button', { name: 'Lucrar com movimento forte' }))
    expect(screen.queryByTestId('sugestoes-do-objetivo')).toBeNull()
  })

  it('trocar a série de uma perna atualiza o preço, e uma ordem de strikes trocada pede correção', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.change(screen.getByLabelText('Série da perna 2'), { target: { value: 'PETRK550' } })
    expect((screen.getByLabelText('Preço da perna 2') as HTMLInputElement).value).toBe('6,10')
    expect(screen.getByText(/ordem dos strikes está trocada/)).toBeDefined()
    expect(screen.queryByTestId('ganho-maximo')).toBeNull()
  })

  it('duas pernas no mesmo strike (só há um strike de put) pedem correção em vez de calcular', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    modelo('Trava de baixa (com puts)')
    expect(screen.getByText(/mesmo strike/)).toBeDefined()
    expect(screen.queryByTestId('ganho-maximo')).toBeNull()
  })

  it('trocar o vencimento reescolhe as séries, e a quantidade vale para todas as pernas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: /18\/12\/2026 \(42 d\.u\., mensal\)/ })) // só uma call nesse vencimento
    expect((screen.getByLabelText('Série da perna 1') as HTMLSelectElement).value).toBe('PETRL600')
    expect((screen.getByLabelText('Série da perna 2') as HTMLSelectElement).value).toBe('PETRL600')
    expect(screen.getByText(/mesmo strike/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /19\/11\/2026/ }))
    digitar('Quantidade (lote)', '200')
    expect(txt('perda-maxima')).toBe('−R$ 380,00')
  })

  it('o preço do ativo parte do que estava nas séries, e dá para trocar de ativo ali mesmo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'vale' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    abrirEstrategias()
    expect((screen.getByLabelText('Preço do ativo hoje') as HTMLInputElement).value).toBe('66,00')
    expect(txt('preco-ativo')).toBe('R$ 60,00'.replace('60', '66'))
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'petr' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    expect((screen.getByLabelText('Preço do ativo hoje') as HTMLInputElement).value).toBe('60,00')
    expect((screen.getByLabelText('Série da perna 1') as HTMLSelectElement).value).toBe('PETRK600')
  })

  it('THL: a call longa vai para o vencimento seguinte e o resultado vira estimativa, com perda limitada ao débito', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.queryByTestId('aviso-estimativa')).toBeNull() // mesmo vencimento: resultado exato
    modelo('Trava horizontal de calls (THL)')
    expect((screen.getByLabelText('Vencimento da perna 1') as HTMLSelectElement).value).toBe('2026-12-18') // longa
    expect((screen.getByLabelText('Vencimento da perna 2') as HTMLSelectElement).value).toBe('2026-11-19') // curta
    expect((screen.getByLabelText('Série da perna 1') as HTMLSelectElement).value).toBe('PETRL600')
    expect((screen.getByLabelText('Série da perna 2') as HTMLSelectElement).value).toBe('PETRK600')
    expect(screen.getByTestId('aviso-estimativa').textContent).toMatch(/Vencimentos diferentes: o resultado é uma estimativa/)
    expect(screen.getByText('Ganho máximo (estimado)')).toBeDefined()
    expect(txt('ganho-maximo')).not.toBe('Sem limite')
    expect(txt('perda-maxima')).toBe('−R$ 130,00') // o débito: longe do strike as duas opções valem zero
    expect(screen.getByText(/Débito ao montar as opções:/).textContent).toContain('130,00') // 4,10 menos 2,80, vezes 100
  })

  it('trava diagonal de calls usa strikes e vencimentos diferentes', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    modelo('Trava diagonal de calls')
    expect((screen.getByLabelText('Série da perna 1') as HTMLSelectElement).value).toBe('PETRL600')
    expect((screen.getByLabelText('Série da perna 2') as HTMLSelectElement).value).toBe('PETRK650')
    expect(screen.getByTestId('aviso-estimativa')).toBeDefined()
  })

  it('a perna longa não pode vencer antes da curta', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    modelo('Trava horizontal de calls (THL)')
    fireEvent.change(screen.getByLabelText('Vencimento da perna 1'), { target: { value: '2026-11-19' } })
    expect(screen.getByText(/perna longa precisa vencer depois da perna curta/)).toBeDefined()
    expect(screen.queryByTestId('ganho-maximo')).toBeNull()
  })

  it('qualquer estrutura aceita trocar o vencimento de uma perna, e então o resultado passa a ser estimado', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.queryByTestId('aviso-estimativa')).toBeNull()
    fireEvent.change(screen.getByLabelText('Vencimento da perna 1'), { target: { value: '2026-12-18' } }) // compra a call de dezembro
    expect((screen.getByLabelText('Série da perna 1') as HTMLSelectElement).value).toBe('PETRL600')
    expect(screen.getByTestId('aviso-estimativa')).toBeDefined()
  })

  it('mostra as gregas e a passagem do tempo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.getByText(/Gregas da posição \(hoje\)/)).toBeDefined()
    fireEvent.change(screen.getByLabelText(/Passagem do tempo/), { target: { value: '10' } })
    expect(screen.getByText(/Gregas da posição \(daqui a 10 dias úteis\)/)).toBeDefined()
  })
})

describe('SimuleOpcoes: manejo (cenários, desmontagem e rolagem)', () => {
  const abrirEstrategias = () => fireEvent.click(screen.getByRole('tab', { name: /Estratégias/ }))
  const celulas = (linha: HTMLElement) => within(linha).getAllByRole('cell').map((c) => (c.textContent ?? '').replace(/ /g, ' '))

  it('mostra o resultado da estrutura no primeiro vencimento para variações do ativo e quais vendidas seriam exercidas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias() // trava de alta: compra K60 a 2,80 e vende K65 a 0,90
    const linhas = within(screen.getByTestId('cenarios')).getAllByRole('row').slice(1)
    expect(linhas).toHaveLength(5)
    const parado = celulas(linhas[2])
    expect(parado[0]).toBe('Parado')
    expect(parado[2]).toBe('−R$ 190,00')
    expect(celulas(linhas[0])[2]).toBe('−R$ 190,00') // caiu 10%: perde o débito
    const alta = celulas(linhas[4])
    expect(alta[2]).toBe('R$ 310,00') // subiu 10%: ganho máximo
    expect(alta[3]).toBe('PETRK650') // a vendida (K65) fica dentro do dinheiro
    expect(celulas(linhas[3])[3]).toBe('—') // +5% = 63: nenhuma vendida dentro do dinheiro
  })

  it('o resultado de desmontar muda com o cenário escolhido', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: '+10%' }))
    expect((screen.getByLabelText('Preço do ativo no cenário') as HTMLInputElement).value).toBe('66,00')
    expect(txt('desmontar-total')).not.toMatch(/^−/) // alta de 10%: a trava de alta está no lucro
    fireEvent.click(screen.getAllByRole('button', { name: /10%$/ })[0]) // o primeiro atalho é a queda de 10%
    expect(txt('desmontar-total')).toMatch(/^−/)
  })

  it('rolar uma perna leva para o vencimento seguinte, no strike mais perto, e mostra a posição que sobra', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    expect(screen.queryByTestId('resultado-rolagem')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: /Rolar PETRK600/ }))
    expect((screen.getByLabelText('Novo vencimento de PETRK600') as HTMLSelectElement).value).toBe('2026-12-18')
    expect((screen.getByLabelText('Nova série de PETRK600') as HTMLSelectElement).value).toBe('PETRL600')
    expect(screen.getByTestId('resultado-rolagem').textContent).toMatch(/PETRK600 → PETRL600/)
    // a posição depois da rolagem tem o próprio painel de resultado, sem repetir os identificadores do primeiro
    expect(screen.getByTestId('ganho-maximo-rolagem')).toBeDefined()
    expect(screen.getByTestId('ganho-maximo')).toBeDefined()
    expect(screen.getByTestId('aviso-estimativa-rolagem')).toBeDefined() // vencimentos diferentes depois da rolagem
  })

  it('rolar uma perna comprada com débito avisa que se está pagando para adiar', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('checkbox', { name: /Rolar PETRK600/ })) // call comprada: vende a de novembro e compra a de dezembro
    expect(screen.getByTestId('aviso-rolagem-debito')).toBeDefined()
  })

  it('desmarcar a perna desfaz a rolagem', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    const caixa = screen.getByRole('checkbox', { name: /Rolar PETRK600/ })
    fireEvent.click(caixa)
    expect(screen.getByTestId('resultado-rolagem')).toBeDefined()
    fireEvent.click(caixa)
    expect(screen.queryByTestId('resultado-rolagem')).toBeNull()
  })

  it('perna sem vencimento posterior com séries do mesmo tipo não pode ser rolada', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: 'Straddle comprado' }))
    expect(screen.getByRole('checkbox', { name: /Rolar PETRW600/ }).hasAttribute('disabled')).toBe(true) // não há put em dezembro
    expect(screen.getByRole('checkbox', { name: /Rolar PETRK600/ }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByText(/Não há vencimento posterior/)).toBeDefined()
  })

  it('mostra o que costuma ser feito conforme as pernas vendidas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirEstrategias()
    fireEvent.click(screen.getByRole('button', { name: 'Venda coberta' }))
    expect(screen.getByText(/Se o ativo subir acima do strike da call vendida \(coberta\)/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Straddle vendido' }))
    expect(screen.getByText('Se o ativo cair abaixo do strike da put vendida')).toBeDefined()
    expect(screen.getByText('Se o ativo subir acima do strike da call vendida')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Straddle comprado' }))
    expect(screen.getByText('Estrutura só comprada')).toBeDefined()
    expect(screen.getByText('Antes de montar')).toBeDefined()
  })
})

describe('SimuleOpcoes: preço do ativo, vencimentos, strike e voltar', () => {
  // 23/10/2026 é uma sexta comum (semanal); 20/11 é feriado, então o mensal de novembro é quinta, 19/11; 18/12 é a terceira sexta.
  const semanal: SnapshotOpcoes = {
    geradoEm: null,
    dataPregao: '2026-10-16',
    ativos: [{
      ticker: 'ZZZZ4', nome: 'EMPRESA ZZZ', cotacao: 10, dataCotacao: '2026-10-16', variacao: -2.85, volumeOpcoes: 1, lote: 100,
      series: [
        serie('ZZZZJ100', 'call', 10, '2026-10-23', 0.5),
        serie('ZZZZK100', 'call', 10, '2026-11-19', 1.2),
        serie('ZZZZL100', 'call', 10, '2026-12-18', 1.8),
        serie('ZZZZH999', 'call', 10, '2027-04-16', 2.5), // exatamente 6 meses depois: ainda entra
        serie('ZZZZX999', 'call', 10, '2027-04-23', 2.6), // passou de 6 meses: fora
      ],
    }],
  }

  it('mostra o preço do ativo no mercado à vista, a variação do dia e a data do fechamento', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    expect(txt('preco-ativo')).toBe('R$ 60,00')
    expect(txt('variacao-ativo')).toBe('+1,69%')
    expect(screen.getByText(/PETROBRAS, preço à vista, fechamento de 16\/10\/2026/)).toBeDefined()
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'vale' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    expect(txt('preco-ativo')).toBe('R$ 66,00') // VALE3, sem variação informada
    expect(screen.queryByTestId('variacao-ativo')).toBeNull()
  })

  it('só mostra vencimentos dos próximos 6 meses', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    expect(codigos()).not.toContain('PETRZ600')
    expect(screen.getByText('5 séries de PETR4, de um total de 5')).toBeDefined()
  })

  it('separa vencimentos mensais e semanais e permite escolher só um tipo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={semanal} />)
    const mensais = screen.getByRole('group', { name: 'Vencimentos mensais' })
    const semanais = screen.getByRole('group', { name: 'Vencimentos semanais' })
    expect(within(mensais).getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual([
      '19/11/2026 (22 d.u.)', '18/12/2026 (42 d.u.)', '16/04/2027 (120 d.u.)',
    ])
    expect(within(semanais).getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.queryByText(/23\/04\/2027/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Só mensais' }))
    expect(codigos().sort()).toEqual(['ZZZZH999', 'ZZZZK100', 'ZZZZL100'])
    fireEvent.click(screen.getByRole('button', { name: 'Só semanais' }))
    expect(codigos()).toEqual(['ZZZZJ100'])
  })

  it('o campo de strike aceita digitar vários números seguidos sem perder o foco', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    const campo = screen.getByLabelText('Strike mínimo')
    campo.focus()
    fireEvent.change(campo, { target: { value: '5' } })
    expect(screen.getByLabelText('Strike mínimo')).toBe(campo) // não foi recriado
    expect(document.activeElement).toBe(campo)
    fireEvent.change(campo, { target: { value: '58' } })
    expect(screen.getByLabelText('Strike mínimo')).toBe(campo)
    expect((campo as HTMLInputElement).value).toBe('58')
    expect(screen.getByText('4 séries de PETR4, de um total de 5')).toBeDefined() // filtro vale enquanto digita
    fireEvent.change(campo, { target: { value: '58,5' } })
    expect((campo as HTMLInputElement).value).toBe('58,5')
  })

  it('o atalho de strike preenche os campos quando eles não estão em foco', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±10%)' }))
    expect((screen.getByLabelText('Strike mínimo') as HTMLInputElement).value).toBe('54,00')
    expect((screen.getByLabelText('Strike máximo') as HTMLInputElement).value).toBe('66,00')
  })

  it('"Voltar" do navegador a partir das estratégias leva às séries, e não para fora da tela', async () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('tab', { name: /Estratégias/ }))
    expect(screen.getByTestId('monte-estrategia')).toBeDefined()
    expect(window.history.state).toEqual({ opcoesAba: 'estrategias' })
    window.history.back()
    await waitFor(() => expect(screen.getByText(/séries de PETR4, de um total de/)).toBeDefined())
    expect(screen.queryByTestId('monte-estrategia')).toBeNull()
  })

  it('as estratégias partem do preço do ativo que estava na tabela', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'vale' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('tab', { name: /Estratégias/ }))
    expect(txt('preco-ativo')).toBe('R$ 66,00')
    expect((screen.getByLabelText('Preço do ativo hoje') as HTMLInputElement).value).toBe('66,00')
  })
})

describe('SimuleOpcoes: controle deslizante de strike', () => {
  // Strikes de PETR4 na janela de 6 meses: 55, 60, 65.
  const mover = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
  const valorCampo = (rotulo: string) => (screen.getByLabelText(rotulo) as HTMLInputElement).value

  it('começa com as alças nas pontas (sem limite) e cada passo anda de um strike para o próximo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    const menor = screen.getByLabelText('Strike mínimo (controle deslizante)') as HTMLInputElement
    const maior = screen.getByLabelText('Strike máximo (controle deslizante)') as HTMLInputElement
    expect([menor.min, menor.max, menor.value]).toEqual(['0', '2', '0'])
    expect([maior.min, maior.max, maior.value]).toEqual(['0', '2', '2'])
    expect(menor.getAttribute('aria-valuetext')).toBe('R$ 55,00')
    expect(maior.getAttribute('aria-valuetext')).toBe('R$ 65,00')
  })

  it('arrastar a alça de baixo filtra a tabela e preenche o campo de digitar', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    mover('Strike mínimo (controle deslizante)', '1') // 60
    expect(valorCampo('Strike mínimo')).toBe('60,00')
    expect(codigos()).not.toContain('PETRK550')
    expect(codigos()).toContain('PETRK650')
    mover('Strike máximo (controle deslizante)', '1') // 60
    expect(valorCampo('Strike máximo')).toBe('60,00')
    expect(codigos().sort()).toEqual(['PETRK600', 'PETRL600', 'PETRW600'])
  })

  it('as alças não se cruzam e voltar para a ponta tira o limite', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    mover('Strike máximo (controle deslizante)', '1') // 60
    mover('Strike mínimo (controle deslizante)', '2') // passaria do máximo: fica em 60
    expect(valorCampo('Strike mínimo')).toBe('60,00')
    mover('Strike mínimo (controle deslizante)', '0')
    mover('Strike máximo (controle deslizante)', '2')
    expect(valorCampo('Strike mínimo')).toBe('')
    expect(valorCampo('Strike máximo')).toBe('')
    expect(linhas()).toHaveLength(5)
  })

  it('o valor digitado e o atalho movem as alças', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    todosVencimentos()
    digitar('Strike mínimo', '65')
    expect((screen.getByLabelText('Strike mínimo (controle deslizante)') as HTMLInputElement).value).toBe('2')
    fireEvent.click(screen.getByRole('button', { name: 'Perto do preço (±10%)' })) // 54 a 66
    expect((screen.getByLabelText('Strike mínimo (controle deslizante)') as HTMLInputElement).value).toBe('0')
    expect((screen.getByLabelText('Strike máximo (controle deslizante)') as HTMLInputElement).value).toBe('2')
  })

  it('com um strike só, o controle não aparece', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'vale' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    expect(screen.queryByLabelText('Strike mínimo (controle deslizante)')).toBeNull()
  })
})
