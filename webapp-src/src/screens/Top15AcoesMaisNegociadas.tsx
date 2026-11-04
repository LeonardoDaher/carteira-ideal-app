import { SNAPSHOT_ACOES_MAIS_NEGOCIADAS } from '../data/snapshotAcoesMaisNegociadas'
import type { SnapshotMaisNegociados } from '../domain/top15Mercado'
import { Top15MaisNegociados } from './Top15MaisNegociados'

/** Atalho da classe, com o arquivo de dados certo (D70, D71). Importar só este módulo baixa só o arquivo desta classe (D139). */
export function Top15AcoesMaisNegociadas({ snapshot = SNAPSHOT_ACOES_MAIS_NEGOCIADAS }: { snapshot?: SnapshotMaisNegociados }) {
  return <Top15MaisNegociados classe="acoes" snapshot={snapshot} />
}
