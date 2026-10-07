import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SimuleCarro } from './SimuleCarro'
import type { SnapshotMercado } from '../domain/mercadoOficial'

const vazio: SnapshotMercado = { geradoEm: null, indicadores: {}, derivados: {}, tesouro: { dataBase: null, titulos: [] } }
const comFocus: SnapshotMercado = {
  ...vazio,
  indicadores: { cdi: { nome: 'CDI', unidade: '% a.a.', codigoSgs: 4389, data: '2026-09-28', valor: 13.65 } },
  focus: { data: '2026-09-25', ipca: { 2027: 4.3, 2030: 3.5 }, selic: { 2027: 12, 2030: 10 } },
}

const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement
const digitar = (nome: string, valor: string) => fireEvent.change(campo(nome), { target: { value: valor } })
const SEM_CARRO = 'Quanto você gastaria por mês para se mover sem o carro'

describe('SimuleCarro', () => {
  it('abre com um vencedor, as duas leituras (custo e patrimônio) e o aviso de que não indica produto', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    expect(screen.getByRole('heading', { name: 'Comprar à vista, financiar, consórcio, alugar ou ficar sem carro?' })).toBeTruthy()
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
    render(<SimuleCarro snapshot={comFocus} />)
    expect(screen.getByRole('link', { name: '← Simule Bens' }).getAttribute('href')).toBe('./?tela=simuleBens')
  })

  it('usa a projeção de longo prazo do Focus como ponto de partida; sem Focus, os padrões', () => {
    const { unmount } = render(<SimuleCarro snapshot={comFocus} />)
    expect(campo('Rendimento dos investimentos').value).toBe('10')
    expect(campo('Inflação esperada').value).toBe('3,5')
    expect(screen.getByText(/CDI de hoje: 13,65%/)).toBeTruthy()
    expect(screen.getByText(/Boletim Focus \(coleta de 25\/09\/2026\)/)).toBeTruthy()
    unmount()
    render(<SimuleCarro snapshot={vazio} />)
    expect(campo('Inflação esperada').value).toBe('4,5')
    expect(screen.queryByText(/Boletim Focus \(coleta/)).toBeNull()
  })

  it('o tipo é um botão que fica marcado e recarrega os valores de partida do tipo', () => {
    render(<SimuleCarro snapshot={vazio} />)
    const zero = screen.getByRole('button', { name: '0 km' })
    const semi = screen.getByRole('button', { name: 'Seminovo' })
    expect(zero.getAttribute('aria-pressed')).toBe('true')
    expect(campo('Perda de valor no 1º ano').value).toBe('14')
    fireEvent.click(semi)
    expect(semi.getAttribute('aria-pressed')).toBe('true')
    expect(zero.getAttribute('aria-pressed')).toBe('false')
    expect(campo('Perda de valor no 1º ano').value).toBe('9')
    expect(campo('Valor do carro').value).toBe('100.000,00')
  })

  it('gasto muito baixo sem carro faz "Sem carro" vencer', async () => {
    render(<SimuleCarro snapshot={comFocus} />)
    digitar(SEM_CARRO, '200')
    expect(await screen.findByText('Sem carro', { selector: 'span.font-display' })).toBeTruthy()
  })

  it('gasto muito alto sem carro faz ter o carro vencer', async () => {
    render(<SimuleCarro snapshot={comFocus} />)
    digitar(SEM_CARRO, '9000')
    const vencedor = await screen.findByText(/o caminho de menor custo/)
    const cartao = vencedor.closest('.imovel-vencedor') as HTMLElement
    expect(within(cartao).queryByText('Sem carro', { selector: 'span.font-display' })).toBeNull()
  })

  it('sem dinheiro para o à vista, diz quanto falta; ao incluir, o bloco da compra à vista aparece', async () => {
    render(<SimuleCarro snapshot={comFocus} />)
    expect(screen.getByText(/Comprar à vista não entrou na comparação/)).toBeTruthy()
    expect(screen.queryByText('Comprar à vista: cada custo e cada taxa')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Incluir comprar à vista/ }))
    expect(await screen.findByText('Comprar à vista: cada custo e cada taxa')).toBeTruthy()
    expect(screen.queryByText(/Comprar à vista não entrou na comparação/)).toBeNull()
  })

  it('explica cada custo do carro: IPVA, seguro, manutenção, IOF, gravame e a perda de valor', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    for (const termo of ['Emplacamento e licenciamento', 'IOF do financiamento', 'Gravame', 'Juros do financiamento', 'Taxa de administração', 'Mobilidade sem carro']) {
      expect(screen.getAllByText(termo).length).toBeGreaterThan(0)
    }
    expect(screen.getAllByText('IPVA').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Seguro do carro').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Manutenção e revisões').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Perda de valor do carro').length).toBeGreaterThan(0)
  })

  it('mostra o ponto de virada em reais por mês sem carro', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    expect(screen.getByText('Em que ponto o resultado muda?')).toBeTruthy()
    expect(screen.getByText(/Financiar × sem carro:/)).toBeTruthy()
  })

  it('valor do carro zerado mostra o erro em vez do resultado', async () => {
    render(<SimuleCarro snapshot={comFocus} />)
    digitar('Valor do carro', '0')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Informe o valor do carro.')).toBeTruthy()
  })
})


describe('SimuleCarro: locação e escolha dos caminhos (D69)', () => {
  const grupo = () => screen.getByRole('group', { name: 'Quais caminhos comparar?' })
  const chip = (nome: string) => within(grupo()).getByRole('button', { name: new RegExp(`^(✓ )?${nome}$`) })
  const ligado = (nome: string) => chip(nome).getAttribute('aria-pressed') === 'true'

  it('abre com os cinco caminhos marcados e a locação no ranking, no gráfico e nos blocos', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    for (const n of ['Comprar à vista', 'Financiar', 'Consórcio', 'Locação', 'Sem carro']) expect(ligado(n)).toBe(true)
    const ranking = screen.getByText('Patrimônio líquido final').closest('.card') as HTMLElement
    expect(within(ranking).getByText(/\dº Locação$/)).toBeTruthy()
    expect(screen.getByText('Locação: cada custo e cada taxa')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Locação R\$/ })).toBeTruthy()
    expect(screen.getByText('Financiar × locação:')).toBeTruthy()
  })

  it('comparar só locação × sem carro: ranking de dois, tabela de duas colunas e sem ponto de virada de quem tem o bem', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    fireEvent.click(chip('Financiar'))
    fireEvent.click(chip('Consórcio'))
    const ranking = screen.getByText('Patrimônio líquido final').closest('.card') as HTMLElement
    expect(within(ranking).queryByText(/3º/)).toBeNull()
    expect(within(ranking).getByText(/\dº Locação$/)).toBeTruthy()
    expect(within(ranking).getByText(/\dº Sem carro$/)).toBeTruthy()
    const tabela = screen.getByRole('table', { name: 'Para onde foi o dinheiro em cada caminho' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent).filter(Boolean)).toEqual(['Sem carro', 'Locação'])
    expect(screen.queryByText('Financiar: cada custo e cada taxa')).toBeNull()
    expect(screen.queryByText('Consórcio: cada custo e cada taxa')).toBeNull()
    expect(screen.queryByText(/× locação:/)).toBeNull()
    expect(screen.queryByText('Em que ponto o resultado muda?')).toBeNull()
  })

  it('financiar × locação mostra o ponto de virada na mensalidade, sem o caminho sem o bem', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    fireEvent.click(chip('Comprar à vista'))
    fireEvent.click(chip('Consórcio'))
    fireEvent.click(chip('Sem carro'))
    expect(screen.getByText('Financiar × locação:')).toBeTruthy()
    expect(screen.queryByText(/× sem carro:/)).toBeNull()
    expect(screen.getByText(/mensalidade da locação/)).toBeTruthy()
  })

  it('não deixa ficar com menos de dois caminhos, e "Comparar todos" volta ao conjunto completo', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    fireEvent.click(chip('Comprar à vista'))
    fireEvent.click(chip('Financiar'))
    fireEvent.click(chip('Consórcio'))
    fireEvent.click(chip('Locação')) // sobraria um só: não muda
    expect(ligado('Locação')).toBe(true)
    expect(ligado('Sem carro')).toBe(true)
    fireEvent.click(within(grupo()).getByRole('button', { name: 'Comparar todos' }))
    for (const n of ['Comprar à vista', 'Financiar', 'Consórcio', 'Locação', 'Sem carro']) expect(ligado(n)).toBe(true)
  })

  it('à vista × locação sem dinheiro explica o que falta e o atalho resolve', async () => {
    render(<SimuleCarro snapshot={comFocus} />)
    fireEvent.click(chip('Financiar'))
    fireEvent.click(chip('Consórcio'))
    fireEvent.click(chip('Sem carro'))
    expect(screen.getByRole('alert').textContent).toMatch(/não dá para comprar à vista/)
    fireEvent.click(within(grupo()).getByRole('button', { name: /como dinheiro disponível/ }))
    expect(await screen.findByText('Locação: cada custo e cada taxa')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('os campos da locação existem; comprar no fim mostra o valor da compra e o bloco explica a compra', async () => {
    render(<SimuleCarro snapshot={comFocus} />)
    for (const rotulo of ['Mensalidade da locação', 'Reajuste anual', 'Caução', 'Taxa de entrada', 'Quilômetros incluídos por mês', 'Quilômetros que você roda por mês', 'Preço do quilômetro excedente']) {
      expect(screen.getByLabelText(rotulo)).toBeTruthy()
    }
    expect(screen.queryByLabelText('Valor da compra no fim')).toBeNull()
    expect(screen.queryByText('Compra no fim do contrato')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: /no fim do contrato/ }))
    expect(screen.getByLabelText('Valor da compra no fim')).toBeTruthy()
    expect(await screen.findByText('Compra no fim do contrato')).toBeTruthy()
    expect(screen.getByText('Transferência na compra')).toBeTruthy()
  })

  it('quilômetro acima do limite aparece como custo; dentro do limite, o bloco diz que não há cobrança', async () => {
    render(<SimuleCarro snapshot={comFocus} />)
    expect(screen.getByText(/dentro do limite, não há cobrança/)).toBeTruthy()
    digitar('Quilômetros que você roda por mês', '3500')
    expect(await screen.findByText(/sobram 1\.500 km por mês/)).toBeTruthy()
  })

  it('o bloco da locação cita IPVA, seguro e manutenção incluídos e a caução devolvida', () => {
    render(<SimuleCarro snapshot={comFocus} />)
    const bloco = screen.getByText('Locação: cada custo e cada taxa').closest('details') as HTMLElement
    expect(within(bloco).getByText(/já inclui IPVA, seguro e manutenção/i, { exact: false, selector: 'span' })).toBeTruthy()
    expect(within(bloco).getByText(/devolvida no fim do contrato, sem rendimento/)).toBeTruthy()
  })
})
