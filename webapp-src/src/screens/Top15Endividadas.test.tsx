import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Top15Endividadas, formatarRazao } from './Top15Endividadas'
import { SimuleAcoes } from './SimuleAcoes'
import { buscarSituacao, contarExclusoesEndividadas } from '../domain/acoesEndividadas'
import type { ItemEndividada, SnapshotAcoesEndividadas } from '../domain/acoesEndividadas'
import type { AppCtx } from '../state/useAppState'

const conta = (cd: string, valor: number) => ({ cd, valor, formula: `conta ${cd}` })
const item = (ticker: string, posicao: number | undefined, dlEbitda: number | null, o: Partial<ItemEndividada> = {}): ItemEndividada => ({
  posicao, ticker, nome: `Empresa ${ticker}`, setor: 'Energia elétrica', cotacao: 12.34, dataCotacao: '2026-10-16', dlEbitda,
  dividaLiquida: 3.7e9, dividaBruta: 4.1e9, caixa: 0.4e9, ebitda: 0.38e9, ebitAjustado: 0.3e9, plControladores: 1e9, mktcap: 2e9,
  coberturaJuros: 1.2, semDespesaFinanceira: false, alertas: [],
  demonstracao: { doc: 'ITR', dtRefer: '2026-06-30', dtReceb: '2026-08-12', linkDoc: null, consolidacao: 'consolidada' },
  calculo: {
    dividaCurta: conta('2.01.04', 1.1e9), dividaLonga: conta('2.02.01', 3e9), caixaEEquivalentes: conta('1.01.01', 0.1e9), aplicacoesFinanceiras: conta('1.01.02', 0.3e9),
    ebit: conta('3.05', 0.2e9), depreciacaoEAmortizacao: conta('7.04.01', 0.08e9),
    ebitAjustado: { formula: 'EBIT (3.05) − equivalência patrimonial', valor: 0.3e9 }, ebitda: { formula: 'EBIT ajustado + |depreciação e amortização 12m|', valor: 0.38e9 }, dividaLiquida: { formula: 'dívida bruta − caixa', valor: 3.7e9 },
  },
  ...o,
})

const snapshot = (o: Partial<SnapshotAcoesEndividadas> = {}): SnapshotAcoesEndividadas => ({
  publicado: true, versaoMetodologia: '1.0.0', geradoEm: '2026-10-17T07:00:00Z', dataExecucao: '2026-10-17', dataPrecos: '2026-10-16', dataCorte: '2026-10-05',
  pastaAuditoria: 'auditoria/acoes-endividadas/2026-10-17', hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64), tamanhoDaLista: 2, universo: 226, avaliadas: 129, aviso: null,
  parametros: { indicador: 'dlEbitda', liquidezMinimaDiariaReais: 3_000_000, sessoesLiquidez: 21, idadeMaximaDemonstracaoDias: 200, setoresExcluidos: ['Bancos', 'Seguros e previdência'] },
  contagens: { ranking: 4, semEbitdaPositivo: 1, exclusoes: 3 },
  etapas: [],
  ranking: [item('AAAA3', 1, 9.7035), item('BBBB3', 2, 8.6103, { coberturaJuros: null, semDespesaFinanceira: true }), item('CCCC3', 3, 5.2)],
  restante: [{ ticker: 'DDDD3', nome: 'Delta Energia', setor: 'Energia elétrica', posicao: 4, dlEbitda: 4.1234 }],
  semEbitdaPositivo: [item('EEEE3', undefined, null, { ebitda: -0.05e9, dividaLiquida: 1.2e9 })],
  exclusoes: [
    { ticker: 'ZZZZ3', nome: 'Zeta Varejo', setor: 'Varejo', etapa: 'endividamento', codigo: 'caixa_liquido', motivo: 'Dívida líquida de R$ -700 (não positiva): o caixa cobre a dívida bruta de R$ 200.' },
    { ticker: 'BANC3', nome: 'Banco Exemplo', setor: 'Bancos', etapa: 'universo', codigo: 'setor_excluido', motivo: 'Setor "Bancos" fora do escopo.' },
    { ticker: 'LIQU3', nome: 'Pouca Liquidez', setor: 'Varejo', etapa: 'liquidez', codigo: 'liquidez_baixa', motivo: 'Volume médio diário abaixo do mínimo.' },
  ],
  ...o,
})

describe('Top15Endividadas', () => {
  it('sem aprovação ou sem lista mostra "em validação" e nenhuma empresa', () => {
    const { unmount } = render(<Top15Endividadas snapshot={snapshot({ publicado: false, ranking: [], restante: [], semEbitdaPositivo: [], exclusoes: [] })} />)
    expect(screen.getByTestId('top15-endividadas-validacao').textContent).toContain('em validação')
    expect(screen.queryByTestId('top15-endividadas')).toBeNull()
    unmount()
    render(<Top15Endividadas snapshot={snapshot({ ranking: [] })} />)
    expect(screen.getByTestId('top15-endividadas-validacao')).toBeTruthy()
  })

  it('lista só o tamanho pedido, na ordem, com a razão, a dívida líquida e o EBITDA de cada empresa', () => {
    render(<Top15Endividadas snapshot={snapshot()} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('As 2 empresas mais endividadas')
    const ids = screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter((x) => x?.startsWith('top15-endividadas-') && !x.includes('sem'))
    expect(ids).toEqual(['top15-endividadas-AAAA3', 'top15-endividadas-BBBB3'])
    expect(screen.queryByTestId('top15-endividadas-CCCC3')).toBeNull()
    const a = within(screen.getByTestId('top15-endividadas-AAAA3'))
    expect(a.getByText('1. AAAA3')).toBeTruthy()
    expect(screen.getByTestId('razao-AAAA3').textContent).toBe('9,7x')
    expect(screen.getByTestId('razao-BBBB3').textContent).toBe('8,6x')
    expect(a.getAllByText('R$ 3,7 bi').length).toBeGreaterThanOrEqual(1)
    expect(a.getAllByText('R$ 380 mi').length).toBeGreaterThanOrEqual(1)
    expect(a.getByText(/fech\. 16\/10\/2026/)).toBeTruthy()
    expect(screen.getByTestId('top15-endividadas').textContent).toContain('Preços até 16/10/2026 · balanços publicados até 05/10/2026 · metodologia v1.0.0 · 129 empresas avaliadas de 226 do cadastro')
  })

  it('código e cotação em amarelo, como nos outros rankings (D90)', () => {
    render(<Top15Endividadas snapshot={snapshot()} />)
    const c = within(screen.getByTestId('top15-endividadas-AAAA3'))
    expect(c.getByText('1. AAAA3').style.color).toBe('var(--accent)')
    expect(c.getByText('R$ 12,34').style.color).toBe('var(--accent)')
  })

  it('cobertura de juros: valor, ou "sem despesa financeira"', () => {
    render(<Top15Endividadas snapshot={snapshot()} />)
    expect(within(screen.getByTestId('top15-endividadas-AAAA3')).getByText(/cobertura de juros 1,2x/)).toBeTruthy()
    expect(within(screen.getByTestId('top15-endividadas-BBBB3')).getByText(/cobertura de juros sem despesa financeira/)).toBeTruthy()
  })

  it('"Como chegamos nesse número" mostra cada conta da CVM e a fórmula', () => {
    render(<Top15Endividadas snapshot={snapshot()} />)
    const texto = screen.getByTestId('calculo-AAAA3').textContent ?? ''
    for (const cd of ['2.01.04', '2.02.01', '1.01.01', '1.01.02', '3.05', '7.04.01']) expect(texto).toContain(`conta CVM ${cd}`)
    expect(texto).toContain('dívida bruta − caixa')
    expect(texto).toContain('EBIT ajustado + |depreciação e amortização 12m|')
    expect(texto).toContain('Demonstração usada: ITR de 30/06/2026 (consolidada), recebida pela CVM em 12/08/2026.')
  })

  it('lista à parte para dívida líquida com EBITDA negativo: sem razão, fora da ordem; some se estiver vazia', () => {
    const { unmount } = render(<Top15Endividadas snapshot={snapshot()} />)
    const e = screen.getByTestId('sem-ebitda-EEEE3')
    expect(e.textContent).toContain('Dívida líquida R$ 1,2 bi')
    expect(e.textContent).toContain('EBITDA −R$ 50 mi')
    expect(screen.queryByTestId('razao-EEEE3')).toBeNull()
    unmount()
    render(<Top15Endividadas snapshot={snapshot({ semEbitdaPositivo: [] })} />)
    expect(screen.queryByTestId('top15-endividadas-sem-ebitda')).toBeNull()
  })

  it('"Por que uma empresa ficou de fora?": quem está depois do Top, quem está sem EBITDA e quem não entrou, com o motivo; sem resultado avisa', () => {
    render(<Top15Endividadas snapshot={snapshot()} />)
    const busca = screen.getByLabelText('Buscar empresa fora do ranking')
    fireEvent.change(busca, { target: { value: 'delta' } })
    expect(screen.getByTestId('situacao-DDDD3').textContent).toContain('Está na 4ª posição, com dívida líquida de 4,1x o EBITDA: fora do Top 2.')
    fireEvent.change(busca, { target: { value: 'EEEE' } })
    expect(screen.getByTestId('situacao-EEEE3').textContent).toContain('EBITDA zero ou negativo')
    fireEvent.change(busca, { target: { value: 'zeta' } })
    expect(screen.getByTestId('situacao-ZZZZ3').textContent).toContain('Dívida líquida de R$ -700')
    fireEvent.change(busca, { target: { value: 'qqqq' } })
    expect(screen.getByText(/Nenhuma empresa fora do Top 2 com esse código ou nome/)).toBeTruthy()
    expect(screen.getByText(/1 caixa maior que a dívida · 1 pouca liquidez · 1 setor financeiro \(dívida é o negócio\)/)).toBeTruthy()
  })

  it('"Como a lista é feita" usa os parâmetros do arquivo e diz o que não é, e o que fica de fora', () => {
    render(<Top15Endividadas snapshot={snapshot()} />)
    const ol = screen.getByText('Quem entra.').closest('ol')?.textContent ?? ''
    expect(ol).toContain('Bancos, Seguros e previdência')
    expect(ol).toContain('R$ 3 mi')
    expect(ol).toContain('média de 21 pregões')
    expect(ol).toContain('no máximo 200 dias')
    expect(ol).toContain('dívida líquida = dívida bruta − caixa')
    expect(ol).toContain('Sem filtro de lucro nem de volatilidade.')
    expect(ol).toContain('Não mede prazo, custo, moeda nem garantias da dívida')
  })

  it('auditoria: modo diário explica a pasta mensal; comando de verificação da pasta do arquivo; aviso do arquivo ou o padrão', () => {
    const { unmount } = render(<Top15Endividadas snapshot={snapshot({ modoAuditoria: 'diaria', auditoriaCompletaEm: '2026-10-08', aviso: 'Não é recomendação de investimento. Texto do arquivo.' })} />)
    const t = screen.getByTestId('top15-endividadas').textContent ?? ''
    expect(t).toContain('recalculado todo dia útil')
    expect(t).toContain('08/10/2026')
    expect(t).toContain('O comando abaixo refaz o cálculo da pasta do mês')
    expect(screen.getByText(/node scripts\/acoes-endividadas-verificar\.mjs auditoria\/acoes-endividadas\/2026-10-17/)).toBeTruthy()
    expect(screen.getByText('aaaaaaaaaaaaaaaa…')).toBeTruthy()
    expect(screen.getByTestId('top15-endividadas-aviso').textContent).toBe('Não é recomendação de investimento. Texto do arquivo.')
    unmount()
    render(<Top15Endividadas snapshot={snapshot()} />)
    expect(screen.getByTestId('top15-endividadas').textContent).toContain('Toda execução grava, no repositório do projeto')
    expect(screen.getByTestId('top15-endividadas-aviso').textContent).toContain('Não é recomendação de investimento.')
  })
})

describe('domínio das endividadas', () => {
  it('formatarRazao: uma casa, nenhuma casa para razões de três dígitos, traço para ausente', () => {
    expect(formatarRazao(9.7035)).toBe('9,7x')
    expect(formatarRazao(35.2712)).toBe('35,3x')
    expect(formatarRazao(150.4)).toBe('150x')
    expect(formatarRazao(null)).toBe('—')
    expect(formatarRazao(Number.NaN)).toBe('—')
  })

  it('buscarSituacao: exige 2 letras, ignora acento e caixa, e não mostra quem está no Top', () => {
    const s = snapshot()
    expect(buscarSituacao(s, 'a')).toEqual([])
    expect(buscarSituacao(s, 'DELTA ENERGIA').map((x) => x.ticker)).toEqual(['DDDD3'])
    expect(buscarSituacao(s, 'banco').map((x) => [x.ticker, x.tipo])).toEqual([['BANC3', 'excluida']])
    expect(buscarSituacao(s, 'AAAA')).toEqual([])
    expect(buscarSituacao({ ...s, exclusoes: [{ ...s.exclusoes[0], ticker: 'AAAA3', nome: 'Empresa AAAA3' }] }, 'AAAA')).toEqual([])
  })

  it('contarExclusoesEndividadas: do motivo mais frequente para o menos; desempata pelo rótulo', () => {
    const e = (codigo: string) => ({ ticker: codigo, nome: null, setor: null, etapa: 'x', codigo, motivo: '' })
    const r = contarExclusoesEndividadas([e('liquidez_baixa'), e('caixa_liquido'), e('liquidez_baixa'), e('motivo_novo')])
    expect(r.map((x) => [x.codigo, x.total])).toEqual([['liquidez_baixa', 2], ['caixa_liquido', 1], ['motivo_novo', 1]])
    expect(r[2].rotulo).toBe('motivo_novo')
  })
})

describe('Simule Ações: aba "Top 15 mais endividadas"', () => {
  const ctx = { screen: 'x', setScreen: vi.fn() } as unknown as AppCtx
  it('é a quinta aba, abre a lista (ou o "em validação") e dá para voltar ao simulador', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, fonte: null, cadastroId: null, pregoesNoHistorico: 0, sessoesLiquidez: 21, totais: { setores: 0, empresas: 0 }, gruposOrdem: [], setores: [], busca: [] } as never} />)
    const abas = within(screen.getByRole('tablist', { name: 'O que você quer ver' })).getAllByRole('tab')
    expect(abas).toHaveLength(5)
    expect(abas[4].textContent).toContain('Top 15 mais endividadas')
    expect(abas[4].textContent).toContain('Dívida líquida ÷ EBITDA')
    fireEvent.click(abas[4])
    expect(abas[4].getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('top15-endividadas-validacao') ?? screen.queryByTestId('top15-endividadas')).toBeTruthy()
    expect(screen.queryByTestId('top15-acoes-negociadas-validacao')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.queryByTestId('top15-endividadas-validacao') ?? screen.queryByTestId('top15-endividadas')).toBeNull()
  })
})
