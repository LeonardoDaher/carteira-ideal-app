import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SuaHp12c } from './SuaHp12c'
import type { AppCtx } from '../state/useAppState'

const ctx = { screen: 'suaHp12c', setScreen: vi.fn() } as unknown as AppCtx

describe('SuaHp12c', () => {
  it('volta para o Simule Bens e não mostra a barra de abas', () => {
    const { container } = render(<SuaHp12c ctx={ctx} />)
    expect(screen.getByRole('link', { name: '← Simule Bens' }).getAttribute('href')).toBe('./?tela=simuleBens')
    expect(container.querySelector('.tabbar')).toBeNull()
  })

  it('o texto digitado vira o tema certo, com os campos preenchidos e o resultado', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.change(screen.getByLabelText('Qual é o seu problema?'), { target: { value: 'Qual o montante de 10 mil reais a 2% ao mês, juros compostos, por 12 meses?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }))
    expect((screen.getByLabelText('Tema da conta') as HTMLSelectElement).value).toBe('jurosCompostos')
    expect((screen.getByLabelText('Capital (R$)') as HTMLInputElement).value).toBe('10000')
    expect(screen.getByText('R$ 12.682,42')).toBeTruthy()
  })

  it('editar um campo recalcula o resultado', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.change(screen.getByLabelText('Tema da conta'), { target: { value: 'jurosSimples' } })
    fireEvent.change(screen.getByLabelText('Capital (R$)'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Taxa (%)'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Prazo (na mesma unidade da taxa)'), { target: { value: '2' } })
    expect(screen.getByText('R$ 1.200,00')).toBeTruthy()
  })

  it('avisa quando não entende o problema', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.change(screen.getByLabelText('Qual é o seu problema?'), { target: { value: 'bom dia, tudo bem?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }))
    expect(screen.getByRole('alert').textContent).toMatch(/Não identifiquei o tema/)
  })

  it('tocar numa questão do banco carrega o enunciado e resolve', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.click(screen.getByRole('button', { name: /Um empréstimo de R\$ 12\.000.*SAC/ }))
    expect((screen.getByLabelText('Qual é o seu problema?') as HTMLTextAreaElement).value).toMatch(/SAC/)
    expect(screen.getByRole('table')).toBeTruthy()
  })

  it('o filtro do banco mostra só as questões do assunto', () => {
    render(<SuaHp12c ctx={ctx} />)
    const filtro = screen.getByRole('group', { name: 'Filtrar questões por assunto' })
    fireEvent.click(within(filtro).getByRole('button', { name: 'Amortização' }))
    const questoes = screen.getAllByRole('button', { name: /Sistemas de amortização/ })
    expect(questoes.length).toBe(2)
    expect(screen.queryByRole('button', { name: /Juros simples.*capital de R\$ 10\.000/ })).toBeNull()
  })

  it('sem reconhecimento de voz no navegador, explica e mantém o campo de texto', () => {
    render(<SuaHp12c ctx={ctx} />)
    expect(screen.queryByRole('button', { name: /Falar o problema/ })).toBeNull()
    expect(screen.getByText(/não tem reconhecimento de voz/)).toBeTruthy()
  })
})

describe('SuaHp12c: calculadora HP-12C', () => {
  const apertar = (...nomes: string[]) => {
    for (const nome of nomes) fireEvent.click(screen.getByRole('button', { name: nome }))
  }

  it('a aba da calculadora mostra o teclado e calcula em RPN', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.click(screen.getByRole('tab', { name: /Calculadora HP-12C/ }))
    expect(screen.queryByLabelText('Qual é o seu problema?')).toBeNull()
    apertar('2', 'ENTER', '3', '+')
    expect(screen.getByTestId('visor-hp').textContent).toBe('5,00')
  })

  it('financia: n, i, PV (com CHS) e PMT dão a parcela', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.click(screen.getByRole('tab', { name: /Calculadora HP-12C/ }))
    apertar('3', '6', 'n', '1', '.', '5', 'i', '4', '0', '0', '0', '0', 'CHS', 'PV', 'PMT')
    expect(screen.getByTestId('visor-hp').textContent).toBe('1.446,10')
  })

  it('as teclas f e g acendem o aviso e a tecla sem função fica apagada', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.click(screen.getByRole('tab', { name: /Calculadora HP-12C/ }))
    expect((screen.getByRole('button', { name: 'R/S' }) as HTMLButtonElement).disabled).toBe(true)
    apertar('g')
    expect(screen.getByRole('button', { name: 'g' }).getAttribute('aria-pressed')).toBe('true')
    apertar('9', '÷')
    fireEvent.click(screen.getByRole('tab', { name: /Resolver problema/ }))
    expect(screen.getByLabelText('Qual é o seu problema?')).toBeTruthy()
  })

  it('o teclado do computador digita no visor', () => {
    render(<SuaHp12c ctx={ctx} />)
    fireEvent.click(screen.getByRole('tab', { name: /Calculadora HP-12C/ }))
    const calc = screen.getByRole('group', { name: 'Calculadora HP-12C' })
    for (const k of ['7', ',', '5']) fireEvent.keyDown(calc, { key: k })
    expect(screen.getByTestId('visor-hp').textContent).toBe('7,5')
    fireEvent.keyDown(calc, { key: 'Enter' })
    expect(screen.getByTestId('visor-hp').textContent).toBe('7,50')
  })
})
