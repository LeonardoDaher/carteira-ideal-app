import dadosEtfs from './etfs.json'
import type { SnapshotEtfs } from '../domain/etfs'

/**
 * ETFs gerados pelo job diário (D23). Ponto único de leitura do JSON. A conversão passa por
 * `unknown` pelo mesmo motivo de snapshotMercado.ts e snapshotBdrs.ts: com dados reais, a
 * conversão direta quebrou o build na Vercel (D16). O formato é garantido pelo script e pelos
 * testes dele.
 */
export const SNAPSHOT_ETFS = dadosEtfs as unknown as SnapshotEtfs
