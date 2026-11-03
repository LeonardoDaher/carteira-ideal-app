import { registrarDados } from './arquivosMercado'
import type { SnapshotFuturos } from '../domain/futuros'

/**
 * Futuros gerados pelo job diário (scripts/atualizar-futuros.mjs). Ponto único de leitura do JSON. A conversão passa por
 * `unknown` pelo mesmo motivo de snapshotEtfs.ts: com dados reais, a conversão direta quebrou o build na Vercel (D16).
 * O formato é garantido pelo script e pelos testes dele.
 */
export let SNAPSHOT_FUTUROS = undefined as unknown as SnapshotFuturos
registrarDados<SnapshotFuturos>('futuros', (d) => {
  SNAPSHOT_FUTUROS = d
})
