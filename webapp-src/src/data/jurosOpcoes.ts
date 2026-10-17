import { SNAPSHOT_MERCADO } from './snapshotMercado'

/** Juro de partida das contas de opções (% ao ano): a Selic meta atual, ou 14 se o dado ainda não existir. */
export const jurosPadrao = () => SNAPSHOT_MERCADO.indicadores?.selicMeta?.valor ?? 14
