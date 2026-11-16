// Data-base do balanço (D162): toda tela que mostra análise fundamentalista, valor justo ou preço teto diz de qual balanço saem os números,
// para TODA empresa, sempre a partir do dado (nunca escrito à mão por empresa). Funções puras, sem rede.

import type { BalancoNovo } from './analiseFundamentalista'

const dataBr = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`

/** '2026-06-30' vira '2T26'; '2026-12-31' vira '4T26'. Fim de exercício fora do calendário (ex.: agosto) vira '08/2026'. */
export function rotuloDoPeriodo(dtRefer: string): string {
  const ano = dtRefer.slice(2, 4)
  const mes = dtRefer.slice(5, 7)
  const tri = { '03': 1, '06': 2, '09': 3, '12': 4 }[mes]
  return tri ? `${tri}T${ano}` : `${mes}/${dtRefer.slice(0, 4)}`
}

export type EstadoDaBase = 'atualizado' | 'provisorio' | 'aguardando-cvm'

export interface BaseDoBalanco {
  /** Último dia do período que os números usam (aaaa-mm-dd). */
  dataBase: string
  /** Ex.: '2T26'. */
  rotulo: string
  estado: EstadoDaBase
  /** Texto curto para o selo: 'Base: 2T26 · balanço de 30/06/2026'. */
  texto: string
  /** Só quando há balanço novo ainda não incorporado: ex. '3T26 divulgado, aguardando a CVM'. */
  pendencia: string | null
}

/**
 * Base do balanço de uma empresa. `dataBase` é o fim do período usado nos números (ex.: ultimoTrimestre da análise); `novo` é o balanço
 * divulgado depois (provisório da B3 ou aguardando a CVM), quando existe.
 */
export function baseDoBalanco(dataBase: string, novo: BalancoNovo | null = null): BaseDoBalanco {
  const rotulo = rotuloDoPeriodo(dataBase)
  const provisorio = novo?.situacao === 'provisorio-b3'
  const aguardando = novo?.situacao === 'aguardando-cvm'
  return {
    dataBase,
    rotulo,
    estado: provisorio ? 'provisorio' : aguardando ? 'aguardando-cvm' : 'atualizado',
    texto: `Base: ${rotulo}${provisorio ? ' provisório' : ''} · balanço de ${dataBr(dataBase)}`,
    pendencia: aguardando ? `${novo.rotulo} divulgado, ainda não incorporado (aguardando a CVM)` : null,
  }
}
