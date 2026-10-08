import { Top15MaisNegociados } from './Top15MaisNegociados'
import type { SnapshotMaisNegociados } from '../domain/top15Mercado'

/**
 * Caixas "Top 15 mais negociados" (D70 e D71). Toda a tela está em Top15MaisNegociados.tsx; aqui ficam só os
 * atalhos de cada classe, com o arquivo de dados certo.
 */
export function Top15EtfsMaisNegociados({ snapshot }: { snapshot?: SnapshotMaisNegociados }) {
  return <Top15MaisNegociados classe="etfs" snapshot={snapshot} />
}

export function Top15FiisMaisNegociados({ snapshot }: { snapshot?: SnapshotMaisNegociados }) {
  return <Top15MaisNegociados classe="fiis" snapshot={snapshot} />
}

export function Top15AcoesMaisNegociadas({ snapshot }: { snapshot?: SnapshotMaisNegociados }) {
  return <Top15MaisNegociados classe="acoes" snapshot={snapshot} />
}

export function Top15BdrsMaisNegociados({ snapshot }: { snapshot?: SnapshotMaisNegociados }) {
  return <Top15MaisNegociados classe="bdrs" snapshot={snapshot} />
}
