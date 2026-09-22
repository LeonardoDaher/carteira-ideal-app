/**
 * Barrel de compatibilidade: o conteúdo real das análises foi dividido em um arquivo
 * por ativo dentro de `./analises/` (ver `analises/index.ts`), porque um único arquivo
 * de ~600 linhas misturando os 15 ativos dificultava editar o texto de um deles sem
 * abrir o conteúdo de todos os outros. Este arquivo só reexporta a API pública para que
 * o resto do app continue importando de `data/recomendacoes` sem mudanças.
 */
export type { AnaliseAtivo, BlocoAnalise, ItemRecomendado, ObjetivoAlocacao, SetorGrafico } from './analises/types'
export { ANALISES } from './analises'
