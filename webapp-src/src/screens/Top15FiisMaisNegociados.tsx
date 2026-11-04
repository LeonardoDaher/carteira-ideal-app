import { SNAPSHOT_FIIS_MAIS_NEGOCIADOS } from '../data/snapshotFiisMaisNegociados'
import type { SnapshotMaisNegociados } from '../domain/top15Mercado'
import { Top15MaisNegociados } from './Top15MaisNegociados'

/** Atalho da classe, com o arquivo de dados certo (D70, D71). Importar só este módulo baixa só o arquivo desta classe (D139). */
export function Top15FiisMaisNegociados({ snapshot = SNAPSHOT_FIIS_MAIS_NEGOCIADOS }: { snapshot?: SnapshotMaisNegociados }) {
  return <Top15MaisNegociados classe="fiis" snapshot={snapshot} />
}
