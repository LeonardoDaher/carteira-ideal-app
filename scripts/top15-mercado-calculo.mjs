// Cálculo PURO dos rankings "Top 15 ETFs mais negociados" e "Top 15 BDRs com maior desconto de preço" (D70).
//
// Sem rede, sem arquivo, sem relógio: recebe os insumos (séries diárias de fechamento/mínima/máxima/volume do
// Boletim de Preços da B3, já guardadas em historico/etfs.json e historico/bdrs.json) e a configuração, e devolve
// o resultado. É o que a verificação independente recalcula. O que este módulo NÃO é: avaliação de valor.
//   - ETF "mais negociado" = MEDIANA do volume financeiro diário dos últimos 21 pregões (dia sem negócio conta zero).
//     É liquidez, não qualidade, custo nem preço baixo.
//   - BDR "maior desconto" = quanto o fechamento atual está abaixo do maior fechamento dos últimos 252 pregões.
//     É desconto de PREÇO (inclui o câmbio), não de valor da empresa: não há balanço de empresa estrangeira aqui.
//
// Série de cada ativo: lista alinhada com `insumos.pregoes` (a última posição é o último pregão); cada posição é
// null (sem negócio no dia) ou [fechamento, mínima, máxima, volume em R$].

import { canonico, sha256 } from './fii-baratos-calculo.mjs'

export { canonico, sha256 }

const arredondar = (v, casas = 2) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** casas) / 10 ** casas)

export function mediana(valores) {
  if (!valores.length) return 0
  const o = [...valores].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2
}

/** Hash do resultado inteiro (a ordem das chaves não importa). */
export function hashDoResultado(resultado) {
  return sha256(canonico(resultado))
}

/** Alinha a série à direita com `pregoes` (se vier mais curta, completa com null à esquerda). */
function alinhar(serie, n) {
  if (!Array.isArray(serie)) return new Array(n).fill(null)
  if (serie.length >= n) return serie.slice(serie.length - n)
  return [...new Array(n - serie.length).fill(null), ...serie]
}

/** Números de liquidez e cotação de um ativo na janela de `janela` pregões. */
export function numerosDeLiquidez(serie, pregoes, janela) {
  const fim = pregoes.length
  const w = serie.slice(fim - janela)
  const volumes = w.map((v) => (v ? v[3] : 0))
  let ultimo = -1
  for (let i = serie.length - 1; i >= 0; i--) if (serie[i]) { ultimo = i; break }
  const negociados = volumes.filter((v) => v > 0).length
  return {
    volumes,
    volumeMediano: Math.round(mediana(volumes)),
    volumeMedio: Math.round(volumes.reduce((s, v) => s + v, 0) / (volumes.length || 1)),
    diasNegociados: negociados,
    ultimo,
    pregoesDesdeUltimoNegocio: ultimo === -1 ? null : fim - 1 - ultimo,
    cotacao: ultimo === -1 ? null : arredondar(serie[ultimo][0]),
    dataCotacao: ultimo === -1 ? null : pregoes[ultimo],
  }
}

function variacao3m(serie, pregoes, ultimo, janela3m) {
  const alvo = pregoes.length - 1 - janela3m
  if (ultimo < 0 || alvo < 0) return null
  let base = null
  for (let i = alvo; i >= 0 && base === null; i--) if (serie[i]) base = serie[i][0]
  return base > 0 ? arredondar((serie[ultimo][0] / base - 1) * 100, 1) : null
}

const DESEMPATE = (a, b, chave) => b[chave] - a[chave] || b.diasNegociados - a.diasNegociados || a.ticker.localeCompare(b.ticker)

// ---------------------------------------------------------------------------------------
// ETFs: mais negociados
// ---------------------------------------------------------------------------------------

export const MOTIVOS_ETF = ['excluido_manual', 'sem_negocio', 'cotacao_defasada', 'poucos_dias_negociados', 'liquidez_baixa']

export function motivoDeExclusaoEtf(n, ativo, insumos, cfg) {
  if ((insumos.excluidos ?? []).includes(ativo.ticker)) return { codigo: 'excluido_manual', motivo: 'ETF fora da lista por decisão registrada em config/etfs.json (não é fundo de índice comum).' }
  if (n.ultimo === -1 || n.diasNegociados === 0) return { codigo: 'sem_negocio', motivo: `Nenhum negócio nos últimos ${cfg.janelaLiquidez} pregões.` }
  if (n.pregoesDesdeUltimoNegocio > cfg.pregoesMaxSemNegocio) return { codigo: 'cotacao_defasada', motivo: `Último negócio há ${n.pregoesDesdeUltimoNegocio} pregões (máximo ${cfg.pregoesMaxSemNegocio}).` }
  if (n.diasNegociados < cfg.diasNegociadosMinimos) return { codigo: 'poucos_dias_negociados', motivo: `Negociou em ${n.diasNegociados} dos últimos ${cfg.janelaLiquidez} pregões (mínimo ${cfg.diasNegociadosMinimos}).` }
  if (n.volumeMediano < cfg.volumeMinimoDiario) return { codigo: 'liquidez_baixa', motivo: `Volume mediano de R$ ${n.volumeMediano.toLocaleString('pt-BR')} por dia (mínimo ${cfg.volumeMinimoDiario.toLocaleString('pt-BR')}).` }
  return null
}

/**
 * FIIs, ações e BDRs mais negociados (D71): é o MESMO cálculo de liquidez dos ETFs (mediana do volume dos últimos
 * pregões); só muda a classe e a categoria (segmento do fundo, setor da empresa). A classe vem nos insumos.
 */
export function calcularFiis(insumos, cfg) {
  return calcularEtfs({ ...insumos, classe: 'fiis' }, cfg)
}
export function calcularAcoes(insumos, cfg) {
  return calcularEtfs({ ...insumos, classe: 'acoes' }, cfg)
}
export function calcularBdrsNegociados(insumos, cfg) {
  return calcularEtfs({ ...insumos, classe: 'bdrs-negociados' }, cfg)
}

export function calcularEtfs(insumos, cfg) {
  const pregoes = insumos.pregoes
  const itens = []
  const exclusoes = []
  const memoria = {}
  for (const ativo of insumos.ativos) {
    const serie = alinhar(ativo.serie, pregoes.length)
    const n = numerosDeLiquidez(serie, pregoes, cfg.janelaLiquidez)
    const exc = motivoDeExclusaoEtf(n, ativo, insumos, cfg)
    if (exc) {
      exclusoes.push({ ticker: ativo.ticker, nome: ativo.nome, categoria: ativo.categoria, ...exc })
      continue
    }
    itens.push({
      ticker: ativo.ticker,
      nome: ativo.nome,
      categoria: ativo.categoria,
      volumeMediano: n.volumeMediano,
      volumeMedio: n.volumeMedio,
      diasNegociados: n.diasNegociados,
      cotacao: n.cotacao,
      dataCotacao: n.dataCotacao,
      variacao3m: variacao3m(serie, pregoes, n.ultimo, cfg.janela3Meses),
    })
    memoria[ativo.ticker] = { janela: pregoes.slice(pregoes.length - cfg.janelaLiquidez), volumes: n.volumes, formula: 'mediana(volumes da janela)' }
  }
  itens.sort((a, b) => DESEMPATE(a, b, 'volumeMediano'))
  itens.forEach((it, i) => { it.posicaoGeral = i + 1 })
  const porCategoria = {}
  for (const it of itens) (porCategoria[it.categoria] ??= []).push(it)
  const categorias = {}
  for (const [cat, lista] of Object.entries(porCategoria)) {
    categorias[cat] = lista.slice(0, cfg.tamanhoPorCategoria).map((it, i) => ({ ...it, posicaoNaCategoria: i + 1 }))
  }
  const ordem = insumos.ordemCategorias ?? Object.keys(categorias)
  const categoriasOrdenadas = {}
  for (const c of [...ordem, ...Object.keys(categorias).filter((c) => !ordem.includes(c))]) if (categorias[c]) categoriasOrdenadas[c] = categorias[c]
  exclusoes.sort((a, b) => a.ticker.localeCompare(b.ticker))
  return {
    resultado: {
      classe: insumos.classe ?? 'etfs',
      dataExecucao: insumos.dataExecucao,
      ultimoPregao: pregoes.at(-1) ?? null,
      universo: insumos.ativos.length,
      elegiveis: itens.length,
      geral: itens.slice(0, cfg.tamanhoDaLista),
      porCategoria: categoriasOrdenadas,
      exclusoes,
    },
    memoria,
  }
}

// ---------------------------------------------------------------------------------------
// BDRs: maior desconto de preço
// ---------------------------------------------------------------------------------------

export const ALERTAS_BDR = ['salto_de_preco', 'desconto_extremo']

/** Aplica desdobramentos/grupamentos confirmados: preços ANTES da data são divididos pelo fator. */
export function ajustarDesdobramentos(serie, pregoes, eventos = []) {
  const validos = (eventos ?? []).filter((e) => e && typeof e.data === 'string' && e.fator > 0)
  if (!validos.length) return serie
  return serie.map((v, i) => {
    if (!v) return v
    const fator = validos.filter((e) => pregoes[i] < e.data).reduce((f, e) => f * e.fator, 1)
    return fator === 1 ? v : [v[0] / fator, v[1] / fator, v[2] / fator, v[3]]
  })
}

/** Saltos entre fechamentos consecutivos (pulando dias sem negócio) dentro da janela: desdobramento não confirmado. */
export function saltosDePreco(serie, pregoes, janela, cfg) {
  const saltos = []
  let anterior = null
  const inicio = Math.max(0, serie.length - janela - 1)
  for (let i = inicio; i < serie.length; i++) {
    const v = serie[i]
    if (!v) continue
    if (anterior && i >= serie.length - janela) {
      const razao = v[0] / anterior[0]
      if (razao <= cfg.saltoQueda || razao >= cfg.saltoAlta) saltos.push({ data: pregoes[i], de: arredondar(anterior[0]), para: arredondar(v[0]) })
    }
    anterior = v
  }
  return saltos
}

export function calcularBdrs(insumos, cfg) {
  const pregoes = insumos.pregoes
  const elegiveis = []
  const aConferir = []
  const exclusoes = []
  const memoria = {}
  for (const ativo of insumos.ativos) {
    const bruta = alinhar(ativo.serie, pregoes.length)
    const serie = ajustarDesdobramentos(bruta, pregoes, ativo.desdobramentos)
    const n = numerosDeLiquidez(serie, pregoes, cfg.janelaLiquidez)
    const base = { ticker: ativo.ticker, nome: ativo.nome, setor: ativo.setor }
    const excluir = (codigo, motivo) => exclusoes.push({ ...base, codigo, motivo })

    if ((insumos.excluidos ?? []).includes(ativo.ticker)) { excluir('excluido_manual', 'Empresa de origem ou operação brasileira, fora da lista por decisão registrada em config/bdrs.json (D19).'); continue }
    if (n.ultimo === -1 || n.diasNegociados === 0) { excluir('sem_negocio', `Nenhum negócio nos últimos ${cfg.janelaLiquidez} pregões.`); continue }
    if (n.pregoesDesdeUltimoNegocio > cfg.pregoesMaxSemNegocio) { excluir('cotacao_defasada', `Último negócio há ${n.pregoesDesdeUltimoNegocio} pregões (máximo ${cfg.pregoesMaxSemNegocio}).`); continue }
    if (n.diasNegociados < cfg.diasNegociadosMinimos) { excluir('poucos_dias_negociados', `Negociou em ${n.diasNegociados} dos últimos ${cfg.janelaLiquidez} pregões (mínimo ${cfg.diasNegociadosMinimos}).`); continue }
    if (n.volumeMediano < cfg.volumeMinimoDiario) { excluir('liquidez_baixa', `Volume mediano de R$ ${n.volumeMediano.toLocaleString('pt-BR')} por dia (mínimo ${cfg.volumeMinimoDiario.toLocaleString('pt-BR')}).`); continue }
    const primeiro = serie.findIndex(Boolean)
    const pregoesComDado = primeiro === -1 ? 0 : serie.length - primeiro
    if (pregoesComDado < cfg.pregoesMinimosHistorico) { excluir('historico_curto', `Só ${pregoesComDado} pregões de histórico (mínimo ${cfg.pregoesMinimosHistorico}) para medir a máxima de 12 meses.`); continue }

    const ano = serie.slice(serie.length - cfg.janelaMaxima)
    let maxima = -Infinity
    let dataMaxima = null
    ano.forEach((v, i) => {
      if (v && v[0] > maxima) { maxima = v[0]; dataMaxima = pregoes[pregoes.length - ano.length + i] }
    })
    const desconto = 1 - n.cotacao / maxima
    const saltos = saltosDePreco(serie, pregoes, cfg.janelaMaxima, cfg)
    const item = {
      ...base,
      cotacao: n.cotacao,
      dataCotacao: n.dataCotacao,
      maximaFechamento12m: arredondar(maxima),
      dataMaxima,
      desconto: arredondar(desconto, 4),
      variacao3m: variacao3m(serie, pregoes, n.ultimo, cfg.janela3Meses),
      volumeMediano: n.volumeMediano,
      diasNegociados: n.diasNegociados,
      pregoesComDado,
      acoesPorBdr: ativo.acoesPorBdr ?? null,
    }
    memoria[ativo.ticker] = {
      formula: 'desconto = 1 − fechamento atual ÷ maior fechamento dos últimos 252 pregões (com desdobramentos confirmados aplicados)',
      cotacao: n.cotacao, maximaFechamento12m: arredondar(maxima), dataMaxima, saltos, desdobramentosAplicados: ativo.desdobramentos ?? [],
      janelaLiquidez: pregoes.slice(pregoes.length - cfg.janelaLiquidez), volumes: n.volumes,
    }
    const alertas = []
    if (saltos.length) alertas.push('salto_de_preco')
    if (desconto > cfg.descontoParaConferir) alertas.push('desconto_extremo')
    if (alertas.length) aConferir.push({ ...item, alertas })
    else elegiveis.push(item)
  }
  const ordenar = (a, b) => b.desconto - a.desconto || b.volumeMediano - a.volumeMediano || a.ticker.localeCompare(b.ticker)
  elegiveis.sort(ordenar)
  aConferir.sort(ordenar)
  elegiveis.forEach((it, i) => { it.posicao = i + 1 })
  exclusoes.sort((a, b) => a.ticker.localeCompare(b.ticker))
  return {
    resultado: {
      classe: 'bdrs',
      dataExecucao: insumos.dataExecucao,
      ultimoPregao: pregoes.at(-1) ?? null,
      universo: insumos.ativos.length,
      elegiveis: elegiveis.length,
      ranking: elegiveis.slice(0, cfg.tamanhoDaLista),
      aConferir,
      exclusoes,
    },
    memoria,
  }
}

/** Resultado inverossímil derruba o job antes de tocar no app. Devolve a lista de problemas. */
export function verificarSanidade(resultado, cfg) {
  const p = []
  const lista = resultado.classe === 'bdrs' ? resultado.ranking : resultado.geral
  if (lista.length < cfg.sanidade.minimoNaLista) p.push(`só ${lista.length} ativos na lista (mínimo ${cfg.sanidade.minimoNaLista})`)
  const semNegocio = resultado.exclusoes.filter((e) => e.codigo === 'sem_negocio' || e.codigo === 'cotacao_defasada').length
  if (resultado.universo && semNegocio / resultado.universo > cfg.sanidade.maximoFracaoSemCotacao) p.push(`${semNegocio} de ${resultado.universo} ativos sem cotação recente (máximo ${Math.round(cfg.sanidade.maximoFracaoSemCotacao * 100)}%): o histórico de preços parece desatualizado`)
  return p
}
