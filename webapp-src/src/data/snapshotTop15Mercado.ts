import { registrarDados } from './arquivosMercado'
import type { SnapshotBdrsDesconto, SnapshotEtfsMaisNegociados, SnapshotIndice } from '../domain/top15Mercado'

/**
 * Rankings "Top 15 ETFs mais negociados" e "Top 15 BDRs com maior desconto de preço" gerados por
 * scripts/atualizar-top15-mercado.mjs (D70). Ponto único de leitura dos JSONs (mesmo padrão de
 * snapshotFiiBaratos.ts). Enquanto o responsável não aprovar a publicação em config/top15-etfs.json e
 * config/top15-bdrs.json, os arquivos vêm com `publicado: false` e sem lista. No BDR, com o acesso por código, o
 * arquivo traz só o cabeçalho e a lista vem da função api/top15-bdrs.
 */
export let SNAPSHOT_ETFS_MAIS_NEGOCIADOS = undefined as unknown as SnapshotEtfsMaisNegociados
registrarDados<SnapshotEtfsMaisNegociados>('etfsMaisNegociados', (d) => {
  SNAPSHOT_ETFS_MAIS_NEGOCIADOS = d
})
export let SNAPSHOT_BDRS_DESCONTO = undefined as unknown as SnapshotBdrsDesconto
registrarDados<SnapshotBdrsDesconto>('bdrsDesconto', (d) => {
  SNAPSHOT_BDRS_DESCONTO = d
})
export let SNAPSHOT_FIIS_MAIS_NEGOCIADOS = undefined as unknown as SnapshotEtfsMaisNegociados
registrarDados<SnapshotEtfsMaisNegociados>('fiisMaisNegociados', (d) => {
  SNAPSHOT_FIIS_MAIS_NEGOCIADOS = d
})
export let SNAPSHOT_ACOES_MAIS_NEGOCIADAS = undefined as unknown as SnapshotEtfsMaisNegociados
registrarDados<SnapshotEtfsMaisNegociados>('acoesMaisNegociadas', (d) => {
  SNAPSHOT_ACOES_MAIS_NEGOCIADAS = d
})
export let SNAPSHOT_BDRS_MAIS_NEGOCIADOS = undefined as unknown as SnapshotEtfsMaisNegociados
registrarDados<SnapshotEtfsMaisNegociados>('bdrsMaisNegociados', (d) => {
  SNAPSHOT_BDRS_MAIS_NEGOCIADOS = d
})
export let SNAPSHOT_IFIX_MAIORES_PESOS = undefined as unknown as SnapshotIndice
registrarDados<SnapshotIndice>('ifixMaioresPesos', (d) => {
  SNAPSHOT_IFIX_MAIORES_PESOS = d
})
export let SNAPSHOT_IBOV_MAIORES_PESOS = undefined as unknown as SnapshotIndice
registrarDados<SnapshotIndice>('ibovMaioresPesos', (d) => {
  SNAPSHOT_IBOV_MAIORES_PESOS = d
})
