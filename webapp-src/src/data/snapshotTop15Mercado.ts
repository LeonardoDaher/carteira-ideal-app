import etfs from './etfsMaisNegociados.json'
import bdrs from './bdrsDesconto.json'
import type { SnapshotBdrsDesconto, SnapshotEtfsMaisNegociados } from '../domain/top15Mercado'

/**
 * Rankings "Top 15 ETFs mais negociados" e "Top 15 BDRs com maior desconto de preço" gerados por
 * scripts/atualizar-top15-mercado.mjs (D70). Ponto único de leitura dos JSONs (mesmo padrão de
 * snapshotFiiBaratos.ts). Enquanto o responsável não aprovar a publicação em config/top15-etfs.json e
 * config/top15-bdrs.json, os arquivos vêm com `publicado: false` e sem lista. No BDR, com o acesso por código, o
 * arquivo traz só o cabeçalho e a lista vem da função api/top15-bdrs.
 */
export const SNAPSHOT_ETFS_MAIS_NEGOCIADOS = etfs as unknown as SnapshotEtfsMaisNegociados
export const SNAPSHOT_BDRS_DESCONTO = bdrs as unknown as SnapshotBdrsDesconto
