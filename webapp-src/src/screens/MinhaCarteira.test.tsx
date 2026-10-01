import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MinhaCarteira } from './MinhaCarteira'
import { CHAVE_CARTEIRA, carteiraVazia, serializarCarteira } from '../domain/carteiraSalva'
import type { CarteiraSalva } from '../domain/carteiraSalva'
import type { ItemPosicaoB3 } from '../domain/importacao/planilha'
import { mesclarLancamentos } from '../domain/lancamentos'
import type { LancamentoNovo } from '../domain/lancamentos'
import type { AppCtx } from '../state/useAppState'

const ctx = {} as AppCtx
const hoje = new Date(2026, 9, 1) // 1º de outubro de 2026
const txt = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ')

const L = (o: Partial<LancamentoNovo> = {}): LancamentoNovo => ({
  data: '2026-03-02', tipo: 'compra', ativo: 'VALE3', quantidade: 100, preco: 10, valor: 1000, taxas: 0, origem: 'b3-negociacao', ...o,
})
const pos = (ativo: string, quantidade: number, valorAtualizado: number, categoria: ItemPosicaoB3['categoria'] = 'acoes'): ItemPosicaoB3 => ({
  ativo, categoria, quantidade, precoFechamento: valorAtualizado / quantidade, valorAtualizado, valorAplicado: null,
})

function semear(parcial: Partial<CarteiraSalva> & { lancs?: LancamentoNovo[] }) {
  const base = carteiraVazia()
  const { lancs, ...resto } = parcial
  const c: CarteiraSalva = { ...base, ...resto, lancamentos: lancs ? mesclarLancamentos([], lancs).lancamentos : base.lancamentos }
  localStorage.setItem(CHAVE_CARTEIRA, serializarCarteira(c))
}
const lerSalvo = (): CarteiraSalva => JSON.parse(localStorage.getItem(CHAVE_CARTEIRA)!).carteira

async function enviarArquivo(nome: string, conteudo: string) {
  const entrada = document.querySelector('input[type=file][multiple]') as HTMLInputElement
  const arquivo = new File([conteudo], nome, { type: 'text/csv' })
  await act(async () => {
    fireEvent.change(entrada, { target: { files: [arquivo] } })
  })
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('MinhaCarteira: primeira vez', () => {
  it('convida a importar, explica a privacidade e não mostra gráficos vazios', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText('Comece pelo extrato de Posição')).toBeTruthy()
    expect(screen.getByText(/nada é enviado para a internet/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Adicionar lançamento' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: /capital aplicado/i })).toBeNull()
  })
})

describe('MinhaCarteira: importar um arquivo', () => {
  const csv = 'Data;Tipo;Ativo;Quantidade;Preço\n05/03/2026;Compra;MXRF11;100;10,05\n12/03/2026;Compra;MXRF11;100;10,15\n20/04/2026;Dividendo;MXRF11;200;0,10\n'

  it('lê o CSV, resume o que entrou, calcula o preço médio e grava no aparelho', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Comece pelo extrato de Posição')
    await enviarArquivo('minha-carteira.csv', csv)

    const resultado = await screen.findByRole('list', { name: 'Resultado da importação' })
    expect(txt(resultado)).toContain('3 lançamento(s) novo(s)')
    // preço médio ponderado: (100×10,05 + 100×10,15) / 200 = 10,10
    const posicoes = screen.getByRole('heading', { name: 'Posições' }).closest('section')!
    expect(txt(posicoes)).toContain('MXRF11')
    expect(txt(posicoes)).toContain('R$ 10,10')
    expect(lerSalvo().lancamentos).toHaveLength(3)
  })

  it('reimportar o mesmo arquivo não duplica nada', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Comece pelo extrato de Posição')
    await enviarArquivo('a.csv', csv)
    await screen.findByRole('list', { name: 'Resultado da importação' })
    await enviarArquivo('a.csv', csv)
    expect(txt(await screen.findByRole('list', { name: 'Resultado da importação' }))).toContain('3 já existia(m)')
    expect(lerSalvo().lancamentos).toHaveLength(3)
  })

  it('arquivo irreconhecível: explica o problema e não altera a carteira', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Comece pelo extrato de Posição')
    await enviarArquivo('qualquer.csv', 'Nome;Idade\nAna;30\n')
    expect(txt(await screen.findByRole('list', { name: 'Resultado da importação' }))).toContain('colunas mínimas')
    expect(screen.getByText('Comece pelo extrato de Posição')).toBeTruthy()
  })

  it('nota de corretagem em PDF: avisa que ainda não é lida aqui', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Comece pelo extrato de Posição')
    const entrada = document.querySelector('input[type=file][multiple]') as HTMLInputElement
    await act(async () => {
      fireEvent.change(entrada, { target: { files: [new File(['%PDF'], 'nota.pdf', { type: 'application/pdf' })] } })
    })
    expect(txt(await screen.findByRole('list', { name: 'Resultado da importação' }))).toContain('PDF ainda não são lidas')
  })
})

describe('MinhaCarteira: painel com dados', () => {
  it('com Posição: patrimônio, resultado (só onde há preço médio) e composição', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500), pos('HGBS11', 10, 500, 'fundos')], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const carteira = (await screen.findByRole('heading', { name: 'Carteira' })).closest('section')!
    expect(txt(carteira)).toContain('Patrimônio em 30/09/2026')
    expect(txt(carteira)).toContain('R$ 2.000,00')
    expect(txt(carteira)).toContain('+50,00%') // só VALE3 tem custo: (1500-1000)/1000
    expect(txt(carteira)).toMatch(/sobre 75% da carteira/)
    const comp = screen.getByRole('heading', { name: 'Composição' }).closest('section')!
    expect(txt(comp)).toContain('Ações')
    expect(txt(comp)).toContain('FIIs e fundos')
  })

  it('sem Posição: mostra capital aplicado a preço de custo, sem inventar patrimônio', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const carteira = (await screen.findByRole('heading', { name: 'Carteira' })).closest('section')!
    expect(txt(carteira)).toContain('Capital aplicado (a preço de custo)')
    expect(txt(carteira)).toContain('R$ 1.000,00')
    expect(txt(carteira)).not.toContain('Patrimônio em')
  })

  it('os gráficos têm texto alternativo para leitores de tela', async () => {
    semear({ lancs: [L(), L({ tipo: 'provento', data: '2026-09-10', valor: 25, quantidade: 100, preco: 0.25, subtipo: 'rendimento' })] })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByRole('heading', { name: 'Carteira' })
    expect(screen.getByRole('img', { name: /Capital aplicado a preço de custo: de R\$/ })).toBeTruthy()
    expect(screen.getByRole('img', { name: /Proventos recebidos por mês nos últimos 12 meses, total de R\$\s25,00/ })).toBeTruthy()
  })

  it('proventos a receber: mostra o próximo pagamento', async () => {
    semear({
      lancs: [L()],
      eventosFuturos: [
        { ativo: 'BBDC3', tipoEvento: 'jcp', previsao: '2026-10-01', quantidade: 200, precoUnitario: 0.02, valorLiquido: 2.84 },
        { ativo: 'ITSA4', tipoEvento: 'jcp', previsao: '2026-10-01', quantidade: 100, precoUnitario: 0.02, valorLiquido: 2 },
      ],
    })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const prov = (await screen.findByRole('heading', { name: 'Proventos' })).closest('section')!
    expect(txt(prov)).toContain('Próximo pagamento')
    expect(txt(prov)).toContain('R$ 4,84')
    expect(txt(prov)).toContain('2 ativo(s)')
  })
})

describe('MinhaCarteira: conferência com a Posição', () => {
  it('aponta o que falta, deixa lançar o saldo inicial e o ativo passa a conferir', async () => {
    // a pessoa tem 150 de VALE3, mas o histórico importado só mostra a compra de 20
    semear({ lancs: [L({ quantidade: 20, valor: 200 })], posicao: [pos('VALE3', 150, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const conf = (await screen.findByRole('heading', { name: 'Conferência com a Posição' })).closest('section')!
    expect(txt(conf)).toContain('0 de 1 ativos conferem')
    expect(txt(conf)).toContain('Falta histórico anterior')

    fireEvent.change(within(conf).getByLabelText(/Preço médio dos 130 anteriores/), { target: { value: '8,50' } })
    fireEvent.click(within(conf).getByRole('button', { name: 'Lançar saldo inicial' }))

    expect(txt(await screen.findByText(/ativos conferem com a Posição/))).toContain('1 de 1')
    expect(within(conf).queryByRole('button', { name: 'Lançar saldo inicial' })).toBeNull()
    const salvo = lerSalvo().lancamentos.find((l) => l.tipo === 'saldoInicial')!
    expect(salvo).toMatchObject({ ativo: 'VALE3', quantidade: 130, preco: 8.5, origem: 'manual' })
  })
  it('preço médio inválido: explica, não lança', async () => {
    semear({ lancs: [L({ quantidade: 20, valor: 200 })], posicao: [pos('VALE3', 150, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const conf = (await screen.findByRole('heading', { name: 'Conferência com a Posição' })).closest('section')!
    fireEvent.click(within(conf).getByRole('button', { name: 'Lançar saldo inicial' }))
    expect((await within(conf).findByRole('alert')).textContent).toContain('Informe o preço médio')
    expect(lerSalvo().lancamentos).toHaveLength(1)
  })
  it('sem Posição importada: explica como conferir', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const conf = (await screen.findByRole('heading', { name: 'Conferência com a Posição' })).closest('section')!
    expect(txt(conf)).toContain('Importe o extrato de Posição')
  })
})

describe('MinhaCarteira: lançamentos manuais', () => {
  async function abrirFormulario() {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar lançamento' }))
    return screen.getByRole('form', { name: 'Novo lançamento' })
  }
  const preencher = (form: HTMLElement, campos: Record<string, string>) => {
    for (const [rotulo, valor] of Object.entries(campos)) fireEvent.change(within(form).getByLabelText(rotulo), { target: { value: valor } })
  }

  it('adiciona uma compra e ela entra na lista e nas posições, com data de hoje por padrão', async () => {
    const form = await abrirFormulario()
    expect((within(form).getByLabelText('Data') as HTMLInputElement).value).toBe('2026-10-01')
    preencher(form, { Ativo: 'mxrf11', Quantidade: '100', 'Preço por unidade (R$)': '10,05', 'Taxas (R$, opcional)': '0,50' })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    const lista = await screen.findByRole('heading', { name: 'Lançamentos' })
    expect(txt(lista.closest('section')!)).toContain('MXRF11')
    expect(lerSalvo().lancamentos[0]).toMatchObject({ ativo: 'MXRF11', quantidade: 100, preco: 10.05, valor: 1005, taxas: 0.5, origem: 'manual' })
    // as taxas entram no custo: (1005 + 0,5) / 100 = 10,055
    expect(txt(screen.getByRole('heading', { name: 'Posições' }).closest('section')!)).toContain('R$ 10,06')
  })
  it('campo obrigatório vazio: mostra o motivo e não grava', async () => {
    const form = await abrirFormulario()
    preencher(form, { Ativo: 'VALE3' })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    expect((await within(form).findByRole('alert')).textContent).toContain('Informe a quantidade')
    expect(lerSalvo().lancamentos).toHaveLength(0) // nada foi gravado
  })
  it('duas compras idênticas digitadas valem as duas', async () => {
    for (let i = 0; i < 2; i++) {
      const form = i === 0 ? await abrirFormulario() : (fireEvent.click(screen.getByRole('button', { name: 'Adicionar lançamento' })), screen.getByRole('form', { name: 'Novo lançamento' }))
      preencher(form, { Ativo: 'VALE3', Quantidade: '10', 'Preço por unidade (R$)': '50' })
      fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
      await screen.findByRole('button', { name: 'Adicionar lançamento' })
    }
    expect(lerSalvo().lancamentos).toHaveLength(2)
  })
  it('provento pede o valor recebido e o tipo', async () => {
    const form = await abrirFormulario()
    fireEvent.change(within(form).getByLabelText('Tipo'), { target: { value: 'provento' } })
    preencher(form, { Ativo: 'MXRF11', 'Valor recebido (R$)': '25,40' })
    fireEvent.change(within(form).getByLabelText('Tipo de provento'), { target: { value: 'rendimento' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await screen.findByRole('button', { name: 'Adicionar lançamento' })
    expect(lerSalvo().lancamentos[0]).toMatchObject({ tipo: 'provento', valor: 25.4, subtipo: 'rendimento' })
  })
  it('cancelar fecha o formulário sem gravar', async () => {
    const form = await abrirFormulario()
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('form', { name: 'Novo lançamento' })).toBeNull()
  })
})

describe('MinhaCarteira: corrigir e excluir', () => {
  it('corrigir um lançamento importado: o erro some e a reimportação não o traz de volta', async () => {
    const csv = 'Data;Tipo;Ativo;Quantidade;Preço\n05/03/2026;Compra;VALE3;100;99,00\n'
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Comece pelo extrato de Posição')
    await enviarArquivo('a.csv', csv)
    await screen.findByRole('list', { name: 'Resultado da importação' })

    fireEvent.click(screen.getByRole('button', { name: /Corrigir lançamento de VALE3/ }))
    const form = screen.getByRole('form', { name: 'Corrigir lançamento' })
    fireEvent.change(within(form).getByLabelText('Preço por unidade (R$)'), { target: { value: '10,00' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }))
    await screen.findByRole('button', { name: 'Adicionar lançamento' })
    expect(lerSalvo().lancamentos).toHaveLength(1)
    expect(lerSalvo().lancamentos[0]).toMatchObject({ preco: 10, valor: 1000, origem: 'manual' })

    await enviarArquivo('a.csv', csv) // o extrato ainda traz o valor errado
    expect(lerSalvo().lancamentos).toHaveLength(1)
    expect(lerSalvo().lancamentos[0].preco).toBe(10)
  })
  it('excluir pede confirmação e não volta ao reimportar', async () => {
    const csv = 'Data;Tipo;Ativo;Quantidade;Preço\n05/03/2026;Compra;VALE3;100;10,00\n'
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Comece pelo extrato de Posição')
    await enviarArquivo('a.csv', csv)
    await screen.findByRole('list', { name: 'Resultado da importação' })
    fireEvent.click(screen.getByRole('button', { name: /Excluir lançamento de VALE3/ }))
    expect(screen.getByText(/Reimportar o extrato não o traz de volta/)).toBeTruthy()
    expect(lerSalvo().lancamentos).toHaveLength(1) // ainda não excluiu
    fireEvent.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    expect(lerSalvo().lancamentos).toHaveLength(0)
    await enviarArquivo('a.csv', csv)
    expect(lerSalvo().lancamentos).toHaveLength(0)
  })
})

describe('MinhaCarteira: seus dados', () => {
  it('restaura um backup válido e recusa um inválido sem alterar nada', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByRole('heading', { name: 'Seus dados' })
    const entrada = document.querySelector('input[accept*=json]') as HTMLInputElement

    await act(async () => {
      fireEvent.change(entrada, { target: { files: [new File(['isto não é um backup'], 'x.json')] } })
    })
    expect((await screen.findByRole('alert')).textContent).toContain('não é um backup válido')
    expect(lerSalvo().lancamentos).toHaveLength(1)

    const outro = serializarCarteira({ ...carteiraVazia(), lancamentos: mesclarLancamentos([], [L({ ativo: 'BBAS3' }), L({ ativo: 'PETR4' })]).lancamentos })
    await act(async () => {
      fireEvent.change(entrada, { target: { files: [new File([outro], 'backup.json')] } })
    })
    expect((await screen.findByRole('status')).textContent).toContain('Backup restaurado')
    expect(lerSalvo().lancamentos.map((l) => l.ativo).sort()).toEqual(['BBAS3', 'PETR4'])
  })
  it('apagar tudo exige confirmação', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Apagar todos os dados' }))
    expect(lerSalvo().lancamentos).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sim, apagar tudo' }))
    expect(lerSalvo().lancamentos).toHaveLength(0)
    expect(await screen.findByText('Comece pelo extrato de Posição')).toBeTruthy()
  })
  it('dado corrompido no aparelho não trava a tela: começa vazio', async () => {
    localStorage.setItem(CHAVE_CARTEIRA, '{isto está quebrado')
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText('Comece pelo extrato de Posição')).toBeTruthy()
  })
})
