import { registrarDados } from './arquivosMercado'
import type { SnapshotIndice } from '../domain/top15Mercado'

/**
 * Ranking "maiores pesos do IFIX" (gerado por scripts/atualizar-top15-mercado.mjs, D70). Um módulo por arquivo de mercado (D139): a tela que
 * importa este módulo baixa só `dados/ifixMaioresPesos.json`, não os outros seis rankings. Antes eram sete num módulo só
 * (`snapshotTop15Mercado.ts`). Com a publicação ainda não aprovada o arquivo vem com `publicado: false` e sem lista.
 */
export let SNAPSHOT_IFIX_MAIORES_PESOS = undefined as unknown as SnapshotIndice
registrarDados<SnapshotIndice>('ifixMaioresPesos', (d) => {
  SNAPSHOT_IFIX_MAIORES_PESOS = d
})
