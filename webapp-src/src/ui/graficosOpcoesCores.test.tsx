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
          { id: 'a', rotulo: '19/11 calls', cor: 'var(--grafico-v1)', valores: [1, 2, 3, 2, 1] },
          { id: 'b', rotulo: '19/11 puts', cor: 'var(--grafico-v1)', tracejada: true, valores: [1, 2, 3, 2, 1] },
          { id: 'c', rotulo: '18/12 calls', cor: 'var(--grafico-v2)', valores: [0, 1, 1, 1, 0] },
        ]}
        precoAtivo={10}
        formatarValor={String}
        descricao="teste"
      />,
    )

  it('usa as classes e as variáveis de cor do Tesouro, sem cores fixas', () => {
    const { container } = desenhar()
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('class')).toBe('grafico-juros')
    expect(container.querySelectorAll('line.grafico-juros-grade').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('text.grafico-juros-eixo').length).toBeGreaterThan(0)
    expect(container.querySelector('line.grafico-juros-guia')).not.toBeNull()
    const cores = [...container.querySelectorAll('path.grafico-juros-linha')].map((p) => p.getAttribute('stroke'))
    expect(cores).toEqual(['var(--grafico-v1)', 'var(--grafico-v1)', 'var(--grafico-v2)'])
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}\b/) // nenhuma cor hexadecimal fixa
  })

  it('as puts são tracejadas com o tracejado do Simule Imóvel (7 e 3,5), e as calls seguem em traço cheio', () => {
    const { container } = desenhar()
    const tracos = [...container.querySelectorAll('path.grafico-juros-linha')].map((p) => p.getAttribute('stroke-dasharray'))
    expect(tracos).toEqual([null, '7 3.5', null])
  })

  it('a leitura mostra, para cada linha, a marquinha do Tesouro na cor dela: cheia nas calls e tracejada nas puts', () => {
    const { container, getByRole } = desenhar()
    fireEvent.keyDown(getByRole('img'), { key: 'Home' })
    const marcas = [...container.querySelectorAll('.grafico-juros-marca')] as HTMLElement[]
    expect(marcas).toHaveLength(3)
    expect(marcas[0].style.background).toContain('var(--grafico-v1)') // call: barra cheia
    expect(marcas[0].style.width).toBe('') // largura padrão da classe (12px)
    expect(marcas[1].style.width).toBe('17px') // put: tracejada, um pouco mais larga para caberem os traços
    expect(marcas[2].style.background).toContain('var(--grafico-v2)')
  })

  it('a marquinha avulsa da legenda é decorativa (escondida de leitor de tela) e leva a cor recebida', () => {
    const { container } = render(<MarcaDaLinha cor="var(--grafico-selic)" />)
    const marca = container.querySelector('.grafico-juros-marca') as HTMLElement
    expect(marca.getAttribute('aria-hidden')).toBe('true')
    expect(marca.style.background).toContain('var(--grafico-selic)')
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
