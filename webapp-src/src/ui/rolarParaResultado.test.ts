import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rolarParaPainel, rolarParaResultado } from './rolarParaResultado'

/** Monta um cartão no DOM com o topo na posição pedida e a janela com a largura/altura pedidas. */
function preparar({ largura, altura, topo }: { largura: number; altura: number; topo: number }) {
  const cartao = document.createElement('div')
  cartao.id = 'cartao-teste'
  const rolar = vi.fn()
  cartao.scrollIntoView = rolar
  cartao.getBoundingClientRect = () => ({ top: topo, bottom: topo + 300, left: 0, right: 0, width: 0, height: 300, x: 0, y: topo, toJSON: () => ({}) })
  document.body.appendChild(cartao)
  Object.defineProperty(window, 'innerHeight', { value: altura, configurable: true })
  window.matchMedia = ((consulta: string) => ({
    matches: consulta.includes('min-width: 960px') ? largura >= 960 : false,
    media: consulta,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
  return rolar
}

const proximoQuadro = () => new Promise((r) => requestAnimationFrame(() => r(null)))

describe('rolarParaResultado', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('celular: sempre rola até o cartão', async () => {
    const rolar = preparar({ largura: 390, altura: 800, topo: 1500 })
    rolarParaResultado('cartao-teste')
    await proximoQuadro()
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('computador, notebook de janela baixa: o cartão ficou lá em cima (fora da janela), então rola até ele', async () => {
    const rolar = preparar({ largura: 1366, altura: 600, topo: -1800 })
    rolarParaResultado('cartao-teste')
    await proximoQuadro()
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('computador: cartão abaixo da janela também rola', async () => {
    const rolar = preparar({ largura: 1440, altura: 800, topo: 1200 })
    rolarParaResultado('cartao-teste')
    await proximoQuadro()
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('computador com o cartão fixo e à vista: não rola (sem pulo desnecessário)', async () => {
    const rolar = preparar({ largura: 1440, altura: 900, topo: 24 })
    rolarParaResultado('cartao-teste')
    await proximoQuadro()
    expect(rolar).not.toHaveBeenCalled()
  })

  it('computador: cartão com o topo colado no rodapé da janela (pouco visível) rola', async () => {
    const rolar = preparar({ largura: 1440, altura: 800, topo: 740 })
    rolarParaResultado('cartao-teste')
    await proximoQuadro()
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('opção soNoComputador: no celular não faz nada', async () => {
    const rolar = preparar({ largura: 390, altura: 800, topo: 1500 })
    rolarParaResultado('cartao-teste', { soNoComputador: true })
    await proximoQuadro()
    expect(rolar).not.toHaveBeenCalled()
  })

  it('opção soNoComputador: no computador rola quando o cartão está fora da janela', async () => {
    const rolar = preparar({ largura: 1280, altura: 700, topo: -900 })
    rolarParaResultado('cartao-teste', { soNoComputador: true })
    await proximoQuadro()
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('respeita "reduzir movimento" e ignora id inexistente', async () => {
    const rolar = preparar({ largura: 390, altura: 800, topo: 1500 })
    window.matchMedia = ((consulta: string) => ({ matches: consulta.includes('reduce'), media: consulta, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    rolarParaResultado('cartao-teste')
    rolarParaResultado('nao-existe')
    await proximoQuadro()
    expect(rolar).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })
})

describe('rolarParaPainel', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('rola até o painel da aba quando ele está abaixo da dobra', async () => {
    const painel = document.createElement('div')
    painel.id = 'painel-teste'
    const rolar = vi.fn()
    painel.scrollIntoView = rolar
    painel.getBoundingClientRect = () => ({ top: 900, bottom: 1500, left: 0, right: 0, width: 0, height: 600, x: 0, y: 900, toJSON: () => ({}) })
    document.body.appendChild(painel)
    window.matchMedia = (() => ({ matches: false, media: '', addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
    rolarParaPainel('painel-teste')
    await proximoQuadro()
    await proximoQuadro()
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('não mexe se o painel já está no topo da janela, nem se o id não existe', async () => {
    const painel = document.createElement('div')
    painel.id = 'painel-teste'
    const rolar = vi.fn()
    painel.scrollIntoView = rolar
    painel.getBoundingClientRect = () => ({ top: 3, bottom: 600, left: 0, right: 0, width: 0, height: 600, x: 0, y: 3, toJSON: () => ({}) })
    document.body.appendChild(painel)
    rolarParaPainel('painel-teste')
    rolarParaPainel('nao-existe')
    await proximoQuadro()
    await proximoQuadro()
    expect(rolar).not.toHaveBeenCalled()
  })
})
