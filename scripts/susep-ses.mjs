// Sinistralidade das seguradoras, lida do SES (Sistema de Estatísticas) da SUSEP.
//
// A SUSEP publica a base completa (BaseCompleta.zip, ~600 MB, atualizada toda semana). A tabela `Ses_seguros.csv` tem uma linha por
// mês (damesano = AAAAMM), entidade (coenti) e ramo, com valores MENSAIS (não acumulados) em reais:
//   premio_ganho, sinistro_ocorrido e desp_com (despesas de comercialização, as comissões).
// O trimestre é a soma dos 3 meses; sinistralidade = sinistro ocorrido ÷ prêmio ganho. O índice combinado completo precisaria das despesas
// administrativas, que o SES não traz por entidade: aqui entram só a sinistralidade e o comissionamento, e a tela diz isso.
// Este módulo só lê e valida; a ligação com a empresa está em config/susep-entidades.json.

import { dividirLinha, indiceDasColunas, linhasDoZip, numeroCvm } from './acoes-baratas-cvm.mjs'

export const URL_SES = 'https://www2.susep.gov.br/redarq.asp?arq=BaseCompleta%2ezip'
const ENTRADA = 'Ses_seguros.csv'

/** "2026-06-30" → 202606. */
export const anoMesDoFimDeTrimestre = (periodo) => Number(periodo.slice(0, 4) + periodo.slice(5, 7))

/** Os 3 meses (AAAAMM) que formam o trimestre terminado em `periodo`. */
export function mesesDoTrimestre(periodo) {
  const ano = Number(periodo.slice(0, 4))
  const mes = Number(periodo.slice(5, 7))
  return [mes - 2, mes - 1, mes].map((m) => ano * 100 + m)
}

/**
 * Lê Ses_seguros.csv do zip e soma, por entidade e mês, prêmio ganho, sinistro ocorrido e despesa de comercialização.
 * Devolve { [coenti]: { [AAAAMM]: { premioGanho, sinistroOcorrido, comissoes } } } só das entidades pedidas.
 */
export async function lerSeguros(zip, entidades, { desdeAnoMes = 0, linhas = linhasDoZip(zip, ENTRADA) } = {}) {
  const alvo = new Set(entidades)
  const saida = {}
  let indice = null
  for await (const linha of linhas) {
    if (!indice) {
      indice = indiceDasColunas(linha, { mes: 'damesano', entidade: 'coenti', ganho: 'premio_ganho', sinistro: 'sinistro_ocorrido', comissao: 'desp_com' }, ENTRADA)
      continue
    }
    const c = dividirLinha(linha)
    const entidade = c[indice.entidade]?.trim()
    if (!alvo.has(entidade)) continue
    const mes = Number(c[indice.mes])
    if (!(mes >= desdeAnoMes)) continue
    const acc = ((saida[entidade] ??= {})[mes] ??= { premioGanho: 0, sinistroOcorrido: 0, comissoes: 0 })
    acc.premioGanho += numeroCvm(c[indice.ganho]) ?? 0
    acc.sinistroOcorrido += numeroCvm(c[indice.sinistro]) ?? 0
    acc.comissoes += numeroCvm(c[indice.comissao]) ?? 0
  }
  return saida
}

/**
 * Trimestre (soma dos 3 meses) das entidades da empresa: { premioGanho (R$ mil), sinistralidade, comissionamento } ou null quando falta
 * algum dos 3 meses ou o prêmio não é positivo.
 */
export function trimestreDeSeguros(porEntidade, entidades, periodo) {
  let premio = 0
  let sinistro = 0
  let comissoes = 0
  for (const mes of mesesDoTrimestre(periodo)) {
    for (const e of entidades) {
      const m = porEntidade[e]?.[mes]
      if (!m) {
        if (e === entidades[0]) return null
        continue
      }
      premio += m.premioGanho
      sinistro += m.sinistroOcorrido
      comissoes += m.comissoes
    }
  }
  if (!(premio > 0)) return null
  const sinistralidade = sinistro / premio
  if (sinistralidade < 0 || sinistralidade > 2) return null
  return { premioGanho: Math.round(premio / 1000), sinistralidade, comissionamento: comissoes / premio }
}
