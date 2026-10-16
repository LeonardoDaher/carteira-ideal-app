/**
 * Textos da seção "Auditoria e verificação" dos Top 15 (D89). O ranking é recalculado todo dia útil com o preço do dia e
 * conferido por um segundo cálculo independente antes de entrar no app; a pasta de auditoria COMPLETA só é gravada uma vez
 * por mês. O job grava `modoAuditoria` e `auditoriaCompletaEm` no cabeçalho público; arquivos antigos não os têm e caem no
 * texto de sempre ("toda execução grava a pasta").
 */

import { formatarData } from './rendaFii'

export interface CampoAuditoriaDiaria {
  modoAuditoria?: 'completa' | 'diaria' | null
  auditoriaCompletaEm?: string | null
}

/** Abertura da frase que cita a pasta de auditoria; o texto seguinte começa por `<code>{pasta}</code> com ...`. */
export function introAuditoria(s: CampoAuditoriaDiaria): string {
  if (s.modoAuditoria !== 'diaria') return 'Toda execução grava, no repositório do projeto, a pasta'
  const de = s.auditoriaCompletaEm ? ` (de ${formatarData(s.auditoriaCompletaEm)})` : ''
  return `O ranking é recalculado todo dia útil, com o preço do dia, e conferido por um segundo cálculo independente antes de entrar no app. A pasta de auditoria completa é gravada uma vez por mês, no repositório do projeto; a mais recente${de} é`
}

/** Aviso extra, só nas execuções diárias: o comando confere a pasta do mês, não o cálculo do dia. */
export function notaAuditoriaDiaria(s: CampoAuditoriaDiaria): string | null {
  if (s.modoAuditoria !== 'diaria') return null
  return 'O comando abaixo refaz o cálculo da pasta do mês, com os preços daquela data. O ranking de hoje usa as mesmas regras e a mesma base de fundamentos com o preço do dia, e a impressão digital do resultado, abaixo, é a de hoje.'
}
