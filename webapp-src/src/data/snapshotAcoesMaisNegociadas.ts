import { registrarDados } from './arquivosMercado'
import type { SnapshotEtfsMaisNegociados } from '../domain/top15Mercado'

/**
 * Ranking "ações mais negociadas" (gerado por scripts/atualizar-top15-mercado.mjs, D70). Um módulo por arquivo de mercado (D139): a tela que
 * importa este módulo baixa só `dados/acoesMaisNegociadas.json`, não os outros seis rankings. Antes eram sete num módulo só
 * (`snapshotTop15Mercado.ts`). Com a publicação ainda não aprovada o arquivo vem com `publicado: false` e sem lista.
 */
export let SNAPSHOT_ACOES_MAIS_NEGOCIADAS = undefined as unknown as SnapshotEtfsMaisNegociados
registrarDados<SnapshotEtfsMaisNegociados>('acoesMaisNegociadas', (d) => {
  SNAPSHOT_ACOES_MAIS_NEGOCIADAS = d
})
