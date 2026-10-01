// Relatório de DIAGNÓSTICO de uma nota de negociação, para validar o parser contra um PDF real
// sem que o PDF, a senha ou os dados pessoais saiam do computador da pessoa.
//
// A pessoa roda a ferramenta localmente, lê o relatório e, se quiser, cola o texto. Por isso o
// relatório é SEGURO POR CONSTRUÇÃO, e há testes para isso:
//   - tudo que vem ANTES da tabela "Negócios realizados" (cabeçalho com nome, CPF, endereço,
//     telefone, conta) é omitido, exceto os rótulos "Nr. nota" e "Data pregão" e a linha de valores
//     logo abaixo, com os dígitos do número da nota trocados por "#";
//   - qualquer célula com cara de CPF, CNPJ, telefone ou número longo (conta, cliente) vira [oculto];
//   - a senha nunca entra: este módulo nem recebe a senha.
// Valores de negócios e totais ficam visíveis: são justamente o que precisa ser conferido.
import type { NotaNegociacao } from './notaSinacor'
import type { LinhaPdf } from './pdf'
import { normalizarCabecalho } from './celulas'

const RE_MONETARIO = /^-?\d[\d.]*,\d{1,6}(\s+[DC])?$/
const RE_INTEIRO_CURTO = /^\d{1,3}(\.\d{3})*$/
const RE_DATA = /^\d{2}\/\d{2}\/\d{4}$/
const RE_SENSIVEL = [
  /\d{3}\.\d{3}\.\d{3}-\d{2}/, // CPF
  /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/, // CNPJ
  /\d{8,}/, // conta, código de cliente, nº de documento
  /\d{4,5}-\d{3,4}/, // telefone, CEP
  /\(\d{2}\)\s?\d/, // telefone com DDD
]

/** Oculta o que parece dado pessoal. Valores monetários e quantidades passam. */
export function mascararCelula(texto: string): string {
  const t = texto.trim()
  if (RE_MONETARIO.test(t) || RE_INTEIRO_CURTO.test(t) || RE_DATA.test(t)) return t
  return RE_SENSIVEL.some((r) => r.test(t)) ? '[oculto]' : t
}

/** Valor sob "Nr. nota": mantém só o formato (dígitos viram #), mantém a data. */
function mascararValorDeCabecalho(texto: string): string {
  const t = texto.trim()
  return RE_DATA.test(t) ? t : t.replace(/\d/g, '#')
}

const ehLinhaDeCabecalhoDaTabela = (l: LinhaPdf) => {
  const t = normalizarCabecalho(l.texto)
  return t.includes('C/V') && t.includes('QUANTIDADE') && t.includes('ESPECIFICACAO')
}

const f1 = (n: number) => String(Math.round(n * 10) / 10)

function descreverLinha(l: LinhaPdf, mascarar: (t: string) => string): string {
  const celulas = l.celulas.map((c) => `${f1(c.x)}–${f1(c.xFim)} "${mascarar(c.texto)}"`).join('  |  ')
  return `p${l.pagina} y=${f1(l.y)}  ${celulas}`
}

export interface MetaRelatorio {
  versaoPdfjs?: string
  paginas?: number
}

export function relatorioDiagnostico(linhas: LinhaPdf[], nota: NotaNegociacao | null, erro: string | null, meta: MetaRelatorio = {}): string {
  const out: string[] = []
  out.push('=== DIAGNÓSTICO DE NOTA DE NEGOCIAÇÃO ===')
  out.push('Dados pessoais do cabeçalho omitidos. Revise este texto antes de compartilhar.')
  if (meta.versaoPdfjs) out.push(`pdf.js ${meta.versaoPdfjs}`)
  out.push(`páginas: ${meta.paginas ?? '?'}  linhas de texto: ${linhas.length}`)
  out.push('')

  if (erro) out.push(`ERRO: ${erro}`, '')

  if (nota) {
    out.push('--- LEITURA ---')
    out.push(`conferida (as contas da nota fecham): ${nota.conferida ? 'SIM' : 'NÃO'}`)
    out.push(`nº da nota lido: ${nota.numero ? `sim (${nota.numero.length} caracteres)` : 'NÃO'}`)
    out.push(`data do pregão: ${nota.dataPregao ?? 'não lida'} (origem: ${nota.origemDataPregao})`)
    out.push(`negócios lidos: ${nota.negocios.length}`)
    for (const n of nota.negocios) {
      out.push(`  ${n.compraVenda} ${n.mercado} [${n.categoria}] | ${n.especificacao} | ticker=${n.ticker ?? '-'} | obs="${n.observacoes}" | ${n.quantidade} x ${n.preco} = ${n.valor} ${n.debitoCredito ?? ''}`)
    }
    out.push('verificações:')
    for (const v of nota.verificacoes) out.push(`  [${v.ok ? 'ok' : 'FALHOU'}] ${v.nome}: esperado ${v.esperado} / obtido ${v.obtido}`)
    out.push(`resumo lido: ${JSON.stringify(nota.resumo)}`)
    for (const a of nota.avisos) out.push(`aviso: ${a}`)
    out.push('')
  }

  out.push('--- ESTRUTURA DO PDF (x inicial–final, texto) ---')
  const iCab = linhas.findIndex(ehLinhaDeCabecalhoDaTabela)
  const limite = iCab < 0 ? 0 : iCab
  if (iCab < 0) out.push('(tabela "Negócios realizados" não encontrada: todo o conteúdo foi omitido por segurança)')

  // Antes da tabela: só os rótulos de nº da nota/data do pregão e a linha de valores logo abaixo.
  let omitidas = 0
  for (let i = 0; i < limite; i++) {
    const t = normalizarCabecalho(linhas[i].texto)
    const ehRotulo = t.includes('NR NOTA') || t.includes('DATA PREGAO')
    const ehValores = i > 0 && (() => {
      const anterior = normalizarCabecalho(linhas[i - 1].texto)
      return anterior.includes('NR NOTA') || anterior.includes('DATA PREGAO')
    })()
    if (ehRotulo) out.push(descreverLinha(linhas[i], mascararCelula))
    else if (ehValores) out.push(descreverLinha(linhas[i], mascararValorDeCabecalho))
    else omitidas++
  }
  if (omitidas) out.push(`[${omitidas} linha(s) do cabeçalho omitida(s)]`)

  // Da tabela em diante: negócios, resumo e rodapé, com máscara por célula.
  if (iCab >= 0) for (const l of linhas.slice(iCab)) out.push(descreverLinha(l, mascararCelula))
  return out.join('\n')
}
