// Ponto de entrada da importação: recebe o arquivo (nome + bytes) e devolve lançamentos
// prontos para mesclar, mais avisos e erros por linha. Cobre CSV, XLSX e os extratos da B3.
import type { LancamentoNovo } from '../lancamentos'
import { lerNotaSinacor, notaParaLancamentos, type NegocioNota, type NotaNegociacao, type ResolvedorTicker } from './notaSinacor'
import { lerLinhasPdf, type OpcoesPdf } from './pdf'

export { MODELO_CSV, importarMatriz } from './planilha'
export type { ResultadoImportacao, PerfilArquivo, ErroLinha } from './planilha'
export { SenhaIncorretaError, SenhaNecessariaError, PdfInvalidoError } from './pdf'
export { NotaNaoReconhecidaError } from './notaSinacor'

export { importarArquivo } from './arquivo'

export interface ResultadoNota {
  nota: NotaNegociacao
  lancamentos: LancamentoNovo[]
  /** Negócios sem ticker identificado: a pessoa escolhe o ativo e a nota é convertida de novo. */
  pendentes: NegocioNota[]
  avisos: string[]
}

/**
 * Importa UMA nota de negociação em PDF. A senha vem da pessoa e só passa por aqui: não é
 * gravada nem registrada. Lança SenhaNecessariaError, SenhaIncorretaError, PdfInvalidoError ou
 * NotaNaoReconhecidaError para a tela explicar o que houve. Uma nota cujos totais não fecham
 * volta com `lancamentos` vazio e o motivo em `avisos`.
 */
export async function importarNotaPdf(
  bytes: ArrayBuffer,
  senha: string | undefined,
  resolver?: ResolvedorTicker,
  opcoes?: OpcoesPdf,
): Promise<ResultadoNota> {
  const nota = lerNotaSinacor(await lerLinhasPdf(bytes, senha, opcoes))
  const conv = notaParaLancamentos(nota, resolver)
  return { nota, lancamentos: conv.lancamentos, pendentes: conv.pendentes, avisos: [...conv.avisos, ...(nota.conferida ? nota.avisos : [])] }
}
