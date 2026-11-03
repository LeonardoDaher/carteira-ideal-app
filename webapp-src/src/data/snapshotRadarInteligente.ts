import { registrarDados } from './arquivosMercado'
import type { SnapshotRadarInteligente } from '../domain/radarInteligente'

/** Radar de dividendos inteligente gerado por scripts/atualizar-radar-inteligente.mjs (D132). Ponto único de leitura do JSON. */
export let SNAPSHOT_RADAR_INTELIGENTE = undefined as unknown as SnapshotRadarInteligente
registrarDados<SnapshotRadarInteligente>('radarInteligente', (d) => {
  SNAPSHOT_RADAR_INTELIGENTE = d
})
