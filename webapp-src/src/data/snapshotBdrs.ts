import dadosBdrs from './bdrs.json'
import type { SnapshotBdrs } from '../domain/bdrs'

/**
 * BDRs gerados pelo job diário (D19). Ponto único de leitura do JSON. A conversão passa por
 * `unknown` pelo mesmo motivo de snapshotMercado.ts: o TypeScript infere os campos do JSON
 * como tipos genéricos (ex.: `tipo: string`), e a conversão direta quebrou o build na Vercel
 * com dados reais (D16). O formato é garantido pelo script e pelos testes dele.
 */
export const SNAPSHOT_BDRS = dadosBdrs as unknown as SnapshotBdrs
