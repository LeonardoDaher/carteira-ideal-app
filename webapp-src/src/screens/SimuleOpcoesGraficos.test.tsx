import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { AtivoComOpcoes, SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const HOJE = '2026-10-16'
const V1 = '2026-11-19' // mensal, 22 dias úteis
const V2 = '2026-12-18' // mensal, 42 dias úteis
const S1 = '2026-10-23' // semanal, 4 dias úteis

let n = 0
const serie = (tipo: 'call' | 'put', strike: number, vencimento: string, negocios: number, estilo: 'americana' | 'europeia' = 'europeia'): SerieOpcao => ({
  codigo: `${tipo === 'call' ? 'C' : 'P'}${Math.round(strike * 100)}${vencimento.slice(5, 7)}${vencimento.slice(8, 10)}${++n}`,
  tipo, estilo, strike, vencimento, ultimo: 1, dataUltimo: HOJE, variacao: null, negocios, volume: negocios * 1000,
})

const callsV1: [number, number][] = [[8, 5], [9, 20], [10, 100], [11, 40], [12, 10]]
const putsV1: [number, number][] = [[8, 10], [9, 40], [10, 90], [11, 15], [12, 3]]
const graf: AtivoComOpcoes = {
  ticker: 'GRAF3', nome: 'EMPRESA GRAFICO', cotacao: 10, dataCotacao: HOJE, variacao: 0, volumeOpcoes: 5, lote: 100,
  series: [
    // calls americanas e puts europeias, e uma put americana: o estilo não filtra
    ...callsV1.map(([k, v]) => serie('call', k, V1, v, 'americana')),
    ...putsV1.map(([k, v], i) => serie('put', k, V1, v, i === 2 ? 'americana' : 'europeia')),
    serie('call', 20, V1, 7), // longe do preço: só aparece em "todos os strikes"
    serie('call', 10, V2, 30), serie('put', 10, V2, 25),
    serie('call', 10, S1, 12),
  ],
}
const outro: AtivoComOpcoes = {
  ticker: 'OUTR3', nome: 'OUTRA EMPRESA', cotacao: 20, volumeOpcoes: 1, lote: 100,
  series: [serie('call', 20, V1, 77), serie('put', 20, V1, 33)],
}
const snapshot: SnapshotOpcoes = { geradoEm: null, dataPregao: HOJE, ativos: [graf, outro] }

const abrirGraficos = () => fireEvent.click(screen.getByRole('tab', { name: /Gráficos/ }))
const legenda = () => screen.getAllByTestId('legenda-linha').map((l) => (l.textContent ?? '').replace(/[━┅\s]+/g, ' ').trim())
const doVencimento = () => within(screen.getByRole('group', { name: /^Vencimentos \(próximos 6 meses\)/ }))
const marcar = (v: string) => fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(v) }))
const texto = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/ /g, ' ')

describe('SimuleOpcoes: aba Gráficos (negócios por strike)', () => {
  it('é uma das abas e abre com o primeiro vencimento mensal, calls e puts separadas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    expect(screen.getAllByRole('tab')).toHaveLength(6)
    abrirGraficos()
    expect(within(screen.getByRole('group', { name: 'Opções do gráfico' })).getByText('Negócios por strike')).toBeDefined()
    expect(legenda()).toEqual(['19/11 calls', '19/11 puts'])
    expect((screen.getByRole('checkbox', { name: /19\/11\/2026/ }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('img', { name: /maior valor é de 100, no strike 10,00/ })).toBeDefined()
  })

  it('separa vencimentos mensais e semanais, e deixa escolher vários ao mesmo tempo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    expect(within(screen.getByRole('group', { name: 'Vencimentos mensais' })).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(screen.getByRole('group', { name: 'Vencimentos semanais' })).getAllByRole('checkbox')).toHaveLength(1)
    marcar('18\\/12\\/2026')
    expect(legenda()).toEqual(['19/11 calls', '19/11 puts', '18/12 calls', '18/12 puts'])
    marcar('23\\/10\\/2026')
    expect(legenda()).toHaveLength(6)
    expect(screen.getByTestId(`linha-${S1}-put`)).toBeDefined()
  })

  it('os botões escolhem só mensais, só semanais, todos ou nenhum', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    fireEvent.click(screen.getByRole('button', { name: 'Só semanais' }))
    expect(legenda()).toEqual(['23/10 calls', '23/10 puts'])
    fireEvent.click(screen.getByRole('button', { name: 'Só mensais' }))
    expect(legenda()).toHaveLength(4)
    fireEvent.click(doVencimento().getByRole('button', { name: 'Todos' }))
    expect(legenda()).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(screen.getByText('Escolha pelo menos um vencimento')).toBeDefined()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('"somadas", "só calls" e "só puts" mudam as linhas', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    marcar('18\\/12\\/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Calls e puts somadas' }))
    expect(legenda()).toEqual(['19/11', '18/12'])
    expect(screen.getByRole('img', { name: /maior valor é de 190, no strike 10,00/ })).toBeDefined() // 100 + 90 no strike 10
    fireEvent.click(screen.getByRole('button', { name: 'Só calls' }))
    expect(legenda()).toEqual(['19/11 calls', '18/12 calls'])
    fireEvent.click(screen.getByRole('button', { name: 'Só puts' }))
    expect(legenda()).toEqual(['19/11 puts', '18/12 puts'])
  })

  it('o estilo não filtra: calls e puts americanas e europeias entram no mesmo gráfico', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    fireEvent.click(screen.getByRole('button', { name: 'Calls e puts somadas' }))
    const strikes = within(screen.getByTestId('picos')).getByText(/pico no strike/)
    expect(strikes.textContent).toMatch(/190/) // call americana (100) + put americana (90), sem separar por estilo
    expect(screen.getByText(/o estilo não faz diferença para este gráfico/)).toBeDefined()
  })

  it('diz onde está o pico de cada linha, em % do preço', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    const picos = texto('picos')
    expect(picos).toMatch(/19\/11 calls pico no strike 10,00 \(0% do preço\), com 100; total de 175/)
    expect(picos).toMatch(/19\/11 puts pico no strike 10,00 \(0% do preço\), com 90; total de 158/)
  })

  it('a faixa em torno do preço corta os strikes, e "Todos" traz os distantes', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    expect(screen.getByText(/Ver os números \(5 strikes com negócios\)/)).toBeDefined() // ±20%: de 8 a 12
    fireEvent.click(screen.getByRole('button', { name: '±10% do preço' }))
    expect(screen.getByText(/Ver os números \(3 strikes com negócios\)/)).toBeDefined()
    fireEvent.click(within(screen.getByRole('group', { name: 'Faixa de strikes do gráfico' })).getByRole('button', { name: 'Todos' }))
    expect(screen.getByText(/Ver os números \(6 strikes com negócios\)/)).toBeDefined()
  })

  it('a tabela de números traz cada strike com as linhas do gráfico', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    const linhas = screen.getAllByTestId('linha-numeros').map((l) => within(l).getAllByRole('cell').map((c) => c.textContent))
    expect(linhas).toHaveLength(5)
    expect(linhas[2]).toEqual(['10,00', '0,0', '100', '90']) // strike 10: preço do ativo, 100 negócios de calls e 90 de puts
    expect(linhas[0]).toEqual(['8,00', '-20,0', '5', '10'])
  })

  it('o volume financeiro troca o título e os valores', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    fireEvent.click(screen.getByRole('button', { name: 'Volume financeiro' }))
    expect(screen.getByText('Volume financeiro (R$) por strike')).toBeDefined()
    expect(texto('picos')).toMatch(/com 100 mil/) // 100 negócios x R$ 1.000
  })

  it('o teclado lê os valores de um strike: a seta começa perto do preço e anda para o lado', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    expect(texto('leitura-grafico')).toMatch(/use as setas/)
    const grafico = screen.getByRole('img')
    fireEvent.keyDown(grafico, { key: 'ArrowRight' })
    expect(texto('leitura-grafico')).toMatch(/Strike R\$ 11,00 \(\+10% do preço\):\s*19\/11 calls 40\s+19\/11 puts 15/)
    fireEvent.keyDown(grafico, { key: 'Home' })
    expect(texto('leitura-grafico')).toMatch(/Strike R\$ 8,00 \(-20% do preço\):\s*19\/11 calls 5\s+19\/11 puts 10/)
    fireEvent.keyDown(grafico, { key: 'End' })
    expect(texto('leitura-grafico')).toMatch(/Strike R\$ 12,00/)
  })

  it('trocar de ativo recomeça com o vencimento padrão e usa os dados do novo ativo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    fireEvent.click(screen.getByRole('button', { name: 'Só semanais' }))
    fireEvent.change(screen.getByLabelText('Buscar ativo por código ou nome'), { target: { value: 'outr' } })
    fireEvent.keyDown(screen.getByLabelText('Buscar ativo por código ou nome'), { key: 'Enter' })
    expect(legenda()).toEqual(['19/11 calls', '19/11 puts'])
    expect(texto('picos')).toMatch(/com 77/)
  })

  it('o "voltar" do navegador, a partir dos gráficos, volta às séries', async () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    expect(window.history.state).toEqual({ opcoesAba: 'graficos' })
    window.history.back()
    await waitFor(() => expect(screen.getByText(/séries? de GRAF3, de um total de/)).toBeDefined())
    expect(screen.queryByRole('group', { name: 'Opções do gráfico' })).toBeNull()
  })
})

describe('SimuleOpcoes: aba Gráficos, escala relativa', () => {
  it('"cada linha em % do pico" põe o eixo em % e mantém os valores reais na leitura e nos picos', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    marcar('18/12/2026')
    expect(screen.queryByTestId('nota-escala')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cada linha em % do pico' }))
    expect(texto('nota-escala')).toMatch(/Eixo vertical em % do maior valor de cada linha/)
    expect(screen.getAllByText('100%').length).toBeGreaterThan(0) // o topo do eixo
    expect(texto('picos')).toMatch(/com 100;/) // o pico segue em valor real
    const grafico = screen.getByRole('img')
    fireEvent.keyDown(grafico, { key: 'Home' })
    expect(texto('leitura-grafico')).toMatch(/Strike R\$ 8,00 .*19\/11 calls 5\s+19\/11 puts 10\s+18\/12 calls 0\s+18\/12 puts 0/) // valores reais, e não %
    fireEvent.click(screen.getByRole('button', { name: 'Valores reais' }))
    expect(screen.queryByTestId('nota-escala')).toBeNull()
  })

  it('na escala relativa, a linha pequena chega ao mesmo topo que a grande', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    marcar('18/12/2026')
    const topo = (id: string) => Math.min(...[...screen.getByTestId(id).querySelectorAll('circle')].map((c) => Number(c.getAttribute('cy'))))
    expect(topo(`linha-${V2}-call`)).toBeGreaterThan(topo(`linha-${V1}-call`)) // escala real: a de 18/12 (30) fica bem abaixo da de 19/11 (100)
    fireEvent.click(screen.getByRole('button', { name: 'Cada linha em % do pico' }))
    expect(topo(`linha-${V2}-call`)).toBeCloseTo(topo(`linha-${V1}-call`), 5) // escala relativa: as duas encostam no topo
  })
})

describe('SimuleOpcoes: aba Gráficos, cores e traços', () => {
  const caminho = (id: string) => screen.getByTestId(id).querySelector('path')!

  it('calls em amarelo (âmbar do Tesouro), puts em azul e somadas em verde', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    expect(caminho(`linha-${V1}-call`).getAttribute('stroke')).toBe('var(--grafico-selic)')
    expect(caminho(`linha-${V1}-put`).getAttribute('stroke')).toBe('var(--grafico-ipca)')
    fireEvent.click(screen.getByRole('button', { name: 'Calls e puts somadas' }))
    expect(caminho(`linha-${V1}-soma`).getAttribute('stroke')).toBe('var(--grafico-con)')
    expect(texto('nota-cores')).toMatch(/Amarelo são as calls, azul são as puts e verde são calls e puts somadas/)
  })

  it('o vencimento se distingue pelo traço: o primeiro é cheio, o segundo tracejado e o terceiro pontilhado, na mesma cor do tipo', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    marcar('18/12/2026')
    marcar('23/10/2026')
    // vencimentos em ordem de data: 23/10, 19/11 e 18/12
    expect(caminho(`linha-${S1}-call`).getAttribute('stroke-dasharray')).toBeNull()
    expect(caminho(`linha-${V1}-call`).getAttribute('stroke-dasharray')).toBe('7 3.5')
    expect(caminho(`linha-${V2}-call`).getAttribute('stroke-dasharray')).toBe('0.1 4.5')
    for (const v of [S1, V1, V2]) expect(caminho(`linha-${v}-call`).getAttribute('stroke')).toBe('var(--grafico-selic)')
    for (const v of [S1, V1, V2]) expect(caminho(`linha-${v}-put`).getAttribute('stroke')).toBe('var(--grafico-ipca)')
  })

  it('a legenda traz, para cada linha, um trecho dela com a cor e o traço certos', () => {
    render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
    abrirGraficos()
    marcar('18/12/2026')
    const marcas = screen.getAllByTestId('legenda-linha').map((l) => l.querySelector('svg line')!)
    expect(marcas.map((m) => m.getAttribute('stroke'))).toEqual(['var(--grafico-selic)', 'var(--grafico-ipca)', 'var(--grafico-selic)', 'var(--grafico-ipca)'])
    expect(marcas.map((m) => m.getAttribute('stroke-dasharray'))).toEqual([null, null, '7 3.5', '7 3.5'])
  })
})
