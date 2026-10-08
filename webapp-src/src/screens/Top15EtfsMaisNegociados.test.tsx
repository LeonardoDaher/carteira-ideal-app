import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Top15EtfsMaisNegociados } from './Top15EtfsMaisNegociados'
import { SimuleEtf } from './SimuleEtf'
import type { ItemEtfTop, SnapshotEtfsMaisNegociados } from '../domain/top15Mercado'
import type { AppCtx } from '../state/useAppState'

const item = (ticker: string, posicaoGeral: number, o: Partial<ItemEtfTop> = {}): ItemEtfTop => ({
  ticker, nome: `Fundo ${ticker}`, categoria: 'Bolsa brasileira', volumeMediano: 644_000_000 / posicaoGeral, volumeMedio: 700_000_000 / posicaoGeral, diasNegociados: 21,
  cotacao: 204.35, dataCotacao: '2026-10-05', variacao3m: 20.9, posicaoGeral, ...o,
})

const snapshot = (o: Partial<SnapshotEtfsMaisNegociados> = {}): SnapshotEtfsMaisNegociados => ({
  publicado: true, versaoMetodologia: '1.0.0', geradoEm: '2026-10-08T12:00:00Z', dataExecucao: '2026-10-08', ultimoPregao: '2026-10-05', pastaAuditoria: 'auditoria/top15-etfs/2026-10-08',
  hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64), tamanhoDaLista: 3, universo: 234, elegiveis: 80, aviso: null,
  parametros: { tamanhoPorCategoria: 5, janelaLiquidez: 21, janela3Meses: 63, volumeMinimoDiario: 500_000, diasNegociadosMinimos: 15, pregoesMaxSemNegocio: 5 },
  geral: [item('BOVA11', 1), item('SMAL11', 2), item('LFTB11', 3, { categoria: 'Renda fixa', variacao3m: -1.2, diasNegociados: 19 }), item('IVVB11', 4, { categoria: 'Bolsa exterior' })],
  porCategoria: {
    'Bolsa brasileira': [item('BOVA11', 1, { posicaoNaCategoria: 1 }), item('SMAL11', 2, { posicaoNaCategoria: 2 })],
    'Renda fixa': [item('LFTB11', 3, { categoria: 'Renda fixa', posicaoNaCategoria: 1 })],
  },
  exclusoes: [
    { ticker: 'HASH11', nome: 'Hashdex Nasdaq Crypto', categoria: 'Cripto', codigo: 'liquidez_baixa', motivo: 'Volume mediano de R$ 120.000 por dia (mínimo 500.000).' },
    { ticker: 'FNAM11', nome: 'FINAM', codigo: 'excluido_manual', motivo: 'ETF fora da lista por decisão registrada em config/etfs.json.' },
  ],
  ...o,
})

describe('Top15EtfsMaisNegociados', () => {
  it('sem aprovação (publicado=false) ou sem lista mostra "em validação" e nenhum ETF', () => {
    const { unmount } = render(<Top15EtfsMaisNegociados snapshot={snapshot({ publicado: false, geral: [], porCategoria: {}, exclusoes: [] })} />)
    expect(screen.getByTestId('top15-etfs-validacao').textContent).toContain('em validação')
    expect(screen.queryByTestId('top15-etfs')).toBeNull()
    unmount()
    render(<Top15EtfsMaisNegociados snapshot={snapshot({ geral: [] })} />)
    expect(screen.getByTestId('top15-etfs-validacao')).toBeTruthy()
  })

  it('lista só o tamanho pedido, na ordem do ranking, com volume por dia, dias negociados e variação', () => {
    render(<Top15EtfsMaisNegociados snapshot={snapshot()} />)
    const itens = screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter((t) => t?.startsWith('top15-etfs-'))
    expect(itens).toEqual(['top15-etfs-BOVA11', 'top15-etfs-SMAL11', 'top15-etfs-LFTB11'])
    expect(screen.queryByTestId('top15-etfs-IVVB11')).toBeNull()
    const primeiro = within(screen.getByTestId('top15-etfs-BOVA11'))
    expect(primeiro.getByText(/1\. BOVA11/)).toBeTruthy()
    expect(primeiro.getByText('R$ 644,0 mi')).toBeTruthy()
    expect(primeiro.getByText('21 de 21 pregões')).toBeTruthy()
    expect(primeiro.getByText('+20,9%')).toBeTruthy()
    const terceiro = within(screen.getByTestId('top15-etfs-LFTB11'))
    expect(terceiro.getByText('19 de 21 pregões')).toBeTruthy()
    expect(terceiro.getByText('−1,2%')).toBeTruthy()
  })

  it('diz no topo que é liquidez e não qualidade, preço baixo nem segurança', () => {
    render(<Top15EtfsMaisNegociados snapshot={snapshot()} />)
    const t = screen.getByTestId('top15-etfs').textContent ?? ''
    expect(t).toContain('liquidez')
    expect(t).toContain('Mais negociado não quer dizer melhor, mais barato nem mais seguro')
  })

  it('mais negociados de cada categoria, com a posição dentro da categoria', () => {
    render(<Top15EtfsMaisNegociados snapshot={snapshot()} />)
    const caixa = within(screen.getByTestId('top15-etfs-categorias'))
    expect(caixa.getByTestId('categoria-Bolsa brasileira-SMAL11').textContent).toContain('2. SMAL11')
    expect(caixa.getByTestId('categoria-Renda fixa-LFTB11').textContent).toContain('1. LFTB11')
  })

  it('"Por que um ETF ficou de fora?": busca por código e nome, mensagem sem resultado e contagem por motivo', () => {
    render(<Top15EtfsMaisNegociados snapshot={snapshot()} />)
    const busca = screen.getByLabelText('Buscar ETF fora do ranking')
    fireEvent.change(busca, { target: { value: 'hash' } })
    expect(screen.getByText(/Volume mediano de R\$ 120\.000 por dia/)).toBeTruthy()
    fireEvent.change(busca, { target: { value: 'finam' } })
    expect(screen.getByText(/ETF fora da lista por decisão registrada em config\/etfs\.json/)).toBeTruthy()
    fireEvent.change(busca, { target: { value: 'zzzz' } })
    expect(screen.getByText(/Nenhum ETF fora do ranking com esse código ou nome/)).toBeTruthy()
    expect(screen.getByText('Pouca liquidez')).toBeTruthy()
    expect(screen.getByText('Fora por decisão registrada (não é fundo de índice comum)')).toBeTruthy()
  })

  it('como a lista é feita usa os parâmetros do próprio arquivo e avisa o que o ranking NÃO mede', () => {
    render(<Top15EtfsMaisNegociados snapshot={snapshot()} />)
    const t = screen.getByText(/Volume por dia\./).closest('ol')?.textContent ?? ''
    expect(t).toContain('R$ 500 mil')
    expect(t).toContain('pelo menos 15 dos 21 pregões')
    expect(t).toContain('no máximo 5 pregões')
    expect(t).toContain('Não mede taxa de administração')
  })

  it('auditoria: pasta, comando para refazer o cálculo e impressões digitais', () => {
    render(<Top15EtfsMaisNegociados snapshot={snapshot()} />)
    expect(screen.getByText(/node scripts\/top15-mercado-verificar\.mjs auditoria\/top15-etfs\/2026-10-08/)).toBeTruthy()
    expect(screen.getByText('aaaaaaaaaaaaaaaa…')).toBeTruthy()
    expect(screen.getByText('bbbbbbbbbbbbbbbb…')).toBeTruthy()
  })

  it('aviso: usa o texto do arquivo e, se não houver, o padrão; nos dois diz que não é recomendação', () => {
    const { unmount } = render(<Top15EtfsMaisNegociados snapshot={snapshot({ aviso: 'Não é recomendação de investimento. Texto do arquivo.' })} />)
    expect(screen.getByTestId('top15-etfs-aviso').textContent).toBe('Não é recomendação de investimento. Texto do arquivo.')
    unmount()
    render(<Top15EtfsMaisNegociados snapshot={snapshot()} />)
    expect(screen.getByTestId('top15-etfs-aviso').textContent).toContain('Não é recomendação de investimento.')
    expect(screen.getByTestId('top15-etfs-aviso').textContent).toContain('é liquidez')
  })
})

describe('Top15EtfsMaisNegociados dentro do Simule ETF', () => {
  const ctx = { screen: 'simuleEtf', setScreen: vi.fn() } as unknown as AppCtx
  const vazio = { geradoEm: null, dataPregao: null, fonte: null, pregoesNoHistorico: 0, sessoesLiquidez: 21, criterio: null, ordemCategorias: [], etfs: [], busca: [] }

  it('abre no simulador; a segunda aba leva ao Top 15 e dá para voltar', () => {
    render(<SimuleEtf ctx={ctx} snapshot={vazio as never} />)
    expect(screen.getByRole('tab', { name: /Simulador/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Os dados dos ETFs ainda não foram carregados.')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais negociados/ }))
    expect(screen.getByRole('tab', { name: /Top 15 mais negociados/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('Os dados dos ETFs ainda não foram carregados.')).toBeNull()
    // com o arquivo ainda sem publicação, a aba mostra o texto de validação (ou a lista, se já publicado)
    expect(screen.queryByTestId('top15-etfs-validacao') ?? screen.queryByTestId('top15-etfs')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.getByText('Os dados dos ETFs ainda não foram carregados.')).toBeTruthy()
  })
})
