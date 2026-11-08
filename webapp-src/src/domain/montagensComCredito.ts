import { DIAS_UTEIS_ANO, chanceDeExercicio, volatilidadeImplicita } from './simulaOpcoes'
import { diasUteis, tipoVencimento } from './opcoes'
import type { AtivoComOpcoes, SerieOpcao } from './opcoes'
import { DIAS_DO_MES, DIAS_UTEIS_MINIMOS, NEGOCIOS_MINIMOS, TAMANHO_DO_TOP } from './premios'

// Reversão de risco com crédito: compra uma opção e vende outra, no mesmo vencimento, recebendo para montar, com o ativo podendo
// andar para os dois lados (put abaixo e call acima do preço, as duas fora do dinheiro).
//  - Alta: vende a put e compra a call.
//  - Baixa: vende a call e compra a put.
// O ranking põe primeiro o maior retorno: crédito recebido sobre o strike da ponta vendida (o dinheiro que fica reservado na put;
// na call vendida, a referência do valor do ativo). Usa o último preço negociado de cada série.

export type DirecaoMontagem = 'alta' | 'baixa'

/** Margem mínima, em % do preço do ativo, para cada lado. */
export const MARGEM_MINIMA = 5

export interface LinhaMontagem {
  ativo: AtivoComOpcoes
  vencimento: string
  diasUteis: number
  direcao: DirecaoMontagem
  compra: SerieOpcao
  venda: SerieOpcao
  /** Prêmio recebido menos pago, por unidade. */
  saldo: number
  /** Crédito de um lote. */
  creditoLote: number
  /** Retorno (%) = saldo / strike da ponta vendida, até o vencimento. */
  retorno: number
  /** O mesmo retorno proporcional a 21 dias úteis (só para comparar prazos). */
  retornoMes: number
  /** Queda (%) até o strike da put e alta (%) até o da call. */
  margemQueda: number
  margemAlta: number
  /** Chance (%) de a ponta vendida ser exercida, pelo modelo. */
  chanceVenda: number | null
}

const r2 = (v: number) => Math.round(v * 100) / 100

/** Vencimentos em que algum ativo tem call e put, com o mínimo de dias úteis. */
export function vencimentosDeMontagem(ativos: AtivoComOpcoes[], hoje: string): string[] {
  const set = new Set<string>()
  for (const a of ativos) {
    const calls = new Set(a.series.filter((s) => s.tipo === 'call').map((s) => s.vencimento))
    for (const s of a.series) if (s.tipo === 'put' && calls.has(s.vencimento) && diasUteis(s.vencimento, hoje) >= DIAS_UTEIS_MINIMOS) set.add(s.vencimento)
  }
  return [...set].sort()
}

/** Primeiro vencimento mensal com pelo menos 10 dias úteis. */
export function vencimentoPadraoMontagem(vencimentos: string[], hoje: string): string {
  return vencimentos.find((v) => tipoVencimento(v) === 'mensal' && diasUteis(v, hoje) >= 10) ?? vencimentos[0] ?? ''
}

/** As melhores montagens do vencimento (uma por ativo, no máximo 15), do maior retorno para o menor. `r` é a taxa contínua. */
export function calcularTopMontagens(ativos: AtivoComOpcoes[], direcao: DirecaoMontagem, vencimento: string, hoje: string, r: number): LinhaMontagem[] {
  const du = diasUteis(vencimento, hoje)
  if (du < DIAS_UTEIS_MINIMOS) return []
  const melhores: LinhaMontagem[] = []

  for (const ativo of ativos) {
    const spot = ativo.cotacao
    if (!(spot > 0)) continue
    const doVenc = ativo.series.filter((s) => s.vencimento === vencimento && s.ultimo > 0 && s.negocios >= NEGOCIOS_MINIMOS)
    const calls = doVenc.filter((s) => s.tipo === 'call' && (s.strike / spot - 1) * 100 >= MARGEM_MINIMA)
    const puts = doVenc.filter((s) => s.tipo === 'put' && (1 - s.strike / spot) * 100 >= MARGEM_MINIMA)
    let melhor: LinhaMontagem | null = null
    for (const c of calls) {
      for (const p of puts) {
        const [compra, venda] = direcao === 'alta' ? [c, p] : [p, c]
        const saldo = r2(venda.ultimo - compra.ultimo)
        if (saldo < 0.01) continue
        const retorno = (saldo / venda.strike) * 100
        if (melhor && retorno <= melhor.retorno) continue
        melhor = {
          ativo, vencimento, diasUteis: du, direcao, compra, venda, saldo, creditoLote: r2(saldo * ativo.lote),
          retorno, retornoMes: retorno * (DIAS_DO_MES / du),
          margemQueda: r2((1 - p.strike / spot) * 100), margemAlta: r2((c.strike / spot - 1) * 100), chanceVenda: null,
        }
      }
    }
    if (melhor) melhores.push(melhor)
  }

  const t = du / DIAS_UTEIS_ANO
  return melhores
    .sort((a, b) => b.retorno - a.retorno || a.ativo.ticker.localeCompare(b.ativo.ticker))
    .slice(0, TAMANHO_DO_TOP)
    .map((l) => {
      const s = l.ativo.cotacao
      const sigma = volatilidadeImplicita({ tipo: l.venda.tipo, s, strike: l.venda.strike, t, r }, l.venda.ultimo)
      return {
        ...l, retorno: r2(l.retorno), retornoMes: r2(l.retornoMes),
        chanceVenda: sigma ? r2(chanceDeExercicio({ tipo: l.venda.tipo, s, strike: l.venda.strike, t, r, sigma }) * 100) : null,
      }
    })
}
