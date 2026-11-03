import { registrarDados } from './arquivosMercado'
import type { SnapshotMercado } from '../domain/mercadoOficial'

/**
 * Dados oficiais de mercado gerados pelo job semanal (D15). Ponto único de leitura do JSON.
 *
 * A conversão passa por `unknown` de propósito: o TypeScript infere os campos do JSON como
 * texto genérico (ex.: `indexador: string`), e não como a lista fechada do tipo
 * (`'selic' | 'prefixado' | ...`). Com o arquivo vazio a conversão direta passava, mas com os
 * dados reais o build quebrou na Vercel (25/09/2026). O formato é garantido pelo script e
 * pelos testes dele, não pelo compilador.
 */
export let SNAPSHOT_MERCADO = undefined as unknown as SnapshotMercado
registrarDados<SnapshotMercado>('mercadoOficial', (d) => {
  SNAPSHOT_MERCADO = d
})
