import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnaliseDeIndice, dadosTecnicosDoIndice } from './AnaliseDeIndice'
import { analisarTecnica } from '../domain/analiseTecnica'
import type { HistoricoLongo } from '../domain/analiseTecnica'

/** Passeio determinístico em pontos de índice (sem aleatoriedade, para o teste não oscilar). */
function historico(codigo: string, n: number, base = 130000, vol = 0): HistoricoLongo {
  const barras: HistoricoLongo['barras'] = []
  let fech = base
  const inicio = Date.UTC(2025, 0, 2)
  for (let i = 0; i < n; i++) {
    const data = new Date(inicio + i * 86_400_000).toISOString().slice(0, 10)
    const abe = fech
    fech = Math.round(fech * (1 + Math.sin(i / 7) * 0.006 + 0.0006))
    barras.push([data, abe, Math.max(abe, fech) + 400, Math.min(abe, fech) - 400, fech, vol])
  }
  return { ticker: codigo, de: barras[0][0], ate: barras[n - 1][0], ajustes: [], saltosRestantes: [], barras }
}

describe('dadosTecnicosDoIndice', () => {
  it('calcula a leitura sobre os últimos 12 meses e deixa o histórico inteiro para o gráfico', () => {
    const longo = historico('IBOV', 400)
    const d = dadosTecnicosDoIndice(longo, 'IBOV', 'medio', { tipo: 'pronto', dados: longo })
    expect(d.tecnica).not.toBeNull()
    expect(d.barras).toHaveLength(260)
    expect(d.barrasDoGrafico).toHaveLength(400)
    expect(d.barrasDoGrafico?.[0].abe).toBe(longo.barras[0][1])
    expect(d.semSerie).toBeNull()
  })

  it('índice: sem nota de volume, sem penalidade de liquidez e textos em pontos', () => {
    const longo = historico('IBOV', 400)
    const t = dadosTecnicosDoIndice(longo, 'IBOV', 'medio', { tipo: 'pronto', dados: longo }).tecnica
    expect(t).not.toBeNull()
    expect(t!.pontuacao.componentes.map((c) => c.nome)).not.toContain('Volume e confirmação')
    expect(t!.volume.liquidez).toBe('alta')
    const textos = JSON.stringify(t)
    expect(textos).not.toMatch(/R\$/)
    expect(textos).not.toMatch(/Liquidez baixa\./)
    expect(t!.pontuacao.total).toBeGreaterThanOrEqual(0)
    expect(t!.pontuacao.total).toBeLessThanOrEqual(100)
  })

  it('ação continua em reais, com a nota de volume (nada mudou para as ações)', () => {
    const longo = historico('XXXX3', 400, 30, 5000)
    const pregoes = longo.barras.map((b) => b[0])
    const pontos = longo.barras.map((b) => [b[4], b[3], b[2], b[5]] as [number, number, number, number])
    const t = analisarTecnica({ ticker: 'XXXX3', pregoes, pontos, horizonte: 'medio' })
    expect(t!.pontuacao.componentes.map((c) => c.nome)).toContain('Volume e confirmação')
    expect(JSON.stringify(t)).toMatch(/R\$/)
  })

  it('com menos de 60 pregões não há leitura e diz o motivo', () => {
    const longo = historico('IFIX', 40, 3400)
    const d = dadosTecnicosDoIndice(longo, 'IFIX', 'medio', { tipo: 'pronto', dados: longo })
    expect(d.tecnica).toBeNull()
    expect(d.semSerie).toMatch(/IFIX tem 40 pregões/)
  })
})

describe('AnaliseDeIndice', () => {
  it('IBOV: mostra a análise em pontos, sem reais e sem o módulo de volume', () => {
    render(<AnaliseDeIndice codigo="IBOV" injetado={{ IBOV: historico('IBOV', 400) }} />)
    expect(screen.getByTestId('analise-tecnica')).toBeTruthy()
    expect(screen.getAllByText(/Ibovespa/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/pts/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Volume e liquidez')).toBeNull()
    expect(screen.queryByText(/R\$/)).toBeNull()
  })

  it('IFIX: mesma aba, com o nome do índice', () => {
    render(<AnaliseDeIndice codigo="IFIX" injetado={{ IFIX: historico('IFIX', 400, 3400) }} />)
    expect(screen.getByTestId('analise-tecnica')).toBeTruthy()
    expect(screen.getAllByText(/IFIX/).length).toBeGreaterThan(0)
  })

  it('sem arquivo do índice: avisa que ainda não foi carregado, sem inventar gráfico', () => {
    render(<AnaliseDeIndice codigo="IBOV" injetado={{}} />)
    expect(screen.getByText(/histórico do Ibovespa ainda não foi carregado/)).toBeTruthy()
    expect(screen.queryByTestId('analise-tecnica')).toBeNull()
  })

  it('histórico curto: análise indisponível com o motivo', () => {
    render(<AnaliseDeIndice codigo="IBOV" injetado={{ IBOV: historico('IBOV', 30) }} />)
    expect(screen.getByText(/Análise técnica indisponível para IBOV/)).toBeTruthy()
  })
})
