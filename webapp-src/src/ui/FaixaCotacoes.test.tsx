import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { FaixaCotacoes, itensDeAcoes, itensDeEtfs } from './FaixaCotacoes'
import type { SnapshotAcoes } from '../domain/acoes'
import type { SnapshotEtfs } from '../domain/etfs'

const acoes = {
  dataPregao: '2026-10-16',
  setores: [
    {
      setor: 'Petróleo e gás',
      empresas: [
        { ticker: 'PETR4', nome: 'Petrobras', cotacao: 38.5, volumeMedio: 2e9, variacaoDia: 1.25 },
        { ticker: 'VALE3', nome: 'Vale', cotacao: 60, volumeMedio: 1e9, variacaoDia: -0.8 },
        { ticker: 'ITUB4', nome: 'Itaú', cotacao: 33, volumeMedio: 5e8 }, // arquivo antigo, sem variação do dia
      ],
    },
  ],
} as unknown as SnapshotAcoes

describe('FaixaCotacoes', () => {
  it('lista os mais negociados, com a variação do dia quando o arquivo traz', () => {
    expect(itensDeAcoes(acoes)).toEqual([
      { rotulo: 'PETR4', cotacao: 38.5, variacao: 1.25 },
      { rotulo: 'VALE3', cotacao: 60, variacao: -0.8 },
      { rotulo: 'ITUB4', cotacao: 33, variacao: null },
    ])
  })

  it('pinta de verde quem subiu e de vermelho quem caiu; sem variação, fica neutro', () => {
    const { container } = render(<FaixaCotacoes itens={itensDeAcoes(acoes)} dataPregao={acoes.dataPregao} />)
    // A faixa repete a lista (laço contínuo): só a primeira cópia é conferida.
    const primeira = container.querySelector('.faixa-cotacoes-lista') as HTMLElement
    const item = (codigo: string) => [...primeira.querySelectorAll('li')].find((li) => li.textContent?.includes(codigo)) as HTMLElement
    expect(item('PETR4').querySelector('.faixa-alta')?.textContent).toContain('1,25%')
    expect(item('VALE3').querySelector('.faixa-baixa')?.textContent).toContain('0,80%')
    expect(item('ITUB4').querySelector('.faixa-alta, .faixa-baixa')).toBeNull()
  })

  it('os ETFs também levam a variação do dia', () => {
    const etfs = { etfs: [{ ticker: 'BOVA11', cotacao: 130, volumeMedio: 1e9, variacaoDia: 0.4 }] } as unknown as SnapshotEtfs
    expect(itensDeEtfs(etfs)[0].variacao).toBe(0.4)
  })
})
