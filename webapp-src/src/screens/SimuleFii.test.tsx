import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimuleFii } from './SimuleFii'
import type { AppCtx } from '../state/useAppState'
import type { SnapshotRendimentosFii } from '../domain/rendaFii'

const ctx = { screen: 'simuleFii', setScreen: vi.fn() } as unknown as AppCtx

const snapshot: SnapshotRendimentosFii = {
  geradoEm: '2026-09-20T12:00:00Z',
  vigenciaIfix: 'set a dez/2026',
  fundos: [
    {
      ticker: 'AAAA11',
      nome: 'FUNDO A',
      cotacao: 9.02,
      dataCotacao: '2026-09-19',
      rendimentos: [
        { competencia: '2026-07', valorPorCota: 0.1 },
        { competencia: '2026-06', valorPorCota: 0.08 },
        { competencia: '2026-05', valorPorCota: 0.09 },
      ],
    },
    {
      ticker: 'BBBB11',
      nome: 'FUNDO B',
      cotacao: 100,
      dataCotacao: '2026-09-19',
      rendimentos: [{ competencia: '2026-07', valorPorCota: 0.8 }],
    },
  ],
}

describe('SimuleFii', () => {
  it('mostra cotação, último rendimento e a tabela com investimento necessário', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText('AAAA11', { selector: '.font-display' })).toBeDefined()
    expect(screen.getByText('R$ 9,02')).toBeDefined()
    expect(screen.getByText('R$ 45.100,00')).toBeDefined() // 5.000 cotas
    expect(screen.getByText('R$ 500,00')).toBeDefined()
  })

  it('sempre exibe o aviso de atraso da CVM e o de rentabilidade passada', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText(/dados com atraso/i)).toBeDefined()
    expect(screen.getByText(/último rendimento exibido é de jul\/2026/i)).toBeDefined()
    expect(screen.getByText(/Rentabilidade obtida no passado não representa garantia/i)).toBeDefined()
  })

  it('mostra só o último rendimento, sem média nem seletor de base (decisão D10)', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.queryByRole('button', { name: /média/i })).toBeNull()
    expect(screen.queryByText(/média de/i)).toBeNull()
    expect(screen.getByText(/1,11%/)).toBeDefined() // 0,10 / 9,02
    // tabela calculada pelo último rendimento (0,10), não pela média dos meses (0,09)
    expect(screen.getByText('R$ 500,00')).toBeDefined()
    expect(screen.queryByText('R$ 450,00')).toBeNull()
  })

  it('explica no aviso que a estimativa se distorce em meses de emissão e fechamento de semestre', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    expect(screen.getByText(/emissão de cotas ou de fechamento de semestre/i)).toBeDefined()
  })

  it('troca de fundo pelos chips e calcula uma quantidade livre', () => {
    render(<SimuleFii ctx={ctx} snapshot={snapshot} />)
    fireEvent.click(screen.getByRole('button', { name: 'BBBB11' }))
    fireEvent.change(screen.getByLabelText('Outra quantidade de cotas'), { target: { value: '37' } })
    expect(screen.getByText('R$ 3.700,00')).toBeDefined() // 37 × R$ 100
    expect(screen.getByText('R$ 29,60')).toBeDefined() // 37 × R$ 0,80
  })

  it('orienta o usuário quando o job mensal ainda não rodou', () => {
    render(<SimuleFii ctx={ctx} snapshot={{ geradoEm: null, vigenciaIfix: null, fundos: [] }} />)
    expect(screen.getByText(/ainda não foram carregados/i)).toBeDefined()
    expect(screen.getByText(/dados com atraso/i)).toBeDefined()
  })
})

describe('SimuleFii: busca livre (D12)', () => {
  const amplo: SnapshotRendimentosFii = {
    ...snapshot,
    destaques: ['AAAA11'],
    fundos: [
      ...snapshot.fundos,
      {
        ticker: 'CCCC11',
        nome: 'FUNDO DE INVESTIMENTO IMOBILIÁRIO PÁTRIA LOGÍSTICA - RESPONSABILIDADE LIMITADA',
        cotacao: 50,
        dataCotacao: '2026-08-01',
        rendimentos: [{ competencia: '2026-07', valorPorCota: 0.4 }],
        confianca: 'baixa',
        motivosConfianca: ['pouca-negociacao'],
      },
    ],
    indisponiveis: [{ ticker: 'ZZZZ11', nome: 'FUNDO Z', motivo: 'rendimento-atipico' }],
  }
  const buscar = (texto: string) =>
    fireEvent.change(screen.getByLabelText(/buscar fundo imobiliário/i), { target: { value: texto } })

  it('arquivo antigo: mostra os destaques como botões e os demais só pela busca', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    expect(screen.getByRole('button', { name: 'AAAA11' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'CCCC11' })).toBeNull()
  })

  it('acha um fundo fora dos destaques pelo nome, sem acento, e abre a simulação', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('patria')
    fireEvent.click(screen.getByRole('button', { name: /CCCC11/ }))
    expect(screen.getByText('CCCC11', { selector: '.font-display' })).toBeDefined()
    expect(screen.getByText('R$ 2.000,00')).toBeDefined() // 5.000 cotas × R$ 0,40
    expect(screen.queryByRole('list', { name: /fundos encontrados/i })).toBeNull() // busca limpa
  })

  it('Enter escolhe o primeiro resultado', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('bbbb')
    fireEvent.keyDown(screen.getByLabelText(/buscar fundo imobiliário/i), { key: 'Enter' })
    expect(screen.getByText('BBBB11', { selector: '.font-display' })).toBeDefined()
  })

  it('avisa quando a estimativa do fundo é menos confiável', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('CCCC11')
    fireEvent.click(screen.getByRole('button', { name: /CCCC11/ }))
    expect(screen.getByText(/estimativa menos confiável/i)).toBeDefined()
    expect(screen.getByText(/quase não foi negociada/i)).toBeDefined()
  })

  it('explica por que um fundo conhecido está sem dados neste mês', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('zzzz')
    expect(screen.getByText(/ZZZZ11 está sem dados neste mês/)).toBeDefined()
    expect(screen.getByText(/variaram demais/)).toBeDefined()
  })

  it('fundo de rendimento variável aparece com o aviso próprio (caso VGIP11)', () => {
    const snap: SnapshotRendimentosFii = {
      ...amplo,
      fundos: [
        ...amplo.fundos,
        {
          ticker: 'VVVV11',
          nome: 'FUNDO IPCA',
          cotacao: 80,
          dataCotacao: '2026-09-19',
          rendimentos: [{ competencia: '2026-07', valorPorCota: 0.9 }],
          confianca: 'baixa',
          motivosConfianca: ['rendimento-variavel'],
        },
      ],
    }
    render(<SimuleFii ctx={ctx} snapshot={snap} />)
    buscar('VVVV')
    fireEvent.click(screen.getByRole('button', { name: /VVVV11/ }))
    expect(screen.getByText(/varia bastante de um mês para o outro/)).toBeDefined()
  })

  it('código certo com cadastro ambíguo na CVM não manda conferir o código', () => {
    const snap: SnapshotRendimentosFii = { ...amplo, indisponiveis: [{ ticker: 'AMBG11', nome: 'AMBG11', motivo: 'cadastro-ambiguo' }] }
    render(<SimuleFii ctx={ctx} snapshot={snap} />)
    buscar('AMBG11')
    expect(screen.getByText(/mais de um cadastro na CVM/)).toBeDefined()
    expect(screen.queryByText(/Confira o código/)).toBeNull()
  })

  it('fundo que não informa DY à CVM (caso VGIR11) recebe a explicação certa', () => {
    const snap: SnapshotRendimentosFii = { ...amplo, indisponiveis: [{ ticker: 'VGIR11', nome: 'VALORA CRI CDI FII', motivo: 'sem-dy-informado' }] }
    render(<SimuleFii ctx={ctx} snapshot={snap} />)
    buscar('vgir')
    expect(screen.getByText(/não informa à CVM o rendimento/)).toBeDefined()
    expect(screen.queryByText(/variaram demais/)).toBeNull()
  })

  it('orienta quando nada é encontrado', () => {
    render(<SimuleFii ctx={ctx} snapshot={amplo} />)
    buscar('QWER11')
    expect(screen.getByText(/Nenhum fundo encontrado para “QWER11”/)).toBeDefined()
  })
})

describe('SimuleFii: lista por liquidez e setor (D13)', () => {
  const fundo = (ticker: string, setor: string, volumeMedio: number | null, valorPorCota = 0.8) => ({
    ticker,
    nome: `FUNDO ${ticker}`,
    setor,
    volumeMedio,
    cotacao: 100,
    dataCotacao: '2026-09-19',
    rendimentos: [{ competencia: '2026-07', valorPorCota }],
  })
  const d13: SnapshotRendimentosFii = {
    geradoEm: '2026-09-20T12:00:00Z',
    volumeMinimoDiario: 1_000_000,
    fundos: [
      fundo('HGLG11', 'Logística', 9_000_000),
      fundo('BTLG11', 'Logística', 5_000_000),
      fundo('KNCR11', 'Papel (CRI)', 20_000_000),
      fundo('VGIP11', 'Papel (CRI)', 400_000, 0.9),
    ],
    indisponiveis: [],
  }

  it('mostra os fundos líquidos agrupados por setor e explica o critério', () => {
    render(<SimuleFii ctx={ctx} snapshot={d13} />)
    expect(screen.getByRole('group', { name: 'Fundos do setor Logística' })).toBeDefined()
    expect(screen.getByRole('group', { name: 'Fundos do setor Papel (CRI)' })).toBeDefined()
    expect(screen.getByText('Logística (2)')).toBeDefined()
    expect(screen.getByText(/mostra os 3 fundos negociados/)).toBeDefined()
    expect(screen.queryByRole('button', { name: 'VGIP11' })).toBeNull() // abaixo do corte: fora da lista
  })

  it('a busca alcança fundo abaixo do corte e o cartão avisa da liquidez', () => {
    render(<SimuleFii ctx={ctx} snapshot={d13} />)
    fireEvent.change(screen.getByLabelText(/buscar fundo imobiliário/i), { target: { value: 'vgip' } })
    expect(screen.getByText(/baixa liquidez/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /VGIP11/ }))
    expect(screen.getByText('VGIP11', { selector: '.font-display' })).toBeDefined()
    expect(screen.getByText(/Fora da lista por liquidez/)).toBeDefined()
    expect(screen.getByText(/negocia em média R\$ 400 mil por dia/)).toBeDefined()
    expect(screen.getByText('R$ 4.500,00')).toBeDefined() // 5.000 cotas × R$ 0,90
  })

  it('fundo da lista mostra setor e liquidez no cartão, sem aviso de liquidez', () => {
    render(<SimuleFii ctx={ctx} snapshot={d13} />)
    fireEvent.click(screen.getByRole('button', { name: 'KNCR11' }))
    expect(screen.getByText(/Papel \(CRI\), negocia R\$ 20 milhões por dia/)).toBeDefined()
    expect(screen.queryByText(/Fora da lista por liquidez/)).toBeNull()
  })
})
