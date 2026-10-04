// Cálculo da triagem "Top 15 ações mais baratas" (D49). Módulo PURO: sem internet, sem disco,
// sem relógio. Entrada = `insumos` (congelados em auditoria/acoes-baratas/<data>/insumos.json.gz)
// + `cfg` (config/acoes-baratas.json). Saída = ranking + exclusões + memória de cálculo.
//
// Por que puro: a auditoria só funciona se QUALQUER pessoa puder pegar os mesmos insumos, rodar este
// arquivo e obter exatamente o mesmo hash de resultado (`node scripts/atualizar-acoes-baratas.mjs
// --verificar=<pasta>`). Nada aqui lê data/hora atual: a data de corte vem nos insumos.
//
// A metodologia completa, com cada fórmula e cada conta da CVM, está em
// docs/09-metodologia-acoes-baratas.md. Se mudar a lógica aqui, suba cfg.versaoMetodologia.

import crypto from 'node:crypto'

// ---------------------------------------------------------------------------------------
// Contas da CVM usadas (DFP/ITR). Código + descrição esperada: se a descrição não bater,
// a empresa sai com motivo explícito em vez de usar a conta errada em silêncio.
// ---------------------------------------------------------------------------------------

/** `opcional`: conta que pode não existir na empresa (ausência = 0, registrada na memória). */
export const CONTAS = {
  receita: { dem: 'DRE', cd: '3.01', descricao: /receita/ },
  recuperabilidade: { dem: 'DRE', cd: '3.04.03', opcional: true },
  outrasReceitasOp: { dem: 'DRE', cd: '3.04.04', opcional: true },
  outrasDespesasOp: { dem: 'DRE', cd: '3.04.05', opcional: true },
  equivalencia: { dem: 'DRE', cd: '3.04.06', opcional: true },
  ebit: { dem: 'DRE', cd: '3.05', descricao: /resultado antes do resultado financeiro/ },
  resultadoFinanceiro: { dem: 'DRE', cd: '3.06', opcional: true },
  despesasFinanceiras: { dem: 'DRE', cd: '3.06.02', opcional: true, descricao: /despesas? financeira/ },
  resultadoAntesTributos: { dem: 'DRE', cd: '3.07', opcional: true },
  lucroConsolidado: { dem: 'DRE', cd: '3.11', descricao: /lucro|preju/ },
  lucroControladores: { dem: 'DRE', cd: '3.11.01', opcional: true },
  fco: { dem: 'DFC', cd: '6.01', descricao: /atividades operacionais/ },
  depreciacao: { dem: 'DVA', cd: '7.04.01', opcional: true, descricao: /deprecia|amortiza/ },
}

export const CONTAS_BALANCO = {
  ativoTotal: { dem: 'BPA', cd: '1' },
  caixa: { dem: 'BPA', cd: '1.01.01', descricao: /caixa/ },
  aplicacoes: { dem: 'BPA', cd: '1.01.02', opcional: true },
  passivoTotal: { dem: 'BPP', cd: '2' },
  dividaCurta: { dem: 'BPP', cd: '2.01.04', opcional: true, descricao: /emprestimos|financiamentos/ },
  dividaLonga: { dem: 'BPP', cd: '2.02.01', opcional: true, descricao: /emprestimos|financiamentos/ },
  patrimonioLiquido: { dem: 'BPP', cd: '2.03', descricao: /patrimonio liquido/ },
  minoritarios: { dem: 'BPP', cd: '2.03.09', opcional: true, descricao: /nao controlador|minorit/ },
}

/** Contas lidas nos exercícios antigos (só consistência de 5 anos): reduzem o tamanho dos insumos. */
export const CONTAS_HISTORICO = [{ dem: 'DRE', cd: '3.11' }, { dem: 'DRE', cd: '3.11.01' }, { dem: 'DFC', cd: '6.01' }]

/** Lista única de (demonstração, conta) que a extração deve guardar nos insumos. */
export function contasNecessarias() {
  return [...Object.values(CONTAS), ...Object.values(CONTAS_BALANCO)].map((c) => ({ dem: c.dem, cd: c.cd }))
}

// ---------------------------------------------------------------------------------------
// Utilidades numéricas e de data
// ---------------------------------------------------------------------------------------

export const arred = (n, casas = 6) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** casas) / 10 ** casas)
const reais = (n) => (n == null ? null : Math.round(n * 100) / 100)

export function semAcento(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const MS_DIA = 86_400_000
export const diasEntre = (de, ate) => Math.round((Date.UTC(...ate.split('-').map((v, i) => (i === 1 ? v - 1 : +v))) - Date.UTC(...de.split('-').map((v, i) => (i === 1 ? v - 1 : +v)))) / MS_DIA)

export function diaAnterior(data) {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** Serialização canônica (chaves ordenadas): base do hash reproduzível. */
export function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .filter((k) => valor[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(valor ?? null)
}

export const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex')

/** Percentil por interpolação linear (tipo 7 do R/Excel PERCENTIL.INC), p em [0,1]. */
export function quantil(valores, p) {
  const v = [...valores].sort((a, b) => a - b)
  if (!v.length) return null
  const pos = (v.length - 1) * p
  const base = Math.floor(pos)
  const resto = pos - base
  return v[base + 1] !== undefined ? v[base] + resto * (v[base + 1] - v[base]) : v[base]
}

/** Percentil "nearest-rank" (valor que realmente existe na amostra). */
export function percentilPosto(valores, p) {
  const v = [...valores].sort((a, b) => a - b)
  if (!v.length) return null
  return v[Math.max(0, Math.ceil(p * v.length) - 1)]
}

/** Rank percentual em [0,1] (1 = maior valor). Empates recebem a média dos postos. */
export function ranksPercentuais(valores) {
  const n = valores.length
  if (n === 0) return []
  if (n === 1) return [1]
  const ordem = valores.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const postos = new Array(n)
  for (let i = 0; i < n; ) {
    let j = i
    while (j + 1 < n && ordem[j + 1][0] === ordem[i][0]) j++
    const medio = (i + j) / 2 // posto base 0, médio do empate
    for (let k = i; k <= j; k++) postos[ordem[k][1]] = medio / (n - 1)
    i = j + 1
  }
  return postos
}

/** z-scores após cortar nos quantis [inf, sup] (winsorização). Desvio-padrão populacional. */
export function zscoresWinsorizados(valores, inf, sup) {
  if (valores.length === 0) return []
  const lo = quantil(valores, inf)
  const hi = quantil(valores, sup)
  const cortados = valores.map((v) => Math.min(hi, Math.max(lo, v)))
  const media = cortados.reduce((s, v) => s + v, 0) / cortados.length
  const dp = Math.sqrt(cortados.reduce((s, v) => s + (v - media) ** 2, 0) / cortados.length)
  return cortados.map((v) => (dp === 0 ? 0 : (v - media) / dp))
}

/** Volatilidade anualizada (desvio-padrão amostral dos retornos logarítmicos diários × √252). */
export function volatilidadeAnualizada(fechamentos) {
  if (!Array.isArray(fechamentos) || fechamentos.length < 3) return { volatilidade: null, retornos: 0 }
  const r = []
  for (let i = 1; i < fechamentos.length; i++) {
    if (fechamentos[i] > 0 && fechamentos[i - 1] > 0) r.push(Math.log(fechamentos[i] / fechamentos[i - 1]))
  }
  if (r.length < 2) return { volatilidade: null, retornos: r.length }
  const media = r.reduce((s, v) => s + v, 0) / r.length
  const variancia = r.reduce((s, v) => s + (v - media) ** 2, 0) / (r.length - 1)
  return { volatilidade: Math.sqrt(variancia) * Math.sqrt(252), retornos: r.length }
}

// ---------------------------------------------------------------------------------------
// Leitura das linhas da CVM (insumos) com LTM
// ---------------------------------------------------------------------------------------

const duracao = (l) => (l.dtIni ? diasEntre(l.dtIni, l.dtFim) : 0)
const rotulo = (l) => ({ doc: l.doc, dtRefer: l.dtRefer, versao: l.versao, ordem: l.ordem, dtIni: l.dtIni ?? null, dtFim: l.dtFim, cd: l.cd, ds: l.ds, valor: l.valor, linkDoc: l.linkDoc ?? null })

/** Escolhe, entre as linhas candidatas, a de maior duração (YTD em vez do trimestre isolado). */
function maisLonga(linhas) {
  return [...linhas].sort((a, b) => duracao(b) - duracao(a) || (a.ds < b.ds ? -1 : 1))[0] ?? null
}

/**
 * Valor dos últimos 12 meses (LTM) de uma conta de fluxo (DRE, DFC, DVA).
 *  - Último documento = DFP  → o próprio exercício (12 meses).
 *  - Último documento = ITR  → DFP anterior + acumulado do ano (ITR) − acumulado do ano anterior (ITR, coluna PENÚLTIMO).
 * Devolve { valor, formula, componentes } ou { erro }.
 */
export function ltmDaConta(linhas, ultimo, cons, def) {
  const base = linhas.filter((l) => l.dem === def.dem && l.cons === cons && l.cd === def.cd)
  const achar = (doc, dtRefer, ordem) => maisLonga(base.filter((l) => l.doc === doc && l.dtRefer === dtRefer && l.ordem === ordem))

  if (ultimo.doc === 'DFP') {
    const ex = achar('DFP', ultimo.dtRefer, 'ULTIMO')
    if (!ex) return def.opcional ? { valor: 0, formula: 'conta ausente na DFP → 0', componentes: [] } : { erro: `conta ${def.cd} ausente na DFP de ${ultimo.dtRefer}` }
    const d = duracao(ex)
    if (d < 360 || d > 372) return { erro: `exercício da conta ${def.cd} com ${d} dias (esperado ~365)` }
    return { valor: ex.valor, formula: `exercício ${ex.dtFim.slice(0, 4)} (12 meses, DFP)`, componentes: [{ papel: 'exercicio', ...rotulo(ex) }] }
  }

  // ITR
  const atual = achar('ITR', ultimo.dtRefer, 'ULTIMO')
  const anterior = achar('ITR', ultimo.dtRefer, 'PENULTIMO')
  const dtIniAtual = atual?.dtIni ?? anterior?.dtIni
  if (!atual && !anterior) {
    return def.opcional ? { valor: 0, formula: 'conta ausente no ITR → 0', componentes: [] } : { erro: `conta ${def.cd} ausente no ITR de ${ultimo.dtRefer}` }
  }
  if (!atual || !anterior) {
    // Opcional: ausência de um dos lados é tratada como 0 naquele lado (registrado).
    if (!def.opcional) return { erro: `conta ${def.cd}: falta o acumulado ${!atual ? 'atual' : 'do ano anterior'} no ITR de ${ultimo.dtRefer}` }
  }
  const iniAno = atual?.dtIni
  const fimAnoAnterior = iniAno ? diaAnterior(iniAno) : null
  const fy = fimAnoAnterior ? achar('DFP', fimAnoAnterior, 'ULTIMO') : null
  if (!fy && !def.opcional) return { erro: `conta ${def.cd}: falta a DFP do exercício encerrado em ${fimAnoAnterior ?? '?'}` }
  if (atual && anterior && Math.abs(duracao(atual) - duracao(anterior)) > 4) return { erro: `conta ${def.cd}: acumulados de durações diferentes (${duracao(atual)} x ${duracao(anterior)} dias)` }
  if (fy && (duracao(fy) < 360 || duracao(fy) > 372)) return { erro: `exercício anterior da conta ${def.cd} com ${duracao(fy)} dias` }

  const v = (l) => (l ? l.valor : 0)
  const valor = v(fy) + v(atual) - v(anterior)
  const comps = [
    fy && { papel: 'exercicio_anterior (+)', ...rotulo(fy) },
    atual && { papel: 'acumulado_atual (+)', ...rotulo(atual) },
    anterior && { papel: 'acumulado_ano_anterior (−)', ...rotulo(anterior) },
  ].filter(Boolean)
  return {
    valor,
    formula: `exercício ${fy ? fy.dtFim : '∅'} + acumulado ${atual ? `${atual.dtIni}→${atual.dtFim}` : '∅'} − acumulado ${anterior ? `${anterior.dtIni}→${anterior.dtFim}` : '∅'}`,
    componentes: comps,
  }
}

/** Saldo (balanço) em `ultimo`. */
export function saldoDaConta(linhas, ultimo, cons, def) {
  const l = linhas.find((x) => x.doc === ultimo.doc && x.dtRefer === ultimo.dtRefer && x.dem === def.dem && x.cons === cons && x.cd === def.cd && x.ordem === 'ULTIMO')
  if (!l) return def.opcional ? { valor: 0, formula: 'conta ausente → 0', componentes: [] } : { erro: `conta ${def.cd} ausente no balanço de ${ultimo.dtRefer}` }
  return { valor: l.valor, formula: `saldo em ${l.dtFim}`, componentes: [{ papel: 'saldo', ...rotulo(l) }] }
}

function conferirDescricao(def, componentes) {
  if (!def.descricao) return null
  const ruim = componentes.find((c) => !def.descricao.test(semAcento(c.ds)))
  return ruim ? `descrição inesperada na conta ${def.cd}: "${ruim.ds}"` : null
}

// ---------------------------------------------------------------------------------------
// Escolha do documento mais recente e do tipo de consolidação
// ---------------------------------------------------------------------------------------

export function ultimoDocumento(docs, dataCorte) {
  const validos = docs.filter((d) => d.dtRefer <= dataCorte && (!d.dtReceb || d.dtReceb <= dataCorte))
  return [...validos].sort((a, b) => (a.dtRefer < b.dtRefer ? 1 : a.dtRefer > b.dtRefer ? -1 : a.doc === 'DFP' ? -1 : 1))[0] ?? null
}

export function escolherConsolidacao(linhas, ultimo) {
  const tem = (cons) => linhas.some((l) => l.doc === ultimo.doc && l.dtRefer === ultimo.dtRefer && l.dem === 'DRE' && l.cons === cons && l.cd === '3.05')
  return tem('con') ? 'con' : tem('ind') ? 'ind' : null
}

// ---------------------------------------------------------------------------------------
// Consistência histórica (últimos N exercícios encerrados)
// ---------------------------------------------------------------------------------------

/**
 * Lucro e caixa operacional de cada um dos últimos `N` exercícios (DFP consecutivos, do mais recente
 * para trás, recebidos até a data de corte). Usa o valor ÚLTIMO de cada DFP (o exercício como foi
 * apresentado naquele ano, na versão vigente). Exercício sem lucro ou sem FCO na consolidação
 * escolhida não conta como disponível.
 */
export function consistenciaHistorica(c, cons, dataCorte, cfgConsistencia) {
  const N = cfgConsistencia.exercicios
  const dfps = c.docs
    .filter((d) => d.doc === 'DFP' && d.dtRefer <= dataCorte && (!d.dtReceb || d.dtReceb <= dataCorte))
    .sort((a, b) => (a.dtRefer < b.dtRefer ? 1 : -1))
  const cadeia = []
  for (const d of dfps) {
    if (cadeia.length === 0) cadeia.push(d)
    else {
      const gap = diasEntre(d.dtRefer, cadeia.at(-1).dtRefer)
      if (gap >= 360 && gap <= 372) cadeia.push(d)
      else break // buraco na série: para aqui, não pula exercício
    }
    if (cadeia.length === N) break
  }
  const exercicios = []
  for (const d of cadeia) {
    const acha = (cd, dem) => maisLonga(c.linhas.filter((l) => l.doc === 'DFP' && l.dtRefer === d.dtRefer && l.cons === cons && l.ordem === 'ULTIMO' && l.dem === dem && l.cd === cd))
    const lucro = acha('3.11.01', 'DRE') ?? acha('3.11', 'DRE')
    const fco = acha('6.01', 'DFC')
    if (!lucro || !fco || duracao(lucro) < 360) continue
    exercicios.push({ exercicio: d.dtRefer, versao: d.versao, linkDoc: d.linkDoc ?? null, contaLucro: lucro.cd, lucro: lucro.valor, fco: fco.valor })
  }
  const comLucro = exercicios.filter((e) => e.lucro > 0).length
  const comFco = exercicios.filter((e) => e.fco > 0).length
  const passa = exercicios.length >= N && comLucro >= cfgConsistencia.minimoComLucro && comFco >= cfgConsistencia.minimoComFcoPositivo
  return { exigidos: N, disponiveis: exercicios.length, comLucro, comFco, passa, exercicios }
}

// ---------------------------------------------------------------------------------------
// Valor de mercado por classe de ação
// ---------------------------------------------------------------------------------------

export function valorDeMercado(capital, preco) {
  const on = capital.ordinarias - capital.tesouroOrd
  const pn = capital.preferenciais - capital.tesouroPref
  if (on < 0 || pn < 0) return { erro: `ações em tesouraria maiores que o capital (ON ${on}, PN ${pn})` }
  const porClasse = (classe) => preco.classes.find((c) => c.classe === classe)
  const linhas = []
  let aproximado = false
  for (const [classe, qtd] of [['ON', on], ['PN', pn]]) {
    if (qtd === 0) continue
    const c = porClasse(classe)
    const usado = c ?? { ticker: preco.ref.ticker, fechamento: preco.ref.fechamento, data: preco.ref.data }
    if (!c) aproximado = true
    linhas.push({ classe, quantidade: qtd, ticker: usado.ticker, preco: usado.fechamento, data: usado.data, aproximado: !c, valor: qtd * usado.fechamento })
  }
  if (!linhas.length) return { erro: 'sem ações em circulação no capital informado' }
  const total = linhas.reduce((s, l) => s + l.valor, 0)
  return {
    valor: total,
    metodo: aproximado ? 'preco_da_classe_de_referencia' : 'por_classe',
    formula: linhas.map((l) => `${l.classe}: ${l.quantidade} × R$ ${l.preco} (${l.ticker}${l.aproximado ? ', preço da referência' : ''})`).join(' + '),
    classes: linhas.map((l) => ({ ...l, valor: reais(l.valor) })),
  }
}

// ---------------------------------------------------------------------------------------
// Cálculo por empresa
// ---------------------------------------------------------------------------------------

function excluir(etapa, codigo, motivo, detalhe) {
  return { excluida: { etapa, codigo, motivo, detalhe: detalhe ?? null } }
}

/** Fundamentos e indicadores de UMA empresa. Devolve { excluida } ou { metricas, memoria }. */
export function calcularFundamentos(emp, preco, cfg, dataCorte) {
  const c = emp.contabil
  if (!c || !c.docs?.length) return excluir('dados_contabeis', 'sem_demonstracao', 'Sem DFP/ITR da CVM para esta empresa.')
  const ultimo = ultimoDocumento(c.docs, dataCorte)
  if (!ultimo) return excluir('dados_contabeis', 'sem_demonstracao', 'Nenhuma DFP/ITR recebida até a data de corte.')
  const idade = diasEntre(ultimo.dtRefer, dataCorte)
  if (idade > cfg.filtros.idadeMaximaDemonstracaoDias) {
    return excluir('dados_contabeis', 'demonstracao_defasada', `Última demonstração (${ultimo.doc} de ${ultimo.dtRefer}) tem ${idade} dias; o limite é ${cfg.filtros.idadeMaximaDemonstracaoDias}.`, { idade })
  }
  const cons = escolherConsolidacao(c.linhas, ultimo)
  if (!cons) return excluir('dados_contabeis', 'sem_dre', `DRE sem a conta 3.05 em ${ultimo.doc} de ${ultimo.dtRefer}.`)

  const itens = {}
  const saldos = {}
  const erros = []
  const ZERO = { valor: 0, formula: 'conta ausente → 0', componentes: [] }
  const ler = (alvo, nome, def, leitor) => {
    const r = leitor(def)
    if (r.erro) {
      // Conta opcional realmente AUSENTE vale 0; qualquer outro erro (duração, descrição) invalida a empresa.
      if (def.opcional && /ausente/.test(r.erro)) alvo[nome] = ZERO
      else { erros.push(r.erro); alvo[nome] = { valor: null, componentes: [], formula: r.erro } }
      return
    }
    const desc = conferirDescricao(def, r.componentes)
    if (desc) erros.push(desc)
    alvo[nome] = r
  }
  for (const [nome, def] of Object.entries(CONTAS)) ler(itens, nome, def, (d) => ltmDaConta(c.linhas, ultimo, cons, d))
  for (const [nome, def] of Object.entries(CONTAS_BALANCO)) ler(saldos, nome, def, (d) => saldoDaConta(c.linhas, ultimo, cons, d))
  if (erros.length) return excluir('dados_contabeis', 'dados_incompletos_ou_incoerentes', erros[0], { todos: erros })

  const V = (n) => (itens[n] ? itens[n].valor ?? 0 : saldos[n].valor ?? 0)
  const S = (n) => saldos[n].valor ?? 0

  // Verificações de integridade
  const verificacoes = []
  const tolB = cfg.verificacoes.toleranciaBalancoPct / 100
  const difBal = Math.abs(S('ativoTotal') - S('passivoTotal'))
  const okBal = difBal <= tolB * Math.max(Math.abs(S('ativoTotal')), 1)
  verificacoes.push({ id: 'balanco_fecha', ok: okBal, detalhe: `Ativo total ${reais(S('ativoTotal'))} × Passivo+PL ${reais(S('passivoTotal'))} (dif. ${reais(difBal)}).` })
  if (!okBal) return excluir('dados_contabeis', 'balanco_nao_fecha', verificacoes.at(-1).detalhe)

  if (itens.resultadoFinanceiro.componentes.length && itens.resultadoAntesTributos.componentes.length) {
    const dif = Math.abs(V('ebit') + V('resultadoFinanceiro') - V('resultadoAntesTributos'))
    const ref = Math.max(Math.abs(V('receita')), Math.abs(V('resultadoAntesTributos')), 1)
    const ok = dif <= (cfg.verificacoes.toleranciaDrePct / 100) * ref
    verificacoes.push({ id: 'dre_fecha', ok, detalhe: `EBIT ${reais(V('ebit'))} + resultado financeiro ${reais(V('resultadoFinanceiro'))} × resultado antes dos tributos ${reais(V('resultadoAntesTributos'))} (dif. ${reais(dif)}).` })
    if (!ok) return excluir('dados_contabeis', 'dre_nao_fecha', verificacoes.at(-1).detalhe)
  } else verificacoes.push({ id: 'dre_fecha', ok: null, detalhe: 'Não aplicável: DRE sem 3.06/3.07.' })

  // Capital e valor de mercado
  const cap = [...(c.capital ?? [])]
    .filter((k) => k.dtRefer <= dataCorte)
    .sort((a, b) => (a.dtRefer < b.dtRefer ? 1 : -1))
    .find((k) => k.dtRefer === ultimo.dtRefer && k.doc === ultimo.doc) ?? [...(c.capital ?? [])].filter((k) => k.dtRefer <= dataCorte).sort((a, b) => (a.dtRefer < b.dtRefer ? 1 : -1))[0]
  if (!cap) return excluir('dados_contabeis', 'sem_capital', 'Composição do capital (quantidade de ações) não encontrada.')
  const vm = valorDeMercado(cap, preco)
  if (vm.erro) return excluir('dados_contabeis', 'capital_invalido', vm.erro)

  const plTotal = S('patrimonioLiquido')
  const minoritarios = S('minoritarios')
  const plControladores = plTotal - minoritarios
  const pvp = plControladores > 0 ? vm.valor / plControladores : null
  const pvpOk = pvp === null ? null : pvp >= cfg.verificacoes.pvpMinimoPlausivel && pvp <= cfg.verificacoes.pvpMaximoPlausivel
  verificacoes.push({ id: 'pvp_plausivel', ok: pvpOk, detalhe: pvp === null ? 'PL de controladores ≤ 0: teste não se aplica.' : `P/VP implícito = ${arred(pvp, 2)} (faixa aceita ${cfg.verificacoes.pvpMinimoPlausivel} a ${cfg.verificacoes.pvpMaximoPlausivel}).` })
  if (pvpOk === false) return excluir('dados_contabeis', 'capital_implausivel', `P/VP implícito de ${arred(pvp, 2)} fora da faixa plausível: quantidade de ações ou unidade do capital sob suspeita.`, { pvp })

  // EBIT ajustado
  const aj = cfg.indicador.ebitAjustado
  const ebit = V('ebit')
  const parcelas = []
  let ebitAj = ebit
  if (aj.removerEquivalenciaPatrimonial) { ebitAj -= V('equivalencia'); parcelas.push(['equivalência patrimonial (3.04.06)', -V('equivalencia')]) }
  if (aj.removerRecuperabilidadeDeAtivos) { ebitAj -= V('recuperabilidade'); parcelas.push(['recuperabilidade de ativos (3.04.03)', -V('recuperabilidade')]) }
  if (aj.removerOutrasReceitasDespesasOperacionais) {
    ebitAj -= V('outrasReceitasOp') + V('outrasDespesasOp')
    parcelas.push(['outras receitas operacionais (3.04.04)', -V('outrasReceitasOp')], ['outras despesas operacionais (3.04.05)', -V('outrasDespesasOp')])
  }

  // EV
  const caixa = S('caixa') + S('aplicacoes')
  const dividaBruta = S('dividaCurta') + S('dividaLonga')
  const dividaLiquida = dividaBruta - caixa
  const ev = vm.valor + dividaLiquida + (cfg.indicador.ev.incluirMinoritarios ? minoritarios : 0)

  const lucro = itens.lucroControladores.componentes.length ? V('lucroControladores') : V('lucroConsolidado')
  const lucroConta = itens.lucroControladores.componentes.length ? '3.11.01' : '3.11'

  const fco = V('fco')
  const capitalInvestido = plTotal + dividaBruta - caixa
  const nopat = ebitAj * (1 - cfg.qualidade.roic.aliquotaImpostoNopat)
  const roic = capitalInvestido > 0 ? nopat / capitalInvestido : null
  const temDepreciacao = itens.depreciacao.componentes.length > 0
  const ebitda = temDepreciacao ? ebitAj + V('depreciacao') : null
  let dlEbitda = null
  if (ebitda !== null) dlEbitda = ebitda > 0 ? dividaLiquida / ebitda : dividaLiquida <= 0 ? -Infinity : null
  const dlEbitdaPublicado = dlEbitda === -Infinity ? null : dlEbitda
  const caixaLiquido = dividaLiquida <= 0

  const q = cfg.qualidade
  const passaRoic = roic !== null && roic >= q.roic.minimo
  const passaDlEbitda = ebitda !== null && (caixaLiquido || (dlEbitda !== null && dlEbitda <= q.dividaLiquidaSobreEbitda.maximo))
  const passaFco = fco > 0

  const temDespesaFin = itens.despesasFinanceiras.componentes.length > 0
  const despesaFin = Math.abs(V('despesasFinanceiras'))
  const semDespesaFinanceira = temDespesaFin && despesaFin === 0
  const cobertura = temDespesaFin && despesaFin > 0 ? ebitAj / despesaFin : null
  const passaCobertura = temDespesaFin && (semDespesaFinanceira || (cobertura !== null && ebitAj > 0 && cobertura >= q.coberturaJuros.minimo))

  const consistencia = consistenciaHistorica(c, cons, dataCorte, q.consistencia)

  const metricas = {
    lucroLtm: reais(lucro),
    mktcap: reais(vm.valor),
    ev: reais(ev),
    plControladores: reais(plControladores),
    ebitAjustado: reais(ebitAj),
    fcoLtm: reais(fco),
    plSobreValorDeMercado: plControladores / vm.valor,
    fcoSobreEv: ev > 0 ? fco / ev : null,
    ebitAjustadoSobreEv: ev > 0 ? ebitAj / ev : null,
    pvp: pvp === null ? null : arred(pvp, 4),
    roic: roic === null ? null : arred(roic, 6),
    dlEbitda: dlEbitdaPublicado === null ? null : arred(dlEbitdaPublicado, 4),
    caixaLiquido,
    passaRoic,
    passaDlEbitda,
    passaFco,
    coberturaJuros: cobertura === null ? null : arred(cobertura, 4),
    semDespesaFinanceira,
    passaCobertura,
    exerciciosAnalisados: consistencia.disponiveis,
    exerciciosComLucro: consistencia.comLucro,
    exerciciosComFco: consistencia.comFco,
    passaConsistencia: consistencia.passa,
  }

  const memoria = {
    demonstracao: { doc: ultimo.doc, dtRefer: ultimo.dtRefer, dtReceb: ultimo.dtReceb ?? null, versao: ultimo.versao, linkDoc: ultimo.linkDoc ?? null, consolidacao: cons === 'con' ? 'consolidada' : 'individual' },
    verificacoes,
    valorDeMercado: { metodo: vm.metodo, formula: vm.formula, valor: reais(vm.valor), classes: vm.classes, capital: { doc: cap.doc, dtRefer: cap.dtRefer, versao: cap.versao, ordinarias: cap.ordinarias, preferenciais: cap.preferenciais, tesouroOrd: cap.tesouroOrd, tesouroPref: cap.tesouroPref } },
    fluxos12m: Object.fromEntries(Object.entries(itens).map(([k, r]) => [k, { cd: CONTAS[k].cd, valor: reais(r.valor), formula: r.formula, componentes: r.componentes }])),
    saldos: Object.fromEntries(Object.entries(saldos).map(([k, r]) => [k, { cd: CONTAS_BALANCO[k].cd, valor: reais(r.valor), formula: r.formula, componentes: r.componentes }])),
    derivados: {
      plControladores: { formula: 'PL total (2.03) − participação de não controladores (2.03.09)', valor: reais(plControladores) },
      ebitAjustado: { formula: `EBIT (3.05) ${parcelas.map(([n, v]) => `${v >= 0 ? '+' : '−'} ${n}`).join(' ')}`, parcelas: parcelas.map(([nome, valor]) => ({ nome, valor: reais(valor) })), valor: reais(ebitAj) },
      lucroLtm: { conta: lucroConta, valor: reais(lucro) },
      dividaBruta: { formula: 'Empréstimos e financiamentos CP (2.01.04) + LP (2.02.01)', valor: reais(dividaBruta) },
      caixa: { formula: 'Caixa e equivalentes (1.01.01) + aplicações financeiras (1.01.02)', valor: reais(caixa) },
      dividaLiquida: { formula: 'dívida bruta − caixa', valor: reais(dividaLiquida) },
      ev: { formula: 'valor de mercado + dívida líquida + minoritários (2.03.09)', valor: reais(ev) },
      capitalInvestido: { formula: 'PL total + dívida bruta − caixa', valor: reais(capitalInvestido) },
      nopat: { formula: `EBIT ajustado × (1 − ${q.roic.aliquotaImpostoNopat})`, valor: reais(nopat) },
      ebitda: { formula: 'EBIT ajustado + depreciação e amortização (DVA 7.04.01)', valor: reais(ebitda) },
    },
    indicadores: {
      plSobreValorDeMercado: { formula: 'PL controladores ÷ valor de mercado', valor: arred(metricas.plSobreValorDeMercado) },
      fcoSobreEv: { formula: 'FCO 12m (6.01) ÷ EV', valor: arred(metricas.fcoSobreEv) },
      ebitAjustadoSobreEv: { formula: 'EBIT ajustado 12m ÷ EV', valor: arred(metricas.ebitAjustadoSobreEv) },
      roic: { formula: 'NOPAT ÷ capital investido', valor: metricas.roic },
      dlEbitda: { formula: 'dívida líquida ÷ EBITDA (caixa líquido = passa)', valor: metricas.dlEbitda },
      coberturaJuros: { formula: 'EBIT ajustado 12m ÷ |despesas financeiras 12m (3.06.02)|; sem despesa financeira = passa', despesaFinanceira: reais(despesaFin), valor: metricas.coberturaJuros },
    },
    consistencia: {
      regra: `últimos ${consistencia.exigidos} exercícios: lucro positivo em ≥ ${q.consistencia.minimoComLucro} e FCO positivo em ≥ ${q.consistencia.minimoComFcoPositivo}`,
      disponiveis: consistencia.disponiveis, comLucro: consistencia.comLucro, comFco: consistencia.comFco, passa: consistencia.passa,
      exercicios: consistencia.exercicios.map((e) => ({ ...e, lucro: reais(e.lucro), fco: reais(e.fco) })),
    },
  }
  return { metricas, memoria }
}

// ---------------------------------------------------------------------------------------
// Programa completo
// ---------------------------------------------------------------------------------------

/**
 * Executa a triagem. Etapas, na ordem; cada empresa é atribuída à PRIMEIRA que a reprova (a
 * ordem muda a contagem por etapa, nunca o ranking final):
 *   1 universo (setor excluído, sem CNPJ) · 2 liquidez · 3 volatilidade · 4 dados contábeis
 *   5 lucro 12m · 6 indicador (EV/valor de mercado positivos)
 */
export function calcular(insumos, cfg) {
  const { dataCorte } = insumos
  const f = cfg.filtros
  const exclusoes = []
  const memoria = {}
  const etapas = []
  const registrar = (id, descricao, entram, saem) => etapas.push({ id, descricao, entram, saem })

  const excluirEmpresa = (emp, e) => exclusoes.push({ ticker: emp.ticker, nome: emp.nome, setor: emp.setor, ...e })
  const mem = (emp) => (memoria[emp.ticker] ??= { ticker: emp.ticker, nome: emp.nome, setor: emp.setor, cnpj: emp.cnpj ?? null })

  // Volatilidade de TODAS as empresas com série válida (o decil é do universo inteiro, como no método original).
  const vols = {}
  for (const emp of insumos.empresas) {
    const p = emp.preco
    if (!p || !p.serieAjustada) continue
    const { volatilidade, retornos } = volatilidadeAnualizada(p.serieAjustada)
    if (volatilidade !== null && retornos >= f.minimoRetornosVolatilidade && !(p.saltosNaoResolvidos?.length)) vols[emp.ticker] = volatilidade
  }
  const corteVol = Object.keys(vols).length ? percentilPosto(Object.values(vols), f.percentilVolatilidadeExcluir / 100) : null

  let vivas = [...insumos.empresas]
  const passo = (id, descricao, teste) => {
    const entram = vivas.length
    const seguem = []
    for (const emp of vivas) {
      const r = teste(emp)
      if (r) excluirEmpresa(emp, { etapa: id, ...r })
      else seguem.push(emp)
    }
    registrar(id, descricao, entram, entram - seguem.length)
    vivas = seguem
  }

  passo('universo', 'Setor fora do escopo (bancos, seguros, bolsa/holdings) ou empresa sem CNPJ mapeado', (emp) => {
    if (cfg.universo.setoresExcluidos.includes(emp.setor)) return { codigo: 'setor_excluido', motivo: `Setor "${emp.setor}" fora do escopo: EV, EBIT e FCO não medem o negócio de instituições financeiras.` }
    if (!emp.cnpj) return { codigo: 'sem_cnpj', motivo: 'Código não mapeado para um CNPJ da CVM (conferir config/acoes-baratas-cnpj.json).' }
    if (!emp.preco?.ref) return { codigo: 'sem_preco', motivo: 'Sem preço de fechamento no histórico da B3.' }
    return null
  })

  passo('liquidez', `Liquidez média diária do emissor abaixo de R$ ${f.liquidezMinimaDiariaReais.toLocaleString('pt-BR')} (${f.sessoesLiquidez} pregões)`, (emp) => {
    const v = emp.preco.volumeMedioEmissor ?? 0
    mem(emp).liquidez = { volumeMedioEmissor: reais(v), minimo: f.liquidezMinimaDiariaReais, sessoes: f.sessoesLiquidez }
    return v < f.liquidezMinimaDiariaReais ? { codigo: 'liquidez_baixa', motivo: `Volume médio diário de R$ ${reais(v).toLocaleString('pt-BR')} abaixo do mínimo.`, detalhe: { volume: reais(v) } } : null
  })

  passo('volatilidade', `Decil mais volátil do universo (volatilidade anualizada de ${f.sessoesVolatilidade} pregões acima do percentil ${f.percentilVolatilidadeExcluir})`, (emp) => {
    const p = emp.preco
    if (p.saltosNaoResolvidos?.length) return { codigo: 'salto_de_preco', motivo: `Salto de preço sem desdobramento confirmado (${p.saltosNaoResolvidos.map((s) => s.data).join(', ')}): série de preços não confiável. Confirmar em config/acoes.json → desdobramentos.` }
    const v = vols[emp.ticker]
    if (v === undefined) return { codigo: 'historico_insuficiente', motivo: `Menos de ${f.minimoRetornosVolatilidade} retornos diários disponíveis: volatilidade não calculável.` }
    mem(emp).volatilidade = { anualizada: arred(v, 4), corteDoUniverso: arred(corteVol, 4), percentil: f.percentilVolatilidadeExcluir, empresasNoCalculo: Object.keys(vols).length }
    return v > corteVol ? { codigo: 'volatilidade_alta', motivo: `Volatilidade anualizada de ${arred(v * 100, 1)}% está no decil mais volátil (corte ${arred(corteVol * 100, 1)}%).`, detalhe: { volatilidade: arred(v, 4), corte: arred(corteVol, 4) } } : null
  })

  const fundamentos = {}
  passo('dados_contabeis', 'Demonstrações da CVM completas, atuais e coerentes (balanço fecha, DRE fecha, descrição das contas, capital plausível)', (emp) => {
    const r = calcularFundamentos(emp, emp.preco, cfg, dataCorte)
    if (r.excluida) return { codigo: r.excluida.codigo, motivo: r.excluida.motivo, detalhe: r.excluida.detalhe }
    fundamentos[emp.ticker] = r.metricas
    Object.assign(mem(emp), r.memoria)
    return null
  })

  passo('lucro', 'Sem lucro nos últimos 12 meses (4 trimestres)', (emp) => {
    const l = fundamentos[emp.ticker].lucroLtm
    return cfg.filtros.lucroLtmPositivo && !(l > 0) ? { codigo: 'prejuizo_12m', motivo: `Lucro líquido dos últimos 12 meses de R$ ${l.toLocaleString('pt-BR')} (não positivo).`, detalhe: { lucroLtm: l } } : null
  })

  passo('indicador', 'EV ou valor de mercado não positivos (rendimentos indefinidos)', (emp) => {
    const m = fundamentos[emp.ticker]
    return !(m.ev > 0) || !(m.mktcap > 0) ? { codigo: 'ev_nao_positivo', motivo: `EV de R$ ${m.ev.toLocaleString('pt-BR')}: os rendimentos sobre EV perdem sentido.`, detalhe: { ev: m.ev } } : null
  })

  // Indicador composto
  const nomes = cfg.indicador.componentes
  const colunas = nomes.map((n) => vivas.map((e) => fundamentos[e.ticker][n]))
  const rs = colunas.map((col) => ranksPercentuais(col))
  let notas
  if (cfg.indicador.metodoComposicao === 'zscore_winsorizado') {
    const zs = colunas.map((col) => zscoresWinsorizados(col, cfg.indicador.winsorizacao.inferior, cfg.indicador.winsorizacao.superior))
    notas = vivas.map((_, i) => zs.reduce((s, z) => s + z[i], 0) / zs.length)
  } else {
    notas = vivas.map((_, i) => rs.reduce((s, r) => s + r[i], 0) / rs.length)
  }
  const detalheNotas = vivas.map((_, i) => nomes.map((_n, k) => rs[k][i]))

  const ordenado = vivas
    .map((emp, i) => ({ emp, nota: notas[i], ranks: detalheNotas[i] }))
    .sort((a, b) => b.nota - a.nota || (a.emp.ticker < b.emp.ticker ? -1 : 1))

  const ranking = ordenado.map(({ emp, nota, ranks }, i) => {
    const m = fundamentos[emp.ticker]
    const mm = mem(emp)
    mm.ranking = { posicao: i + 1, nota: arred(nota), metodo: cfg.indicador.metodoComposicao, ranksPercentuais: Object.fromEntries(nomes.map((n, k) => [n, arred(ranks[k])])) }
    return {
      posicao: i + 1,
      ticker: emp.ticker,
      nome: emp.nome,
      setor: emp.setor,
      cotacao: emp.preco.ref.fechamento,
      dataCotacao: emp.preco.ref.data,
      nota: arred(nota, 6),
      plSobreValorDeMercado: arred(m.plSobreValorDeMercado),
      fcoSobreEv: arred(m.fcoSobreEv),
      ebitAjustadoSobreEv: arred(m.ebitAjustadoSobreEv),
      pvp: m.pvp,
      mktcap: m.mktcap,
      ev: m.ev,
      ebitAjustado: m.ebitAjustado,
      fcoLtm: m.fcoLtm,
      lucroLtm: m.lucroLtm,
      roic: m.roic,
      dlEbitda: m.dlEbitda,
      caixaLiquido: m.caixaLiquido,
      passaRoic: m.passaRoic,
      passaDlEbitda: m.passaDlEbitda,
      passaFco: m.passaFco,
      coberturaJuros: m.coberturaJuros,
      semDespesaFinanceira: m.semDespesaFinanceira,
      passaCobertura: m.passaCobertura,
      exerciciosAnalisados: m.exerciciosAnalisados,
      exerciciosComLucro: m.exerciciosComLucro,
      exerciciosComFco: m.exerciciosComFco,
      passaConsistencia: m.passaConsistencia,
      volatilidade: memoria[emp.ticker].volatilidade?.anualizada ?? null,
      volumeMedio: memoria[emp.ticker].liquidez?.volumeMedioEmissor ?? null,
      demonstracao: { doc: memoria[emp.ticker].demonstracao.doc, dtRefer: memoria[emp.ticker].demonstracao.dtRefer, dtReceb: memoria[emp.ticker].demonstracao.dtReceb, linkDoc: memoria[emp.ticker].demonstracao.linkDoc },
      metodoValorDeMercado: memoria[emp.ticker].valorDeMercado.metodo,
    }
  })
  registrar('ranking', `Indicador composto (${cfg.indicador.metodoComposicao}) e ordenação decrescente`, vivas.length, 0)

  for (const e of exclusoes) { const m = memoria[e.ticker] ?? (memoria[e.ticker] = { ticker: e.ticker, nome: e.nome, setor: e.setor }); m.exclusao = { etapa: e.etapa, codigo: e.codigo, motivo: e.motivo, detalhe: e.detalhe ?? null } }

  const resultado = {
    versaoMetodologia: cfg.versaoMetodologia,
    dataCorte,
    dataPrecos: insumos.dataPrecos,
    universo: insumos.empresas.length,
    etapas,
    corteVolatilidade: corteVol === null ? null : arred(corteVol, 6),
    ranking,
    exclusoes: exclusoes
      .map((e) => ({ ticker: e.ticker, nome: e.nome, setor: e.setor, etapa: e.etapa, codigo: e.codigo, motivo: e.motivo }))
      .sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0)),
  }
  return { resultado, memoria }
}

/** Hash do resultado (o que a verificação compara). */
export const hashDoResultado = (resultado) => sha256(canonico(resultado))
