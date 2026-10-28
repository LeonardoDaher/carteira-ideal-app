// Auditoria de coerência (D125): roda o preço teto e a análise fundamentalista sobre TODAS as ações do cadastro, com os dados reais
// publicados, e exige que as duas abas nunca se contradigam. Se um dado novo quebrar uma regra, este teste aponta o código.
import { describe, expect, it } from 'vitest'
import fundamentosBruto from '../../public/dados/fundamentos.json?raw'
import { SNAPSHOT_ACOES } from '../data/snapshotAcoes'
import { SNAPSHOT_ACOES_DIVIDENDOS } from '../data/snapshotAcoesDividendos'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import { analisarFundamentos, premissasDaSelic } from './analiseFundamentalista'
import type { SnapshotFundamentos } from './analiseFundamentalista'
import { calcularPrecoTeto } from './precoTeto'
import type { PrecoTeto } from './precoTeto'

const fundamentos = JSON.parse(fundamentosBruto) as SnapshotFundamentos

function calcularTodas() {
  const precos = new Map<string, number>()
  for (const b of SNAPSHOT_ACOES.busca) precos.set(b.ticker, b.cotacao)
  for (const st of SNAPSHOT_ACOES.setores) for (const e of st.empresas) precos.set(e.ticker, e.cotacao)
  const ipca = SNAPSHOT_MERCADO.focus?.ipca ?? {}
  const anos = Object.keys(ipca).sort()
  const premissas = premissasDaSelic(SNAPSHOT_MERCADO.indicadores.selicMeta?.valor ?? null, anos.length ? (ipca[anos[anos.length - 1]] ?? null) : null)
  const todas = Object.values(fundamentos.empresas)
  const saida: { teto: PrecoTeto; categoria: string; criticos: number }[] = []
  for (const empresa of todas) {
    const preco = precos.get(empresa.ticker)
    if (preco === undefined) continue
    const dyB3 = SNAPSHOT_ACOES_DIVIDENDOS.dyPorTicker?.[empresa.ticker] ?? null
    const analise = analisarFundamentos({ empresa, precoDe: (t) => precos.get(t) ?? null, todas, premissas, dyB3 })
    if (!analise) continue
    saida.push({ teto: calcularPrecoTeto({ empresa, analise, preco, dyB3 }), categoria: analise.categoria, criticos: analise.alertas.filter((a) => a.gravidade === 'critico').length })
  }
  return saida
}

describe('coerência entre o preço teto e a análise fundamentalista, com todas as ações do cadastro', () => {
  const todas = calcularTodas()
  const lista = (f: (x: (typeof todas)[number]) => boolean) => todas.filter(f).map((x) => x.teto.ticker)

  it('avalia o cadastro inteiro (o teste não pode passar vazio)', () => {
    expect(todas.length).toBeGreaterThan(100)
  })

  it('verde só onde a fundamentalista diz "considerar entrada"', () => {
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && x.teto.recomendacaoFund !== 'considerar-entrada')).toEqual([])
  })

  it('verde nunca com preço acima do valor justo base, categoria "evitar" ou "pouco atrativa", ou alerta crítico', () => {
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && (x.teto.valorJustoBase === null || x.teto.preco > x.teto.valorJustoBase))).toEqual([])
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && (x.categoria === 'evitar' || x.categoria === 'pouco-atrativa'))).toEqual([])
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && x.criticos > 0)).toEqual([])
  })

  it('verde sempre com o preço dentro do teto do gatilho e sem objeção', () => {
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && (x.teto.tetoGatilho === null || x.teto.preco > x.teto.tetoGatilho))).toEqual([])
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && x.teto.objecoes.length > 0)).toEqual([])
  })

  it('"abaixo, mas sem aviso" sempre explica o motivo', () => {
    expect(lista((x) => x.teto.status === 'vetado' && x.teto.objecoes.length === 0)).toEqual([])
  })

  it('amarelo ("perto") nunca aparece onde a fundamentalista diz evitar ou reduzir exposição', () => {
    expect(lista((x) => x.teto.status === 'perto' && (x.teto.recomendacaoFund === 'evitar-novos' || x.teto.recomendacaoFund === 'reduzir-exposicao'))).toEqual([])
  })

  it('ação que a fundamentalista manda evitar ou reduzir nunca fica verde nem amarela', () => {
    expect(lista((x) => (x.teto.recomendacaoFund === 'evitar-novos' || x.teto.recomendacaoFund === 'reduzir-exposicao') && (x.teto.status === 'abaixo-do-teto' || x.teto.status === 'perto'))).toEqual([])
  })

  it('se a fundamentalista diz "considerar entrada" e o teto não acende, a mensagem explica a diferença', () => {
    expect(lista((x) => x.teto.recomendacaoFund === 'considerar-entrada' && x.teto.status !== 'abaixo-do-teto' && x.teto.status !== 'vetado' && !/duas concordam|sem teto|Nenhum dos dois/.test(x.teto.mensagem))).toEqual([])
  })
})

describe('"falta cair" nunca contradiz o estado do cartão', () => {
  const todas = calcularTodas()
  it('quem já está verde não tem "falta cair"; quem tem, está acima do alvo e a queda é positiva', () => {
    expect(todas.filter((x) => x.teto.status === 'abaixo-do-teto' && x.teto.entrada !== null).map((x) => x.teto.ticker)).toEqual([])
    expect(todas.filter((x) => x.teto.entrada && (x.teto.entrada.faltaCairPct <= 0 || x.teto.preco <= x.teto.entrada.alvo)).map((x) => x.teto.ticker)).toEqual([])
  })
})
