// Adaptador de PDF para as notas de corretagem/negociação. Só faz o trabalho GENÉRICO e
// independente de corretora: abrir o PDF (com senha), tirar o texto com suas coordenadas e
// reconstruir as LINHAS e as células de cada linha. Interpretar o layout de uma corretora
// específica (onde fica a quantidade, o preço, as taxas) é outra camada, que depende de
// notas reais e ainda não existe.
//
// Privacidade: o PDF e a senha ficam NO NAVEGADOR. A senha (em geral parte do CPF/CNPJ; em
// uma corretora conferida são os 3 últimos dígitos) nunca é gravada, registrada em log nem
// enviada. O chamador deve guardá-la só em memória, no máximo durante a importação em lote.
//
// Biblioteca: pdfjs-dist, build "legacy" (funciona no navegador e no Node dos testes). No
// navegador é preciso informar `workerSrc`; no Node dos testes não.

export class SenhaNecessariaError extends Error {
  constructor() {
    super('Este PDF é protegido por senha.')
    this.name = 'SenhaNecessariaError'
  }
}

export class SenhaIncorretaError extends Error {
  constructor() {
    super('Senha incorreta.')
    this.name = 'SenhaIncorretaError'
  }
}

export class PdfInvalidoError extends Error {
  constructor() {
    super('Não foi possível ler este PDF. Ele pode estar corrompido ou ser uma imagem escaneada.')
    this.name = 'PdfInvalidoError'
  }
}

export interface CelulaPdf {
  /** Posição horizontal do início do texto (pontos do PDF; cresce para a direita). */
  x: number
  /** Posição horizontal do fim do texto. Números alinhados à direita são comparados por aqui. */
  xFim: number
  texto: string
}

export interface LinhaPdf {
  pagina: number
  /** Posição vertical (cresce para cima). */
  y: number
  /** Textos da linha, da esquerda para a direita, já agrupados em células. */
  celulas: CelulaPdf[]
  /** A linha inteira como texto corrido, células separadas por espaço. */
  texto: string
}

export interface OpcoesPdf {
  /** Endereço do worker do pdf.js. Obrigatório no navegador. */
  workerSrc?: string
  /** Itens com diferença de y até esta tolerância ficam na mesma linha. */
  toleranciaY?: number
  /** Texto mais distante que isto (em pontos) do anterior abre uma nova célula. Um espaço entre palavras mede cerca de 2,5 pt. Ajustar por corretora se necessário. */
  distanciaCelula?: number
}

interface ItemTexto {
  str: string
  transform: number[]
  width: number
}

export async function lerLinhasPdf(bytes: ArrayBuffer | Uint8Array, senha?: string, opcoes: OpcoesPdf = {}): Promise<LinhaPdf[]> {
  const { toleranciaY = 2, distanciaCelula = 3 } = opcoes
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (opcoes.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = opcoes.workerSrc

  // O pdf.js assume a posse do buffer; passamos uma cópia para o chamador poder tentar de novo com outra senha.
  const copia = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice()

  const tarefa = pdfjs.getDocument({ data: copia, password: senha, verbosity: 0 })
  let doc
  try {
    doc = await tarefa.promise
  } catch (e) {
    await tarefa.destroy().catch(() => undefined)
    const err = e as { name?: string; code?: number }
    if (err.name === 'PasswordException') {
      // code 1 = nenhuma senha informada; code 2 = senha informada e errada.
      throw err.code === 2 ? new SenhaIncorretaError() : new SenhaNecessariaError()
    }
    throw new PdfInvalidoError()
  }

  const linhas: LinhaPdf[] = []
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const pagina = await doc.getPage(p)
      const conteudo = await pagina.getTextContent()
      const itens = (conteudo.items as ItemTexto[]).filter((i) => typeof i.str === 'string' && i.str.trim() !== '')

      // Agrupa por y (de cima para baixo) e ordena por x dentro da linha.
      const ordenados = [...itens].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])
      let atual: ItemTexto[] = []
      let yAtual = Number.NaN
      const fechar = () => {
        if (!atual.length) return
        const porX = [...atual].sort((a, b) => a.transform[4] - b.transform[4])
        const celulas: CelulaPdf[] = []
        let fimAnterior = -Infinity
        for (const it of porX) {
          const x = it.transform[4]
          const folga = x - fimAnterior
          // Continua a mesma célula só se o texto começa logo depois do anterior. Se começar ANTES
          // de o anterior terminar (sobreposição), é outra coluna, não uma continuação.
          if (celulas.length && folga >= -0.5 && folga <= distanciaCelula) {
            const ultima = celulas[celulas.length - 1]
            ultima.texto += (folga > 0.5 ? ' ' : '') + it.str.trim()
            ultima.xFim = x + it.width
          } else {
            celulas.push({ x, xFim: x + it.width, texto: it.str.trim() })
          }
          fimAnterior = x + it.width
        }
        linhas.push({ pagina: p, y: yAtual, celulas, texto: celulas.map((c) => c.texto).join(' ') })
        atual = []
      }
      for (const it of ordenados) {
        const y = it.transform[5]
        if (Number.isNaN(yAtual) || Math.abs(y - yAtual) > toleranciaY) {
          fechar()
          yAtual = y
        }
        atual.push(it)
      }
      fechar()
      yAtual = Number.NaN
    }
  } finally {
    await tarefa.destroy() // libera o worker e a memória do documento
  }
  return linhas
}

/** A senha de nota de uma corretora conferida: exatamente 3 dígitos. Outras podem usar regras diferentes. */
export function senhaValidaDe3Digitos(texto: string): boolean {
  return /^\d{3}$/.test(texto.trim())
}
