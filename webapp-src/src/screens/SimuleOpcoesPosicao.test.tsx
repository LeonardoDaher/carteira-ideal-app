import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SimuleOpcoes } from './SimuleOpcoes'
import { CHAVE_POSICOES_OPCOES } from './MinhaPosicaoOpcoes'
import type { AppCtx } from '../state/useAppState'
import type { SerieOpcao, SnapshotOpcoes } from '../domain/opcoes'

const ctx = { screen: 'simuleOpcoes', setScreen: vi.fn() } as unknown as AppCtx

const serie = (codigo: string, tipo: 'call' | 'put', strike: number, vencimento: string, ultimo: number): SerieOpcao => ({
  codigo, tipo, estilo: 'europeia', strike, vencimento, ultimo, dataUltimo: '2026-10-16', variacao: null, negocios: 20, volume: 50_000,
})

// PETR4 a R$ 60 em 16/10/2026. Novembro (19/11, 22 d.u.) e dezembro (18/12, 42 d.u.).
const snapshot: SnapshotOpcoes = {
  geradoEm: null,
  dataPregao: '2026-10-16',
  ativos: [{
    ticker: 'PETR4', nome: 'PETROBRAS', cotacao: 60, dataCotacao: '2026-10-16', variacao: 1.69, volumeOpcoes: 9_000_000, lote: 100,
    series: [
      serie('PETRW600', 'put', 60, '2026-11-19', 2.2),
      serie('PETRW550', 'put', 55, '2026-11-19', 0.5),
      serie('PETRK550', 'call', 55, '2026-11-19', 6.1),
      serie('PETRK600', 'call', 60, '2026-11-19', 2.8),
      serie('PETRK650', 'call', 65, '2026-11-19', 0.9),
      serie('PETRX600', 'put', 60, '2026-12-18', 3.5),
      serie('PETRX550', 'put', 55, '2026-12-18', 1.4),
      serie('PETRL600', 'call', 60, '2026-12-18', 4.1),
      serie('PETRL650', 'call', 65, '2026-12-18', 1.9),
    ],
  }],
}

const txt = (id: string) => (screen.getByTestId(id).textContent ?? '').replace(/ /g, ' ')
const abrir = () => fireEvent.click(screen.getByRole('tab', { name: /Minha posição/ }))
const digitar = (rotulo: string, valor: string) => {
  const campo = screen.getByLabelText(rotulo)
  fireEvent.focus(campo)
  fireEvent.change(campo, { target: { value: valor } })
  fireEvent.blur(campo)
}
/** Cadastra uma perna pelo formulário: tipo, lado e série (mesmo vencimento de novembro, salvo `venc`). */
const adicionar = (tipo: 'Call' | 'Put', lado: 'Comprei' | 'Vendi', codigo: string, venc?: string) => {
  const form = within(screen.getByRole('group', { name: 'Adicionar perna' }))
  fireEvent.click(form.getByRole('button', { name: tipo }))
  fireEvent.click(form.getByRole('button', { name: lado }))
  if (venc) fireEvent.change(form.getByLabelText('Vencimento da perna'), { target: { value: venc } })
  fireEvent.change(form.getByLabelText('Série da perna'), { target: { value: codigo } })
  fireEvent.click(form.getByRole('button', { name: '+ Adicionar esta perna' }))
}
const iniciar = () => {
  render(<SimuleOpcoes ctx={ctx} snapshot={snapshot} />)
  abrir()
}

beforeEach(() => {
  cleanup()
  localStorage.clear()
})

describe('SimuleOpcoes: aba Minha posição', () => {
  it('abre vazia, com a explicação e o formulário para adicionar pernas', () => {
    iniciar()
    expect(screen.getByTestId('posicao-intro').textContent).toMatch(/Cadastre a estrutura que você montou/)
    expect(screen.getByText(/Ainda não há nada cadastrado/)).toBeDefined()
    expect(screen.queryByTestId('posicao-hoje')).toBeNull()
    expect(screen.queryByTestId('possibilidades')).toBeNull()
  })

  it('o formulário já vem na série mais perto do preço, com o último preço de mercado', () => {
    iniciar()
    const form = within(screen.getByRole('group', { name: 'Adicionar perna' }))
    expect((form.getByLabelText('Série da perna') as HTMLSelectElement).value).toBe('PETRK600')
    expect((form.getByLabelText('Preço que você pagou') as HTMLInputElement).value).toBe('2,80')
    fireEvent.click(form.getByRole('button', { name: 'Vendi' }))
    expect(form.getByLabelText('Preço que você recebeu')).toBeDefined()
  })

  it('cadastra uma put vendida: reconhece a estrutura e mostra o resultado de hoje pelo último preço', () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    expect(txt('estrutura-identificada')).toBe('Venda de put')
    expect(txt('resultado-hoje')).toBe('R$ 0,00') // o preço da operação é o de mercado
    digitar('Preço da operação de PETRW600', '3,20') // vendeu a 3,20; hoje vale 2,20
    expect(txt('resultado-hoje')).toBe('R$ 100,00')
    expect(txt('posicao-ganho-max')).toBe('R$ 320,00')
    expect(txt('posicao-perda-max')).toBe('−R$ 5.680,00')
    const linha = within(screen.getByTestId('tabela-posicao')).getAllByRole('row')[1]
    expect(within(linha).getAllByRole('cell').map((c) => c.textContent)).toContain('Venda')
  })

  it('uma trava de alta com calls: reconhece, mede o ganho máximo e mostra as possibilidades', () => {
    iniciar()
    adicionar('Call', 'Comprei', 'PETRK600')
    adicionar('Call', 'Vendi', 'PETRK650')
    expect(txt('estrutura-identificada')).toBe('Trava de alta com calls')
    // compra 60 a 2,80 e vende 65 a 0,90: débito 190, ganho máximo 310
    expect(txt('posicao-ganho-max')).toBe('R$ 310,00')
    expect(txt('posicao-perda-max')).toBe('−R$ 190,00')
    expect(within(screen.getByTestId('tabela-posicao')).getAllByRole('row')).toHaveLength(3)
    const titulos = screen.getAllByTestId('possibilidade').map((l) => within(l).getAllByRole('cell')[0].querySelector('div')!.textContent)
    expect(titulos).toContain('Manter até o vencimento')
    expect(titulos).toContain('Encerrar todas as opções hoje')
    expect(titulos).toContain('Encerrar só PETRK600 (comprada)')
    expect(titulos).toContain('Encerrar só PETRK650 (vendida)')
    expect(titulos.some((t) => t?.startsWith('Rolar a estrutura inteira'))).toBe(true)
  })

  it('a put vendida descoberta recebe a possibilidade de proteger, com débito e perda máxima menor', () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    const linhas = screen.getAllByTestId('possibilidade')
    const proteger = linhas.find((l) => (l.textContent ?? '').startsWith('Proteger PETRW600 comprando PETRW550'))!
    expect(proteger).toBeDefined()
    expect(proteger.textContent).toMatch(/Débito: você paga pela proteção/)
    const manter = linhas.find((l) => (l.textContent ?? '').startsWith('Manter até o vencimento'))!
    const perda = (l: HTMLElement) => Number((within(l).getAllByRole('cell')[4].textContent ?? '').replace(/[^\d,−]/g, '').replace('−', '-').replace(',', '.').replace(/\.(?=\d{3}\b)/g, ''))
    expect(perda(manter)).toBeLessThan(perda(proteger)) // −5.780 contra algo bem menor em módulo
  })

  it('"Ver como fica" abre o gráfico da posição que sobra, e de novo fecha', () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    expect(screen.queryByTestId('como-fica')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ver como fica: Proteger PETRW600 comprando PETRW550/ }))
    expect(screen.getByTestId('como-fica').textContent).toMatch(/Como fica: Proteger PETRW600/)
    expect(screen.getByTestId('ganho-maximo-saida')).toBeDefined()
    expect(screen.getByTestId('ganho-maximo-posicao')).toBeDefined() // o painel da posição atual convive, sem repetir identificadores
    fireEvent.click(screen.getByRole('button', { name: /Ver como fica: Proteger PETRW600 comprando PETRW550/ }))
    expect(screen.queryByTestId('como-fica')).toBeNull()
  })

  it('encerrar tudo não deixa nada aberto e diz o resultado realizado', () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    digitar('Preço da operação de PETRW600', '3,20')
    fireEvent.click(screen.getByRole('button', { name: /Ver como fica: Encerrar todas as opções hoje/ }))
    expect(screen.getByTestId('como-fica').textContent).toMatch(/não sobra nenhuma opção aberta/)
    expect(screen.getByTestId('como-fica').textContent).toMatch(/R\$\s100,00/)
  })

  it('rolar a perna vendida abre a nova no vencimento seguinte, com a troca em crédito ou débito', () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    const rolar = screen.getAllByTestId('possibilidade').find((l) => (l.textContent ?? '').startsWith('Rolar PETRW600 para 18/12, strike 60,00'))!
    expect(rolar).toBeDefined()
    expect(rolar.textContent).toMatch(/Crédito na troca/) // a de dezembro vale mais que a de novembro
    fireEvent.click(within(rolar).getByRole('button', { name: /Ver como fica/ }))
    expect(screen.getByTestId('como-fica')).toBeDefined()
  })

  it('com ações: o resultado soma as ações pelo preço médio e a call vendida vira venda coberta', () => {
    iniciar()
    fireEvent.click(screen.getByRole('button', { name: /\+ Adicionar ações de PETR4/ }))
    digitar('Preço médio das ações', '55')
    adicionar('Call', 'Vendi', 'PETRK650')
    expect(txt('estrutura-identificada')).toBe('Venda coberta')
    expect(txt('resultado-hoje')).toBe('R$ 500,00') // ações: (60 − 55) × 100; a call vale o que foi recebido
    expect(txt('posicao-ganho-max')).not.toBe('Sem limite') // coberta: ganho limitado
    expect(screen.queryByText(/não tem limite/)).toBeNull()
  })

  it('uma call vendida sem ações avisa que a perda não tem limite', () => {
    iniciar()
    adicionar('Call', 'Vendi', 'PETRK600')
    expect(txt('estrutura-identificada')).toBe('Venda de call descoberta')
    expect(txt('posicao-perda-max')).toBe('Sem limite')
    expect(txt('pontos-de-atencao')).toMatch(/não tem limite/)
  })

  it('a posição fica guardada neste aparelho e volta ao reabrir', async () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    await waitFor(() => expect(localStorage.getItem(CHAVE_POSICOES_OPCOES)).toMatch(/PETRW600/))
    cleanup()
    iniciar()
    await screen.findByRole('group', { name: 'Perna PETRW600' })
    expect(txt('estrutura-identificada')).toBe('Venda de put')
  })

  it('uma série que não está mais na lista fica de fora da análise, com aviso', async () => {
    localStorage.setItem(CHAVE_POSICOES_OPCOES, JSON.stringify({ PETR4: { ticker: 'PETR4', pernas: [
      { id: 'a', codigo: 'PETRK600', lado: 'compra', quantidade: 100, premio: 2 },
      { id: 'b', codigo: 'PETRZ999', lado: 'venda', quantidade: 100, premio: 1 },
    ], acoes: null, montadaEm: null, precoNaMontagem: null } }))
    iniciar()
    await screen.findByTestId('aviso-sem-serie')
    expect(txt('aviso-sem-serie')).toMatch(/PETRZ999 não está na lista/)
    expect(txt('estrutura-identificada')).toBe('Compra de call') // só a perna que existe entra na análise
  })

  it('remover uma perna e limpar a posição', () => {
    iniciar()
    adicionar('Call', 'Comprei', 'PETRK600')
    adicionar('Call', 'Vendi', 'PETRK650')
    fireEvent.click(screen.getByRole('button', { name: 'Remover PETRK650' }))
    expect(txt('estrutura-identificada')).toBe('Compra de call')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar a posição' }))
    expect(screen.queryByTestId('posicao-hoje')).toBeNull()
    expect(screen.getByText(/Ainda não há nada cadastrado/)).toBeDefined()
  })

  it('data e preço do ativo na montagem mostram quanto ele andou desde então', () => {
    iniciar()
    adicionar('Call', 'Comprei', 'PETRK600')
    fireEvent.change(screen.getByLabelText('Data da montagem'), { target: { value: '2026-10-09' } })
    digitar('Preço do ativo na montagem (opcional)', '55')
    expect(txt('desde-montagem')).toMatch(/Montada em 09\/10\/2026/)
    expect(txt('desde-montagem')).toMatch(/de R\$ 55,00 para R\$ 60,00 \(\+9,1%\)/)
  })

  it('cada ativo tem a sua posição, e o botão voltar do navegador sai da aba', async () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    expect(window.history.state).toEqual({ opcoesAba: 'posicao' })
    window.history.back()
    await screen.findByText(/séries de PETR4, de um total de/)
    expect(screen.queryByTestId('posicao-intro')).toBeNull()
  })

  it('traz o manejo (cenários, desmontagem e rolagem) para simular com mais liberdade', () => {
    iniciar()
    adicionar('Put', 'Vendi', 'PETRW600')
    const bloco = screen.getByTestId('posicao-manejo')
    expect(bloco.tagName).toBe('DETAILS')
    expect(within(bloco).getByTestId('cenarios')).toBeDefined()
  })
})
