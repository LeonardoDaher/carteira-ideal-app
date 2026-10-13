// Content-Security-Policy por hash dos scripts inline (D87, fase 3 do CSP).
//
// Por quê: o cabeçalho do vercel.json é estático e precisa dizer `script-src 'self' 'unsafe-inline'`,
// porque o app é um arquivo único com um script inline de ~1,7 MB cujo hash muda a cada build. Aqui, no
// fim do build, cada HTML recebe uma <meta http-equiv="Content-Security-Policy"> com `script-src 'self'`
// e o hash (sha256) de cada script inline que ele realmente tem. Quando duas políticas valem ao mesmo
// tempo (cabeçalho + meta), o navegador exige que a página passe nas duas: scripts inline que não
// estejam na lista de hashes (ou seja, qualquer um injetado) são bloqueados.
//
// Regras:
//  - blocos <script type="application/ld+json"> (dados, não executam) ficam de fora;
//  - atributos de evento inline (onclick="...") e URLs "javascript:" não têm como ser permitidos sem
//    'unsafe-inline': o build FALHA se algum aparecer, em vez de publicar uma página que não funciona;
//  - a meta vai logo depois de <meta charset>, antes de qualquer script, porque só vale para o que vem depois;
//  - rodar duas vezes não duplica a meta (o id marca a que foi gerada aqui).
import { createHash } from 'node:crypto'

export const ID_META = 'csp-scripts'

const RE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
const RE_TIPO = /\btype\s*=\s*["']([^"']+)["']/i
const RE_SRC = /\bsrc\s*=/i
const TIPOS_QUE_EXECUTAM = new Set(['', 'module', 'text/javascript', 'application/javascript', 'text/babel'])

/** Scripts inline que o navegador executa (os que a política precisa conhecer). */
export function scriptsInline(html) {
  const lista = []
  for (const m of html.matchAll(RE_SCRIPT)) {
    const attrs = m[1]
    if (RE_SRC.test(attrs)) continue
    const tipo = (RE_TIPO.exec(attrs)?.[1] ?? '').trim().toLowerCase()
    if (!TIPOS_QUE_EXECUTAM.has(tipo)) continue
    lista.push({ tipo: tipo || 'js', conteudo: m[2] })
  }
  return lista
}

export function hashDe(conteudo) {
  return `'sha256-${createHash('sha256').update(conteudo, 'utf8').digest('base64')}'`
}

/** Atributos de evento ("onclick=...") e URLs "javascript:" fora dos blocos de script: não passam em CSP sem 'unsafe-inline'. */
export function usosInlineProibidos(html) {
  const semScripts = html.replace(RE_SCRIPT, '').replace(/<!--[\s\S]*?-->/g, '')
  const achados = []
  for (const m of semScripts.matchAll(/<[a-z][^>]*\s(on[a-z]+)\s*=\s*["'][^"']*["'][^>]*>/gi)) {
    achados.push(`atributo ${m[1]} em ${m[0].slice(0, 80)}`)
  }
  for (const m of semScripts.matchAll(/(?:href|src|action)\s*=\s*["']\s*javascript:[^"']*["']/gi)) {
    achados.push(`url javascript: ${m[0].slice(0, 80)}`)
  }
  return achados
}

export function politicaDeScripts(html) {
  const hashes = [...new Set(scriptsInline(html).map((s) => hashDe(s.conteudo)))]
  // script-src-attr 'none': inline handlers nunca (redundante com o script-src, mas explícito).
  return `script-src 'self' ${hashes.join(' ')}`.replace(/\s+/g, ' ').trim() + "; script-src-attr 'none'"
}

/** Devolve o HTML com a meta da política (substitui a gerada antes, se houver). Lança se houver uso inline proibido. */
export function injetarCspMeta(html, nome = 'html') {
  // Arquivo que não é documento HTML (ex.: o de verificação do Google, só texto) não é tocado: o conteúdo tem de ficar idêntico.
  if (!/<html[\s>]/i.test(html) && !/<head[\s>]/i.test(html)) {
    if (scriptsInline(html).length > 0) throw new Error(`[csp] ${nome}: tem script mas não tem <head>.`)
    return html
  }
  const proibidos = usosInlineProibidos(html)
  if (proibidos.length > 0) {
    throw new Error(`[csp] ${nome}: uso inline que a política não permite:\n  - ${proibidos.join('\n  - ')}`)
  }
  // Remove exatamente o que esta função inseriu antes (quebra de linha + recuo + meta), para rodar de novo dar o mesmo HTML.
  const semMetaAntiga = html.replace(new RegExp(`\\n    <meta\\s+id="${ID_META}"[^>]*>|<meta\\s+id="${ID_META}"[^>]*>`, 'i'), '')
  const meta = `<meta id="${ID_META}" http-equiv="Content-Security-Policy" content="${politicaDeScripts(semMetaAntiga).replace(/"/g, '&quot;')}">`
  const charset = /<meta\s+charset\s*=\s*["']?[^>]*>/i.exec(semMetaAntiga)
  if (charset) {
    const fim = charset.index + charset[0].length
    return semMetaAntiga.slice(0, fim) + '\n    ' + meta + semMetaAntiga.slice(fim)
  }
  const head = /<head[^>]*>/i.exec(semMetaAntiga)
  if (head) {
    const fim = head.index + head[0].length
    return semMetaAntiga.slice(0, fim) + '\n    ' + meta + semMetaAntiga.slice(fim)
  }
  throw new Error(`[csp] ${nome}: não achei <head> para inserir a política.`)
}

/** Confere um HTML já protegido: a meta existe, vem antes do primeiro script e lista o hash de cada script inline. */
export function conferirHtml(html) {
  const problemas = []
  if (!/<html[\s>]/i.test(html) && !/<head[\s>]/i.test(html) && scriptsInline(html).length === 0) return problemas
  const meta = new RegExp(`<meta\\s+id="${ID_META}"[^>]*content="([^"]*)"`, 'i').exec(html)
  if (!meta) return ['sem a meta de CSP']
  const politica = meta[1].replace(/&quot;/g, '"')
  const posMeta = meta.index
  const primeiroScript = html.search(/<script\b/i)
  if (primeiroScript !== -1 && primeiroScript < posMeta) problemas.push('há <script> antes da meta de CSP')
  if (politica.includes("'unsafe-inline'")) problemas.push("a meta contém 'unsafe-inline'")
  for (const s of scriptsInline(html)) {
    if (!politica.includes(hashDe(s.conteudo))) problemas.push(`hash ausente para script inline de ${s.conteudo.length} bytes`)
  }
  return problemas
}
