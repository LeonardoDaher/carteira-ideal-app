import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MinhaCarteira } from './MinhaCarteira'
import { ATIVOS } from '../data/assets'
import { carteiraParaExibicao } from '../data/carteiraVisual'
import { PERGUNTAS } from '../data/questions'
import { PERGUNTAS_ARQUITETURA } from '../data/perguntasArquitetura'
import { compararComReferencia } from '../domain/carteiraAtual'
import { gerarRecomendacao } from '../domain/engine'
import { pct } from '../ui/painel/formatar'
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
    expect(await screen.findByText('Seus gráficos vão aparecer aqui')).toBeTruthy()
    expect(screen.getByText(/Seus dados ficam só neste aparelho/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Adicionar lançamento' })).toBeTruthy()
    expect(screen.queryByRole('img', { name: /capital aplicado/i })).toBeNull()
  })
})

describe('MinhaCarteira: simples e didática', () => {
  it('mostra 3 passos, com link para a B3 abrindo em outra aba, e o botão de enviar no passo 2', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
    const passos = within(screen.getByRole('list', { name: '' } as never) ?? document.body)
    void passos
    const itens = Array.from(document.querySelectorAll('.mc-passo'))
    expect(itens).toHaveLength(3)
    expect(itens.map((li) => li.querySelector('.mc-passo-titulo')!.textContent)).toEqual(['Baixe na B3', 'Envie aqui', 'Pronto!'])
    const link = screen.getByRole('link', { name: /Abrir a Área do Investidor da B3/ }) as HTMLAnchorElement
    expect(link.href).toBe('https://www.investidor.b3.com.br/')
    expect(link.target).toBe('_blank')
    expect(link.rel).toContain('noopener')
    expect(within(itens[1] as HTMLElement).getByText('Escolher arquivos')).toBeTruthy()
  })
  it('antes de importar, mostra os gráficos como EXEMPLO: etiqueta, valor em "R$ —", nenhum número inventado', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
    const cartoes = Array.from(document.querySelectorAll('.mc-cartao-vazio'))
    expect(cartoes).toHaveLength(3)
    for (const c of cartoes) {
      expect(txt(c as HTMLElement)).toContain('Exemplo')
      expect(txt(c as HTMLElement)).toContain('R$ —')
      expect(txt(c as HTMLElement)).not.toMatch(/R\$\s?\d/) // nenhum valor em reais
      expect((c as HTMLElement).querySelector('[aria-hidden="true"] svg, [aria-hidden="true"] .mc-composicao')).toBeTruthy()
    }
    // e os gráficos de exemplo não se passam por dado real para leitores de tela
    expect(screen.queryByRole('img')).toBeNull()
  })
  it('depois de importar, os cartões de exemplo somem e entram os reais', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
    await enviarArquivo('a.csv', 'Data;Tipo;Ativo;Quantidade;Preço\n05/03/2026;Compra;MXRF11;100;10,00\n')
    await screen.findByRole('list', { name: 'Resultado da importação' })
    expect(document.querySelectorAll('.mc-cartao-vazio')).toHaveLength(0)
    expect(screen.queryByText('Seus gráficos vão aparecer aqui')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Carteira' })).toBeTruthy()
  })
})

describe('MinhaCarteira: importar um arquivo', () => {
  const csv = 'Data;Tipo;Ativo;Quantidade;Preço\n05/03/2026;Compra;MXRF11;100;10,05\n12/03/2026;Compra;MXRF11;100;10,15\n20/04/2026;Dividendo;MXRF11;200;0,10\n'

  it('lê o CSV, resume o que entrou, calcula o preço médio e grava no aparelho', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
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
    await screen.findByText('Seus gráficos vão aparecer aqui')
    await enviarArquivo('a.csv', csv)
    await screen.findByRole('list', { name: 'Resultado da importação' })
    await enviarArquivo('a.csv', csv)
    expect(txt(await screen.findByRole('list', { name: 'Resultado da importação' }))).toContain('3 já existia(m)')
    expect(lerSalvo().lancamentos).toHaveLength(3)
  })

  it('arquivo irreconhecível: explica o problema e não altera a carteira', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
    await enviarArquivo('qualquer.csv', 'Nome;Idade\nAna;30\n')
    expect(txt(await screen.findByRole('list', { name: 'Resultado da importação' }))).toContain('colunas mínimas')
    expect(screen.getByText('Seus gráficos vão aparecer aqui')).toBeTruthy()
  })

  it('nota de corretagem em PDF: avisa que ainda não é lida aqui', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
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
    expect(txt(carteira)).toContain('Total investido')
    expect(txt(carteira)).toContain('R$ 1.000,00')
    expect(txt(carteira)).not.toContain('Patrimônio em')
  })

  it('os gráficos têm texto alternativo para leitores de tela', async () => {
    semear({ lancs: [L(), L({ tipo: 'provento', data: '2026-09-10', valor: 25, quantidade: 100, preco: 0.25, subtipo: 'rendimento' })] })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByRole('heading', { name: 'Carteira' })
    expect(screen.getByRole('img', { name: /Total investido, pelo preço pago: de R\$/ })).toBeTruthy()
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
    await screen.findByText('Seus gráficos vão aparecer aqui')
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
    await screen.findByText('Seus gráficos vão aparecer aqui')
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
    expect(await screen.findByText('Seus gráficos vão aparecer aqui')).toBeTruthy()
  })
  it('dado corrompido no aparelho não trava a tela: começa vazio', async () => {
    localStorage.setItem(CHAVE_CARTEIRA, '{isto está quebrado')
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    expect(await screen.findByText('Seus gráficos vão aparecer aqui')).toBeTruthy()
  })
})

describe('MinhaCarteira: comparação com a carteira sugerida', () => {
  // Uma carteira sugerida de verdade, gerada pelo motor do app a partir das respostas "b".
  const resposta = (lista: { id: string }[]) => Object.fromEntries(lista.map((p) => [p.id, 'b']))
  const resultado = gerarRecomendacao(resposta(PERGUNTAS) as never, { idade: 35 }, resposta(PERGUNTAS_ARQUITETURA) as never)
  const referencia = carteiraParaExibicao(resultado.carteira)
  const fn = () => vi.fn()
  const ctxCom = (extra: Record<string, unknown> = {}) =>
    ({ resultado, resultadoPendente: false, erroResultado: null, iniciarQuestionario: fn(), tentarCalcularNovamente: fn(), ...extra }) as unknown as AppCtx
  const cartao = async () => (await screen.findByRole('heading', { name: 'Comparar com a carteira sugerida' })).closest('section')!
  const lista = (c: HTMLElement) => within(c).getByRole('list', { name: 'Comparação por classe' })
  const somaReais = (itens: HTMLElement[]) => itens.reduce((t, li) => t + Number(within(li).getByText(/R\$/).textContent!.replace(/[^\d,]/g, '').replace(',', '.')), 0)

  const base = () =>
    semear({ lancs: [L({ ativo: 'VALE3', quantidade: 100, valor: 1000 })], posicao: [pos('VALE3', 100, 600), pos('MXRF11', 40, 400, 'fundos')], dataPosicao: '2026-09-30' })

  it('sem questionário: convida (é opcional) e o botão abre o questionário', async () => {
    base()
    const ctx = ctxCom({ resultado: null })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const c = await cartao()
    expect(txt(c)).toContain('É opcional')
    fireEvent.click(within(c).getByRole('button', { name: 'Responder o questionário' }))
    expect(ctx.iniciarQuestionario).toHaveBeenCalledTimes(1)
  })
  it('a carteira sugerida está sendo calculada: avisa, sem convidar a responder de novo', async () => {
    base()
    render(<MinhaCarteira ctx={ctxCom({ resultado: null, resultadoPendente: true })} hoje={hoje} />)
    const c = await cartao()
    expect(within(c).getByRole('status').textContent).toContain('Montando a sua carteira sugerida')
    expect(within(c).queryByRole('button', { name: 'Responder o questionário' })).toBeNull()
  })
  it('falha ao calcular: mostra o erro e deixa tentar de novo', async () => {
    base()
    const ctx = ctxCom({ resultado: null, erroResultado: 'sem internet' })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const c = await cartao()
    expect(within(c).getByRole('alert').textContent).toContain('sem internet')
    fireEvent.click(within(c).getByRole('button', { name: 'Tentar novamente' }))
    expect(ctx.tentarCalcularNovamente).toHaveBeenCalledTimes(1)
  })

  it('com a carteira sugerida: mostra o perfil, a aderência e, por classe, o que você tem x o sugerido', async () => {
    base()
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    const esperado = compararComReferencia({ acoesETFs: 600, fiis: 400 }, referencia)
    expect(txt(c)).toContain(`${Math.round(esperado.aderencia!)}%`)
    expect(txt(c)).toContain('Valores de 30/09/2026 (Posição da B3)')
    const perfil = String(resultado.perfilFinalCarteira ?? resultado.perfilPatrimonial ?? resultado.perfilFinal)
    expect(txt(c)).toContain(perfil.replace(/^\d+\.\s*/, '')) // sem o "5." na frente, como na tela Resultado
    expect(txt(c)).not.toMatch(/perfil\s+\d+\./)

    const acoes = esperado.linhas.find((l) => l.classe === 'acoesETFs')!
    const linhaAcoes = within(lista(c)).getByText(ATIVOS.acoesETFs.label).closest('li')!
    expect(txt(linhaAcoes)).toContain(`Você: ${pct(60, false)}`)
    expect(txt(linhaAcoes)).toContain(`Sugerida: ${pct(acoes.pctReferencia, false)}`)
    const chip = acoes.situacao === 'dentro' ? 'Dentro do alvo' : acoes.difPp < 0 ? 'Abaixo' : 'Acima'
    expect(txt(linhaAcoes)).toContain(chip)
  })
  it('classe em 0% não desenha nenhuma fatia na barra (só a marca do alvo)', async () => {
    base()
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    const esperado = compararComReferencia({ acoesETFs: 600, fiis: 400 }, referencia)
    const zerada = esperado.linhas.find((l) => l.valor === 0 && l.pctReferencia > 5)!
    const linha = within(lista(c)).getByText(ATIVOS[zerada.classe as keyof typeof ATIVOS].label).closest('li')!
    const fatia = linha.querySelector('.mc-preench') as HTMLElement
    expect(fatia.style.width).toBe('0%')
    expect(fatia.style.minWidth).toBe('0px')
    // e a classe que a pessoa tem continua com a fatia visível
    const comValor = within(lista(c)).getByText(ATIVOS.acoesETFs.label).closest('li')!.querySelector('.mc-preench') as HTMLElement
    expect(comValor.style.minWidth).toBe('3px')
  })
  it('classes sugeridas que a pessoa não tem aparecem como "abaixo", com o quanto falta em reais', async () => {
    base()
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    const esperado = compararComReferencia({ acoesETFs: 600, fiis: 400 }, referencia)
    const faltando = esperado.linhas.find((l) => l.valor === 0 && l.pctReferencia > 5)!
    const linha = within(lista(c)).getByText(ATIVOS[faltando.classe as keyof typeof ATIVOS].label).closest('li')!
    expect(txt(linha)).toContain('Abaixo')
    expect(txt(linha)).toMatch(/Faltam R\$/)
  })
  it('os três Tesouros viram uma fatia só ("Tesouro Direto"), como na tela Carteira', async () => {
    semear({ posicao: [pos('VALE3', 10, 500), { ...pos('TESOURO SELIC 2031', 1, 300, 'tesouro') }, { ...pos('TESOURO IPCA+ 2029', 1, 200, 'tesouro') }], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    const linha = within(lista(c)).getByText(ATIVOS.tesouroIPCA.label).closest('li')!
    expect(txt(linha)).toContain(`Você: ${pct(50, false)}`)
    expect(within(lista(c)).queryByText('Tesouro Selic')).toBeNull()
  })
  it('sem a Posição, avisa que a conta usa o preço de custo', async () => {
    semear({ lancs: [L({ ativo: 'VALE3', quantidade: 100, valor: 1000 })] })
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    expect(txt(await cartao())).toContain('Valores a preço de custo')
  })

  it('ativo que o app não sabe classificar fica de fora, avisa quanto, e a escolha da pessoa o inclui e fica gravada', async () => {
    semear({ posicao: [pos('VALE3', 10, 400), pos('XXXX11', 10, 100, 'fundos')], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    const caixa = within(c).getByRole('group', { name: 'Ativos sem classe' })
    expect(txt(caixa)).toContain('1 ativo(s), somando R$ 100,00, ficaram de fora')
    // a carteira sugerida tem FIIs, então a linha existe, mas a pessoa ainda aparece com 0% (o ativo ficou de fora)
    expect(txt(within(lista(c)).getByText(ATIVOS.fiis.label).closest('li')!)).toContain(`Você: ${pct(0, false)}`)
    expect(txt(lista(c))).toContain(`Você: ${pct(100, false)}`) // os 400 de VALE3 são 100% do que foi classificado

    fireEvent.change(within(caixa).getByLabelText('Classe de XXXX11'), { target: { value: 'fiis' } })
    await waitFor(() => expect(within(c).queryByRole('group', { name: 'Ativos sem classe' })).toBeNull())
    expect(within(c).queryByRole('group', { name: 'Ativos sem classe' })).toBeNull()
    expect(txt(within(lista(c)).getByText(ATIVOS.fiis.label).closest('li')!)).toContain(`Você: ${pct(20, false)}`)
    expect(lerSalvo().classes).toEqual({ XXXX11: 'fiis' })
  })
  it('a escolha da pessoa continua valendo ao reabrir', async () => {
    semear({ posicao: [pos('VALE3', 10, 400), pos('XXXX11', 10, 100, 'fundos')], dataPosicao: '2026-09-30', classes: { XXXX11: 'fiis' } })
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    expect(within(c).queryByRole('group', { name: 'Ativos sem classe' })).toBeNull()
    expect(within(lista(c)).getByText(ATIVOS.fiis.label)).toBeTruthy()
  })
  it('classe provável mas incerta (ETF de ações) entra na conta e pede confirmação; confirmar grava a escolha', async () => {
    semear({ posicao: [pos('BOVA11', 10, 500, 'etf')], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    expect(txt(c)).toMatch(/1 para confirmar/)
    fireEvent.click(within(c).getByRole('button', { name: /Confirmar .* para BOVA11/ }))
    await waitFor(() => expect(lerSalvo().classes).toEqual({ BOVA11: 'acoesETFs' }))
    expect(txt(c)).not.toMatch(/para confirmar/)
  })

  it('aporte guiado: distribui o valor entre as classes abaixo do alvo, sem perder nem criar centavo', async () => {
    base()
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const c = await cartao()
    fireEvent.change(within(c).getByLabelText(/Quanto você vai aportar/), { target: { value: '1.000,00' } })
    const itens = within(within(c).getByRole('list', { name: 'Distribuição do aporte' })).getAllByRole('listitem')
    expect(itens.length).toBeGreaterThan(0)
    expect(Math.round(somaReais(itens) * 100)).toBe(100000)
    expect(txt(c)).toContain('Não manda vender nada')
  })
  it('aviso educacional e de privacidade no cartão', async () => {
    base()
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    const nota = within(await cartao()).getByRole('note')
    expect(nota.textContent).toContain('não é recomendação de investimento')
    expect(nota.textContent).toContain('ativos nunca saem deste aparelho')
  })
  it('sem nenhum ativo importado, não mostra comparação vazia', async () => {
    semear({ lancs: [L({ tipo: 'provento', valor: 10, quantidade: 1, preco: 0, subtipo: 'jcp' })] })
    render(<MinhaCarteira ctx={ctxCom()} hoje={hoje} />)
    expect(txt(await cartao())).toContain('Importe os seus ativos')
  })
})

describe('MinhaCarteira: só vale o que está na Posição (ativo zerado é zero)', () => {
  const ctxVazio = {} as AppCtx
  const conf = async () => (await screen.findByRole('heading', { name: 'Conferência com a Posição' })).closest('section')!
  const posicoes = async () => (await screen.findByRole('heading', { name: 'Posições' })).closest('section')!

  it('ativo que a Posição não tem NÃO vira pendência: só uma nota diz que ele ficou de fora', async () => {
    // BRML3 e BEEF11 aparecem no histórico, mas a Posição não os tem: foram vendidos ou convertidos. É zero.
    semear({ lancs: [L(), L({ ativo: 'BRML3', quantidade: 300, valor: 3000 }), L({ ativo: 'BEEF11', quantidade: 100, valor: 2000 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await conf()
    expect(txt(c)).toContain('1 de 1 ativos conferem')
    expect(txt(c)).toContain('2 ativo(s) que você já zerou ficam de fora')
    expect(txt(c)).not.toContain('BRML3')
    expect(txt(c)).not.toContain('BEEF11')
    expect(txt(c)).not.toContain('Inconsistente')
    expect(txt(await posicoes())).not.toContain('BRML3')
  })
  it('o total investido e o resultado não são inflados pelos ativos zerados', async () => {
    semear({ lancs: [L(), L({ ativo: 'BRML3', quantidade: 300, valor: 3000 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const carteira = (await screen.findByRole('heading', { name: 'Carteira' })).closest('section')!
    expect(txt(carteira)).toContain('R$ 1.500,00') // patrimônio
    expect(txt(carteira)).toMatch(/Investido nos ativos com preço médio conhecido: R\$\s1\.000,00/) // sem os 3.000 de BRML3
  })

  it('ativo da Posição com lançamentos a MAIS: dá baixa como VENDA, já com o preço médio, e passa a conferir', async () => {
    semear({ lancs: [L({ quantidade: 115, valor: 1150 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await conf()
    expect(txt(c)).toContain('Inconsistente')
    fireEvent.click(within(c).getByRole('button', { name: 'Dar baixa em 15' }))
    const form = within(c).getByRole('group', { name: 'Dar baixa em VALE3' })
    expect((within(form).getByLabelText('Quantidade') as HTMLInputElement).value).toBe('15')
    expect((within(form).getByLabelText('Preço de venda (R$)') as HTMLInputElement).value).toBe('10') // o preço médio: resultado zero
    expect((within(form).getByLabelText('Data') as HTMLInputElement).value).toBe('2026-09-28') // antes do prazo D+2, para valer
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar baixa' }))
    await waitFor(() => expect(txt(c)).toContain('1 de 1 ativos conferem'))
    expect(lerSalvo().lancamentos.find((l) => l.origem === 'manual')).toMatchObject({ tipo: 'venda', ativo: 'VALE3', quantidade: 15, preco: 10, valor: 150, data: '2026-09-28' })
  })
  it('dar baixa como EVENTO DA EMPRESA só ajusta a quantidade (sem preço, sem resultado)', async () => {
    semear({ lancs: [L({ quantidade: 115, valor: 1150 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await conf()
    fireEvent.click(within(c).getByRole('button', { name: 'Dar baixa em 15' }))
    const form = within(c).getByRole('group', { name: 'Dar baixa em VALE3' })
    fireEvent.change(within(form).getByLabelText('Motivo'), { target: { value: 'ajuste' } })
    expect(within(form).queryByLabelText('Preço de venda (R$)')).toBeNull()
    expect((within(form).getByLabelText('Data') as HTMLInputElement).value).toBe('2026-09-30')
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar baixa' }))
    await waitFor(() => expect(txt(c)).toContain('1 de 1 ativos conferem'))
    expect(lerSalvo().lancamentos.find((l) => l.origem === 'manual')).toMatchObject({ tipo: 'ajusteQuantidade', quantidade: -15, preco: 0, valor: 0 })
  })
  it('baixa com dado inválido: explica e não lança', async () => {
    semear({ lancs: [L({ quantidade: 115, valor: 1150 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await conf()
    fireEvent.click(within(c).getByRole('button', { name: 'Dar baixa em 15' }))
    const form = within(c).getByRole('group', { name: 'Dar baixa em VALE3' })
    fireEvent.change(within(form).getByLabelText('Preço de venda (R$)'), { target: { value: '' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Lançar baixa' }))
    expect((await within(form).findByRole('alert')).textContent).toContain('Informe o preço de venda')
    expect(lerSalvo().lancamentos).toHaveLength(1)
  })
  it('cancelar a baixa fecha o formulário sem lançar nada', async () => {
    semear({ lancs: [L({ quantidade: 115, valor: 1150 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await conf()
    fireEvent.click(within(c).getByRole('button', { name: 'Dar baixa em 15' }))
    fireEvent.click(within(within(c).getByRole('group', { name: 'Dar baixa em VALE3' })).getByRole('button', { name: 'Cancelar' }))
    expect(within(c).queryByRole('group', { name: 'Dar baixa em VALE3' })).toBeNull()
    expect(lerSalvo().lancamentos).toHaveLength(1)
  })

  it('inconsistente porque as vendas superam o histórico: pede o preço médio do saldo anterior', async () => {
    semear({ lancs: [L({ data: '2026-09-01', tipo: 'venda', valor: 1000 }), L({ data: '2026-09-02', quantidade: 100 })], posicao: [pos('VALE3', 50, 750)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await conf()
    expect(txt(c)).toContain('Inconsistente')
    fireEvent.change(within(c).getByLabelText(/Preço médio dos 100 anteriores/), { target: { value: '8' } })
    fireEvent.click(within(c).getByRole('button', { name: 'Lançar saldo inicial' }))
    await waitFor(() => expect(lerSalvo().lancamentos.some((l) => l.tipo === 'saldoInicial' && l.quantidade === 100 && l.preco === 8)).toBe(true))
  })

  it('"Ver e corrigir lançamentos" leva à lista já filtrada pelo ativo, e dá para limpar o filtro', async () => {
    semear({ lancs: [L({ quantidade: 115, valor: 1150 }), L({ ativo: 'BBAS3', quantidade: 10, valor: 100 })], posicao: [pos('VALE3', 100, 1500), pos('BBAS3', 10, 100)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await conf()
    fireEvent.click(within(c).getByRole('button', { name: 'Ver e corrigir os lançamentos de VALE3' }))
    const lista = screen.getByRole('heading', { name: 'Lançamentos' }).closest('section')!
    expect((within(lista).getByLabelText('Filtrar lançamentos por ativo') as HTMLInputElement).value).toBe('VALE3')
    expect(txt(lista)).toContain('1 de 2 lançamento(s)')
    expect(within(lista).getAllByRole('button', { name: /Corrigir lançamento de/ })).toHaveLength(1)
    expect(within(lista).getByRole('button', { name: /Corrigir lançamento de VALE3/ })).toBeTruthy()
    fireEvent.click(within(lista).getByRole('button', { name: 'Limpar filtro' }))
    expect(txt(lista)).toContain('2 lançamento(s)')
    expect(within(lista).getAllByRole('button', { name: /Corrigir lançamento de/ })).toHaveLength(2)
  })
  it('o filtro também funciona digitando, e avisa quando nada combina', async () => {
    semear({ lancs: [L(), L({ ativo: 'BBAS3', quantidade: 10, valor: 100 })] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const lista = (await screen.findByRole('heading', { name: 'Lançamentos' })).closest('section')!
    fireEvent.change(within(lista).getByLabelText('Filtrar lançamentos por ativo'), { target: { value: 'bbas' } })
    expect(txt(lista)).toContain('1 de 2 lançamento(s)')
    fireEvent.change(within(lista).getByLabelText('Filtrar lançamentos por ativo'), { target: { value: 'XXXX' } })
    expect(txt(lista)).toContain('Nenhum lançamento de XXXX')
  })
})
