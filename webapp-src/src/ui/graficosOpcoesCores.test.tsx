import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GraficoPayoff } from './GraficoPayoff'
import { GraficoPorStrike, MarcaDaLinha } from './GraficoPorStrike'

// Os gráficos de opções seguem o desenho e as cores do gráfico do Simule Tesouro Direto (GraficoJuros). A paleta e as classes de CSS
// são conferidas em graficosOpcoesCores.css.test.ts; aqui, que os componentes usam essas classes e variáveis, sem cor fixa.

describe('GraficoPorStrike usa o visual do Simule Tesouro', () => {
  const desenhar = () =>
    render(
      <GraficoPorStrike
        strikes={[8, 9, 10, 11, 12]}
        linhas={[
          { id: 'a', rotulo: '19/11 calls', cor: 'var(--grafico-selic)', valores: [1, 2, 3, 2, 1] },
          { id: 'b', rotulo: '19/11 puts', cor: 'var(--grafico-ipca)', valores: [1, 2, 3, 2, 1] },
          { id: 'c', rotulo: '18/12 calls', cor: 'var(--grafico-selic)', traco: '7 3.5', valores: [0, 1, 1, 1, 0] },
          { id: 'd', rotulo: '15/01 calls', cor: 'var(--grafico-selic)', traco: '0.1 4.5', espessura: 3, valores: [0, 1, 1, 1, 0] },
        ]}
        precoAtivo={10}
        formatarValor={String}
        descricao="teste"
      />,
    )
  const linhas = (c: HTMLElement) => [...c.querySelectorAll('path.grafico-juros-linha')]

  it('usa as classes do Tesouro e as variáveis de cor dele, sem cores fixas', () => {
    const { container } = desenhar()
    expect(container.querySelector('svg')!.getAttribute('class')).toBe('grafico-juros')
    expect(container.querySelectorAll('line.grafico-juros-grade').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('text.grafico-juros-eixo').length).toBeGreaterThan(0)
    expect(container.querySelector('line.grafico-juros-guia')).not.toBeNull()
    expect(linhas(container).map((p) => p.getAttribute('stroke'))).toEqual(['var(--grafico-selic)', 'var(--grafico-ipca)', 'var(--grafico-selic)', 'var(--grafico-selic)'])
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}\b/) // nenhuma cor hexadecimal fixa
  })

  it('o traço e a espessura de cada linha vêm da própria linha: cheio por padrão, e tracejado ou pontilhado quando pedido', () => {
    const { container } = desenhar()
    expect(linhas(container).map((p) => p.getAttribute('stroke-dasharray'))).toEqual([null, null, '7 3.5', '0.1 4.5'])
    expect(linhas(container).map((p) => p.getAttribute('stroke-width'))).toEqual(['2.2', '2.2', '2.2', '3'])
  })

  it('a leitura mostra, para cada linha, um trecho dela com a mesma cor, traço e espessura', () => {
    const { container, getByRole } = desenhar()
    fireEvent.keyDown(getByRole('img'), { key: 'Home' })
    const marcas = [...container.querySelectorAll('[data-testid="leitura-grafico"] svg line')]
    expect(marcas).toHaveLength(4)
    expect(marcas.map((m) => m.getAttribute('stroke'))).toEqual(['var(--grafico-selic)', 'var(--grafico-ipca)', 'var(--grafico-selic)', 'var(--grafico-selic)'])
    expect(marcas.map((m) => m.getAttribute('stroke-dasharray'))).toEqual([null, null, '7 3.5', '0.1 4.5'])
    expect(marcas[3].getAttribute('stroke-width')).toBe('3')
  })

  it('a marquinha avulsa da legenda é decorativa (escondida de leitor de tela) e leva a cor e o traço recebidos', () => {
    const { container } = render(<MarcaDaLinha cor="var(--grafico-selic)" traco="7 3.5" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    const linha = svg.querySelector('line')!
    expect(linha.getAttribute('stroke')).toBe('var(--grafico-selic)')
    expect(linha.getAttribute('stroke-dasharray')).toBe('7 3.5')
    expect(linha.getAttribute('stroke-width')).toBe('2.2') // padrão
  })
})

describe('GraficoPayoff usa o visual do Simule Tesouro', () => {
  const pontos = [8, 10, 12].map((s, i) => ({ s, v: [-100, 0, 200][i] }))

  it('linha do vencimento em âmbar, curva antes do vencimento em azul tracejado, lucro em verde e prejuízo em vermelho', () => {
    const { container } = render(
      <GraficoPayoff
        curvas={[
          { rotulo: 'No vencimento', pontos, principal: true },
          { rotulo: 'Hoje', pontos: pontos.map((p) => ({ ...p, v: p.v / 2 })) },
        ]}
        precoAtivo={10}
        equilibrios={[10]}
        descricao="teste"
      />,
    )
    const linhas = [...container.querySelectorAll('path.grafico-juros-linha')]
    expect(linhas.map((l) => l.getAttribute('stroke'))).toEqual(['var(--grafico-ipca)', 'var(--grafico-selic)'])
    expect(linhas[0].getAttribute('stroke-dasharray')).toBe('7 3.5')
    const preenchimentos = [...container.querySelectorAll('path[opacity]')].map((p) => p.getAttribute('fill'))
    expect(preenchimentos).toEqual(['var(--grafico-con)', 'var(--danger)'])
    expect(container.querySelector('line.grafico-juros-guia')).not.toBeNull()
    expect(container.querySelectorAll('text.grafico-juros-eixo').length).toBeGreaterThan(0)
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}\b/)
  })
})
