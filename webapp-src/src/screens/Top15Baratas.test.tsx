import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Top15Baratas } from './Top15Baratas'
import { SimuleAcoes } from './SimuleAcoes'
import type { ItemRanking, SnapshotAcoesBaratas } from '../domain/acoesBaratas'
import type { AppCtx } from '../state/useAppState'

const item = (ticker: string, posicao: number, o: Partial<ItemRanking> = {}): ItemRanking => ({
  posicao, ticker, nome: `Empresa ${ticker}`, setor: 'Mineração', cotacao: 12.34, dataCotacao: '2026-09-30', nota: 1 - posicao / 100,
  plSobreValorDeMercado: 1.159, fcoSobreEv: 0.1502, ebitAjustadoSobreEv: 0.1366, pvp: 0.86, mktcap: 7.42e9, ev: 1.032e10, ebitAjustado: 1.41e9, fcoLtm: 1.55e9, lucroLtm: 1e9,
  roic: 0.12, dlEbitda: 1.4, caixaLiquido: false, passaRoic: true, passaDlEbitda: true, passaFco: true, coberturaJuros: 4.2, semDespesaFinanceira: false, passaCobertura: true, exerciciosAnalisados: 5, exerciciosComLucro: 4, exerciciosComFco: 5, passaConsistencia: true, volatilidade: 0.31, volumeMedio: 5e7,
  demonstracao: { doc: 'ITR', dtRefer: '2026-06-30', dtReceb: '2026-08-12', linkDoc: 'https://exemplo.cvm/doc?id=1' }, metodoValorDeMercado: 'por_classe', ...o,
})

const snapshot = (o: Partial<SnapshotAcoesBaratas> = {}): SnapshotAcoesBaratas => ({
  publicado: true, versaoMetodologia: '1.0.0', geradoEm: '2026-10-04T12:00:00Z', dataPrecos: '2026-10-02', dataCorte: '2026-10-02',
  pastaAuditoria: 'auditoria/acoes-baratas/2026-10-02', hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64),
  tamanhoDaLista: 3, universo: 30,
  parametros: { liquidezMinimaDiariaReais: 3_000_000, sessoesLiquidez: 21, percentilVolatilidadeExcluir: 90, sessoesVolatilidade: 252, metodoComposicao: 'ranks', componentes: [], setoresExcluidos: ['Bancos'] },
  qualidade: { roicMinimo: 0.1, aliquotaImpostoNopat: 0.34, dlEbitdaMaximo: 3, fcoPositivo: true, coberturaJurosMinima: 3, exerciciosConsistencia: 5, minimoComLucro: 4, minimoComFco: 4 },
  etapas: [],
  ranking: [item('AAAA3', 1, { passaRoic: false, roic: 0.05 }), item('BBBB3', 2), item('CCCC3', 3, { passaFco: false }), item('DDDD3', 4), item('EEEE3', 5)],
  exclusoes: [{ ticker: 'MGLU3', nome: 'Magazine Luiza', setor: 'Varejo', etapa: 'lucro', codigo: 'prejuizo_12m', motivo: 'Lucro dos últimos 12 meses não positivo.' }],
  ...o,
})

describe('Top15Baratas', () => {
  it('sem aprovação (publicado=false) mostra "em validação" e nenhum ranking', () => {
    render(<Top15Baratas snapshot={snapshot({ publicado: false, ranking: [] })} />)
    expect(screen.getByTestId('top15-validacao').textContent).toContain('em validação')
    expect(screen.queryByTestId('top15')).toBeNull()
  })

  it('publicado: lista só o tamanho pedido, na ordem do ranking, com os três rendimentos', () => {
    render(<Top15Baratas snapshot={snapshot()} />)
    const itens = screen.getAllByRole('listitem').filter((l) => l.dataset.testid?.startsWith('top15-'))
    expect(itens.map((l) => l.dataset.testid)).toEqual(['top15-AAAA3', 'top15-BBBB3', 'top15-CCCC3'])
    const primeiro = within(itens[0])
    expect(primeiro.getByText(/1\. AAAA3/)).toBeTruthy()
    expect(primeiro.getByText('115,9%')).toBeTruthy()
    expect(primeiro.getByText('15,0%')).toBeTruthy()
    expect(primeiro.getByText('13,7%')).toBeTruthy()
  })

  it('filtro ROIC retira quem reprova e puxa o próximo do ranking; mostra a posição original', () => {
    render(<Top15Baratas snapshot={snapshot()} />)
    fireEvent.click(screen.getByLabelText(/ROIC de 10% ou mais/))
    const ids = screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter(Boolean)
    expect(ids).toEqual(['top15-BBBB3', 'top15-CCCC3', 'top15-DDDD3'])
    expect(screen.getByText(/1 empresa retirada/)).toBeTruthy()
    expect(screen.getByTestId('top15-BBBB3').textContent).toContain('1. BBBB3')
    expect(screen.getByTestId('top15-BBBB3').textContent).toContain('#2 no ranking geral')
  })

  it('filtros novos: cobertura de juros e consistência de 5 exercícios, com a regra explicada na tela', () => {
    const s = snapshot({ ranking: [item('AAAA3', 1, { passaCobertura: false }), item('BBBB3', 2, { passaConsistencia: false, exerciciosComLucro: 2 }), item('CCCC3', 3)] })
    render(<Top15Baratas snapshot={s} />)
    expect(screen.getByText(/lucro líquido e caixa operacional positivos em pelo menos 4/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Cobertura de juros de 3,0x ou mais/))
    expect(screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter(Boolean)).toEqual(['top15-BBBB3', 'top15-CCCC3'])
    fireEvent.click(screen.getByLabelText(/Consistência: 4 de 5 anos/))
    expect(screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter(Boolean)).toEqual(['top15-CCCC3'])
    expect(screen.getByTestId('top15-CCCC3').textContent).toContain('lucro positivo em 4 de 5 exercícios')
  })

  it('vários filtros combinam; sem ninguém passando, a tela explica', () => {
    const s = snapshot({ ranking: [item('AAAA3', 1, { passaRoic: false })] })
    render(<Top15Baratas snapshot={s} />)
    fireEvent.click(screen.getByLabelText(/ROIC de 10% ou mais/))
    expect(screen.getByText(/Nenhuma empresa do ranking passa/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/ROIC de 10% ou mais/))
    expect(screen.getByTestId('top15-AAAA3')).toBeTruthy()
  })

  it('memória de cálculo traz valores, método do valor de mercado e o link do documento original', () => {
    render(<Top15Baratas snapshot={snapshot()} />)
    const cartao = within(screen.getByTestId('top15-BBBB3'))
    expect(cartao.getByText('R$ 7,4 bi')).toBeTruthy()
    expect(cartao.getByText(/ITR de/)).toBeTruthy()
    const link = cartao.getByRole('link', { name: /documento original na CVM/ })
    expect(link.getAttribute('href')).toBe('https://exemplo.cvm/doc?id=1')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('"por que ficou de fora" explica o motivo da exclusão', () => {
    render(<Top15Baratas snapshot={snapshot()} />)
    fireEvent.change(screen.getByLabelText('Buscar empresa fora da triagem'), { target: { value: 'mglu' } })
    expect(screen.getByText(/Lucro dos últimos 12 meses não positivo/)).toBeTruthy()
  })

  it('mostra a auditoria (pasta, comando de verificação, hash) e o aviso de que não é recomendação', () => {
    render(<Top15Baratas snapshot={snapshot()} />)
    expect(screen.getByText(/acoes-baratas-verificar\.mjs auditoria\/acoes-baratas\/2026-10-02/)).toBeTruthy()
    expect(screen.getByText(/aaaaaaaaaaaaaaaa…/)).toBeTruthy()
    expect(screen.getByText(/Não é recomendação de investimento/)).toBeTruthy()
    expect(screen.getByText(/Barata nos números não quer dizer boa compra/)).toBeTruthy()
  })
})

describe('Simule Ações: as duas caixinhas', () => {
  const ctx = { screen: 'simuleAcoes', setScreen: vi.fn() } as unknown as AppCtx
  const base = {
    geradoEm: '2026-10-01T23:05:00Z', dataPregao: '2026-10-01', sessoesLiquidez: 21, totais: { setores: 1, empresas: 1 }, gruposOrdem: ['Petróleo, Gás e Biocombustíveis'],
    setores: [{ setor: 'Petróleo e gás', grupoB3: 'Petróleo, Gás e Biocombustíveis', empresas: [{ ticker: 'PETR4', nome: 'Petrobras', cotacao: 38.5, dataCotacao: '2026-10-01', variacao3m: 3.2, volumeMedio: 1e9, minima52: 30, maxima52: 40 }] }],
    busca: [],
  }

  it('abre no simulador e troca para o Top 15 e de volta', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={base} />)
    const abas = screen.getAllByRole('tab')
    expect(abas.map((a) => a.textContent)).toEqual([expect.stringContaining('Simulador'), expect.stringContaining('Top 15 mais baratas')])
    expect(abas[0].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Quantas ações esse valor compra')).toBeTruthy()

    fireEvent.click(abas[1])
    expect(abas[1].getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('Quantas ações esse valor compra')).toBeNull()
    expect(screen.queryByText(/Como o IR funciona nas ações/)).toBeNull()
    // dados reais do repositório ainda sem aprovação do responsável → "em validação"
    expect(screen.getByTestId('top15-validacao')).toBeTruthy()

    fireEvent.click(abas[0])
    expect(screen.getByText('Quantas ações esse valor compra')).toBeTruthy()
  })
})
