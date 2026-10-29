import radarDividendos from './radarDividendos.json'
import type { SnapshotRadarDividendos } from '../domain/radarDividendos'

/** Radar de dividendos gerado por scripts/atualizar-radar-dividendos.mjs (D130). Ponto único de leitura do JSON. */
export const SNAPSHOT_RADAR_DIVIDENDOS = radarDividendos as unknown as SnapshotRadarDividendos
