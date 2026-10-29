import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleFii } from './SimuleFii'
import { SimuleBdr } from './SimuleBdr'
import { SimuleEtf } from './SimuleEtf'
import type { DestaquesDoAtivo, IndiceDeDestaques } from '../domain/destaquesRadares'
import { RadaresDosExemplos, codigosDoTexto } from '../ui/DestaquesDoAtivo'
import type { AppCtx } from '../state/useAppState'

const ctx = { screen: 'x', setScreen: vi.fn() } as unknown as AppCtx

/** Devolve os mesmos destaques para qualquer código: basta para ver se a tela os mostra. */
class ParaTodos extends Map<string, DestaquesDoAtivo> {
  d: DestaquesDoAtivo
  constructor(d: DestaquesDoAtivo) {
    super()
    this.d = d
  }
  override get() { return this.d }
}
const todos = (d: DestaquesDoAtivo): IndiceDeDestaques => new ParaTodos(d)

const liquidez = { maisNegociado: { posicao: 2 }, naCategoria: { posicao: 1, categoria: 'Categoria Teste' } }

describe('destaques dos radares em FII, BDR e ETF (D131)', () => {
  it('FII: resumo por grupo e o peso no IFIX no cartão', () => {
    render(<SimuleFii ctx={ctx} destaques={todos({ ...liquidez, indice: { nome: 'IFIX', posicao: 4, peso: 3.21 } })} />)
    expect(screen.queryAllByTestId('selos')).toHaveLength(0)
    expect(screen.getAllByTestId('resumo-setor')[0].textContent).toContain('🏛️')
    expect(screen.getAllByTestId('resumo-setor').length).toBeGreaterThan(0)
    const cartao = screen.getByTestId('nos-radares').textContent ?? ''
    expect(cartao).toContain('2º no Top 15 mais negociados')
    expect(cartao).toContain('4º maior peso do IFIX')
    expect(cartao).toContain('3,21%')
  })

  it('BDR: liquidez, sem selo de índice nem de dividendos', () => {
    render(<SimuleBdr ctx={ctx} destaques={todos({ ...liquidez, indice: { nome: 'IBOV', posicao: 1, peso: 9 } })} />)
    expect(screen.getAllByTestId('resumo-setor')[0].textContent).toContain('🔥')
    expect(screen.getByTestId('nos-radares').textContent).toContain('1º entre os mais negociados de Categoria Teste')
    expect(screen.getByTestId('nos-radares').textContent).not.toContain('maior peso')
  })

  it('ETF: sem destaque, o cartão explica; com destaque, mostra a posição', () => {
    const { unmount } = render(<SimuleEtf ctx={ctx} destaques={new Map()} />)
    expect(screen.queryAllByTestId('resumo-setor')).toHaveLength(0)
    expect(screen.getByTestId('nos-radares').textContent).toContain('não está no Top 15 mais negociados')
    unmount()
    render(<SimuleEtf ctx={ctx} destaques={todos(liquidez)} />)
    fireEvent.click(screen.getAllByRole('button', { pressed: false })[0])
    expect(screen.getByTestId('nos-radares').textContent).toContain('2º no Top 15 mais negociados')
  })
})

describe('radares nos exemplos da carteira de referência (D131)', () => {
  const indice: IndiceDeDestaques = new Map([
    ['PETR4', { dividendos: { posicao: 3, dy: 0.1234 }, indice: { nome: 'IBOV', posicao: 1, peso: 9.5 } }],
    ['KNCR11', { naCategoria: { posicao: 1, categoria: 'Papel (CRI)' } }],
  ])

  it('acha os códigos do texto, sem repetir', () => {
    expect(codigosDoTexto('VALE3 (Vale), PETR4 (Petrobras) e SUZB3; PETR4 lidera. BOVA11 e IVVB11.')).toEqual(['VALE3', 'PETR4', 'SUZB3', 'BOVA11', 'IVVB11'])
  })

  it('mostra só quem está nos radares', () => {
    render(<RadaresDosExemplos texto="VALE3, PETR4 e KNCR11 são exemplos" indice={indice} />)
    const t = screen.getByTestId('radares-dos-exemplos').textContent ?? ''
    expect(t).toContain('PETR4')
    expect(t).toContain('3º no Top 15 de dividendos')
    expect(t).toContain('12,3%')
    expect(t).toContain('1º maior peso do IBOV')
    expect(t).toContain('1º mais negociado de Papel (CRI)')
    expect(t).not.toContain('VALE3')
  })

  it('sem nenhum no radar, não desenha nada', () => {
    render(<RadaresDosExemplos texto="VALE3 e ITUB4" indice={indice} />)
    expect(screen.queryByTestId('radares-dos-exemplos')).toBeNull()
  })
})
