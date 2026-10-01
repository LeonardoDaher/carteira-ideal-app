// Leitor de CSV (RFC 4180 com aspas), com detecção do separador. O Excel brasileiro salva
// CSV com ";" e vírgula decimal; ferramentas em inglês usam "," ou tabulação.
import type { Matriz } from './celulas'

export function detectarSeparador(texto: string): string {
  const amostra = texto.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 10)
  const candidatos = [';', '\t', ',']
  let melhor = ';'
  let melhorPontos = -1
  for (const sep of candidatos) {
    // Conta só fora de aspas.
    const contagens = amostra.map((linha) => {
      let dentro = false
      let n = 0
      for (const ch of linha) {
        if (ch === '"') dentro = !dentro
        else if (ch === sep && !dentro) n++
      }
      return n
    })
    const primeira = contagens[0] ?? 0
    if (primeira === 0) continue
    // Prefere o separador que aparece o mesmo número de vezes em todas as linhas.
    const consistentes = contagens.filter((n) => n === primeira).length
    const pontos = consistentes * 1000 + primeira
    if (pontos > melhorPontos) {
      melhorPontos = pontos
      melhor = sep
    }
  }
  return melhor
}

export function lerCsv(textoBruto: string, separador?: string): Matriz {
  const texto = textoBruto.replace(/^\uFEFF/, '')
  const sep = separador ?? detectarSeparador(texto)
  const linhas: string[][] = []
  let campo = ''
  let linha: string[] = []
  let dentro = false
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i]
    if (dentro) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else dentro = false
      } else campo += ch
    } else if (ch === '"') {
      dentro = true
    } else if (ch === sep) {
      linha.push(campo)
      campo = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo)
      linhas.push(linha)
      linha = []
      campo = ''
    } else campo += ch
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo)
    linhas.push(linha)
  }
  return linhas
}

/** Decodifica bytes: UTF-8 estrito e, se falhar (CSV do Excel antigo), Windows-1252. */
export function decodificarTexto(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8)
  } catch {
    return new TextDecoder('windows-1252').decode(u8)
  }
}
