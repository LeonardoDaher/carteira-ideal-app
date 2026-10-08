import etfs from './etfsMaisNegociados.json'
import bdrs from './bdrsDesconto.json'
import fiisNeg from './fiisMaisNegociados.json'
import acoesNeg from './acoesMaisNegociadas.json'
import bdrsNeg from './bdrsMaisNegociados.json'
import ifix from './ifixMaioresPesos.json'
import ibov from './ibovMaioresPesos.json'
import type { SnapshotBdrsDesconto, SnapshotEtfsMaisNegociados, SnapshotIndice } from '../domain/top15Mercado'

/**
 * Rankings "Top 15 ETFs mais negociados" e "Top 15 BDRs com maior desconto de preço" gerados por
 * scripts/atualizar-top15-mercado.mjs (D70). Ponto único de leitura dos JSONs (mesmo padrão de
 * snapshotFiiBaratos.ts). Enquanto o responsável não aprovar a publicação em config/top15-etfs.json e
 * config/top15-bdrs.json, os arquivos vêm com `publicado: false` e sem lista. No BDR, com o acesso por código, o
 * arquivo traz só o cabeçalho e a lista vem da função api/top15-bdrs.
 */
export const SNAPSHOT_ETFS_MAIS_NEGOCIADOS = etfs as unknown as SnapshotEtfsMaisNegociados
export const SNAPSHOT_BDRS_DESCONTO = bdrs as unknown as SnapshotBdrsDesconto
export const SNAPSHOT_FIIS_MAIS_NEGOCIADOS = fiisNeg as unknown as SnapshotEtfsMaisNegociados
export const SNAPSHOT_ACOES_MAIS_NEGOCIADAS = acoesNeg as unknown as SnapshotEtfsMaisNegociados
export const SNAPSHOT_BDRS_MAIS_NEGOCIADOS = bdrsNeg as unknown as SnapshotEtfsMaisNegociados
export const SNAPSHOT_IFIX_MAIORES_PESOS = ifix as unknown as SnapshotIndice
export const SNAPSHOT_IBOV_MAIORES_PESOS = ibov as unknown as SnapshotIndice
