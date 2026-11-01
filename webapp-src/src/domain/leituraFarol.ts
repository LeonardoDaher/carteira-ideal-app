// "Leitura Farol" (D131): junta o sinal de candle ativo (D130), as zonas e os níveis do gráfico (D121) num resumo por regra: setup,
// gatilho, stop, alvo, retorno/risco e os filtros que aprovam ou reprovam. Funções puras. Os limiares são provisórios e serão
// calibrados com o histórico de 5 anos (docs/18, D132). Descreve o que o preço fez; não é ordem nem recomendação.

import type { Barra, Leitura, ZonaPreco } from './analiseTecnica'
import { atrSerie } from './analiseTecnica'
import { mediaMovel } from './futuros'
import type { CaixaDaBase, GapAberto } from './niveisDoGrafico'
import { sinalAtivo } from './sinaisDeCandle'
import type { SinalDeCandle } from './sinaisDeCandle'

export type StatusDoFiltro = 'ok' | 'alerta' | 'reprova'

export interface FiltroFarol {
  chave: 'liquidez' | 'stop' | 'retorno-risco' | 'esticada' | 'exaustao' | 'tendencia'
  rotulo: string
  status: StatusDoFiltro
  motivo: string
}

export interface AlvoFarol {
  preco: number
  /** De onde veio o alvo, no estilo "resistência de 27,10 a 27,60". */
  origem: string
}

export interface LeituraFarol {
  /** Sinal de candle ativo (aguardando ou acionado), ou null: nesse caso a conclusão explica por que não há setup. */
  setup: SinalDeCandle | null
  alvo: AlvoFarol | null
  /** (alvo - gatilho) / (gatilho - stop), em módulo. null sem setup ou sem alvo. */
  retornoRisco: number | null
  filtros: FiltroFarol[]
  /** Há setup e nenhum filtro reprovou. */
  valido: boolean
  conclusao: string
  /** O que a leitura não consegue avaliar (calendário de balanços, regime do índice). */
  naoAvaliado: string[]
  /** O que o histórico de 5 anos mostrou sobre este tipo de sinal (docs/18); vazio sem setup. */
  ressalva: string
}

export interface EntradaDaLeitura {
  barras: Barra[]
  sinais: SinalDeCandle[]
  zonas: ZonaPreco[]
  gaps: GapAberto[]
  caixa: CaixaDaBase | null
  media200Semanas: number | null
  /** Leitura de tendência do diário e do semanal (da análise técnica). */
  tendenciaDiaria: Leitura
  tendenciaSemanal: Leitura
}

/** Limites provisórios (docs/17, itens 16, 25, 45, 47, 54). */
export const LIMITES_FAROL = {
  liquidezMinimaMil: 1000,
  esticadaAtr: 2.5,
  candlesDeExaustao: 11,
  retornoRiscoMinimo: 1,
}

const x = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Obstáculos e alvos candidatos no sentido do trade, do mais próximo ao mais distante do gatilho. */
function candidatos(e: EntradaDaLeitura, s: SinalDeCandle): AlvoFarol[] {
  const compra = s.lado === 'compra'
  const g = s.gatilho
  const lista: AlvoFarol[] = []
  for (const z of e.zonas) {
    if (compra && z.tipo === 'resistencia' && z.inferior > g) lista.push({ preco: z.inferior, origem: `resistência de ${x(z.inferior)} a ${x(z.superior)}` })
    if (!compra && z.tipo === 'suporte' && z.superior < g) lista.push({ preco: z.superior, origem: `suporte de ${x(z.inferior)} a ${x(z.superior)}` })
  }
  for (const gap of e.gaps) {
    if (compra && gap.tipo === 'baixa' && gap.inferior > g) lista.push({ preco: gap.inferior, origem: `gap de baixa de ${dm(gap.data)} (borda em ${x(gap.inferior)})` })
    if (!compra && gap.tipo === 'alta' && gap.superior < g) lista.push({ preco: gap.superior, origem: `gap de alta de ${dm(gap.data)} (borda em ${x(gap.superior)})` })
  }
  const m = e.media200Semanas
  if (m !== null) {
    if (compra && m > g) lista.push({ preco: m, origem: `média de 200 semanas (${x(m)})` })
    if (!compra && m < g) lista.push({ preco: m, origem: `média de 200 semanas (${x(m)})` })
  }
  const c = e.caixa
  if (c) {
    const altura = c.topo - c.fundo
    if (compra && c.rompeu === 'acima' && c.topo + altura > g) lista.push({ preco: c.topo + altura, origem: `altura da base (${x(c.fundo)} a ${x(c.topo)}) projetada do topo` })
    if (!compra && c.rompeu === 'abaixo' && c.fundo - altura < g) lista.push({ preco: c.fundo - altura, origem: `altura da base (${x(c.fundo)} a ${x(c.topo)}) projetada do fundo` })
  }
  return lista.sort((p, q) => (compra ? p.preco - q.preco : q.preco - p.preco))
}

export function filtroDeContexto(e: EntradaDaLeitura, lado: 'compra' | 'venda'): FiltroFarol[] {
  const { barras } = e
  const n = barras.length
  const filtros: FiltroFarol[] = []
  const ultima = barras[n - 1]

  // Liquidez: média do volume financeiro de 21 pregões (R$ mil por dia).
  const janelaVol = barras.slice(-21)
  const mediaVol = janelaVol.reduce((a, b) => a + b.vol, 0) / janelaVol.length
  filtros.push(
    mediaVol >= LIMITES_FAROL.liquidezMinimaMil
      ? { chave: 'liquidez', rotulo: 'Liquidez', status: 'ok', motivo: `média de R$ ${x(mediaVol / 1000, 1)} mi por dia nos últimos 21 pregões` }
      : { chave: 'liquidez', rotulo: 'Liquidez', status: 'reprova', motivo: `média de R$ ${x(mediaVol / 1000, 2)} mi por dia, abaixo de R$ 1 mi: swing sem liquidez` },
  )

  // Esticada: distância do fechamento à média de 21 em ATRs, ou fechamento fora da banda de Bollinger.
  const fech = barras.map((b) => b.fech)
  const meios = mediaMovel(fech, 21)
  const atr = atrSerie(barras, 14)
  const a = atr[n - 1]
  const meio = meios[n - 1]
  if (a && meio !== null) {
    const dist = (ultima.fech - meio) / a
    const contra = lado === 'compra' ? dist > LIMITES_FAROL.esticadaAtr : -dist > LIMITES_FAROL.esticadaAtr
    filtros.push(
      contra
        ? { chave: 'esticada', rotulo: 'Ação esticada', status: 'alerta', motivo: `${x(Math.abs(dist), 1)} ATR ${dist > 0 ? 'acima' : 'abaixo'} da média de 21 (no histórico de 5 anos não pior que as demais): retorno à média é o trade mais difícil` }
        : { chave: 'esticada', rotulo: 'Ação esticada', status: 'ok', motivo: `${x(Math.abs(dist), 1)} ATR ${dist >= 0 ? 'acima' : 'abaixo'} da média de 21` },
    )
  }

  // Exaustão: sequência de fechamentos na mesma direção.
  let seq = 0
  const sentido = lado === 'compra' ? 1 : -1
  for (let i = n - 1; i >= 1 && (barras[i].fech - barras[i - 1].fech) * sentido > 0; i--) seq++
  filtros.push(
    seq >= LIMITES_FAROL.candlesDeExaustao
      ? { chave: 'exaustao', rotulo: 'Exaustão', status: 'alerta', motivo: `${seq} fechamentos seguidos ${lado === 'compra' ? 'de alta' : 'de baixa'}: perto do limite da sequência (quase não ocorre com sinal ativo)` }
      : { chave: 'exaustao', rotulo: 'Exaustão', status: 'ok', motivo: `${seq} fechamentos seguidos na direção do trade` },
  )

  // Tendência a favor: seguir, não liderar.
  const contraTendencia = (l: Leitura) => (lado === 'compra' ? l === 'baixa' : l === 'alta')
  const quais = [contraTendencia(e.tendenciaDiaria) ? 'diária' : '', contraTendencia(e.tendenciaSemanal) ? 'semanal' : ''].filter(Boolean)
  filtros.push(
    quais.length
      ? { chave: 'tendencia', rotulo: 'Tendência', status: quais.length === 2 ? 'reprova' : 'alerta', motivo: `tendência ${quais.join(' e ')} contra o ${lado === 'compra' ? 'compra' : 'venda'}: estaria operando contra o movimento` }
      : { chave: 'tendencia', rotulo: 'Tendência', status: 'ok', motivo: 'sem tendência diária ou semanal contra o trade' },
  )
  return filtros
}

export function leituraFarol(e: EntradaDaLeitura): LeituraFarol {
  const ressalva = (lado: 'compra' | 'venda') =>
    lado === 'compra'
      ? 'Nos 5 anos de histórico (218 ações), os sinais de compra ficaram perto de zero em múltiplos de risco: melhores que entrar em qualquer candle, mas sem vantagem comprovada.'
      : 'Nos 5 anos de histórico (218 ações), os sinais de venda tiveram resultado médio negativo depois do stop: use como alerta de fraqueza, não como setup.'
  const naoAvaliado = ['risco de evento (balanço, eleição, juros): não há calendário no app', 'regime do índice: não entra neste cálculo']
  const n = e.barras.length
  if (n < 35) {
    return { setup: null, alvo: null, retornoRisco: null, filtros: [], valido: false, conclusao: 'Sem leitura: histórico curto demais para medir candles e volatilidade.', naoAvaliado, ressalva: '' }
  }
  const setup = sinalAtivo(e.sinais, n)

  if (!setup) {
    // Sem sinal, nada a fazer. Os filtros de contexto (nos dois sentidos) explicam o que pesa contra, se houver.
    const motivos = [...filtroDeContexto(e, 'compra').filter((f) => f.status !== 'ok' && f.chave !== 'tendencia'), ...filtroDeContexto(e, 'venda').filter((f) => f.status !== 'ok' && (f.chave === 'esticada' || f.chave === 'exaustao'))]
    const unicos = motivos.filter((f, i) => motivos.findIndex((g) => g.motivo === f.motivo) === i)
    const resto = unicos.length ? ` ${unicos.map((f) => f.motivo.charAt(0).toUpperCase() + f.motivo.slice(1)).join('; ')}.` : ''
    return { setup: null, alvo: null, retornoRisco: null, filtros: unicos, valido: false, conclusao: `Sem sinal: nenhum candle de sinal nos últimos 3 candles, então não há gatilho nem stop a medir.${resto}`, naoAvaliado, ressalva: '' }
  }

  const risco = Math.abs(setup.gatilho - setup.stop)
  const alvos = candidatos(e, setup)
  const alvo = alvos[0] ?? null
  const retornoRisco = alvo && risco > 0 ? Math.abs(alvo.preco - setup.gatilho) / risco : null

  const filtros = filtroDeContexto(e, setup.lado)
  const stopTxt = `${x(setup.stopPct, 1)}% do gatilho`
  filtros.splice(1, 0, {
    chave: 'stop',
    rotulo: 'Tamanho do stop',
    status: setup.faixaDoStop === 'curto' ? 'ok' : setup.faixaDoStop === 'medio' ? 'alerta' : setup.faixaDoStop === 'caro' ? (retornoRisco !== null && retornoRisco >= 1 ? 'alerta' : 'reprova') : 'reprova',
    motivo:
      setup.faixaDoStop === 'curto'
        ? `stop de ${stopTxt} (curto)`
        : setup.faixaDoStop === 'medio'
          ? `stop de ${stopTxt}: aceitável só se o candle de sinal for curto`
          : setup.faixaDoStop === 'caro'
            ? `stop de ${stopTxt} (caro): só vale se o alvo entregar o mesmo`
            : `stop de ${stopTxt}: grande demais para swing`,
  })
  filtros.splice(2, 0, {
    chave: 'retorno-risco',
    rotulo: 'Retorno/risco',
    status: retornoRisco === null ? 'alerta' : retornoRisco >= LIMITES_FAROL.retornoRiscoMinimo ? 'ok' : 'reprova',
    motivo:
      retornoRisco === null || !alvo
        ? 'sem resistência, gap ou nível à frente para medir o alvo'
        : retornoRisco >= LIMITES_FAROL.retornoRiscoMinimo
          ? `${x(retornoRisco, 1)} para 1 até o alvo (${alvo.origem})`
          : `só ${x(retornoRisco, 1)} para 1: ${alvo.origem} fica no caminho antes de 1 para 1`,
  })

  const reprovados = filtros.filter((f) => f.status === 'reprova')
  const valido = reprovados.length === 0
  const verbo = setup.lado === 'compra' ? 'superar' : 'perder'
  const base = `${setup.rotulo} de ${dm(setup.data)}, gatilho ao ${verbo} ${x(setup.gatilho)}, stop em ${x(setup.stop)} (${x(setup.stopPct, 1)}%)`
  const alvoTxt = alvo ? `, alvo em ${x(alvo.preco)} (${alvo.origem}), retorno/risco ${x(retornoRisco ?? 0, 1)}` : ', sem alvo técnico à frente'
  const acionado = setup.situacao === 'acionado' ? ' O gatilho já foi acionado.' : ''
  const conclusao = valido
    ? `Setup: ${base}${alvoTxt}.${acionado}`
    : `Sinal reprovado: ${base}${alvoTxt}. Reprovado em: ${reprovados.map((f) => f.rotulo.toLowerCase()).join(', ')}.${acionado}`
  return { setup, alvo, retornoRisco, filtros, valido, conclusao, naoAvaliado, ressalva: ressalva(setup.lado) }
}
