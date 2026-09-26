import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Aprender } from '../screens/Aprender'
import { SimuleFii } from '../screens/SimuleFii'
import { TabBar } from './TabBar'
import { CHAVE_LIVRO_LIBERADO, URL_LIVRO_PDF } from './MateriaisExtras'
import type { AppCtx } from '../state/useAppState'

const ctx = { screen: 'aprender', setScreen: vi.fn(), abrirTrilha: vi.fn() } as unknown as AppCtx

beforeEach(() => {
  localStorage.clear()
})

describe('Aprender — botões que vieram da landing', () => {
  it('D22: sem link para o curso da Udemy nem link patrocinado', () => {
    const { container } = render(<Aprender ctx={ctx} />)
    expect(screen.queryByText(/Candlesticks/)).toBeNull()
    expect(container.querySelector('a[href*="udemy"]')).toBeNull()
    expect(container.querySelector('a[rel~="sponsored"]')).toBeNull()
  })

  it('livro bloqueado: abre o diálogo e só libera o download depois de "Já sigo o perfil"', async () => {
    const { container } = render(<Aprender ctx={ctx} />)
    fireEvent.click(screen.getByRole('button', { name: /Educação Financeira Infantil/ }))

    const dialogo = container.querySelector('dialog')!
    expect(dialogo.hasAttribute('open')).toBe(true)
    const baixar = screen.getByText('Baixar o livro (PDF)')
    expect(baixar.getAttribute('aria-disabled')).toBe('true')
    expect(baixar.getAttribute('href')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Já sigo o perfil' }))

    await waitFor(() => expect(screen.getByText('Baixar o livro (PDF)').getAttribute('href')).toBe(URL_LIVRO_PDF))
    expect(screen.getByText(/Obrigado por acompanhar/)).toBeDefined()
    expect(localStorage.getItem(CHAVE_LIVRO_LIBERADO)).toBe('1')
    // o botão da lista passa a baixar o PDF direto
    expect(screen.getByText('Livro liberado: toque para baixar')).toBeDefined()
  })

  it('reconhece a liberação feita antes na landing (mesma chave) e baixa direto, sem diálogo', async () => {
    localStorage.setItem(CHAVE_LIVRO_LIBERADO, '1')
    render(<Aprender ctx={ctx} />)
    const livro = await screen.findByRole('link', { name: /Educação Financeira Infantil/ })
    expect(livro.getAttribute('href')).toBe(URL_LIVRO_PDF)
    expect(livro.hasAttribute('download')).toBe(true)
  })

  it('fecha o diálogo pelo botão X', () => {
    const { container } = render(<Aprender ctx={ctx} />)
    fireEvent.click(screen.getByRole('button', { name: /Educação Financeira Infantil/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(container.querySelector('dialog')!.hasAttribute('open')).toBe(false)
  })
})

describe('Aprender e Simule FII fora da barra de abas', () => {
  it('as duas telas têm o link "← Início" para a landing e não mostram a barra de abas', () => {
    for (const tela of [<Aprender ctx={ctx} />, <SimuleFii ctx={ctx} snapshot={{ geradoEm: null, vigenciaIfix: null, fundos: [] }} />]) {
      const { container, unmount } = render(tela)
      expect(screen.getByRole('link', { name: '← Início' }).getAttribute('href')).toBe('../')
      expect(container.querySelector('.tabbar')).toBeNull()
      unmount()
    }
  })

  it('a barra de abas fica só com Perfil, Carteira e Simular', () => {
    render(<TabBar ctx={ctx} />)
    const rotulos = screen.getAllByRole('button').map((b) => b.textContent)
    expect(rotulos).toEqual(['🧭Perfil', '📊Carteira', '🧮Simular'])
  })
})
