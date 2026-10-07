import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Top15FiisBaratos } from './Top15FiisBaratos'
import { SimuleFii } from './SimuleFii'
import type { ItemFii, SnapshotFiiBaratos } from '../domain/fiiBaratos'
import { CHAVE_CODIGO_TOP15, CHAVE_CODIGO_TOP15_FIIS } from '../domain/acessoTop15'
import type { RespostaTop15Fiis } from '../domain/acessoTop15'
import type { AppCtx } from '../state/useAppState'

const item = (ticker: string, posicao: number, tipo: 'tijolo' | 'papel' = 'tijolo', o: Partial<ItemFii> = {}): ItemFii => ({
  posicao, ticker, nome: `Fundo ${ticker}`, setorDeclarado: 'Multicategoria', cnpj: '00000000000000', tipo, nota: 1 - posicao / 100,
  pvp: 0.7363, dy12: 0.1234, dyRecente: 0.105, razaoRendimentoRecente: 0.98, picoDeRendimento: 1.02, cotacao: 48.49, dataCotacao: '2026-10-06', vp: 106.64, rendimento12m: 9.73,
  rentabPatrimonial12m: -0.02, patrimonio: 2.5e9, cotistas: 127096, alavancagem: 0.02, volumeMedio: 3.8e6, volumeMediano: 3.08e6, volumeLiquidez: 3.08e6, fonteLiquidez: 'mediana',
  fonteCotacao: 'B3 (boletim diário)', saltoMaximo: 0.05, fatias: { imoveis: 0.94, recebiveis: 0.01, cotas: 0.04 }, mesesComDados: 12, alertas: [], ...o,
})

const filtro = { volumeMinimoDiario: 300_000, patrimonioMinimo: 200e6, cotistasMinimos: 3000, rentabPatrimonial12mMinima: -0.15, alavancagemMaxima: 0.4, pvpMinimo: 0.3 }

const snapshot = (o: Partial<SnapshotFiiBaratos> = {}): SnapshotFiiBaratos => ({
  publicado: true, versaoMetodologia: '1.4.1', geradoEm: '2026-10-07T16:17:00Z', dataExecucao: '2026-10-07', dataCotacoes: '2026-10-07', ultimoPregaoDiario: '2026-10-06', competenciaReferencia: '2026-08',
  pastaAuditoria: 'auditoria/fii-baratos/2026-10-07', hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64), tamanhoDaLista: 3, universo: 218, aviso: null,
  parametros: {
    filtros: { tijolo: filtro, papel: { ...filtro, patrimonioMinimo: 150e6, rentabPatrimonial12mMinima: -0.05, pvpMinimo: 0.7, dy12Maximo: 0.25 } },
    classificacao: { fatiaMinimaDoTipo: 0.6 },
    alertas: { pvpMuitoBaixo: 0.55, dy12Alto: 0.18, rendimentoRecenteMinimoSobre12m: 0.75, picoDeRendimentoMaximo: 1.25, saltoDePrecoDiario: 0.25 },
    mesesHistorico: 12, pregoesPrecoDiario: 21, conferenciaValidadeDias: 90,
  },
  contagens: { tijolo: 5, papel: 2, aConferir: 1, exclusoes: 2 },
  tijolo: [item('AAAA11', 1), item('BBBB11', 2, 'tijolo', { conferido: { em: '2026-10-07', fonte: 'Investidor10', nota: 'Dados batem com a CVM.' }, alertasLiberados: ['pvp_muito_baixo'] }), item('CCCC11', 3), item('DDDD11', 4), item('EEEE11', 5)],
  papel: [item('PPPP11', 1, 'papel', { fonteCotacao: 'brapi (histórico diário)' }), item('QQQQ11', 2, 'papel')],
  aConferir: [item('MFII11', 0, 'tijolo', { posicao: null, alertas: ['pvp_muito_baixo', 'rendimento_em_queda'], grupo: 'tijolo', pvp: 0.38, dy12: 0.2741 })],
  exclusoes: [
    { ticker: 'HGLG11', nome: 'Pátria Log', setor: 'Logística', etapa: 'tijolo', codigo: 'liquidez_baixa', motivo: 'volume mediano de R$ 120.000 por dia (mínimo 300.000)' },
    { ticker: 'XXXX11', nome: 'Fundo de Fundos X', setor: 'Fundo de fundos', etapa: 'classificacao', codigo: 'fundo_de_fundos', motivo: 'imóveis 0%, recebíveis 0%, cotas 95%' },
  ],
  ...o,
})

const memoria = (inicial: Record<string, string> = {}) => {
  const d = new Map(Object.entries(inicial))
  return {
    d,
    getItem: async (k: string) => d.get(k) ?? null,
    setItem: async (k: string, v: string) => void d.set(k, v),
    removeItem: async (k: string) => void d.delete(k),
  }
}

describe('Top15FiisBaratos', () => {
  it('sem aprovação (publicado=false) mostra "em validação" e nenhum fundo', () => {
    render(<Top15FiisBaratos snapshot={snapshot({ publicado: false, tijolo: [], papel: [], aConferir: [], exclusoes: [] })} />)
    expect(screen.getByTestId('top15-fiis-validacao').textContent).toContain('em validação')
    expect(screen.queryByTestId('top15-fiis')).toBeNull()
  })

  it('lista de tijolo primeiro: só o tamanho pedido, na ordem do ranking, com P/VP e os dois rendimentos', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    const itens = screen.getAllByRole('listitem').filter((l) => l.dataset.testid?.startsWith('top15-fiis-'))
    expect(itens.map((l) => l.dataset.testid)).toEqual(['top15-fiis-AAAA11', 'top15-fiis-BBBB11', 'top15-fiis-CCCC11'])
    const primeiro = within(itens[0])
    expect(primeiro.getByText(/1\. AAAA11/)).toBeTruthy()
    expect(primeiro.getAllByText('0,74').length).toBeGreaterThan(0)
    expect(primeiro.getAllByText('12,3%').length).toBeGreaterThan(0)
    expect(primeiro.getAllByText('10,5%').length).toBeGreaterThan(0)
    expect(primeiro.getByText(/Patrimônio R\$ 2,5 bi/)).toBeTruthy()
    // nenhum fundo de papel na aba de tijolo
    expect(screen.queryByTestId('top15-fiis-PPPP11')).toBeNull()
  })

  it('aba Papel troca a lista inteira e mostra a origem do preço de cada fundo', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    expect(screen.getByRole('tab', { name: /Tijolo/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: /Papel/ }))
    expect(screen.getByRole('tab', { name: /Papel/ }).getAttribute('aria-selected')).toBe('true')
    const ids = screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter((i) => i?.startsWith('top15-fiis-'))
    expect(ids).toEqual(['top15-fiis-PPPP11', 'top15-fiis-QQQQ11'])
    expect(screen.queryByTestId('top15-fiis-AAAA11')).toBeNull()
    expect(within(screen.getByTestId('top15-fiis-PPPP11')).getByText(/brapi \(histórico diário\)/)).toBeTruthy()
    expect(within(screen.getByTestId('top15-fiis-QQQQ11')).getByText(/B3 \(boletim diário\)/)).toBeTruthy()
  })

  it('grupo sem fundos explica, em vez de mostrar uma lista vazia', () => {
    render(<Top15FiisBaratos snapshot={snapshot({ papel: [] })} />)
    fireEvent.click(screen.getByRole('tab', { name: /Papel/ }))
    expect(screen.getByRole('status').textContent).toContain('Nenhum fundo de papel passou')
  })

  it('fundo conferido manualmente mostra quem, quando, a fonte e até quando vale, sem prometer qualidade', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    const t = screen.getByTestId('conferido-BBBB11').textContent ?? ''
    expect(t).toContain('conferido em 07/10/2026')
    expect(t).toContain('vale até 05/01/2027')
    expect(t).toContain('Investidor10')
    expect(t).toContain('não a qualidade do fundo')
    expect(screen.queryByTestId('conferido-AAAA11')).toBeNull()
  })

  it('memória de cálculo: origem da cotação, valor patrimonial, estimativa do rendimento, composição do ativo e a fonte da liquidez', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    const c = within(screen.getByTestId('top15-fiis-AAAA11'))
    expect(c.getByText(/B3 \(boletim diário\), 06\/10\/2026/)).toBeTruthy()
    expect(c.getByText(/patrimônio líquido ÷ cotas emitidas/)).toBeTruthy()
    expect(c.getByText(/estimado: rendimento do mês \(informe\) × valor patrimonial, 12 meses com dado/)).toBeTruthy()
    expect(c.getByText(/imóveis 94% · recebíveis 1% · cotas 4%/)).toBeTruthy()
    expect(c.getByText(/mediana do volume diário dos últimos 21 pregões/)).toBeTruthy()
  })

  it('fundos em conferência: ficam fora das listas e aparecem com cada alerta explicado', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    const caixa = within(screen.getByTestId('conferencia-MFII11'))
    expect(caixa.getByText(/P\/VP muito baixo\./)).toBeTruthy()
    expect(caixa.getByText(/Rendimento em queda\./)).toBeTruthy()
    expect(caixa.getByText(/P\/VP 0,38 · rendimento de 12 meses 27,4%/)).toBeTruthy()
    expect(screen.queryByTestId('top15-fiis-MFII11')).toBeNull()
    expect(screen.getByTestId('top15-fiis-conferencia').textContent).toContain('não entram no ranking')
  })

  it('sem fundos em conferência a seção não aparece', () => {
    render(<Top15FiisBaratos snapshot={snapshot({ aConferir: [] })} />)
    expect(screen.queryByTestId('top15-fiis-conferencia')).toBeNull()
  })

  it('"Por que um fundo ficou de fora?": busca por código e por nome, mensagem sem resultado e contagem por motivo', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    const busca = screen.getByLabelText('Buscar fundo fora da triagem')
    fireEvent.change(busca, { target: { value: 'hglg' } })
    expect(screen.getByText(/volume mediano de R\$ 120\.000 por dia/)).toBeTruthy()
    fireEvent.change(busca, { target: { value: 'fundo de fundos' } })
    expect(screen.getByText(/cotas 95%/)).toBeTruthy()
    fireEvent.change(busca, { target: { value: 'zzzz' } })
    expect(screen.getByText(/Nenhum fundo fora do ranking com esse código ou nome/)).toBeTruthy()
    expect(screen.getByText('Pouca liquidez')).toBeTruthy()
    expect(screen.getByText('Fundo de fundos (investe em cotas de outros fundos)')).toBeTruthy()
  })

  it('auditoria: pasta, comando para refazer o cálculo e impressões digitais', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    expect(screen.getByText(/node scripts\/fii-baratos-verificar\.mjs auditoria\/fii-baratos\/2026-10-07/)).toBeTruthy()
    expect(screen.getByText('aaaaaaaaaaaaaaaa…')).toBeTruthy()
    expect(screen.getByText('bbbbbbbbbbbbbbbb…')).toBeTruthy()
  })

  it('como a lista é feita: usa os parâmetros do próprio arquivo (liquidez, P/VP mínimo do papel, validade da conferência)', () => {
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    const t = screen.getByText(/Tijolo ou papel pelo que o fundo tem/).closest('ol')?.textContent ?? ''
    expect(t).toContain('R$ 300 mil')
    expect(t).toContain('P/VP de 0,70 ou mais')
    expect(t).toContain('a conferência vale 90 dias')
    expect(t).toContain('rendimento por cota é estimado')
  })

  it('aviso: usa o texto do arquivo e, se não houver, o texto padrão; nos dois casos diz que não é recomendação', () => {
    const { unmount } = render(<Top15FiisBaratos snapshot={snapshot({ aviso: 'Não é recomendação de investimento. Texto do arquivo.' })} />)
    expect(screen.getByTestId('top15-fiis-aviso').textContent).toBe('Não é recomendação de investimento. Texto do arquivo.')
    unmount()
    render(<Top15FiisBaratos snapshot={snapshot()} />)
    expect(screen.getByTestId('top15-fiis-aviso').textContent).toContain('Não é recomendação de investimento.')
    expect(screen.getByTestId('top15-fiis-aviso').textContent).toContain('Converse com um profissional certificado')
  })
})

describe('Top15FiisBaratos com acesso por código (D50 e D65)', () => {
  const cabecalho = () => snapshot({ acessoRestrito: true, instagram: 'acarteiraideal', tijolo: [], papel: [], aConferir: [], exclusoes: [] })
  const completo = () => snapshot({ acessoRestrito: true, instagram: 'acarteiraideal' })
  const digitar = (valor: string) => fireEvent.change(screen.getByLabelText('Código do mês'), { target: { value: valor } })

  it('sem código: pede o código, aponta o Instagram e NÃO mostra nenhum fundo', async () => {
    render(<Top15FiisBaratos snapshot={cabecalho()} carregar={vi.fn()} armazenamento={memoria()} />)
    await screen.findByTestId('top15-fiis-codigo')
    expect(screen.getByText('Top 15 FIIs baratos: acesso por código')).toBeTruthy()
    const link = screen.getByRole('link', { name: '@acarteiraideal' })
    expect(link.getAttribute('href')).toBe('https://www.instagram.com/acarteiraideal/')
    expect(screen.queryByTestId('top15-fiis')).toBeNull()
    expect(document.body.textContent).not.toMatch(/AAAA11|MFII11/)
    expect((screen.getByRole('button', { name: 'Ver a lista' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('código errado: mostra o aviso, não salva e não libera a lista', async () => {
    const mem = memoria()
    const carregar = vi.fn(async (): Promise<RespostaTop15Fiis> => ({ ok: false, motivo: 'invalido' }))
    render(<Top15FiisBaratos snapshot={cabecalho()} carregar={carregar} armazenamento={mem} />)
    await screen.findByTestId('top15-fiis-codigo')
    digitar('ciaaaabbbb')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Código inválido ou vencido')
    expect(carregar).toHaveBeenCalledWith('CIAAAABBBB')
    expect(mem.d.size).toBe(0)
    expect(screen.queryByTestId('top15-fiis')).toBeNull()
  })

  it('código certo: libera a lista, salva o código (em chave própria dos FIIs) e oferece trocar', async () => {
    const mem = memoria()
    const carregar = vi.fn(async (): Promise<RespostaTop15Fiis> => ({ ok: true, snapshot: completo() }))
    render(<Top15FiisBaratos snapshot={cabecalho()} carregar={carregar} armazenamento={mem} />)
    await screen.findByTestId('top15-fiis-codigo')
    digitar('CI-AAAA-BBBB')
    expect((screen.getByLabelText('Código do mês') as HTMLInputElement).value).toBe('CI-AAAA-BBBB')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    await screen.findByTestId('top15-fiis')
    expect(screen.getByTestId('top15-fiis-AAAA11')).toBeTruthy()
    expect(mem.d.get(CHAVE_CODIGO_TOP15_FIIS)).toBe('CIAAAABBBB')
    fireEvent.click(screen.getByRole('button', { name: 'Sair e trocar o código' }))
    await screen.findByTestId('top15-fiis-codigo')
    expect(mem.d.has(CHAVE_CODIGO_TOP15_FIIS)).toBe(false)
    expect(screen.queryByTestId('top15-fiis')).toBeNull()
  })

  it('o código salvo das AÇÕES não abre os FIIs (D66): a tela pede o código dos FIIs e não consulta o servidor com o outro', async () => {
    const carregar = vi.fn(async (): Promise<RespostaTop15Fiis> => ({ ok: true, snapshot: completo() }))
    render(<Top15FiisBaratos snapshot={cabecalho()} carregar={carregar} armazenamento={memoria({ [CHAVE_CODIGO_TOP15]: 'CIACOESSSS' })} />)
    await screen.findByTestId('top15-fiis-codigo')
    expect(carregar).not.toHaveBeenCalled()
    expect(screen.queryByTestId('top15-fiis')).toBeNull()
  })

  it('código dos FIIs já salvo abre a lista sozinho, sem pedir de novo', async () => {
    const carregar = vi.fn(async (): Promise<RespostaTop15Fiis> => ({ ok: true, snapshot: completo() }))
    render(<Top15FiisBaratos snapshot={cabecalho()} carregar={carregar} armazenamento={memoria({ [CHAVE_CODIGO_TOP15_FIIS]: 'CIAAAABBBB' })} />)
    await screen.findByTestId('top15-fiis')
    expect(carregar).toHaveBeenCalledWith('CIAAAABBBB')
    expect(screen.queryByTestId('top15-fiis-codigo')).toBeNull()
  })

  it('código salvo que venceu: apaga, avisa e volta a pedir; falha de rede com código salvo não apaga o código', async () => {
    const mem = memoria({ [CHAVE_CODIGO_TOP15_FIIS]: 'CIANTIGOXX' })
    const { unmount } = render(<Top15FiisBaratos snapshot={cabecalho()} carregar={async () => ({ ok: false, motivo: 'invalido' })} armazenamento={mem} />)
    await screen.findByTestId('top15-fiis-codigo')
    expect(screen.getByRole('alert').textContent).toContain('venceu')
    expect(mem.d.has(CHAVE_CODIGO_TOP15_FIIS)).toBe(false)
    unmount()
    const mem2 = memoria({ [CHAVE_CODIGO_TOP15_FIIS]: 'CIBOMBOMXX' })
    render(<Top15FiisBaratos snapshot={cabecalho()} carregar={async () => ({ ok: false, motivo: 'rede' })} armazenamento={mem2} />)
    await screen.findByTestId('top15-fiis-codigo')
    expect(mem2.d.get(CHAVE_CODIGO_TOP15_FIIS)).toBe('CIBOMBOMXX')
    expect(screen.getByRole('alert').textContent).toContain('conectar')
  })
})

describe('Top15FiisBaratos dentro do Simule FII', () => {
  const ctx = { screen: 'simuleFii', setScreen: vi.fn() } as unknown as AppCtx
  const vazio = { geradoEm: null, vigenciaIfix: null, fundos: [] }

  it('abre no simulador e a segunda aba leva ao Top 15 (ainda "em validação" enquanto o arquivo do app não é publicado)', () => {
    render(<SimuleFii ctx={ctx} snapshot={vazio} />)
    expect(screen.getByRole('tab', { name: /Simulador/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Simule sua renda com FIIs' })).toBeTruthy()
    expect(screen.getByText('Os dados deste mês ainda não foram carregados.')).toBeTruthy()
    expect(screen.queryByTestId('top15-fiis-validacao')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais baratos/ }))
    expect(screen.getByRole('tab', { name: /Top 15 mais baratos/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('Os dados deste mês ainda não foram carregados.')).toBeNull()
    // com o app ainda sem publicação, a aba mostra o texto de validação; depois de publicado, mostra o portão do código
    expect(screen.queryByTestId('top15-fiis-validacao') ?? screen.queryByTestId('top15-fiis-codigo') ?? screen.queryByRole('status')).toBeTruthy()
    // voltar ao simulador
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.getByText('Os dados deste mês ainda não foram carregados.')).toBeTruthy()
  })
})
