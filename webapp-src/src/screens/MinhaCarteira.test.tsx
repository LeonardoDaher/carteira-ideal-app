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
  it('apresenta 3 formas de trazer a carteira, todas com o mesmo peso (mesma estrutura e mesmo botão primário)', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
    expect(screen.getByRole('heading', { name: /3 formas de trazer a sua carteira/i })).toBeTruthy()
    expect(screen.queryByText(/em 3 passos/i)).toBeNull()
    const formas = Array.from(document.querySelectorAll('.mc-forma')) as HTMLElement[]
    expect(formas).toHaveLength(3)
    expect(formas.map((f) => f.querySelector('.mc-forma-titulo')!.textContent)).toEqual(['Dados da B3', 'Sua própria planilha', 'Lançamento direto'])
    for (const f of formas) expect(f.querySelectorAll('.btn-primary')).toHaveLength(1)
    const link = screen.getByRole('link', { name: /Abrir a Área do Investidor da B3/ }) as HTMLAnchorElement
    expect(link.href).toBe('https://www.investidor.b3.com.br/')
    expect(link.target).toBe('_blank')
    expect(link.rel).toContain('noopener')
    expect(within(formas[0]).getByText('Enviar extratos da B3')).toBeTruthy()
    expect(within(formas[1]).getByText('Enviar minha planilha')).toBeTruthy()
    expect(within(formas[1]).getByRole('link', { name: /planilha-modelo/i })).toBeTruthy()
  })
  it('"Lançar um a um" abre o formulário de novo lançamento', async () => {
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    await screen.findByText('Seus gráficos vão aparecer aqui')
    expect(screen.queryByText('Novo lançamento')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar um a um' }))
    expect(await screen.findByText('Novo lançamento')).toBeTruthy()
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
    expect(screen.getByRole('img', { name: /Proventos por mês, de Out\/25 a Dez\/26; recebido este ano R\$\s25,00/ })).toBeTruthy()
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

describe('MinhaCarteira: sem lista de pendências (quem não tem o preço de compra, se vira)', () => {
  const ctxVazio = {} as AppCtx
  const posicoes = async () => (await screen.findByRole('heading', { name: 'Posições' })).closest('section')!

  it('o cartão de conferência e os formulários de saldo inicial não existem mais', async () => {
    semear({ lancs: [L({ quantidade: 20, valor: 200 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    await posicoes()
    expect(screen.queryByRole('heading', { name: 'Conferência com a Posição' })).toBeNull()
    expect(screen.queryByText(/pedem atenção/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lançar saldo inicial' })).toBeNull()
    expect(screen.queryByLabelText(/Preço médio dos .* anteriores/)).toBeNull()
  })
  it('ativo sem preço médio aparece com "—", um selo discreto e UMA linha de aviso, sem formulário', async () => {
    semear({ lancs: [L({ quantidade: 20, valor: 200 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(txt(c)).toContain('Sem preço médio')
    expect(txt(c)).toContain('1 ativo(s) sem preço médio. Toque no lápis do ativo para informar.')
    expect(txt(c)).toContain('—')
  })
  it('ativo que a Posição não tem (já zerado) não aparece em lugar nenhum, nem como pendência', async () => {
    semear({ lancs: [L(), L({ ativo: 'BRML3', quantidade: 300, valor: 3000 }), L({ ativo: 'BEEF11', quantidade: 100, valor: 2000 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(txt(c)).not.toContain('BRML3')
    expect(txt(c)).not.toContain('BEEF11')
    expect(txt(c)).toContain('1 ativo(s) em 1 tipo')
  })
  it('lançamentos a MAIS que a Posição não são problema: o preço médio do histórico aparece e nada é cobrado', async () => {
    semear({ lancs: [L({ quantidade: 115, valor: 1150 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(txt(c)).toContain('R$ 10,00')
    expect(txt(c)).toContain('R$ 500,00') // 1.500 de valor atual − 100 × 10 de custo
    expect(txt(c)).not.toContain('Sem preço médio')
  })
  it('o total investido e o resultado não são inflados pelos ativos zerados', async () => {
    semear({ lancs: [L(), L({ ativo: 'BRML3', quantidade: 300, valor: 3000 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const carteira = (await screen.findByRole('heading', { name: 'Carteira' })).closest('section')!
    expect(txt(carteira)).toContain('R$ 1.500,00')
    expect(txt(carteira)).toMatch(/Investido nos ativos com preço médio conhecido: R\$\s1\.000,00/)
  })
  it('a data da Posição fica no cartão de Posições, e dá para alterar', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(txt(c)).toContain('Posição da B3 de 30/09/2026')
    fireEvent.change(within(c).getByLabelText('Data da Posição'), { target: { value: '2026-09-29' } })
    await waitFor(() => expect(lerSalvo().dataPosicao).toBe('2026-09-29'))
  })
})

describe('MinhaCarteira: posições agrupadas, com lápis na frente e "Ver lançamentos" no fim da linha', () => {
  const ctxVazio = {} as AppCtx
  const posicoes = async () => (await screen.findByRole('heading', { name: 'Posições' })).closest('section')!
  const lancamentosCard = async () => (await screen.findByRole('heading', { name: 'Lançamentos' })).closest('section')!
  const abrir = (nome: string): HTMLDetailsElement => {
    const g = [...document.querySelectorAll('details.mc-grupo')].find((d) => d.querySelector('.mc-grupo-nome')?.textContent === nome) as HTMLDetailsElement
    g.open = true
    return g
  }
  const quatro = [pos('VALE3', 600, 600), pos('BBAS3', 200, 200), pos('MXRF11', 150, 150, 'fundos'), pos('AAPL34', 50, 50, 'bdr')]
  const proventoDeVale = L({ tipo: 'provento', data: '2026-09-15', valor: 25, quantidade: 100, preco: 0, subtipo: 'rendimento' })

  it('as posições vêm separadas por tipo, como na Área do Investidor: ativos, fatia da carteira e valor de cada grupo', async () => {
    semear({ posicao: quatro, dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(txt(c)).toContain('4 ativo(s) em 3 tipos')
    const grupos = [...c.querySelectorAll('details.mc-grupo')]
    expect(grupos.map((g) => g.querySelector('.mc-grupo-nome')!.textContent)).toEqual(['Ações', 'FIIs e fundos', 'BDRs'])
    const acoes = txt(grupos[0] as HTMLElement)
    expect(acoes).toContain('R$ 800,00')
    expect(acoes).toContain('2 ativos')
    expect(acoes).toContain('80,00% da carteira')
  })
  it('cada grupo abre só com os seus ativos; com um tipo só, já vem aberto', async () => {
    semear({ posicao: quatro, dataPosicao: '2026-09-30' })
    const { unmount } = render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    await posicoes()
    const acoes = abrir('Ações')
    expect(txt(acoes)).toContain('VALE3')
    expect(txt(acoes)).not.toContain('MXRF11')
    unmount()
    localStorage.clear()
    semear({ posicao: [pos('VALE3', 10, 100)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    await posicoes()
    expect((document.querySelector('details.mc-grupo') as HTMLDetailsElement).open).toBe(true)
  })
  it('a linha do ativo: o LÁPIS na frente e "Ver lançamentos" no FIM da linha (nada embaixo)', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    await posicoes()
    const topo = document.querySelector('.mc-pos-topo') as HTMLElement
    const filhos = [...topo.children]
    expect(filhos[0].getAttribute('aria-label')).toBe('Editar VALE3') // o lápis é o primeiro
    expect(filhos[0].querySelector('svg')).toBeTruthy()
    expect(filhos[1].textContent).toBe('VALE3')
    expect(filhos[filhos.length - 1].getAttribute('aria-label')).toBe('Ver lançamentos de VALE3') // e o link é o último
    // as frases antigas, embaixo de cada ativo, não existem mais
    expect(txt(topo.closest('li')!)).not.toContain('Editar preço médio')
  })

  it('o lápis abre o PAINEL de edição por cima da tela, com preço médio e classe', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    const painel = screen.getByRole('dialog', { name: 'Editar VALE3' })
    expect(painel.getAttribute('aria-modal')).toBe('true')
    expect((within(painel).getByLabelText(/Preço médio/) as HTMLInputElement).value).toBe('10')
    expect(within(painel).getByLabelText('Classe do ativo')).toBeTruthy()
    expect(within(painel).queryByLabelText('Quantidade')).toBeNull() // ativo da B3: quantidade vem da Posição
  })
  it('editar o preço médio no painel: passa a valer o informado, com o resultado recalculado, e fica gravado', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    const painel = screen.getByRole('dialog', { name: 'Editar VALE3' })
    fireEvent.change(within(painel).getByLabelText(/Preço médio/), { target: { value: '12,5' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(txt(c)).toContain('R$ 12,50')
    expect(txt(c)).toContain('Informado por você')
    expect(txt(c)).toContain('R$ 250,00') // 1.500 − 100 × 12,50
    expect(lerSalvo().precosMedios).toEqual({ VALE3: 12.5 })
  })
  it('informar o preço no painel resolve o ativo "sem preço médio"', async () => {
    semear({ lancs: [L({ quantidade: 20, valor: 200 })], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(txt(c)).toContain('Sem preço médio')
    fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(/Preço médio/), { target: { value: '9' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(txt(c)).not.toContain('Sem preço médio'))
    expect(txt(c)).toContain('R$ 600,00') // 1.500 − 100 × 9
  })
  it('escolher a classe no painel: fica gravada; "Automática" desfaz', async () => {
    semear({ posicao: [pos('XXXX11', 10, 100, 'fundos')], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar XXXX11' }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Classe do ativo'), { target: { value: 'fiis' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(lerSalvo().classes).toEqual({ XXXX11: 'fiis' }))
    fireEvent.click(within(c).getByRole('button', { name: 'Editar XXXX11' }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Classe do ativo'), { target: { value: '' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(lerSalvo().classes).toEqual({}))
  })
  it('"Voltar ao calculado" só aparece quando o preço foi informado, e desfaz', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    const { unmount } = render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    let c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Voltar ao calculado' })).toBeNull()
    unmount()
    localStorage.clear()
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30', precosMedios: { VALE3: 12.5 } })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Voltar ao calculado' }))
    await waitFor(() => expect(txt(c)).not.toContain('Informado por você'))
    expect(txt(c)).toContain('R$ 10,00')
    expect(lerSalvo().precosMedios).toEqual({})
  })
  it('preço inválido no painel: explica e não grava', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    const painel = screen.getByRole('dialog')
    for (const ruim of ['0', 'abc', '-3']) {
      fireEvent.change(within(painel).getByLabelText(/Preço médio/), { target: { value: ruim } })
      fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
      expect((await within(painel).findByRole('alert')).textContent).toContain('maior que zero')
    }
    expect(lerSalvo().precosMedios).toEqual({})
  })
  it('Cancelar, Esc, o X e clicar fora fecham o painel sem mudar nada', async () => {
    semear({ lancs: [L()], posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    const abrirPainel = () => fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    abrirPainel()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    abrirPainel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    abrirPainel()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    abrirPainel()
    fireEvent.mouseDown(document.querySelector('.mc-modal-fundo') as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(lerSalvo().precosMedios).toEqual({})
  })
  it('sem a Posição também dá para editar o preço médio', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar VALE3' }))
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(/Preço médio/), { target: { value: '15' } })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(txt(c)).toContain('R$ 15,00'))
  })
  it('Tesouro: o preço médio vem do valor aplicado da B3, sem histórico e sem pedir nada', async () => {
    semear({ posicao: [{ ...pos('TESOURO IPCA+ 2045', 40, 5000, 'tesouro'), valorAplicado: 4000 }], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(txt(c)).toContain('R$ 100,00')
    expect(txt(c)).toContain('Valor aplicado informado pela B3')
    expect(txt(c)).not.toContain('Sem preço médio')
  })

  it('"Ver lançamentos", no fim da linha, abre a lista filtrada pelo ativo e só com compras e vendas', async () => {
    semear({ lancs: [L(), proventoDeVale, L({ ativo: 'BBAS3', quantidade: 5, valor: 50 })], posicao: [pos('VALE3', 100, 1500), pos('BBAS3', 5, 60)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    abrir('Ações')
    fireEvent.click(within(c).getByRole('button', { name: 'Ver lançamentos de VALE3' }))
    const lista = await lancamentosCard()
    expect((within(lista).getByLabelText('Filtrar lançamentos por ativo') as HTMLInputElement).value).toBe('VALE3')
    expect(within(lista).getByRole('button', { name: 'Compras e vendas' }).getAttribute('aria-pressed')).toBe('true')
    expect(txt(lista)).toContain('1 de 3 lançamento(s)')
    expect(txt(lista)).not.toContain('recebidos')
  })
  it('o filtro por tipo separa compras e vendas dos proventos, e "Limpar filtro" volta a tudo', async () => {
    semear({ lancs: [L(), proventoDeVale] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const lista = await lancamentosCard()
    expect(txt(lista)).toContain('2 lançamento(s)')
    fireEvent.click(within(lista).getByRole('button', { name: 'Proventos' }))
    expect(txt(lista)).toContain('1 de 2 lançamento(s)')
    expect(txt(lista)).toContain('recebidos')
    fireEvent.click(within(lista).getByRole('button', { name: 'Compras e vendas' }))
    expect(txt(lista)).not.toContain('recebidos')
    expect(txt(lista)).toContain('100 ×')
    fireEvent.click(within(lista).getByRole('button', { name: 'Limpar filtro' }))
    expect(txt(lista)).toContain('2 lançamento(s)')
    expect(within(lista).getByRole('button', { name: 'Todos' }).getAttribute('aria-pressed')).toBe('true')
  })
  it('filtro por tipo sem nenhum lançamento daquele tipo: avisa', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const lista = await lancamentosCard()
    fireEvent.click(within(lista).getByRole('button', { name: 'Proventos' }))
    expect(txt(lista)).toContain('Nenhum lançamento deste tipo')
  })
})

describe('MinhaCarteira: ativo digitado à mão (posição, com a classe escolhida; nunca "compra de hoje")', () => {
  const ctxVazio = {} as AppCtx
  const posicoes = async () => (await screen.findByRole('heading', { name: 'Posições' })).closest('section')!
  const abrirNovo = async () => {
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Adicionar ativo' }))
    return screen.getByRole('dialog', { name: 'Adicionar ativo' })
  }
  const preencher = (painel: HTMLElement, campos: Record<string, string>) => {
    for (const [rotulo, valor] of Object.entries(campos)) fireEvent.change(within(painel).getByLabelText(rotulo), { target: { value: valor } })
  }
  const abrirGrupo = (nome: string) => {
    const g = [...document.querySelectorAll('details.mc-grupo')].find((d) => d.querySelector('.mc-grupo-nome')?.textContent === nome) as HTMLDetailsElement
    g.open = true
  }

  it('o botão "Adicionar ativo" existe mesmo antes de importar qualquer coisa', async () => {
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    expect(txt(await posicoes())).toContain('Nenhum ativo ainda')
    expect(await abrirNovo()).toBeTruthy()
  })
  it('cadastra uma POSIÇÃO: quantidade, preço médio, valor atual e classe; aparece no bloco da sua classe', async () => {
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const painel = await abrirNovo()
    preencher(painel, { 'Nome ou código do ativo': 'CDB Banco X', Quantidade: '1', 'Preço médio (R$ por unidade)': '10000', 'Valor atual total (R$, opcional)': '10500' })
    fireEvent.change(within(painel).getByLabelText('Classe do ativo'), { target: { value: 'cdbLiquidez' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const c = await posicoes()
    expect(txt(c)).toContain('Renda fixa (bancos)')
    abrirGrupo('Renda fixa (bancos)')
    expect(txt(c)).toContain('CDB BANCO X')
    expect(txt(c)).toContain('Digitado por você')
    expect(txt(c)).toContain('R$ 10.000,00')
    expect(txt(c)).toContain('R$ 500,00') // resultado
    expect(lerSalvo().ativosManuais).toEqual([{ ativo: 'CDB BANCO X', nome: 'CDB Banco X', quantidade: 1, precoMedio: 10000, valorAtual: 10500, classe: 'cdbLiquidez' }])
  })
  it('NÃO grava nenhum lançamento (antes a posição digitada virava uma "Compra de hoje")', async () => {
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const painel = await abrirNovo()
    preencher(painel, { 'Nome ou código do ativo': 'BBAS3', Quantidade: '1600', 'Preço médio (R$ por unidade)': '19,50' })
    fireEvent.change(within(painel).getByLabelText('Classe do ativo'), { target: { value: 'acoesETFs' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(lerSalvo().ativosManuais).toHaveLength(1))
    expect(lerSalvo().lancamentos).toEqual([])
    const lista = (await screen.findByRole('heading', { name: 'Lançamentos' })).closest('section')!
    expect(txt(lista)).toContain('Nenhum lançamento ainda')
  })
  it('sugere a classe pelo nome enquanto a pessoa ainda não escolheu (e respeita a escolha dela depois)', async () => {
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const painel = await abrirNovo()
    const classe = within(painel).getByLabelText('Classe do ativo') as HTMLSelectElement
    expect(classe.value).toBe('')
    preencher(painel, { 'Nome ou código do ativo': 'PETR4' })
    expect(classe.value).toBe('acoesETFs')
    fireEvent.change(classe, { target: { value: 'ouro' } })
    preencher(painel, { 'Nome ou código do ativo': 'PETR4F' })
    expect(classe.value).toBe('ouro') // a escolha da pessoa não é sobrescrita
  })
  it('sem valor atual, usa o custo e não mostra resultado', async () => {
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const painel = await abrirNovo()
    preencher(painel, { 'Nome ou código do ativo': 'LCI Banco Y', Quantidade: '1', 'Preço médio (R$ por unidade)': '5000' })
    fireEvent.change(within(painel).getByLabelText('Classe do ativo'), { target: { value: 'lciLca' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(lerSalvo().ativosManuais[0].valorAtual).toBeNull())
    const c = await posicoes()
    abrirGrupo('Renda fixa (bancos)')
    expect(txt(c)).toContain('Custo')
    expect(txt(c)).toContain('R$ 5.000,00')
  })
  it('recusa com explicação: classe não escolhida, quantidade zero, números inválidos e nome repetido', async () => {
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    let painel = await abrirNovo()
    preencher(painel, { 'Nome ou código do ativo': 'X1', Quantidade: '1', 'Preço médio (R$ por unidade)': '10' })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    expect((await within(painel).findByRole('alert')).textContent).toContain('Escolha a classe')
    fireEvent.change(within(painel).getByLabelText('Classe do ativo'), { target: { value: 'fiis' } })
    preencher(painel, { Quantidade: '0' })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    expect((await within(painel).findByRole('alert')).textContent).toContain('quantidade')
    preencher(painel, { Quantidade: 'abc' })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    expect((await within(painel).findByRole('alert')).textContent).toContain('Confira os números')
    expect(lerSalvo().ativosManuais).toEqual([])
    // nome repetido
    preencher(painel, { Quantidade: '1' })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(lerSalvo().ativosManuais).toHaveLength(1))
    painel = await abrirNovo()
    preencher(painel, { 'Nome ou código do ativo': 'x1', Quantidade: '1', 'Preço médio (R$ por unidade)': '10' })
    fireEvent.change(within(painel).getByLabelText('Classe do ativo'), { target: { value: 'fiis' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    expect((await within(painel).findByRole('alert')).textContent).toContain('já tem um ativo com este nome')
  })
  it('EDITAR um ativo digitado: muda quantidade, preço, valor e classe; o lápis traz tudo preenchido', async () => {
    semear({ ativosManuais: [{ ativo: 'CDB BANCO X', nome: 'CDB Banco X', quantidade: 1, precoMedio: 10000, valorAtual: 10500, classe: 'cdbLiquidez' }] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar CDB BANCO X' }))
    const painel = screen.getByRole('dialog', { name: 'Editar CDB BANCO X' })
    expect((within(painel).getByLabelText('Quantidade') as HTMLInputElement).value).toBe('1')
    expect((within(painel).getByLabelText(/Preço médio/) as HTMLInputElement).value).toBe('10000')
    expect((within(painel).getByLabelText(/Valor atual total/) as HTMLInputElement).value).toBe('10500')
    expect((within(painel).getByLabelText('Classe do ativo') as HTMLSelectElement).value).toBe('cdbLiquidez')
    preencher(painel, { Quantidade: '2', 'Valor atual total (R$, opcional)': '21500' })
    fireEvent.change(within(painel).getByLabelText('Classe do ativo'), { target: { value: 'lciLca' } })
    fireEvent.click(within(painel).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(lerSalvo().ativosManuais[0]).toMatchObject({ quantidade: 2, valorAtual: 21500, classe: 'lciLca' }))
    expect(lerSalvo().ativosManuais).toHaveLength(1)
  })
  it('REMOVER um ativo digitado pede confirmação', async () => {
    semear({ ativosManuais: [{ ativo: 'CDB BANCO X', nome: 'CDB Banco X', quantidade: 1, precoMedio: 100, valorAtual: null, classe: 'cdbLiquidez' }] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar CDB BANCO X' }))
    const painel = screen.getByRole('dialog')
    fireEvent.click(within(painel).getByRole('button', { name: 'Excluir ativo' }))
    expect(lerSalvo().ativosManuais).toHaveLength(1) // ainda não removeu
    fireEvent.click(within(painel).getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(lerSalvo().ativosManuais).toEqual([]))
  })
  it('EXCLUIR um ativo da B3 (ex.: direito de subscrição vencido): pede confirmação, some da lista e dá para mostrar de novo', async () => {
    semear({ posicao: [pos('VALE3', 100, 1500), pos('XPML12', 4, 0)], dataPosicao: '2026-09-30' })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    fireEvent.click(within(c).getByRole('button', { name: 'Editar XPML12' }))
    const painel = screen.getByRole('dialog', { name: 'Editar XPML12' })
    fireEvent.click(within(painel).getByRole('button', { name: 'Excluir ativo' }))
    expect(within(painel).getByText(/lançamentos e proventos continuam no histórico/)).toBeTruthy()
    expect(lerSalvo().ativosExcluidos).toEqual([]) // ainda não excluiu
    fireEvent.click(within(painel).getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(lerSalvo().ativosExcluidos).toEqual(['XPML12']))
    expect(within(c).queryByRole('button', { name: 'Editar XPML12' })).toBeNull()
    expect(within(c).getByRole('button', { name: 'Editar VALE3' })).toBeTruthy()
    expect(lerSalvo().posicao).toHaveLength(2) // a Posição importada não é mexida
    fireEvent.click(within(c).getByRole('button', { name: 'Mostrar XPML12 de novo' }))
    await waitFor(() => expect(lerSalvo().ativosExcluidos).toEqual([]))
    expect(within(c).getByRole('button', { name: 'Editar XPML12' })).toBeTruthy()
  })
  it('um ativo digitado não tem "Ver lançamentos" (não há lançamentos dele)', async () => {
    semear({ ativosManuais: [{ ativo: 'CDB BANCO X', nome: 'CDB Banco X', quantidade: 1, precoMedio: 100, valorAtual: null, classe: 'cdbLiquidez' }] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await posicoes()
    expect(within(c).queryByRole('button', { name: /Ver lançamentos de/ })).toBeNull()
  })
  it('entra no total, na composição e funciona junto com a Posição da B3', async () => {
    semear({ posicao: [pos('VALE3', 100, 1500)], dataPosicao: '2026-09-30', ativosManuais: [{ ativo: 'CDB BANCO X', nome: 'CDB Banco X', quantidade: 1, precoMedio: 10000, valorAtual: 10500, classe: 'cdbLiquidez' }] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const carteira = (await screen.findByRole('heading', { name: 'Carteira' })).closest('section')!
    expect(txt(carteira)).toContain('R$ 12.000,00') // 1.500 da B3 + 10.500 digitados
    const comp = (await screen.findByRole('heading', { name: 'Composição' })).closest('section')!
    expect(txt(comp)).toContain('Renda fixa (bancos)')
    expect(txt(comp)).toContain('Ações')
  })
  it('a classe escolhida para um ativo digitado vale na comparação com a carteira sugerida', async () => {
    const resposta = (l: { id: string }[]) => Object.fromEntries(l.map((p) => [p.id, 'b']))
    const resultado = gerarRecomendacao(resposta(PERGUNTAS) as never, { idade: 35 }, resposta(PERGUNTAS_ARQUITETURA) as never)
    const ctx = { resultado, resultadoPendente: false, erroResultado: null } as unknown as AppCtx
    semear({ ativosManuais: [{ ativo: 'CDB BANCO X', nome: 'CDB Banco X', quantidade: 1, precoMedio: 1000, valorAtual: null, classe: 'cdbLiquidez' }] })
    render(<MinhaCarteira ctx={ctx} hoje={hoje} />)
    const c = (await screen.findByRole('heading', { name: 'Comparar com a carteira sugerida' })).closest('section')!
    const linha = within(within(c).getByRole('list', { name: 'Comparação por classe' })).getByText(ATIVOS.cdbLiquidez.label).closest('li')!
    expect(txt(linha)).toContain(`Você: ${pct(100, false)}`)
    expect(within(c).queryByRole('group', { name: 'Ativos sem classe' })).toBeNull() // a classe foi escolhida: nada fica de fora
  })
})

describe('MinhaCarteira: filtro "Digitados por mim" nos lançamentos', () => {
  const ctxVazio = {} as AppCtx
  it('mostra só o que a pessoa lançou à mão, para achar e apagar de uma vez', async () => {
    semear({ lancs: [L(), L({ ativo: 'BBAS3', quantidade: 1600, preco: 19.5, valor: 31200, data: '2026-10-01', origem: 'manual' }), L({ ativo: 'PETR4', origem: 'manual', data: '2026-10-01' })] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const lista = (await screen.findByRole('heading', { name: 'Lançamentos' })).closest('section')!
    expect(txt(lista)).toContain('3 lançamento(s)')
    fireEvent.click(within(lista).getByRole('button', { name: 'Digitados por mim' }))
    expect(txt(lista)).toContain('2 de 3 lançamento(s)')
    expect(txt(lista)).toContain('BBAS3')
    expect(txt(lista)).toContain('PETR4')
    expect(txt(lista)).not.toContain('VALE3')
    // e dá para apagar direto dali
    fireEvent.click(within(lista).getByRole('button', { name: /Excluir lançamento de BBAS3/ }))
    fireEvent.click(within(lista).getByRole('button', { name: 'Sim, excluir' }))
    await waitFor(() => expect(lerSalvo().lancamentos.some((l) => l.ativo === 'BBAS3')).toBe(false))
  })
  it('sem nenhum lançamento digitado, avisa', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const lista = (await screen.findByRole('heading', { name: 'Lançamentos' })).closest('section')!
    fireEvent.click(within(lista).getByRole('button', { name: 'Digitados por mim' }))
    expect(txt(lista)).toContain('Nenhum lançamento deste tipo')
  })
})

describe('MinhaCarteira: proventos como na página Proventos da B3', () => {
  const ctxVazio = {} as AppCtx
  const prov = (data: string, ativo: string, valor: number, extra: Partial<LancamentoNovo> = {}) =>
    L({ tipo: 'provento', data, ativo, valor, quantidade: 100, preco: 0, subtipo: 'rendimento', origem: 'b3-movimentacao', ...extra })
  const cartao = async () => (await screen.findByRole('heading', { name: 'Proventos' })).closest('section')!
  const plano = (t: string | null | undefined) => (t ?? '').replace(/\u00a0/g, ' ')
  /** A coluna de um mês, pelo rótulo com o ano (o nome do mês se repete: Out/25 e Out/26). */
  const coluna = (c: HTMLElement, rotulo: string) => c.querySelector(`.mc-pb-col[title^="${rotulo}:"]`) as HTMLElement

  it('mostra o recebido ESTE ANO e nos ÚLTIMOS 12 MESES, como a B3', async () => {
    semear({ lancs: [L(), prov('2026-03-10', 'MXRF11', 100), prov('2026-09-15', 'MXRF11', 50), prov('2025-11-20', 'MXRF11', 30), prov('2025-06-01', 'MXRF11', 999)] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    const blocos = [...c.querySelectorAll('.mc-duplo > div')].map((d) => txt(d as HTMLElement))
    expect(blocos[0]).toContain('Recebido este ano')
    expect(blocos[0]).toContain('R$ 150,00') // 100 + 50 (2026)
    expect(blocos[1]).toContain('Últimos 12 meses')
    expect(blocos[1]).toContain('R$ 180,00') // 100 + 50 + 30; o de 06/2025 fica de fora
  })
  it('o gráfico tem 15 meses (12 antes, o atual e 2 depois), com o valor escrito sobre cada barra e o mês atual em destaque', async () => {
    semear({ lancs: [L(), prov('2026-08-14', 'MXRF11', 812.99), prov('2026-09-15', 'MXRF11', 1048.71)] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    const colunas = [...c.querySelectorAll('.mc-pb-col')]
    expect(colunas).toHaveLength(15)
    expect(colunas[0].querySelector('.mc-pb-mes')!.textContent).toBe('Out') // 12 meses antes de out/2026
    expect(colunas[14].querySelector('.mc-pb-mes')!.textContent).toBe('Dez')
    const destaque = c.querySelector('.mc-pb-col.destaque')!
    expect(destaque.querySelector('.mc-pb-mes')!.textContent).toBe('Out')
    const valores = colunas.map((k) => plano(k.querySelector('.mc-pb-valor')?.textContent))
    expect(valores).toContain('R$ 812,99')
    expect(valores).toContain('R$ 1,0 mil')
  })
  it('o que ainda será pago aparece nos meses seguintes, em barra tracejada, e não conta como recebido', async () => {
    semear({
      lancs: [L(), prov('2026-09-15', 'MXRF11', 100)],
      eventosFuturos: [
        { ativo: 'BBDC3', tipoEvento: 'jcp', previsao: '2026-10-15', quantidade: 200, precoUnitario: 0.02, valorLiquido: 53.67 },
        { ativo: 'MXRF11', tipoEvento: 'rendimento', previsao: '2026-11-14', quantidade: 100, precoUnitario: 1.07, valorLiquido: 107.46 },
      ],
    })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    const nov = coluna(c, 'Nov/26')
    expect(nov.querySelector('.mc-pb-areceber')).toBeTruthy()
    expect(nov.querySelector('.mc-pb-recebido')).toBeNull()
    expect(plano(nov.querySelector('.mc-pb-valor')!.textContent)).toBe('R$ 107,46')
    expect(txt(c.querySelector('.mc-duplo') as HTMLElement)).toContain('R$ 100,00') // "este ano" só tem o já recebido
    expect(txt(c)).toContain('A receber')
  })
  it('um evento "a receber" que já virou lançamento não conta duas vezes', async () => {
    semear({
      lancs: [L(), prov('2026-10-01', 'BBDC3', 2.84, { subtipo: 'jcp' })],
      eventosFuturos: [{ ativo: 'BBDC3', tipoEvento: 'jcp', previsao: '2026-10-01', quantidade: 200, precoUnitario: 0.02, valorLiquido: 2.84 }],
    })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    const out = coluna(c, 'Out/26')
    expect(plano(out.querySelector('.mc-pb-valor')!.textContent)).toBe('R$ 2,84') // e não 5,68
    expect(out.querySelector('.mc-pb-areceber')).toBeNull()
  })

  it('"Valores de cada mês" lista os meses com proventos; cada um abre com o detalhe, para conferir com a B3', async () => {
    semear({ lancs: [L(), prov('2026-08-14', 'MXRF11', 25), prov('2026-08-20', 'BBAS3', 788.99, { subtipo: 'jcp', origem: 'b3-proventos' }), prov('2026-09-15', 'HGLG11', 40)] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    const meses = [...c.querySelectorAll('.mc-meses > li')]
    expect(meses.map((m) => txt(m.querySelector('summary') as HTMLElement))).toEqual([expect.stringContaining('Set/26'), expect.stringContaining('Ago/26')])
    const ago = meses[1]
    expect(txt(ago.querySelector('summary') as HTMLElement)).toContain('R$ 813,99')
    const itens = [...ago.querySelectorAll('.mc-itens-mes li')].map((li) => txt(li as HTMLElement))
    expect(itens).toHaveLength(2)
    expect(itens[0]).toContain('20/08/2026')
    expect(itens[0]).toContain('BBAS3')
    expect(itens[0]).toContain('JCP')
    expect(itens[0]).toContain('B3 Proventos')
    expect(itens[1]).toContain('MXRF11')
    expect(itens[1]).toContain('Rendimento')
    expect(itens[1]).toContain('B3 Movimentação')
  })
  it('o detalhe do mês inclui o que ainda será pago, marcado como "a receber"', async () => {
    semear({ lancs: [L()], eventosFuturos: [{ ativo: 'BBDC3', tipoEvento: 'jcp', previsao: '2026-11-03', quantidade: 200, precoUnitario: 0.02, valorLiquido: 9 }] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    const nov = [...c.querySelectorAll('.mc-meses > li')].find((m) => txt(m.querySelector('summary') as HTMLElement).includes('Nov/26'))!
    expect(txt(nov.querySelector('.mc-itens-mes') as HTMLElement)).toContain('a receber')
    expect(txt(nov.querySelector('summary') as HTMLElement)).toContain('a receber')
  })
  it('amortização e reembolso entram como proventos, como a B3 os conta', async () => {
    semear({ lancs: [L(), prov('2026-09-10', 'XPTO11', 50, { subtipo: 'amortizacao' }), prov('2026-09-12', 'PETR4', 7, { subtipo: 'reembolso' })] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    expect(txt(c.querySelector('.mc-duplo') as HTMLElement)).toContain('R$ 57,00')
    expect(txt(c)).toContain('Amortização')
    expect(txt(c)).toContain('Reembolso')
  })
  it('sem nenhum provento: avisa e não desenha gráfico vazio', async () => {
    semear({ lancs: [L()] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = await cartao()
    expect(txt(c)).toContain('Ainda sem proventos')
    expect(c.querySelector('.mc-pb')).toBeNull()
  })
})

describe('MinhaCarteira: proventos repetidos em par (transferência de custódia) não inflam mais o gráfico', () => {
  const ctxVazio = {} as AppCtx
  const prov = (data: string, ativo: string, valor: number) => L({ tipo: 'provento', data, ativo, valor, quantidade: 100, preco: 0, subtipo: 'rendimento', origem: 'b3-movimentacao' })
  const plano = (t: string | null | undefined) => (t ?? '').replace(/\u00a0/g, ' ')

  // O mês real que originou a regra, com valores inventados: pagamentos únicos + pares idênticos nas datas das transferências.
  const unicos = [prov('2026-08-14', 'BBB11', 100), prov('2026-08-13', 'CCC11', 300.5), prov('2026-08-07', 'DDD11', 412.49)]
  const pares = [prov('2026-08-04', 'EEE11', 21.16), prov('2026-08-05', 'FFF3', 2.84), prov('2026-08-10', 'GGG3', 396.65)].flatMap((p) => [p, { ...p }])

  it('abre dados já gravados com os pares e mostra o mês SEM eles, igual ao da B3', async () => {
    semear({ lancs: [L(), ...unicos, ...pares] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = (await screen.findByRole('heading', { name: 'Proventos' })).closest('section')!
    const ago = c.querySelector('.mc-pb-col[title^="Ago/26:"]') as HTMLElement
    expect(plano(ago.querySelector('.mc-pb-valor')!.textContent)).toBe('R$ 812,99') // 100 + 300,50 + 412,49, e não 1.634,29
    expect(plano(c.querySelector('.mc-duplo')!.textContent)).toContain('R$ 812,99') // este ano
  })
  it('a lista "Valores de cada mês" de agosto não traz os pares', async () => {
    semear({ lancs: [L(), ...unicos, ...pares] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const c = (await screen.findByRole('heading', { name: 'Proventos' })).closest('section')!
    const ago = [...c.querySelectorAll('.mc-meses > li')].find((m) => txt(m.querySelector('summary') as HTMLElement).includes('Ago/26'))!
    const itens = [...ago.querySelectorAll('.mc-itens-mes li')].map((li) => txt(li as HTMLElement))
    expect(itens).toHaveLength(3)
    expect(itens.join(' ')).not.toMatch(/EEE11|FFF3|GGG3/)
  })
  it('o par some também da lista de lançamentos (e fica gravado limpo)', async () => {
    semear({ lancs: [L(), ...unicos, ...pares] })
    render(<MinhaCarteira ctx={ctxVazio} hoje={hoje} />)
    const lista = (await screen.findByRole('heading', { name: 'Lançamentos' })).closest('section')!
    await waitFor(() => expect(txt(lista)).toContain('4 lançamento(s)')) // a compra + 3 pagamentos verdadeiros
    expect(lerSalvo().lancamentos.filter((l) => l.tipo === 'provento')).toHaveLength(3)
  })
})
