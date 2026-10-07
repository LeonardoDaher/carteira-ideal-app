import dados from './fiiBaratos.json'
import type { SnapshotFiiBaratos } from '../domain/fiiBaratos'

/**
 * Triagem "Top 15 FIIs baratos" gerada por scripts/atualizar-fii-baratos.mjs (D65). Ponto único de leitura do
 * JSON (mesmo padrão de snapshotAcoesBaratas.ts). Enquanto o responsável não aprovar a publicação em
 * config/fii-baratos.json, o arquivo vem com `publicado: false` e sem lista. Com o acesso por código, o arquivo
 * traz só o cabeçalho e a lista vem da função api/top15-fiis.
 */
export const SNAPSHOT_FII_BARATOS = dados as unknown as SnapshotFiiBaratos
