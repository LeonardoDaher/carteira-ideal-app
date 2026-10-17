import { diasUteis, montarLinha, tipoVencimento } from './opcoes'
import type { AtivoComOpcoes, SerieOpcao, SnapshotOpcoes } from './opcoes'
import { DIAS_UTEIS_ANO, chanceDeExercicio } from './simulaOpcoes'

// Top 15 dos maiores prêmios: rendimento do prêmio sobre o dinheiro que fica travado, para quem vende opção.
//
// Método (descritivo, sem recomendação):
//  - Put vendida: o dinheiro travado é o strike (é o que se paga se o ativo for entregue). Rendimento no prazo =
//    prêmio ÷ strike. Entram só puts com strike até o preço do ativo (fora ou no dinheiro): numa put dentro do dinheiro,
//    boa parte do preço é valor intrínseco e não prêmio de verdade.
//  - Call coberta: o dinheiro travado é o preço do ativo (que a pessoa já tem). Rendimento no prazo = prêmio ÷ preço.
//    Entram só calls com strike a partir do preço do ativo.
//  - Para comparar prazos diferentes, o rendimento é levado a 21 dias úteis (um mês) por regra de três simples, sem juros
//    compostos: composição inflaria as opções semanais.
//  - Risco ao lado de cada linha: colchão (quanto o ativo pode cair antes de dar prejuízo), chance de exercício pelo
//    modelo e volatilidade implícita. Prêmio alto costuma ser o mercado cobrando por risco alto.
//  - Comparar prêmio com risco: uma razão prêmio ÷ risco sempre favoreceria as opções perto do preço (o prêmio cai mais
//    rápido que o risco quando o strike se afasta). Por isso o risco é um LIMITE escolhido pela pessoa (chance máxima de
//    exercício), e o ranking compara os prêmios dentro dele: para a mesma chance de exercício, quem paga mais? Em geral
//    são os ativos mais voláteis, e a volatilidade implícita na linha mostra o risco do ativo que está por trás.
//  - O padrão compara só vencimentos mensais: levar 4 dias úteis a 21 por regra de três exagera o rendimento das semanais
//    (e o degrau de R$ 0,01 do preço pesa muito num prêmio de poucos centavos). Fixar o vencimento é comparar "banana com
//    banana"; as semanais continuam a um clique.
//  - Só séries que negociaram no último pregão, com negócios suficientes e pelo menos 3 dias úteis até o vencimento.
//    O preço é o do último negócio, e não o preço de compra e venda.

export type Operacao = 'putVendida' | 'callCoberta'
export type OrdemPremio = 'mes' | 'prazo'
export type FiltroVencimentos = 'todos' | 'mensais' | 'semanais'

export interface FiltroPremios {
  operacao: Operacao
  vencimentos: FiltroVencimentos
  ordem: OrdemPremio
  /** Chance máxima de exercício (%) aceita; null = sem limite de risco. */
  chanceMaxima: number | null
  /** Aceita séries com poucos negócios (a partir de 3), que podem ter preço pouco confiável. */
  poucoLiquidas: boolean
  /** Mostra só a melhor série de cada ativo. */
  umPorAtivo: boolean
}

export const FILTRO_PREMIOS_PADRAO: FiltroPremios = {
  operacao: 'putVendida', vencimentos: 'mensais', ordem: 'mes', chanceMaxima: 25, poucoLiquidas: false, umPorAtivo: true,
}

/** Limites de chance de exercício oferecidos na tela (null = sem limite). */
export const LIMITES_DE_CHANCE: (number | null)[] = [10, 15, 25, 40, null]

export const TAMANHO_DO_TOP = 15
export const DIAS_DO_MES = 21
export const DIAS_UTEIS_MINIMOS = 3
export const NEGOCIOS_MINIMOS = 10
export const NEGOCIOS_MINIMOS_FLEXIVEL = 3

export interface LinhaPremio {
  ativo: AtivoComOpcoes
  serie: SerieOpcao
  diasUteis: number
  /** Dinheiro travado por opção (strike na put, preço do ativo na call coberta). */
  capital: number
  /** Prêmio ÷ capital, em %, até o vencimento. */
  rendimentoPrazo: number
  /** O mesmo rendimento levado a 21 dias úteis, em %. */
  rendimentoMes: number
  /** Quanto o ativo pode cair (%) antes de a operação dar prejuízo no vencimento. */
  colchao: number
  /** Só na call coberta: ganho (%) se o ativo subir até o strike e for exercido, contando o prêmio. */
  ganhoSeExercida: number | null
  /** Chance de exercício pelo modelo, em %. */
  chanceExercicio: number
  volImplicita: number
}

const ARRED = (v: number, casas = 4) => Math.round(v * 10 ** casas) / 10 ** casas

/** Linha do ranking para uma série, ou null se ela não cabe nas regras do método. */
export function linhaDePremio(
  ativo: AtivoComOpcoes, serie: SerieOpcao, operacao: Operacao, hoje: string, jurosAnual: number,
): LinhaPremio | null {
  const du = diasUteis(serie.vencimento, hoje)
  if (du < DIAS_UTEIS_MINIMOS || !(serie.ultimo > 0) || !(ativo.cotacao > 0)) return null
  const put = operacao === 'putVendida'
  if (put ? serie.tipo !== 'put' || serie.strike > ativo.cotacao : serie.tipo !== 'call' || serie.strike < ativo.cotacao) return null

  const modelo = montarLinha(serie, ativo.cotacao, hoje, jurosAnual)
  if (modelo.volImplicita === null) return null
  const sigma = modelo.volImplicita / 100
  const r = Math.log(1 + jurosAnual / 100)
  const chance =
    chanceDeExercicio({ tipo: serie.tipo, s: ativo.cotacao, strike: serie.strike, t: du / DIAS_UTEIS_ANO, r, sigma }) * 100

  const capital = put ? serie.strike : ativo.cotacao
  const rendimentoPrazo = (serie.ultimo / capital) * 100
  const rendimentoMes = (rendimentoPrazo * DIAS_DO_MES) / du
  const colchao = put
    ? ((ativo.cotacao - (serie.strike - serie.ultimo)) / ativo.cotacao) * 100
    : (serie.ultimo / ativo.cotacao) * 100
  return {
    ativo,
    serie,
    diasUteis: du,
    capital,
    rendimentoPrazo: ARRED(rendimentoPrazo),
    rendimentoMes: ARRED(rendimentoMes),
    colchao: ARRED(colchao),
    ganhoSeExercida: put ? null : ARRED(((serie.strike - ativo.cotacao + serie.ultimo) / ativo.cotacao) * 100),
    chanceExercicio: ARRED(chance, 2),
    volImplicita: ARRED(modelo.volImplicita, 1),
  }
}

const CHAVE_DA_ORDEM = { mes: 'rendimentoMes', prazo: 'rendimentoPrazo' } as const

/**
 * O Top 15 de prêmios para o filtro dado. `snapshot` já deve vir só com os próximos 6 meses. Desempate pelo volume
 * negociado da série e depois pelo código, para a ordem ser sempre a mesma.
 */
export function calcularTopPremios(snapshot: SnapshotOpcoes, filtro: FiltroPremios, jurosAnual: number, tamanho = TAMANHO_DO_TOP): LinhaPremio[] {
  const hoje = snapshot.dataPregao
  if (!hoje) return []
  const minimoNegocios = filtro.poucoLiquidas ? NEGOCIOS_MINIMOS_FLEXIVEL : NEGOCIOS_MINIMOS
  const candidatas: LinhaPremio[] = []
  for (const ativo of snapshot.ativos) {
    for (const serie of ativo.series) {
      if (serie.dataUltimo !== hoje || serie.negocios < minimoNegocios) continue
      if (filtro.vencimentos !== 'todos' && tipoVencimento(serie.vencimento) !== (filtro.vencimentos === 'mensais' ? 'mensal' : 'semanal')) continue
      const linha = linhaDePremio(ativo, serie, filtro.operacao, hoje, jurosAnual)
      if (!linha) continue
      if (filtro.chanceMaxima !== null && linha.chanceExercicio > filtro.chanceMaxima) continue
      candidatas.push(linha)
    }
  }
  const chave = CHAVE_DA_ORDEM[filtro.ordem]
  candidatas.sort(
    (a, b) => b[chave] - a[chave] || b.serie.volume - a.serie.volume || a.serie.codigo.localeCompare(b.serie.codigo),
  )
  if (!filtro.umPorAtivo) return candidatas.slice(0, tamanho)
  const vistos = new Set<string>()
  const unicas: LinhaPremio[] = []
  for (const l of candidatas) {
    if (vistos.has(l.ativo.ticker)) continue
    vistos.add(l.ativo.ticker)
    unicas.push(l)
    if (unicas.length >= tamanho) break
  }
  return unicas
}
