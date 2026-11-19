import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Top15Dividendos, formatarDy } from './Top15Dividendos'
import { SimuleAcoes } from './SimuleAcoes'
import { buscarSituacaoDividendos, contarExclusoesDividendos } from '../domain/acoesDividendos'
import type { ItemDividendos, SnapshotAcoesDividendos } from '../domain/acoesDividendos'
import type { AppCtx } from '../state/useAppState'

const item = (ticker: string, posicao: number, dy: number, o: Partial<ItemDividendos> = {}): ItemDividendos => ({
  posicao, ticker, nome: `Empresa ${ticker}`, setor: 'Energia elétrica', classe: 'ON', cotacao: 10, dataCotacao: '2026-10-22', dy,
  proventosPorAcao: dy * 10, dividendos: dy * 6, jcp: dy * 4, rendimentos: 0, pagamentos: 2, ultimaDataCom: '2026-08-21', primeiraDataCom: '2026-03-19',
  historicoParcial: false, ajustesAplicados: [], alertas: [],
  proventos: [
    { dataCom: '2026-08-21', tipo: 'DIVIDENDO', valor: dy * 6 },
    { dataCom: '2026-03-19', tipo: 'JRS CAP PROPRIO', valor: dy * 4 },
  ],
  ...o,
})

const snapshot = (o: Partial<SnapshotAcoesDividendos> = {}): SnapshotAcoesDividendos => ({
  publicado: true, versaoMetodologia: '1.0.0', geradoEm: '2026-10-25T07:00:00Z', dataExecucao: '2026-10-25', dataPrecos: '2026-10-22',
  pastaAuditoria: 'auditoria/acoes-dividendos/2026-10-25', hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64),
  tamanhoDaLista: 2, rankingAteOnde: 4, universo: 226, avaliadas: 118, aviso: null,
  parametros: { janelaDias: 365, janelaInicio: '2025-10-22', liquidezMinimaDiariaReais: 3_000_000, sessoesLiquidez: 21, alertaDyAcimaDe: 0.2 },
  contagens: { ranking: 4, exclusoes: 3 },
  etapas: [],
  ranking: [
    item('AAAA3', 1, 0.2771),
    item('BBBB3', 2, 0.1234, { ajustesAplicados: [{ data: '2026-04-29', fator: 5 }], rendimentos: 0.1 }),
    item('CCCC3', 3, 0.0925),
    item('DDDD3', 4, 0.05),
  ],
  exclusoes: [
    { ticker: 'ZZZZ3', nome: 'Zeta Varejo', setor: 'Varejo', etapa: 'proventos', codigo: 'sem_proventos', motivo: 'Nenhum provento em dinheiro com data com nos últimos 12 meses.' },
    { ticker: 'LIQU3', nome: 'Pouca Liquidez', setor: 'Varejo', etapa: 'liquidez', codigo: 'liquidez_baixa', motivo: 'Negocia em média R$ 100 por dia.' },
    { ticker: 'SEMP3', nome: 'Sem Preço', setor: 'Varejo', etapa: 'preco', codigo: 'sem_preco', motivo: 'Sem preço de fechamento no histórico da B3.' },
  ],
  ...o,
})

describe('Top15Dividendos', () => {
  it('sem aprovação ou sem lista mostra "em validação" e nenhuma ação', () => {
    const { unmount } = render(<Top15Dividendos snapshot={snapshot({ publicado: false, ranking: [], exclusoes: [] })} />)
    expect(screen.getByTestId('top15-dividendos-validacao').textContent).toContain('em validação')
    expect(screen.queryByTestId('top15-dividendos')).toBeNull()
    unmount()
    render(<Top15Dividendos snapshot={snapshot({ ranking: [] })} />)
    expect(screen.getByTestId('top15-dividendos-validacao')).toBeTruthy()
  })

  it('mostra só o tamanho pedido em cartões, na ordem, com yield, proventos por ação e número de pagamentos', () => {
    render(<Top15Dividendos snapshot={snapshot()} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('As 2 ações que mais pagaram dividendos')
    const cartoes = within(screen.getByRole('list', { name: 'Ações pagadoras de dividendos' })).getAllByRole('listitem').filter((l) => l.dataset.testid?.startsWith('top15-dividendos-'))
    expect(cartoes.map((l) => l.dataset.testid)).toEqual(['top15-dividendos-AAAA3', 'top15-dividendos-BBBB3'])
    const a = within(screen.getByTestId('top15-dividendos-AAAA3'))
    expect(a.getByText('1. AAAA3').style.color).toBe('var(--accent)')
    expect(a.getByText('R$ 10,00').style.color).toBe('var(--accent)')
    expect(a.getByText(/fech\. 22\/10\/2026/)).toBeTruthy()
    expect(screen.getByTestId('dy-AAAA3').textContent).toBe('27,7%')
    expect(screen.getByTestId('dy-BBBB3').textContent).toBe('12,3%')
    expect(a.getAllByText('R$ 2,771').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('top15-dividendos').textContent).toContain('Preços até 22/10/2026 · proventos com data com de 22/10/2025 a 22/10/2026 · metodologia v1.0.0 · 118 ações com proventos de 226 do cadastro')
  })

  it('"Ver mais" abre a continuação do ranking (16ª em diante), sem repetir o Top e com o provento de cada pagamento', () => {
    render(<Top15Dividendos snapshot={snapshot()} />)
    const caixa = screen.getByTestId('top15-dividendos-ver-mais')
    expect(caixa.textContent).toContain('Mais 2 ações no ranking, até a 4ª posição')
    expect(screen.queryByTestId('top15-dividendos-CCCC3')).toBeNull()
    fireEvent.click(within(caixa).getByRole('button', { name: 'Ver mais' }))
    expect(within(caixa).getByRole('button', { name: 'Mostrar menos' }).getAttribute('aria-expanded')).toBe('true')
    expect(caixa.textContent).toContain('Continuação do ranking: posições 3 a 4')
    expect(screen.getByTestId('top15-dividendos-CCCC3')).toBeTruthy()
    expect(screen.getByTestId('top15-dividendos-DDDD3')).toBeTruthy()
    expect(within(screen.getByTestId('top15-dividendos-CCCC3')).getByTestId('dy-CCCC3').textContent).toBe('9,3%')
    expect(within(screen.getByTestId('top15-dividendos-CCCC3')).getByTestId('proventos-CCCC3').textContent).toContain('21/08/2026')
    fireEvent.click(within(caixa).getByRole('button', { name: 'Mostrar menos' }))
    expect(screen.queryByTestId('top15-dividendos-CCCC3')).toBeNull()
  })

  it('sem nada além do Top, o card "Ver mais" não aparece', () => {
    render(<Top15Dividendos snapshot={snapshot({ tamanhoDaLista: 4 })} />)
    expect(screen.queryByTestId('top15-dividendos-ver-mais')).toBeNull()
  })

  it('"Cada provento que entrou na soma" lista data com, tipo e valor, e fecha a conta do yield', () => {
    render(<Top15Dividendos snapshot={snapshot()} />)
    const texto = (screen.getByTestId('proventos-AAAA3').textContent ?? '').replace(/\s/g, ' ')
    expect(texto).toContain('21/08/2026')
    expect(texto).toContain('Dividendo')
    expect(texto).toContain('19/03/2026')
    expect(texto).toContain('Juros sobre capital próprio (bruto)')
    expect(texto).toContain('Total por ação')
    expect(texto).toContain('R$ 2,771 ÷ R$ 10,00 (fechamento de 22/10/2026) = 27,7%')
  })

  it('avisa quando o yield passa do limite do arquivo, quando houve desdobramento e quando o histórico da B3 veio parcial', () => {
    render(<Top15Dividendos snapshot={snapshot({ ranking: [item('AAAA3', 1, 0.2771, { historicoParcial: true }), item('BBBB3', 2, 0.1234, { ajustesAplicados: [{ data: '2026-04-29', fator: 5 }] })] })} />)
    expect(screen.getByTestId('parcial-AAAA3').textContent).toContain('não entregou o histórico completo')
    expect(screen.queryByTestId('parcial-BBBB3')).toBeNull()
    expect(screen.getByTestId('alerta-dy-AAAA3').textContent).toContain('Yield acima de 20%')
    expect(screen.queryByTestId('alerta-dy-BBBB3')).toBeNull()
    expect(screen.getByTestId('ajuste-BBBB3').textContent).toContain('desdobramento em 29/04/2026 (5:1)')
    expect(screen.queryByTestId('ajuste-AAAA3')).toBeNull()
  })

  it('"Como a lista é feita" usa os parâmetros do arquivo e diz o que não é', () => {
    render(<Top15Dividendos snapshot={snapshot()} />)
    const ol = screen.getByText('Quem entra.').closest('ol')?.textContent ?? ''
    expect(ol).toContain('R$ 3 mi')
    expect(ol).toContain('últimos 21 pregões')
    expect(ol).toContain('últimos 365 dias')
    expect(ol).toContain('data com')
    expect(ol).toContain('Devolução de capital não conta')
    expect(ol).toContain('cada uma entra na soma')
    expect(ol).toContain('Não mede se o pagamento é recorrente')
  })

  it('busca: mostra a posição de quem está no ranking e o motivo de quem ficou de fora; sem resultado avisa', () => {
    render(<Top15Dividendos snapshot={snapshot()} />)
    const busca = screen.getByLabelText('Buscar ação no ranking de dividendos')
    fireEvent.change(busca, { target: { value: 'dddd' } })
    expect(screen.getByTestId('situacao-div-DDDD3').textContent).toContain('Está na 4ª posição, com dividend yield de 5,0% em 12 meses.')
    fireEvent.change(busca, { target: { value: 'zeta' } })
    expect(screen.getByTestId('situacao-div-ZZZZ3').textContent).toContain('Nenhum provento em dinheiro')
    fireEvent.change(busca, { target: { value: 'qqqq' } })
    expect(screen.getByText(/Nenhuma ação com esse código ou nome/)).toBeTruthy()
    expect(screen.getByText(/1 não pagou proventos em 12 meses · 1 pouca liquidez · 1 sem preço recente na b3/)).toBeTruthy()
  })

  it('auditoria: modo diário explica a pasta mensal; comando de verificação da pasta do arquivo; aviso do arquivo ou o padrão', () => {
    const { unmount } = render(<Top15Dividendos snapshot={snapshot({ modoAuditoria: 'diaria', auditoriaCompletaEm: '2026-10-08', aviso: 'Não é recomendação de investimento. Texto do arquivo.' })} />)
    const t = screen.getByTestId('top15-dividendos').textContent ?? ''
    expect(t).toContain('recalculado todo dia útil')
    expect(t).toContain('08/10/2026')
    expect(screen.getByText(/node scripts\/acoes-dividendos-verificar\.mjs auditoria\/acoes-dividendos\/2026-10-25/)).toBeTruthy()
    expect(screen.getByText('aaaaaaaaaaaaaaaa…')).toBeTruthy()
    expect(screen.getByTestId('top15-dividendos-aviso').textContent).toBe('Não é recomendação de investimento. Texto do arquivo.')
    unmount()
    render(<Top15Dividendos snapshot={snapshot()} />)
    expect(screen.getByTestId('top15-dividendos').textContent).toContain('Toda execução grava, no repositório do projeto')
    expect(screen.getByTestId('top15-dividendos-aviso').textContent).toContain('Não é recomendação de investimento.')
  })
})

describe('domínio de dividendos', () => {
  it('formatarDy: fração vira porcentagem; vazio vira traço', () => {
    expect(formatarDy(0.0925)).toBe('9,3%')
    expect(formatarDy(null)).toBe('—')
  })

  it('contarExclusoesDividendos: do motivo mais frequente para o menos, com o rótulo', () => {
    const e = snapshot().exclusoes
    expect(contarExclusoesDividendos([...e, e[0]]).map((x) => [x.codigo, x.total])).toEqual([['sem_proventos', 2], ['liquidez_baixa', 1], ['sem_preco', 1]])
  })

  it('buscarSituacaoDividendos: termo curto não busca', () => {
    expect(buscarSituacaoDividendos(snapshot(), 'a')).toEqual([])
  })
})

describe('Simule Ações: aba de dividendos', () => {
  const ctx = { screen: 'x', setScreen: vi.fn() } as unknown as AppCtx
  it('fica no cartão Top 15, abre a lista (ou o "em validação") e dá para voltar ao simulador', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, fonte: null, cadastroId: null, pregoesNoHistorico: 0, sessoesLiquidez: 21, totais: { setores: 0, empresas: 0 }, gruposOrdem: [], setores: [], busca: [] } as never} />)
    const abas = within(screen.getByRole('tablist', { name: 'O que você quer ver' })).getAllByRole('tab')
    expect(abas).toHaveLength(7)
    fireEvent.click(abas[1])
    const cartao = screen.getByRole('tab', { name: /Top 15 pagadoras de dividendos/ })
    expect(cartao.textContent).toContain('Dividend yield de 12 meses')
    fireEvent.click(cartao)
    expect(cartao.getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('top15-dividendos-validacao') ?? screen.queryByTestId('top15-dividendos')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.queryByTestId('top15-dividendos-validacao') ?? screen.queryByTestId('top15-dividendos')).toBeNull()
  })
})
