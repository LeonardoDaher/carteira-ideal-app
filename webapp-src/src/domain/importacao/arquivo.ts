// Importador de ARQUIVOS DE PLANILHA (CSV, XLSX e extratos da B3). Fica separado do index.ts de
// propósito: este arquivo NÃO importa nada de PDF, então a tela do app pode usá-lo sem arrastar o
// pdf.js (~1,8 MB) para dentro do pacote único.
import { decodificarTexto, lerCsv } from './csv'
import { importarMatriz, type ResultadoImportacao } from './planilha'
import { lerXlsx } from './xlsx'

function falha(msg: string): ResultadoImportacao {
  return { perfil: null, lancamentos: [], avisos: [], erros: [], linhasLidas: 0, erroGeral: msg }
}

export async function importarArquivo(nome: string, bytes: ArrayBuffer): Promise<ResultadoImportacao> {
  const ext = nome.toLowerCase().split('.').pop() ?? ''

  if (ext === 'xls') {
    return falha('Este é um Excel antigo (.xls). Abra no Excel e use "Salvar como" .xlsx, ou exporte como CSV, e importe de novo.')
  }

  if (ext === 'csv' || ext === 'txt' || ext === 'tsv') {
    return importarMatriz(lerCsv(decodificarTexto(bytes)))
  }

  if (ext === 'xlsx') {
    let abas
    try {
      abas = await lerXlsx(bytes)
    } catch {
      return falha('Não conseguimos abrir este arquivo Excel. Ele pode estar corrompido ou protegido por senha.')
    }
    const lidas = abas.map((a) => ({ aba: a.nome, r: importarMatriz(a.dados, a.nome) })).filter((x) => x.r.perfil !== null)
    if (lidas.length === 0) return importarMatriz(abas[0]?.dados ?? [])
    if (lidas.length === 1) return lidas[0].r
    // Várias abas reconhecidas (ex.: a Posição da B3, uma aba por categoria): junta tudo e
    // identifica a aba nos erros. Avisos repetidos entre abas aparecem uma vez só.
    const posicao = lidas.flatMap((x) => x.r.posicao ?? [])
    const futuros = lidas.flatMap((x) => x.r.eventosFuturos ?? [])
    const junto: ResultadoImportacao = {
      perfil: lidas[0].r.perfil,
      lancamentos: lidas.flatMap((x) => x.r.lancamentos),
      avisos: [...new Set(lidas.flatMap((x) => x.r.avisos))],
      erros: lidas.flatMap((x) => x.r.erros.map((e) => ({ ...e, motivo: `[aba ${x.aba}] ${e.motivo}` }))),
      linhasLidas: lidas.reduce((s, x) => s + x.r.linhasLidas, 0),
    }
    if (posicao.length) junto.posicao = posicao
    if (futuros.length) junto.eventosFuturos = futuros
    const naoLidas = abas.filter((a) => !lidas.some((x) => x.aba === a.nome)).map((a) => a.nome)
    if (naoLidas.length) junto.avisos.push(`Abas não reconhecidas e ignoradas: ${naoLidas.join(', ')}.`)
    return junto
  }

  return falha('Formato não suportado. Envie um arquivo .xlsx ou .csv.')
}
