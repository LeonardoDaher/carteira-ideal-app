import { registrarDados } from './arquivosMercado'
import { aplicarPrecoDiario } from '../domain/rendaFii'
import type { PrecosDiariosFii, SnapshotRendimentosFii } from '../domain/rendaFii'

/**
 * Rendimentos mensais dos FIIs (CVM) e preço diário (B3) do Simule FII, que antes eram importados direto pela tela (D137: agora
 * baixados sob demanda por `arquivosMercado.ts`). O snapshot "padrão" é a junção dos dois, calculada uma vez, depois que os dois chegam.
 */
let rendimentos: SnapshotRendimentosFii | undefined
let precos: PrecosDiariosFii | undefined
let padrao: SnapshotRendimentosFii | undefined

registrarDados<SnapshotRendimentosFii>('rendimentosFii', (d) => {
  rendimentos = d
  padrao = undefined
})
registrarDados<PrecosDiariosFii>('fiisPreco', (d) => {
  precos = d
  padrao = undefined
})

export function snapshotPadraoFii(): SnapshotRendimentosFii {
  if (!rendimentos || !precos) throw new Error('Dados do Simule FII ainda não foram carregados')
  padrao ??= aplicarPrecoDiario(rendimentos, precos)
  return padrao
}
