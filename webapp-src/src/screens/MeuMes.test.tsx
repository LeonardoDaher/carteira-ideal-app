import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MeuMes } from './MeuMes'
import { CHAVE_ORCAMENTO } from '../state/useOrcamento'
import type { AppCtx } from '../state/useAppState'
import type { Orcamento } from '../domain/orcamento'

const ctx = {} as AppCtx
const hoje = new Date(2026, 9, 5) // 5 de outubro de 2026

function salvar(orcamento: Orcamento) {
  localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 1, orcamento }))
}

function lerSalvo(): Orcamento {
  return JSON.parse(localStorage.getItem(CHAVE_ORCAMENTO)!).orcamento
}

const exemplo: Orcamento = {
  salario: 4000,
  reserva: 0,
  potes: { guardar: 500, crescer: 300 },
  contas: [
    { id: 'aluguel', nome: 'Aluguel', valor: 1500, tipo: 'mensal' },
    { id: 'ipva', nome: 'IPVA', valor: 1200, tipo: 'anual', mesVencimento: 1 },
  ],
  pagamentos: {},
  cartao: { teto: 0, compras: [] },
}

/** Normaliza espaços (o Intl usa espaço não separável em "R$ 1.500,00"). */
const txt = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ')

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('MeuMes', () => {
  it('primeira vez: pede o salário e avisa que os dados ficam no aparelho', async () => {
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText('Comece pelo salário')).toBeTruthy()
    expect(screen.getByText(/Nada é enviado para a internet/)).toBeTruthy()
    const continuar = screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement
    expect(continuar.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Salário líquido'), { target: { value: '3.200,50' } })
    fireEvent.click(continuar)

    expect(await screen.findByText('Nenhuma conta ainda')).toBeTruthy()
    expect(lerSalvo().salario).toBe(3200.5)
  })

  it('cadastra conta mensal e anual; a anual vira cofrinho pelos meses que faltam', async () => {
    salvar({ ...exemplo, contas: [], potes: { guardar: 0, crescer: 0 } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    await screen.findByText('Minhas contas')

    fireEvent.click(screen.getByRole('button', { name: 'Plano de saúde' }))
    fireEvent.change(screen.getByLabelText('Valor por mês'), { target: { value: '650' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar conta' }))

    // IPVA: atalho já vem como anual, vencendo em janeiro (fica em "Mais atalhos")
    fireEvent.click(screen.getByRole('button', { name: /^Mais \d+ atalhos$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'IPVA' }))
    expect(screen.getByRole('button', { name: 'Uma vez por ano' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.change(screen.getByLabelText('Valor total no ano'), { target: { value: '1.200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar conta' }))

    // Outubro → janeiro: 4 depósitos de R$ 300
    const lista = screen.getAllByText('Cofrinhos das contas do ano')[0].parentElement!
    expect(txt(lista)).toContain('Cofrinho para janeiro')
    expect(txt(lista)).toContain('R$ 300,00')
    // As sugestões já usadas somem da lista
    expect(screen.queryByRole('button', { name: 'IPVA' })).toBeNull()
    expect(lerSalvo().contas.map((c) => c.nome)).toEqual(['Plano de saúde', 'IPVA'])
  })

  it('mostra o caminho do salário até o pote Gastar', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const card = (await screen.findByText('Para onde vai o salário de outubro')).parentElement!
    // 4.000 − 1.500 − 300 (cofrinho) − 500 − 300 = 1.400
    expect(txt(within(card).getByText('Gastar no dia a dia').closest('.mm-total') as HTMLElement)).toContain('R$ 1.400,00')
    expect(within(card).getByRole('status').textContent).toContain('cabem no salário')
  })

  it('avisa quando as contas passam do salário, sem sugerir crédito', async () => {
    salvar({ ...exemplo, salario: 1500 })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const card = (await screen.findByText('Para onde vai o salário de outubro')).parentElement!
    const aviso = within(card).getByRole('status').textContent!
    expect(aviso).toContain('passam do salário')
    expect(aviso).toContain('Não cubra a diferença com cartão ou cheque especial')
  })

  it('ticar marca a conta, atualiza o que falta e fica salvo', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const aluguel = (await screen.findAllByRole('checkbox'))[0]
    fireEvent.click(aluguel)
    expect((aluguel as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('1 de 2')).toBeTruthy()
    expect(lerSalvo().pagamentos).toEqual({ '2026-10': { aluguel: 1500 } })
  })

  it('o depósito no cofrinho aparece como já guardado no mês seguinte', async () => {
    salvar({ ...exemplo, pagamentos: { '2026-10': { ipva: 300 } } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByText('novembro de 2026')).toBeTruthy()
    expect(screen.getByText(/R\$\s300,00 já no cofrinho/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'voltar para o mês atual' }))
    expect(screen.getByText('outubro de 2026')).toBeTruthy()
  })

  it('no mês do vencimento, a conta anual aparece como pagamento', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={new Date(2027, 0, 10)} />)
    expect(await screen.findByText(/Vence este mês/)).toBeTruthy()
  })

  it('reserva abaixo de 3 meses orienta a priorizar o pote Guardar', async () => {
    salvar({ ...exemplo, reserva: 3000 }) // custo 1.600/mês → 1,8 mês
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText(/paga 1,8 meses de contas.*priorize o pote Guardar/)).toBeTruthy()
  })

  it('editar e remover uma conta', async () => {
    salvar({ ...exemplo, pagamentos: { '2026-10': { aluguel: 1500 } } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar Aluguel' }))[0])
    expect((screen.getByLabelText('Nome da conta') as HTMLInputElement).value).toBe('Aluguel')
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(lerSalvo().contas.map((c) => c.id)).toEqual(['ipva'])
    expect(lerSalvo().pagamentos).toEqual({})
  })

  it('restaurar um arquivo que não é cópia não altera nada', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const input = await screen.findByTestId('arquivo-copia')
    const arquivo = new File(['{"qualquer": 1}'], 'x.json', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [arquivo] } })
    })
    expect(await screen.findByText(/não é uma cópia do Meu Mês/)).toBeTruthy()
    expect(lerSalvo()).toEqual(exemplo)
  })

  it('dado salvo na Etapa 1, sem cartão, abre normalmente', async () => {
    const { cartao: _semCartao, ...antigo } = exemplo
    localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 1, orcamento: antigo }))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText('Seu teto por mês')).toBeTruthy()
    expect(screen.getByText('Defina um teto para acompanhar o cartão.')).toBeTruthy()
  })

  it('sugere um teto que cabe no pote Gastar e aplica com um toque', async () => {
    salvar(exemplo) // 4.000 − 1.500 − 100 − 500 − 300 = 1.600
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: /Usar R\$\s1\.600,00/ }))
    expect(lerSalvo().cartao.teto).toBe(1600)
  })

  it('avisa quando o teto escolhido passa do que sobra', async () => {
    salvar({ ...exemplo, cartao: { teto: 3000, compras: [] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText(/Esse teto passa do que sobra no seu mês/)).toBeTruthy()
  })

  it('lança compra parcelada: avisa o comprometimento e mostra as parcelas futuras', async () => {
    salvar({ ...exemplo, cartao: { teto: 1000, compras: [] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.change(await screen.findByLabelText('O que foi'), { target: { value: 'Geladeira' } })
    fireEvent.change(screen.getByLabelText('Valor da compra'), { target: { value: '900' } })
    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: '3' } })
    expect(txt(screen.getByRole('note', { name: '' }) as HTMLElement)).toContain('compromete os próximos 2 meses')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar compra' }))

    expect(lerSalvo().cartao.compras).toMatchObject([{ descricao: 'Geladeira', valor: 900, mes: '2026-10', parcelas: 3 }])
    expect(screen.getByText(/Parcela 1 de 3 \(total R\$\s900,00\)/)).toBeTruthy()
    expect(screen.getByText('Parcelas que você já assumiu')).toBeTruthy()
    expect(screen.getByText('dezembro de 2026')).toBeTruthy()
    expect(screen.getByText(/Dentro do teto/)).toBeTruthy()
  })

  it('semáforo vermelho ao passar do teto, avisando o mês que vai apertar', async () => {
    salvar({ ...exemplo, cartao: { teto: 500, compras: [{ id: 'k', descricao: 'Mercado', valor: 650, mes: '2026-10', parcelas: 1 }] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText(/passou do teto.*apertar o salário de novembro/)).toBeTruthy()
  })

  it('a fatura entra como conta ticável no mês seguinte e no caminho do salário', async () => {
    salvar({ ...exemplo, cartao: { teto: 1000, compras: [{ id: 'k', descricao: 'Mercado', valor: 650, mes: '2026-10', parcelas: 1 }] } })
    render(<MeuMes ctx={ctx} hoje={new Date(2026, 10, 5)} />)
    expect(await screen.findByText('Compras de outubro no cartão.')).toBeTruthy()
    const card = screen.getByText('Para onde vai o salário de novembro').parentElement!
    expect(txt(card)).toContain('Fatura do cartão')
    // 4.000 − 1.500 − 400 (cofrinho: 3 meses até janeiro) − 650 − 500 − 300 = 650
    expect(txt(within(card).getByText('Gastar no dia a dia').closest('.mm-total') as HTMLElement)).toContain('R$ 650,00')
    fireEvent.click(screen.getAllByRole('checkbox').at(-1)!)
    expect(lerSalvo().pagamentos['2026-11']).toEqual({ 'cartao:fatura': 650 })
  })

  it('dado salvo corrompido não trava a tela', async () => {
    localStorage.setItem(CHAVE_ORCAMENTO, '{isto não é json')
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText('Comece pelo salário')).toBeTruthy()
  })

  describe('ajustes após a Etapa 4', () => {
    /** O cartão "Contas do mês" (o título também aparece no caminho do salário). */
    const listaDoMes = async () =>
      (await screen.findAllByText('Contas do mês')).map((e) => e.closest('.card')).find((c) => c?.querySelector('.mm-check')) as HTMLElement

    it('"Editar" na lista do mês abre a conta no formulário, e o valor pode ser mudado', async () => {
      salvar(exemplo)
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      const lista = await listaDoMes()
      fireEvent.click(within(lista).getByRole('button', { name: 'Editar Aluguel' }))
      expect(screen.getByText('Editar conta: Aluguel')).toBeTruthy()
      fireEvent.change(screen.getByLabelText('Valor por mês'), { target: { value: '1.650' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
      expect(lerSalvo().contas.find((c) => c.id === 'aluguel')!.valor).toBe(1650)
    })

    it('tocar em "Editar" não tica a conta', async () => {
      salvar(exemplo)
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      const lista = await listaDoMes()
      fireEvent.click(within(lista).getByRole('button', { name: 'Editar Aluguel' }))
      expect(lerSalvo().pagamentos).toEqual({})
    })

    it('qualquer nome pode ser cadastrado, sem usar os atalhos', async () => {
      salvar(exemplo)
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'Academia' } })
      fireEvent.change(screen.getByLabelText('Valor por mês'), { target: { value: '120' } })
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar conta' }))
      expect(lerSalvo().contas.map((c) => c.nome)).toContain('Academia')
    })

    it('conta no cartão: sai da lista do mês, entra no gasto do cartão e na fatura seguinte', async () => {
      salvar(exemplo)
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'Streaming' } })
      fireEvent.change(screen.getByLabelText('Valor por mês'), { target: { value: '40' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cartão de crédito' }))
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar conta' }))

      const streaming = lerSalvo().contas.find((c) => c.nome === 'Streaming')!
      expect(streaming.cartaoDesde).toBe('2026-10')

      const lista = await listaDoMes()
      expect(within(lista).queryByRole('checkbox', { name: /Streaming/ })).toBeNull()
      expect(txt(lista)).toContain('Streaming é paga no cartão')

      const cartao = screen.getByText('Seu teto por mês').closest('.card') as HTMLElement
      expect(txt(cartao)).toContain('Conta de todo mês')
      expect(txt(cartao)).toContain('R$ 40,00')
      expect(screen.getByText('Todo mês, no cartão de crédito')).toBeTruthy()
    })


    it('conta anual parcelada no cartão: mostra o custo, some do cofrinho e vira parcelas', async () => {
      salvar({ ...exemplo, contas: [exemplo.contas[0]] })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'IPVA' } })
      fireEvent.click(screen.getByRole('button', { name: 'Uma vez por ano' }))
      fireEvent.change(screen.getByLabelText('Valor total no ano'), { target: { value: '1.200' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cartão parcelado' }))
      const adicionar = screen.getByRole('button', { name: 'Adicionar conta' }) as HTMLButtonElement
      expect(adicionar.disabled).toBe(true) // falta o total com juros
      fireEvent.change(screen.getByLabelText('Total cobrado no cartão, com juros e taxas'), { target: { value: '1.400' } })
      expect(screen.getByText(/Parcelando em 10x, você paga R\$\s200,00 a mais \(16,7% sobre o valor\), cerca de 2,9\d?% ao mês/)).toBeTruthy()
      fireEvent.click(adicionar)

      const ipva = lerSalvo().contas.find((c) => c.nome === 'IPVA')!
      expect(ipva.cartaoAnual).toEqual({ parcelas: 10, total: 1400, desde: '2026-10' })
      const lista = await listaDoMes()
      expect(within(lista).queryByRole('checkbox', { name: /IPVA/ })).toBeNull()
      expect(txt(lista)).toMatch(/IPVA vai parcelada no cartão \(10x de R\$\s140,00\)/)
      expect(screen.getByText(/no cartão em 10x \(total R\$\s1\.400,00\)/)).toBeTruthy()
    })

    it('parcelamento já em andamento: pergunta, e a parcela do mês pesa no teto (ajuste de 26/09/2026)', async () => {
      salvar({ ...exemplo, contas: [exemplo.contas[0]], cartao: { teto: 1000, compras: [] } })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'IPTU' } })
      fireEvent.click(screen.getByRole('button', { name: 'Uma vez por ano' }))
      fireEvent.change(screen.getByLabelText('Valor total no ano'), { target: { value: '1.000' } })
      fireEvent.change(screen.getByLabelText(/Mês do vencimento/), { target: { value: '9' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cartão parcelado' }))
      fireEvent.change(screen.getByLabelText('Total cobrado no cartão, com juros e taxas'), { target: { value: '1.000' } })
      // Padrão: é o próximo vencimento (setembro de 2027).
      expect(screen.getByText(/1ª parcela entra no gasto do cartão em setembro de 2027/)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Sim, já estou pagando' }))
      expect(screen.getByText(/a parcela 2 de 10 já entra no gasto do cartão deste mês/)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar conta' }))

      expect(lerSalvo().contas.find((c) => c.nome === 'IPTU')!.cartaoAnual!.desde).toBe('2026-09')
      const cartao = screen.getByText('Seu teto por mês').closest('.card') as HTMLElement
      expect(txt(cartao)).toMatch(/Gasto em outubro\s?R\$ 100,00 de R\$ 1\.000,00/)
      expect(txt(cartao)).toContain('parcela 2 de 10')
    })

    it('"Apagar tudo e começar de novo" fica numa caixa amarela e pede confirmação', async () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
      salvar(exemplo)
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      const botao = await screen.findByRole('button', { name: 'Apagar tudo e começar de novo' })
      expect(botao.className).toContain('mm-apagar-tudo')
      fireEvent.click(botao)
      expect(confirmar).toHaveBeenCalled()
      expect(lerSalvo().salario).toBe(4000)
    })

    it('conta anual no cartão à vista: o cofrinho continua e avisa que vai no cartão', async () => {
      salvar({ ...exemplo, contas: [{ ...exemplo.contas[1], cartaoAnual: { parcelas: 1, total: 1200, desde: '2026-10' } }] })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      const lista = await listaDoMes()
      expect(txt(lista)).toContain('Vai no cartão à vista.')
      expect(txt(lista)).toContain('R$ 300,00')
    })

    it('com o pacto de não parcelar, parcelar conta do ano pede confirmação', async () => {
      const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
      salvar({ ...exemplo, recuperacao: { ligadoManual: true, dividas: [], metodo: 'avalanche', pactoDesde: '2026-10' } })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.click((await screen.findAllByRole('button', { name: 'Editar IPVA' }))[0])
      fireEvent.click(screen.getByRole('button', { name: 'Cartão parcelado' }))
      fireEvent.change(screen.getByLabelText('Total cobrado no cartão, com juros e taxas'), { target: { value: '1.300' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
      expect(confirmar).toHaveBeenCalled()
      expect(lerSalvo().contas.find((c) => c.id === 'ipva')!.cartaoAnual).toBeUndefined()
    })
  })
})
