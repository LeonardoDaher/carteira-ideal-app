import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Aprender } from './Aprender'
import { AprenderVideo } from './AprenderVideo'
import { Trilha } from './Trilha'
import { TRILHAS } from '../data/trilhas'
import { TabBar } from '../ui/TabBar'
import type { AppCtx } from '../state/useAppState'

// Perfil, Carteira e Simular são do fluxo do questionário (só fazem sentido com o resultado pronto).
// Aprender (trilhas, aulas, livro) é outra área: não leva a barra. Antes, Trilha e Aula mostravam a
// barra e quem tocava em "Perfil" sem ter respondido caía numa tela vazia.
describe('Aprender fica fora da barra de abas', () => {
  it('a tela Aprender, cada Trilha e cada Aula não mostram a barra Perfil/Carteira/Simular', () => {
    const ctxBase = { setScreen: vi.fn(), abrirTrilha: vi.fn(), abrirAula: vi.fn(), voltarDaTrilha: vi.fn(), voltarDaAula: vi.fn() }

    const aprender = render(<Aprender ctx={{ ...ctxBase, screen: 'aprender' } as unknown as AppCtx} />)
    expect(aprender.container.querySelector('.tabbar')).toBeNull()
    aprender.unmount()

    for (const trilha of TRILHAS) {
      const t = render(<Trilha ctx={{ ...ctxBase, screen: 'trilha', trilhaSelecionadaId: trilha.id } as unknown as AppCtx} />)
      expect(t.container.querySelector('.tabbar'), `trilha ${trilha.id}`).toBeNull()
      t.unmount()

      const topico = trilha.topicos[0]
      const aula = topico.aulas[0]
      const a = render(
        <AprenderVideo
          ctx={{ ...ctxBase, screen: 'aprenderVideo', aulaAtualRef: { trilhaId: trilha.id, topicoId: topico.id, aulaId: aula.id } } as unknown as AppCtx}
        />,
      )
      expect(a.container.querySelector('.tabbar'), `aula ${trilha.id}/${aula.id}`).toBeNull()
      a.unmount()
    }
  })

  it('controle: a barra continua existindo para o fluxo do questionário', () => {
    const { container } = render(<TabBar ctx={{ screen: 'resultado', setScreen: vi.fn() } as unknown as AppCtx} />)
    expect(container.querySelector('.tabbar')).not.toBeNull()
  })
})
