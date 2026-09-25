import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SimuleTesouro } from './SimuleTesouro'
import { prazoPorExtenso } from '../domain/simulaTesouro'
import type { AppCtx } from '../state/useAppState'
import type { SnapshotMercado, TituloTesouro } from '../domain/mercadoOficial'

const ctx = {} as AppCtx

const titulo = (p: Partial<TituloTesouro>): TituloTesouro => ({
  nome: 'Tesouro Selic 2029', tipo: 'Tesouro Selic', familia: 'Tesouro Selic', indexador: 'selic', tipoTaxa: 'agioSobreSelic',
  cupom: 'sem cupom', vencimento: '2029-03-01', aVenda: true, taxaCompra: 0.05, puCompra: 17500, taxaVenda: 0.06, puVenda: 17490, ...p,
})

function snapshot(extra: Partial<SnapshotMercado> = {}): SnapshotMercado {
  return {
    geradoEm: '2026-09-22T13:00:00Z',
    indicadores: { selicMeta: { nome: 'Selic meta', unidade: '% a.a.', codigoSgs: 432, data: '2026-09-24', valor: 15 } },
    derivados: {},
    focus: { data: '2026-09-19', ipca: { 2026: 4.8, 2027: 4, 2028: 3.6, 2029: 3.5 }, selic: { 2026: 14.75, 2027: 12.5, 2028: 10.5, 2029: 10 } },
    tesouro: {
      dataBase: '2026-09-21',
      titulos: [
        titulo({}),
        titulo({ nome: 'Tesouro Selic 2031', vencimento: '2031-03-01', taxaCompra: 0.09 }),
        titulo({ nome: 'Tesouro IPCA+ 2035', familia: 'Tesouro IPCA+', indexador: 'ipca', tipoTaxa: 'jurosReais', vencimento: '2035-05-15', taxaCompra: 7.45, puCompra: 2090 }),
        titulo({ nome: 'Tesouro IPCA+ 2029', familia: 'Tesouro IPCA+', indexador: 'ipca', tipoTaxa: 'jurosReais', vencimento: '2029-05-15', taxaCompra: 7.9, puCompra: 3200 }),
        titulo({ nome: 'Tesouro IPCA+ com Juros Semestrais 2040', familia: 'Tesouro IPCA+', indexador: 'ipca', tipoTaxa: 'jurosReais', cupom: 'semestral', vencimento: '2040-08-15', taxaCompra: 7.1 }),
        titulo({ nome: 'Tesouro Prefixado 2032', familia: 'Tesouro Prefixado', indexador: 'prefixado', tipoTaxa: 'nominal', vencimento: '2032-01-01', taxaCompra: 14.1, puCompra: 460 }),
      ],
    },
    ...extra,
  }
}

describe('SimuleTesouro', () => {
  it('sem dados, avisa e orienta a consultar o site oficial', () => {
    render(<SimuleTesouro ctx={ctx} snapshot={{ geradoEm: null, indicadores: {}, derivados: {}, tesouro: { dataBase: null, titulos: [] } }} />)
    expect(screen.getByText('As taxas do Tesouro ainda não foram carregadas.')).toBeTruthy()
  })

  it('abre no Selic, primeiro vencimento, R$ 5 mil, isento de custódia', () => {
    render(<SimuleTesouro ctx={ctx} snapshot={snapshot()} />)
    expect(screen.getByRole('button', { name: 'Selic' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Tesouro Selic 2029/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('isento')).toBeTruthy()
    expect(screen.getByText('Você recebe')).toBeTruthy()
    expect(screen.getByText(/em dinheiro de hoje/)).toBeTruthy()
    expect(screen.queryByText(/carteira de referência não muda/)).toBeNull()
  })

  it('troca para IPCA+: lista por vencimento, deixa os de juros semestrais fora do simulador e explica por quê', () => {
    render(<SimuleTesouro ctx={ctx} snapshot={snapshot()} />)
    fireEvent.click(screen.getByRole('button', { name: 'IPCA+' }))
    const grupo = within(screen.getByRole('group', { name: 'Títulos Tesouro IPCA+ à venda' }))
    expect(grupo.getAllByRole('button').map((b) => b.textContent?.slice(0, 18))).toEqual(['Tesouro IPCA+ 2029', 'Tesouro IPCA+ 2035'])
    expect(screen.getByText(/Também à venda, com juros semestrais/)).toBeTruthy()

    fireEvent.click(grupo.getByRole('button', { name: /Tesouro IPCA\+ 2035/ }))
    expect(screen.getByText(/Vence em 15\/05\/2035, daqui a 8 anos/)).toBeTruthy()
  })

  it('valor digitado abaixo do mínimo mostra o aviso', () => {
    render(<SimuleTesouro ctx={ctx} snapshot={snapshot()} />)
    fireEvent.change(screen.getByLabelText('Quanto você quer aplicar?'), { target: { value: '20' } })
    expect(screen.getByText(/abaixo do mínimo de compra/)).toBeTruthy()
  })

  it('sem o Boletim Focus, explica que a simulação ainda não está disponível', () => {
    render(<SimuleTesouro ctx={ctx} snapshot={snapshot({ focus: undefined })} />)
    expect(screen.getByText(/projeções de inflação e juros do Boletim Focus/)).toBeTruthy()
  })

  it('prazo por extenso', () => {
    expect(prazoPorExtenso(730)).toBe('2 anos')
    expect(prazoPorExtenso(487)).toBe('1 ano e 4 meses')
    expect(prazoPorExtenso(10)).toBe('menos de 1 mês')
  })
})
