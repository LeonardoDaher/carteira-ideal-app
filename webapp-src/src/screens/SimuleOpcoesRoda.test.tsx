import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, ultimo: number): SerieOpcao => ({
  codigo, tipo, estilo: tipo === 'call' ? 'americana' : 'europeia', strike, vencimento, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 10, volume: 50_000,
})

// PETR4 a R$ 60: put de strike 60 a R$ 2,20 em 19/11 (22 dias úteis); calls de strike 60 e 66 em 18/12 (42 dias úteis).
const snapshot: SnapshotOpcoes = {
  geradoEm: '2026-10-17T15:00:00Z',
  dataPregao: '2026-10-16',
  fonte: 'Cadastro de instrumentos e COTAHIST da B3',
  ativos: [
    {
      ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, dataCotacao: '2026-10-16', variacao: 1.69, volumeOpcoes: 9_000_000, lote: 100,
      series: [
        serie('PETRW600', 'put', 60, '2026-11-19', 2.2),
        serie('PETRK600', 'call', 60, '2026-11-19', 2.8),
        serie('PETRL600', 'call', 60, '2026-12-18', 4.1),
        serie('PETRL660', 'call', 66, '2026-12-18', 1.6),
      ],
    },
    { ticker: 'VALE3', nome: 'VALE', cotacao: 66, volumeOpcoes: 5_000_000, lote: 100, series: [serie('VALEK660', 'call', 66, '2026-11-19', 3.3)] },
  ],
}

const txt = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/ /g, ' ')
const abrirRoda = () => fireEvent.click(screen.getByRole('tab', { name: /Roda/ }))

describe('SimuleOpcoes: aba Roda', () => {
  it('abre a roda com a explicação dos passos e o ativo escolhido', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    expect(screen.getByTestId('roda-intro').textContent).toMatch(/Passo 1.*vende uma put.*Passo 2.*call coberta/)
    expect(screen.getByTestId('preco-ativo')).toBeDefined()
    expect(screen.getByRole('button', { name: /19\/11\/2026 \(22 d\.u\., mensal\)/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('passo 1: caixa reservado, prêmio, rendimento e preço efetivo se for exercida', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    expect(txt('roda-caixa')).toBe('R$ 6.000,00') // strike 60 × 100
    expect(txt('roda-premio-put')).toBe('R$ 220,00')
    expect(txt('roda-rendimento-prazo')).toBe('3,67%')
    expect(txt('roda-rendimento-mes')).toBe('3,50%') // 3,67% × 21/22
    expect(txt('roda-se-exercida')).toMatch(/R\$ 57,80/)
    expect(txt('roda-se-exercida')).toMatch(/3,7% abaixo do preço de hoje/)
    expect(txt('roda-chance-put')).toMatch(/%$/)
  })

  it('a quantidade muda o caixa e o prêmio, e a série da put pode ser trocada', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    const campo = screen.getByLabelText('Quantidade (ações que compraria)')
    fireEvent.focus(campo)
    fireEvent.change(campo, { target: { value: '200' } })
    fireEvent.blur(campo)
    expect(txt('roda-caixa')).toBe('R$ 12.000,00')
    expect(txt('roda-premio-put')).toBe('R$ 440,00')
    expect((screen.getByLabelText('Série da put') as HTMLSelectElement).value).toBe('PETRW600')
  })

  it('passo 2: a call do vencimento seguinte, com prêmio estimado, giro completo e equilíbrio das ações', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    expect((screen.getByLabelText('Vencimento da call') as HTMLSelectElement).value).toBe('2026-12-18')
    expect((screen.getByLabelText('Série da call') as HTMLSelectElement).value).toBe('PETRL600') // primeiro strike a partir do strike da put (60)
    expect(txt('roda-premio-call')).toMatch(/^R\$/)
    expect(txt('roda-giro')).toMatch(/Ganho total do giro/)
    expect(txt('roda-equilibrio-acoes')).toMatch(/^R\$/)
    expect(screen.getByText(/uma estimativa/)).toBeDefined()
    expect(screen.queryByTestId('roda-aviso-call-baixa')).toBeNull()
  })

  it('o painel do passo 2 soma o prêmio da put já recebido e usa ações a partir do strike da put', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    expect(txt('realizado-roda2')).toMatch(/R\$ 220,00/)
    expect(screen.getByText(/As ações entram a R\$\s60,00/)).toBeDefined()
    expect(screen.getByTestId('ganho-maximo-roda2').textContent).not.toBe('Sem limite') // venda coberta: ganho limitado
    // os dois painéis convivem sem repetir identificadores
    expect(screen.getByTestId('ganho-maximo-roda1')).toBeDefined()
  })

  it('o giro completo acompanha a escolha da call: strike mais alto, mais ganho se a ação for vendida', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    const antes = txt('roda-giro')
    fireEvent.change(screen.getByLabelText('Série da call'), { target: { value: 'PETRL660' } })
    expect(txt('roda-giro')).not.toBe(antes)
    expect(txt('roda-giro')).toMatch(/R\$ [\d.]+,\d\d/)
  })

  it('avisa quando o strike da call fica abaixo do preço efetivo da ação', () => {
    const baixa: SnapshotOpcoes = {
      ...snapshot,
      ativos: [{ ...snapshot.ativos[0], series: [...snapshot.ativos[0].series, serie('PETRL550', 'call', 55, '2026-12-18', 6.5)] }, snapshot.ativos[1]],
    }
    render(<SimuleOpcoes ctx={ctx} snapshot={baixa} />)
    abrirRoda()
    fireEvent.change(screen.getByLabelText('Série da call'), { target: { value: 'PETRL550' } })
    expect(screen.getByTestId('roda-aviso-call-baixa').textContent).toMatch(/abaixo do preço efetivo/)
  })

  it('tem o manejo da put (cenários, desmontagem e rolagem) dentro de um bloco recolhível', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    const bloco = screen.getByTestId('roda-manejo')
    expect(bloco.tagName).toBe('DETAILS')
    expect(within(bloco).getByTestId('cenarios')).toBeDefined()
    expect(within(bloco).getByTestId('desmontar-total')).toBeDefined()
  })

  it('ativo sem puts explica que não dá para montar a roda', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'vale' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    expect(screen.getByText('Sem séries para a roda.')).toBeDefined()
  })

  it('o "voltar" do navegador sai da roda e volta às séries', async () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirRoda()
    expect(window.history.state).toEqual({ opcoesAba: 'roda' })
    window.history.back()
    await screen.findByText(/séries de PETR4, de um total de/)
    expect(screen.queryByTestId('roda-intro')).toBeNull()
  })
})
