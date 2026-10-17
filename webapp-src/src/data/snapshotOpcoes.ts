import dadosOpcoes from './opcoes.json'
import type { SnapshotOpcoes } from '../domain/opcoes'

/**
 * Séries de opções geradas pelo job diário (scripts/atualizar-opcoes.mjs, COTAHIST da B3). Ponto único de leitura
 * do JSON; a conversão passa por `unknown` pelo mesmo motivo de snapshotEtfs.ts: o TypeScript infere `tipo` como
 * texto genérico, e não como 'call' | 'put'. O formato é garantido pelo script e pelos testes dele.
 */
export const SNAPSHOT_OPCOES = dadosOpcoes as unknown as SnapshotOpcoes
