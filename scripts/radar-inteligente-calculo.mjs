// Radar de dividendos inteligente (D132): em que meses do ano cada empresa costuma pagar, pelo que ela pagou nos últimos anos.
//
// É uma projeção estatística simples, sem valor: um mês é "provável" quando a empresa teve data com nesse mês em pelo menos
// `minimoDeAnos` dos últimos `anos` anos fechados. Não diz quanto vai pagar nem promete que vai pagar; o app cruza com a agenda
// (o que já foi anunciado) e só mostra o provável para o que ainda não foi anunciado. Este módulo é puro: a rede fica em
// atualizar-radar-inteligente.mjs.
import { classeDoTicker } from './b3-proventos.mjs'
import { TIPOS_DO_RADAR } from './radar-dividendos-calculo.mjs'

export const PARAMETROS = { anos: 3, minimoDeAnos: 2 }

/**
 * `eventos`: proventos da empresa (classe, tipo, dataCom AAAA-MM-DD), de `baixarProventosDaEmpresa`. `hoje`: AAAA-MM-DD.
 * Devolve { meses, anosComHistorico, primeiroAno }: `meses[m]` (m de 0 a 11) é em quantos dos últimos `anos` anos fechados houve
 * data com no mês m+1. Só a classe do código e os tipos do radar; várias linhas na mesma data com (parcelas) contam uma vez.
 */
export function padraoDeMeses(eventos, ticker, hoje, { anos = PARAMETROS.anos } = {}) {
  const classe = classeDoTicker(ticker)
  const anoAtual = Number(hoje.slice(0, 4))
  const doCodigo = eventos.filter((e) => e.classe === classe && TIPOS_DO_RADAR.includes(e.tipo))
  const vistos = Array.from({ length: 12 }, () => new Set())
  for (const e of doCodigo) {
    const ano = Number(e.dataCom.slice(0, 4))
    if (ano >= anoAtual - anos && ano < anoAtual) vistos[Number(e.dataCom.slice(5, 7)) - 1].add(ano)
  }
  const primeiroAno = doCodigo.length ? Math.min(...doCodigo.map((e) => Number(e.dataCom.slice(0, 4)))) : null
  return {
    meses: vistos.map((s) => s.size),
    anosComHistorico: primeiroAno === null ? 0 : Math.max(0, Math.min(anos, anoAtual - primeiroAno)),
    primeiroAno,
  }
}

/** Monta o arquivo do app. `empresas`: [{ ticker, nome, setor, eventos }]; `falhas`: tickers que não puderam ser lidos. */
export function montarRadarInteligente({ empresas, falhas = [], hoje, parametros = PARAMETROS }) {
  const lista = []
  for (const e of empresas) {
    const p = padraoDeMeses(e.eventos, e.ticker, hoje, parametros)
    if (p.meses.every((n) => n === 0)) continue
    lista.push({ ticker: e.ticker, nome: e.nome ?? null, setor: e.setor ?? null, meses: p.meses, anosComHistorico: p.anosComHistorico })
  }
  lista.sort((a, b) => a.ticker.localeCompare(b.ticker))
  return {
    publicado: true,
    dataReferencia: hoje,
    anos: parametros.anos,
    minimoDeAnos: parametros.minimoDeAnos,
    consultadas: empresas.length + falhas.length,
    falhas: [...falhas].sort(),
    empresas: lista,
  }
}

/** Trava do job: poucas empresas ou falhas demais não publicam. */
export function verificarSanidadeInteligente(radar, { maximoFracaoFalhas = 0.3, minimoComPadrao = 20 } = {}) {
  const erros = []
  if (radar.empresas.length < minimoComPadrao) erros.push(`Só ${radar.empresas.length} empresas com padrão de pagamento (mínimo ${minimoComPadrao}).`)
  if (radar.consultadas && radar.falhas.length / radar.consultadas > maximoFracaoFalhas) erros.push(`${radar.falhas.length} de ${radar.consultadas} empresas falharam (máximo ${Math.round(maximoFracaoFalhas * 100)}%).`)
  return erros
}
