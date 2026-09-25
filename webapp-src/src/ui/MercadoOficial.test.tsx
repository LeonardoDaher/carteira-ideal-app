import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CenarioJuros } from './CenarioJuros'
import { TaxasTesouroHoje } from './TaxasTesouroHoje'
import type { SnapshotMercado, TituloTesouro } from '../domain/mercadoOficial'

const HOJE = new Date('2026-09-25T12:00:00Z')

const titulo = (p: Partial<TituloTesouro>): TituloTesouro => ({
  nome: 'Tesouro IPCA+ 2035', tipo: 'Tesouro IPCA+', familia: 'Tesouro IPCA+', indexador: 'ipca', tipoTaxa: 'jurosReais',
  cupom: 'sem cupom', vencimento: '2035-05-15', aVenda: true, taxaCompra: 7.45, puCompra: 2090, taxaVenda: 7.57, puVenda: 2070, ...p,
})

function snapshot(extra: Partial<SnapshotMercado> = {}): SnapshotMercado {
  return {
    geradoEm: '2026-09-22T13:00:00Z',
    indicadores: {
      selicMeta: { nome: 'Selic meta', unidade: '% a.a.', codigoSgs: 432, data: '2026-09-24', valor: 15 },
      cdi: { nome: 'CDI', unidade: '% a.a.', codigoSgs: 4389, data: '2026-09-24', valor: 14.9 },
      ipca12m: { nome: 'IPCA 12m', unidade: '%', codigoSgs: 13522, data: '2026-08-01', valor: 5.1 },
      dolarPtax: { nome: 'PTAX', unidade: 'R$', codigoSgs: 1, data: '2026-09-24', valor: 5.312 },
    },
    derivados: { jurosReaisExPost: { nome: 'x', unidade: '% a.a.', valor: 9.42 } },
    historico: {
      selicMeta: {
        nome: 'Selic meta', unidade: '% a.a.', degrau: true,
        pontos: [['1999-03-05', 45], ['2016-10-20', 14], ['2021-03-18', 2.75], ['2025-06-19', 15], ['2026-09-24', 15]],
      },
      ipca12m: { nome: 'IPCA 12m', unidade: '%', degrau: false, pontos: [['2026-07-01', 5.2], ['2026-08-01', 5.1]] },
    },
    tesouro: {
      dataBase: '2026-09-21',
      titulos: [
        titulo({ nome: 'Tesouro IPCA+ 2045', vencimento: '2045-05-15', taxaCompra: 7.05 }),
        titulo({}),
        titulo({ nome: 'Tesouro IPCA+ 2026', vencimento: '2026-08-15', aVenda: false, taxaCompra: null, puCompra: null }),
        titulo({ nome: 'Tesouro Selic 2029', familia: 'Tesouro Selic', indexador: 'selic', tipoTaxa: 'agioSobreSelic', taxaCompra: 0.05 }),
      ],
    },
    ...extra,
  }
}

describe('TaxasTesouroHoje', () => {
  it('lista só os títulos à venda da família, por vencimento, com a régua da taxa', () => {
    render(<TaxasTesouroHoje familia="Tesouro IPCA+" indexador="ipca" snapshot={snapshot()} hoje={HOJE} />)
    const nomes = screen.getAllByText(/^Tesouro IPCA\+ 20/).map((e) => e.textContent)
    expect(nomes).toEqual(['Tesouro IPCA+ 2035', 'Tesouro IPCA+ 2045'])
    expect(screen.getByText('IPCA + 7,45%')).toBeTruthy()
    expect(screen.queryByText('Tesouro Selic 2029')).toBeNull()
    expect(screen.getByText(/ganho acima da inflação/)).toBeTruthy()
    expect(screen.getByText(/não é indicação de compra/)).toBeTruthy()
  })

  it('sem dados, orienta a consultar o site oficial', () => {
    const vazio = snapshot({ tesouro: { dataBase: null, titulos: [] } })
    render(<TaxasTesouroHoje familia="Tesouro Prefixado" indexador="prefixado" snapshot={vazio} hoje={HOJE} />)
    expect(screen.getByText(/ainda não foram carregadas/)).toBeTruthy()
  })

  it('avisa quando as taxas estão defasadas', () => {
    render(<TaxasTesouroHoje familia="Tesouro IPCA+" indexador="ipca" snapshot={snapshot()} hoje={new Date('2026-10-20T12:00:00Z')} />)
    expect(screen.getByText(/podem estar desatualizadas/)).toBeTruthy()
  })
})

describe('CenarioJuros', () => {
  it('mostra os indicadores com a data da última decisão do Copom', () => {
    const { container } = render(<CenarioJuros snapshot={snapshot()} hoje={HOJE} />)
    const quadro = within(container.querySelector('dl') as HTMLElement)
    expect(quadro.getByText('Selic meta')).toBeTruthy()
    expect(quadro.getByText('desde 19/06/2025')).toBeTruthy()
    expect(quadro.getByText('até ago/2026')).toBeTruthy()
    expect(quadro.getByText('9,42%')).toBeTruthy()
    expect(screen.getByText(/não muda conforme esses números/)).toBeTruthy()
  })

  it('não aparece antes da primeira atualização', () => {
    const { container } = render(<CenarioJuros snapshot={{ geradoEm: null, indicadores: {}, derivados: {}, tesouro: { dataBase: null, titulos: [] } }} />)
    expect(container.innerHTML).toBe('')
  })

  it('gráfico: descreve o período, troca de período e lê meses pelo teclado', () => {
    const { container } = render(<CenarioJuros snapshot={snapshot()} hoje={HOJE} />)
    const leitura = () => within(container.querySelector('[aria-live]') as HTMLElement)
    const grafico = screen.getByRole('img')
    expect(grafico.getAttribute('aria-label')).toMatch(/atual 15,00%/)

    // Abre no último mês completo, já com o juro real
    expect(leitura().getByText('ago/2026')).toBeTruthy()
    expect(leitura().getByText('5,10%')).toBeTruthy()
    expect(leitura().getByText('Juro real', { exact: false })).toBeTruthy()

    // Um mês à frente: setembro, com o IPCA ainda não divulgado
    fireEvent.keyDown(grafico, { key: 'ArrowRight' })
    expect(leitura().getByText('set/2026')).toBeTruthy()
    expect(leitura().getByText('a divulgar')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Desde 1999' }))
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/máxima de 45,00% em mar\/1999/)
    fireEvent.keyDown(screen.getByRole('img'), { key: 'Home' })
    expect(leitura().getByText('mar/1999')).toBeTruthy()
    expect(leitura().getByText('45,00%')).toBeTruthy()
  })
})
