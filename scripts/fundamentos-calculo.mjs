// Fundamentos das empresas para a aba "Análise fundamentalista" do Simule Ações (D119). Módulo PURO: sem internet, sem disco e
// sem relógio. Entrada = linhas das demonstrações da CVM (DFP/ITR) já extraídas + capital + preços; saída = um registro por
// empresa com os últimos 5 exercícios e os últimos 12 meses (TTM), em R$ MIL, e a quantidade de ações por classe.
//
// Reaproveita, sem alterar, as peças auditadas do Top 15 (acoes-baratas-calculo.mjs): LTM, saldos, escolha da consolidação,
// saneamento do capital e valor de mercado por classe. Não calcula múltiplos nem nota: isso é feito no app (analiseFundamentalista.ts)
// com o preço do dia. Valor ausente é null, nunca zero.

import {
  diaAnterior, diasEntre, escolherConsolidacao, ltmDaConta, sanearCapital, saldoDaConta, semAcento, ultimoDocumento, valorDeMercado,
} from './acoes-baratas-calculo.mjs'

// ---------------------------------------------------------------------------------------
// Contas da CVM
// ---------------------------------------------------------------------------------------

/** `opcional`: pode não existir na empresa (ausência vira null no registro, não zero). */
export const CONTAS_FLUXO = {
  receita: { dem: 'DRE', cd: '3.01', opcional: true },
  lucroBruto: { dem: 'DRE', cd: '3.03', opcional: true },
  ebit: { dem: 'DRE', cd: '3.05', opcional: true },
  resultadoFinanceiro: { dem: 'DRE', cd: '3.06', opcional: true },
  despesasFinanceiras: { dem: 'DRE', cd: '3.06.02', opcional: true },
  equivalencia: { dem: 'DRE', cd: '3.04.06', opcional: true },
  recuperabilidade: { dem: 'DRE', cd: '3.04.03', opcional: true },
  lucroConsolidado: { dem: 'DRE', cd: '3.11' },
  lucroControladores: { dem: 'DRE', cd: '3.11.01', opcional: true },
  fco: { dem: 'DFC', cd: '6.01', opcional: true },
  depreciacao: { dem: 'DVA', cd: '7.04.01', opcional: true },
}

export const CONTAS_SALDO = {
  ativoTotal: { dem: 'BPA', cd: '1' },
  ativoCirculante: { dem: 'BPA', cd: '1.01', opcional: true },
  caixa: { dem: 'BPA', cd: '1.01.01', opcional: true },
  aplicacoes: { dem: 'BPA', cd: '1.01.02', opcional: true },
  passivoCirculante: { dem: 'BPP', cd: '2.01', opcional: true },
  dividaCurta: { dem: 'BPP', cd: '2.01.04', opcional: true },
  dividaLonga: { dem: 'BPP', cd: '2.02.01', opcional: true },
  passivoTotal: { dem: 'BPP', cd: '2' },
  patrimonioLiquido: { dem: 'BPP', cd: '2.03' },
  minoritarios: { dem: 'BPP', cd: '2.03.09', opcional: true },
}

/** Contas que o extrator guarda por prefixo (códigos de linha variam de empresa para empresa): fluxo de investimento, financiamento e ajustes do caixa operacional. */
export const PREFIXOS = [
  { dem: 'DFC', prefixo: '6.01.01.' },
  { dem: 'DFC', prefixo: '6.02.' },
  { dem: 'DFC', prefixo: '6.03.' },
]

/** Contas do passivo guardadas por formato do código: nos bancos e seguradoras o patrimônio líquido não é 2.03 (é 2.07, 2.08...), e os não controladores ficam um nível abaixo. */
export const FORMATOS = [
  { dem: 'BPP', formato: /^2\.\d{2}(\.\d{2})?$/ },
  // Nos bancos e seguradoras o lucro do período não é 3.11 e muda de código; acha-se pela descrição.
  { dem: 'DRE', formato: /^3\.\d{2}(\.\d{2})?$/ },
]

export function contasDoExtrator() {
  return [...Object.values(CONTAS_FLUXO), ...Object.values(CONTAS_SALDO)].map((c) => ({ dem: c.dem, cd: c.cd }))
}

export function guardaLinha(dem, cd) {
  const chaves = new Set(contasDoExtrator().map((c) => `${c.dem}|${c.cd}`))
  return chaves.has(`${dem}|${cd}`) || PREFIXOS.some((p) => p.dem === dem && cd.startsWith(p.prefixo)) || FORMATOS.some((p) => p.dem === dem && p.formato.test(cd))
}

// Identificação das linhas variáveis do fluxo de caixa, pela descrição (sem acento, minúscula).
const ehCapex = (l) => l.dem === 'DFC' && /^6\.02\.\d{2}$/.test(l.cd) && l.valor < 0 && /imobilizad|intangiv|propriedades? para invest|ativo biologic/.test(semAcento(l.ds)) && !/aplicac|participac|coligad|controlad|empresa|fundo/.test(semAcento(l.ds))
const ehDividendo = (l) => l.dem === 'DFC' && /^6\.03\.\d{2}$/.test(l.cd) && l.valor < 0 && /dividend|juros sobre (o )?capital|jcp|proventos/.test(semAcento(l.ds))
const ehDepreciacaoDfc = (l) => l.dem === 'DFC' && /^6\.01\.01\.\d{2}$/.test(l.cd) && /deprecia|amortiza|exaust/.test(semAcento(l.ds)) && !/direito.*uso.*arrend/.test(semAcento(l.ds))

// ---------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------

const duracao = (l) => (l.dtIni ? diasEntre(l.dtIni, l.dtFim) : 0)
const maisLonga = (ls) => [...ls].sort((a, b) => duracao(b) - duracao(a) || (a.ds < b.ds ? -1 : 1))[0] ?? null
const mil = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v / 1000))
const arred = (v, c = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** c) / 10 ** c)

/** Soma, por documento, a linha mais longa de cada código que passa no filtro. null se nenhuma linha passa. */
function somaDoDocumento(linhas, cons, filtro, doc, dtRefer, ordem) {
  const grupo = linhas.filter((l) => l.doc === doc && l.dtRefer === dtRefer && l.ordem === ordem && l.cons === cons && filtro(l))
  if (!grupo.length) return null
  const porCd = new Map()
  for (const l of grupo) porCd.set(l.cd, [...(porCd.get(l.cd) ?? []), l])
  let total = 0
  for (const ls of porCd.values()) total += maisLonga(ls).valor
  return total
}

/** Saldo (balanço) de uma linha escolhida por descrição, em um documento. null se nenhuma passa. */
function saldoPorDescricao(linhas, cons, doc, dtRefer, ordem, filtro) {
  const l = linhas.find((x) => x.doc === doc && x.dtRefer === dtRefer && x.ordem === ordem && x.cons === cons && x.dem === 'BPP' && filtro(x))
  return l ? l.valor : null
}

// Instituições financeiras: o patrimônio líquido e os não controladores se acham pela descrição; o resto do balanço industrial não se aplica.
const ehPlFinanceira = (l) => /^2\.\d{2}$/.test(l.cd) && /^patrimonio liquido/.test(semAcento(l.ds))
const ehMinoritarioFinanceira = (l) => /^2\.\d{2}\.\d{2}$/.test(l.cd) && /nao controlador|minorit/.test(semAcento(l.ds))
/** Linhas do lucro do período e do que cabe aos controladores, nas demonstrações de instituições financeiras. */
const ehLucroFinanceira = (l) => l.dem === 'DRE' && /^3\.\d{2}$/.test(l.cd) && /^(lucro ou prejuizo|lucro\/prejuizo|resultado liquido do periodo)/.test(semAcento(l.ds)) && /periodo|exercicio/.test(semAcento(l.ds))
const ehControladoresFinanceira = (cdLucro) => (l) => l.dem === 'DRE' && l.cd.startsWith(`${cdLucro}.`) && /controlador|socios da empresa/.test(semAcento(l.ds)) && !/nao controlador/.test(semAcento(l.ds))

/** Código do lucro do período (o maior código que casa, que é a linha final da DRE) num documento. */
function cdDoLucro(linhas, cons, doc, dtRefer, ordem) {
  const cds = linhas.filter((x) => x.doc === doc && x.dtRefer === dtRefer && x.ordem === ordem && x.cons === cons && ehLucroFinanceira(x)).map((x) => x.cd)
  return cds.sort().at(-1) ?? null
}

/** Valor de uma linha da DRE por código; a mais longa entre as do mesmo código. */
function fluxoPorCodigo(linhas, cons, doc, dtRefer, ordem, cd) {
  const l = maisLonga(linhas.filter((x) => x.doc === doc && x.dtRefer === dtRefer && x.ordem === ordem && x.cons === cons && x.dem === 'DRE' && x.cd === cd))
  return l ? l.valor : null
}

const CAMPOS_INDUSTRIAIS = ['lucroBruto', 'ebit', 'resultadoFinanceiro', 'despesasFinanceiras', 'equivalencia', 'recuperabilidade', 'fco', 'depreciacao', 'capex', 'ativoCirculante', 'passivoCirculante', 'caixa', 'aplicacoes', 'dividaCurta', 'dividaLonga']

/** LTM de uma soma de linhas escolhidas por descrição (capex, dividendos, depreciação do DFC). */
function ltmDaSoma(linhas, ultimo, cons, filtro) {
  if (ultimo.doc === 'DFP') return somaDoDocumento(linhas, cons, filtro, 'DFP', ultimo.dtRefer, 'ULTIMO')
  const atual = somaDoDocumento(linhas, cons, filtro, 'ITR', ultimo.dtRefer, 'ULTIMO')
  const anterior = somaDoDocumento(linhas, cons, filtro, 'ITR', ultimo.dtRefer, 'PENULTIMO')
  const ref = linhas.find((l) => l.doc === 'ITR' && l.dtRefer === ultimo.dtRefer && l.ordem === 'ULTIMO' && l.dtIni)
  const fy = ref ? somaDoDocumento(linhas, cons, filtro, 'DFP', diaAnterior(ref.dtIni), 'ULTIMO') : null
  if (atual === null && anterior === null && fy === null) return null
  if (fy === null) return null // sem o exercício anterior não há como fechar 12 meses
  return fy + (atual ?? 0) - (anterior ?? 0)
}

/** Linhas de um exercício, na versão MAIS RECENTE: a coluna PENÚLTIMO da DFP seguinte (reapresentada) vale sobre a ÚLTIMO da própria DFP. */
function fonteDoExercicio(docs, dtRefer) {
  const proxima = docs.find((d) => d.doc === 'DFP' && diasEntre(dtRefer, d.dtRefer) >= 360 && diasEntre(dtRefer, d.dtRefer) <= 372)
  return proxima ? { doc: 'DFP', dtRefer: proxima.dtRefer, ordem: 'PENULTIMO', fallback: { doc: 'DFP', dtRefer, ordem: 'ULTIMO' } } : { doc: 'DFP', dtRefer, ordem: 'ULTIMO' }
}

function valorDoExercicio(linhas, cons, def, fonte) {
  const acha = (f) => maisLonga(linhas.filter((l) => l.doc === f.doc && l.dtRefer === f.dtRefer && l.ordem === f.ordem && l.dem === def.dem && l.cons === cons && l.cd === def.cd))
  return acha(fonte) ?? (fonte.fallback ? acha(fonte.fallback) : null)
}

// ---------------------------------------------------------------------------------------
// Registro de um período (exercício ou TTM)
// ---------------------------------------------------------------------------------------

/** Campos de um período em R$ mil; null quando o dado não existe na demonstração. */
function registro(v) {
  const ebitda = v.ebit != null && v.depreciacao != null ? v.ebit + Math.abs(v.depreciacao) : null
  const caixa = (v.caixa ?? 0) + (v.aplicacoes ?? 0)
  const dividaBruta = v.dividaCurta == null && v.dividaLonga == null ? null : (v.dividaCurta ?? 0) + (v.dividaLonga ?? 0)
  const pl = v.patrimonioLiquido
  const plControladores = pl == null ? null : pl - (v.minoritarios ?? 0)
  return {
    receita: mil(v.receita),
    lucroBruto: mil(v.lucroBruto),
    ebit: mil(v.ebit),
    ebitda: mil(ebitda),
    depreciacao: v.depreciacao == null ? null : mil(Math.abs(v.depreciacao)),
    resultadoFinanceiro: mil(v.resultadoFinanceiro),
    despesaFinanceira: v.despesasFinanceiras == null ? null : mil(Math.abs(v.despesasFinanceiras)),
    equivalencia: mil(v.equivalencia),
    lucroLiquido: mil(v.lucroConsolidado),
    lucroControladores: mil(v.lucroControladores),
    fco: mil(v.fco),
    capex: v.capex == null ? null : mil(Math.abs(v.capex)),
    dividendosPagos: v.dividendosPagos == null ? null : mil(Math.abs(v.dividendosPagos)),
    ativoTotal: mil(v.ativoTotal),
    ativoCirculante: mil(v.ativoCirculante),
    passivoCirculante: mil(v.passivoCirculante),
    caixa: v.caixa == null && v.aplicacoes == null ? null : mil(caixa),
    divida: mil(dividaBruta),
    patrimonioLiquido: mil(pl),
    plControladores: mil(plControladores),
    minoritarios: mil(v.minoritarios),
  }
}

// ---------------------------------------------------------------------------------------
// Capital (quantidade de ações por classe)
// ---------------------------------------------------------------------------------------

/**
 * Ações em circulação por classe, na unidade certa, ajustadas a desdobramentos posteriores à data-base do documento.
 * Mesmas regras do Top 15: saneamento de erros de preenchimento, ajuste manual de unidade (config) e ajuste automático de unidade
 * com dois sinais independentes (P/VP e giro impossíveis). Devolve { classes, documento, ajuste, alertas } ou { erro }.
 */
export function capitalDaEmpresa({ ticker, capitais, preco, plControladores, cfg, dataCorte, desdobramentos = [] }) {
  const ate = capitais.filter((k) => k.dtRefer <= dataCorte).sort((a, b) => (a.dtRefer < b.dtRefer ? 1 : a.dtRefer > b.dtRefer ? -1 : a.doc === 'DFP' ? -1 : 1))
  const bruto = ate[0]
  if (!bruto) return { erro: 'sem composição do capital na CVM' }
  const { cap, correcoes } = sanearCapital(bruto, ate.slice(1), preco)
  const eventos = desdobramentos.filter((e) => e && e.fator > 0 && e.data > cap.dtRefer && e.data <= dataCorte)
  const fatorDesdobramento = eventos.reduce((f, e) => f * e.fator, 1)
  const escalar = (k, f) => (f === 1 ? k : { ...k, ordinarias: k.ordinarias * f, preferenciais: k.preferenciais * f, tesouroOrd: k.tesouroOrd * f, tesouroPref: k.tesouroPref * f })
  const vv = cfg.verificacoes ?? {}
  const avaliar = (f) => {
    const k = escalar(escalar(cap, fatorDesdobramento), f)
    const vm = valorDeMercado(k, preco)
    if (vm.erro) return { fator: f, erro: vm.erro }
    return { fator: f, cap: k, vm, pvp: plControladores > 0 ? vm.valor / (plControladores * 1000) : null, giro: vm.valor > 0 ? (preco.volumeMedioEmissor ?? 0) / vm.valor : null }
  }
  const emFaixa = (pvp) => pvp === null || (pvp >= (vv.pvpMinimoPlausivel ?? 0.05) && pvp <= (vv.pvpMaximoPlausivel ?? 100))
  const manual = cfg.capital?.ajustesManuais?.[ticker]
  let escolha
  let ajuste = null
  if (manual?.fatorQuantidade && manual.fatorQuantidade !== 1) {
    escolha = avaliar(manual.fatorQuantidade)
    ajuste = `manual ×${manual.fatorQuantidade}`
  } else {
    escolha = avaliar(1)
    const ua = vv.unidadeAutomatica
    if (ua?.ativa && !escolha.erro && escolha.pvp !== null && escolha.pvp < (vv.pvpMinimoPlausivel ?? 0.05) && escolha.giro > ua.giroDiarioMaximo) {
      const alt = avaliar(ua.fator)
      if (!alt.erro && alt.pvp !== null && emFaixa(alt.pvp) && alt.giro <= ua.giroDiarioMaximo) {
        escolha = alt
        ajuste = `automático ×${ua.fator}`
      }
    }
  }
  if (escolha.erro) return { erro: escolha.erro }
  const alertas = correcoes.map((c) => `capital_corrigido:${c.codigo}`)
  if (!emFaixa(escolha.pvp)) alertas.push('capital_implausivel')
  if (escolha.vm.fracaoAproximada > (vv.maxFracaoSemPreco ?? 0.5)) alertas.push('classe_sem_preco')
  return {
    classes: escolha.vm.classes.map((c) => ({ classe: c.classe, ticker: c.ticker, quantidade: Math.round(c.quantidade), precoAproximado: c.aproximado })),
    documento: `${cap.doc} de ${cap.dtRefer}`,
    fatorTotal: escolha.fator * fatorDesdobramento,
    ajuste,
    ajusteDesdobramento: fatorDesdobramento !== 1 ? fatorDesdobramento : null,
    pvpImplicito: arred(escolha.pvp, 3),
    alertas,
  }
}

/** Total de ações em circulação (todas as classes) de um documento de capital, com o fator de unidade e os desdobramentos posteriores. */
function acoesDoDocumento(k, fatorUnidade, desdobramentos) {
  const f = desdobramentos.filter((e) => e && e.fator > 0 && e.data > k.dtRefer).reduce((x, e) => x * e.fator, 1)
  return Math.round((k.ordinarias - k.tesouroOrd + (k.preferenciais - k.tesouroPref)) * fatorUnidade * f)
}

// ---------------------------------------------------------------------------------------
// Desdobramentos e bonificações detectados pela própria quantidade de ações
// ---------------------------------------------------------------------------------------

/**
 * Fatores que identificam desdobramento, bonificação ou grupamento. Uma emissão real de ações raramente cai a menos de 1,2% de um
 * desses números; quando cai, o caso é raro e o aviso da empresa deixa claro que o ajuste foi automático.
 */
// 100 e 1000 (e os inversos) não são eventos econômicos: são a quantidade informada em milhares ou em unidades no formulário da CVM.
const FATORES_DE_EVENTO = [1.1, 1.2, 1.25, 1.3, 4 / 3, 1.4, 1.5, 2, 3, 4, 5, 10, 100, 1000, 1 / 2, 1 / 3, 1 / 4, 1 / 5, 1 / 10, 1 / 20, 1 / 100, 1 / 1000]
const TOLERANCIA_EVENTO = 0.012

const fatorDeEvento = (razao) => FATORES_DE_EVENTO.find((f) => Math.abs(razao / f - 1) <= TOLERANCIA_EVENTO) ?? null

/**
 * `quantidades` = ações de cada período do mais antigo ao atual (a quantidade atual já vem com os desdobramentos da configuração). O
 * salto entre dois períodos seguidos que parece desdobramento ou bonificação é desfeito nos períodos anteriores, para o lucro por ação
 * e a variação de ações ficarem comparáveis. Devolve { ajustadas, eventos: [{ de, para, fator }] } (índices dos períodos).
 */
export function ajustarEventosDeAcoes(quantidades) {
  const n = quantidades.length - 1
  const ajustadas = [...quantidades]
  const eventos = []
  let acumulado = 1
  for (let i = n - 1; i >= 0; i--) {
    const a = quantidades[i]
    const b = quantidades[i + 1]
    if (a > 0 && b > 0) {
      const f = fatorDeEvento(b / a)
      if (f) {
        acumulado *= f
        eventos.push({ de: i, para: i + 1, fator: Math.round(f * 1e4) / 1e4 })
      }
    }
    if (a > 0) ajustadas[i] = Math.round(a * acumulado)
  }
  return { ajustadas, eventos: eventos.reverse() }
}

// ---------------------------------------------------------------------------------------
// Empresa
// ---------------------------------------------------------------------------------------

/**
 * Registro de uma empresa. `c` = { docs, linhas, capital } da CVM (só desta empresa). Devolve { empresa } ou { erro, etapa }.
 * `financeira`: banco, seguradora e similares; não têm EBIT/EBITDA/FCO/dívida no sentido industrial, então só o que faz sentido é publicado.
 */
export function montarEmpresa({ ticker, nome, setor, financeira = false, cnpj, c, preco, cfg, dataCorte, desdobramentos = [], maxIdadeDias = 230, exercicios = 5 }) {
  if (!c?.docs?.length) return { erro: 'Sem DFP/ITR da CVM para esta empresa.', etapa: 'sem_demonstracao' }
  const ultimo = ultimoDocumento(c.docs, dataCorte)
  if (!ultimo) return { erro: 'Nenhuma DFP/ITR recebida até a data de corte.', etapa: 'sem_demonstracao' }
  const idade = diasEntre(ultimo.dtRefer, dataCorte)
  if (idade > maxIdadeDias) return { erro: `Última demonstração (${ultimo.doc} de ${ultimo.dtRefer}) tem ${idade} dias.`, etapa: 'demonstracao_defasada' }
  const cons = escolherConsolidacao(c.linhas, ultimo)
  if (!cons) return { erro: `DRE sem a conta 3.05 em ${ultimo.doc} de ${ultimo.dtRefer}.`, etapa: 'sem_dre' }

  const alertas = []
  const linhas = c.linhas

  // ---- Exercícios (DFP): cadeia de até N, mesma data-base anual, sem buracos ----
  const dfps = c.docs.filter((d) => d.doc === 'DFP' && d.dtRefer <= dataCorte && (!d.dtReceb || d.dtReceb <= dataCorte)).sort((a, b) => (a.dtRefer < b.dtRefer ? 1 : -1))
  const fim = dfps[0]?.dtRefer.slice(5)
  const cadeia = []
  for (const d of dfps.filter((x) => x.dtRefer.slice(5) === fim)) {
    if (!cadeia.length) cadeia.push(d)
    else {
      const gap = diasEntre(d.dtRefer, cadeia.at(-1).dtRefer)
      if (gap >= 360 && gap <= 372) cadeia.push(d)
      else break
    }
    if (cadeia.length === exercicios) break
  }

  const lerPeriodo = (leitores) => {
    const v = {}
    for (const [nome_, def] of Object.entries({ ...CONTAS_FLUXO, ...CONTAS_SALDO })) v[nome_] = leitores.conta(def)
    v.capex = leitores.soma(ehCapex)
    v.dividendosPagos = leitores.soma(ehDividendo)
    if (v.depreciacao == null) {
      const dep = leitores.soma(ehDepreciacaoDfc)
      v.depreciacao = dep
    }
    if (financeira) {
      v.patrimonioLiquido = leitores.saldo(ehPlFinanceira)
      v.minoritarios = leitores.saldo(ehMinoritarioFinanceira)
      const lucros = leitores.lucroFinanceira()
      v.lucroConsolidado = lucros.consolidado
      v.lucroControladores = lucros.controladores
      for (const k of CAMPOS_INDUSTRIAIS) v[k] = null
    }
    return v
  }

  const anual = []
  const reapresentados = []
  for (const d of cadeia.slice().reverse()) {
    const fonte = fonteDoExercicio(c.docs, d.dtRefer)
    const usaConsDoDocumento = linhas.some((l) => l.doc === 'DFP' && l.dtRefer === d.dtRefer && l.cons === cons) ? cons : 'ind'
    const consExercicio = linhas.some((l) => l.doc === fonte.doc && l.dtRefer === fonte.dtRefer && l.cons === usaConsDoDocumento) ? usaConsDoDocumento : cons
    const leitores = {
      conta: (def) => {
        const l = valorDoExercicio(linhas, consExercicio, def, fonte)
        return l ? l.valor : null
      },
      soma: (filtro) => {
        const fontes = [fonte, ...(fonte.fallback ? [fonte.fallback] : [])]
        for (const f of fontes) {
          const s = somaDoDocumento(linhas, consExercicio, filtro, f.doc, f.dtRefer, f.ordem)
          if (s !== null) return s
        }
        return null
      },
      lucroFinanceira: () => {
        for (const f of [fonte, ...(fonte.fallback ? [fonte.fallback] : [])]) {
          const cd = cdDoLucro(linhas, consExercicio, f.doc, f.dtRefer, f.ordem)
          if (!cd) continue
          const ctrl = linhas.find((x) => x.doc === f.doc && x.dtRefer === f.dtRefer && x.ordem === f.ordem && x.cons === consExercicio && ehControladoresFinanceira(cd)(x))
          return {
            consolidado: fluxoPorCodigo(linhas, consExercicio, f.doc, f.dtRefer, f.ordem, cd),
            controladores: ctrl ? fluxoPorCodigo(linhas, consExercicio, f.doc, f.dtRefer, f.ordem, ctrl.cd) : null,
          }
        }
        return { consolidado: null, controladores: null }
      },
      saldo: (filtro) => {
        const fontes = [fonte, ...(fonte.fallback ? [fonte.fallback] : [])]
        for (const f of fontes) {
          const s = saldoPorDescricao(linhas, consExercicio, f.doc, f.dtRefer, f.ordem, filtro)
          if (s !== null) return s
        }
        return null
      },
    }
    const v = lerPeriodo(leitores)
    if (v.lucroConsolidado == null || v.ativoTotal == null || v.patrimonioLiquido == null) continue
    const original = valorDoExercicio(linhas, consExercicio, CONTAS_FLUXO.lucroConsolidado, fonte.fallback ?? fonte)
    if (fonte.fallback && original && v.lucroConsolidado !== original.valor && Math.abs(v.lucroConsolidado - original.valor) > 0.02 * Math.max(Math.abs(original.valor), 1)) {
      reapresentados.push(d.dtRefer.slice(0, 4))
    }
    anual.push({ exercicio: d.dtRefer, consolidacao: consExercicio === 'con' ? 'consolidada' : 'individual', ...registro(v), link: d.linkDoc ?? null })
  }
  if (reapresentados.length) alertas.push(`reapresentado:${reapresentados.join(',')}`)
  if (anual.length < exercicios) alertas.push(`exercicios_disponiveis:${anual.length}`)

  // ---- TTM ----
  const leitoresTtm = {
    conta: (def) => {
      if (def.dem === 'BPA' || def.dem === 'BPP') {
        const r = saldoDaConta(linhas, ultimo, cons, { ...def, opcional: true })
        return r.erro || !r.componentes.length ? null : r.valor
      }
      const r = ltmDaConta(linhas, ultimo, cons, { ...def, opcional: false })
      return r.erro ? null : r.valor
    },
    soma: (filtro) => ltmDaSoma(linhas, ultimo, cons, filtro),
    saldo: (filtro) => saldoPorDescricao(linhas, cons, ultimo.doc, ultimo.dtRefer, 'ULTIMO', filtro),
    lucroFinanceira: () => {
      const cd = cdDoLucro(linhas, cons, ultimo.doc, ultimo.dtRefer, 'ULTIMO')
      if (!cd) return { consolidado: null, controladores: null }
      const ltm = (codigo) => {
        const r = ltmDaConta(linhas, ultimo, cons, { dem: 'DRE', cd: codigo })
        return r.erro ? null : r.valor
      }
      const ctrl = linhas.find((x) => x.doc === ultimo.doc && x.dtRefer === ultimo.dtRefer && x.ordem === 'ULTIMO' && x.cons === cons && ehControladoresFinanceira(cd)(x))
      return { consolidado: ltm(cd), controladores: ctrl ? ltm(ctrl.cd) : null }
    },
  }
  const vTtm = lerPeriodo(leitoresTtm)
  const ttm = vTtm.lucroConsolidado == null || vTtm.patrimonioLiquido == null ? null : { periodoAte: ultimo.dtRefer, documento: `${ultimo.doc} de ${ultimo.dtRefer}`, consolidacao: cons === 'con' ? 'consolidada' : 'individual', ...registro(vTtm), link: ultimo.linkDoc ?? null }
  if (!ttm) alertas.push('ttm_indisponivel')
  if (!anual.length) return { erro: 'Nenhum exercício completo (DFP) com lucro, ativo e patrimônio líquido.', etapa: 'sem_exercicios' }

  // ---- Ações ----
  const refPl = (ttm ?? anual.at(-1)).plControladores
  const capitais = c.capital ?? []
  const k = capitalDaEmpresa({ ticker, capitais, preco, plControladores: refPl, cfg, dataCorte, desdobramentos })
  let acoes = null
  if (k.erro) alertas.push(`sem_acoes:${k.erro}`)
  else {
    alertas.push(...k.alertas)
    acoes = { classes: k.classes, documento: k.documento, ajusteUnidade: k.ajuste, ajusteDesdobramento: k.ajusteDesdobramento, pvpImplicito: k.pvpImplicito }
    // Ações de cada exercício, na mesma base de hoje (unidade e desdobramentos), para o LPA histórico.
    const fatorUnidade = k.fatorTotal / (k.ajusteDesdobramento ?? 1)
    for (const a of anual) {
      const doc = capitais.find((x) => x.doc === 'DFP' && x.dtRefer === a.exercicio)
      a.acoes = doc ? acoesDoDocumento(doc, fatorUnidade, desdobramentos) : null
    }
    const atualAcoes = acoes.classes.reduce((s, x) => s + x.quantidade, 0)
    if (ttm) ttm.acoes = atualAcoes
    // Desdobramentos e bonificações que a configuração não conhece: desfeitos pelo salto na quantidade de ações.
    const sequencia = [...anual.map((a) => a.acoes), atualAcoes]
    if (sequencia.every((q) => q > 0)) {
      const { ajustadas, eventos } = ajustarEventosDeAcoes(sequencia)
      if (eventos.length) {
        anual.forEach((a, i) => (a.acoes = ajustadas[i]))
        const rotulo = (i) => (i >= anual.length ? 'atual' : anual[i].exercicio.slice(0, 4))
        alertas.push(...eventos.map((ev) => `evento_de_acoes_detectado:${rotulo(ev.de)}-${rotulo(ev.para)}(×${ev.fator})`))
        acoes.eventosDetectados = eventos.map((ev) => ({ entre: [rotulo(ev.de), rotulo(ev.para)], fator: ev.fator }))
      }
    }
  }

  return {
    empresa: {
      ticker,
      nome,
      setor,
      financeira,
      cnpj,
      ultimaDemonstracao: { doc: ultimo.doc, dtRefer: ultimo.dtRefer, dtReceb: ultimo.dtReceb ?? null, versao: ultimo.versao, link: ultimo.linkDoc ?? null },
      anual,
      ttm,
      acoes,
      alertas,
    },
  }
}
