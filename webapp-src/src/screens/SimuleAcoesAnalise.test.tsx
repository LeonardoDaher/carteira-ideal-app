import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleAcoes } from './SimuleAcoes'
import type { SnapshotAcoes } from '../domain/acoes'
import type { HistoricoLongo, SnapshotSeries, PontoSerie } from '../domain/analiseTecnica'
import type { EmpresaFundamentos, PeriodoFundamental, SnapshotFundamentos } from '../domain/analiseFundamentalista'
import type { AppCtx } from '../state/useAppState'

const ctx = { screen: 'x', setScreen: vi.fn() } as unknown as AppCtx

function datas(n: number): string[] {
  const saida: string[] = []
  const d = new Date('2025-10-06T12:00:00Z')
  while (saida.length < n) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) saida.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return saida
}

const N = 260
const pregoes = datas(N)
const subindo: PontoSerie[] = Array.from({ length: N }, (_, i) => {
  const c = 20 + i * 0.1 + Math.sin(i / 3) * 0.3
  return [c, c * 0.99, c * 1.01, 30_000]
})

const series: SnapshotSeries = {
  geradoEm: '2026-10-21T00:00:00Z',
  dataPregao: pregoes[N - 1],
  fonte: 'B3',
  pregoes,
  referencia: null,
  alertas: {},
  ativos: { ALFA3: subindo },
}

const ultimoPreco = (subindo[N - 1] as [number, number, number, number])[0]

const snapshot: SnapshotAcoes = {
  geradoEm: '2026-10-21T08:00:00.000Z',
  dataPregao: pregoes[N - 1],
  fonte: 'B3',
  cadastroId: 'x',
  pregoesNoHistorico: N,
  sessoesLiquidez: 21,
  totais: { setores: 1, empresas: 2 },
  gruposOrdem: ['Grupo'],
  setores: [
    {
      setor: 'Indústria',
      grupoB3: 'Grupo',
      empresas: [
        { ticker: 'ALFA3', nome: 'Alfa', cotacao: ultimoPreco, dataCotacao: pregoes[N - 1], variacao3m: 5, variacaoDia: 0.2, volumeMedio: 30_000_000, minima52: 18, maxima52: 46 },
        { ticker: 'BETA3', nome: 'Beta', cotacao: 12, dataCotacao: pregoes[N - 1], variacao3m: 1, variacaoDia: 0, volumeMedio: 10_000_000, minima52: 10, maxima52: 14 },
      ],
    },
  ],
  busca: [{ ticker: 'ZETA3', nome: 'Zeta', setor: 'Outros', cotacao: 5, dataCotacao: pregoes[N - 1], volumeDia: 100 }],
} as unknown as SnapshotAcoes

function periodo(p: Partial<PeriodoFundamental>): PeriodoFundamental {
  return {
    consolidacao: 'consolidada', receita: 1_000_000, lucroBruto: 400_000, ebit: 200_000, ebitda: 250_000, depreciacao: 50_000, resultadoFinanceiro: -40_000, despesaFinanceira: 40_000,
    equivalencia: 0, lucroLiquido: 120_000, lucroControladores: 120_000, fco: 180_000, capex: 90_000, dividendosPagos: 50_000, ativoTotal: 2_000_000, ativoCirculante: 600_000,
    passivoCirculante: 300_000, caixa: 150_000, divida: 400_000, patrimonioLiquido: 1_000_000, plControladores: 1_000_000, minoritarios: 0, acoes: 100_000_000, link: null, ...p,
  }
}

function empresa(ticker: string): EmpresaFundamentos {
  return {
    ticker, nome: ticker, setor: 'Indústria', financeira: false, cnpj: '1',
    ultimaDemonstracao: { doc: 'ITR', dtRefer: '2026-06-30', dtReceb: null, versao: 1, link: null },
    anual: [2021, 2022, 2023, 2024, 2025].map((a, i) => periodo({ exercicio: `${a}-12-31`, receita: 1_000_000 * Math.pow(1.08, i), lucroLiquido: 120_000 * Math.pow(1.08, i), lucroControladores: 120_000 * Math.pow(1.08, i) })),
    ttm: periodo({ periodoAte: '2026-06-30', receita: 1_480_000, ebit: 300_000, ebitda: 360_000, lucroLiquido: 190_000, lucroControladores: 190_000 }),
    acoes: { classes: [{ classe: 'ON', ticker, quantidade: 100_000_000, precoAproximado: false }], documento: 'ITR de 2026-06-30', ajusteUnidade: null, ajusteDesdobramento: null, pvpImplicito: 1 },
    alertas: [],
  }
}

const fundamentos: SnapshotFundamentos = {
  versao: '1.0.0',
  geradoEm: '2026-10-21T00:00:00Z',
  dataCorte: pregoes[N - 1],
  fonte: 'CVM',
  excluidas: [{ ticker: 'BETA3', etapa: 'sem_preco', motivo: 'sem negócio recente' }],
  empresas: { ALFA3: empresa('ALFA3'), PAR1: empresa('PAR1'), PAR2: empresa('PAR2'), PAR3: empresa('PAR3'), PAR4: empresa('PAR4') },
}

/** Histórico longo (COTAHIST) de ALFA3: 540 pregões antes da série de 12 meses, com abertura, terminando no mesmo dia e no mesmo preço. */
function historicoLongoDeAlfa(ajustes: HistoricoLongo['ajustes'] = []): Record<string, HistoricoLongo> {
  const antes: string[] = []
  const d = new Date(`${pregoes[0]}T12:00:00Z`)
  while (antes.length < 540) {
    d.setUTCDate(d.getUTCDate() - 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) antes.unshift(d.toISOString().slice(0, 10))
  }
  const barras: HistoricoLongo['barras'] = [
    ...antes.map((data): HistoricoLongo['barras'][number] => [data, 19.5, 20.4, 19.2, 20, 25_000]),
    ...pregoes.map((data, i): HistoricoLongo['barras'][number] => {
      const p = subindo[i] as [number, number, number, number]
      return [data, p[0] * 0.998, p[2], p[1], p[0], p[3]]
    }),
  ]
  return { ALFA3: { ticker: 'ALFA3', de: barras[0][0], ate: barras[barras.length - 1][0], ajustes, saltosRestantes: [], barras } }
}

function abrir(aba: RegExp, historico: Record<string, HistoricoLongo> = {}) {
  render(<SimuleAcoes ctx={ctx} snapshot={snapshot} series={series} fundamentos={fundamentos} historico={historico} />)
  fireEvent.click(screen.getByRole('tab', { name: aba }))
}

describe('Simule Ações: abas de análise', () => {
  it('as abas de análise aparecem num grupo próprio, sem as abas de lista', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} series={series} fundamentos={fundamentos} />)
    const originais = within(screen.getByRole('tablist', { name: 'O que você quer ver' })).getAllByRole('tab')
    expect(originais).toHaveLength(5)
    const novas = within(screen.getByRole('tablist', { name: 'Análise de uma ação' })).getAllByRole('tab')
    expect(novas.map((a) => a.textContent)).toEqual([expect.stringContaining('Análise técnica'), expect.stringContaining('Análise fundamentalista'), expect.stringContaining('Confluência')])
  })

  it('a análise técnica mostra resumo, gráfico, tendência por período, zonas, cenários, nota e fonte da ação escolhida', () => {
    abrir(/Análise técnica/)
    expect(screen.getByTestId('escolha-da-analise').textContent).toContain('ALFA3')
    expect(screen.getByTestId('resumo-tecnico')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Gráfico de candles diários de ALFA3/ })).toBeTruthy()
    for (const p of ['diario', 'semanal', 'mensal']) expect(screen.getByTestId(`tendencia-${p}`)).toBeTruthy()
    for (const c of ['altista', 'neutro', 'baixista']) expect(screen.getByTestId(`cenario-${c}`)).toBeTruthy()
    expect(screen.getByText(/Pontuação técnica e confiança/)).toBeTruthy()
    expect(screen.getByText(/Fonte, data e qualidade dos dados/)).toBeTruthy()
    expect(screen.getByText(/Leitura educacional, não é recomendação/)).toBeTruthy()
  })

  it('a análise técnica avisa que não há candles (sem abertura) e que o volume é financeiro', () => {
    abrir(/Análise técnica/)
    expect(screen.getByText(/não traz o preço de abertura/)).toBeTruthy()
  })

  it('trocar o horizonte muda o texto do módulo de tendência', () => {
    abrir(/Análise técnica/)
    expect(screen.getAllByText(/horizonte de médio prazo/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Longo prazo' }))
    expect(screen.getAllByText(/horizonte de longo prazo/).length).toBeGreaterThan(0)
  })

  it('o gráfico pode ligar e desligar indicadores e trocar o período', () => {
    abrir(/Análise técnica/)
    const media200 = screen.getByRole('button', { name: 'Média 200' })
    expect(media200.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(media200)
    expect(media200.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '60 pregões' }))
    expect(screen.getByRole('button', { name: '60 pregões' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('o gráfico troca entre candles diários, semanais e mensais', () => {
    abrir(/Análise técnica/)
    expect(screen.getByRole('img', { name: /candles diários de ALFA3/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Semanal' }))
    expect(screen.getByRole('img', { name: /candles semanais de ALFA3, \d+ semanas/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: '26 semanas' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Mensal' }))
    expect(screen.getByRole('img', { name: /candles mensais de ALFA3, \d+ meses/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Diário' }))
    expect(screen.getByRole('img', { name: /candles diários de ALFA3/ })).toBeTruthy()
  })

  it('sem o histórico longo, o gráfico avisa que a abertura é aproximada e só oferece até 1 ano', () => {
    abrir(/Análise técnica/)
    expect(screen.queryByRole('button', { name: '2 anos' })).toBeNull()
    expect(screen.queryByTestId('nota-historico-longo')).toBeNull()
  })

  it('com o histórico longo, mostra abertura real, os eventos ajustados e períodos de anos', () => {
    abrir(/Análise técnica/, historicoLongoDeAlfa([{ data: '2025-03-03', fator: 3, origem: 'b3' }]))
    const nota = screen.getByTestId('nota-historico-longo').textContent ?? ''
    expect(nota).toContain('abertura real do COTAHIST')
    expect(nota).toContain('03/03/2025 (3:1 desdobramento, registrado na B3)')
    fireEvent.click(screen.getByRole('button', { name: '2 anos' }))
    expect(screen.getByRole('img', { name: /candles diários de ALFA3, 520 pregões/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tudo' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tudo' }))
    expect(screen.getByRole('img', { name: /candles diários de ALFA3, 800 pregões/ })).toBeTruthy()
  })

  it('o gráfico responde ao teclado e mostra a data lida', () => {
    abrir(/Análise técnica/)
    const g = screen.getByRole('img', { name: /Gráfico de candles diários de ALFA3/ })
    const antes = g.parentElement!.textContent
    fireEvent.keyDown(g, { key: 'Home' })
    expect(g.parentElement!.textContent).not.toBe(antes)
  })

  it('a análise fundamentalista mostra resumo, indicadores com fórmula e fonte, valor justo em três cenários, notas e leitura final', () => {
    abrir(/Análise fundamentalista/)
    expect(screen.getByTestId('resumo-fundamentalista')).toBeTruthy()
    const pl = screen.getByTestId('indicador-pl')
    expect(pl.textContent).toContain('Fórmula')
    expect(pl.textContent).toContain('CVM')
    for (const c of ['pessimista', 'base', 'otimista']) expect(screen.getByTestId(`cenario-valor-${c}`)).toBeTruthy()
    expect(screen.getByText(/Pontuação fundamentalista/)).toBeTruthy()
    expect(screen.getByText(/Leitura final/)).toBeTruthy()
    expect(screen.getByText(/Fontes, data de atualização e limitações/)).toBeTruthy()
    expect(screen.getByText(/Margem de segurança = 1 − preço ÷ valor justo/)).toBeTruthy()
  })

  it('a fundamentalista não usa o horizonte (sem os botões de curto, médio e longo)', () => {
    abrir(/Análise fundamentalista/)
    expect(screen.queryByRole('group', { name: 'Horizonte da análise' })).toBeNull()
  })

  it('ação fora do cadastro de fundamentos explica o motivo, em vez de números', () => {
    abrir(/Análise fundamentalista/)
    fireEvent.click(within(screen.getByTestId('escolha-da-analise')).getByRole('button', { name: 'BETA3' }))
    expect(screen.getByText(/Análise fundamentalista indisponível para BETA3/)).toBeTruthy()
    expect(screen.getByText(/sem negócio recente/)).toBeTruthy()
  })

  it('ação fora do cadastro (só na busca) não tem análise técnica', () => {
    abrir(/Análise técnica/)
    fireEvent.change(screen.getByLabelText('Buscar ação por código ou nome'), { target: { value: 'ZETA3' } })
    fireEvent.click(screen.getByRole('button', { name: /ZETA3/ }))
    expect(screen.getByText(/Análise técnica indisponível para ZETA3/)).toBeTruthy()
    expect(screen.getByText(/não está no cadastro do app/)).toBeTruthy()
  })

  it('a confluência alinha as duas leituras, com quadro, preço de entrada e riscos de interpretação', () => {
    abrir(/Confluência/)
    expect(screen.getByTestId('resumo-confluencia')).toBeTruthy()
    expect(screen.getByRole('table', { name: /Quadro de confluência/ })).toBeTruthy()
    expect(screen.getByText('Você está aqui')).toBeTruthy()
    expect(screen.getByText(/Preço de entrada × suporte técnico/)).toBeTruthy()
    expect(screen.getByText(/Riscos de interpretação/)).toBeTruthy()
    expect(screen.getAllByText(/Não é recomendação|não é recomendação/).length).toBeGreaterThan(0)
  })

  it('a confluência acompanha o horizonte', () => {
    abrir(/Confluência/)
    expect(screen.getByTestId('resumo-confluencia').textContent).toContain('médio prazo')
    fireEvent.click(screen.getByRole('button', { name: 'Curto prazo' }))
    expect(screen.getByTestId('resumo-confluencia').textContent).toContain('curto prazo')
    expect(screen.getByTestId('resumo-confluencia').textContent).toContain('30%')
  })

  it('o simulador continua igual e as análises não aparecem nele', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={snapshot} series={series} fundamentos={fundamentos} />)
    expect(screen.getByText('Quantas ações esse valor compra')).toBeTruthy()
    expect(screen.queryByTestId('escolha-da-analise')).toBeNull()
  })

  it('sem dados de ações, as abas de análise avisam em vez de quebrar', () => {
    render(<SimuleAcoes ctx={ctx} snapshot={{ ...snapshot, setores: [], busca: [] } as never} series={series} fundamentos={fundamentos} />)
    fireEvent.click(screen.getByRole('tab', { name: /Análise técnica/ }))
    expect(screen.getByText(/ainda não foram carregados/)).toBeTruthy()
  })
})

describe('Simule Ações: preço teto de compra', () => {
  // BETA3 paga R$ 3,00 por ação (teto de Bazin de R$ 50 a 6%) e custa R$ 12; ALFA3 paga R$ 0,50 e custa mais de R$ 40.
  const betaCom = (extra: Partial<PeriodoFundamental>): SnapshotFundamentos => ({
    ...fundamentos,
    empresas: {
      ...fundamentos.empresas,
      BETA3: (() => {
        const e = empresa('BETA3')
        const ajusta = (p: PeriodoFundamental) => ({ ...p, dividendosPagos: 300_000, ...extra })
        return { ...e, anual: e.anual.map(ajusta), ttm: e.ttm ? ajusta(e.ttm) : null }
      })(),
    },
  })
  // Lucro e caixa bons: o valor justo fica bem acima de R$ 12 e a fundamentalista diz "considerar entrada".
  const forte = { fco: 300_000, ebit: 400_000, ebitda: 450_000, lucroLiquido: 250_000, lucroControladores: 250_000 }
  const comBeta = betaCom(forte)
  // Lucro e caixa fracos para o que paga: a margem de segurança fica abaixo de 25% e a fundamentalista diz "aguardar preço".
  const comBetaFraca = betaCom({})

  // Quatro pares do mesmo setor com preço, para o múltiplo setorial existir (como na análise real).
  const snapshotTeto = {
    ...snapshot,
    setores: [{ ...snapshot.setores[0], empresas: [...snapshot.setores[0].empresas, ...['PAR1', 'PAR2', 'PAR3', 'PAR4'].map((t) => ({ ticker: t, nome: t, cotacao: 20, dataCotacao: pregoes[N - 1], variacao3m: 0, variacaoDia: 0, volumeMedio: 1_000_000, minima52: 18, maxima52: 22 }))] }],
  } as unknown as SnapshotAcoes
  const abrirTeto = (f: SnapshotFundamentos = comBeta) => {
    try { localStorage.clear() } catch { /* sem armazenamento */ }
    render(<SimuleAcoes ctx={ctx} snapshot={snapshotTeto} series={series} fundamentos={f} />)
    fireEvent.click(screen.getByRole('tab', { name: /Preço teto de compra/ }))
  }

  const abrirLinha = async (ticker: string) => {
    const lista = await screen.findByTestId('lista-todas')
    fireEvent.click(within(within(lista).getByTestId(`linha-${ticker}`)).getByRole('button'))
    return screen.findByTestId(`teto-${ticker}`)
  }

  it('não há radar nem cartões verdes antes da lista: a lista de todas as ações em ordem alfabética é o conteúdo', async () => {
    abrirTeto()
    const lista = await screen.findByTestId('lista-todas')
    expect(screen.queryByText(/Radar: hoje abaixo/)).toBeNull()
    expect(screen.queryByTestId('em-observacao')).toBeNull()
    expect(screen.queryByTestId('teto-BETA3')).toBeNull()
    const codigos = [...lista.querySelectorAll('li[data-testid^="linha-"]')].map((li) => (li.getAttribute('data-testid') as string).replace('linha-', ''))
    expect(codigos.length).toBeGreaterThan(4)
    expect(codigos).toEqual([...codigos].sort((a, b) => a.localeCompare(b)))
  })

  it('só fica verde quem está abaixo dos tetos; as demais mostram o teto sem destaque', async () => {
    abrirTeto()
    const lista = await screen.findByTestId('lista-todas')
    const verde = within(lista).getByTestId('linha-BETA3')
    expect(verde.getAttribute('data-status')).toBe('abaixo-do-teto')
    const outra = within(lista).getByTestId('linha-PAR1')
    expect(outra.getAttribute('data-status')).not.toBe('abaixo-do-teto')
    expect(outra.textContent).toMatch(/R\$\s\d/)
  })

  it('tocar na linha abre o cartão com os dois métodos, o valor justo e a leitura da fundamentalista', async () => {
    abrirTeto()
    const cartao = await abrirLinha('BETA3')
    expect(cartao.getAttribute('data-status')).toBe('abaixo-do-teto')
    expect(within(cartao).getByText(/Teto Bazin/)).toBeTruthy()
    expect(within(cartao).getByText(/Teto Graham/)).toBeTruthy()
    expect(within(cartao).getByText(/Valor justo \(fundamentalista\)/)).toBeTruthy()
    expect(within(cartao).getByTestId('leitura-fund-BETA3').getAttribute('data-selo')).toBe('concorda')
  })

  it('a fundamentalista é um selo ao lado: com "aguardar preço" a linha continua verde e o selo é neutro', async () => {
    abrirTeto(comBetaFraca)
    const lista = await screen.findByTestId('lista-todas')
    expect(within(lista).getByTestId('linha-BETA3').getAttribute('data-status')).toBe('abaixo-do-teto')
    expect(within(lista).getByTestId('selo-BETA3').getAttribute('data-selo')).toBe('neutro')
    const cartao = await abrirLinha('BETA3')
    expect(within(cartao).getByTestId('leitura-fund-BETA3').textContent).toContain('Aguardar preço mais atrativo')
  })

  it('o filtro por setor lista os setores da B3 e mostra só as ações do setor escolhido', async () => {
    try { localStorage.clear() } catch { /* sem armazenamento */ }
    const base = snapshotTeto.setores[0]
    const doisSetores = {
      ...snapshotTeto,
      setores: [
        { ...base, empresas: base.empresas.filter((e) => !e.ticker.startsWith('PAR')) },
        { ...base, setor: 'Pares', empresas: base.empresas.filter((e) => e.ticker.startsWith('PAR')) },
      ],
    } as unknown as SnapshotAcoes
    render(<SimuleAcoes ctx={ctx} snapshot={doisSetores} series={series} fundamentos={comBeta} />)
    fireEvent.click(screen.getByRole('tab', { name: /Preço teto de compra/ }))
    const lista = await screen.findByTestId('lista-todas')
    const seletor = screen.getByLabelText('Filtrar por setor') as HTMLSelectElement
    expect([...seletor.options].map((o) => o.textContent)).toEqual(expect.arrayContaining(['Todos os setores', 'Pares (4)']))
    expect(within(lista).getByTestId('linha-BETA3')).toBeTruthy()

    fireEvent.change(seletor, { target: { value: 's:Pares' } })
    expect(within(lista).getByTestId('linha-PAR1')).toBeTruthy()
    expect(within(lista).queryByTestId('linha-BETA3')).toBeNull()
    expect(within(lista).getByText(/Ações do setor \(4\)/)).toBeTruthy()

    fireEvent.change(seletor, { target: { value: `g:${base.grupoB3}` } })
    expect(within(lista).getByTestId('linha-BETA3')).toBeTruthy()
    expect(within(lista).getByTestId('linha-PAR1')).toBeTruthy()

    fireEvent.change(seletor, { target: { value: 's:Pares' } })
    fireEvent.change(screen.getByLabelText(/Filtrar a lista de todas as ações/), { target: { value: 'par2' } })
    expect(within(lista).getAllByTestId(/^linha-/)).toHaveLength(1)
  })

  it('o filtro procura por código ou nome na lista', async () => {
    abrirTeto()
    const lista = await screen.findByTestId('lista-todas')
    fireEvent.change(screen.getByLabelText(/Filtrar a lista de todas as ações/), { target: { value: 'par1' } })
    expect(within(lista).queryByTestId('linha-BETA3')).toBeNull()
    expect(within(lista).getByTestId('linha-PAR1')).toBeTruthy()
  })

  it('subir a taxa de Bazin tira a ação do verde', async () => {
    // R$ 1,00 por ação: teto de R$ 16,67 a 6%, mas de R$ 10,00 a 10%, abaixo do preço de R$ 12.
    abrirTeto(betaCom({ ...forte, dividendosPagos: 100_000 }))
    const lista = await screen.findByTestId('lista-todas')
    expect(within(lista).getByTestId('linha-BETA3').getAttribute('data-status')).toBe('abaixo-do-teto')
    fireEvent.click(screen.getByRole('button', { name: /^10%/ }))
    expect(within(lista).getByTestId('linha-BETA3').getAttribute('data-status')).not.toBe('abaixo-do-teto')
  })

  it('acompanhar uma ação acima do teto mostra "Acima do teto" e sem aviso', async () => {
    abrirTeto()
    await screen.findByTestId('lista-todas')
    fireEvent.change(screen.getByLabelText(/Adicionar ação ao radar/), { target: { value: 'ALFA3' } })
    fireEvent.click(within(await screen.findByRole('list', { name: 'Ações encontradas' })).getByRole('button', { name: /ALFA3/ }))
    const cartao = await screen.findByTestId('teto-ALFA3')
    expect(cartao.getAttribute('data-status')).toBe('aguardando')
    expect(screen.queryByTestId('aviso-preco-teto')).toBeNull()
  })

  it('acompanhar a ação que já está abaixo do teto mostra o aviso na tela', async () => {
    abrirTeto()
    await abrirLinha('BETA3')
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar' }))
    expect((await screen.findByTestId('aviso-preco-teto')).textContent).toContain('BETA3')
  })
})
