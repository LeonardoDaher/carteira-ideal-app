import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Simulador } from './Simulador'
import { carteiraParaExibicao } from '../data/carteiraVisual'
import { PERGUNTAS } from '../data/questions'
import { PERGUNTAS_ARQUITETURA } from '../data/perguntasArquitetura'
import { CHAVE_CARTEIRA, carteiraVazia, serializarCarteira } from '../domain/carteiraSalva'
import type { CarteiraSalva } from '../domain/carteiraSalva'
import { gerarRecomendacao } from '../domain/engine'
import { reais } from '../domain/mercadoOficial'
import { baseDaCarteira, simularAporteDado, simularAporteParaAtingir } from '../domain/simulacaoComAtivos'
import { CATALOGO_ATIVOS } from '../data/catalogoAtivos'
import type { AppCtx } from '../state/useAppState'

const resposta = (l: { id: string }[]) => Object.fromEntries(l.map((p) => [p.id, 'b']))
const resultado = gerarRecomendacao(resposta(PERGUNTAS) as never, { idade: 35 }, resposta(PERGUNTAS_ARQUITETURA) as never)
const referencia = carteiraParaExibicao(resultado.carteira)

const montarCtx = () =>
  ({ resultado, valorSimulacao: 10000, setValorSimulacao: vi.fn(), setScreen: vi.fn(), screen: 'simulador' }) as unknown as AppCtx
const txt = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ')
/** reais() separa "R$" do número com espaço não separável; o texto da tela é comparado já normalizado. */
const R = (n: number) => reais(n).replace(/\s+/g, ' ')

const manual = (ativo: string, valor: number, classe: CarteiraSalva['ativosManuais'][number]['classe']) => ({
  ativo, nome: ativo, quantidade: 1, precoMedio: valor, valorAtual: null, classe,
})
function semear(c: Partial<CarteiraSalva>) {
  localStorage.setItem(CHAVE_CARTEIRA, serializarCarteira({ ...carteiraVazia(), ...c }))
}
const abrirAba = () => fireEvent.click(screen.getByRole('tab', { name: 'Com os meus ativos' }))

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Simular valores: duas abas', () => {
  it('abre em "Pelo percentual" (o simulador de sempre, intacto) e a nova aba fica a um toque', () => {
    render(<Simulador ctx={montarCtx()} />)
    expect(screen.getByRole('tab', { name: 'Pelo percentual' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Com os meus ativos' }).getAttribute('aria-selected')).toBe('false')
    expect(screen.getByText('Valor a investir')).toBeTruthy()
    expect(screen.getByRole('slider')).toBeTruthy()
  })
  it('trocar de aba troca o conteúdo (e o texto de abertura) e dá para voltar', async () => {
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    expect(await screen.findByText(/Traga os seus ativos para simular/)).toBeTruthy()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.getByText(/sem vender nada/)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Pelo percentual' }))
    expect(screen.getByRole('slider')).toBeTruthy()
  })
})

describe('Simular com os meus ativos', () => {
  it('sem ativos: explica e o botão leva para Meus Ativos', async () => {
    const ctx = montarCtx()
    render(<Simulador ctx={ctx} />)
    abrirAba()
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir Meus Ativos' }))
    expect(ctx.setScreen).toHaveBeenCalledWith('minhaCarteira')
  })

  it('mostra quanto investir para chegar à carteira sugerida (o mesmo número do cálculo) e o que fazer em cada classe', async () => {
    const c = { ativosManuais: [manual('PETR4 X', 8000, 'acoesETFs'), manual('SELIC X', 2000, 'tesouroSelic')] }
    semear(c)
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const esperado = simularAporteParaAtingir(baseDaCarteira({ ...carteiraVazia(), ...c }, CATALOGO_ATIVOS).valores, referencia, 'exato')
    expect(esperado.aporteTotal).toBeGreaterThan(0)
    const painel = await screen.findByRole('region', { name: 'Quanto investir para chegar na carteira sugerida' })
    expect(txt(painel)).toContain(R(esperado.aporteTotal))
    expect(txt(painel)).toContain(R(esperado.patrimonioFinal))
    // uma linha por classe com alvo, com "Investir R$ ..." ou "Nada a investir"
    for (const l of esperado.linhas) expect(screen.getAllByText((_, el) => !!el && el.children.length === 0 && txt(el as HTMLElement) === (l.aporte > 0 ? `Investir ${R(l.aporte)}` : 'Nada a investir')).length).toBeGreaterThan(0)
    expect(txt(painel)).toMatch(/já está acima do alvo e é ela que define/)
    expect(txt(painel)).toMatch(/\d+(,\d)? vezes o que você tem hoje|% do que você tem hoje/)
  })

  it('"Dentro do alvo" pede menos (ou o mesmo) que o "Percentual exato"', async () => {
    const c = { ativosManuais: [manual('PETR4 X', 8000, 'acoesETFs'), manual('SELIC X', 2000, 'tesouroSelic')] }
    semear(c)
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const painel = await screen.findByRole('region', { name: 'Quanto investir para chegar na carteira sugerida' })
    const valores = baseDaCarteira({ ...carteiraVazia(), ...c }, CATALOGO_ATIVOS).valores
    const exato = simularAporteParaAtingir(valores, referencia, 'exato').aporteTotal
    const faixa = simularAporteParaAtingir(valores, referencia, 'faixa').aporteTotal
    expect(faixa).toBeLessThanOrEqual(exato)
    expect(within(painel).getByRole('button', { name: 'Percentual exato' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(painel).getByRole('button', { name: 'Dentro do alvo' }))
    expect(within(painel).getByRole('button', { name: 'Dentro do alvo' }).getAttribute('aria-pressed')).toBe('true')
    expect(txt(painel)).toContain(faixa > 0 ? R(faixa) : 'Não precisa investir nada')
  })

  it('carteira já no alvo: diz que não precisa investir nada', async () => {
    // monta uma carteira EXATAMENTE igual à sugerida (R$ 100 mil distribuídos pelos percentuais)
    const classes = Object.entries(referencia) as [keyof typeof referencia, number][]
    const manuais = classes.filter(([, p]) => p > 0).map(([k, p]) => manual(`ATIVO ${String(k).toUpperCase()}`, p * 1000, k === 'tesouroIPCA' ? 'tesouroIPCA' : (k as never)))
    semear({ ativosManuais: manuais })
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const painel = await screen.findByRole('region', { name: 'Quanto investir para chegar na carteira sugerida' })
    expect(txt(painel)).toContain('Não precisa investir nada')
  })

  it('o que está fora da carteira sugerida aparece à parte e não entra na conta', async () => {
    semear({ ativosManuais: [manual('PETR4 X', 8000, 'acoesETFs'), manual('PGBL X', 5000, 'foraDaRegua')] })
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    await screen.findByRole('region', { name: 'Quanto investir para chegar na carteira sugerida' })
    expect(txt(screen.getByText(/fora das classes da carteira sugerida/))).toContain(R(5000))
  })

  it('"E se eu investir um valor menor?": distribui o valor e mostra a aderência antes e depois', async () => {
    const c = { ativosManuais: [manual('PETR4 X', 8000, 'acoesETFs'), manual('SELIC X', 2000, 'tesouroSelic')] }
    semear(c)
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const painel = await screen.findByRole('region', { name: 'E se eu investir um valor menor?' })
    fireEvent.change(within(painel).getByLabelText(/Quanto você pode investir agora/), { target: { value: '1000' } })
    const esperado = simularAporteDado(baseDaCarteira({ ...carteiraVazia(), ...c }, CATALOGO_ATIVOS).valores, referencia, 1000)
    await waitFor(() => expect(within(painel).getByRole('list', { name: 'Como distribuir o valor' })).toBeTruthy())
    const soma = Array.from(within(painel).getByRole('list', { name: 'Como distribuir o valor' }).querySelectorAll('strong')).length
    expect(soma).toBe(esperado.alocacoes.length)
    expect(txt(painel)).toContain(`de ${Math.round(esperado.aderenciaAntes!)}% para ${Math.round(esperado.aderenciaDepois!)}%`)
  })
})
