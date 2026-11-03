import { registrarDados } from './arquivosMercado'
import type { SnapshotAcoesBaratas } from '../domain/acoesBaratas'

/**
 * Triagem "Top 15 mais baratas" gerada por scripts/atualizar-acoes-baratas.mjs (D49). Ponto único
 * de leitura do JSON (mesmo padrão de snapshotAcoes.ts). Enquanto o responsável não aprovar a
 * publicação em config/acoes-baratas.json, o arquivo vem com `publicado: false` e sem ranking.
 */
export let SNAPSHOT_ACOES_BARATAS = undefined as unknown as SnapshotAcoesBaratas
registrarDados<SnapshotAcoesBaratas>('acoesBaratas', (d) => {
  SNAPSHOT_ACOES_BARATAS = d
})
