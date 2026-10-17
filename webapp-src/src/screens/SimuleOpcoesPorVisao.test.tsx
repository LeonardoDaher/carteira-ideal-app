import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { AtivoComOpcoes, SerieOpcao, SnapshotOpcoes, TendenciaAtivo } from '../domain/opcoes'
import { precoBs } from '../domain/simulaOpcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const HOJE = '2026-10-16'
const r = Math.log(1.1375)

/** Série com o prêmio do modelo para a volatilidade de 40% (22 dias úteis até 19/11). */
const serie = (tipo: 'call' | 'put', strike: number, vencimento = '2026-11-19', spot = 10): SerieOpcao => ({
  codigo: `${tipo === 'call' ? 'C' : 'P'}${Math.round(strike * 100)}${vencimento === '2026-11-19' ? '' : 'S'}`,
  tipo, estilo: 'europeia', strike, vencimento,
  ultimo: Math.max(Math.round(precoBs({ tipo, s: spot, strike, t: (vencimento === '2026-11-19' ? 22 : 9) / 252, r, sigma: 0.4 }) * 100) / 100, 0.01),
  dataUltimo: HOJE, variacao: null, negocios: 50, volume: 100_000,
})
const strikes = Array.from({ length: 12 }, (_, i) => 7.5 + i * 0.5)
const mensal = strikes.flatMap((k) => [serie('call', k), serie('put', k)])

const tendenciaAlta: TendenciaAtivo = { data: HOJE, fechamento: 10, sma21: 9, sma63: 8, retorno21: 11, retorno63: 25, posicao52: 96, volRealizada21: 25, volRealizada63: 28 }
const tendenciaLateral: TendenciaAtivo = { data: HOJE, fechamento: 10, sma21: 10.1, sma63: 9.9, retorno21: 0, retorno63: 1, posicao52: 50, volRealizada21: 40, volRealizada63: 40 }

const ativo = (ticker: string, nome: string, series: SerieOpcao[], tendencia?: TendenciaAtivo, volumeOpcoes = 1): AtivoComOpcoes =>
  ({ ticker, nome, cotacao: 10, dataCotacao: HOJE, variacao: 0.5, volumeOpcoes, lote: 100, series, ...(tendencia ? { tendencia } : {}) })

const snapshot: SnapshotOpcoes = {
  geradoEm: null,
  dataPregao: HOJE,
  ativos: [
    // Dois vencimentos: o mensal de 19/11 e o semanal de 30/10 (9 dias úteis), este só com uma call.
    ativo('ALTA3', 'EMPRESA ALTA', [...mensal, serie('call', 10, '2026-10-30')], tendenciaAlta, 3),
    ativo('LATE3', 'EMPRESA LATERAL', mensal.map((s) => ({ ...s, codigo: `L${s.codigo}` })), tendenciaLateral, 2),
    ativo('SEMH3', 'EMPRESA SEM HISTORICO', mensal.map((s) => ({ ...s, codigo: `S${s.codigo}` })), undefined, 1),
  ],
}

const abrirVisao = () => fireEvent.click(screen.getByRole('tab', { name: /Por visão/ }))
const cartao = (id: string) => screen.getByTestId(`estrutura-${id}`)
const candidatas = (id: string) => within(cartao(id)).queryAllByTestId('candidata')
const celulas = (l: HTMLElement) => within(l).getAllByRole('cell').map((c) => (c.textContent ?? '').replace(/ /g, ' '))
/** Primeiro número de um texto como "−R$ 1.234,56" ou "37,5%". */
const numeroDe = (t: string) => Number(t.replace(/[^\d,−-]/g, '').replace('−', '-').replace(',', '.'))

describe('SimuleOpcoes: aba "Por visão"', () => {
  it('lê a tendência do ativo, sugere a visão e mostra as estruturas dela', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    expect(screen.getByText('Leitura de ALTA3: tendência de alta')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Alta' }).getAttribute('aria-pressed')).toBe('true')
    for (const id of ['compraCall', 'travaAltaDebito', 'travaAltaCredito', 'vendaPut']) expect(candidatas(id).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('estrutura-condorDeFerro')).toBeNull()
    expect(candidatas('travaAltaCredito').length).toBeLessThanOrEqual(3)
  })

  it('compara a volatilidade realizada com a implícita perto do preço e diz se as opções estão caras ou baratas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    const linha = screen.getByTestId('vol-ativo').textContent ?? ''
    expect(linha).toMatch(/realizada \(21 pregões\): 25,0%/)
    const implicita = Number(/implícita das opções perto do preço: (\d+,\d)%/.exec(linha)?.[1].replace(',', '.'))
    expect(implicita).toBeGreaterThan(35)
    expect(implicita).toBeLessThan(45)
    expect(linha).toMatch(/caras em relação ao que o ativo vem oscilando/)
  })

  it('trocar a visão troca as estruturas e avisa que difere da tendência lida', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    fireEvent.click(screen.getByRole('button', { name: 'Lateral' }))
    for (const id of ['condorDeFerro', 'borboleta', 'vendaCoberta']) expect(candidatas(id).length).toBeGreaterThan(0)
    expect(screen.queryByTestId('estrutura-compraCall')).toBeNull()
    expect(screen.getByText(/A tendência lida é de alta, mas você escolheu lateral/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Muita oscilação' }))
    for (const id of ['straddleComprado', 'strangleComprado']) expect(candidatas(id).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Baixa' }))
    for (const id of ['compraPut', 'travaBaixaDebito', 'travaBaixaCredito']) expect(candidatas(id).length).toBeGreaterThan(0)
  })

  it('mostra crédito ou débito, ganho, perda, equilíbrio e chance de lucro, e ordena pelo critério escolhido', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    const doCredito = candidatas('travaAltaCredito').map(celulas)
    expect(doCredito[0][1]).toMatch(/^Crédito R\$/)
    expect(candidatas('travaAltaDebito').map(celulas)[0][1]).toMatch(/^Débito R\$/)
    const chances = doCredito.map((c) => numeroDe(c[5]))
    expect([...chances].sort((a, b) => b - a)).toEqual(chances) // padrão: maior chance de lucro primeiro

    fireEvent.click(screen.getByRole('button', { name: 'Menor risco' }))
    const riscos = candidatas('travaAltaCredito').map((l) => Math.abs(numeroDe(celulas(l)[3])))
    expect([...riscos].sort((a, b) => a - b)).toEqual(riscos) // menor perda máxima primeiro
    fireEvent.click(screen.getByRole('button', { name: 'Maior retorno no cenário' }))
    const retornos = candidatas('travaAltaCredito').map((l) => numeroDe(celulas(l)[6]))
    expect([...retornos].sort((a, b) => b - a)).toEqual(retornos)
  })

  it('só oferece vencimentos com pelo menos 3 dias úteis, e avisa quando um vencimento não tem combinação', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    const vencimentos = within(screen.getByRole('group', { name: 'Vencimento das estruturas' })).getAllByRole('button')
    expect(vencimentos.map((b) => b.textContent)).toEqual(['30/10/2026 (9 d.u., semanal)', '19/11/2026 (22 d.u., mensal)'])
    expect(vencimentos[1].getAttribute('aria-pressed')).toBe('true') // padrão: o mensal com pelo menos 10 dias úteis
    fireEvent.click(vencimentos[0])
    expect(within(cartao('travaAltaDebito')).getByText(/Nenhuma combinação com séries negociadas/)).toBeDefined()
  })

  it('"Simular" numa trava leva ao simulador com as duas séries, uma comprada e outra vendida', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    const primeira = candidatas('travaAltaDebito')[0]
    fireEvent.click(within(primeira).getByRole('button', { name: /^Simular Compra C/ }))
    expect(screen.getByRole('button', { name: /Séries escolhidas \(2\)/ }).getAttribute('aria-pressed')).toBe('true')
    const grupos = screen.getAllByRole('group', { name: /^Série C/ })
    expect(grupos).toHaveLength(2)
    expect(within(grupos[0]).getByRole('button', { name: 'Comprar' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(grupos[1]).getByRole('button', { name: 'Vender' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('ganho-maximo').textContent).not.toBe('Sem limite') // trava: ganho limitado
  })

  it('a borboleta chega ao simulador vendendo o dobro da série do meio', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    fireEvent.click(screen.getByRole('button', { name: 'Lateral' }))
    fireEvent.click(within(candidatas('borboleta')[0]).getByRole('button', { name: /^Simular Compra C/ }))
    const grupos = screen.getAllByRole('group', { name: /^Série C/ })
    expect(grupos).toHaveLength(3)
    const quantidades = grupos.map((g) => (within(g).getByLabelText(/^Quantidade de/) as HTMLInputElement).value)
    expect(quantidades).toEqual(['100', '200', '100'])
    expect(within(grupos[1]).getByRole('button', { name: 'Vender' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('a venda coberta abre o simulador na estratégia "Venda coberta"', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    fireEvent.click(screen.getByRole('button', { name: 'Lateral' }))
    fireEvent.click(within(candidatas('vendaCoberta')[0]).getByRole('button', { name: /^Simular Tem a ação/ }))
    expect(screen.getByRole('button', { name: 'Venda coberta' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/Venda coberta com a série/)).toBeDefined()
  })

  it('ativo sem histórico suficiente não tem leitura de tendência, mas deixa escolher a visão', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'semh' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    expect(screen.getByText(/Sem histórico suficiente para ler a tendência/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Lateral' }).getAttribute('aria-pressed')).toBe('true')
    expect(candidatas('condorDeFerro').length).toBeGreaterThan(0)
  })

  it('trocar de ativo volta a visão para a que a tendência dele sugere', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    fireEvent.click(screen.getByRole('button', { name: 'Muita oscilação' }))
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'late' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    expect(screen.getByText('Leitura de LATE3: tendência de lateral')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Lateral' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('o ativo escolhido vale nas outras abas, e o "voltar" do navegador volta à aba Por visão', async () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'late' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('tab', { name: /Séries da B3/ }))
    await waitFor(() => expect(screen.getByTestId('preco-ativo')).toBeDefined())
    expect(screen.getByText(/LATE3, EMPRESA LATERAL|EMPRESA LATERAL/)).toBeDefined()

    fireEvent.click(screen.getByRole('tab', { name: /Por visão/ }))
    fireEvent.click(within(candidatas('condorDeFerro')[0]).getByRole('button', { name: /^Simular Compra/ }))
    expect(screen.getByTestId('ativo-estrategia')).toBeDefined()
    window.history.back()
    await waitFor(() => expect(screen.getByRole('group', { name: 'Visão de mercado' })).toBeDefined())
  })

  it('explica como as candidatas são montadas, sem chamar nenhuma de "melhor"', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirVisao()
    expect(screen.getByText('Como as candidatas são montadas e medidas')).toBeDefined()
    expect(screen.getByText(/nenhuma estrutura tem vantagem esperada/)).toBeDefined()
    expect(screen.getByText(/Como ler\./)).toBeDefined()
  })
})
