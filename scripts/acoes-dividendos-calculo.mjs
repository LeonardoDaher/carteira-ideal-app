// Cálculo PURO do "Top 15 ações pagadoras de dividendos" (D122): sem rede, sem arquivo, sem relógio.
//
// Recebe os insumos já baixados (proventos por ação da B3 + preço de fechamento) e devolve o ranking por dividend yield dos
// últimos 12 meses: soma dos proventos em dinheiro por ação com data com na janela ÷ preço de fechamento mais recente.
// `cfg` é o config/acoes-dividendos.json.
import crypto from 'node:crypto'
import { classeDoTicker } from './b3-proventos.mjs'

export const sha256 = (texto) => crypto.createHash('sha256').update(texto).digest('hex')

/** JSON com as chaves em ordem alfabética, para o hash não depender da ordem em que o objeto foi montado. */
export function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`
  if (valor && typeof valor === 'object') return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(',')}}`
  return JSON.stringify(valor)
}
export const hashDoResultado = (resultado) => sha256(canonico(resultado))

const arred = (n, casas) => Math.round(n * 10 ** casas) / 10 ** casas

/** Soma `dias` a uma data ISO (negativo = volta no tempo). */
export function somarDias(dataIso, dias) {
  const d = new Date(`${dataIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * Ordena da data com mais recente para a mais antiga. NÃO remove linhas iguais: a B3 repete a linha de um provento pago em
 * parcelas (mesma data com e mesmo valor por ação, datas de pagamento diferentes), e cada parcela é um pagamento de verdade.
 */
export function ordenarEventos(eventos) {
  return [...eventos].sort((a, b) => (a.dataCom < b.dataCom ? 1 : a.dataCom > b.dataCom ? -1 : a.tipo.localeCompare(b.tipo) || b.valor - a.valor))
}

/**
 * A B3 informa o provento POR AÇÃO da época. Se houve desdobramento (ou grupamento) depois da data com, o preço de hoje é de
 * outra base e o provento antigo precisa ser dividido pelo fator: `ajustes` = [{ data, fator }], fator = ações novas por ação
 * antiga (5 = cada ação virou 5; 0,1 = dez viraram uma), `data` = primeiro pregão já na base nova.
 */
export function ajustarPorDesdobramento(evento, ajustes = []) {
  const fator = ajustes.filter((a) => a.data > evento.dataCom).reduce((p, a) => p * a.fator, 1)
  return fator === 1 ? evento : { ...evento, valor: evento.valor / fator, valorOriginal: evento.valor }
}

/**
 * @param insumos { dataPrecos, empresas: [{ ticker, nome, setor, cotacao, dataCotacao, liquidezDiaria, nomeDePregao, historicoDisponivel, eventos, motivoSemDados }] }
 * @param cfg config/acoes-dividendos.json
 */
export function calcularDividendos(insumos, cfg) {
  const { dataPrecos } = insumos
  const inicio = somarDias(dataPrecos, -cfg.janelaDias)
  const tiposQueEntram = new Set(cfg.tiposQueEntram)
  const exclusoes = []
  const etapas = []
  const memoria = {}
  let vivas = [...insumos.empresas]

  const passo = (id, descricao, teste) => {
    const entram = vivas.length
    const seguem = []
    for (const emp of vivas) {
      const r = teste(emp)
      if (r) exclusoes.push({ ticker: emp.ticker, nome: emp.nome, setor: emp.setor, etapa: id, ...r })
      else seguem.push(emp)
    }
    etapas.push({ id, descricao, entram, saem: entram - seguem.length })
    vivas = seguem
  }

  passo('preco', 'Sem preço de fechamento recente na B3', (emp) =>
    emp.cotacao > 0 && emp.dataCotacao ? null : { codigo: 'sem_preco', motivo: 'Sem preço de fechamento no histórico da B3.' })

  passo('liquidez', `Negocia menos de R$ ${cfg.liquidezMinimaDiariaReais.toLocaleString('pt-BR')} por dia (média de ${cfg.sessoesLiquidez} pregões)`, (emp) =>
    (emp.liquidezDiaria ?? 0) >= cfg.liquidezMinimaDiariaReais
      ? null
      : { codigo: 'liquidez_baixa', motivo: `Negocia em média R$ ${Math.round(emp.liquidezDiaria ?? 0).toLocaleString('pt-BR')} por dia, abaixo do mínimo de R$ ${cfg.liquidezMinimaDiariaReais.toLocaleString('pt-BR')}.` })

  passo('dados_b3', 'A B3 não tem proventos publicados para a empresa', (emp) =>
    emp.eventos?.length ? null : { codigo: 'sem_dados_b3', motivo: emp.motivoSemDados || 'A B3 não tem proventos publicados para a empresa.' })

  const itens = []
  passo('proventos', `Não pagou proventos em dinheiro nos últimos ${cfg.janelaDias} dias (${inicio} a ${dataPrecos})`, (emp) => {
    const classe = classeDoTicker(emp.ticker)
    if (!classe) return { codigo: 'classe_desconhecida', motivo: `Não foi possível saber a classe da ação pelo código ${emp.ticker}.` }
    const noPeriodo = ordenarEventos(emp.eventos.map((e) => ajustarPorDesdobramento(e, emp.ajustes))).filter((e) => e.classe === classe && e.dataCom > inicio && e.dataCom <= dataPrecos)
    const usados = noPeriodo.filter((e) => tiposQueEntram.has(e.tipo))
    const devolucoes = noPeriodo.filter((e) => !tiposQueEntram.has(e.tipo))
    memoria[emp.ticker] = { ticker: emp.ticker, classe, nomeDePregao: emp.nomeDePregao ?? null, historicoParcial: emp.historicoDisponivel === false, usados, naoUsados: devolucoes }
    const total = usados.reduce((s, e) => s + e.valor, 0)
    if (!(total > 0)) {
      return { codigo: 'sem_proventos', motivo: devolucoes.length ? 'Só houve devolução de capital (não é provento) nos últimos 12 meses.' : 'Nenhum provento em dinheiro com data com nos últimos 12 meses.' }
    }
    const soma = (tipo) => arred(usados.filter((e) => e.tipo === tipo).reduce((s, e) => s + e.valor, 0), 6)
    const datas = [...new Set(usados.map((e) => e.dataCom))].sort()
    itens.push({
      ticker: emp.ticker,
      nome: emp.nome,
      setor: emp.setor,
      classe,
      cotacao: emp.cotacao,
      dataCotacao: emp.dataCotacao,
      dy: arred(total / emp.cotacao, 6),
      proventosPorAcao: arred(total, 6),
      dividendos: soma('DIVIDENDO'),
      jcp: soma('JRS CAP PROPRIO'),
      rendimentos: soma('RENDIMENTO'),
      pagamentos: datas.length,
      ultimaDataCom: datas.at(-1),
      primeiraDataCom: datas[0],
      historicoParcial: emp.historicoDisponivel === false,
      ajustesAplicados: usados.some((e) => e.valorOriginal != null) ? (emp.ajustes ?? []).filter((a) => usados.some((e) => e.dataCom < a.data)) : [],
      alertas: [
        ...(total / emp.cotacao >= cfg.alertaDyAcimaDe ? ['dy_muito_alto'] : []),
        ...(emp.historicoDisponivel === false ? ['historico_parcial'] : []),
        ...(usados.some((e) => e.valorOriginal != null) ? ['ajustado_por_desdobramento'] : []),
      ],
      proventos: usados.map((e) => ({ dataCom: e.dataCom, tipo: e.tipo, valor: arred(e.valor, 8) })),
    })
    return null
  })

  itens.sort((a, b) => b.dy - a.dy || a.ticker.localeCompare(b.ticker))
  const ranking = itens.slice(0, cfg.rankingAteOnde).map((r, i) => ({ posicao: i + 1, ...r }))
  return {
    resultado: {
      janela: { inicio, fim: dataPrecos, dias: cfg.janelaDias },
      universo: insumos.empresas.length,
      avaliadas: itens.length,
      ranking,
      etapas,
      exclusoes,
    },
    memoria,
  }
}

/** Trava de sanidade da publicação: resultado claramente quebrado (típico de a B3 ter mudado o formato) derruba o job. */
export function verificarSanidade(resultado, cfg) {
  const problemas = []
  const s = cfg.publicacao.sanidade
  if (resultado.avaliadas < s.minimoComProventos) problemas.push(`Só ${resultado.avaliadas} empresas com proventos (mínimo ${s.minimoComProventos}).`)
  const semDadosB3 = resultado.exclusoes.filter((e) => e.codigo === 'sem_dados_b3').length
  const noEscopo = resultado.universo - resultado.exclusoes.filter((e) => e.etapa === 'preco' || e.etapa === 'liquidez').length
  if (noEscopo > 0 && semDadosB3 / noEscopo > s.maximoFracaoSemDadosB3) problemas.push(`${semDadosB3} de ${noEscopo} empresas sem dados na B3 (máximo ${Math.round(s.maximoFracaoSemDadosB3 * 100)}%).`)
  const absurdos = resultado.ranking.filter((r) => r.dy > s.dyMaximoPlausivel)
  if (absurdos.length) problemas.push(`DY acima de ${Math.round(s.dyMaximoPlausivel * 100)}% em ${absurdos.map((r) => r.ticker).join(', ')}: conferir antes de publicar.`)
  return problemas
}
