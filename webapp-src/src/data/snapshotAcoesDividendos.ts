import { registrarDados } from './arquivosMercado'
import type { SnapshotAcoesDividendos } from '../domain/acoesDividendos'

/**
 * "Top 15 ações pagadoras de dividendos" gerado por scripts/atualizar-acoes-dividendos.mjs (D122). Ponto único de leitura do
 * JSON (mesmo padrão de snapshotAcoesEndividadas.ts). Enquanto o responsável não aprovar a publicação em
 * config/acoes-dividendos.json, o arquivo vem com `publicado: false` e sem lista. Acesso aberto: o arquivo traz tudo.
 */
export let SNAPSHOT_ACOES_DIVIDENDOS = undefined as unknown as SnapshotAcoesDividendos
registrarDados<SnapshotAcoesDividendos>('acoesDividendos', (d) => {
  SNAPSHOT_ACOES_DIVIDENDOS = d
})
