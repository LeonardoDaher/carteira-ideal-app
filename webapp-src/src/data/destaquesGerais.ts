import { SNAPSHOT_ACOES_DIVIDENDOS } from './snapshotAcoesDividendos'
import { SNAPSHOT_ACOES_ENDIVIDADAS } from './snapshotAcoesEndividadas'
import { SNAPSHOT_RADAR_DIVIDENDOS } from './snapshotRadarDividendos'
import { SNAPSHOT_ACOES_MAIS_NEGOCIADAS } from './snapshotAcoesMaisNegociadas'
import { SNAPSHOT_BDRS_MAIS_NEGOCIADOS } from './snapshotBdrsMaisNegociados'
import { SNAPSHOT_ETFS_MAIS_NEGOCIADOS } from './snapshotEtfsMaisNegociados'
import { SNAPSHOT_FIIS_MAIS_NEGOCIADOS } from './snapshotFiisMaisNegociados'
import { SNAPSHOT_IBOV_MAIORES_PESOS } from './snapshotIbovMaioresPesos'
import { SNAPSHOT_IFIX_MAIORES_PESOS } from './snapshotIfixMaioresPesos'
import { indexarDestaques } from '../domain/destaquesRadares'
import type { IndiceDeDestaques } from '../domain/destaquesRadares'

let cache: IndiceDeDestaques | undefined

/**
 * Destaques de todas as classes num só índice (código → destaques), para os exemplos da carteira de referência, que misturam ações,
 * FIIs, BDRs e ETFs. Os códigos não se repetem entre as classes. Montado só na primeira vez que alguém pede (D131).
 */
export function destaquesGerais(): IndiceDeDestaques {
  if (cache) return cache
  const hoje = SNAPSHOT_RADAR_DIVIDENDOS.dataReferencia
  const partes = [
    indexarDestaques({ dividendos: SNAPSHOT_ACOES_DIVIDENDOS, endividadas: SNAPSHOT_ACOES_ENDIVIDADAS, radar: SNAPSHOT_RADAR_DIVIDENDOS, maisNegociados: SNAPSHOT_ACOES_MAIS_NEGOCIADAS, indice: SNAPSHOT_IBOV_MAIORES_PESOS, hoje }),
    indexarDestaques({ maisNegociados: SNAPSHOT_FIIS_MAIS_NEGOCIADOS, indice: SNAPSHOT_IFIX_MAIORES_PESOS, hoje }),
    indexarDestaques({ maisNegociados: SNAPSHOT_BDRS_MAIS_NEGOCIADOS, hoje }),
    indexarDestaques({ maisNegociados: SNAPSHOT_ETFS_MAIS_NEGOCIADOS, hoje }),
  ]
  cache = new Map(partes.flatMap((p) => [...p]))
  return cache
}
