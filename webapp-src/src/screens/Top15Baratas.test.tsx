import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Top15Baratas } from './Top15Baratas'
import { SimuleAcoes } from './SimuleAcoes'
import type { ItemRanking, SnapshotAcoesBaratas } from '../domain/acoesBaratas'
import { CHAVE_CODIGO_TOP15 } from '../domain/acessoTop15'
import type { RespostaTop15 } from '../domain/acessoTop15'
import { SNAPSHOT_ACOES_BARATAS } from '../data/snapshotAcoesBaratas'
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

  it('"Como chegamos aos 12 meses": mostra exercício + acumulado − acumulado e o lucro de cada exercício', () => {
    const comp = (valor: number, partes: [string, number][]) => ({
      valor,
      componentes: partes.map(([papel, v]) => ({ papel, de: papel.startsWith('exercicio') ? '2025-01-01' : papel.includes('atual') ? '2026-01-01' : '2025-01-01', ate: papel.startsWith('exercicio') ? '2025-12-31' : papel.includes('atual') ? '2026-06-30' : '2025-06-30', doc: papel.startsWith('exercicio') ? 'DFP' : 'ITR', valor: v })),
    })
    const r = item('SEER3', 1, {
      composicaoLtm: {
        lucro: { ...comp(57e6, [['exercicio_anterior (+)', 214e6], ['acumulado_atual (+)', 10e6], ['acumulado_ano_anterior (−)', 167e6]]), conta: '3.11.01', consolidado: 60e6, controladores: 57e6 },
        fco: comp(443e6, [['exercicio_anterior (+)', 400e6], ['acumulado_atual (+)', 200e6], ['acumulado_ano_anterior (−)', 157e6]]),
        ebit: comp(521e6, [['exercicio_anterior (+)', 450e6], ['acumulado_atual (+)', 260e6], ['acumulado_ano_anterior (−)', 189e6]]),
      },
      historico: [{ exercicio: '2025-12-31', conta: '3.11', lucro: 214e6, lucroControladores: 0, fco: 400e6 }, { exercicio: '2024-12-31', conta: '3.11', lucro: -1e6, lucroControladores: -1e6, fco: 300e6 }],
    })
    render(<Top15Baratas snapshot={snapshot({ ranking: [r] })} />)
    const bloco = within(screen.getByTestId('como-chegamos-SEER3'))
    expect(bloco.getByText('Lucro líquido consolidado (conta 3.11.01)')).toBeTruthy()
    expect(bloco.getAllByText(/\+ exercício encerrado em 31\/12\/2025 \(DFP\)/).length).toBe(3)
    expect(bloco.getAllByText(/\+ acumulado de 01\/01\/2026 a 30\/06\/2026 \(ITR\)/).length).toBe(3)
    expect(bloco.getAllByText(/− acumulado de 01\/01\/2025 a 30\/06\/2025 \(ITR\)/).length).toBe(3)
    expect(bloco.getAllByText('= últimos 12 meses').length).toBe(3)
    expect(bloco.getByText(/consolidado \(3\.11\) R\$ 60 mi · dos controladores \(3\.11\.01\) R\$ 57 mi/)).toBeTruthy()
    expect(bloco.getByText('2025')).toBeTruthy()
    expect(bloco.getByText('R$ 214 mi · R$ 400 mi')).toBeTruthy()
    expect(bloco.getByText('dos controladores (3.11.01): R$ 0')).toBeTruthy()
    expect(bloco.queryAllByText(/dos controladores \(3\.11\.01\):/).length).toBe(1) // 2024 é igual ao consolidado: não repete
    expect(bloco.getByText('−R$ 1 mi · R$ 300 mi')).toBeTruthy()
  })

  it('quantidade de ações ajustada (milhares na CVM) e P/VP alto aparecem com explicação', () => {
    const s = snapshot({ ranking: [item('AMBV3', 1, { ajusteUnidadeCapital: 'automático ×1000' }), item('ALER3', 2, { alertas: ['pvp_alto'] }), item('NORM3', 3, { metodoValorDeMercado: 'preco_da_outra_classe' })] })
    render(<Top15Baratas snapshot={s} />)
    const amb = within(screen.getByTestId('top15-AMBV3'))
    expect(amb.getByText('ajustada (automático ×1000)')).toBeTruthy()
    expect(amb.getByText(/a CVM traz a quantidade em milhares/)).toBeTruthy()
    expect(screen.getByTestId('alerta-pvp-ALER3').textContent).toContain('P/VP acima de 10')
    expect(screen.queryByTestId('alerta-pvp-AMBV3')).toBeNull()
    expect(within(screen.getByTestId('top15-NORM3')).getByText(/avaliada pelo preço de outra classe/)).toBeTruthy()
    expect(within(screen.getByTestId('top15-ALER3')).queryByText(/Quantidade de ações/)).toBeNull()
  })

  it('ações usadas e o balanço de origem, desdobramento ajustado, alerta de giro e exercícios não lidos aparecem na memória', () => {
    const lista = snapshot({ ranking: [
      item('TEND3', 1, { acoesUsadas: 57.43e6, capitalDocumento: 'ITR de 2026-06-30 (versão 1)', alertas: ['giro_alto'], giroDiario: 0.0904 }),
      item('ORVR3', 2, { acoesUsadas: 549.3e6, ajusteDesdobramentoCapital: '×4', capitalDocumento: 'ITR de 2026-06-30 (versão 1)' }),
      item('TIMS3', 3, { historicoDescartes: [{ exercicio: '2021-12-31', motivo: 'DFP sem a conta de lucro (3.11 ou 3.11.01)' }], historicoLacuna: { entre: ['2021-12-31', '2023-12-31'], dias: 730 }, composicaoLtm: undefined }),
    ] })
    render(<Top15Baratas snapshot={lista} />)
    const tend = within(screen.getByTestId('top15-TEND3'))
    expect(tend.getByText('57,4 mi')).toBeTruthy()
    expect(tend.getByText(/quantidade do ITR de 2026-06-30 \(versão 1\)/)).toBeTruthy()
    expect(screen.getByTestId('alerta-giro-TEND3').textContent).toContain('9,0%')
    expect(screen.getByTestId('alerta-giro-TEND3').textContent).toContain('subestimado')
    expect(within(screen.getByTestId('top15-ORVR3')).getByText(/ajustada por desdobramento\/grupamento posterior \(×4\)/)).toBeTruthy()
    expect(screen.queryByTestId('alerta-giro-ORVR3')).toBeNull()
    // TIMS3 sem composicaoLtm: o bloco "como chegamos" não existe, então os exercícios não lidos só aparecem quando há composição
    expect(screen.queryByTestId('nao-lidos-TIMS3')).toBeNull()
  })

  it('exercícios que não puderam ser lidos (e a lacuna na série de DFP) aparecem com o motivo', () => {
    const comp = { valor: 1, componentes: [] }
    const r = item('TIMS3', 1, { composicaoLtm: { ebit: comp, fco: comp, lucro: { ...comp, conta: '3.11' } }, historicoDescartes: [{ exercicio: '2021-12-31', motivo: 'DFP sem a conta de lucro (3.11 ou 3.11.01)' }], historicoLacuna: { entre: ['2021-12-31', '2023-12-31'], dias: 730 } })
    render(<Top15Baratas snapshot={snapshot({ ranking: [r] })} />)
    const bloco = within(screen.getByTestId('nao-lidos-TIMS3'))
    expect(bloco.getByText('Exercícios que não puderam ser lidos')).toBeTruthy()
    expect(bloco.getByText('DFP sem a conta de lucro (3.11 ou 3.11.01)')).toBeTruthy()
    expect(bloco.getByText(/nenhum DFP consecutivo entre 31\/12\/2021 e 31\/12\/2023/)).toBeTruthy()
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

describe('Simule Ações: as caixinhas (simulador, mais baratas, mais negociadas e Ibovespa)', () => {
  const ctx = { screen: 'simuleAcoes', setScreen: vi.fn() } as unknown as AppCtx
  const base = {
    geradoEm: '2026-10-01T23:05:00Z', dataPregao: '2026-10-01', sessoesLiquidez: 21, totais: { setores: 1, empresas: 1 }, gruposOrdem: ['Petróleo, Gás e Biocombustíveis'],
    setores: [{ setor: 'Petróleo e gás', grupoB3: 'Petróleo, Gás e Biocombustíveis', empresas: [{ ticker: 'PETR4', nome: 'Petrobras', cotacao: 38.5, dataCotacao: '2026-10-01', variacao3m: 3.2, volumeMedio: 1e9, minima52: 30, maxima52: 40 }] }],
    busca: [],
  }

  it('abre no simulador e troca para o Top 15 e de volta', async () => {
    render(<SimuleAcoes ctx={ctx} snapshot={base} />)
    const abas = within(screen.getByRole('tablist', { name: 'O que você quer ver' })).getAllByRole('tab')
    expect(abas.map((a) => a.textContent)).toEqual([expect.stringContaining('Simulador'), expect.stringContaining('Top 15 mais baratas'), expect.stringContaining('Top 15 mais negociadas'), expect.stringContaining('Top 15 do Ibovespa'), expect.stringContaining('Top 15 mais endividadas'), expect.stringContaining('Top 15 pagadoras de dividendos'), expect.stringContaining('Preço teto de compra'), expect.stringContaining('Agenda de dividendos')])
    expect(abas[0].getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Quantas ações esse valor compra')).toBeTruthy()

    fireEvent.click(abas[1])
    expect(abas[1].getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('Quantas ações esse valor compra')).toBeNull()
    expect(screen.queryByText(/Como o IR funciona nas ações/)).toBeNull()
    // O painel mostra um destes estados, conforme o arquivo de dados que o job gerou (antes da 1ª
    // execução: "em validação"; depois: a porta do código). Nunca a lista, que não vai no arquivo do app.
    expect(screen.queryByTestId('top15-validacao') ?? (await screen.findByTestId('top15-codigo'))).toBeTruthy()
    expect(screen.queryByTestId('top15')).toBeNull()

    fireEvent.click(abas[0])
    expect(screen.getByText('Quantas ações esse valor compra')).toBeTruthy()
  })
})

describe('Top15Baratas com acesso por código (D50)', () => {
  const cabecalho = (): SnapshotAcoesBaratas => snapshot({ acessoRestrito: true, instagram: 'acarteiraideal', ranking: [], exclusoes: [], etapas: [] })
  const completo = (): SnapshotAcoesBaratas => snapshot({ acessoRestrito: true, instagram: 'acarteiraideal' })
  const memoria = (inicial: Record<string, string> = {}) => {
    const d = new Map(Object.entries(inicial))
    return {
      d,
      getItem: async (k: string) => d.get(k) ?? null,
      setItem: async (k: string, v: string) => void d.set(k, v),
      removeItem: async (k: string) => void d.delete(k),
    }
  }
  const digitar = (valor: string) => fireEvent.change(screen.getByLabelText('Código do mês'), { target: { value: valor } })

  it('sem código: pede o código, aponta o Instagram e NÃO mostra nenhuma ação', async () => {
    render(<Top15Baratas snapshot={cabecalho()} carregar={vi.fn()} armazenamento={memoria()} />)
    await screen.findByTestId('top15-codigo')
    const link = screen.getByRole('link', { name: '@acarteiraideal' })
    expect(link.getAttribute('href')).toBe('https://www.instagram.com/acarteiraideal/')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(screen.queryByTestId('top15')).toBeNull()
    expect(document.body.textContent).not.toContain('AAAA3')
    expect((screen.getByRole('button', { name: 'Ver a lista' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('código errado: mostra o aviso, não salva e não libera a lista', async () => {
    const mem = memoria()
    const carregar = vi.fn(async (): Promise<RespostaTop15> => ({ ok: false, motivo: 'invalido' }))
    render(<Top15Baratas snapshot={cabecalho()} carregar={carregar} armazenamento={mem} />)
    await screen.findByTestId('top15-codigo')
    digitar('ciaaaabbbb')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Código inválido ou vencido')
    expect(carregar).toHaveBeenCalledWith('CIAAAABBBB')
    expect(mem.d.size).toBe(0)
    expect(screen.queryByTestId('top15')).toBeNull()
  })

  it('código certo: libera a lista, salva o código e oferece trocar', async () => {
    const mem = memoria()
    const carregar = vi.fn(async (): Promise<RespostaTop15> => ({ ok: true, snapshot: completo() }))
    render(<Top15Baratas snapshot={cabecalho()} carregar={carregar} armazenamento={mem} />)
    await screen.findByTestId('top15-codigo')
    digitar('CI-AAAA-BBBB')
    expect((screen.getByLabelText('Código do mês') as HTMLInputElement).value).toBe('CI-AAAA-BBBB')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    await screen.findByTestId('top15')
    expect(screen.getByTestId('top15-AAAA3')).toBeTruthy()
    expect(mem.d.get(CHAVE_CODIGO_TOP15)).toBe('CIAAAABBBB')

    fireEvent.click(screen.getByRole('button', { name: 'Sair e trocar o código' }))
    await screen.findByTestId('top15-codigo')
    expect(mem.d.has(CHAVE_CODIGO_TOP15)).toBe(false)
    expect(screen.queryByTestId('top15')).toBeNull()
  })

  it('código salvo e ainda válido: abre sozinho, sem pedir de novo', async () => {
    const carregar = vi.fn(async (): Promise<RespostaTop15> => ({ ok: true, snapshot: completo() }))
    render(<Top15Baratas snapshot={cabecalho()} carregar={carregar} armazenamento={memoria({ [CHAVE_CODIGO_TOP15]: 'CIAAAABBBB' })} />)
    await screen.findByTestId('top15')
    expect(carregar).toHaveBeenCalledWith('CIAAAABBBB')
    expect(screen.queryByTestId('top15-codigo')).toBeNull()
  })

  it('código salvo que venceu (virou o mês): apaga, avisa e volta a pedir', async () => {
    const mem = memoria({ [CHAVE_CODIGO_TOP15]: 'CIANTIGOXX' })
    render(<Top15Baratas snapshot={cabecalho()} carregar={async () => ({ ok: false, motivo: 'invalido' })} armazenamento={mem} />)
    await screen.findByTestId('top15-codigo')
    expect(screen.getByRole('alert').textContent).toContain('venceu')
    expect(mem.d.has(CHAVE_CODIGO_TOP15)).toBe(false)
  })

  it('falha de rede com código salvo não apaga o código (a pessoa só está sem internet)', async () => {
    const mem = memoria({ [CHAVE_CODIGO_TOP15]: 'CIAAAABBBB' })
    render(<Top15Baratas snapshot={cabecalho()} carregar={async () => ({ ok: false, motivo: 'rede' })} armazenamento={mem} />)
    await screen.findByTestId('top15-codigo')
    expect(screen.getByRole('alert').textContent).toContain('internet')
    expect(mem.d.get(CHAVE_CODIGO_TOP15)).toBe('CIAAAABBBB')
  })

  it('limite de tentativas: mostra o aviso com os minutos', async () => {
    render(<Top15Baratas snapshot={cabecalho()} carregar={async () => ({ ok: false, motivo: 'limite', espera: 900 })} armazenamento={memoria()} />)
    await screen.findByTestId('top15-codigo')
    digitar('CIAAAABBBB')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('15 minutos'))
  })

  it('não publicado: nem pede código, mostra "em validação"', () => {
    render(<Top15Baratas snapshot={snapshot({ publicado: false, acessoRestrito: true, ranking: [] })} carregar={vi.fn()} armazenamento={memoria()} />)
    expect(screen.getByTestId('top15-validacao')).toBeTruthy()
    expect(screen.queryByTestId('top15-codigo')).toBeNull()
  })

  it('o arquivo de dados que vai no app NÃO contém ranking: só o cabeçalho com acesso por código', () => {
    // Vale para o arquivo real do repositório, em qualquer momento (antes ou depois da 1ª execução do job).
    expect(SNAPSHOT_ACOES_BARATAS.ranking).toEqual([])
    expect(SNAPSHOT_ACOES_BARATAS.exclusoes).toEqual([])
  })
})
