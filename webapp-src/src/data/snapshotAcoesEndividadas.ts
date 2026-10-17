import acoesEndividadas from './acoesEndividadas.json'
import type { SnapshotAcoesEndividadas } from '../domain/acoesEndividadas'

/**
 * "Top 15 empresas mais endividadas" gerado por scripts/atualizar-acoes-endividadas.mjs (D94). Ponto único de leitura do JSON
 * (mesmo padrão de snapshotTop15Mercado.ts). Enquanto o responsável não aprovar a publicação em config/acoes-endividadas.json, o
 * arquivo vem com `publicado: false` e sem lista. Acesso aberto: o arquivo traz tudo.
 */
export const SNAPSHOT_ACOES_ENDIVIDADAS = acoesEndividadas as unknown as SnapshotAcoesEndividadas
