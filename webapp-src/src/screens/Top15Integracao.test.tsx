import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AppCtx } from '../state/useAppState'

// O arquivo de dados que o job grava com acesso por código: publicado, restrito, SEM lista.
vi.mock('../data/snapshotAcoesBaratas', () => ({
  SNAPSHOT_ACOES_BARATAS: {
    publicado: true, acessoRestrito: true, instagram: 'acarteiraideal', versaoMetodologia: '1.0.0', geradoEm: '2026-10-04T12:00:00Z',
    dataPrecos: '2026-10-02', dataCorte: '2026-10-02', pastaAuditoria: 'auditoria/acoes-baratas/2026-10-02', hashResultado: 'a'.repeat(64),
    hashInsumos: 'b'.repeat(64), hashConfig: 'c'.repeat(64), tamanhoDaLista: 15, universo: 150,
    parametros: { liquidezMinimaDiariaReais: 3_000_000, sessoesLiquidez: 21, percentilVolatilidadeExcluir: 90, sessoesVolatilidade: 252, metodoComposicao: 'ranks', componentes: [], setoresExcluidos: [] },
    qualidade: { roicMinimo: 0.1, aliquotaImpostoNopat: 0.34, dlEbitdaMaximo: 3, fcoPositivo: true, coberturaJurosMinima: 3, exerciciosConsistencia: 5, minimoComLucro: 4, minimoComFco: 4 },
    etapas: [], ranking: [], exclusoes: [],
  },
}))

import { SimuleAcoes } from './SimuleAcoes'

describe('Simule Ações inteiro, com o arquivo de dados no estado que o job grava (publicado + por código)', () => {
  it('abre o Top 15 e PEDE O CÓDIGO, sem nenhuma ação na tela', async () => {
    const ctx = { screen: 'simuleAcoes', setScreen: vi.fn() } as unknown as AppCtx
    render(<SimuleAcoes ctx={ctx} snapshot={{ geradoEm: null, dataPregao: null, setores: [], busca: [] }} />)
    fireEvent.click(screen.getByRole('tab', { name: /Rankings e triagens/ }))
    fireEvent.click(screen.getByRole('tab', { name: /Top 15 mais baratas/ }))
    expect(await screen.findByTestId('top15-codigo')).toBeTruthy()
    expect(screen.getByLabelText('Código do mês')).toBeTruthy()
    expect(screen.queryByTestId('top15-validacao')).toBeNull()
    expect(screen.queryByTestId('top15')).toBeNull()
  })
})
