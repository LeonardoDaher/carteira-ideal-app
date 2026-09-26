import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MeuMes } from './MeuMes'
import { CHAVE_ORCAMENTO } from '../state/useOrcamento'
import type { AppCtx } from '../state/useAppState'
import type { Orcamento } from '../domain/orcamento'
import type { Divida } from '../domain/recuperacao'

const ctx = {} as AppCtx
const hoje = new Date(2026, 9, 5) // 5 de outubro de 2026

function salvar(orcamento: Orcamento) {
  localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 1, orcamento }))
}

function lerSalvo(): Orcamento {
  return JSON.parse(localStorage.getItem(CHAVE_ORCAMENTO)!).orcamento
}

const txt = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ')

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

const cheque: Divida = {
  id: 'cheque',
  nome: 'Cheque do banco',
  tipo: 'cheque-especial',
  saldo: 2000,
  saldoInicial: 2000,
  jurosMensal: 8,
  parcelaMinima: 200,
}
const loja: Divida = { id: 'loja', nome: 'Carnê da loja', tipo: 'outra', saldo: 600, saldoInicial: 600, jurosMensal: 4, parcelaMinima: 100 }

const comDividas = (dividas: Divida[], p: Partial<Orcamento> = {}): Orcamento => ({
  ...exemplo,
  recuperacao: { ligadoManual: false, dividas, metodo: 'avalanche', pactoDesde: null },
  ...p,
})

const gastar = () => txt(screen.getByText('Gastar no dia a dia').closest('.mm-total') as HTMLElement)

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('Meu Mês, Modo Recuperação', () => {
  it('sem dívidas: convite discreto, nada do modo ligado', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByRole('button', { name: 'Cadastrar uma dívida' })).toBeTruthy()
    expect(screen.queryByText('Modo Recuperação ligado')).toBeNull()
    expect(screen.getByLabelText('🟡 Fazer Crescer, para investir')).toBeTruthy()
    expect(screen.queryByText('Como negociar suas dívidas')).toBeNull()
  })

  it('cadastrar dívida cara liga o modo e troca o Fazer Crescer pelo Quitar', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar uma dívida' }))
    fireEvent.change(screen.getByLabelText('Nome da dívida'), { target: { value: 'Cheque do banco' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'cheque-especial' } })
    expect((screen.getByLabelText('Juros ao mês (%)') as HTMLInputElement).value).toBe('8')
    fireEvent.change(screen.getByLabelText('Quanto deve hoje'), { target: { value: '2.000' } })
    fireEvent.change(screen.getByLabelText('Parcela ou pagamento mínimo por mês'), { target: { value: '200' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar dívida' }))

    expect(lerSalvo().recuperacao!.dividas).toMatchObject([
      { nome: 'Cheque do banco', tipo: 'cheque-especial', saldo: 2000, saldoInicial: 2000, jurosMensal: 8, parcelaMinima: 200 },
    ])
    expect(screen.getByText('Modo Recuperação ligado')).toBeTruthy()
    expect(screen.getByText('Cara')).toBeTruthy()
    expect(screen.getByText(/Fazer Crescer está pausado/)).toBeTruthy()
    expect(screen.queryByLabelText('🟡 Fazer Crescer, para investir')).toBeNull()
    expect(screen.getByText('Dívidas (plano de quitação)')).toBeTruthy()
    expect(screen.getByText('Como negociar suas dívidas')).toBeTruthy()
    // 4.000 − 1.500 − 300 (cofrinho) − 200 (mínima) − 500 (Guardar) − 0 (Quitar) = 1.500
    expect(gastar()).toContain('R$ 1.500,00')
  })

  it('a taxa de referência só troca enquanto a pessoa não digitou a dela', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar uma dívida' }))
    const juros = screen.getByLabelText('Juros ao mês (%)') as HTMLInputElement
    expect(juros.value).toBe('14')
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'cartao-parcelado' } })
    expect(juros.value).toBe('9')
    fireEvent.change(juros, { target: { value: '11,5' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'emprestimo-pessoal' } })
    expect(juros.value).toBe('11,5')
  })

  it('avisa quando a parcela mínima não cobre os juros', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar uma dívida' }))
    fireEvent.change(screen.getByLabelText('Quanto deve hoje'), { target: { value: '3.000' } })
    fireEvent.change(screen.getByLabelText('Parcela ou pagamento mínimo por mês'), { target: { value: '300' } })
    // Rotativo a 14%: juros de R$ 420 no mês
    expect(txt(screen.getByRole('note'))).toContain('não cobre nem os juros do mês (R$ 420,00)')
  })

  it('o pote Quitar acelera o plano e sai do pote Gastar', async () => {
    salvar(comDividas([cheque]))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.change(await screen.findByLabelText('🔴 Pote Quitar: quanto a mais por mês, além das mínimas'), { target: { value: '400' } })
    expect(lerSalvo().potes.quitar).toBe(400)
    expect(gastar()).toContain('R$ 1.100,00')
    expect(screen.getByText(/Só com as parcelas mínimas, levaria/)).toBeTruthy()
    // Na lista do mês, o pagamento traz a mínima e o extra
    expect(screen.getByText(/Mínima R\$\s200,00 \+ R\$\s400,00 do pote Quitar/)).toBeTruthy()
  })

  it('compara avalanche e bola de neve lado a lado e guarda a escolha', async () => {
    salvar(comDividas([cheque, loja], { potes: { guardar: 500, crescer: 300, quitar: 400 } }))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const grupo = await screen.findByRole('group', { name: 'Método de quitação' })
    const avalanche = within(grupo).getByRole('button', { name: /Avalanche/ })
    const bola = within(grupo).getByRole('button', { name: /Bola de neve/ })
    expect(avalanche.getAttribute('aria-pressed')).toBe('true')
    expect(txt(avalanche)).toContain('Juros até lá')
    expect(screen.getByText(/A avalanche economiza/)).toBeTruthy()
    fireEvent.click(bola)
    expect(lerSalvo().recuperacao!.metodo).toBe('bola-de-neve')
    expect(screen.getByText('Ordem de ataque (bola de neve)')).toBeTruthy()
  })

  it('financiamento barato fica fora do plano das dívidas caras', async () => {
    const carro: Divida = { id: 'carro', nome: 'Carro', tipo: 'financiamento', saldo: 15000, saldoInicial: 18000, jurosMensal: 1.5, parcelaMinima: 650 }
    salvar(comDividas([cheque, carro], { potes: { guardar: 500, crescer: 300, quitar: 400 } }))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText(/Carro fica fora do plano/)).toBeTruthy()
    expect(screen.getByText('Por mês para as dívidas caras')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Método de quitação' })).toBeNull()
  })

  it('avisa quando o plano não termina', async () => {
    const rotativo: Divida = { ...cheque, id: 'rot', nome: 'Rotativo', tipo: 'cartao-rotativo', jurosMensal: 14, parcelaMinima: 100 }
    salvar(comDividas([rotativo]))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText(/os juros crescem mais rápido do que os pagamentos/)).toBeTruthy()
  })

  it('pacto de não parcelar: só à vista, e quebrar exige confirmação', async () => {
    salvar(comDividas([cheque], { cartao: { teto: 1000, compras: [] } }))
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Fazer o pacto' }))
    expect(lerSalvo().recuperacao!.pactoDesde).toBe('2026-10')
    expect(screen.getByText('Pacto de não parcelar desde outubro de 2026')).toBeTruthy()

    const forma = screen.getByLabelText('Forma de pagamento') as HTMLSelectElement
    expect(forma.options).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Quebrar o pacto nesta compra' }))
    expect(confirmar).toHaveBeenCalledOnce()
    expect(forma.options).toHaveLength(1)

    confirmar.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Quebrar o pacto nesta compra' }))
    expect(forma.options).toHaveLength(12)
    fireEvent.change(screen.getByLabelText('O que foi'), { target: { value: 'Celular' } })
    fireEvent.change(screen.getByLabelText('Valor da compra'), { target: { value: '1.200' } })
    fireEvent.change(forma, { target: { value: '6' } })
    expect(screen.getByText(/Esta compra quebra o seu pacto/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar compra' }))

    expect(lerSalvo().cartao.compras).toMatchObject([{ descricao: 'Celular', parcelas: 6 }])
    expect(screen.getByText(/1 compra parcelada desde o pacto/)).toBeTruthy()
    // Depois de lançar, o parcelamento volta a ficar travado
    expect((screen.getByLabelText('Forma de pagamento') as HTMLSelectElement).options).toHaveLength(1)
  })

  it('ticar o pagamento da dívida guarda o valor do mês', async () => {
    salvar(comDividas([cheque], { potes: { guardar: 500, crescer: 300, quitar: 400 } }))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    const lista = (await screen.findByText('Dívidas (plano de quitação)')).parentElement!
    fireEvent.click(within(lista).getByRole('checkbox'))
    expect(lerSalvo().pagamentos['2026-10']).toEqual({ 'divida:cheque': 600 })
  })

  it('atualizar o saldo mostra o quanto já foi abatido', async () => {
    salvar(comDividas([cheque]))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cheque do banco' }))
    fireEvent.change(screen.getByLabelText('Quanto deve hoje'), { target: { value: '1.500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(lerSalvo().recuperacao!.dividas[0]).toMatchObject({ saldo: 1500, saldoInicial: 2000 })
    expect(screen.getByText(/R\$\s500,00 já abatidos de R\$\s2\.000,00/)).toBeTruthy()
  })

  it('quitar a última dívida cara desliga o modo e comemora', async () => {
    salvar(comDividas([{ ...cheque, saldo: 0 }]))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText(/Você quitou as dívidas caras!/)).toBeTruthy()
    expect(screen.queryByText('Modo Recuperação ligado')).toBeNull()
    expect(screen.getByLabelText('🟡 Fazer Crescer, para investir')).toBeTruthy()
    expect(screen.getByText('Quitada 🎉')).toBeTruthy()
  })

  it('remover a dívida apaga os pagamentos ticados dela', async () => {
    salvar(comDividas([cheque], { pagamentos: { '2026-10': { aluguel: 1500, 'divida:cheque': 200 } } }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Cheque do banco' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(lerSalvo().recuperacao!.dividas).toEqual([])
    expect(lerSalvo().pagamentos).toEqual({ '2026-10': { aluguel: 1500 } })
  })

  it('ligar e desligar o modo por conta própria', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ligar o Modo Recuperação sem cadastrar dívida' }))
    expect(screen.getByText('Modo Recuperação ligado')).toBeTruthy()
    expect(screen.getByText(/Primeira fase do Modo Recuperação: mini-reserva de R\$\s800,00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Desligar o Modo Recuperação' }))
    expect(screen.queryByText('Modo Recuperação ligado')).toBeNull()
    expect(lerSalvo().recuperacao!.ligadoManual).toBe(false)
  })

  it('roteiro de negociação com fontes oficiais abrindo em nova aba', async () => {
    salvar(comDividas([cheque]))
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    await screen.findByText('Como negociar suas dívidas')
    const link = screen.getByRole('link', { name: 'consumidor.gov.br' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(screen.getByRole('link', { name: /Lei 14\.181\/2021/ })).toBeTruthy()
    expect(screen.getByText(/não indica banco nem produto de crédito/)).toBeTruthy()
  })

  it('Etapa 4: com dívida, oferece a trilha "Sair das dívidas"; sem dívida, não', async () => {
    const abrirTrilha = vi.fn()
    salvar(comDividas([cheque]))
    const { unmount } = render(<MeuMes ctx={{ abrirTrilha } as unknown as AppCtx} hoje={hoje} />)
    const botao = (await screen.findByText('Trilha Sair das dívidas')).closest('button')!
    expect(botao.textContent).toContain('9 aulas curtas')
    fireEvent.click(botao)
    expect(abrirTrilha).toHaveBeenCalledWith('sair-das-dividas')
    unmount()

    localStorage.clear()
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    await screen.findByRole('button', { name: 'Cadastrar uma dívida' })
    expect(screen.queryByText('Trilha Sair das dívidas')).toBeNull()
  })

  it('financiamento com juros ao ano: converte para ao mês por juros compostos', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar uma dívida' }))
    fireEvent.change(screen.getByLabelText('Nome da dívida'), { target: { value: 'Carro' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'financiamento' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ao ano' }))
    fireEvent.change(screen.getByLabelText('Juros ao ano (%)'), { target: { value: '12' } })
    expect(screen.getByText('12% ao ano equivalem a 0,95% ao mês.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Quanto deve hoje'), { target: { value: '30.000' } })
    fireEvent.change(screen.getByLabelText('Parcela ou pagamento mínimo por mês'), { target: { value: '900' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar dívida' }))

    const carro = lerSalvo().recuperacao!.dividas.find((d) => d.nome === 'Carro')!
    expect(carro.jurosMensal).toBe(0.9489)
    // Financiamento a 12% ao ano não é dívida cara: o Modo Recuperação continua desligado.
    expect(screen.queryByText('Modo Recuperação ligado')).toBeNull()
  })

  it('taxa ao mês mostra o equivalente ao ano', async () => {
    salvar(exemplo)
    render(<MeuMes ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar uma dívida' }))
    fireEvent.change(screen.getByLabelText('Juros ao mês (%)'), { target: { value: '3' } })
    expect(screen.getByText('3% ao mês equivalem a 42,58% ao ano.')).toBeTruthy()
  })
})

