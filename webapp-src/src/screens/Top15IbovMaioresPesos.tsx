import { SNAPSHOT_IBOV_MAIORES_PESOS } from '../data/snapshotIbovMaioresPesos'
import type { SnapshotIndice } from '../domain/top15Mercado'
import { Top15Indice } from './Top15Indice'

/** Atalho da classe, com o arquivo de dados certo (D70, D71). Importar só este módulo baixa só o arquivo desta classe (D139). */
export function Top15IbovMaioresPesos({ snapshot = SNAPSHOT_IBOV_MAIORES_PESOS }: { snapshot?: SnapshotIndice }) {
  return <Top15Indice classe="ibov" snapshot={snapshot} />
}
