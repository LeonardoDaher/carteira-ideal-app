import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SimuleMoto } from './SimuleMoto'
import type { SnapshotMercado } from '../domain/mercadoOficial'

const vazio: SnapshotMercado = { geradoEm: null, indicadores: {}, derivados: {}, tesouro: { dataBase: null, titulos: [] } }
const comFocus: SnapshotMercado = {
  ...vazio,
  indicadores: { cdi: { nome: 'CDI', unidade: '% a.a.', codigoSgs: 4389, data: '2026-09-28', valor: 13.65 } },
  focus: { data: '2026-09-25', ipca: { 2027: 4.3, 2030: 3.5 }, selic: { 2027: 12, 2030: 10 } },
}

const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement
const digitar = (nome: string, valor: string) => fireEvent.change(campo(nome), { target: { value: valor } })
const SEM_MOTO = 'Quanto você gastaria por mês para se mover sem a moto'

describe('SimuleMoto', () => {
  it('abre com um vencedor, as duas leituras (custo e patrimônio) e o aviso de que não indica produto', () => {
    render(<SimuleMoto snapshot={comFocus} />)
    expect(screen.getByRole('heading', { name: 'Comprar à vista, financiar, consórcio ou ficar sem moto?' })).toBeTruthy()
    expect(screen.getByText(/o caminho de menor custo, que também termina com o maior patrimônio, é:/)).toBeTruthy()
    for (const titulo of ['Custo de mobilidade por mês', 'Patrimônio líquido final']) {
      const cartao = screen.getByText(titulo).closest('.card') as HTMLElement
      expect(within(cartao).getByText(/1º/)).toBeTruthy()
      expect(within(cartao).getByText(/2º/)).toBeTruthy()
      expect(within(cartao).getByText(/3º/)).toBeTruthy()
    }
    expect(screen.getAllByText(/não indica banco, administradora de consórcio, locadora, aplicativo nem produto/).length).toBeGreaterThan(0)
  })

  it('o link de topo volta para o hub Simule Bens', () => {
    render(<SimuleMoto snapshot={comFocus} />)
    expect(screen.getByRole('link', { name: '← Simule Bens' }).getAttribute('href')).toBe('./?tela=simuleBens')
  })

  it('abre com os valores de partida de moto e a projeção do Focus; sem Focus, os padrões de moto', () => {
    const { unmount } = render(<SimuleMoto snapshot={comFocus} />)
    expect(campo('Valor da moto').value).toBe('20.000,00')
    expect(campo('Perda de valor no 1º ano').value).toBe('10')
    expect(campo('Rendimento dos investimentos').value).toBe('10')
    expect(campo('Inflação esperada').value).toBe('3,5')
    expect(screen.getByText(/CDI de hoje: 13,65%/)).toBeTruthy()
    unmount()
    render(<SimuleMoto snapshot={vazio} />)
    expect(campo('Inflação esperada').value).toBe('4,5')
    expect(screen.queryByText(/Boletim Focus \(coleta/)).toBeNull()
  })

  it('o tipo é um botão que fica marcado e recarrega os valores de partida de moto', () => {
    render(<SimuleMoto snapshot={vazio} />)
    const zero = screen.getByRole('button', { name: '0 km' })
    const semi = screen.getByRole('button', { name: 'Seminovo' })
    expect(zero.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(semi)
    expect(semi.getAttribute('aria-pressed')).toBe('true')
    expect(zero.getAttribute('aria-pressed')).toBe('false')
    expect(campo('Perda de valor no 1º ano').value).toBe('7')
    expect(campo('Valor da moto').value).toBe('20.000,00')
  })

  it('gasto muito baixo sem moto faz "Sem moto" vencer; muito alto faz ter a moto vencer', async () => {
    const { unmount } = render(<SimuleMoto snapshot={comFocus} />)
    digitar(SEM_MOTO, '100')
    expect(await screen.findByText('Sem moto', { selector: 'span.font-display' })).toBeTruthy()
    unmount()
    render(<SimuleMoto snapshot={comFocus} />)
    digitar(SEM_MOTO, '5000')
    const cartao = (await screen.findByText(/o caminho de menor custo/)).closest('.imovel-vencedor') as HTMLElement
    expect(within(cartao).queryByText('Sem moto', { selector: 'span.font-display' })).toBeNull()
  })

  it('sem dinheiro para o à vista, diz quanto falta; ao incluir, o bloco da compra à vista aparece', async () => {
    render(<SimuleMoto snapshot={comFocus} />)
    expect(screen.getByText(/Comprar à vista não entrou na comparação/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Incluir comprar à vista/ }))
    expect(await screen.findByText('Comprar à vista: cada custo e cada taxa')).toBeTruthy()
    expect(screen.queryByText(/Comprar à vista não entrou na comparação/)).toBeNull()
  })

  it('fala de moto em todo o texto: a palavra "carro" só aparece nas comparações de seguro, escritas de propósito', () => {
    const { container } = render(<SimuleMoto snapshot={comFocus} />)
    const texto = (container.textContent ?? '').replaceAll('maior que no carro por causa do risco de roubo', '').replaceAll('mais caro que carro, por causa do risco de roubo', '')
    expect(texto.match(/.{0,60}\bcarros?\b.{0,30}/gi) ?? []).toEqual([])
  })

  it('explica cada custo da moto: IPVA, seguro, manutenção, IOF, gravame e a perda de valor', () => {
    render(<SimuleMoto snapshot={comFocus} />)
    for (const termo of ['Emplacamento e licenciamento', 'IOF do financiamento', 'Gravame', 'Juros do financiamento', 'Taxa de administração', 'Mobilidade sem moto']) {
      expect(screen.getAllByText(termo).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByText('IPVA').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Seguro da moto').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Manutenção e revisões').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Perda de valor da moto').length).toBeGreaterThan(0)
  })

  it('avisa na própria tela que a moto de trabalho (que gera renda) está fora da conta', () => {
    render(<SimuleMoto snapshot={comFocus} />)
    expect(screen.getByText(/não serve para moto de trabalho/)).toBeTruthy()
    expect(screen.getByText(/não considera a renda que a moto gera/, { exact: false })).toBeTruthy()
  })

  it('mostra o ponto de virada em reais por mês sem moto', () => {
    render(<SimuleMoto snapshot={comFocus} />)
    expect(screen.getByText('Em que ponto o resultado muda?')).toBeTruthy()
    expect(screen.getByText(/Financiar × sem moto:/)).toBeTruthy()
  })

  it('valor da moto zerado mostra o erro com o gênero certo', async () => {
    render(<SimuleMoto snapshot={comFocus} />)
    digitar('Valor da moto', '0')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Informe o valor da moto.')).toBeTruthy()
  })
})
