// Rodador do backtest dos sinais de candle sobre o histórico de 5 anos (public/dados/acoes-historico). Fica desligado nos testes
// normais; para rodar: BACKTEST=1 BACKTEST_SAIDA=<arquivo.json> npx vitest run src/domain/backtestSinais.run.test.ts
// O relatório e as conclusões estão em docs/18-calibragem-dos-sinais.md.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import type { Barra } from './analiseTecnica'
import type { Operacao, Resumo } from './backtestSinais'
import { agrupar, resumir, simular } from './backtestSinais'
import { filtroDeContexto } from './leituraFarol'
import type { EntradaDaLeitura } from './leituraFarol'
import { linhasDeTendencia, valorDaLinha } from './linhasDeTendencia'
import { LIMITES_PADRAO, sinaisDeCandle } from './sinaisDeCandle'
import type { LimitesDeSinal } from './sinaisDeCandle'

const PASTA = join(process.cwd(), 'public', 'dados', 'acoes-historico')
const CORTE = '2024-07-01'
const periodo = (o: Operacao) => (o.dataEntrada < CORTE ? 'treino' : 'teste')

interface Op extends Operacao {
  ticker: string
  tipo: string
  filtros: Record<string, string>
}

function carregar(): { ticker: string; barras: Barra[] }[] {
  return readdirSync(PASTA)
    .filter((f) => /^[A-Z0-9]+.json$/.test(f))
    .map((f) => {
      const j = JSON.parse(readFileSync(join(PASTA, f), 'utf8')) as { ticker: string; barras: [string, number, number, number, number, number][] }
      return { ticker: j.ticker, barras: j.barras.map(([data, abe, max, min, fech, vol]) => ({ data, abe, max, min, fech, vol })) }
    })
    .filter((x) => x.barras.length > 300)
}

function contexto(barras: Barra[], i: number, lado: 'compra' | 'venda'): Record<string, string> {
  const e = { barras: barras.slice(0, i + 1), sinais: [], zonas: [], gaps: [], caixa: null, media200Semanas: null, tendenciaDiaria: 'consolidacao', tendenciaSemanal: 'consolidacao' } as EntradaDaLeitura
  const f = filtroDeContexto(e, lado)
  const resultado = Object.fromEntries(f.filter((x) => x.chave !== 'tendencia').map((x) => [x.chave, x.status])) as Record<string, string>
  // Linha de tendência a favor do trade (LTA na compra, LTB na venda), só com candles até o sinal: perto = o extremo do candle está a até 1,5% da reta.
  const recorte = barras.slice(Math.max(0, i - 300), i + 1)
  const l = linhasDeTendencia(recorte).find((x) => x.tipo === (lado === 'compra' ? 'LTA' : 'LTB') && !x.rompida)
  if (!l) resultado.linha = 'sem'
  else {
    const ref = valorDaLinha(l, recorte.length - 1)
    const b = recorte[recorte.length - 1]
    resultado.linha = Math.abs((lado === 'compra' ? b.min : b.max) - ref) / ref <= 0.015 ? 'perto' : 'longe'
  }
  return resultado
}

function operacoesDosSinais(dados: { ticker: string; barras: Barra[] }[], limites: LimitesDeSinal, comContexto: boolean): Op[] {
  const ops: Op[] = []
  for (const { ticker, barras } of dados) {
    for (const s of sinaisDeCandle(barras, limites)) {
      const o = simular(barras, s)
      if (o) ops.push({ ...o, ticker, tipo: s.tipo + (s.explicacao.includes('estreitas') ? '+estreitas' : ''), filtros: comContexto ? contexto(barras, s.indice, s.lado) : {} })
    }
  }
  return ops
}

/** Referência: todo candle vira "sinal" (gatilho na máxima e stop na mínima para compra; o contrário para venda). */
function referencia(dados: { ticker: string; barras: Barra[] }[]): Op[] {
  const ops: Op[] = []
  for (const { ticker, barras } of dados) {
    for (let i = 40; i < barras.length - 30; i++) {
      const b = barras[i]
      for (const lado of ['compra', 'venda'] as const) {
        const o = simular(barras, lado === 'compra' ? { indice: i, lado, gatilho: b.max, stop: b.min } : { indice: i, lado, gatilho: b.min, stop: b.max })
        if (o && o.riscoPct <= 10) ops.push({ ...o, ticker, tipo: 'referencia', filtros: {} })
      }
    }
  }
  return ops
}

const por = (ops: Op[], chave: (o: Op) => string) => {
  const g = agrupar(ops, chave)
  return Object.fromEntries(Object.entries(g).sort(([a], [b]) => a.localeCompare(b))) as Record<string, Resumo>
}

describe.skipIf(!process.env.BACKTEST)('backtest dos sinais de candle', () => {
  it('roda e grava o relatório', { timeout: 1_800_000 }, () => {
    const dados = carregar()
    const base = operacoesDosSinais(dados, LIMITES_PADRAO, true)
    const ref = referencia(dados)
    const relatorio: Record<string, unknown> = { acoes: dados.length, operacoes: base.length, referencia: resumir(ref) }
    relatorio.referenciaPorLadoEPeriodo = por(ref, (o) => `${o.lado}/${periodo(o)}`)
    relatorio.porTipoEPeriodo = por(base, (o) => `${o.tipo}/${periodo(o)}`)
    relatorio.porLadoEPeriodo = por(base, (o) => `${o.lado}/${periodo(o)}`)
    relatorio.porFaixaDeStop = por(base, (o) => `${o.lado}/${o.riscoPct <= 3 ? '1: até 3%' : o.riscoPct <= 5 ? '2: 3-5%' : o.riscoPct <= 10 ? '3: 5-10%' : '4: acima de 10%'}`)
    for (const chave of ['liquidez', 'esticada', 'exaustao', 'linha']) relatorio[`filtro_${chave}`] = por(base, (o) => `${o.lado}/${chave}=${o.filtros[chave]}/${periodo(o)}`)
    const sem = (nome: string, chave: keyof LimitesDeSinal, valores: number[], tipos: string[]) => {
      const saida: Record<string, Resumo> = {}
      for (const v of valores) {
        const ops = operacoesDosSinais(dados, { ...LIMITES_PADRAO, [chave]: v }, false).filter((o) => tipos.includes(o.tipo))
        for (const [k, r] of Object.entries(por(ops, (o) => `${nome}=${v}/${periodo(o)}`))) saida[k] = r
      }
      relatorio[`varredura_${nome}`] = saida
    }
    sem('corpoIgnicao', 'corpoIgnicao', [1, 1.5, 2, 2.5], ['ignicao-alta', 'ignicao-baixa'])
    sem('volumeMinimo', 'volumeMinimo', [0.8, 1, 1.5, 2], ['ignicao-alta', 'ignicao-baixa', 'elefante-alta', 'elefante-baixa'])
    sem('profundidadeTrap', 'profundidadeTrap', [0.1, 0.25, 0.5, 1], ['trap-fundo', 'trap-topo', 'trap-banda-baixa', 'trap-banda-alta'])
    sem('amplitudeElefante', 'amplitudeElefante', [1.5, 2, 2.5, 3], ['elefante-alta', 'elefante-baixa'])
    writeFileSync(process.env.BACKTEST_SAIDA ?? 'backtest.json', JSON.stringify(relatorio, null, 1))
  })
})
