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

describe('preço teto com os dados reais: verde só por Bazin e Graham, fundamentalista como selo (D129)', () => {
  const todas = calcularTodas()
  const lista = (f: (x: (typeof todas)[number]) => boolean) => todas.filter(f).map((x) => x.teto.ticker)

  it('avalia o cadastro inteiro (o teste não pode passar vazio)', () => {
    expect(todas.length).toBeGreaterThan(100)
  })

  it('verde = preço dentro do teto do gatilho e, com Bazin como gatilho, dentro do teto de Graham quando ele se aplica', () => {
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && (x.teto.tetoGatilho === null || x.teto.preco > x.teto.tetoGatilho))).toEqual([])
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && x.teto.objecoes.length > 0)).toEqual([])
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && x.teto.gatilho === 'bazin' && x.teto.graham.aplicavel && x.teto.graham.teto !== null && x.teto.preco > x.teto.graham.teto)).toEqual([])
  })

  it('o que não é verde tem motivo: acima do teto, sem teto, ou Graham não confirma (com a objeção escrita)', () => {
    expect(lista((x) => x.teto.status === 'vetado' && x.teto.objecoes.length === 0)).toEqual([])
    expect(lista((x) => x.teto.status === 'vetado' && !(x.teto.tetoGatilho !== null && x.teto.preco <= x.teto.tetoGatilho))).toEqual([])
    expect(lista((x) => (x.teto.status === 'perto' || x.teto.status === 'aguardando') && (x.teto.tetoGatilho === null || x.teto.preco <= x.teto.tetoGatilho))).toEqual([])
  })

  it('todo item tem o selo da fundamentalista, coerente com a leitura dela: o selo "concorda" só com "considerar entrada" e sem alerta crítico', () => {
    expect(lista((x) => !['concorda', 'neutro', 'alerta'].includes(x.teto.selo.tipo) || !x.teto.selo.texto)).toEqual([])
    expect(lista((x) => x.teto.selo.tipo === 'concorda' && (x.teto.recomendacaoFund !== 'considerar-entrada' || x.criticos > 0))).toEqual([])
    expect(lista((x) => (x.teto.recomendacaoFund === 'evitar-novos' || x.teto.recomendacaoFund === 'reduzir-exposicao' || x.criticos > 0) && x.teto.selo.tipo !== 'alerta')).toEqual([])
    expect(lista((x) => x.teto.recomendacaoFund === 'considerar-entrada' && x.criticos === 0 && x.teto.selo.tipo !== 'concorda')).toEqual([])
  })

  it('"falta cair" só existe fora do verde, e a queda é positiva e vai até um teto menor que o preço', () => {
    expect(lista((x) => x.teto.status === 'abaixo-do-teto' && x.teto.entrada !== null)).toEqual([])
    expect(lista((x) => x.teto.entrada !== null && (x.teto.entrada.faltaCairPct <= 0 || x.teto.preco <= x.teto.entrada.alvo))).toEqual([])
  })
})
