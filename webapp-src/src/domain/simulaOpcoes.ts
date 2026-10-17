// Simulador de estratégias com opções (Simule Opções). Contas puras, sem rede.
//
// Convenções:
//  - Valores por unidade do ativo vezes `quantidade` (a quantidade é de opções, não de lotes).
//  - Payoff no vencimento = lucro/prejuízo líquido do prêmio. Corretagem, emolumentos, IR e margem ficam de fora.
//  - Black-Scholes (europeu, sem dividendos) para a curva "antes do vencimento" e para as gregas. Opções de ações na B3
//    são americanas; é uma aproximação didática, e o texto da tela diz isso.

export type TipoOpcao = 'call' | 'put'
export type Lado = 'compra' | 'venda'

export interface Perna {
  tipo: TipoOpcao
  lado: Lado
  strike: number
  /** Prêmio por unidade, em reais. */
  premio: number
  quantidade: number
}

/** Posição completa: opções mais, se houver, ações compradas ao `precoAcao` (venda coberta). */
export interface Posicao {
  pernas: Perna[]
  acoes: number
  precoAcao: number
}

export type EstrategiaId = 'compraCall' | 'compraPut' | 'vendaCoberta' | 'travaAlta' | 'travaBaixa'

export const ESTRATEGIAS: { id: EstrategiaId; titulo: string; descricao: string; doisStrikes: boolean }[] = [
  { id: 'compraCall', titulo: 'Compra de call', descricao: 'Aposta na alta. Perde no máximo o prêmio pago.', doisStrikes: false },
  { id: 'compraPut', titulo: 'Compra de put', descricao: 'Aposta na queda ou proteção. Perde no máximo o prêmio pago.', doisStrikes: false },
  { id: 'vendaCoberta', titulo: 'Venda coberta', descricao: 'Tem a ação e vende uma call: recebe o prêmio e limita a alta.', doisStrikes: false },
  { id: 'travaAlta', titulo: 'Trava de alta', descricao: 'Compra call de strike menor e vende call de strike maior: ganho e perda limitados.', doisStrikes: true },
  { id: 'travaBaixa', titulo: 'Trava de baixa', descricao: 'Compra put de strike maior e vende put de strike menor: ganho e perda limitados.', doisStrikes: true },
]

export interface EntradaEstrategia {
  estrategia: EstrategiaId
  /** Preço do ativo hoje; é o preço de compra das ações na venda coberta. */
  precoAtivo: number
  /** Nas estratégias de um strike só `strikeBaixo` e `premioBaixo` valem (ver `montarPosicao`). */
  strikeBaixo: number
  premioBaixo: number
  strikeAlto: number
  premioAlto: number
  quantidade: number
}

/**
 * Monta a posição. Nas estratégias de um strike, vale o "baixo" (strike e prêmio principais). Nas travas:
 * alta = compra a call do strike baixo e vende a do alto; baixa = compra a put do strike alto e vende a do baixo.
 */
export function montarPosicao(e: EntradaEstrategia): Posicao {
  const q = e.quantidade
  switch (e.estrategia) {
    case 'compraCall':
      return { pernas: [{ tipo: 'call', lado: 'compra', strike: e.strikeBaixo, premio: e.premioBaixo, quantidade: q }], acoes: 0, precoAcao: 0 }
    case 'compraPut':
      return { pernas: [{ tipo: 'put', lado: 'compra', strike: e.strikeBaixo, premio: e.premioBaixo, quantidade: q }], acoes: 0, precoAcao: 0 }
    case 'vendaCoberta':
      return { pernas: [{ tipo: 'call', lado: 'venda', strike: e.strikeBaixo, premio: e.premioBaixo, quantidade: q }], acoes: q, precoAcao: e.precoAtivo }
    case 'travaAlta':
      return {
        pernas: [
          { tipo: 'call', lado: 'compra', strike: e.strikeBaixo, premio: e.premioBaixo, quantidade: q },
          { tipo: 'call', lado: 'venda', strike: e.strikeAlto, premio: e.premioAlto, quantidade: q },
        ],
        acoes: 0,
        precoAcao: 0,
      }
    case 'travaBaixa':
      return {
        pernas: [
          { tipo: 'put', lado: 'compra', strike: e.strikeAlto, premio: e.premioAlto, quantidade: q },
          { tipo: 'put', lado: 'venda', strike: e.strikeBaixo, premio: e.premioBaixo, quantidade: q },
        ],
        acoes: 0,
        precoAcao: 0,
      }
  }
}

/** Motivo de a entrada não servir, ou null se está ok. */
export function validarEntrada(e: EntradaEstrategia): string | null {
  const info = ESTRATEGIAS.find((x) => x.id === e.estrategia)
  if (!(e.quantidade > 0)) return 'Informe a quantidade de opções.'
  if (!(e.strikeBaixo > 0)) return info?.doisStrikes ? 'Informe o strike menor.' : 'Informe o strike.'
  if (!(e.premioBaixo >= 0)) return 'O prêmio não pode ser negativo.'
  if (e.estrategia === 'vendaCoberta' && !(e.precoAtivo > 0)) return 'Informe o preço do ativo.'
  if (info?.doisStrikes) {
    if (!(e.strikeAlto > 0)) return 'Informe o strike maior.'
    if (!(e.strikeAlto > e.strikeBaixo)) return 'O strike maior precisa ser maior que o menor.'
    if (!(e.premioAlto >= 0)) return 'O prêmio não pode ser negativo.'
  }
  return null
}

const sinal = (l: Lado) => (l === 'compra' ? 1 : -1)
const valorIntrinseco = (tipo: TipoOpcao, strike: number, s: number) => (tipo === 'call' ? Math.max(s - strike, 0) : Math.max(strike - s, 0))

/** Lucro (+) ou prejuízo (−) da posição inteira, no vencimento, se o ativo estiver em `s`. */
export function resultadoNoVencimento(p: Posicao, s: number): number {
  let total = p.acoes * (s - p.precoAcao)
  for (const x of p.pernas) total += sinal(x.lado) * (valorIntrinseco(x.tipo, x.strike, s) - x.premio) * x.quantidade
  return total
}

/** Dinheiro que entra (+, crédito) ou sai (−, débito) ao montar as opções, sem contar as ações. */
export function custoDeMontagem(p: Posicao): number {
  return p.pernas.reduce((t, x) => t - sinal(x.lado) * x.premio * x.quantidade, 0)
}

export interface Analise {
  /** null = ganho sem limite. */
  ganhoMaximo: number | null
  /** Valor negativo ou zero; null = perda sem limite. */
  perdaMaxima: number | null
  /** Preços do ativo em que o resultado no vencimento é zero. */
  equilibrios: number[]
}

/**
 * Máximo, mínimo e pontos de equilíbrio. O resultado é linear por trechos, com quebras nos strikes; basta olhar
 * R$ 0, cada strike e a inclinação depois do maior strike (+ ganho sem limite, − perda sem limite).
 */
export function analisar(p: Posicao): Analise {
  const strikes = [...new Set(p.pernas.map((x) => x.strike))].sort((a, b) => a - b)
  const pontos = [0, ...strikes]
  const valores = pontos.map((s) => resultadoNoVencimento(p, s))
  const inclinacaoFinal = p.acoes + p.pernas.reduce((t, x) => t + (x.tipo === 'call' ? sinal(x.lado) * x.quantidade : 0), 0)
  const arred = (v: number) => Math.round(v * 100) / 100

  const ganhoMaximo = inclinacaoFinal > 1e-9 ? null : arred(Math.max(...valores))
  const perdaMaxima = inclinacaoFinal < -1e-9 ? null : arred(Math.min(...valores))

  const equilibrios: number[] = []
  for (let i = 0; i < pontos.length - 1; i++) {
    const [x0, x1, y0, y1] = [pontos[i], pontos[i + 1], valores[i], valores[i + 1]]
    if (y0 === 0 && x0 > 0) equilibrios.push(x0)
    if ((y0 < 0 && y1 > 0) || (y0 > 0 && y1 < 0)) equilibrios.push(x0 + ((0 - y0) * (x1 - x0)) / (y1 - y0))
  }
  const ultimo = pontos.length - 1
  if (valores[ultimo] === 0 && pontos[ultimo] > 0) equilibrios.push(pontos[ultimo])
  if (inclinacaoFinal !== 0) {
    const raiz = pontos[ultimo] - valores[ultimo] / inclinacaoFinal
    if (raiz > pontos[ultimo]) equilibrios.push(raiz)
  }
  const unicos = [...new Set(equilibrios.map((v) => Math.round(v * 100) / 100))].sort((a, b) => a - b)
  return { ganhoMaximo, perdaMaxima, equilibrios: unicos }
}

// ---------------------------------------------------------------------------------------
// Black-Scholes
// ---------------------------------------------------------------------------------------

/** Função de distribuição normal padrão (aproximação de Abramowitz e Stegun 26.2.17; erro < 7,5e-8). */
export function cdfNormal(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2)
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}
const pdfNormal = (x: number) => 0.3989422804014327 * Math.exp((-x * x) / 2)

export interface ParametrosBs {
  tipo: TipoOpcao
  /** Preço do ativo. */
  s: number
  strike: number
  /** Anos até o vencimento (dias corridos / 365). */
  t: number
  /** Juro anual contínuo (ex.: 0,14). */
  r: number
  /** Volatilidade anual (ex.: 0,35). */
  sigma: number
}

/** Preço teórico. Com t ou sigma zerados, vale o valor intrínseco. */
export function precoBs(x: ParametrosBs): number {
  const { tipo, s, strike: k, t, r, sigma } = x
  if (t <= 0 || sigma <= 0) return valorIntrinseco(tipo, k, s)
  const raiz = sigma * Math.sqrt(t)
  const d1 = (Math.log(s / k) + (r + (sigma * sigma) / 2) * t) / raiz
  const d2 = d1 - raiz
  const desconto = Math.exp(-r * t)
  return tipo === 'call' ? s * cdfNormal(d1) - k * desconto * cdfNormal(d2) : k * desconto * cdfNormal(-d2) - s * cdfNormal(-d1)
}

export interface Gregas {
  delta: number
  gama: number
  /** Variação do preço por dia corrido que passa. */
  teta: number
  /** Variação do preço para +1 ponto percentual de volatilidade. */
  vega: number
}

export function gregas(x: ParametrosBs): Gregas {
  const { tipo, s, strike: k, t, r, sigma } = x
  if (t <= 0 || sigma <= 0) {
    const dentro = tipo === 'call' ? s > k : s < k
    return { delta: dentro ? (tipo === 'call' ? 1 : -1) : 0, gama: 0, teta: 0, vega: 0 }
  }
  const raiz = sigma * Math.sqrt(t)
  const d1 = (Math.log(s / k) + (r + (sigma * sigma) / 2) * t) / raiz
  const d2 = d1 - raiz
  const desconto = Math.exp(-r * t)
  const delta = tipo === 'call' ? cdfNormal(d1) : cdfNormal(d1) - 1
  const gama = pdfNormal(d1) / (s * raiz)
  const vega = (s * pdfNormal(d1) * Math.sqrt(t)) / 100
  const termoVol = -(s * pdfNormal(d1) * sigma) / (2 * Math.sqrt(t))
  const tetaAno = tipo === 'call' ? termoVol - r * k * desconto * cdfNormal(d2) : termoVol + r * k * desconto * cdfNormal(-d2)
  return { delta, gama, teta: tetaAno / 365, vega }
}

/**
 * Volatilidade implícita por bisecção: a que faz o preço teórico igualar `premio`. Devolve null quando o prêmio
 * está abaixo do valor intrínseco descontado ou acima do máximo possível (sem volatilidade que explique).
 */
export function volatilidadeImplicita(base: Omit<ParametrosBs, 'sigma'>, premio: number): number | null {
  if (!(premio > 0) || !(base.t > 0)) return null
  let baixo = 0.01
  let alto = 5
  if (premio < precoBs({ ...base, sigma: baixo }) - 1e-9 || premio > precoBs({ ...base, sigma: alto }) + 1e-9) return null
  for (let i = 0; i < 80; i++) {
    const meio = (baixo + alto) / 2
    if (precoBs({ ...base, sigma: meio }) < premio) baixo = meio
    else alto = meio
  }
  return (baixo + alto) / 2
}

/** Parâmetros de tempo e mercado usados na curva "antes do vencimento" e nas gregas. */
export interface Mercado {
  /** Dias corridos até o vencimento. */
  dias: number
  r: number
  sigma: number
}

/** Valor da posição (lucro/prejuízo) se o ativo estiver em `s` daqui a `diasPassados` dias. */
export function resultadoAntesDoVencimento(p: Posicao, s: number, m: Mercado, diasPassados: number): number {
  const t = Math.max(m.dias - diasPassados, 0) / 365
  let total = p.acoes * (s - p.precoAcao)
  for (const x of p.pernas) {
    const valor = precoBs({ tipo: x.tipo, s, strike: x.strike, t, r: m.r, sigma: m.sigma })
    total += sinal(x.lado) * (valor - x.premio) * x.quantidade
  }
  return total
}

/** Gregas da posição inteira (ações contam como delta 1 cada). */
export function gregasDaPosicao(p: Posicao, s: number, m: Mercado, diasPassados = 0): Gregas {
  const t = Math.max(m.dias - diasPassados, 0) / 365
  const soma: Gregas = { delta: p.acoes, gama: 0, teta: 0, vega: 0 }
  for (const x of p.pernas) {
    const g = gregas({ tipo: x.tipo, s, strike: x.strike, t, r: m.r, sigma: m.sigma })
    const f = sinal(x.lado) * x.quantidade
    soma.delta += g.delta * f
    soma.gama += g.gama * f
    soma.teta += g.teta * f
    soma.vega += g.vega * f
  }
  return soma
}

export interface PontoCurva {
  s: number
  v: number
}

/** Faixa de preços para o gráfico: de 70% do menor a 130% do maior entre preço do ativo e strikes. */
export function faixaDoGrafico(p: Posicao, precoAtivo: number): { min: number; max: number } {
  const refs = [precoAtivo, ...p.pernas.map((x) => x.strike)].filter((v) => v > 0)
  return { min: Math.min(...refs) * 0.7, max: Math.max(...refs) * 1.3 }
}

export function curva(f: (s: number) => number, min: number, max: number, pontos = 81): PontoCurva[] {
  return Array.from({ length: pontos }, (_, i) => {
    const s = min + ((max - min) * i) / (pontos - 1)
    return { s, v: f(s) }
  })
}
