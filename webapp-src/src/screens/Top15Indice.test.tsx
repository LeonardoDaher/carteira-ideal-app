import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TEXTOS_INDICE, Top15Indice, formatarPeso } from './Top15Indice'
import type { ClasseIndice } from './Top15Indice'
import { SimuleFii } from './SimuleFii'
import { SimuleAcoes } from './SimuleAcoes'
import type { ItemIndice, SnapshotIndice } from '../domain/top15Mercado'
import type { AppCtx } from '../state/useAppState'

const item = (ticker: string, posicao: number, peso: number, pesoAcumulado: number, o: Partial<ItemIndice> = {}): ItemIndice => ({
  posicao, ticker, nome: `Nome ${ticker}`, tipo: 'ON', setor: 'Bancos', peso, pesoAcumulado, quantidadeTeorica: 4_043_349_180,
  cotacao: 48.49, dataCotacao: '2026-10-07', volumeMediano: 25_696_937, ...o,
})

const snapshot = (indice: string, o: Partial<SnapshotIndice> = {}): SnapshotIndice => ({
  publicado: true, acessoRestrito: false, versaoMetodologia: '1.0.0', geradoEm: '2026-10-08T12:00:00Z', dataExecucao: '2026-10-08', ultimoPregao: '2026-10-08', pastaAuditoria: 'auditoria/top15-x/2026-10-08',
  hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64), tamanhoDaLista: 2, universo: 76, elegiveis: 76, aviso: null,
  indice, dataComposicao: '2026-10-08', somaPesos: 100, somaPesosDaLista: 18.014,
  parametros: { tamanhoDaLista: 15, janelaLiquidez: 21, idadeMaximaDias: 10 },
  ranking: [item('AAAA3', 1, 9.158, 9.158), item('BBBB3', 2, 8.856, 18.014, { setor: null, volumeMediano: null, cotacao: null, dataCotacao: null, quantidadeTeorica: null }), item('CCCC3', 3, 8.372, 26.386)],
  ...o,
})

describe.each(['ifix', 'ibov'] as ClasseIndice[])('Top15Indice (%s): maiores pesos da carteira oficial da B3', (classe) => {
  const t = TEXTOS_INDICE[classe]
  const snap = () => snapshot(t.indice)

  it('sem aprovação ou sem lista mostra "em validação" e nenhum ativo', () => {
    const { unmount } = render(<Top15Indice classe={classe} snapshot={snapshot(t.indice, { publicado: false, ranking: [] })} />)
    expect(screen.getByTestId(`${t.id}-validacao`).textContent).toContain('em validação')
    expect(screen.queryByTestId(t.id)).toBeNull()
    unmount()
    render(<Top15Indice classe={classe} snapshot={snapshot(t.indice, { ranking: [] })} />)
    expect(screen.getByTestId(`${t.id}-validacao`)).toBeTruthy()
  })

  it('lista só o tamanho pedido, na ordem do arquivo, com peso, peso acumulado e volume', () => {
    render(<Top15Indice classe={classe} snapshot={snap()} />)
    const ids = screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter((x) => x?.startsWith(`${t.id}-`) && !x.endsWith('-soma'))
    expect(ids).toEqual([`${t.id}-AAAA3`, `${t.id}-BBBB3`])
    expect(screen.queryByTestId(`${t.id}-CCCC3`)).toBeNull()
    const c = within(screen.getByTestId(`${t.id}-AAAA3`))
    expect(c.getByText(/1\. AAAA3/)).toBeTruthy()
    expect(c.getByTestId('peso-AAAA3').textContent).toBe('9,16%')
    expect(c.getByText('9,16%', { selector: '[data-testid="peso-AAAA3"]' })).toBeTruthy()
    expect(c.getByText('R$ 25,7 mi')).toBeTruthy()
    expect(c.getByText('R$ 48,49')).toBeTruthy()
    expect(c.getByText(/Quantidade teórica na carteira: 4\.043\.349\.180 · tipo ON/)).toBeTruthy()
    expect(within(screen.getByTestId(`${t.id}-BBBB3`)).getByTestId('peso-BBBB3').textContent).toBe('8,86%')
  })

  it('dado de mercado ausente aparece como traço, sem quebrar', () => {
    render(<Top15Indice classe={classe} snapshot={snap()} />)
    const b = within(screen.getByTestId(`${t.id}-BBBB3`))
    expect(b.getAllByText('—')).toHaveLength(2) // cotação e volume
    expect(b.getByText('fech. —')).toBeTruthy()
    expect(b.getByText(/Quantidade teórica na carteira: —/)).toBeTruthy()
  })

  it('título, data da carteira, soma dos pesos da lista e a frase "peso grande não quer dizer melhor"', () => {
    render(<Top15Indice classe={classe} snapshot={snap()} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(t.tituloTop(2))
    const texto = screen.getByTestId(t.id).textContent ?? ''
    expect(texto).toContain('08/10/2026')
    expect(texto).toContain(`o índice tem 76 ativos; estes 2 somam 18,0% dele`)
    expect(screen.getByTestId(`${t.id}-soma`).textContent).toBe('18,0%')
    expect(texto).toMatch(/Peso grande quer dizer (fundo|empresa) grande e líquid[oa] dentro do índice/)
    expect(texto).toContain('não que')
  })

  it('"como a lista é feita": fonte oficial, ordenação, limite de idade do arquivo e o que NÃO mede', () => {
    render(<Top15Indice classe={classe} snapshot={snap()} />)
    const ol = screen.getByText(/De onde vem\./).closest('ol')?.textContent ?? ''
    expect(ol).toContain(`carteira teórica do ${t.indice} que a B3 publica`)
    expect(ol).toContain(`O peso de cada ${t.singular} é o que a B3 informa`)
    expect(ol).toContain('mediana do volume diário dos últimos 21 pregões')
    expect(ol).toContain('com mais de 10 dias de idade')
    expect(ol).toContain(t.naoMede)
  })

  it('auditoria e aviso: comando de verificação, impressões digitais e aviso do arquivo ou o padrão', () => {
    const { unmount } = render(<Top15Indice classe={classe} snapshot={snapshot(t.indice, { aviso: 'Não é recomendação de investimento. Texto do arquivo.' })} />)
    expect(screen.getByText(/node scripts\/top15-mercado-verificar\.mjs auditoria\/top15-x\/2026-10-08/)).toBeTruthy()
    expect(screen.getByText('aaaaaaaaaaaaaaaa…')).toBeTruthy()
    expect(screen.getByTestId(`${t.id}-aviso`).textContent).toBe('Não é recomendação de investimento. Texto do arquivo.')
    unmount()
    render(<Top15Indice classe={classe} snapshot={snap()} />)
    expect(screen.getByTestId(`${t.id}-aviso`).textContent).toContain('composição oficial')
    expect(screen.getByTestId(`${t.id}-aviso`).textContent).toContain('Não é recomendação de investimento.')
  })
})

describe('Top15Indice: textos e formatação', () => {
  it('formatarPeso: duas casas por padrão, traço quando não existe', () => {
    expect(formatarPeso(9.158)).toBe('9,16%')
    expect(formatarPeso(100, 1)).toBe('100,0%')
    expect(formatarPeso(0.045)).toBe('0,05%')
    expect(formatarPeso(null)).toBe('—')
    expect(formatarPeso(undefined)).toBe('—')
    expect(formatarPeso(Number.NaN)).toBe('—')
  })
  it('cada índice tem seu prefixo e não colide com os outros rankings', () => {
    expect(TEXTOS_INDICE.ifix.id).toBe('top15-ifix')
    expect(TEXTOS_INDICE.ibov.id).toBe('top15-ibov')
    expect(TEXTOS_INDICE.ibov.topo('08/10/2026')).toContain('PETR3 e PETR4')
    expect(TEXTOS_INDICE.ifix.tituloTop(15)).toBe('Os 15 maiores pesos do IFIX')
  })
})

describe('abas "Top 15 do IFIX" e "Top 15 do Ibovespa"', () => {
  const ctx = { screen: 'x', setScreen: vi.fn() } as unknown as AppCtx

  it('Simule FII: cinco abas; a do IFIX abre o ranking do índice e não o dos mais negociados', () => {
    render(<SimuleFii ctx={ctx} snapshot={{ geradoEm: null, vigenciaIfix: null, fundos: [] } as never} />)
    expect(within(screen.getByRole('tablist', { name: 'O que você quer ver' })).getAllByRole('tab')).toHaveLength(5)
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 do IFIX/ }))
    expect(screen.getByRole('tab', { name: /Top 15 do IFIX/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('top15-ifix-validacao') ?? screen.queryByTestId('top15-ifix')).toBeTruthy()
    expect(screen.queryByTestId('top15-fiis-negociados-validacao')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.getByText('Os dados deste mês ainda não foram carregados.')).toBeTruthy()
  })

  it('Simule Ações: no cartão Top 15, a do Ibovespa abre o ranking do índice', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, fonte: null, cadastroId: null, pregoesNoHistorico: 0, sessoesLiquidez: 21, totais: { setores: 0, empresas: 0 }, gruposOrdem: [], setores: [], busca: [] } as never} />)
    expect(within(screen.getByRole('tablist', { name: 'O que você quer ver' })).getAllByRole('tab')).toHaveLength(6)
    fireEvent.click(screen.getByRole('tab', { name: /Rankings e triagens/ }))
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 do Ibovespa/ }))
    expect(screen.getByRole('tab', { name: /Top 15 do Ibovespa/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('top15-ibov-validacao') ?? screen.queryByTestId('top15-ibov')).toBeTruthy()
    expect(screen.queryByTestId('top15-acoes-negociadas-validacao')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais negociadas/ }))
    expect(screen.queryByTestId('top15-ibov-validacao') ?? screen.queryByTestId('top15-ibov')).toBeNull()
  })
})
