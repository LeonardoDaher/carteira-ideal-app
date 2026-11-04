import { registrarDados } from './arquivosMercado'
import type { SnapshotEtfsMaisNegociados } from '../domain/top15Mercado'

/**
 * Ranking "FIIs mais negociados" (gerado por scripts/atualizar-top15-mercado.mjs, D70). Um módulo por arquivo de mercado (D139): a tela que
 * importa este módulo baixa só `dados/fiisMaisNegociados.json`, não os outros seis rankings. Antes eram sete num módulo só
 * (`snapshotTop15Mercado.ts`). Com a publicação ainda não aprovada o arquivo vem com `publicado: false` e sem lista.
 */
export let SNAPSHOT_FIIS_MAIS_NEGOCIADOS = undefined as unknown as SnapshotEtfsMaisNegociados
registrarDados<SnapshotEtfsMaisNegociados>('fiisMaisNegociados', (d) => {
  SNAPSHOT_FIIS_MAIS_NEGOCIADOS = d
})
