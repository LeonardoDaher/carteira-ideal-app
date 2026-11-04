import { registrarDados } from './arquivosMercado'
import type { SnapshotBdrsDesconto } from '../domain/top15Mercado'

/**
 * Ranking "BDRs com maior desconto de preço" (gerado por scripts/atualizar-top15-mercado.mjs, D70). Um módulo por arquivo de mercado (D139): a tela que
 * importa este módulo baixa só `dados/bdrsDesconto.json`, não os outros seis rankings. Antes eram sete num módulo só
 * (`snapshotTop15Mercado.ts`). Com a publicação ainda não aprovada o arquivo vem com `publicado: false` e sem lista.
 */
export let SNAPSHOT_BDRS_DESCONTO = undefined as unknown as SnapshotBdrsDesconto
registrarDados<SnapshotBdrsDesconto>('bdrsDesconto', (d) => {
  SNAPSHOT_BDRS_DESCONTO = d
})
