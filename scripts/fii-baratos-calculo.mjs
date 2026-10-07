// Cálculo PURO da triagem "FIIs baratos" (Tijolo e Papel). Sem rede, sem arquivos, sem relógio:
// recebe os insumos congelados (o que foi copiado da CVM e do job de FIIs) e a config, e devolve
// o resultado e a memória de cálculo. É isto que a verificação independente refaz.
//
// Fluxo por fundo: preço e dado → classificação pelo ativo → indicadores → filtros do grupo →
// "a conferir" (dado suspeito) → ranking por grupo. Cada exclusão tem etapa, código e motivo.
//
// Indicadores:
//   P/VP           = cotação ÷ valor patrimonial da cota (competência de referência)
//   rendimento/cota do mês = DY do mês (fração) × valor patrimonial da cota do mês   [ESTIMATIVA: o informe só traz o DY]
//   DY de 12 meses = (soma dos rendimentos por cota dos meses com dado × 12 ÷ nº de meses com dado) ÷ cotação
//   rentabilidade patrimonial de 12 meses = produto de (1 + rentabilidade patrimonial do mês) − 1
//   alavancagem    = (passivo total − rendimentos a distribuir − taxas a pagar) ÷ valor do ativo   [aproximação do passivo oneroso]
//   nota           = média dos ranks percentuais de P/VP (menor é melhor) e DY de 12 meses (maior é melhor), dentro do grupo

import crypto from 'node:crypto'

// ---------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------

/** JSON canônico: chaves em ordem, sem undefined. Base de todos os hashes. */
export function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .filter((k) => valor[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(valor ?? null)
}

export const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex')
export const hashDoResultado = (resultado) => sha256(canonico(resultado))

export const arred = (v, casas = 6) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** casas) / 10 ** casas)
const soma = (obj, campos) => campos.reduce((s, c) => s + (obj?.[c] ?? 0), 0)
const diasEntre = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000)

export function subtrairMes(comp, n) {
  const [a, m] = comp.split('-').map(Number)
  const t = a * 12 + (m - 1) - n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** Ranks percentuais (0 a 1; 1 = melhor). `maiorMelhor` define o sentido; empates recebem a média. */
export function rankPercentual(valores, maiorMelhor) {
  const n = valores.length
  if (n <= 1) return valores.map(() => 1)
  const ordem = valores.map((v, i) => [v, i]).sort((a, b) => (maiorMelhor ? a[0] - b[0] : b[0] - a[0]))
  const ranks = new Array(n)
  for (let i = 0; i < n; ) {
    let j = i
    while (j + 1 < n && ordem[j + 1][0] === ordem[i][0]) j++
    const media = (i + j) / 2 / (n - 1)
    for (let k = i; k <= j; k++) ranks[ordem[k][1]] = media
    i = j + 1
  }
  return ranks
}

// ---------------------------------------------------------------------------------------
// Competência de referência e escala do DY
// ---------------------------------------------------------------------------------------

/** Competência mais recente com cobertura quase completa (o mês corrente costuma vir com poucos fundos). */
export function competenciaDeReferencia(contagemPorCompetencia, cobertura) {
  const entradas = Object.entries(contagemPorCompetencia)
  if (!entradas.length) return null
  const maximo = Math.max(...entradas.map(([, n]) => n))
  return entradas.filter(([, n]) => n >= cobertura * maximo).map(([c]) => c).sort().at(-1)
}

/** O informe traz o DY como fração (0,0085) ou em % (0,85) conforme o arquivo: mediana acima de 0,05 só faz sentido em %. */
export function divisorDaEscala(medianaDy) {
  return medianaDy != null && medianaDy > 0.05 ? 100 : 1
}

// ---------------------------------------------------------------------------------------
// Classificação pelo ativo
// ---------------------------------------------------------------------------------------

/** Tijolo, papel, fundo de fundos ou misto, pelo que o fundo tem no ativo. */
export function classificarPeloAtivo(ativo, cls) {
  if (!ativo) return { tipo: 'sem_ativo', fatias: null, valores: null }
  const imoveis = soma(ativo, cls.imoveis)
  const recebiveis = soma(ativo, cls.recebiveis)
  const cotas = soma(ativo, cls.cotas)
  const outros = soma(ativo, cls.outros)
  const total = imoveis + recebiveis + cotas + outros
  if (total <= 0) return { tipo: 'sem_ativo', fatias: null, valores: null }
  const fatias = { imoveis: imoveis / total, recebiveis: recebiveis / total, cotas: cotas / total }
  const f = cls.fatiaMinimaDoTipo
  const tipo = fatias.imoveis >= f ? 'tijolo' : fatias.recebiveis >= f ? 'papel' : fatias.cotas >= f ? 'fundo_de_fundos' : 'misto'
  return { tipo, fatias, valores: { imoveis, recebiveis, cotas, outros, total } }
}

// ---------------------------------------------------------------------------------------
// Indicadores de um fundo
// ---------------------------------------------------------------------------------------

export function indicadoresDoFundo(fundo, ref, divisorPorCompetencia, cfg) {
  const d = cfg.dados
  const meses = Array.from({ length: d.mesesHistorico }, (_, i) => subtrairMes(ref, d.mesesHistorico - 1 - i))
  const linhaRef = fundo.informes?.[ref]
  if (!linhaRef) return { erro: 'sem informe na competência de referência' }

  const serie = []
  for (const m of meses) {
    const l = fundo.informes?.[m]
    if (!l) continue
    const esc = divisorPorCompetencia[m] ?? 1
    const dy = l.dy != null ? l.dy / esc : null
    serie.push({
      competencia: m,
      vp: l.vp ?? null,
      dy,
      rendimentoPorCota: dy != null && l.vp != null ? dy * l.vp : null,
      rentabPatrimonial: l.pat != null ? l.pat / esc : null,
    })
  }
  const comRend = serie.filter((s) => s.rendimentoPorCota != null)
  if (comRend.length < d.minimoMesesComDados) return { erro: `só ${comRend.length} meses com rendimento nos últimos ${d.mesesHistorico}` }
  const somaRend = comRend.reduce((s, x) => s + x.rendimentoPorCota, 0)
  const rendimento12m = (somaRend * d.mesesHistorico) / comRend.length
  const comPat = serie.filter((s) => s.rentabPatrimonial != null)
  const rentabPatrimonial12m = comPat.length >= d.minimoMesesComDados ? comPat.reduce((p, x) => p * (1 + x.rentabPatrimonial), 1) - 1 : null

  // O DY de 12 meses esconde corte de rendimento e pagamento extra. Dois indicadores, ambos por MEDIANA (um mês zerado ou um
  // pico isolado no informe não pode decidir sozinho; na primeira versão, com média de 2 meses, GTWR11 e BRCO11, que pagam todo
  // mês, foram marcados por um mês com DY zero no informe):
  //  - razão recente: mediana dos últimos `mesesRecentes` meses (todos com dado) ÷ mediana dos 12 meses. Pega o corte (MFII11, BBIG11, TRBL11).
  //  - pico: média ÷ mediana dos 12 meses. Alto = o DY de 12 meses depende de poucos meses atípicos (HGRE11, KORE11).
  const medianaDe = (v) => { const o = [...v].sort((a, b) => a - b); const n = o.length; return n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2 }
  const rendimentos = comRend.map((x) => x.rendimentoPorCota)
  const mediana12m = medianaDe(rendimentos)
  const recentes = serie.filter((s) => meses.slice(-d.mesesRecentes).includes(s.competencia) && s.rendimentoPorCota != null).map((s) => s.rendimentoPorCota)
  const medianaRecente = recentes.length === d.mesesRecentes ? medianaDe(recentes) : null
  const razaoRendimentoRecente = medianaRecente != null && mediana12m > 0 ? medianaRecente / mediana12m : null
  const picoDeRendimento = mediana12m > 0 ? somaRend / comRend.length / mediana12m : null
  const vp = linhaRef.vp
  const ativoRef = fundo.ativos?.[ref]
  const passivoOneroso = ativoRef ? Math.max((ativoRef.Total_Passivo ?? 0) - (ativoRef.Rendimentos_Distribuir ?? 0) - (ativoRef.Taxa_Administracao_Pagar ?? 0) - (ativoRef.Taxa_Performance_Pagar ?? 0), 0) : null
  const cls = classificarPeloAtivo(ativoRef, cfg.classificacao)
  return {
    vp,
    pvp: vp > 0 ? fundo.cotacao / vp : null,
    rendimento12m,
    dy12: fundo.cotacao > 0 ? rendimento12m / fundo.cotacao : null,
    dyRecente: fundo.cotacao > 0 && medianaRecente != null ? (medianaRecente * 12) / fundo.cotacao : null,
    razaoRendimentoRecente,
    picoDeRendimento,
    mesesComDados: comRend.length,
    rentabPatrimonial12m,
    patrimonio: linhaRef.pl ?? null,
    cotistas: linhaRef.cotistas ?? null,
    alavancagem: linhaRef.valorAtivo > 0 && passivoOneroso != null ? passivoOneroso / linhaRef.valorAtivo : null,
    tipo: cls.tipo,
    fatias: cls.fatias,
    valoresDoAtivo: cls.valores,
    serie,
  }
}

// ---------------------------------------------------------------------------------------
// Filtros e alertas
// ---------------------------------------------------------------------------------------

const mi = (v) => `R$ ${Math.round(v / 1e6).toLocaleString('pt-BR')} mi`
const pc = (v, c = 1) => `${(v * 100).toFixed(c).replace('.', ',')}%`

/** Motivo da exclusão pelo filtro do grupo, ou null. Ordem importa: o primeiro que reprova é o motivo registrado. */
export function motivoDeExclusao(f, p) {
  if (f.volumeLiquidez == null || f.volumeLiquidez < p.volumeMinimoDiario) return ['liquidez_baixa', `volume ${f.fonteLiquidez === 'mediana' ? 'mediano' : 'médio'} de R$ ${Math.round(f.volumeLiquidez ?? 0).toLocaleString('pt-BR')} por dia (mínimo ${p.volumeMinimoDiario.toLocaleString('pt-BR')})`]
  if (f.patrimonio == null || f.patrimonio < p.patrimonioMinimo) return ['patrimonio_pequeno', `patrimônio de ${mi(f.patrimonio ?? 0)} (mínimo ${mi(p.patrimonioMinimo)})`]
  if (f.cotistas != null && f.cotistas < p.cotistasMinimos) return ['poucos_cotistas', `${f.cotistas} cotistas (mínimo ${p.cotistasMinimos})`]
  if (f.pvp == null || f.pvp < p.pvpMinimo) return ['pvp_suspeito', `P/VP de ${f.pvp == null ? 'indisponível' : f.pvp.toFixed(2).replace('.', ',')} (mínimo ${String(p.pvpMinimo).replace('.', ',')}: o mercado está precificando perda ou o dado está errado)`]
  if (p.dy12Maximo && f.dy12 > p.dy12Maximo) return ['dy_implausivel', `DY de 12 meses de ${pc(f.dy12)} (máximo ${pc(p.dy12Maximo, 0)}: distribuição não recorrente ou dado errado)`]
  if (f.rentabPatrimonial12m == null) return ['sem_rentabilidade_patrimonial', 'sem a rentabilidade patrimonial de 12 meses']
  if (f.rentabPatrimonial12m < p.rentabPatrimonial12mMinima) return ['patrimonio_em_queda', `rentabilidade patrimonial de 12 meses de ${pc(f.rentabPatrimonial12m)} (mínimo ${pc(p.rentabPatrimonial12mMinima, 0)})`]
  if (f.alavancagem != null && f.alavancagem > p.alavancagemMaxima) return ['alavancado', `passivo de ${pc(f.alavancagem, 0)} do ativo (máximo ${pc(p.alavancagemMaxima, 0)})`]
  return null
}

/** Sinais de dado a conferir (cota fora de base, distribuição não recorrente, rendimento em queda). */
export function alertasDoFundo(f, a) {
  const lista = []
  if (f.pvp != null && f.pvp < a.pvpMuitoBaixo) lista.push('pvp_muito_baixo')
  if (f.dy12 != null && f.dy12 > a.dy12Alto) lista.push('dy_alto')
  if (f.razaoRendimentoRecente != null && f.razaoRendimentoRecente < a.rendimentoRecenteMinimoSobre12m) lista.push('rendimento_em_queda')
  if (f.picoDeRendimento != null && f.picoDeRendimento > a.picoDeRendimentoMaximo) lista.push('rendimento_com_pico')
  return lista
}

/**
 * Conferência manual vigente de um fundo (config.conferencia): quem conferiu, quando, em que fonte e QUAIS alertas ela libera.
 * Vale por `validadeDias` dias a partir de `conferidoEm`; depois disso o fundo volta para "a conferir".
 */
export function conferenciaVigente(ticker, conferencia, dataExecucao) {
  const c = conferencia?.fundos?.[ticker]
  if (!c) return null
  const idade = diasEntre(c.conferidoEm, dataExecucao)
  return { ...c, vigente: idade >= 0 && idade <= (conferencia.validadeDias ?? 0), idadeDias: idade }
}

/**
 * Fundo com alerta sai ANTES de calcular os ranks e vai para "a conferir", EXCETO se há conferência vigente que libera
 * TODOS os alertas dele. Alerta novo (que a conferência não cobre) volta a segurar o fundo; conferência vencida também.
 */
export function separarAConferir(fundos, a, conferencia = null, dataExecucao = null) {
  const limpos = []
  const aConferir = []
  for (const f of fundos) {
    const alertas = alertasDoFundo(f, a)
    if (!alertas.length) { limpos.push(f); continue }
    const c = dataExecucao ? conferenciaVigente(f.ticker, conferencia, dataExecucao) : null
    const pendentes = alertas.filter((x) => !(c?.vigente && (c.libera ?? []).includes(x)))
    if (pendentes.length) aConferir.push({ ...f, alertas: pendentes, ...(c && !c.vigente ? { conferenciaVencida: c.conferidoEm } : {}) })
    else limpos.push({ ...f, alertasLiberados: alertas, conferido: { em: c.conferidoEm, fonte: c.fonte, nota: c.nota ?? null } })
  }
  return { limpos, aConferir }
}

export function ranquear(fundos) {
  const rp = rankPercentual(fundos.map((f) => f.pvp), false) // P/VP menor = melhor
  const rd = rankPercentual(fundos.map((f) => f.dy12), true) // DY maior = melhor
  return fundos
    .map((f, i) => ({ ...f, rankPvp: rp[i], rankDy: rd[i], nota: (rp[i] + rd[i]) / 2 }))
    .sort((a, b) => b.nota - a.nota || a.pvp - b.pvp || (a.ticker < b.ticker ? -1 : 1))
    .map((f, i) => ({ ...f, posicao: i + 1 }))
}

// ---------------------------------------------------------------------------------------
// Cálculo completo
// ---------------------------------------------------------------------------------------

const excl = (f, etapa, codigo, motivo) => ({ ticker: f.ticker, nome: f.nome ?? null, setor: f.setor ?? null, etapa, codigo, motivo })

function linhaDoRanking(f) {
  return {
    posicao: f.posicao ?? null,
    ticker: f.ticker,
    nome: f.nome ?? null,
    setorDeclarado: f.segmento ?? f.setor ?? null,
    cnpj: f.cnpj,
    tipo: f.tipo,
    nota: arred(f.nota),
    rankPvp: arred(f.rankPvp),
    rankDy: arred(f.rankDy),
    pvp: arred(f.pvp, 4),
    dy12: arred(f.dy12, 5),
    dyRecente: arred(f.dyRecente, 5),
    razaoRendimentoRecente: arred(f.razaoRendimentoRecente, 4),
    picoDeRendimento: arred(f.picoDeRendimento, 4),
    cotacao: arred(f.cotacao, 4),
    dataCotacao: f.dataCotacao ?? null,
    vp: arred(f.vp, 4),
    rendimento12m: arred(f.rendimento12m, 4),
    rentabPatrimonial12m: arred(f.rentabPatrimonial12m, 5),
    patrimonio: arred(f.patrimonio, 2),
    cotistas: f.cotistas ?? null,
    alavancagem: arred(f.alavancagem, 4),
    volumeMedio: arred(f.volumeMedio, 0),
    volumeMediano: arred(f.volumeMediano, 0),
    volumeLiquidez: arred(f.volumeLiquidez, 0),
    fonteLiquidez: f.fonteLiquidez ?? null,
    fatias: f.fatias ? { imoveis: arred(f.fatias.imoveis, 4), recebiveis: arred(f.fatias.recebiveis, 4), cotas: arred(f.fatias.cotas, 4) } : null,
    mesesComDados: f.mesesComDados,
    alertas: f.alertas ?? [],
    ...(f.alertasLiberados ? { alertasLiberados: f.alertasLiberados, conferido: f.conferido } : {}),
    ...(f.conferenciaVencida ? { conferenciaVencida: f.conferenciaVencida } : {}),
    ...(f.grupo ? { grupo: f.grupo } : {}),
  }
}

/** Devolve { resultado, memoria }. Determinístico: mesmos insumos e config, mesmo resultado, em qualquer máquina. */
export function calcular(insumos, cfg) {
  const d = cfg.dados
  const exclusoes = []
  const etapas = []
  const ref = competenciaDeReferencia(insumos.contagemPorCompetencia, d.coberturaMinimaDaCompetencia)
  const divisor = Object.fromEntries(Object.entries(insumos.medianaDyPorCompetencia ?? {}).map(([c, m]) => [c, divisorDaEscala(m)]))
  const memoria = {}

  // 1) universo e preço
  let atual = []
  for (const f of insumos.fundos) {
    if (!f.cnpj) { exclusoes.push(excl(f, 'universo', 'sem_cnpj', 'Código não encontrado pelo ISIN no informe da CVM.')); continue }
    if (f.cotacao == null || !(f.cotacao > 0)) { exclusoes.push(excl(f, 'precos', 'sem_cotacao', 'Sem cotação no job de FIIs.')); continue }
    const idade = f.dataCotacao ? diasEntre(f.dataCotacao, insumos.dataExecucao) : null
    if (idade == null || idade > d.cotacaoMaxIdadeDias) { exclusoes.push(excl(f, 'precos', 'cotacao_defasada', `Cotação de ${f.dataCotacao ?? 'data desconhecida'}, ${idade ?? '?'} dias antes da execução (máximo ${d.cotacaoMaxIdadeDias}).`)); continue }
    atual.push(f)
  }
  etapas.push({ etapa: 'universo e preço', entram: insumos.fundos.length, ficam: atual.length })

  // 2) indicadores
  const comIndicadores = []
  for (const f of atual) {
    const ind = indicadoresDoFundo(f, ref, divisor, cfg)
    if (ind.erro) { exclusoes.push(excl(f, 'dados', 'dados_insuficientes', ind.erro)); continue }
    // Liquidez pela MEDIANA do volume diário quando o job de FIIs a traz (a média é puxada por poucos dias de negociação intensa e
    // deixou passar SAPI11 e BROF11); sem ela, vale a média, e a fonte fica registrada em `fonteLiquidez`.
    comIndicadores.push({ ...f, ...ind, volumeLiquidez: f.volumeMediano ?? f.volumeMedio ?? null, fonteLiquidez: f.volumeMediano != null ? 'mediana' : 'média' })
  }
  etapas.push({ etapa: 'dados do informe', entram: atual.length, ficam: comIndicadores.length })

  // 3) classificação e filtros por grupo
  const grupos = { tijolo: [], papel: [] }
  for (const f of comIndicadores) {
    memoria[f.ticker] = { cnpj: f.cnpj, origemCnpj: f.origemCnpj ?? null, competencia: ref, liquidez: { fonte: f.fonteLiquidez, volumeLiquidez: arred(f.volumeLiquidez, 0), volumeMedio: f.volumeMedio ?? null, volumeMediano: f.volumeMediano ?? null }, classificacao: { tipo: f.tipo, fatias: f.fatias, valoresDoAtivo: f.valoresDoAtivo }, serie: f.serie, derivados: { pvp: { formula: 'cotação ÷ valor patrimonial da cota', cotacao: f.cotacao, vp: f.vp, valor: arred(f.pvp, 6) }, rendimento12m: { formula: 'soma(DY do mês × VP do mês) × 12 ÷ meses com dado', meses: f.mesesComDados, valor: arred(f.rendimento12m, 6) }, dy12: { formula: 'rendimento de 12 meses ÷ cotação', valor: arred(f.dy12, 6) }, rentabPatrimonial12m: { formula: 'produto(1 + rentabilidade patrimonial do mês) − 1', valor: arred(f.rentabPatrimonial12m, 6) }, alavancagem: { formula: '(passivo total − rendimentos a distribuir − taxas a pagar) ÷ valor do ativo', valor: arred(f.alavancagem, 6) } } }
    if (f.tipo === 'tijolo' || f.tipo === 'papel') {
      const m = motivoDeExclusao(f, cfg.filtros[f.tipo])
      memoria[f.ticker].filtro = m ? { aprovado: false, codigo: m[0], motivo: m[1] } : { aprovado: true }
      if (m) exclusoes.push(excl(f, f.tipo, m[0], m[1]))
      else grupos[f.tipo].push(f)
    } else {
      const motivo = f.fatias ? `imóveis ${pc(f.fatias.imoveis, 0)}, recebíveis ${pc(f.fatias.recebiveis, 0)}, cotas ${pc(f.fatias.cotas, 0)}` : 'sem ativo no informe'
      exclusoes.push(excl(f, 'classificacao', f.tipo, motivo))
    }
  }
  etapas.push({ etapa: 'classificação e filtros', entram: comIndicadores.length, tijolo: grupos.tijolo.length, papel: grupos.papel.length })

  // 4) "a conferir" e ranking
  const t = separarAConferir(grupos.tijolo, cfg.alertas, cfg.conferencia, insumos.dataExecucao)
  const p = separarAConferir(grupos.papel, cfg.alertas, cfg.conferencia, insumos.dataExecucao)
  const aConferir = [...t.aConferir.map((f) => ({ ...f, grupo: 'tijolo' })), ...p.aConferir.map((f) => ({ ...f, grupo: 'papel' }))].sort((a, b) => (a.grupo === b.grupo ? (a.ticker < b.ticker ? -1 : 1) : a.grupo < b.grupo ? -1 : 1))
  const tijolo = ranquear(t.limpos)
  const papel = ranquear(p.limpos)
  etapas.push({ etapa: 'a conferir', aConferir: aConferir.length, tijolo: tijolo.length, papel: papel.length })
  for (const f of [...tijolo, ...papel]) memoria[f.ticker].ranking = { posicao: f.posicao, nota: arred(f.nota), rankPvp: arred(f.rankPvp), rankDy: arred(f.rankDy), formula: 'média dos ranks percentuais de P/VP (menor = melhor) e DY de 12 meses (maior = melhor), dentro do grupo' }
  for (const f of aConferir) memoria[f.ticker].aConferir = { grupo: f.grupo, alertas: f.alertas, ...(f.conferenciaVencida ? { conferenciaVencida: f.conferenciaVencida } : {}) }
  for (const f of [...tijolo, ...papel]) if (f.conferido) memoria[f.ticker].conferencia = { alertasLiberados: f.alertasLiberados, ...f.conferido, regra: 'conferência manual vigente em config/fii-baratos.json → conferencia; libera só os alertas listados e vale por conferencia.validadeDias dias' }

  const resultado = {
    esquema: 1,
    versaoMetodologia: cfg.versaoMetodologia,
    dataCotacoes: insumos.dataCotacoes,
    dataExecucao: insumos.dataExecucao,
    competenciaReferencia: ref,
    universo: insumos.fundos.length,
    liquidezPorMediana: comIndicadores.filter((f) => f.fonteLiquidez === 'mediana').length,
    liquidezPorMedia: comIndicadores.filter((f) => f.fonteLiquidez === 'média').length,
    etapas,
    tijolo: tijolo.map(linhaDoRanking),
    papel: papel.map(linhaDoRanking),
    aConferir: aConferir.map(linhaDoRanking),
    exclusoes,
  }
  return { resultado, memoria }
}

/** Trava de sanidade: problemas que tornam o resultado inverossímil (lista vazia = ok). */
export function verificarSanidade(resultado, cfg) {
  const s = cfg.publicacao?.sanidade
  if (!s) return []
  const problemas = []
  if (resultado.tijolo.length < s.minimoNoRankingTijolo) problemas.push(`só ${resultado.tijolo.length} fundos de tijolo no ranking (mínimo ${s.minimoNoRankingTijolo})`)
  if (resultado.papel.length < s.minimoNoRankingPapel) problemas.push(`só ${resultado.papel.length} fundos de papel no ranking (mínimo ${s.minimoNoRankingPapel})`)
  const semDados = resultado.exclusoes.filter((e) => ['sem_cnpj', 'sem_cotacao', 'cotacao_defasada', 'dados_insuficientes'].includes(e.codigo)).length
  if (resultado.universo > 0 && semDados / resultado.universo > s.maximoFracaoSemDados) problemas.push(`${semDados} de ${resultado.universo} fundos sem dado utilizável (${Math.round((semDados / resultado.universo) * 100)}%; máximo ${Math.round(s.maximoFracaoSemDados * 100)}%)`)
  return problemas
}
