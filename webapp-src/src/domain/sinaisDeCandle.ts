// Sinais de candle da análise técnica (D122): barra de ignição, barra elefante, barra ignorada, martelo, estrela cadente, engolfo
// e trap, sempre medidos contra a volatilidade (ATR de 14) e o volume da própria ação, com o gatilho (superação da máxima, na
// compra, ou perda da mínima, na venda), o stop (extremo oposto do candle) e a situação do sinal depois dos candles seguintes.
// Funções puras, sem rede nem relógio. Os limiares marcados como "provisório" são ponto de partida e devem ser calibrados com o
// histórico de 5 anos (docs/17-criterios-analise-grafica-farol.md). É leitura descritiva do passado, não recomendação (D19).

import type { Barra } from './analiseTecnica'
import { atrSerie } from './analiseTecnica'
import { bollinger, caixaDaBase, larguraDasBandas } from './niveisDoGrafico'

export type TipoDeSinal =
  | 'ignicao-alta'
  | 'ignicao-baixa'
  | 'elefante-alta'
  | 'elefante-baixa'
  | 'ignorada-compra'
  | 'ignorada-venda'
  | 'martelo'
  | 'estrela-cadente'
  | 'engolfo-alta'
  | 'engolfo-baixa'
  | 'trap-fundo'
  | 'trap-topo'
  | 'trap-banda-baixa'
  | 'trap-banda-alta'
  | 'rompimento-base'
  | 'rompimento-base-baixa'
  | 'gap-50-compra'
  | 'gap-50-venda'

export interface LimitesDeSinal {
  /** Corpo mínimo da barra de ignição, em ATRs. */
  corpoIgnicao: number
  /** Amplitude mínima da barra elefante, em ATRs; além disso, a maior dos últimos `janelaElefante` candles. */
  amplitudeElefante: number
  janelaElefante: number
  /** Volume mínimo, em múltiplos da média de 21 candles. */
  volumeMinimo: number
  /** Corpo mínimo da barra forte que antecede a barra ignorada, em ATRs, e amplitude máxima da ignorada. */
  corpoAntesDaIgnorada: number
  amplitudeMaxIgnorada: number
  /** Sombra mínima do martelo e da estrela cadente, em múltiplos do corpo, e amplitude mínima, em ATRs. */
  sombraSobreCorpo: number
  amplitudeMinimaMartelo: number
  /** Candles olhados para trás no contexto de tendência (martelo, engolfo) e no trap. */
  contexto: number
  janelaTrap: number
  /** O trap só conta se o candle foi além do extremo (ou da banda) por pelo menos esta fração do ATR. */
  profundidadeTrap: number
  /** Candles que o sinal fica valendo à espera do gatilho. */
  validade: number
  /** Base de consolidação: mínimo de candles, amplitude máxima (%) e folga do fechamento além do extremo (fração). */
  candlesBase: number
  amplitudeBasePct: number
  folgaRompimento: number
  /** Regra dos 50% do gap: tamanho mínimo do gap (%) e candles em que ele ainda vale. */
  gapMinimoPct: number
  janelaGap: number
}

export const LIMITES_PADRAO: LimitesDeSinal = {
  corpoIgnicao: 1.5,
  amplitudeElefante: 2,
  janelaElefante: 61,
  volumeMinimo: 1,
  corpoAntesDaIgnorada: 1,
  amplitudeMaxIgnorada: 0.8,
  sombraSobreCorpo: 2,
  amplitudeMinimaMartelo: 0.8,
  contexto: 5,
  janelaTrap: 15,
  profundidadeTrap: 0.25,
  validade: 5,
  candlesBase: 12,
  amplitudeBasePct: 12,
  folgaRompimento: 0.003,
  gapMinimoPct: 0.8,
  janelaGap: 15,
}

export type Situacao = 'aguardando' | 'acionado' | 'invalidado' | 'expirado'
export type FaixaDeStop = 'curto' | 'medio' | 'caro' | 'inviavel'

export interface SinalDeCandle {
  indice: number
  data: string
  tipo: TipoDeSinal
  rotulo: string
  /** Letra(s) curtas para o marcador no gráfico. */
  sigla: string
  lado: 'compra' | 'venda'
  /** Os números que fizeram o candle contar (corpo em ATRs, volume, sombra...). */
  explicacao: string
  gatilho: number
  stop: number
  /** Distância do gatilho ao stop, em % do gatilho. */
  stopPct: number
  faixaDoStop: FaixaDeStop
  situacao: Situacao
}

/** Régua de aceitação do stop (docs/17, item 45): até 5% curto, até 10% médio, até 17% caro, acima disso inviável para swing. */
export function faixaDoStop(pct: number): FaixaDeStop {
  return pct <= 5 ? 'curto' : pct <= 10 ? 'medio' : pct <= 17 ? 'caro' : 'inviavel'
}

const INFO: Record<TipoDeSinal, { rotulo: string; sigla: string; lado: 'compra' | 'venda' }> = {
  'ignicao-alta': { rotulo: 'Barra de ignição de alta', sigla: 'IG', lado: 'compra' },
  'ignicao-baixa': { rotulo: 'Barra de ignição de baixa', sigla: 'IG', lado: 'venda' },
  'elefante-alta': { rotulo: 'Barra elefante de alta', sigla: 'EL', lado: 'compra' },
  'elefante-baixa': { rotulo: 'Barra elefante de baixa', sigla: 'EL', lado: 'venda' },
  'ignorada-compra': { rotulo: 'Barra ignorada (compra)', sigla: 'BI', lado: 'compra' },
  'ignorada-venda': { rotulo: 'Barra ignorada (venda)', sigla: 'BI', lado: 'venda' },
  martelo: { rotulo: 'Martelo', sigla: 'MA', lado: 'compra' },
  'estrela-cadente': { rotulo: 'Estrela cadente', sigla: 'EC', lado: 'venda' },
  'engolfo-alta': { rotulo: 'Engolfo de alta', sigla: 'EG', lado: 'compra' },
  'engolfo-baixa': { rotulo: 'Engolfo de baixa', sigla: 'EG', lado: 'venda' },
  'trap-fundo': { rotulo: 'Trap de fundo', sigla: 'TR', lado: 'compra' },
  'trap-topo': { rotulo: 'Trap de topo', sigla: 'TR', lado: 'venda' },
  'trap-banda-baixa': { rotulo: 'Trap da banda inferior', sigla: 'TB', lado: 'compra' },
  'trap-banda-alta': { rotulo: 'Trap da banda superior', sigla: 'TB', lado: 'venda' },
  'rompimento-base': { rotulo: 'Rompimento de base (alta)', sigla: 'RB', lado: 'compra' },
  'rompimento-base-baixa': { rotulo: 'Rompimento de base (baixa)', sigla: 'RB', lado: 'venda' },
  'gap-50-compra': { rotulo: 'Reação nos 50% do gap de alta', sigla: 'G5', lado: 'compra' },
  'gap-50-venda': { rotulo: 'Rejeição nos 50% do gap de baixa', sigla: 'G5', lado: 'venda' },
}

const x = (v: number, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/**
 * Procura sinais de candle em todas as barras (a partir da 30ª, para ter ATR e média de volume) e devolve, em ordem de data, o que
 * foi encontrado, já com gatilho, stop e situação. Um mesmo candle pode ter mais de um sinal (ex.: ignição e trap de banda).
 */
export function sinaisDeCandle(barras: Barra[], limites: LimitesDeSinal = LIMITES_PADRAO): SinalDeCandle[] {
  const n = barras.length
  if (n < 35) return []
  const atr = atrSerie(barras, 14)
  const bandas = bollinger(barras.map((b) => b.fech), 21, 2)
  const abertura = (i: number) => barras[i].abe ?? (i > 0 ? barras[i - 1].fech : barras[i].fech)
  const mediaVolume = (i: number) => {
    let s = 0
    for (let j = i - 21; j < i; j++) s += barras[j].vol
    return s / 21
  }
  const larguras = larguraDasBandas(bandas)
  const saida: SinalDeCandle[] = []

  const registrar = (i: number, tipo: TipoDeSinal, explicacao: string) => {
    const info = INFO[tipo]
    const b = barras[i]
    const gatilho = info.lado === 'compra' ? b.max : b.min
    const stop = info.lado === 'compra' ? b.min : b.max
    const stopPct = (Math.abs(gatilho - stop) / gatilho) * 100
    let situacao: Situacao = i === n - 1 ? 'aguardando' : 'expirado'
    for (let j = i + 1; j < Math.min(n, i + 1 + limites.validade); j++) {
      const cruzouGatilho = info.lado === 'compra' ? barras[j].max > gatilho : barras[j].min < gatilho
      const cruzouStop = info.lado === 'compra' ? barras[j].min < stop : barras[j].max > stop
      if (cruzouGatilho) {
        situacao = 'acionado'
        break
      }
      if (cruzouStop) {
        situacao = 'invalidado'
        break
      }
      if (j === n - 1) situacao = 'aguardando'
    }
    saida.push({ indice: i, data: b.data, tipo, rotulo: info.rotulo, sigla: info.sigla, lado: info.lado, explicacao, gatilho, stop, stopPct, faixaDoStop: faixaDoStop(stopPct), situacao })
  }

  for (let i = 30; i < n; i++) {
    const a = atr[i - 1]
    if (a === null || a <= 0) continue
    const b = barras[i]
    const ab = abertura(i)
    const corpo = Math.abs(b.fech - ab)
    const amp = b.max - b.min
    const alta = b.fech > ab
    const baixa = b.fech < ab
    const volRel = mediaVolume(i) > 0 ? b.vol / mediaVolume(i) : 0
    const volOk = volRel >= limites.volumeMinimo
    const terco = amp > 0 ? (b.fech - b.min) / amp : 0.5

    // Barra elefante / ignição: a mesma ideia, a elefante é a de maior amplitude da janela.
    const ehElefante = amp >= limites.amplitudeElefante * a && amp >= Math.max(...barras.slice(Math.max(0, i - limites.janelaElefante + 1), i + 1).map((c) => c.max - c.min))
    if (corpo >= limites.corpoIgnicao * a && volOk) {
      const desc = `corpo de ${x(corpo / a)} ATR, volume ${x(volRel)}× a média de 21`
      if (alta && terco >= 2 / 3) registrar(i, ehElefante ? 'elefante-alta' : 'ignicao-alta', `${desc}, fechou no terço superior${ehElefante ? ` e é a maior barra dos últimos ${limites.janelaElefante} candles` : ''}`)
      else if (baixa && terco <= 1 / 3) registrar(i, ehElefante ? 'elefante-baixa' : 'ignicao-baixa', `${desc}, fechou no terço inferior${ehElefante ? ` e é a maior barra dos últimos ${limites.janelaElefante} candles` : ''}`)
    }

    // Barra ignorada: candle pequeno dentro da barra forte anterior, na direção dela.
    const ant = barras[i - 1]
    const abAnt = abertura(i - 1)
    const corpoAnt = Math.abs(ant.fech - abAnt)
    const dentro = b.max <= ant.max && b.min >= ant.min
    if (dentro && amp <= limites.amplitudeMaxIgnorada * a && corpoAnt >= limites.corpoAntesDaIgnorada * a) {
      if (ant.fech > abAnt) registrar(i, 'ignorada-compra', `candle de ${x(amp / a)} ATR dentro de uma barra de alta de ${x(corpoAnt / a)} ATR`)
      else if (ant.fech < abAnt) registrar(i, 'ignorada-venda', `candle de ${x(amp / a)} ATR dentro de uma barra de baixa de ${x(corpoAnt / a)} ATR`)
    }

    // Martelo e estrela cadente: sombra de pelo menos 2 corpos, amplitude relevante, volume e contexto de queda (ou alta) antes.
    const sombraInf = Math.min(ab, b.fech) - b.min
    const sombraSup = b.max - Math.max(ab, b.fech)
    const corpoMin = Math.max(corpo, amp * 0.05)
    const antes = barras[i - 1 - limites.contexto + 1]?.fech
    if (amp >= limites.amplitudeMinimaMartelo * a && volOk && antes !== undefined) {
      if (sombraInf >= limites.sombraSobreCorpo * corpoMin && terco >= 2 / 3 && ant.fech < antes) {
        registrar(i, 'martelo', `sombra inferior de ${x(sombraInf / corpoMin)} corpos, amplitude de ${x(amp / a)} ATR, volume ${x(volRel)}× a média, depois de queda`)
      } else if (sombraSup >= limites.sombraSobreCorpo * corpoMin && terco <= 1 / 3 && ant.fech > antes) {
        registrar(i, 'estrela-cadente', `sombra superior de ${x(sombraSup / corpoMin)} corpos, amplitude de ${x(amp / a)} ATR, volume ${x(volRel)}× a média, depois de alta`)
      }
    }

    // Engolfo: o corpo cobre o corpo anterior, de cor contrária, com volume maior que o do dia anterior.
    const topoAnt = Math.max(abAnt, ant.fech)
    const baseAnt = Math.min(abAnt, ant.fech)
    if (b.vol > ant.vol && amp >= 0.5 * a && antes !== undefined) {
      if (alta && ant.fech < abAnt && ab <= baseAnt && b.fech >= topoAnt && ant.fech < antes) registrar(i, 'engolfo-alta', `corpo de alta cobre o corpo de baixa anterior, volume ${x(b.vol / (ant.vol || 1))}× o do dia anterior, depois de queda`)
      else if (baixa && ant.fech > abAnt && ab >= topoAnt && b.fech <= baseAnt && ant.fech > antes) registrar(i, 'engolfo-baixa', `corpo de baixa cobre o corpo de alta anterior, volume ${x(b.vol / (ant.vol || 1))}× o do dia anterior, depois de alta`)
    }

    // Trap: fura o extremo dos últimos candles (ou a banda de Bollinger) e fecha de volta dentro.
    const janela = barras.slice(i - limites.janelaTrap, i)
    const fundoJanela = Math.min(...janela.map((c) => c.min))
    const topoJanela = Math.max(...janela.map((c) => c.max))
    const fundo = (limite: number) => b.min < limite - limites.profundidadeTrap * a && b.fech > limite && volOk
    const topo = (limite: number) => b.max > limite + limites.profundidadeTrap * a && b.fech < limite && volOk
    if (fundo(fundoJanela) && alta) registrar(i, 'trap-fundo', `mínima abaixo do fundo dos últimos ${limites.janelaTrap} candles (${x(fundoJanela, 2)}) e fechamento de volta acima`)
    else if (topo(topoJanela) && baixa) registrar(i, 'trap-topo', `máxima acima do topo dos últimos ${limites.janelaTrap} candles (${x(topoJanela, 2)}) e fechamento de volta abaixo`)
    const inf = bandas.inferior[i]
    const sup = bandas.superior[i]
    if (inf !== null && fundo(inf) && alta) registrar(i, 'trap-banda-baixa', `furou a banda inferior de Bollinger (${x(inf, 2)}) e fechou de volta dentro`)
    else if (sup !== null && topo(sup) && baixa) registrar(i, 'trap-banda-alta', `furou a banda superior de Bollinger (${x(sup, 2)}) e fechou de volta dentro`)
  }
  // Rompimento de base e regra dos 50% do gap: dependem de vários candles, não só do candle de sinal.
  for (let i = 30; i < n; i++) {
    const a = atr[i - 1]
    if (a === null || a <= 0) continue
    const b = barras[i]
    const ab = abertura(i)
    const amp = b.max - b.min
    const terco = amp > 0 ? (b.fech - b.min) / amp : 0.5
    const volRel = mediaVolume(i) > 0 ? b.vol / mediaVolume(i) : 0
    const volOk = volRel >= limites.volumeMinimo
    // Rompimento de base: o fechamento sai de uma consolidação que terminou no candle anterior, com volume e fechamento firme.
    const anteriores = barras.slice(i - limites.candlesBase, i)
    const topoRecente = Math.max(...anteriores.map((c) => c.max))
    const fundoRecente = Math.min(...anteriores.map((c) => c.min))
    const acima = b.fech > topoRecente * (1 + limites.folgaRompimento) && b.fech > ab && terco >= 2 / 3
    const abaixo = b.fech < fundoRecente * (1 - limites.folgaRompimento) && b.fech < ab && terco <= 1 / 3
    if ((acima || abaixo) && volOk) {
      const base = caixaDaBase(barras.slice(0, i), limites.candlesBase, 80, limites.amplitudeBasePct)
      if (base && base.indiceFim === i - 1) {
        const janela = larguras.slice(Math.max(0, i - 120), i).filter((v): v is number => v !== null)
        const ultima = larguras[i - 1]
        const estreitas = ultima !== null && janela.length >= 60 && janela.filter((v) => v < ultima).length / janela.length <= 0.2
        const desc = `base de ${base.candles} candles entre ${x(base.fundo, 2)} e ${x(base.topo, 2)}, volume ${x(volRel)}× a média${estreitas ? ', bandas de Bollinger estreitas antes do rompimento' : ''}`
        if (acima && b.fech > base.topo * (1 + limites.folgaRompimento)) registrar(i, 'rompimento-base', `fechou acima da ${desc}`)
        else if (abaixo && b.fech < base.fundo * (1 - limites.folgaRompimento)) registrar(i, 'rompimento-base-baixa', `fechou abaixo da ${desc}`)
      }
    }
    // Regra dos 50% do gap: depois de um gap de alta (ou de baixa), o preço volta ao meio do gap, de corpo a corpo, e reage.
    for (let g = i - 2; g >= Math.max(1, i - limites.janelaGap); g--) {
      const pre = barras[g - 1]
      const dia = barras[g]
      const corpoPre = [abertura(g - 1), pre.fech]
      const corpoDia = [abertura(g), dia.fech]
      const alto = dia.min > pre.max && ((dia.min - pre.max) / pre.max) * 100 >= limites.gapMinimoPct
      const baixo = dia.max < pre.min && ((pre.min - dia.max) / pre.min) * 100 >= limites.gapMinimoPct
      if (!alto && !baixo) continue
      const meio = alto ? (Math.max(...corpoPre) + Math.min(...corpoDia)) / 2 : (Math.min(...corpoPre) + Math.max(...corpoDia)) / 2
      const entre = barras.slice(g + 1, i)
      const jaTocou = alto ? entre.some((c) => c.min <= meio) : entre.some((c) => c.max >= meio)
      const gapFechou = alto ? entre.some((c) => c.min <= pre.max) : entre.some((c) => c.max >= pre.min)
      if (jaTocou || gapFechou) break
      if (alto && b.min <= meio && b.fech > meio && b.fech > ab) registrar(i, 'gap-50-compra', `gap de alta de ${dia.data.slice(8, 10)}/${dia.data.slice(5, 7)} (${x(((dia.min - pre.max) / pre.max) * 100)}%): o preço tocou o meio do gap, de corpo a corpo (${x(meio, 2)}), e fechou acima dele`)
      if (baixo && b.max >= meio && b.fech < meio && b.fech < ab) registrar(i, 'gap-50-venda', `gap de baixa de ${dia.data.slice(8, 10)}/${dia.data.slice(5, 7)} (${x(((pre.min - dia.max) / pre.min) * 100)}%): o preço tocou o meio do gap, de corpo a corpo (${x(meio, 2)}), e fechou abaixo dele`)
      break
    }
  }
  return saida.sort((p, q) => p.indice - q.indice)
}

/** O sinal mais recente que ainda vale (aguardando ou acionado nos últimos candles), para destacar o gatilho e o stop. */
export function sinalAtivo(sinais: SinalDeCandle[], total: number, folga = 3): SinalDeCandle | null {
  for (let k = sinais.length - 1; k >= 0; k--) {
    const s = sinais[k]
    if (total - 1 - s.indice > folga) return null
    if (s.situacao === 'aguardando' || s.situacao === 'acionado') return s
  }
  return null
}
