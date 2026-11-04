import { registrarDados } from './arquivosMercado'
import type { SnapshotAcoesEndividadas } from '../domain/acoesEndividadas'

/**
 * "Top 15 empresas mais endividadas" gerado por scripts/atualizar-acoes-endividadas.mjs (D94). Ponto único de leitura do JSON
 * (mesmo padrão de snapshotFiisMaisNegociados.ts). Enquanto o responsável não aprovar a publicação em config/acoes-endividadas.json, o
 * arquivo vem com `publicado: false` e sem lista. Acesso aberto: o arquivo traz tudo.
 */
export let SNAPSHOT_ACOES_ENDIVIDADAS = undefined as unknown as SnapshotAcoesEndividadas
registrarDados<SnapshotAcoesEndividadas>('acoesEndividadas', (d) => {
  SNAPSHOT_ACOES_ENDIVIDADAS = d
})
