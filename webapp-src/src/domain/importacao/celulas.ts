// Minha Carteira (D36): leitura tolerante de células vindas de CSV, XLSX e extratos da B3.
// Tudo aqui é puro e testável. Formatos brasileiros ("1.234,56", "R$ 10,50", "05/03/2026")
// e do Excel (data serial, Date) são aceitos; o que não dá para ler devolve null, nunca um
// valor inventado.
import { normalizarBusca } from '../rendaFii'

export type Celula = string | number | boolean | Date | null | undefined
export type Matriz = Celula[][]

/** "1.234,56" | "R$ 1.234,56" | "(123,45)" | "-" | 12.5 -> número (ou null). */
export function lerNumero(c: Celula): number | null {
  if (c == null || typeof c === 'boolean' || c instanceof Date) return null
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  let s = c.replace(/R\$|\s|\u00a0/g, '')
  if (!s || /^-+$/.test(s)) return null
  let negativo = false
  if (/^\(.*\)$/.test(s)) {
    negativo = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negativo = !negativo
    s = s.slice(1)
  }
  if (!/^[\d.,]+$/.test(s)) return null

  const virgulas = (s.match(/,/g) ?? []).length
  const pontos = (s.match(/\./g) ?? []).length
  if (virgulas > 0 && pontos > 0) {
    // O último separador é o decimal.
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (virgulas > 0) {
    s = virgulas > 1 ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (pontos > 0) {
    // "1.000" e "12.345.678" são milhares; "0.125" e "12.5" são decimais.
    if (/^[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

function isoValido(a: number, m: number, d: number): string | null {
  if (a < 1990 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const t = new Date(Date.UTC(a, m - 1, d))
  if (t.getUTCFullYear() !== a || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Aceita dd/mm/aaaa (dia primeiro, sempre), aaaa-mm-dd, Date e data serial do Excel. */
export function lerData(c: Celula): string | null {
  if (c == null || typeof c === 'boolean') return null
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return null
    // A leitura do XLSX entrega meia-noite UTC; getters locais voltariam um dia no Brasil.
    return isoValido(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate())
  }
  if (typeof c === 'number') {
    if (c < 25569 || c > 73050) return null // 1970..2099
    const t = new Date(Date.UTC(1899, 11, 30) + Math.floor(c) * 86400000)
    return isoValido(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
  }
  const s = c.trim()
  let m = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/)
  if (m) return isoValido(Number(m[1]), Number(m[2]), Number(m[3]))
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
    return isoValido(ano, Number(m[2]), Number(m[1]))
  }
  return null
}

export function lerTexto(c: Celula): string {
  if (c == null) return ''
  if (c instanceof Date) return lerData(c) ?? ''
  return String(c).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Cabeçalho comparável: maiúsculas, sem acento, sem pontuação solta. "Preço unitário" -> "PRECO UNITARIO". */
export function normalizarCabecalho(c: Celula): string {
  return normalizarBusca(lerTexto(c)).replace(/[()*.:]/g, '').replace(/\s+/g, ' ').trim()
}

export function linhaVazia(linha: Celula[]): boolean {
  return linha.every((c) => lerTexto(c) === '')
}
