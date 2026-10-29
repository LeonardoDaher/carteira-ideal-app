import radarInteligente from './radarInteligente.json'
import type { SnapshotRadarInteligente } from '../domain/radarInteligente'

/** Radar de dividendos inteligente gerado por scripts/atualizar-radar-inteligente.mjs (D132). Ponto único de leitura do JSON. */
export const SNAPSHOT_RADAR_INTELIGENTE = radarInteligente as unknown as SnapshotRadarInteligente
