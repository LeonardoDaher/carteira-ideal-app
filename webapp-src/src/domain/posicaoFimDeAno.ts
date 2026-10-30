// Meus Ativos: a posição em 31/12 de um ano (quantidade, preço médio e custo de cada ativo), que é o que a
// declaração do IR pede em "Bens e Direitos". Derivada do livro de lançamentos, só com o que aconteceu até
// aquele dia. O custo inclui as taxas de compra, como no preço médio do resto do app.
//
// Módulo puro: sem rede, sem React, sem localStorage.
import { derivarPosicoes } from './lancamentos'
import type { Lancamento, PosicaoDerivada } from './lancamentos'

export interface PosicaoFimDeAno {
  ativo: string
  quantidade: number
  precoMedio: number
  /** Quantidade x preço médio: o valor de aquisição que vai na declaração. */
  custoTotal: number
}

/** Anos em que há lançamentos, do mais recente ao mais antigo. */
export function anosDosLancamentos(lancamentos: Lancamento[]): string[] {
  return [...new Set(lancamentos.map((l) => l.data.slice(0, 4)))].sort().reverse()
}

export function posicaoEm31Dez(lancamentos: Lancamento[], ano: string): { linhas: PosicaoFimDeAno[]; incompleto: string[] } {
  const ate = lancamentos.filter((l) => l.data <= `${ano}-12-31`)
  const { posicoes, avisos } = derivarPosicoes(ate)
  const linhas = posicoes
    .filter((p: PosicaoDerivada) => p.quantidade > 0)
    .map((p) => ({ ativo: p.ativo, quantidade: p.quantidade, precoMedio: p.precoMedio, custoTotal: p.custoTotal }))
  return { linhas, incompleto: [...new Set(avisos.filter((a) => a.tipo === 'vendaSemSaldo').map((a) => a.ativo))].sort() }
}

/** CSV para o Excel em português: ";" como separador, vírgula decimal e BOM. */
export function posicaoParaCsv(linhas: PosicaoFimDeAno[], ano: string): string {
  const n = (v: number, casas = 2) => v.toFixed(casas).replace('.', ',')
  const cab = ['Ativo', `Quantidade em 31/12/${ano}`, 'Preço médio (R$)', 'Custo total (R$)']
  const corpo = linhas.map((l) => [l.ativo, n(l.quantidade, 4).replace(/,?0+$/, ''), n(l.precoMedio, 4), n(l.custoTotal)])
  return `﻿${[cab, ...corpo].map((l) => l.join(';')).join('\r\n')}\r\n`
}
