import dadosAcoes from './acoes.json'
import type { SnapshotAcoes } from '../domain/acoes'

/**
 * Ações geradas pelo job diário (D43). Ponto único de leitura do JSON. A conversão passa por
 * `unknown` pelo mesmo motivo de snapshotBdrs.ts: o TypeScript infere os campos do JSON como
 * tipos genéricos e a conversão direta quebra o build. O formato é garantido pelo script e
 * pelos testes dele. Antes da primeira carga, o arquivo tem setores vazios e a tela avisa.
 */
export const SNAPSHOT_ACOES = dadosAcoes as unknown as SnapshotAcoes
