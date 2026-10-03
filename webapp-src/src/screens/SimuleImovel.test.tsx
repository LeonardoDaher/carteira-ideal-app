import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SimuleImovel } from './SimuleImovel'
import type { SnapshotMercado } from '../domain/mercadoOficial'

const vazio: SnapshotMercado = { geradoEm: null, indicadores: {}, derivados: {}, tesouro: { dataBase: null, titulos: [] } }
const comFocus: SnapshotMercado = {
  ...vazio,
  indicadores: { cdi: { nome: 'CDI', unidade: '% a.a.', codigoSgs: 4389, data: '2026-09-28', valor: 13.65 } },
  focus: { data: '2026-09-25', ipca: { 2027: 4.3, 2030: 3.5 }, selic: { 2027: 12, 2030: 10 } },
}

const campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement
const digitar = (nome: string, valor: string) => fireEvent.change(campo(nome), { target: { value: valor } })

describe('SimuleImovel', () => {
  it('abre com um vencedor, o ranking das três rotas e o aviso de que não indica produto', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.getByRole('heading', { name: 'Comprar à vista, financiar, consórcio ou alugar?' })).toBeTruthy()
    expect(screen.getByText(/termina com o maior patrimônio:/)).toBeTruthy()
    const ranking = screen.getByText('Patrimônio líquido final').closest('.card') as HTMLElement
    expect(within(ranking).getByText(/1º/)).toBeTruthy()
    expect(within(ranking).getByText(/2º/)).toBeTruthy()
    expect(within(ranking).getByText(/3º/)).toBeTruthy()
    expect(screen.getByText(/não indica banco, administradora de consórcio nem produto/)).toBeTruthy()
  })

  it('o link de topo volta para o hub Simule Bens', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.getByRole('link', { name: '← Simule Bens' }).getAttribute('href')).toBe('./?tela=simuleBens')
  })

  it('usa a projeção de longo prazo do Focus como ponto de partida e mostra o CDI de hoje', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(campo('Rendimento dos investimentos').value).toBe('10')
    expect(campo('Inflação esperada').value).toBe('3,5')
    expect(campo('Valorização do imóvel').value).toBe('3,5')
    expect(screen.getByText(/CDI de hoje: 13,65%/)).toBeTruthy()
    expect(screen.getByText(/Boletim Focus \(coleta de 25\/09\/2026\)/)).toBeTruthy()
  })

  it('sem dados do Focus, abre com os padrões e sem a nota do Focus', () => {
    render(<SimuleImovel snapshot={vazio} />)
    expect(campo('Rendimento dos investimentos').value).toBe('10')
    expect(campo('Valorização do imóvel').value).toBe('4,5')
    expect(screen.queryByText(/Boletim Focus \(coleta/)).toBeNull()
  })

  it('rendimento muito alto faz alugar e investir vencer', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    digitar('Rendimento dos investimentos', '25')
    expect(await screen.findByText('Alugar e investir', { selector: 'span.font-display' })).toBeTruthy()
  })

  it('valorização muito alta e juros baixos fazem quem compra vencer', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    digitar('Valorização do imóvel', '14')
    digitar('Rendimento dos investimentos', '8')
    const vencedor = await screen.findByText(/termina com o maior patrimônio:/)
    const cartao = vencedor.closest('.imovel-vencedor') as HTMLElement
    expect(within(cartao).queryByText('Alugar e investir')).toBeNull()
  })

  it('entrada maior que o imóvel mostra o erro em vez do resultado', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.change(campo('Entrada do financiamento'), { target: { value: '900.000' } })
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText(/A entrada não pode ser negativa nem maior/)).toBeTruthy()
    expect(screen.queryByText(/termina com o maior patrimônio:/)).toBeNull()
  })

  it('os seguros aceitam 3 casas decimais: 0,012% aparece inteiro e dá para digitar outro valor', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(campo('Seguro DFI').value).toBe('0,012')
    expect(campo('Seguro MIP').value).toBe('0,03')
    digitar('Seguro MIP', '0,045')
    expect(campo('Seguro MIP').value).toBe('0,045')
    digitar('Juros da proposta (nominal)', '11,25')
    expect(campo('Juros da proposta (nominal)').value).toBe('11,25')
  })

  it('a regra do lance só aparece quando há lance', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.queryByRole('group', { name: 'Regra do lance' })).toBeNull()
    fireEvent.change(campo('Lance com recursos próprios'), { target: { value: '50.000' } })
    const regra = screen.getByRole('group', { name: 'Regra do lance' })
    expect(within(regra).getByRole('button', { name: 'O prazo' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(regra).getByRole('button', { name: 'A parcela' }))
    expect(within(regra).getByRole('button', { name: 'A parcela' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('SAC e Price: troca o sistema e a primeira parcela cai', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const antes = screen.getByText(/Primeira parcela:/).textContent
    fireEvent.click(screen.getByRole('button', { name: 'Price' }))
    expect(screen.getByRole('button', { name: 'Price' }).getAttribute('aria-pressed')).toBe('true')
    await screen.findByText(/Primeira parcela:/)
    expect(screen.getByText(/Primeira parcela:/).textContent).not.toBe(antes)
    expect(screen.getByText(/Sistema escolhido: Price/)).toBeTruthy()
  })

  it('descontar custos de venda muda o texto do patrimônio', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.getByText(/Sem custos de venda/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Descontar os custos de venda do imóvel/))
    expect(screen.getByText(/já descontados os custos de venda/)).toBeTruthy()
  })

  it('mostra o ponto de virada, a sensibilidade à contemplação e o gráfico acessível', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.getByText('Em que ponto o resultado muda?')).toBeTruthy()
    expect(screen.getByText(/E se a contemplação demorar\?/)).toBeTruthy()
    expect(screen.getByText(/Contemplado no 12º mês/)).toBeTruthy()
    const grafico = screen.getByRole('img', { name: /Patrimônio líquido ao longo de 20 anos/ })
    expect(grafico.getAttribute('tabindex')).toBe('0')
    // as setas do teclado movem a leitura: o ano muda
    fireEvent.keyDown(grafico, { key: 'Home' })
    expect(screen.getByText('Hoje', { selector: '.grafico-pat-tempo' })).toBeTruthy()
    fireEvent.keyDown(grafico, { key: 'ArrowRight' })
    expect(screen.getByText('Ano 1', { selector: '.grafico-pat-tempo' })).toBeTruthy()
  })

  it('o horizonte é refletido no resumo e no gráfico', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    digitar('Comparar por quantos anos?', '10')
    expect(await screen.findByRole('img', { name: /Patrimônio líquido ao longo de 10 anos/ })).toBeTruthy()
  })
})

describe('SimuleImovel: explicação detalhada de custos e taxas', () => {
  it('explica o que o resultado mostra, com a definição de patrimônio líquido e o que ele não é', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.getByText('O que este resultado mostra')).toBeTruthy()
    expect(screen.getByText(/é o que você teria no último dia da simulação/)).toBeTruthy()
    expect(screen.getByText(/Os três caminhos usam o mesmo dinheiro/)).toBeTruthy()
    expect(screen.getByText(/Por que .* terminou .* à frente de/)).toBeTruthy()
    const decomposicao = screen.getByRole('table', { name: 'Decomposição da vantagem do primeiro colocado' })
    expect(within(decomposicao).getByText('Custos que não voltam')).toBeTruthy()
    expect(within(decomposicao).getByText('Vantagem total')).toBeTruthy()
    expect(screen.getByText(/O que mais pesou nessa diferença foi/)).toBeTruthy()
    expect(screen.getByText(/O que o resultado não é\./)).toBeTruthy()
  })

  it('mostra "para onde foi cada real" com a mesma primeira linha nos três caminhos', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const tabela = screen.getByRole('table', { name: 'Para onde foi o dinheiro em cada caminho' })
    const colocado = within(tabela).getByRole('rowheader', { name: 'Dinheiro colocado' }).parentElement as HTMLElement
    const valores = within(colocado).getAllByRole('cell').map((c) => c.textContent)
    expect(valores).toHaveLength(3)
    expect(new Set(valores).size).toBe(1)
  })

  it('detalha cada custo do financiamento: ITBI, juros, os dois seguros, tarifa e custos de dono', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const bloco = screen.getByText('Financiar: cada custo e cada taxa').closest('details') as HTMLElement
    for (const item of ['ITBI, escritura e registro', 'Juros do financiamento', 'Seguro MIP (morte e invalidez)', 'Seguro DFI (danos ao imóvel)', 'Tarifa de administração do banco', 'Custos de quem é dono', 'Entrada', 'Dívida amortizada', 'Valorização do imóvel', 'Imposto de Renda']) {
      expect(within(bloco).getAllByText(item).length, item).toBeGreaterThan(0)
    }
    expect(within(bloco).getByText(/CET/, { selector: 'strong' })).toBeTruthy()
    expect(within(bloco).getByText(/Primeira parcela:/)).toBeTruthy()
  })

  it('detalha o aluguel, inclusive o aviso de condomínio e IPTU fora do aluguel', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const bloco = screen.getByText('Alugar e investir: cada custo e cada taxa').closest('details') as HTMLElement
    expect(within(bloco).getByText('Aluguel pago')).toBeTruthy()
    expect(within(bloco).getByText(/não inclui condomínio ou IPTU/)).toBeTruthy()
    expect(within(bloco).getByText('Rendimento bruto')).toBeTruthy()
  })

  it('detalha o consórcio: administração, fundo de reserva, aluguel de espera, reajuste e ITBI', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const bloco = screen.getByText('Consórcio: cada custo e cada taxa').closest('details') as HTMLElement
    for (const item of ['Taxa de administração', 'Fundo de reserva', 'Aluguel até a contemplação', 'ITBI, escritura e registro', 'Reajuste das parcelas', 'Valorização do imóvel']) {
      expect(within(bloco).getAllByText(item).length, item).toBeGreaterThan(0)
    }
    expect(within(bloco).queryByText('Lance com recursos próprios')).toBeNull()
  })

  it('com lance, o consórcio explica que ele abate a dívida', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.change(campo('Lance com recursos próprios'), { target: { value: '50.000' } })
    const bloco = screen.getByText('Consórcio: cada custo e cada taxa').closest('details') as HTMLElement
    expect(within(bloco).getByText('Lance com recursos próprios')).toBeTruthy()
    expect(within(bloco).getByText(/abate a dívida do consórcio/)).toBeTruthy()
  })

  it('lista todas as premissas usadas, para conferência', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const premissas = screen.getByText('Todas as premissas desta simulação').closest('details') as HTMLElement
    for (const rotulo of ['Valor do imóvel', 'Horizonte da comparação', 'Rendimento dos investimentos', 'Juros nominais', 'Seguros', 'Aluguel hoje', 'Contemplação', 'Lance']) {
      expect(within(premissas).getByText(rotulo), rotulo).toBeTruthy()
    }
  })

  it('custos de venda ligados aparecem no fechamento da conta', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.queryAllByText('Custos de venda do imóvel')).toHaveLength(0)
    fireEvent.click(screen.getByLabelText(/Descontar os custos de venda do imóvel/))
    expect(screen.getAllByText('Custos de venda do imóvel').length).toBeGreaterThan(0)
  })
})

describe('SimuleImovel: de onde vem o dinheiro aplicado', () => {
  it('no aluguel, separa o capital inicial (entrada + ITBI) dos aportes mensais e explica o orçamento', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const bloco = screen.getByText('Alugar e investir: cada custo e cada taxa').closest('details') as HTMLElement
    expect(within(bloco).getByText('Capital inicial aplicado')).toBeTruthy()
    expect(within(bloco).getByText(/É a entrada \(R\$ 100\.000\) mais o ITBI e o cartório \(R\$ 20\.000\)/)).toBeTruthy()
    expect(within(bloco).getByText('Aportes mensais')).toBeTruthy()
    expect(within(bloco).getByText(/No 1º mês o orçamento é de R\$ 5\.400, definido pelo consórcio/)).toBeTruthy()
    expect(within(bloco).getByText(/então você aplica R\$ 2\.900/)).toBeTruthy()
    expect(within(bloco).getByText(/Se você não investir essa diferença todo mês, o resultado deste caminho cai/)).toBeTruthy()
    expect(within(bloco).getByText('Total aplicado')).toBeTruthy()
  })

  it('no financiamento não há capital inicial aplicado (ele foi para o imóvel)', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const bloco = screen.getByText('Financiar: cada custo e cada taxa').closest('details') as HTMLElement
    expect(within(bloco).queryByText('Capital inicial aplicado')).toBeNull()
    expect(within(bloco).getByText('Aportes mensais')).toBeTruthy()
  })
})

describe('SimuleImovel: comprar à vista (D46)', () => {
  it('por padrão a rota fica de fora e a tela diz quanto falta, com um atalho para incluí-la', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(campo('Dinheiro disponível hoje').value).toBe('120.000,00') // só a entrada e o ITBI
    const aviso = screen.getByText(/Comprar à vista não entrou na comparação/).closest('div') as HTMLElement
    expect(within(aviso).getByText(/seriam necessários R\$ 520\.000, e faltam R\$ 400\.000/)).toBeTruthy()
    expect(screen.queryByText('Comprar à vista: cada custo e cada taxa')).toBeNull()
    const ranking = screen.getByText('Patrimônio líquido final').closest('.card') as HTMLElement
    expect(within(ranking).queryByText(/Comprar à vista/)).toBeNull()
  })

  it('o botão do aviso inclui a rota: 4 caminhos, bloco explicativo, coluna na tabela e linha no ponto de virada', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.click(screen.getByRole('button', { name: /Incluir comprar à vista \(usar R\$\s520\.000\)/ }))
    const ranking = (await screen.findByText('Patrimônio líquido final')).closest('.card') as HTMLElement
    expect(within(ranking).getByText(/Comprar à vista/)).toBeTruthy()
    expect(within(ranking).getByText(/4º/)).toBeTruthy()
    expect(screen.queryByText(/Comprar à vista não entrou na comparação/)).toBeNull()
    expect(screen.getByText('Comprar à vista: cada custo e cada taxa')).toBeTruthy()
    expect(screen.getByText(/Os quatro caminhos usam o mesmo dinheiro/)).toBeTruthy()
    const tabela = screen.getByRole('table', { name: 'Para onde foi o dinheiro em cada caminho' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent).filter(Boolean)).toEqual(['Financiar', 'Alugar', 'Consórcio', 'À vista'])
    expect(screen.getByText('Comprar à vista × alugar:')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Comprar à vista R\$/ })).toBeTruthy()
  })

  it('digitar um valor que cobre o imóvel e o ITBI também inclui a rota', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.change(campo('Dinheiro disponível hoje'), { target: { value: '600.000' } })
    expect(await screen.findByText('Comprar à vista: cada custo e cada taxa')).toBeTruthy()
    // o dinheiro que sobra depois do imóvel e do ITBI (80.000) fica aplicado e aparece no bloco
    const bloco = screen.getByText('Comprar à vista: cada custo e cada taxa').closest('details') as HTMLElement
    expect(within(bloco).getByText(/Sobra do seu dinheiro depois de pagar o imóvel \(R\$ 500\.000\) e o ITBI\/cartório \(R\$ 20\.000\)/)).toBeTruthy()
  })

  it('o bloco explica os custos da rota: ITBI e custos de dono, sem juros nem seguros', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.click(screen.getByRole('button', { name: /Usar R\$\s520\.000 \(imóvel \+ ITBI e cartório\)/ }))
    const bloco = (await screen.findByText('Comprar à vista: cada custo e cada taxa')).closest('details') as HTMLElement
    for (const item of ['ITBI, escritura e registro', 'Custos de quem é dono', 'Imóvel pago à vista', 'Valorização do imóvel', 'Rendimento bruto', 'Imposto de Renda']) {
      expect(within(bloco).getAllByText(item).length, item).toBeGreaterThan(0)
    }
    expect(within(bloco).getByText(/Não há juros, seguros nem tarifa neste caminho/)).toBeTruthy()
    expect(within(bloco).getByText(/o preço escondido deste caminho/)).toBeTruthy()
  })

  it('"Só entrada + ITBI" volta ao padrão e a rota sai; limpar o campo faz o mesmo', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.queryByRole('button', { name: 'Só entrada + ITBI' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Usar R\$\s520\.000 \(imóvel \+ ITBI e cartório\)/ }))
    await screen.findByText('Comprar à vista: cada custo e cada taxa')
    fireEvent.click(screen.getByRole('button', { name: 'Só entrada + ITBI' }))
    expect(await screen.findByText(/Comprar à vista não entrou na comparação/)).toBeTruthy()
    fireEvent.change(campo('Dinheiro disponível hoje'), { target: { value: '700.000' } })
    await screen.findByText('Comprar à vista: cada custo e cada taxa')
    fireEvent.change(campo('Dinheiro disponível hoje'), { target: { value: '' } })
    expect(await screen.findByText(/Comprar à vista não entrou na comparação/)).toBeTruthy()
  })

  it('dinheiro menor que a entrada + ITBI mostra o erro em português', async () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.change(campo('Dinheiro disponível hoje'), { target: { value: '50.000' } })
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText(/precisa cobrir ao menos a entrada mais o ITBI e o cartório/)).toBeTruthy()
  })

  it('subir a entrada acompanha o dinheiro disponível enquanto ele não foi informado', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.change(campo('Entrada do financiamento'), { target: { value: '150.000' } })
    expect(campo('Dinheiro disponível hoje').value).toBe('170.000,00') // 150.000 + ITBI de 20.000
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lista o dinheiro disponível nas premissas', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const premissas = screen.getByText('Todas as premissas desta simulação').closest('details') as HTMLElement
    expect(within(premissas).getByText('Dinheiro disponível hoje')).toBeTruthy()
    expect(within(premissas).getByText(/só a entrada e o ITBI/)).toBeTruthy()
  })
})

describe('SimuleImovel: ordem do formulário e de onde vem o R$ 520.000', () => {
  it('o dinheiro disponível vem logo depois do valor do imóvel, antes da entrada do financiamento', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const ordem = ['Valor do imóvel', 'Dinheiro disponível hoje', 'ITBI, escritura e registro', 'Entrada do financiamento', 'Comparar por quantos anos?'].map((n) => campo(n))
    for (let k = 1; k < ordem.length; k++) {
      expect(ordem[k - 1].compareDocumentPosition(ordem[k]) & Node.DOCUMENT_POSITION_FOLLOWING, `${k}`).toBeTruthy()
    }
  })

  it('o ITBI fica no começo (primeiro bloco), não escondido no bloco do financiamento', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    const primeiro = screen.getByText('O imóvel e o prazo').closest('details') as HTMLElement
    expect(within(primeiro).getByLabelText('ITBI, escritura e registro')).toBeTruthy()
    const financiamento = screen.getAllByText('Financiamento').find((e) => e.tagName === 'SUMMARY')!.closest('details') as HTMLElement
    expect(within(financiamento).queryByLabelText('ITBI, escritura e registro')).toBeNull()
  })

  it('o botão e a dica mostram a conta: imóvel + ITBI e cartório = valor necessário', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    expect(screen.getByText(/a entrada mais o ITBI e o cartório \(R\$\s100\.000 \+ R\$\s20\.000\)/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Usar R\$\s520\.000 \(imóvel \+ ITBI e cartório\)/ }))
    expect(screen.getByText(/seriam necessários R\$\s520\.000: o imóvel \(R\$\s500\.000\) mais o ITBI e o cartório \(R\$\s20\.000\)/)).toBeTruthy()
  })

  it('mudar o percentual do ITBI muda o valor necessário para comprar à vista', () => {
    render(<SimuleImovel snapshot={comFocus} />)
    fireEvent.change(campo('ITBI, escritura e registro'), { target: { value: '2' } })
    expect(screen.getByRole('button', { name: /Usar R\$\s510\.000 \(imóvel \+ ITBI e cartório\)/ })).toBeTruthy()
    expect(screen.getByText(/R\$\s10\.000 sobre o valor do imóvel, pagos em toda compra/)).toBeTruthy()
  })
})
