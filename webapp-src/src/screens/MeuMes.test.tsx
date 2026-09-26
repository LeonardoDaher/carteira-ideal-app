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

  it('editar uma compra do cartão: corrige valor e parcelas no mesmo lançamento (ajuste de 26/09/2026)', async () => {
    salvar({ ...exemplo, cartao: { teto: 1000, compras: [{ id: 'k1', descricao: 'Mercado', valor: 50, mes: '2026-10', parcelas: 1 }] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Mercado' }))
    expect(screen.getByText('Editar compra: Mercado')).toBeTruthy()
    expect((screen.getByLabelText('O que foi') as HTMLInputElement).value).toBe('Mercado')
    fireEvent.change(screen.getByLabelText('O que foi'), { target: { value: 'Mercado do mês' } })
    fireEvent.change(screen.getByLabelText('Valor da compra'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(lerSalvo().cartao.compras).toEqual([{ id: 'k1', descricao: 'Mercado do mês', valor: 500, mes: '2026-10', parcelas: 2 }])
    expect(screen.getByRole('button', { name: 'Lançar compra' })).toBeTruthy()
  })

  it('compra parcelada editada em outro mês continua no mês em que foi feita', async () => {
    salvar({ ...exemplo, cartao: { teto: 1000, compras: [{ id: 'k1', descricao: 'Geladeira', valor: 3000, mes: '2026-09', parcelas: 10 }] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Geladeira' }))
    expect(screen.getByText(/Compra feita em setembro de 2026: continua nesse mês/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Valor da compra'), { target: { value: '3.200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(lerSalvo().cartao.compras[0]).toMatchObject({ valor: 3200, mes: '2026-09', parcelas: 10 })
  })

  it('cancelar a edição não muda a compra; remover pelo formulário pede confirmação', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true)
    salvar({ ...exemplo, cartao: { teto: 1000, compras: [{ id: 'k1', descricao: 'Mercado', valor: 50, mes: '2026-10', parcelas: 1 }] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Mercado' }))
    fireEvent.change(screen.getByLabelText('Valor da compra'), { target: { value: '999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(lerSalvo().cartao.compras[0].valor).toBe(50)
    fireEvent.click(screen.getByRole('button', { name: 'Editar Mercado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(confirmar).toHaveBeenCalledWith('Remover "Mercado"?')
    expect(lerSalvo().cartao.compras).toEqual([])
  })

  it('compras à vista do mês de uma vez, numa caixa; parceladas ficam fora (ajuste de 26/09/2026)', async () => {
    salvar({
      ...exemplo,
      cartao: {
        teto: 3000,
        compras: [
          { id: 'g', descricao: 'Geladeira', valor: 3000, mes: '2026-09', parcelas: 10 },
          { id: 'p', descricao: 'Padaria', valor: 100, mes: '2026-10', parcelas: 1 },
        ],
      },
    })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const titulo = await screen.findByRole('button', { name: /Compras à vista de outubro, de uma vez/ })
    expect(titulo.getAttribute('aria-expanded')).toBe('false')
    expect(titulo.closest('.mm-caixa')).toBeTruthy()
    fireEvent.click(titulo)
    expect(screen.getByText(/Parcelado fica de fora/)).toBeTruthy()
    expect(screen.getByText(/já anotou \(R\$\s100,00\) fazem parte desse total/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Total à vista no cartão em outubro'), { target: { value: '50' } })
    expect(screen.getByRole('alert').textContent).toMatch(/menos do que as compras à vista que você já anotou/)
    expect((screen.getByRole('button', { name: 'Lançar total à vista' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Total à vista no cartão em outubro'), { target: { value: '1.000' } })
    expect(screen.getByText(/R\$\s900,00 entram como compras à vista do mês/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar total à vista' }))
    expect(lerSalvo().cartao.compras.find((c) => c.id === 'total-2026-10')).toMatchObject({ valor: 900, parcelas: 1 })
    expect(screen.getByText('Compras à vista do mês')).toBeTruthy()
    // Caixa fecha e mostra o total; 1.000 à vista + 300 da geladeira no gasto.
    expect(screen.getByText(/R\$\s1\.000,00 lançados à vista neste mês/)).toBeTruthy()
    expect(screen.getByText(/Gasto em outubro/).parentElement!.textContent).toMatch(/R\$\s1\.300,00/)

    // Compra parcelada depois não mexe no total à vista.
    fireEvent.change(screen.getByLabelText('O que foi'), { target: { value: 'TV' } })
    fireEvent.change(screen.getByLabelText('Valor da compra'), { target: { value: '2.000' } })
    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar compra' }))
    expect(lerSalvo().cartao.compras.find((c) => c.id === 'total-2026-10')!.valor).toBe(900)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: /Compras à vista de outubro, de uma vez/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Voltar a anotar uma por uma' }))
    expect(lerSalvo().cartao.compras.map((c) => c.descricao)).toEqual(['Geladeira', 'Padaria', 'TV'])
  })

  it('começando agora: compras à vista do mês passado caem na fatura deste mês (ajuste de 26/09/2026)', async () => {
    salvar({ ...exemplo, cartao: { teto: 3000, compras: [{ id: 'm', descricao: 'Mercado', valor: 200, mes: '2026-10', parcelas: 1 }] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const caixa = await screen.findByRole('button', { name: /Começando agora no app\?/ })
    expect(caixa.closest('.mm-caixa')).toBeTruthy()
    expect(screen.getByText(/compras à vista de setembro e parcelamentos que você já estava pagando/)).toBeTruthy()
    fireEvent.click(caixa)
    expect(screen.getByText(/Elas entram na fatura de outubro, que você paga agora/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Total à vista no cartão em setembro'), { target: { value: '1.500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar total à vista' }))
    expect(lerSalvo().cartao.compras.find((c) => c.id === 'total-2026-09')).toMatchObject({ valor: 1500, mes: '2026-09', parcelas: 1 })
    expect(screen.getAllByText('Fatura do cartão').some((e) => /R\$\s1\.500,00/.test(e.closest('li')?.textContent ?? ''))).toBe(true)
    expect(screen.getByText(/R\$\s1\.500,00 lançados/)).toBeTruthy()
    // O gasto de outubro só tem o mercado.
    expect(screen.getByText(/Gasto em outubro/).parentElement!.textContent).toMatch(/R\$\s200,00/)
  })

  it('começando agora: parcela 4 de 10 na fatura deste mês lança a compra no mês certo', async () => {
    salvar({ ...exemplo, cartao: { teto: 3000, compras: [] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: /Começando agora no app\?/ }))
    fireEvent.change(screen.getByLabelText('Compra parcelada'), { target: { value: 'Geladeira' } })
    fireEvent.change(screen.getByLabelText('Valor de cada parcela'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('De quantas'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Parcela na fatura de outubro'), { target: { value: '4' } })
    expect(screen.getByText(/Parcela 4 de 10 na fatura de outubro; a última vem na fatura de abril de 2027\. Compra de junho de 2026, total de R\$\s3\.000,00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar parcelamento' }))
    expect(lerSalvo().cartao.compras[0]).toMatchObject({ descricao: 'Geladeira', valor: 3000, mes: '2026-06', parcelas: 10 })
    expect(screen.getByText(/"Geladeira" lançado: parcela 4 de 10 na fatura de outubro/)).toBeTruthy()
    // Fatura de outubro (gasto de setembro) traz a parcela 4; outubro tem a 5.
    expect(screen.getAllByText('Fatura do cartão').some((e) => /R\$\s300,00/.test(e.closest('li')?.textContent ?? ''))).toBe(true)
    expect(screen.getByText(/Parcela 5 de 10/)).toBeTruthy()
  })

  it('o parcelamento em andamento não passa da última parcela', async () => {
    salvar({ ...exemplo, cartao: { teto: 3000, compras: [] } })
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: /Começando agora no app\?/ }))
    fireEvent.change(screen.getByLabelText('Compra parcelada'), { target: { value: 'Celular' } })
    fireEvent.change(screen.getByLabelText('Valor de cada parcela'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('De quantas'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Parcela na fatura de outubro'), { target: { value: '3' } })
    expect(screen.getByText(/Parcela 3 de 3 na fatura de outubro, a última/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar parcelamento' }))
    expect(lerSalvo().cartao.compras[0]).toMatchObject({ mes: '2026-07', parcelas: 3, valor: 300 })
    expect(screen.queryByText('Celular')).toBeNull() // nada no gasto de outubro: a última foi na fatura deste mês
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
      expect(adicionar.disabled).toBe(true) // falta o valor da parcela
      fireEvent.change(screen.getByLabelText('Valor de cada parcela no cartão'), { target: { value: '140' } })
      expect(screen.getByText(/10x de R\$\s140,00 = R\$\s1\.400,00 no total/)).toBeTruthy()
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
      fireEvent.change(screen.getByLabelText('Valor de cada parcela no cartão'), { target: { value: '100' } })
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

    it('financiamento em Minhas contas e em Minhas dívidas: avisa que conta duas vezes', async () => {
      salvar({
        ...exemplo,
        contas: [{ id: 'fin', nome: 'Aluguel ou financiamento', valor: 900, tipo: 'mensal' }],
        recuperacao: {
          ligadoManual: false,
          dividas: [{ id: 'd', nome: 'Carro', tipo: 'financiamento', saldo: 30000, saldoInicial: 30000, jurosMensal: 1.5, parcelaMinima: 900 }],
          metodo: 'avalanche',
          pactoDesde: null,
        },
      })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      expect(await screen.findByText(/"Aluguel ou financiamento" parece a parcela de uma dívida/)).toBeTruthy()
      fireEvent.change(screen.getByLabelText('Nome da conta'), { target: { value: 'Empréstimo do banco' } })
      expect(screen.getByText(/Você já tem financiamento ou empréstimo em Minhas dívidas/)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Aluguel ou financiamento' })).toBeNull()
    })

    it('parcela digitada: 12x de 120 grava total de 1.440; total abaixo da conta é barrado (ajuste de 26/09/2026)', async () => {
      salvar({ ...exemplo, contas: [exemplo.contas[0]] })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'Seguro do carro' } })
      fireEvent.click(screen.getByRole('button', { name: 'Uma vez por ano' }))
      fireEvent.change(screen.getByLabelText('Valor total no ano'), { target: { value: '1.200' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cartão parcelado' }))
      fireEvent.change(screen.getByLabelText('Em quantas vezes'), { target: { value: '12' } })
      const adicionar = screen.getByRole('button', { name: 'Adicionar conta' }) as HTMLButtonElement
      // O erro do relato: 10 por parcela dá 120 no total, menos que a conta.
      fireEvent.change(screen.getByLabelText('Valor de cada parcela no cartão'), { target: { value: '10' } })
      expect(screen.getByRole('alert').textContent).toMatch(/o cartão não cobra menos\s+que a conta/)
      expect(adicionar.disabled).toBe(true)
      fireEvent.change(screen.getByLabelText('Valor de cada parcela no cartão'), { target: { value: '120' } })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText(/12x de R\$\s120,00 = R\$\s1\.440,00 no total/)).toBeTruthy()
      fireEvent.click(adicionar)
      expect(lerSalvo().contas.find((c) => c.nome === 'Seguro do carro')!.cartaoAnual).toMatchObject({ parcelas: 12, total: 1440 })
    })

    it('12x sem juros: parcela de 100 numa conta de 1.200 é aceita e explicada', async () => {
      salvar({ ...exemplo, contas: [exemplo.contas[0]] })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'Seguro do carro' } })
      fireEvent.click(screen.getByRole('button', { name: 'Uma vez por ano' }))
      fireEvent.change(screen.getByLabelText('Valor total no ano'), { target: { value: '1.200' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cartão parcelado' }))
      fireEvent.change(screen.getByLabelText('Em quantas vezes'), { target: { value: '12' } })
      fireEvent.change(screen.getByLabelText('Valor de cada parcela no cartão'), { target: { value: '100' } })
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByText(/Sem juros: 12x de R\$\s100,00, o mesmo valor da conta/)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar conta' }))
      expect(lerSalvo().contas.find((c) => c.nome === 'Seguro do carro')!.cartaoAnual).toMatchObject({ parcelas: 12, total: 1200 })
    })

    it('arredondamento: 1.000 em 3x de 333,33 é aceito e grava 1.000', async () => {
      salvar({ ...exemplo, contas: [exemplo.contas[0]] })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      fireEvent.change(await screen.findByLabelText('Nome da conta'), { target: { value: 'Matrícula' } })
      fireEvent.click(screen.getByRole('button', { name: 'Uma vez por ano' }))
      fireEvent.change(screen.getByLabelText('Valor total no ano'), { target: { value: '1.000' } })
      fireEvent.click(screen.getByRole('button', { name: 'Cartão parcelado' }))
      fireEvent.change(screen.getByLabelText('Em quantas vezes'), { target: { value: '3' } })
      fireEvent.change(screen.getByLabelText('Valor de cada parcela no cartão'), { target: { value: '333,33' } })
      expect(screen.queryByRole('alert')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Adicionar conta' }))
      expect(lerSalvo().contas.find((c) => c.nome === 'Matrícula')!.cartaoAnual).toMatchObject({ parcelas: 3, total: 1000 })
    })

    it('conta gravada com a parcela no lugar do total aparece marcada na lista', async () => {
      salvar({ ...exemplo, contas: [{ id: 's', nome: 'Seguro do carro', valor: 1200, tipo: 'anual', mesVencimento: 7, cartaoAnual: { parcelas: 12, total: 120, desde: '2026-07' } }] })
      render(<MeuMes ctx={ctx} hoje={hoje} />)
      expect(await screen.findByText(/Total menor que a conta: toque em Editar/)).toBeTruthy()
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar Seguro do carro' }).at(-1)!)
      expect(screen.getByRole('alert')).toBeTruthy()
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
      fireEvent.change(screen.getByLabelText('Valor de cada parcela no cartão'), { target: { value: '130' } })
      fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
      expect(confirmar).toHaveBeenCalled()
      expect(lerSalvo().contas.find((c) => c.id === 'ipva')!.cartaoAnual).toBeUndefined()
    })
  })
})
