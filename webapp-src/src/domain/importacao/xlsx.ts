// Adaptador fino entre o arquivo .xlsx e a Matriz que o núcleo entende. Fica separado para
// que o núcleo (planilha.ts) continue puro e a biblioteca só seja carregada quando alguém
// de fato importar um XLSX (import dinâmico).
//
// Biblioteca: read-excel-file. O pacote "xlsx" do npm está parado na 0.18.5, com falhas de
// segurança conhecidas, e por isso não foi usado. A leitura acontece no navegador: o arquivo
// nunca é enviado a servidor.
import type { Matriz } from './celulas'

export interface Aba {
  nome: string
  dados: Matriz
}

export async function lerXlsx(bytes: ArrayBuffer): Promise<Aba[]> {
  const { default: lerPlanilha } = await import('read-excel-file/universal')
  const abas = await lerPlanilha(bytes)
  return abas.map((a) => ({ nome: a.sheet, dados: a.data as Matriz }))
}
