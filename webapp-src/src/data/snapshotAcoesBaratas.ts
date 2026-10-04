import dados from './acoesBaratas.json'
import type { SnapshotAcoesBaratas } from '../domain/acoesBaratas'

/**
 * Triagem "Top 15 mais baratas" gerada por scripts/atualizar-acoes-baratas.mjs (D49). Ponto único
 * de leitura do JSON (mesmo padrão de snapshotAcoes.ts). Enquanto o responsável não aprovar a
 * publicação em config/acoes-baratas.json, o arquivo vem com `publicado: false` e sem ranking.
 */
export const SNAPSHOT_ACOES_BARATAS = dados as unknown as SnapshotAcoesBaratas
