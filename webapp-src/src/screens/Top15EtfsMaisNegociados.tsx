import { SNAPSHOT_ETFS_MAIS_NEGOCIADOS } from '../data/snapshotEtfsMaisNegociados'
import type { SnapshotMaisNegociados } from '../domain/top15Mercado'
import { Top15MaisNegociados } from './Top15MaisNegociados'

/** Atalho da classe, com o arquivo de dados certo (D70, D71). Importar só este módulo baixa só o arquivo desta classe (D139). */
export function Top15EtfsMaisNegociados({ snapshot = SNAPSHOT_ETFS_MAIS_NEGOCIADOS }: { snapshot?: SnapshotMaisNegociados }) {
  return <Top15MaisNegociados classe="etfs" snapshot={snapshot} />
}
