import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MeuMes } from './MeuMes'
import { MeuMesSupermercado } from './MeuMesSupermercado'
import { CHAVE_SUPERMERCADO } from '../state/useSupermercado'
import { CHAVE_ORCAMENTO } from '../state/useOrcamento'
import type { AppCtx } from '../state/useAppState'

const ctx = {} as AppCtx

function lerSalva() {
  return JSON.parse(localStorage.getItem(CHAVE_SUPERMERCADO)!).lista.itens as {
    nome: string; quantidade: string; categoria: string; comprado: boolean
  }[]
}

async function escrever(texto: string) {
  const campo = await screen.findByLabelText('O que você precisa comprar?')
  fireEvent.change(campo, { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar à lista' }))
}

beforeEach(() => localStorage.clear())

describe('MeuMesSupermercado', () => {
  it('começa vazio, com o convite para escrever a lista', async () => {
    render(<MeuMesSupermercado />)
    expect(await screen.findByText(/Sua lista está vazia/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Adicionar à lista' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('o que a pessoa escreve vira itens com bolinha, agrupados por categoria', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, feijão, 2 litros de leite, sabão em pó e frango')

    expect(screen.getByRole('status').textContent).toBe('5 itens adicionados.')
    const caixas = screen.getAllByRole('checkbox')
    expect(caixas).toHaveLength(5)
    expect(caixas.every((c) => !(c as HTMLInputElement).checked)).toBe(true)

    for (const categoria of ['Açougue e peixaria', 'Frios e laticínios', 'Mercearia', 'Limpeza']) {
      expect(screen.getByRole('region', { name: categoria })).toBeTruthy()
    }
    const mercearia = screen.getByRole('region', { name: 'Mercearia' })
    expect(within(mercearia).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(screen.getByRole('region', { name: 'Frios e laticínios' })).getByText(/2 litros/)).toBeTruthy()
    expect(screen.getByText('0 de 5 no carrinho')).toBeTruthy()
  })

  it('ticar marca o item, atualiza o contador e grava no aparelho', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, feijão, café')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arroz' }))

    expect((screen.getByRole('checkbox', { name: 'Arroz' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('1 de 3 no carrinho')).toBeTruthy()
    expect(lerSalva().find((i) => i.nome === 'Arroz')?.comprado).toBe(true)
    expect(lerSalva().find((i) => i.nome === 'Feijão')?.comprado).toBe(false)
  })

  it('o item comprado vai para o fim da categoria', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, feijão, café')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arroz' }))
    const nomes = within(screen.getByRole('region', { name: 'Mercearia' }))
      .getAllByRole('checkbox')
      .map((c) => c.getAttribute('aria-label'))
    expect(nomes).toEqual(['Feijão', 'Café', 'Arroz'])
  })

  it('a lista volta do aparelho ao reabrir a aba', async () => {
    const primeira = render(<MeuMesSupermercado />)
    await escrever('arroz, leite')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Leite' }))
    primeira.unmount()

    render(<MeuMesSupermercado />)
    expect(await screen.findByRole('checkbox', { name: 'Arroz' })).toBeTruthy()
    expect((screen.getByRole('checkbox', { name: 'Leite' }) as HTMLInputElement).checked).toBe(true)
  })

  it('item repetido não duplica e a pessoa é avisada', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, leite')
    await escrever('leite, pão')
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.getByRole('status').textContent).toContain('Já estava na lista: Leite')
  })

  it('dá para trocar a categoria de um item', async () => {
    render(<MeuMesSupermercado />)
    await escrever('pilha')
    expect(within(screen.getByRole('region', { name: 'Outros' })).getByRole('checkbox', { name: 'Pilha' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Categoria de Pilha'), { target: { value: 'limpeza' } })
    expect(within(screen.getByRole('region', { name: 'Limpeza' })).getByRole('checkbox', { name: 'Pilha' })).toBeTruthy()
    expect(lerSalva()[0].categoria).toBe('limpeza')
  })

  it('editar: corrige o nome, a quantidade e a categoria de um item e grava no aparelho', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arros, leite')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Arros' }))
    fireEvent.change(screen.getByLabelText('Nome do item'), { target: { value: 'arroz integral' } })
    fireEvent.change(screen.getByLabelText('Quantidade (opcional)'), { target: { value: '2 kg' } })
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'mercearia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(screen.getByRole('checkbox', { name: 'Arroz integral, 2 kg' })).toBeTruthy()
    expect(screen.queryByLabelText('Nome do item')).toBeNull()
    const salvo = lerSalva().find((i) => i.nome === 'Arroz integral')
    expect(salvo).toMatchObject({ quantidade: '2 kg', categoria: 'mercearia', comprado: false })
  })

  it('o áudio juntou tudo sem vírgulas: o separador já divide pelos produtos conhecidos', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz feijão leite pão')
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(within(screen.getByRole('region', { name: 'Mercearia' })).getAllByRole('checkbox')).toHaveLength(2)
    expect(within(screen.getByRole('region', { name: 'Padaria' })).getByRole('checkbox', { name: 'Pão' })).toBeTruthy()
  })

  it('editar: item de nome desconhecido veio grudado; escrever com vírgulas separa em vários', async () => {
    render(<MeuMesSupermercado />)
    await escrever('xarope bala')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /^Editar / }))
    fireEvent.change(screen.getByLabelText('Nome do item'), { target: { value: 'xarope, bala, pão' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(within(screen.getByRole('region', { name: 'Padaria' })).getByRole('checkbox', { name: 'Pão' })).toBeTruthy()
  })

  it('editar: Cancelar e Escape não mudam nada; Enter salva; nome vazio não salva', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz')
    fireEvent.click(screen.getByRole('button', { name: 'Editar Arroz' }))
    fireEvent.change(screen.getByLabelText('Nome do item'), { target: { value: 'outra coisa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('checkbox', { name: 'Arroz' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Editar Arroz' }))
    fireEvent.change(screen.getByLabelText('Nome do item'), { target: { value: 'outra coisa' } })
    fireEvent.keyDown(screen.getByLabelText('Nome do item'), { key: 'Escape' })
    expect(screen.getByRole('checkbox', { name: 'Arroz' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Editar Arroz' }))
    fireEvent.change(screen.getByLabelText('Nome do item'), { target: { value: '   ' } })
    expect((screen.getByRole('button', { name: 'Salvar' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(screen.getByLabelText('Nome do item'), { key: 'Enter' })
    expect(screen.getByLabelText('Nome do item')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Nome do item'), { target: { value: 'arroz parboilizado' } })
    fireEvent.keyDown(screen.getByLabelText('Nome do item'), { key: 'Enter' })
    expect(screen.getByRole('checkbox', { name: 'Arroz parboilizado' })).toBeTruthy()
  })

  it('o botão de apagar a lista inteira é amarelo (botão principal), como o de adicionar', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz')
    const apagar = screen.getByRole('button', { name: 'Apagar a lista inteira' })
    expect(apagar.className).toContain('btn-primary')
    fireEvent.click(apagar)
    expect(screen.getByRole('button', { name: 'Confirmar: apagar a lista inteira' }).className).toContain('btn-primary')
  })

  it('WhatsApp: o link leva só o que falta comprar e muda quando a pessoa tica um item', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, leite, tomate')
    const texto = () => {
      const link = screen.getByRole('link', { name: 'Enviar o que falta pelo WhatsApp' }) as HTMLAnchorElement
      expect(link.href.startsWith('https://wa.me/?text=')).toBe(true)
      expect(link.target).toBe('_blank')
      expect(link.rel).toContain('noopener')
      return decodeURIComponent(link.href.slice('https://wa.me/?text='.length))
    }
    expect(texto()).toContain('• Arroz')
    expect(texto()).toContain('• Leite')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arroz' }))
    expect(texto()).not.toContain('Arroz')
    expect(texto()).toContain('• Tomate')
  })

  it('WhatsApp: o botão é verde (classe própria) e traz a logo, escondida dos leitores de tela', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz')
    const link = screen.getByRole('link', { name: 'Enviar o que falta pelo WhatsApp' })
    expect(link.className).toContain('sm-whatsapp')
    const logo = link.querySelector('svg')
    expect(logo).toBeTruthy()
    expect(logo!.getAttribute('aria-hidden')).toBe('true')
    expect(logo!.querySelector('path')?.getAttribute('d')?.length ?? 0).toBeGreaterThan(200)
  })

  it('WhatsApp: com tudo ticado ou sem lista, o botão não aparece', async () => {
    render(<MeuMesSupermercado />)
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
    await escrever('arroz')
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arroz' }))
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).toBeNull()
  })

  it('remove um item', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, leite')
    fireEvent.click(screen.getByRole('button', { name: 'Remover Arroz' }))
    expect(screen.queryByRole('checkbox', { name: 'Arroz' })).toBeNull()
    expect(lerSalva().map((i) => i.nome)).toEqual(['Leite'])
  })

  it('tirar os comprados pede confirmação e só tira os comprados', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, leite, café')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arroz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tirar da lista o que já comprei' }))
    expect(screen.getByRole('checkbox', { name: 'Arroz' })).toBeTruthy() // ainda não tirou
    fireEvent.click(screen.getByRole('button', { name: /Confirmar: tirar 1 item comprado/ }))
    expect(screen.queryByRole('checkbox', { name: 'Arroz' })).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
  })

  it('cancelar a confirmação não apaga nada', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz')
    fireEvent.click(screen.getByRole('button', { name: 'Apagar a lista inteira' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('checkbox', { name: 'Arroz' })).toBeTruthy()
  })

  it('apagar a lista inteira pede confirmação', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, leite')
    fireEvent.click(screen.getByRole('button', { name: 'Apagar a lista inteira' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: apagar a lista inteira' }))
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByText(/Sua lista está vazia/)).toBeTruthy()
  })

  it('desmarcar tudo reaproveita a lista', async () => {
    render(<MeuMesSupermercado />)
    await escrever('arroz, leite')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Arroz' }))
    fireEvent.click(screen.getByRole('button', { name: /Desmarcar tudo/ }))
    expect(screen.getAllByRole('checkbox').every((c) => !(c as HTMLInputElement).checked)).toBe(true)
  })

  it('dado corrompido no aparelho não trava: começa vazio', async () => {
    localStorage.setItem(CHAVE_SUPERMERCADO, '{isso não é json')
    render(<MeuMesSupermercado />)
    expect(await screen.findByText(/Sua lista está vazia/)).toBeTruthy()
  })
})

describe('Meu Mês com as duas abas', () => {
  it('abre em "Contas do mês" e troca para "Supermercado" sem mexer nas contas', async () => {
    const orcamento = { salario: 4000, reserva: 0, potes: { guardar: 500, crescer: 300 }, contas: [{ id: 'a', nome: 'Aluguel', valor: 1500, tipo: 'mensal' }], pagamentos: {}, cartao: { teto: 0, compras: [] } }
    localStorage.setItem(CHAVE_ORCAMENTO, JSON.stringify({ versao: 1, orcamento }))
    render(<MeuMes ctx={ctx} hoje={new Date(2026, 9, 5)} />)

    const contas = await screen.findByRole('tab', { name: /Contas do mês/ })
    const mercado = screen.getByRole('tab', { name: /Supermercado/ })
    expect(contas.getAttribute('aria-selected')).toBe('true')
    expect((await screen.findAllByText('Aluguel', { exact: false })).length).toBeGreaterThan(0)

    fireEvent.click(mercado)
    expect(mercado.getAttribute('aria-selected')).toBe('true')
    expect(await screen.findByLabelText('O que você precisa comprar?')).toBeTruthy()
    expect(screen.queryByText('Aluguel', { exact: false })).toBeNull()

    fireEvent.click(contas)
    expect((await screen.findAllByText('Aluguel', { exact: false })).length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem(CHAVE_ORCAMENTO)!).orcamento.contas).toHaveLength(1)
  })

  it('a aba Supermercado funciona mesmo na primeira vez do Meu Mês (sem salário cadastrado)', async () => {
    render(<MeuMes ctx={ctx} hoje={new Date(2026, 9, 5)} />)
    fireEvent.click(await screen.findByRole('tab', { name: /Supermercado/ }))
    await escrever('arroz')
    expect(screen.getByRole('checkbox', { name: 'Arroz' })).toBeTruthy()
    // o Meu Mês grava o orçamento vazio ao abrir (comportamento de sempre); a lista não entra nele
    expect(JSON.parse(localStorage.getItem(CHAVE_ORCAMENTO)!).orcamento).toMatchObject({ salario: 0, contas: [] })
  })

  it('a lista é independente do orçamento: nada da lista entra na chave do orçamento', async () => {
    render(<MeuMes ctx={ctx} hoje={new Date(2026, 9, 5)} />)
    fireEvent.click(await screen.findByRole('tab', { name: /Supermercado/ }))
    await escrever('arroz')
    expect(localStorage.getItem(CHAVE_SUPERMERCADO)).toContain('Arroz')
    expect(localStorage.getItem(CHAVE_ORCAMENTO) ?? '').not.toContain('Arroz')
  })
})
