// Cálculo PURO do "Top 15 empresas mais endividadas" (D94): sem rede, sem arquivo, sem relógio.
//
// Recebe os MESMOS insumos da triagem de ações baratas (demonstrações da CVM congeladas + o bloco de preço de cada empresa)
// e devolve o ranking por dívida líquida ÷ EBITDA. Toda a leitura contábil (dívida bruta, caixa, EBITDA, verificações de
// integridade, valor de mercado) é a de `calcularFundamentos` (acoes-baratas-calculo.mjs): a mesma empresa tem o mesmo número
// nas duas listas. O que é PRÓPRIO desta lista:
//   - NÃO aplica o filtro de lucro positivo nem o de volatilidade (empresa com prejuízo ou muito volátil é a que importa aqui);
//   - dívida líquida ≤ 0 (caixa maior que a dívida) não entra;
//   - dívida líquida > 0 com EBITDA ≤ 0: a razão é indefinida; vai para a lista `semEbitdaPositivo`, fora da ordem numérica.
//
// `cfgBase` é o config/acoes-baratas.json (universo, liquidez e leitura contábil); `cfg` é o config/acoes-endividadas.json.

import { arred, calcularFundamentos, canonico, sha256 } from './acoes-baratas-calculo.mjs'

export { canonico, sha256 }

export const hashDoResultado = (resultado) => sha256(canonico(resultado))

const reais = (n) => (n == null ? null : Math.round(n * 100) / 100)

/** Compacta uma conta da memória de cálculo das ações baratas: código da CVM, valor e como foi montado. */
const conta = (c) => (c ? { cd: c.cd, valor: c.valor, formula: c.formula } : null)

export function calcularEndividadas(insumos, cfg, cfgBase) {
  const { dataCorte } = insumos
  const f = cfgBase.filtros
  // A verificação "caixa operacional ≤ 2× o EBITDA" das ações baratas protege o indicador caixa operacional ÷ EV, que não é
  // usado aqui, e derrubava justamente empresas bem endividadas (AMER3, BHIA3, MGLU3, SAPR11: financiamento de clientes ou
  // evento não recorrente dentro do fluxo operacional). Aqui ela fica desligada; as demais verificações de integridade valem.
  const cfgContabil = { ...cfgBase, verificacoes: { ...cfgBase.verificacoes, fcoMaximoSobreEbitda: null } }
  const exclusoes = []
  const memoria = {}
  const etapas = []
  const registrar = (id, descricao, entram, saem) => etapas.push({ id, descricao, entram, saem })
  const excluirEmpresa = (emp, e) => exclusoes.push({ ticker: emp.ticker, nome: emp.nome, setor: emp.setor, ...e })
  const mem = (emp) => (memoria[emp.ticker] ??= { ticker: emp.ticker, nome: emp.nome, setor: emp.setor, cnpj: emp.cnpj ?? null })

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

  passo('universo', 'Setor fora do escopo (bancos, seguros, bolsa/holdings), duplicidade econômica, empresa sem CNPJ mapeado ou sem preço', (emp) => {
    if (cfgBase.universo.setoresExcluidos.includes(emp.setor)) return { codigo: 'setor_excluido', motivo: `Setor "${emp.setor}" fora do escopo: dívida é a matéria-prima de bancos, seguradoras e holdings financeiras, e a razão dívida líquida ÷ EBITDA não mede o negócio deles.` }
    const duplicada = cfgBase.universo.excluirTickers?.[emp.ticker]
    if (duplicada) return { codigo: 'duplicidade_economica', motivo: duplicada }
    if (!emp.cnpj) return { codigo: 'sem_cnpj', motivo: 'Código não mapeado para um CNPJ da CVM (conferir config/acoes-baratas-cnpj.json).' }
    if (!emp.preco?.ref) return { codigo: 'sem_preco', motivo: emp.preco?.motivoSemPreco ? `Sem preço recente: ${emp.preco.motivoSemPreco}.` : 'Sem preço de fechamento no histórico da B3.' }
    return null
  })

  passo('liquidez', `Liquidez média diária do emissor abaixo de R$ ${f.liquidezMinimaDiariaReais.toLocaleString('pt-BR')} (${f.sessoesLiquidez} pregões)`, (emp) => {
    const v = emp.preco.volumeMedioEmissor ?? 0
    mem(emp).liquidez = { volumeMedioEmissor: reais(v), minimo: f.liquidezMinimaDiariaReais, sessoes: f.sessoesLiquidez }
    return v < f.liquidezMinimaDiariaReais ? { codigo: 'liquidez_baixa', motivo: `Volume médio diário de R$ ${reais(v).toLocaleString('pt-BR')} abaixo do mínimo.`, detalhe: { volume: reais(v) } } : null
  })

  const fundamentos = {}
  passo('dados_contabeis', 'Demonstrações da CVM completas, atuais e coerentes (balanço fecha, DRE fecha, descrição das contas, capital plausível)', (emp) => {
    const r = calcularFundamentos(emp, emp.preco, cfgContabil, dataCorte)
    if (r.excluida) return { codigo: r.excluida.codigo, motivo: r.excluida.motivo, detalhe: r.excluida.detalhe }
    fundamentos[emp.ticker] = r
    Object.assign(mem(emp), r.memoria)
    return null
  })
  const avaliadas = vivas.length

  const ranking = []
  const semEbitdaPositivo = []
  const itemDe = (emp) => {
    const { metricas: m, memoria: mm } = fundamentos[emp.ticker]
    const d = mm.derivados
    return {
      ticker: emp.ticker,
      nome: emp.nome,
      setor: emp.setor,
      cotacao: emp.preco.ref.fechamento,
      dataCotacao: emp.preco.ref.data,
      dlEbitda: m.dlEbitda,
      dividaLiquida: d.dividaLiquida.valor,
      dividaBruta: d.dividaBruta.valor,
      caixa: d.caixa.valor,
      ebitda: d.ebitda.valor,
      ebitAjustado: m.ebitAjustado,
      plControladores: m.plControladores,
      mktcap: m.mktcap,
      coberturaJuros: m.coberturaJuros,
      semDespesaFinanceira: m.semDespesaFinanceira,
      alertas: m.alertas,
      demonstracao: { doc: mm.demonstracao.doc, dtRefer: mm.demonstracao.dtRefer, dtReceb: mm.demonstracao.dtReceb, linkDoc: mm.demonstracao.linkDoc, consolidacao: mm.demonstracao.consolidacao },
      calculo: {
        dividaCurta: conta(mm.saldos.dividaCurta),
        dividaLonga: conta(mm.saldos.dividaLonga),
        caixaEEquivalentes: conta(mm.saldos.caixa),
        aplicacoesFinanceiras: conta(mm.saldos.aplicacoes),
        ebit: conta(mm.fluxos12m.ebit),
        depreciacaoEAmortizacao: conta(mm.fluxos12m.depreciacao),
        ebitAjustado: { formula: d.ebitAjustado.formula, valor: d.ebitAjustado.valor },
        ebitda: { formula: d.ebitda.formula, valor: d.ebitda.valor },
        dividaLiquida: { formula: d.dividaLiquida.formula, valor: d.dividaLiquida.valor },
      },
    }
  }

  passo('endividamento', 'Sem EBITDA calculável (DVA sem a linha de depreciação) ou com caixa maior que a dívida (dívida líquida ≤ 0)', (emp) => {
    const { memoria: mm } = fundamentos[emp.ticker]
    const ebitda = mm.derivados.ebitda.valor
    const dl = mm.derivados.dividaLiquida.valor
    if (ebitda === null) return { codigo: 'sem_ebitda', motivo: 'EBITDA não calculável: a demonstração do valor adicionado (DVA) não traz a linha de depreciação e amortização (7.04.01), e sem ela não há como separar o EBITDA do EBIT.' }
    if (!(dl > 0)) return { codigo: 'caixa_liquido', motivo: `Dívida líquida de R$ ${dl.toLocaleString('pt-BR')} (não positiva): o caixa cobre a dívida bruta de R$ ${mm.derivados.dividaBruta.valor.toLocaleString('pt-BR')}.`, detalhe: { dividaLiquida: dl, dividaBruta: mm.derivados.dividaBruta.valor, caixa: mm.derivados.caixa.valor } }
    return null
  })

  for (const emp of vivas) {
    const item = itemDe(emp)
    const m = fundamentos[emp.ticker].metricas
    if (item.ebitda > 0 && m.dlEbitda !== null) ranking.push(item)
    else semEbitdaPositivo.push(item)
  }
  ranking.sort((a, b) => b.dlEbitda - a.dlEbitda || (a.ticker < b.ticker ? -1 : 1))
  ranking.forEach((r, i) => {
    r.posicao = i + 1
    mem({ ticker: r.ticker }).ranking = { posicao: r.posicao, dlEbitda: r.dlEbitda }
  })
  // sem razão: ordena pela dívida líquida (a maior primeiro), só para a lista ficar estável e legível
  semEbitdaPositivo.sort((a, b) => b.dividaLiquida - a.dividaLiquida || (a.ticker < b.ticker ? -1 : 1))
  registrar('ranking', 'Dívida líquida ÷ EBITDA, ordem decrescente (EBITDA positivo); EBITDA zero ou negativo vai para a lista à parte', ranking.length + semEbitdaPositivo.length, semEbitdaPositivo.length)

  for (const e of exclusoes) { const m = memoria[e.ticker] ?? (memoria[e.ticker] = { ticker: e.ticker, nome: e.nome, setor: e.setor }); m.exclusao = { etapa: e.etapa, codigo: e.codigo, motivo: e.motivo, detalhe: e.detalhe ?? null } }
  for (const s of semEbitdaPositivo) { const m = memoria[s.ticker]; if (m) m.semEbitdaPositivo = { motivo: 'dívida líquida positiva e EBITDA zero ou negativo: razão indefinida', ebitda: s.ebitda, dividaLiquida: s.dividaLiquida } }

  const resultado = {
    versaoMetodologia: cfg.versaoMetodologia,
    dataCorte,
    dataPrecos: insumos.dataPrecos,
    universo: insumos.empresas.length,
    avaliadas,
    etapas,
    ranking,
    semEbitdaPositivo,
    exclusoes: exclusoes
      .map((e) => ({ ticker: e.ticker, nome: e.nome, setor: e.setor, etapa: e.etapa, codigo: e.codigo, motivo: e.motivo }))
      .sort((a, b) => (a.ticker < b.ticker ? -1 : a.ticker > b.ticker ? 1 : 0)),
  }
  return { resultado, memoria }
}

/** Trava de sanidade da PUBLICAÇÃO (mesmo desenho da das ações baratas): resultado quebrado derruba o job. */
export function verificarSanidade(resultado, cfg) {
  const s = cfg.publicacao?.sanidade
  if (!s) return []
  const problemas = []
  if (resultado.avaliadas < s.minimoAvaliadas) problemas.push(`só ${resultado.avaliadas} empresas avaliadas (mínimo ${s.minimoAvaliadas})`)
  const noEscopo = resultado.universo - resultado.exclusoes.filter((e) => e.codigo === 'setor_excluido').length
  const semDados = resultado.exclusoes.filter((e) => e.etapa === 'dados_contabeis' || e.codigo === 'sem_cnpj' || e.codigo === 'sem_preco').length
  if (noEscopo > 0 && semDados / noEscopo > s.maximoFracaoSemDados) problemas.push(`${semDados} de ${noEscopo} empresas no escopo sem dados utilizáveis (${Math.round((semDados / noEscopo) * 100)}%; máximo ${Math.round(s.maximoFracaoSemDados * 100)}%)`)
  return problemas
}

export { arred }
