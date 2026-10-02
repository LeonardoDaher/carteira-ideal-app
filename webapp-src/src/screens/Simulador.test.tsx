import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Simulador } from './Simulador'
import { ATIVOS } from '../data/assets'
import { carteiraParaExibicao } from '../data/carteiraVisual'
import { PERGUNTAS } from '../data/questions'
import { PERGUNTAS_ARQUITETURA } from '../data/perguntasArquitetura'
import { CHAVE_CARTEIRA, carteiraVazia, serializarCarteira } from '../domain/carteiraSalva'
import type { CarteiraSalva } from '../domain/carteiraSalva'
import { gerarRecomendacao } from '../domain/engine'
import { reais } from '../domain/mercadoOficial'
import { baseDaCarteira, priorizarClasses, simularAporteDado } from '../domain/simulacaoComAtivos'
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
    expect(screen.getByText(/veja o que atacar primeiro/)).toBeTruthy()
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

  const valoresDe = (c: Partial<CarteiraSalva>) => baseDaCarteira({ ...carteiraVazia(), ...c }, CATALOGO_ATIVOS).valores
  const ranking = (c: Partial<CarteiraSalva>) => priorizarClasses(valoresDe(c), referencia)

  it('mostra o que atacar primeiro, na ordem de prioridade, com o número de cada classe', async () => {
    const c = { ativosManuais: [manual('PETR4 X', 8000, 'acoesETFs'), manual('SELIC X', 2000, 'tesouroSelic')] }
    semear(c)
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const esperado = ranking(c)
    expect(esperado.atacar.length).toBeGreaterThan(1)
    const painel = await screen.findByRole('region', { name: 'O que atacar primeiro' })
    expect(txt(painel)).toContain('Comece por')
    expect(txt(painel)).toContain(ATIVOS[esperado.atacar[0].classe].label)
    const grupo = screen.getByRole('region', { name: 'Atacar primeiro' })
    const itens = within(grupo).getAllByRole('listitem')
    expect(itens).toHaveLength(esperado.atacar.length)
    esperado.atacar.forEach((l, i) => {
      expect(txt(itens[i])).toContain(ATIVOS[l.classe].label)
      expect(within(itens[i]).getByLabelText(`Prioridade ${i + 1}`)).toBeTruthy()
      expect(txt(itens[i])).toContain(`Faltam ${l.difPp.toFixed(1).replace('.', ',')} pp`)
    })
  })

  it('a classe que já passou do alvo vai para "Segurar por enquanto": sem prioridade e com o aviso para não investir mais', async () => {
    const c = { ativosManuais: [manual('PETR4 X', 10000, 'acoesETFs')] }
    semear(c)
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const esperado = ranking(c)
    expect(esperado.segurar.map((l) => l.classe)).toEqual(['acoesETFs'])
    const painel = await screen.findByRole('region', { name: 'O que atacar primeiro' })
    expect(txt(painel)).toContain('Segure o dinheiro em')
    const grupo = screen.getByRole('region', { name: 'Segurar por enquanto' })
    expect(txt(grupo)).toContain(ATIVOS.acoesETFs.label)
    expect(txt(grupo)).toContain('Não invista mais aqui por enquanto.')
    expect(within(grupo).queryByLabelText(/^Prioridade/)).toBeNull()
    // e ela não aparece entre as classes a atacar
    expect(txt(screen.getByRole('region', { name: 'Atacar primeiro' }))).not.toContain(ATIVOS.acoesETFs.label)
  })

  it('carteira já perto da sugerida: diz que não há nada urgente a atacar', async () => {
    // monta uma carteira EXATAMENTE igual à sugerida (R$ 100 mil distribuídos pelos percentuais)
    const classes = Object.entries(referencia) as [keyof typeof referencia, number][]
    const manuais = classes.filter(([, p]) => p > 0).map(([k, p]) => manual(`ATIVO ${String(k).toUpperCase()}`, p * 1000, k === 'tesouroIPCA' ? 'tesouroIPCA' : (k as never)))
    semear({ ativosManuais: manuais })
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const painel = await screen.findByRole('region', { name: 'O que atacar primeiro' })
    expect(txt(painel)).toContain('Não há nada urgente a atacar')
    expect(screen.queryByRole('region', { name: 'Atacar primeiro' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Segurar por enquanto' })).toBeNull()
  })

  it('o que está fora da carteira sugerida aparece à parte e não entra na conta', async () => {
    semear({ ativosManuais: [manual('PETR4 X', 8000, 'acoesETFs'), manual('PGBL X', 5000, 'foraDaRegua')] })
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    await screen.findByRole('region', { name: 'O que atacar primeiro' })
    expect(txt(screen.getByText(/fora das classes da carteira sugerida/))).toContain(R(5000))
  })

  it('"Para onde vai o próximo aporte": distribui só entre as classes abaixo do alvo e mostra a aderência antes e depois', async () => {
    const c = { ativosManuais: [manual('PETR4 X', 8000, 'acoesETFs'), manual('SELIC X', 2000, 'tesouroSelic')] }
    semear(c)
    render(<Simulador ctx={montarCtx()} />)
    abrirAba()
    const painel = await screen.findByRole('region', { name: 'Para onde vai o próximo aporte' })
    fireEvent.change(within(painel).getByLabelText(/Quanto você pode investir agora/), { target: { value: '1000' } })
    const esperado = simularAporteDado(valoresDe(c), referencia, 1000)
    await waitFor(() => expect(within(painel).getByRole('list', { name: 'Como distribuir o valor' })).toBeTruthy())
    const lista = within(painel).getByRole('list', { name: 'Como distribuir o valor' })
    expect(Array.from(lista.querySelectorAll('strong'))).toHaveLength(esperado.alocacoes.length)
    // a ordem segue a prioridade e quem está para segurar não recebe nada
    for (const l of ranking(c).segurar) expect(txt(lista)).not.toContain(ATIVOS[l.classe].label)
    expect(txt(painel)).toContain(`de ${Math.round(esperado.aderenciaAntes!)}% para ${Math.round(esperado.aderenciaDepois!)}%`)
  })
})
