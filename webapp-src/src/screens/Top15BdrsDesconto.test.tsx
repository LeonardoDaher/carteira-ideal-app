import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Top15BdrsDesconto } from './Top15BdrsDesconto'
import { SimuleBdr } from './SimuleBdr'
import type { ItemBdrTop, SnapshotBdrsDesconto } from '../domain/top15Mercado'
import { CHAVE_CODIGO_TOP15, CHAVE_CODIGO_TOP15_BDRS, CHAVE_CODIGO_TOP15_FIIS } from '../domain/acessoTop15'
import type { RespostaTop15Bdrs } from '../domain/acessoTop15'
import type { AppCtx } from '../state/useAppState'

const item = (ticker: string, posicao: number | undefined, desconto: number, o: Partial<ItemBdrTop> = {}): ItemBdrTop => ({
  posicao, ticker, nome: `Empresa ${ticker}`, setor: 'Tecnologia', cotacao: 118.9, dataCotacao: '2026-10-05', maximaFechamento12m: 283.5, dataMaxima: '2025-10-16', desconto,
  variacao3m: -2.9, volumeMediano: 17_957_388, diasNegociados: 21, pregoesComDado: 252, acoesPorBdr: null, ...o,
})

const parametros = { janelaLiquidez: 21, janela3Meses: 63, janelaMaxima: 252, pregoesMinimosHistorico: 240, volumeMinimoDiario: 300_000, diasNegociadosMinimos: 15, pregoesMaxSemNegocio: 5, saltoQueda: 0.55, saltoAlta: 1.8, descontoParaConferir: 0.6 }

const snapshot = (o: Partial<SnapshotBdrsDesconto> = {}): SnapshotBdrsDesconto => ({
  publicado: true, acessoRestrito: false, instagram: 'acarteiraideal', versaoMetodologia: '1.0.0', geradoEm: '2026-10-08T12:00:00Z', dataExecucao: '2026-10-08', ultimoPregao: '2026-10-05',
  pastaAuditoria: 'auditoria/top15-bdrs/2026-10-08', hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64), tamanhoDaLista: 2, universo: 702, elegiveis: 64, aviso: null,
  parametros, contagens: { ranking: 3, aConferir: 1, exclusoes: 2 },
  ranking: [item('ORCL34', 1, 0.581), item('NIKE34', 2, 0.573, { variacao3m: 12.5 }), item('V1ST34', 3, 0.354)],
  aConferir: [item('NFLX34', undefined, 0.91, { alertas: ['salto_de_preco', 'desconto_extremo'], cotacao: 9.1, maximaFechamento12m: 101 })],
  exclusoes: [
    { ticker: 'AAPL34', nome: 'Apple', setor: 'Tecnologia', codigo: 'liquidez_baixa', motivo: 'Volume mediano de R$ 90.000 por dia (mínimo 300.000).' },
    { ticker: 'XPBR31', nome: 'XP Inc.', setor: 'Financeiro', codigo: 'excluido_manual', motivo: 'Empresa de origem ou operação brasileira.' },
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

describe('Top15BdrsDesconto (acesso aberto)', () => {
  it('sem aprovação ou sem lista mostra "em validação" e nenhum BDR', () => {
    const { unmount } = render(<Top15BdrsDesconto snapshot={snapshot({ publicado: false, ranking: [], aConferir: [], exclusoes: [] })} />)
    expect(screen.getByTestId('top15-bdrs-validacao').textContent).toContain('em validação')
    unmount()
    render(<Top15BdrsDesconto snapshot={snapshot({ ranking: [] })} />)
    expect(screen.getByTestId('top15-bdrs-validacao')).toBeTruthy()
  })

  it('lista o tamanho pedido, na ordem, com o desconto, a máxima e a conta do desconto', () => {
    render(<Top15BdrsDesconto snapshot={snapshot()} />)
    const itens = screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter((t) => t?.startsWith('top15-bdrs-'))
    expect(itens).toEqual(['top15-bdrs-ORCL34', 'top15-bdrs-NIKE34'])
    expect(screen.queryByTestId('top15-bdrs-V1ST34')).toBeNull()
    const c = within(screen.getByTestId('top15-bdrs-ORCL34'))
    expect(c.getByText(/1\. ORCL34/)).toBeTruthy()
    expect(c.getByTestId('desconto-ORCL34').textContent).toBe('58,1%')
    expect(c.getByText('R$ 283,50')).toBeTruthy()
    expect(c.getByText(/16\/10\/2025/)).toBeTruthy()
    expect(c.getByText(/desconto = 1 − R\$ 118,90 ÷ R\$ 283,50, em 252 pregões/)).toBeTruthy()
    expect(c.getByText('−2,9%')).toBeTruthy()
  })

  it('avisa que o preço já subiu em 3 meses quando o desconto vem de uma máxima antiga', () => {
    render(<Top15BdrsDesconto snapshot={snapshot()} />)
    expect(within(screen.getByTestId('top15-bdrs-NIKE34')).getByText(/O preço já subiu nos últimos 3 meses/)).toBeTruthy()
    expect(within(screen.getByTestId('top15-bdrs-ORCL34')).queryByText(/O preço já subiu/)).toBeNull()
  })

  it('diz no topo que é desconto de PREÇO, não de valor', () => {
    render(<Top15BdrsDesconto snapshot={snapshot()} />)
    const t = screen.getByTestId('top15-bdrs').textContent ?? ''
    expect(t).toContain('desconto de preço, não de valor')
    expect(t).toContain('Uma queda grande costuma ter motivo')
  })

  it('BDRs em conferência: fora do ranking, com cada alerta explicado', () => {
    render(<Top15BdrsDesconto snapshot={snapshot()} />)
    const caixa = within(screen.getByTestId('conferencia-NFLX34'))
    expect(caixa.getByText(/Salto de preço\./)).toBeTruthy()
    expect(caixa.getByText(/Desconto muito grande\./)).toBeTruthy()
    expect(caixa.getByText(/91,0% abaixo do maior fechamento/)).toBeTruthy()
    expect(screen.queryByTestId('top15-bdrs-NFLX34')).toBeNull()
    expect(screen.getByTestId('top15-bdrs-conferencia').textContent).toContain('não entram no ranking')
  })

  it('sem BDRs em conferência a seção não aparece', () => {
    render(<Top15BdrsDesconto snapshot={snapshot({ aConferir: [] })} />)
    expect(screen.queryByTestId('top15-bdrs-conferencia')).toBeNull()
  })

  it('"Por que um BDR ficou de fora?": busca, sem resultado e contagem por motivo', () => {
    render(<Top15BdrsDesconto snapshot={snapshot()} />)
    const busca = screen.getByLabelText('Buscar BDR fora da triagem')
    fireEvent.change(busca, { target: { value: 'apple' } })
    expect(screen.getByText(/Volume mediano de R\$ 90\.000 por dia/)).toBeTruthy()
    fireEvent.change(busca, { target: { value: 'zzzz' } })
    expect(screen.getByText(/Nenhum BDR fora do ranking com esse código ou nome/)).toBeTruthy()
    expect(screen.getByText('Pouca liquidez')).toBeTruthy()
    expect(screen.getByText('Empresa brasileira listada no exterior')).toBeTruthy()
  })

  it('como a lista é feita usa os parâmetros do arquivo e diz que não analisa balanço', () => {
    render(<Top15BdrsDesconto snapshot={snapshot()} />)
    const t = screen.getByText(/Quais BDRs\./).closest('ol')?.textContent ?? ''
    expect(t).toContain('31 a 35')
    expect(t).toContain('R$ 300 mil')
    expect(t).toContain('últimos 252 pregões')
    expect(t).toContain('45% para baixo ou 80% para cima')
    expect(t).toContain('desconto acima de 60%')
    expect(t).toContain('Não olha lucro, dívida')
  })

  it('auditoria e aviso (do arquivo ou o padrão, ambos "não é recomendação")', () => {
    const { unmount } = render(<Top15BdrsDesconto snapshot={snapshot({ aviso: 'Não é recomendação de investimento. Texto do arquivo.' })} />)
    expect(screen.getByText(/node scripts\/top15-mercado-verificar\.mjs auditoria\/top15-bdrs\/2026-10-08/)).toBeTruthy()
    expect(screen.getByText('aaaaaaaaaaaaaaaa…')).toBeTruthy()
    expect(screen.getByTestId('top15-bdrs-aviso').textContent).toBe('Não é recomendação de investimento. Texto do arquivo.')
    unmount()
    render(<Top15BdrsDesconto snapshot={snapshot()} />)
    expect(screen.getByTestId('top15-bdrs-aviso').textContent).toContain('Isso não é desconto de valor')
  })
})

describe('Top15BdrsDesconto com acesso por código (D70)', () => {
  const cabecalho = () => snapshot({ acessoRestrito: true, ranking: [], aConferir: [], exclusoes: [] })
  const completo = () => snapshot({ acessoRestrito: true })
  const digitar = (valor: string) => fireEvent.change(screen.getByLabelText('Código do mês'), { target: { value: valor } })

  it('sem código: pede o código, aponta o Instagram e NÃO mostra nenhum BDR', async () => {
    render(<Top15BdrsDesconto snapshot={cabecalho()} carregar={vi.fn()} armazenamento={memoria()} />)
    await screen.findByTestId('top15-bdrs-codigo')
    expect(screen.getByText('Top 15 BDRs com maior desconto: acesso por código')).toBeTruthy()
    expect(screen.getByRole('link', { name: '@acarteiraideal' }).getAttribute('href')).toBe('https://www.instagram.com/acarteiraideal/')
    expect(screen.queryByTestId('top15-bdrs')).toBeNull()
    expect(document.body.textContent).not.toMatch(/ORCL34|NFLX34/)
    expect((screen.getByRole('button', { name: 'Ver a lista' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('código errado: mostra o aviso, não salva e não libera a lista', async () => {
    const mem = memoria()
    const carregar = vi.fn(async (): Promise<RespostaTop15Bdrs> => ({ ok: false, motivo: 'invalido' }))
    render(<Top15BdrsDesconto snapshot={cabecalho()} carregar={carregar} armazenamento={mem} />)
    await screen.findByTestId('top15-bdrs-codigo')
    digitar('ciaaaabbbb')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Código inválido ou vencido')
    expect(carregar).toHaveBeenCalledWith('CIAAAABBBB')
    expect(mem.d.size).toBe(0)
    expect(screen.queryByTestId('top15-bdrs')).toBeNull()
  })

  it('código certo: libera a lista, salva na chave PRÓPRIA dos BDRs e oferece trocar', async () => {
    const mem = memoria()
    const carregar = vi.fn(async (): Promise<RespostaTop15Bdrs> => ({ ok: true, snapshot: completo() }))
    render(<Top15BdrsDesconto snapshot={cabecalho()} carregar={carregar} armazenamento={mem} />)
    await screen.findByTestId('top15-bdrs-codigo')
    digitar('CI-AAAA-BBBB')
    fireEvent.click(screen.getByRole('button', { name: 'Ver a lista' }))
    await screen.findByTestId('top15-bdrs')
    expect(screen.getByTestId('top15-bdrs-ORCL34')).toBeTruthy()
    expect([...mem.d.keys()]).toEqual([CHAVE_CODIGO_TOP15_BDRS])
    expect(mem.d.get(CHAVE_CODIGO_TOP15_BDRS)).toBe('CIAAAABBBB')
    fireEvent.click(screen.getByRole('button', { name: 'Sair e trocar o código' }))
    await screen.findByTestId('top15-bdrs-codigo')
    expect(mem.d.has(CHAVE_CODIGO_TOP15_BDRS)).toBe(false)
  })

  it('o código salvo das AÇÕES ou dos FIIs não abre os BDRs: a tela pede o código e não consulta o servidor', async () => {
    const carregar = vi.fn(async (): Promise<RespostaTop15Bdrs> => ({ ok: true, snapshot: completo() }))
    render(<Top15BdrsDesconto snapshot={cabecalho()} carregar={carregar} armazenamento={memoria({ [CHAVE_CODIGO_TOP15]: 'CIACOESSSS', [CHAVE_CODIGO_TOP15_FIIS]: 'CIFIISFIIS' })} />)
    await screen.findByTestId('top15-bdrs-codigo')
    expect(carregar).not.toHaveBeenCalled()
    expect(screen.queryByTestId('top15-bdrs')).toBeNull()
  })

  it('código dos BDRs já salvo abre a lista sozinho; se venceu, apaga só a chave dos BDRs, avisa e volta a pedir', async () => {
    const carregar = vi.fn(async (): Promise<RespostaTop15Bdrs> => ({ ok: true, snapshot: completo() }))
    const { unmount } = render(<Top15BdrsDesconto snapshot={cabecalho()} carregar={carregar} armazenamento={memoria({ [CHAVE_CODIGO_TOP15_BDRS]: 'CIAAAABBBB' })} />)
    await screen.findByTestId('top15-bdrs')
    expect(carregar).toHaveBeenCalledWith('CIAAAABBBB')
    unmount()
    const mem = memoria({ [CHAVE_CODIGO_TOP15_BDRS]: 'CIANTIGOXX', [CHAVE_CODIGO_TOP15]: 'CIACOESSSS' })
    render(<Top15BdrsDesconto snapshot={cabecalho()} carregar={async () => ({ ok: false, motivo: 'invalido' })} armazenamento={mem} />)
    await screen.findByTestId('top15-bdrs-codigo')
    expect(screen.getByRole('alert').textContent).toContain('venceu')
    expect(mem.d.has(CHAVE_CODIGO_TOP15_BDRS)).toBe(false)
    expect(mem.d.get(CHAVE_CODIGO_TOP15)).toBe('CIACOESSSS')
  })
})

describe('Top15BdrsDesconto dentro do Simule BDR', () => {
  const ctx = { screen: 'simuleBdr', setScreen: vi.fn() } as unknown as AppCtx
  const vazio = { geradoEm: null, dataPregao: null, fonte: null, pregoesNoHistorico: 0, sessoesLiquidez: 21, criterio: null, acoes: [], etfs: [], busca: [] }

  it('abre no simulador; a segunda aba leva ao Top 15 e dá para voltar', async () => {
    render(<SimuleBdr ctx={ctx} snapshot={vazio as never} />)
    expect(screen.getByRole('tab', { name: /Simulador/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Os dados dos BDRs ainda não foram carregados.')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 maior desconto/ }))
    expect(screen.getByRole('tab', { name: /Top 15 maior desconto/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('Os dados dos BDRs ainda não foram carregados.')).toBeNull()
    // publicado com código: a tela confere primeiro o código salvo no aparelho e só então mostra o portão
    expect(await screen.findByTestId('top15-bdrs-codigo')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.getByText('Os dados dos BDRs ainda não foram carregados.')).toBeTruthy()
  })
})
