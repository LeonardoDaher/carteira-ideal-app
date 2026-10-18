import type { SerieOpcao } from './opcoes'
import {
  DIAS_UTEIS_ANO, precoBs, resultadoAntesDoVencimento, volatilidadeImplicita,
} from './simulaOpcoes'
import type { Perna, Posicao } from './simulaOpcoes'

/**
 * Manejo de uma estrutura montada: o que acontece se o mercado for contra, o que custa desmontar e como fica a posição depois
 * de rolar pernas para outro vencimento ou strike. Tudo a partir de uma data e um preço do ativo de CENÁRIO ("daqui a N dias
 * úteis, com o ativo em R$ X"), valorizando as opções pelo modelo de Black-Scholes com a volatilidade implícita do preço de
 * cada série hoje. É estimativa, e não previsão: serve para comparar caminhos.
 */

const sinal = (p: Perna) => (p.lado === 'compra' ? 1 : -1)

export interface PernaDaEstrutura {
  perna: Perna
  serie: SerieOpcao
}

export interface Cenario {
  /** Preço do ativo no cenário. */
  preco: number
  /** Dias úteis que passam até o cenário. */
  diasPassados: number
}

export interface ParametrosDeManejo {
  /** Preço do ativo hoje (de onde sai a volatilidade implícita de cada série). */
  precoHoje: number
  /** Juro anual contínuo. */
  r: number
  /** Volatilidade usada onde não há implícita (ex.: 0,35). */
  sigmaPadrao: number
}

/** Volatilidade da perna: a que ela já traz (`perna.sigma`) ou a implícita do preço pago hoje; sem solução, a padrão. */
export function sigmaDaPerna(perna: Perna, dias: number, m: ParametrosDeManejo): number {
  if (perna.sigma && perna.sigma > 0) return perna.sigma // já calibrada (por exemplo, no preço de mercado de hoje)
  if (!(dias > 0)) return m.sigmaPadrao
  return volatilidadeImplicita({ tipo: perna.tipo, s: m.precoHoje, strike: perna.strike, t: dias / DIAS_UTEIS_ANO, r: m.r }, perna.premio) ?? m.sigmaPadrao
}

/** Dias úteis de cada perna (sem prazo próprio, `padrao`). */
const diasDe = (p: Perna, padrao: number) => p.dias ?? padrao

/** Preço de uma opção da perna no cenário, por unidade. */
export function valorNoCenario(perna: Perna, sigma: number, c: Cenario, m: ParametrosDeManejo, padrao: number): number {
  const t = Math.max(diasDe(perna, padrao) - c.diasPassados, 0) / DIAS_UTEIS_ANO
  return precoBs({ tipo: perna.tipo, s: c.preco, strike: perna.strike, t, r: m.r, sigma })
}

/** Resultado de encerrar a perna no cenário (recomprar a vendida, vender a comprada), em reais. */
export function resultadoDeEncerrar(perna: Perna, sigma: number, c: Cenario, m: ParametrosDeManejo, padrao: number): number {
  return sinal(perna) * (valorNoCenario(perna, sigma, c, m, padrao) - perna.premio) * perna.quantidade
}

export interface Desmontagem {
  /** Resultado de encerrar todas as opções (e vender as ações, se houver) no cenário. */
  total: number
  porPerna: { codigo: string; valor: number; resultado: number }[]
}

export function desmontar(pernas: PernaDaEstrutura[], base: { acoes: number; precoAcao: number }, c: Cenario, m: ParametrosDeManejo, padrao: number): Desmontagem {
  const porPerna = pernas.map(({ perna, serie }) => {
    const sigma = sigmaDaPerna(perna, diasDe(perna, padrao), m)
    return { codigo: serie.codigo, valor: valorNoCenario(perna, sigma, c, m, padrao), resultado: resultadoDeEncerrar(perna, sigma, c, m, padrao) }
  })
  const total = porPerna.reduce((t, x) => t + x.resultado, 0) + base.acoes * (c.preco - base.precoAcao)
  return { total, porPerna }
}

export interface Alvo {
  /** Índice da perna a rolar, em `pernas`. */
  indice: number
  /** Série para onde a perna vai (mesmo tipo, vencimento e strike novos). */
  nova: SerieOpcao
  /**
   * Preços de mercado por opção, quando já se conhecem (hoje, o último negócio): valem no lugar da estimativa por modelo para
   * encerrar a perna antiga e para abrir a nova. Sem eles, os dois preços são estimados no cenário.
   */
  precoDaAntiga?: number
  precoDaNova?: number
}

export interface DetalheDaRolagem {
  de: string
  para: string
  /** Dinheiro que sai (−) ou entra (+) para encerrar a perna antiga. */
  encerramento: number
  /** Dinheiro que sai (−) ou entra (+) para abrir a perna nova (preço estimado no cenário). */
  abertura: number
  /** Crédito (+) ou débito (−) líquido da troca. */
  liquido: number
  precoNovo: number
}

export interface ResultadoDaRolagem {
  /** Posição depois da rolagem, na data do cenário (prazos contados a partir dela; resultado já realizado em `realizado`). */
  posicao: Posicao
  detalhes: DetalheDaRolagem[]
  /** Soma dos créditos (+) e débitos (−) das trocas. */
  liquido: number
  /** Lucro ou prejuízo já realizado ao encerrar as pernas rolados (e as que venceram no caminho). */
  realizado: number
  /** Dias úteis até o primeiro vencimento depois da rolagem (null se não sobrou opção). */
  diasAteVencer: number | null
}

/**
 * Rola as pernas indicadas: encerra cada uma no cenário e abre a nova (mesmo lado e quantidade) pelo preço estimado nesse
 * cenário. As pernas que não rolam seguem, com o prazo que resta; as que já venceram até o cenário são encerradas pelo valor
 * intrínseco. `diasAte` converte um vencimento em dias úteis a partir de hoje.
 */
export function rolar(
  pernas: PernaDaEstrutura[],
  base: { acoes: number; precoAcao: number },
  alvos: Alvo[],
  c: Cenario,
  m: ParametrosDeManejo,
  diasAte: (vencimento: string) => number,
): ResultadoDaRolagem {
  const padrao = Math.min(...pernas.map((x) => diasDe(x.perna, 0)).filter((d) => d > 0), 21)
  const sigmas = pernas.map((x) => sigmaDaPerna(x.perna, diasDe(x.perna, padrao), m))
  const alvoDe = new Map(alvos.map((a) => [a.indice, a]))
  const detalhes: DetalheDaRolagem[] = []
  const novas: Perna[] = []
  let realizado = 0

  pernas.forEach(({ perna, serie }, i) => {
    const sigma = sigmas[i]
    const restam = diasDe(perna, padrao) - c.diasPassados
    const alvo = alvoDe.get(i)
    if (alvo) {
      const nova = alvo.nova
      const valorAntigo = alvo.precoDaAntiga ?? valorNoCenario(perna, sigma, c, m, padrao)
      realizado += sinal(perna) * (valorAntigo - perna.premio) * perna.quantidade
      const diasNova = Math.max(diasAte(nova.vencimento), 1)
      const proto: Perna = { tipo: perna.tipo, lado: perna.lado, strike: nova.strike, premio: nova.ultimo, quantidade: perna.quantidade, dias: diasNova }
      const sigmaNova = sigmaDaPerna(proto, diasNova, m)
      const precoNovo = alvo.precoDaNova ?? valorNoCenario(proto, sigmaNova, c, m, padrao)
      // Encerrar uma vendida custa o valor (recompra); encerrar uma comprada rende o valor (venda). Abrir é o contrário.
      const encerramento = sinal(perna) * valorAntigo * perna.quantidade
      const abertura = -sinal(perna) * precoNovo * perna.quantidade
      detalhes.push({ de: serie.codigo, para: nova.codigo, encerramento, abertura, liquido: encerramento + abertura, precoNovo })
      novas.push({ ...proto, premio: precoNovo, dias: Math.max(diasNova - c.diasPassados, 0), sigma: sigmaNova })
    } else if (restam > 0) {
      novas.push({ ...perna, dias: restam, sigma })
    } else {
      realizado += resultadoDeEncerrar(perna, sigma, c, m, padrao) // venceu no caminho
    }
  })

  const vivas = novas.filter((x) => (x.dias ?? 0) > 0)
  return {
    posicao: { pernas: novas, acoes: base.acoes, precoAcao: base.precoAcao, realizado },
    detalhes,
    liquido: detalhes.reduce((t, d) => t + d.liquido, 0),
    realizado,
    diasAteVencer: vivas.length ? Math.min(...vivas.map((x) => x.dias!)) : null,
  }
}

export interface LinhaDeCenario {
  /** Variação do ativo em relação ao preço de hoje (ex.: −0,1). */
  variacao: number
  preco: number
  /** Resultado da posição na data do primeiro vencimento (exato com um vencimento só, estimado com vários). */
  resultado: number
  /** Códigos das séries vendidas que ficam dentro do dinheiro (serão exercidas). */
  exercidas: string[]
}

/** Resultado da estrutura no primeiro vencimento para variações do ativo, e quais vendidas seriam exercidas. */
export function cenariosNoPrimeiroVencimento(
  pernas: PernaDaEstrutura[],
  base: { acoes: number; precoAcao: number },
  m: ParametrosDeManejo,
  variacoes: number[],
): LinhaDeCenario[] {
  const dias = pernas.map((x) => x.perna.dias ?? 0).filter((d) => d > 0)
  const horizonte = dias.length ? Math.min(...dias) : 0
  const posicao: Posicao = {
    pernas: pernas.map(({ perna }) => ({ ...perna, sigma: sigmaDaPerna(perna, perna.dias ?? horizonte, m) })),
    acoes: base.acoes,
    precoAcao: base.precoAcao,
  }
  const mercado = { dias: horizonte, r: m.r, sigma: m.sigmaPadrao }
  return variacoes.map((variacao) => {
    const preco = m.precoHoje * (1 + variacao)
    const exercidas = pernas
      .filter(({ perna, serie }) => perna.lado === 'venda' && (perna.dias ?? horizonte) <= horizonte && (serie.tipo === 'call' ? preco > serie.strike : preco < serie.strike))
      .map(({ serie }) => serie.codigo)
    return { variacao, preco, resultado: resultadoAntesDoVencimento(posicao, preco, mercado, horizonte), exercidas }
  })
}
