import { registrarDados } from './arquivosMercado'
import type { SnapshotRadarDividendos } from '../domain/radarDividendos'

/** Radar de dividendos gerado por scripts/atualizar-radar-dividendos.mjs (D130). Ponto único de leitura do JSON. */
export let SNAPSHOT_RADAR_DIVIDENDOS = undefined as unknown as SnapshotRadarDividendos
registrarDados<SnapshotRadarDividendos>('radarDividendos', (d) => {
  SNAPSHOT_RADAR_DIVIDENDOS = d
})
