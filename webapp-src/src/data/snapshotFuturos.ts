import dadosFuturos from './futuros.json'
import type { SnapshotFuturos } from '../domain/futuros'

/**
 * Futuros gerados pelo job diário (scripts/atualizar-futuros.mjs). Ponto único de leitura do JSON. A conversão passa por
 * `unknown` pelo mesmo motivo de snapshotEtfs.ts: com dados reais, a conversão direta quebrou o build na Vercel (D16).
 * O formato é garantido pelo script e pelos testes dele.
 */
export const SNAPSHOT_FUTUROS = dadosFuturos as unknown as SnapshotFuturos
