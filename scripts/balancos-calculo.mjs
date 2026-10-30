// Balanços trimestrais das empresas para a aba "Balanços" do Simule Ações. Módulo PURO: sem internet, sem disco e sem relógio.
// Entrada = linhas das demonstrações da CVM (ITR/DFP) já extraídas por atualizar-fundamentos.mjs (extrairParaFundamentos);
// saída = trimestres ISOLADOS (o 4º é o exercício menos os 9 meses do 3º), em R$ MIL, e a previsão da próxima divulgação.
//
// Previsão da data: a B3 não publica calendário em dado aberto, então a data é ESTIMADA pelo padrão da própria empresa (quantos dias
// depois do fim do trimestre ela divulgou o mesmo trimestre nos anos anteriores). O prazo legal (45 dias para o ITR, 3 meses para a
// DFP) vai junto como teto. Valor ausente é null, nunca zero.

import { diasEntre, semAcento } from './acoes-baratas-calculo.mjs'

const mil = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v / 1000))
const somaDias = (data, dias) => new Date(Date.parse(`${data}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10)
const somaMeses = (data, meses) => {
  const [a, m, d] = data.split('-').map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth(), Math.min(d, ultimo))).toISOString().slice(0, 10)
}
const mediana = (v) => {
  const o = [...v].sort((a, b) => a - b)
  const m = o.length >> 1
  return o.length % 2 ? o[m] : Math.round((o[m - 1] + o[m]) / 2)
}

/** "2026-06-30" → "2T26" (ano fiscal igual ao civil); outra data-base vira a própria data. */
export function rotuloDoTrimestre(dtRefer) {
  const t = { '03-31': 1, '06-30': 2, '09-30': 3, '12-31': 4 }[dtRefer.slice(5)]
  return t ? `${t}T${dtRefer.slice(2, 4)}` : dtRefer
}

const ehLucroFinanceira = (l) => l.dem === 'DRE' && /^3\.\d{2}$/.test(l.cd) && /^(lucro ou prejuizo|lucro\/prejuizo|resultado liquido do periodo)/.test(semAcento(l.ds)) && /periodo|exercicio/.test(semAcento(l.ds))
const ehPlFinanceira = (l) => l.dem === 'BPP' && /^2\.\d{2}$/.test(l.cd) && /^patrimonio liquido/.test(semAcento(l.ds))

const duracao = (l) => (l.dtIni ? diasEntre(l.dtIni, l.dtFim) : 0)

/**
 * Leitor de um documento (ITR ou DFP) já na versão vigente: `fluxo(cd, janela)` devolve o valor do período do fluxo cuja duração
 * (em dias) cai na janela [min, max]; `saldo(cd)` o saldo do balanço na data-base.
 */
function leitorDoDocumento(linhas, doc, dtRefer, cons) {
  const doDoc = linhas.filter((l) => l.doc === doc && l.dtRefer === dtRefer && l.cons === cons && l.ordem === 'ULTIMO')
  const fluxo = (filtro, [min, max]) => {
    const achadas = doDoc.filter((l) => l.dem === 'DRE' && filtro(l) && duracao(l) >= min && duracao(l) <= max)
    if (!achadas.length) return null
    // Linhas do mesmo código com a mesma duração (não deveria haver) → a primeira, que é a ordem canônica do extrator.
    return achadas[0].valor
  }
  const saldo = (filtro) => {
    const l = doDoc.find((x) => (x.dem === 'BPA' || x.dem === 'BPP') && filtro(x))
    return l ? l.valor : null
  }
  const dtIniDe = (cd) => doDoc.find((l) => l.dem === 'DRE' && l.cd === cd && l.dtIni)?.dtIni ?? null
  return { fluxo, saldo, doDoc, dtIniDe }
}

const porCodigo = (cd) => (l) => l.cd === cd

/** Escolhe 'con' se houver DRE consolidada com 3.01 ou 3.05, senão 'ind'. */
function consolidacaoDoDocumento(linhas, d) {
  const tem = (cons) => linhas.some((l) => l.doc === d.doc && l.dtRefer === d.dtRefer && l.cons === cons && l.dem === 'DRE' && (l.cd === '3.05' || l.cd === '3.01'))
  return tem('con') ? 'con' : tem('ind') ? 'ind' : null
}

/** Lê o que importa de um documento: fluxos em uma janela de duração e saldos. Fluxos em R$ unidades (o arredondamento a mil é no fim). */
function lerDocumento(linhas, d, cons, financeira, janela) {
  const r = leitorDoDocumento(linhas, d.doc, d.dtRefer, cons)
  const lucroCd = financeira ? r.doDoc.filter(ehLucroFinanceira).map((l) => l.cd).sort().at(-1) ?? null : '3.11'
  const lucroLinha = (cd) => r.fluxo(porCodigo(cd), janela)
  const controladoresCd = lucroCd ? r.doDoc.filter((l) => l.dem === 'DRE' && l.cd.startsWith(`${lucroCd}.`) && (financeira ? /controlador|socios da empresa/.test(semAcento(l.ds)) && !/nao controlador/.test(semAcento(l.ds)) : l.cd === '3.11.01')).map((l) => l.cd)[0] : null
  const caixa = r.saldo(porCodigo('1.01.01'))
  const aplic = r.saldo(porCodigo('1.01.02'))
  const dc = r.saldo(porCodigo('2.01.04'))
  const dl = r.saldo(porCodigo('2.02.01'))
  return {
    receita: r.fluxo(porCodigo('3.01'), janela),
    ebit: financeira ? null : r.fluxo(porCodigo('3.05'), janela),
    lucroLiquido: lucroCd ? lucroLinha(lucroCd) : null,
    lucroControladores: controladoresCd ? lucroLinha(controladoresCd) : null,
    ativoTotal: r.saldo(porCodigo('1')),
    patrimonioLiquido: financeira ? r.saldo(ehPlFinanceira) : r.saldo(porCodigo('2.03')),
    caixa: financeira ? null : caixa == null && aplic == null ? null : (caixa ?? 0) + (aplic ?? 0),
    divida: financeira ? null : dc == null && dl == null ? null : (dc ?? 0) + (dl ?? 0),
    dtIni: r.dtIniDe('3.01'),
  }
}

const JANELA_TRIMESTRE = [80, 100]
const JANELA_ACUMULADO_9M = [265, 280]
const JANELA_ANO = [355, 372]

/**
 * Trimestres isolados de uma empresa, do mais antigo ao mais recente. `c` = { docs, linhas } da CVM só desta empresa.
 * Q1–Q3 vêm do ITR (coluna do trimestre); Q4 = DFP (ano) − ITR do 3º trimestre (9 meses). Trimestre sem os dados necessários é omitido.
 */
export function trimestresDaEmpresa({ c, financeira = false, dataCorte, maximo = 8 }) {
  const docs = c.docs.filter((d) => d.dtRefer <= dataCorte && (!d.dtReceb || d.dtReceb <= dataCorte))
  const itr = docs.filter((d) => d.doc === 'ITR')
  const dfp = docs.filter((d) => d.doc === 'DFP')
  const saida = []

  for (const d of itr) {
    const cons = consolidacaoDoDocumento(c.linhas, d)
    if (!cons) continue
    const v = lerDocumento(c.linhas, d, cons, financeira, JANELA_TRIMESTRE)
    if (v.lucroLiquido == null) continue
    saida.push({ periodo: d.dtRefer, tipo: 'ITR', dtReceb: d.dtReceb ?? null, link: d.linkDoc ?? null, cons, v })
  }
  for (const d of dfp) {
    const cons = consolidacaoDoDocumento(c.linhas, d)
    if (!cons) continue
    const t3 = itr.find((x) => diasEntre(x.dtRefer, d.dtRefer) >= 85 && diasEntre(x.dtRefer, d.dtRefer) <= 100)
    if (!t3) continue
    const consT3 = c.linhas.some((l) => l.doc === 'ITR' && l.dtRefer === t3.dtRefer && l.cons === cons) ? cons : null
    if (!consT3) continue
    const ano = lerDocumento(c.linhas, d, cons, financeira, JANELA_ANO)
    const nove = lerDocumento(c.linhas, t3, cons, financeira, JANELA_ACUMULADO_9M)
    const dif = (a, b) => (a == null || b == null ? null : a - b)
    const v = {
      receita: dif(ano.receita, nove.receita),
      ebit: financeira ? null : dif(ano.ebit, nove.ebit),
      lucroLiquido: dif(ano.lucroLiquido, nove.lucroLiquido),
      lucroControladores: dif(ano.lucroControladores, nove.lucroControladores),
      ativoTotal: ano.ativoTotal,
      patrimonioLiquido: ano.patrimonioLiquido,
      caixa: ano.caixa,
      divida: ano.divida,
    }
    if (v.lucroLiquido == null) continue
    saida.push({ periodo: d.dtRefer, tipo: 'DFP', dtReceb: d.dtReceb ?? null, link: d.linkDoc ?? null, cons, v })
  }

  return saida
    .sort((a, b) => (a.periodo < b.periodo ? -1 : 1))
    .slice(-maximo)
    .map(({ periodo, tipo, dtReceb, link, cons, v }) => ({
      periodo,
      rotulo: rotuloDoTrimestre(periodo),
      tipo,
      dtReceb,
      link,
      consolidacao: cons === 'con' ? 'consolidada' : 'individual',
      receita: mil(v.receita),
      ebit: mil(v.ebit),
      lucroLiquido: mil(v.lucroLiquido),
      // A CVM às vezes traz 3.11.01 zerado com lucro diferente de zero (linha sem preenchimento): é dado ausente, não lucro zero.
      lucroControladores: v.lucroControladores === 0 && v.lucroLiquido !== 0 ? null : mil(v.lucroControladores),
      ativoTotal: mil(v.ativoTotal),
      patrimonioLiquido: mil(v.patrimonioLiquido),
      caixa: mil(v.caixa),
      divida: mil(v.divida),
    }))
}

/**
 * Datas de divulgação de cada trimestre (inclui os trimestres antigos que não entraram na análise), do mais antigo ao mais recente:
 * [{ periodo, tipo, dtReceb }]. Só a versão original conta como "divulgação": reapresentações têm DT_RECEB posterior e não mudam o
 * hábito da empresa, então o extrator já devolve a versão vigente; um atraso grande (> 120 dias) é descartado do padrão.
 */
export function divulgacoes(docs, dataCorte) {
  return docs
    .filter((d) => d.dtReceb && d.dtReceb <= dataCorte)
    .map((d) => ({ periodo: d.dtRefer, tipo: d.doc, dtReceb: d.dtReceb, atraso: diasEntre(d.dtRefer, d.dtReceb) }))
    .sort((a, b) => (a.periodo < b.periodo ? -1 : 1))
}

/** Prazo legal da CVM: 45 dias após o fim do trimestre (ITR) e 3 meses após o fim do exercício (DFP). */
export function prazoLegal(periodo, tipo) {
  return tipo === 'DFP' ? somaMeses(periodo, 3) : somaDias(periodo, 45)
}

/** Fim do trimestre seguinte: 31/03 → 30/06 → 30/09 → 31/12 → 31/03. */
export function proximoPeriodo(periodo) {
  const [a, m] = periodo.split('-').map(Number)
  const novo = new Date(Date.UTC(a, m - 1 + 3 + 1, 0))
  return novo.toISOString().slice(0, 10)
}

/**
 * Próxima divulgação: o trimestre seguinte ao último já divulgado. A data estimada é a MEDIANA dos dias que a empresa levou, nos
 * últimos anos, para divulgar o mesmo trimestre (até 3 anos); sem histórico do mesmo trimestre, usa o prazo legal.
 * Devolve { periodo, rotulo, tipo, estimativa, prazoLegal, base, anosNaBase } ou null.
 */
export function proximaDivulgacao(docs, dataCorte) {
  const historico = divulgacoes(docs, dataCorte)
  const ultimo = historico.at(-1)
  if (!ultimo) return null
  const periodo = proximoPeriodo(ultimo.periodo)
  const tipo = periodo.slice(5) === '12-31' ? 'DFP' : 'ITR'
  const mesmo = historico
    .filter((h) => h.periodo.slice(5) === periodo.slice(5) && h.periodo < periodo && h.atraso <= 120)
    .slice(-3)
  const legal = prazoLegal(periodo, tipo)
  if (!mesmo.length) return { periodo, rotulo: rotuloDoTrimestre(periodo), tipo, estimativa: legal, prazoLegal: legal, base: 'prazo_legal', anosNaBase: 0 }
  const dias = mediana(mesmo.map((h) => h.atraso))
  return { periodo, rotulo: rotuloDoTrimestre(periodo), tipo, estimativa: somaDias(periodo, dias), prazoLegal: legal, base: 'historico', anosNaBase: mesmo.length }
}

/** Registro de uma empresa para o app, ou { erro } se não há trimestre algum. */
export function montarBalancoDaEmpresa({ ticker, nome, setor, financeira, cnpj, c, dataCorte }) {
  if (!c?.docs?.length) return { erro: 'Sem DFP/ITR da CVM para esta empresa.' }
  const trimestres = trimestresDaEmpresa({ c, financeira, dataCorte })
  if (!trimestres.length) return { erro: 'Nenhum trimestre com lucro nas demonstrações.' }
  return {
    empresa: {
      ticker,
      nome,
      setor,
      financeira,
      cnpj,
      trimestres,
      proxima: proximaDivulgacao(c.docs, dataCorte),
    },
  }
}

/** Confere o arquivo antes de publicar: devolve a lista de problemas (vazia = ok). */
export function verificarSanidadeBalancos(saida, { minimoEmpresas = 100 } = {}) {
  const erros = []
  const lista = Object.values(saida.empresas ?? {})
  if (lista.length < minimoEmpresas) erros.push(`Só ${lista.length} empresas com balanço (mínimo ${minimoEmpresas}).`)
  const comOito = lista.filter((e) => e.trimestres.length >= 4).length
  if (lista.length && comOito / lista.length < 0.6) erros.push(`Só ${comOito} de ${lista.length} empresas têm 4 trimestres ou mais: layout da CVM mudou?`)
  const comData = lista.filter((e) => e.trimestres.at(-1)?.dtReceb).length
  if (lista.length && comData / lista.length < 0.9) erros.push('Menos de 90% das empresas com data de recebimento do último balanço.')
  return erros
}

/**
 * Balanço recém-divulgado que a CVM ainda não publicou em arquivo aberto : o resumo da B3 (acumulado do exercício) vira o
 * trimestre ISOLADO descontando os trimestres anteriores do mesmo exercício, que já estão nos dados da CVM. Só vale para o trimestre
 * IMEDIATAMENTE seguinte ao último da CVM e para exercício igual ao ano civil. Receita, lucro, ativo e patrimônio líquido; EBIT, caixa e dívida
 * ficam null até a CVM publicar. Devolve o trimestre (com `provisorio: true`) ou null quando não dá para montar com segurança.
 */
export function trimestreProvisorio({ trimestres, b3, entrega, dataCorte }) {
  const ultimo = trimestres.at(-1)
  if (!ultimo || !b3 || b3.periodo <= ultimo.periodo) return null
  if (b3.periodo !== proximoPeriodo(ultimo.periodo)) return null
  const ano = b3.periodo.slice(0, 4)
  if (b3.acumuladoDesde !== `${ano}-01-01`) return null
  const mesesNoAno = Number(b3.periodo.slice(5, 7))
  const anteriores = trimestres.filter((t) => t.periodo.slice(0, 4) === ano && t.periodo < b3.periodo)
  if (anteriores.length !== mesesNoAno / 3 - 1) return null
  const tira = (ytd, campo) => {
    if (ytd == null) return null
    let total = 0
    for (const t of anteriores) {
      if (t[campo] == null) return null
      total += t[campo]
    }
    return ytd - total
  }
  const tipo = b3.periodo.slice(5) === '12-31' ? 'DFP' : 'ITR'
  const q = {
    periodo: b3.periodo,
    rotulo: rotuloDoTrimestre(b3.periodo),
    tipo,
    // Sem o aviso da B3, vale o dia da coleta (o balanço saiu até lá) e a tela marca a data como aproximada.
    dtReceb: entrega?.dia ?? dataCorte,
    ...(entrega ? {} : { dataAproximada: true }),
    link: entrega?.link ?? null,
    consolidacao: b3.consolidacao,
    receita: tira(b3.receita, 'receita'),
    ebit: null,
    lucroLiquido: tira(b3.lucroLiquido, 'lucroLiquido'),
    lucroControladores: tira(b3.lucroControladores, 'lucroControladores'),
    ativoTotal: b3.ativoTotal,
    patrimonioLiquido: b3.patrimonioLiquido,
    caixa: null,
    divida: null,
    provisorio: true,
  }
  return q.lucroLiquido == null ? null : q
}

/** Acrescenta o trimestre provisório (se houver) a uma empresa já montada e recalcula a próxima divulgação com a entrega real. */
export function incorporarB3({ empresa, docs, b3, entrega, dataCorte }) {
  const q = trimestreProvisorio({ trimestres: empresa.trimestres, b3, entrega, dataCorte })
  if (!q) return empresa
  return { ...empresa, trimestres: [...empresa.trimestres, q].slice(-8), proxima: proximaDivulgacao([...docs, { doc: q.tipo, dtRefer: q.periodo, dtReceb: q.dtReceb }], dataCorte) }
}
