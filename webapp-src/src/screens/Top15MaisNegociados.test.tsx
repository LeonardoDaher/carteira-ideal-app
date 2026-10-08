import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TEXTOS, Top15MaisNegociados } from './Top15MaisNegociados'
import type { ClasseMaisNegociados } from './Top15MaisNegociados'
import { SimuleFii } from './SimuleFii'
import { SimuleAcoes } from './SimuleAcoes'
import { SimuleBdr } from './SimuleBdr'
import type { ItemEtfTop, SnapshotMaisNegociados } from '../domain/top15Mercado'
import type { AppCtx } from '../state/useAppState'

const item = (ticker: string, posicaoGeral: number, o: Partial<ItemEtfTop> = {}): ItemEtfTop => ({
  ticker, nome: `Ativo ${ticker}`, categoria: 'Logística', volumeMediano: 90_000_000 / posicaoGeral, volumeMedio: 95_000_000 / posicaoGeral, diasNegociados: 21,
  cotacao: 48.49, dataCotacao: '2026-10-07', variacao3m: 4.2, posicaoGeral, ...o,
})

const snapshot = (janela3Meses: number, o: Partial<SnapshotMaisNegociados> = {}): SnapshotMaisNegociados => ({
  publicado: true, versaoMetodologia: '1.0.0', geradoEm: '2026-10-08T12:00:00Z', dataExecucao: '2026-10-08', ultimoPregao: '2026-10-07', pastaAuditoria: 'auditoria/top15-x/2026-10-08',
  hashResultado: 'a'.repeat(64), hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64), tamanhoDaLista: 2, universo: 202, elegiveis: 75, aviso: null,
  parametros: { tamanhoPorCategoria: 5, janelaLiquidez: 21, janela3Meses, volumeMinimoDiario: 300_000, diasNegociadosMinimos: 15, pregoesMaxSemNegocio: 5 },
  geral: [item('AAAA11', 1), item('BBBB11', 2, { categoria: 'Shoppings', variacao3m: -1.5 }), item('CCCC11', 3)],
  porCategoria: {
    Logística: [item('AAAA11', 1, { posicaoNaCategoria: 1 }), item('CCCC11', 3, { posicaoNaCategoria: 2 })],
    Shoppings: [item('BBBB11', 2, { categoria: 'Shoppings', posicaoNaCategoria: 1 })],
  },
  exclusoes: [{ ticker: 'ZZZZ11', nome: 'Zeta Fundo', categoria: 'Outros', codigo: 'liquidez_baixa', motivo: 'Volume mediano de R$ 120.000 por dia (mínimo 300.000).' }],
  ...o,
})

const CLASSES: ClasseMaisNegociados[] = ['fiis', 'acoes', 'bdrs']

describe.each(CLASSES)('Top15MaisNegociados (%s): ranking aberto por volume', (classe) => {
  const t = TEXTOS[classe]
  const janela = classe === 'fiis' ? 60 : 63

  it('sem aprovação ou sem lista mostra "em validação" e nenhum ativo', () => {
    const { unmount } = render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela, { publicado: false, geral: [], porCategoria: {}, exclusoes: [] })} />)
    expect(screen.getByTestId(`${t.id}-validacao`).textContent).toContain('em validação')
    expect(screen.queryByTestId(t.id)).toBeNull()
    unmount()
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela, { geral: [] })} />)
    expect(screen.getByTestId(`${t.id}-validacao`)).toBeTruthy()
  })

  it('lista só o tamanho pedido, na ordem, com os dados de liquidez, sem código de acesso', () => {
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela)} />)
    const ids = screen.getAllByRole('listitem').map((l) => l.dataset.testid).filter((x) => x?.startsWith(`${t.id}-A`) || x?.startsWith(`${t.id}-B`) || x?.startsWith(`${t.id}-C`))
    expect(ids).toEqual([`${t.id}-AAAA11`, `${t.id}-BBBB11`])
    expect(screen.queryByTestId(`${t.id}-CCCC11`)).toBeNull()
    const c = within(screen.getByTestId(`${t.id}-AAAA11`))
    expect(c.getByText(/1\. AAAA11/)).toBeTruthy()
    expect(c.getByText('R$ 90,0 mi')).toBeTruthy()
    expect(c.getByText('21 de 21 pregões')).toBeTruthy()
    expect(c.getByText('+4,2%')).toBeTruthy()
    expect(within(screen.getByTestId(`${t.id}-BBBB11`)).getByText('−1,5%')).toBeTruthy()
    expect(screen.queryByLabelText('Código do mês')).toBeNull()
  })

  it('título, resumo e a frase "não quer dizer melhor" são da classe; diz que é liquidez', () => {
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela)} />)
    const texto = screen.getByTestId(t.id).textContent ?? ''
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(t.tituloTop(2))
    expect(texto).toContain('liquidez')
    expect(texto).toMatch(/Mais negociad[oa] não quer dizer melhor/)
    expect(texto).toContain(`${t.analisados}, 75 passaram nos filtros`)
  })

  it('a variação usa a janela do arquivo: "3 meses" com 63 pregões, "N pregões" nos demais', () => {
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela)} />)
    const rotulo = janela === 63 ? 'Variação em 3 meses' : 'Variação em 60 pregões'
    expect(within(screen.getByTestId(`${t.id}-AAAA11`)).getByText(rotulo)).toBeTruthy()
  })

  it(`mais negociados de cada ${t.categoria}, com a posição dentro dela`, () => {
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela)} />)
    expect(screen.getByText(`Os mais negociados de cada ${t.categoria}`)).toBeTruthy()
    const caixa = within(screen.getByTestId(`${t.id}-categorias`))
    expect(caixa.getByTestId('categoria-Logística-CCCC11').textContent).toContain('2. CCCC11')
    expect(caixa.getByTestId('categoria-Shoppings-BBBB11').textContent).toContain('1. BBBB11')
  })

  it('"Por que ficou de fora?": busca com o texto da classe (artigo, exemplo e gênero), sem resultado e contagem', () => {
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela)} />)
    expect(screen.getByText(`Por que ${t.umaSingular} ficou de fora?`)).toBeTruthy()
    const busca = screen.getByLabelText(`Buscar ${t.singular} fora do ranking`)
    expect(busca.getAttribute('placeholder')).toBe(`Código ou nome, ex.: ${t.exemplo}`)
    fireEvent.change(busca, { target: { value: 'zeta' } })
    expect(screen.getByText(/Volume mediano de R\$ 120\.000 por dia/)).toBeTruthy()
    fireEvent.change(busca, { target: { value: 'qqqq' } })
    expect(screen.getByText(new RegExp(`${t.nenhum} fora do ranking com esse código ou nome. Se ${t.ele} está no app`))).toBeTruthy()
    expect(screen.getByText('Pouca liquidez')).toBeTruthy()
  })

  it('como a lista é feita usa os parâmetros do arquivo e diz o que o ranking NÃO mede', () => {
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela)} />)
    const ol = screen.getByText(/Volume por dia\./).closest('ol')?.textContent ?? ''
    expect(ol).toContain(`Para cada ${t.singular}`)
    expect(ol).toContain('R$ 300 mil')
    expect(ol).toContain('pelo menos 15 dos 21 pregões')
    expect(ol).toContain('no máximo 5 pregões')
    expect(ol).toContain('O que este ranking não é.')
    expect(ol).toContain(t.naoMede)
    if (t.filtroExtra) expect(ol).toContain(t.filtroExtra)
  })

  it('auditoria e aviso: comando de verificação da pasta do arquivo; aviso do arquivo ou o padrão, ambos "não é recomendação"', () => {
    const { unmount } = render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela, { aviso: 'Não é recomendação de investimento. Texto do arquivo.' })} />)
    expect(screen.getByText(/node scripts\/top15-mercado-verificar\.mjs auditoria\/top15-x\/2026-10-08/)).toBeTruthy()
    expect(screen.getByText('aaaaaaaaaaaaaaaa…')).toBeTruthy()
    expect(screen.getByTestId(`${t.id}-aviso`).textContent).toBe('Não é recomendação de investimento. Texto do arquivo.')
    unmount()
    render(<Top15MaisNegociados classe={classe} snapshot={snapshot(janela)} />)
    expect(screen.getByTestId(`${t.id}-aviso`).textContent).toContain('Não é recomendação de investimento.')
    expect(screen.getByTestId(`${t.id}-aviso`).textContent).toContain('é liquidez')
  })
})

describe('Top15MaisNegociados: os quatro rankings não se confundem', () => {
  it('cada classe tem seu prefixo de teste e seu texto (o dos FIIs não colide com o "Top 15 FIIs baratos")', () => {
    const ids = Object.values(TEXTOS).map((x) => x.id)
    expect(new Set(ids).size).toBe(4)
    expect(TEXTOS.fiis.id).not.toBe('top15-fiis')
    expect(TEXTOS.etfs.id).toBe('top15-etfs')
    expect(TEXTOS.acoes.tituloTop(15)).toBe('As 15 ações mais negociadas')
    expect(TEXTOS.bdrs.filtroExtra).toContain('origem ou operação brasileira')
    expect(TEXTOS.acoes.nenhum).toBe('Nenhuma ação')
  })
})

describe('abas "Top 15 mais negociados" nas telas de simulação', () => {
  const ctx = { screen: 'x', setScreen: vi.fn() } as unknown as AppCtx

  it('Simule FII: três abas; a terceira abre o ranking e dá para voltar ao simulador', () => {
    render(<SimuleFii ctx={ctx} snapshot={{ geradoEm: null, vigenciaIfix: null, fundos: [] } as never} />)
    expect(screen.getAllByRole('tab').map((x) => x.textContent?.replace(/^\S+\s*/, '').slice(0, 24))).toHaveLength(3)
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais negociados/ }))
    expect(screen.getByRole('tab', { name: /Top 15 mais negociados/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('top15-fiis-negociados-validacao') ?? screen.queryByTestId('top15-fiis-negociados')).toBeTruthy()
    expect(screen.queryByTestId('top15-fiis-validacao')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais baratos/ }))
    expect(screen.queryByTestId('top15-fiis-negociados-validacao')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.getByText('Os dados deste mês ainda não foram carregados.')).toBeTruthy()
  })

  it('Simule Ações: três abas; a terceira abre o ranking de ações mais negociadas', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, fonte: null, cadastroId: null, pregoesNoHistorico: 0, sessoesLiquidez: 21, totais: { setores: 0, empresas: 0 }, gruposOrdem: [], setores: [], busca: [] } as never} />)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais negociadas/ }))
    expect(screen.getByRole('tab', { name: /Top 15 mais negociadas/ }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByTestId('top15-acoes-negociadas-validacao') ?? screen.queryByTestId('top15-acoes-negociadas')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.getByText('Os dados das ações ainda não foram carregados.')).toBeTruthy()
  })

  it('Simule BDR: três abas (simulador, maior desconto, mais negociados), cada uma com o seu ranking', () => {
    render(<SimuleBdr ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, fonte: null, pregoesNoHistorico: 0, sessoesLiquidez: 21, criterio: null, acoes: [], etfs: [], busca: [] } as never} />)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais negociados/ }))
    expect(screen.queryByTestId('top15-bdrs-negociados-validacao') ?? screen.queryByTestId('top15-bdrs-negociados')).toBeTruthy()
    expect(screen.queryByTestId('top15-bdrs-validacao') ?? screen.queryByTestId('top15-bdrs-codigo')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 maior desconto/ }))
    expect(screen.queryByTestId('top15-bdrs-validacao') ?? screen.queryByTestId('top15-bdrs-codigo')).toBeTruthy()
    expect(screen.queryByTestId('top15-bdrs-negociados-validacao')).toBeNull()
  })
})
