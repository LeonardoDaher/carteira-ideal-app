// Confluência (D119): alinha a leitura técnica (analiseTecnica.ts) com a fundamentalista (analiseFundamentalista.ts). Módulo PURO.
// Cada análise continua separada; aqui só se compara o que uma diz com o que a outra diz, para o horizonte escolhido, e se aponta
// onde o preço de entrada pelos fundamentos encontra (ou não) um suporte do gráfico. Não é recomendação (D19): as duas análises
// olham o passado e o presente, e a confluência não elimina o risco de nenhuma delas.

import type { AnaliseFundamentalista } from './analiseFundamentalista'
import { ROTULO_CATEGORIA } from './analiseFundamentalista'
import type { AnaliseTecnica, Horizonte, Viés } from './analiseTecnica'
import { ROTULO_VIES } from './analiseTecnica'

export type Postura = 'favoravel' | 'neutra' | 'desfavoravel' | 'indisponivel'

export type SituacaoConfluencia =
  | 'confluencia-positiva'
  | 'confluencia-negativa'
  | 'fundamento-favoravel-grafico-neutro'
  | 'fundamento-favoravel-grafico-contra'
  | 'grafico-favoravel-fundamento-neutro'
  | 'grafico-favoravel-fundamento-contra'
  | 'fundamento-desfavoravel-grafico-neutro'
  | 'grafico-desfavoravel-fundamento-neutro'
  | 'sem-direcao'
  | 'incompleta'

export interface PosturaDetalhe {
  postura: Postura
  nota: number | null
  rotulo: string
  detalhe: string
}

export interface ConfluenciaPreco {
  precoEntradaFundamentalista: number | null
  suporte: { inferior: number; superior: number } | null
  resistencia: { inferior: number; superior: number } | null
  relacao: 'coincide' | 'abaixo-do-suporte' | 'acima-do-suporte' | 'abaixo-do-preco-atual' | 'indisponivel'
  texto: string
}

export interface Confluencia {
  ticker: string
  horizonte: Horizonte
  situacao: SituacaoConfluencia
  titulo: string
  leitura: string
  fundamentalista: PosturaDetalhe
  tecnica: PosturaDetalhe
  pontuacao: { valor: number | null; pesoFundamentalista: number; pesoTecnica: number; explicacao: string }
  conviccao: 'alta' | 'media' | 'baixa'
  conviccaoMotivos: string[]
  preco: ConfluenciaPreco
  condicoes: string[]
  riscosDeInterpretacao: string[]
}

export const PESOS_POR_HORIZONTE: Record<Horizonte, { fundamentalista: number; tecnica: number }> = {
  curto: { fundamentalista: 0.3, tecnica: 0.7 },
  medio: { fundamentalista: 0.5, tecnica: 0.5 },
  longo: { fundamentalista: 0.7, tecnica: 0.3 },
}

export const ROTULO_HORIZONTE: Record<Horizonte, string> = { curto: 'Curto prazo', medio: 'Médio prazo', longo: 'Longo prazo' }

const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

export function posturaFundamentalista(f: AnaliseFundamentalista | null): PosturaDetalhe {
  if (!f) return { postura: 'indisponivel', nota: null, rotulo: 'Indisponível', detalhe: 'Sem fundamentos da CVM para esta ação.' }
  const dadosCriticos = f.alertas.some((a) => a.id === 'dados' && a.gravidade === 'critico')
  if (dadosCriticos || f.pontuacao.total === null) return { postura: 'indisponivel', nota: f.pontuacao.total, rotulo: 'Dados insuficientes', detalhe: 'Dados insuficientes para conclusão: a quantidade de ações ou a demonstração não permite medir o valor da empresa.' }
  const c = f.categoria
  const postura: Postura = c === 'atrativa' || c === 'atrativa-com-ressalvas' ? 'favoravel' : c === 'pouco-atrativa' || c === 'evitar' ? 'desfavoravel' : 'neutra'
  const ms = f.valorJusto.margemSegurancaPct
  return {
    postura,
    nota: f.pontuacao.total,
    rotulo: ROTULO_CATEGORIA[c],
    detalhe: `Nota ${f.pontuacao.total}${f.pontuacao.parcial ? ' (parcial)' : ''}; ${ms === null ? 'sem valor justo calculável' : ms >= 0 ? `margem de segurança de ${pct(ms)}` : `preço ${pct(Math.abs(ms))} acima do valor justo base`}.`,
  }
}

export function posturaTecnica(t: AnaliseTecnica | null): PosturaDetalhe {
  if (!t) return { postura: 'indisponivel', nota: null, rotulo: 'Indisponível', detalhe: 'Histórico de preços insuficiente (menos de 60 pregões).' }
  const v: Viés = t.pontuacao.vies
  const semSinal = t.conclusao.semSinal
  const postura: Postura = semSinal ? 'neutra' : v === 'altista' || v === 'moderadamente-altista' ? 'favoravel' : v === 'baixista' || v === 'moderadamente-baixista' ? 'desfavoravel' : 'neutra'
  return { postura, nota: t.pontuacao.total, rotulo: semSinal ? 'Sem sinal técnico consistente' : ROTULO_VIES[v], detalhe: `Pontuação ${t.pontuacao.total}, confiança ${t.confianca.nivel}.` }
}

type Chave = `${Exclude<Postura, 'indisponivel'>}|${Exclude<Postura, 'indisponivel'>}`

const QUADRO: Record<Chave, { situacao: SituacaoConfluencia; titulo: string; leitura: string }> = {
  'favoravel|favoravel': { situacao: 'confluencia-positiva', titulo: 'Confluência positiva', leitura: 'Os fundamentos são favoráveis e o gráfico está a favor: a empresa parece sólida e o preço já se move em tendência de alta. É o cenário de maior alinhamento, mas não elimina o risco: o preço pode já refletir parte do valor.' },
  'favoravel|neutra': { situacao: 'fundamento-favoravel-grafico-neutro', titulo: 'Fundamentos favoráveis, gráfico sem direção', leitura: 'A empresa é atrativa pelos fundamentos, mas o preço está sem tendência definida. Para quem usa o gráfico para escolher o momento, falta confirmação; para quem olha o longo prazo, o preço pode ser acompanhado de perto.' },
  'favoravel|desfavoravel': { situacao: 'fundamento-favoravel-grafico-contra', titulo: 'Fundamentos favoráveis, gráfico contra', leitura: 'Os fundamentos são bons, mas o preço está em tendência de baixa. Duas leituras são possíveis: o mercado enxerga um risco que os números ainda não mostram, ou a queda abre preço melhor. O gráfico sugere esperar sinais de reversão antes de agir.' },
  'neutra|favoravel': { situacao: 'grafico-favoravel-fundamento-neutro', titulo: 'Gráfico favorável, fundamentos neutros', leitura: 'O preço está em tendência de alta, mas os fundamentos não indicam oportunidade clara. O movimento tem menos apoio nos números e depende mais de fluxo e de humor do mercado.' },
  'neutra|neutra': { situacao: 'sem-direcao', titulo: 'Sem direção em nenhuma das leituras', leitura: 'Nem os fundamentos nem o gráfico indicam oportunidade ou risco claros neste momento.' },
  'neutra|desfavoravel': { situacao: 'grafico-desfavoravel-fundamento-neutro', titulo: 'Gráfico desfavorável, fundamentos neutros', leitura: 'O preço está em tendência de baixa e os fundamentos não oferecem contrapeso. Falta motivo, nos números, para apostar contra a tendência.' },
  'desfavoravel|favoravel': { situacao: 'grafico-favoravel-fundamento-contra', titulo: 'Gráfico favorável, fundamentos contra', leitura: 'O preço sobe, mas os fundamentos são fracos. Movimentos assim tendem a ser mais arriscados e curtos: dependem de o mercado manter o interesse sem apoio dos números.' },
  'desfavoravel|neutra': { situacao: 'fundamento-desfavoravel-grafico-neutro', titulo: 'Fundamentos desfavoráveis, gráfico sem direção', leitura: 'Os fundamentos pesam contra e o gráfico não oferece sinal que compense.' },
  'desfavoravel|desfavoravel': { situacao: 'confluencia-negativa', titulo: 'Confluência negativa', leitura: 'Fundamentos fracos e gráfico em baixa apontam na mesma direção. É o cenário de maior alinhamento negativo: tanto a empresa quanto o preço sugerem cautela.' },
}

function relacaoDePreco(f: AnaliseFundamentalista | null, t: AnaliseTecnica | null): ConfluenciaPreco {
  const nada = (texto: string): ConfluenciaPreco => ({ precoEntradaFundamentalista: null, suporte: null, resistencia: null, relacao: 'indisponivel', texto })
  const entrada = f?.valorJusto.aplicavel ? f.valorJusto.precoEntrada : null
  const preco = t?.preco ?? f?.mercado.preco ?? null
  const sup = t?.zonas.filter((z) => z.tipo === 'suporte').sort((a, b) => b.superior - a.superior)[0]
  const res = t?.zonas.filter((z) => z.tipo === 'resistencia').sort((a, b) => a.inferior - b.inferior)[0]
  const suporte = sup ? { inferior: sup.inferior, superior: sup.superior } : null
  const resistencia = res ? { inferior: res.inferior, superior: res.superior } : null
  if (entrada === null) return { ...nada(f ? 'Sem valor justo calculável: não há preço de entrada pelos fundamentos para comparar com o gráfico.' : 'Sem fundamentos para comparar com o gráfico.'), suporte, resistencia }
  if (preco === null) return { ...nada('Sem preço atual.'), precoEntradaFundamentalista: entrada, suporte, resistencia }
  const alvo = `O preço de entrada pelos fundamentos (margem de segurança de 25% sobre o valor justo base) é ${reais(entrada)}`
  if (preco <= entrada) return { precoEntradaFundamentalista: entrada, suporte, resistencia, relacao: 'abaixo-do-preco-atual', texto: `${alvo}; o preço atual (${reais(preco)}) já está nesse nível ou abaixo dele.` }
  if (!suporte) return { precoEntradaFundamentalista: entrada, suporte, resistencia, relacao: 'indisponivel', texto: `${alvo}, ${pct((entrada / preco - 1) * 100)} do preço atual. Não há suporte técnico identificado para comparar.` }
  const dentro = entrada >= suporte.inferior * 0.97 && entrada <= suporte.superior * 1.03
  if (dentro) return { precoEntradaFundamentalista: entrada, suporte, resistencia, relacao: 'coincide', texto: `${alvo}, ${pct((entrada / preco - 1) * 100)} do preço atual, e coincide com o suporte técnico de ${reais(suporte.inferior)} a ${reais(suporte.superior)}: uma região em que fundamentos e gráfico se encontram.` }
  if (entrada > suporte.superior) return { precoEntradaFundamentalista: entrada, suporte, resistencia, relacao: 'acima-do-suporte', texto: `${alvo}, ${pct((entrada / preco - 1) * 100)} do preço atual, acima do suporte técnico mais próximo (${reais(suporte.inferior)} a ${reais(suporte.superior)}): o preço de entrada pode ser tocado sem perder o suporte.` }
  return { precoEntradaFundamentalista: entrada, suporte, resistencia, relacao: 'abaixo-do-suporte', texto: `${alvo}, ${pct((entrada / preco - 1) * 100)} do preço atual, abaixo do suporte técnico mais próximo (${reais(suporte.inferior)} a ${reais(suporte.superior)}): chegar lá exigiria perder esse suporte.` }
}

export function analisarConfluencia(entrada: { ticker: string; fundamentalista: AnaliseFundamentalista | null; tecnica: AnaliseTecnica | null; horizonte?: Horizonte }): Confluencia {
  const horizonte = entrada.horizonte ?? 'medio'
  const f = posturaFundamentalista(entrada.fundamentalista)
  const t = posturaTecnica(entrada.tecnica)
  const pesos = PESOS_POR_HORIZONTE[horizonte]
  const completa = f.postura !== 'indisponivel' && t.postura !== 'indisponivel'
  const preco = relacaoDePreco(entrada.fundamentalista, entrada.tecnica)

  const quadro = completa ? QUADRO[`${f.postura as Exclude<Postura, 'indisponivel'>}|${t.postura as Exclude<Postura, 'indisponivel'>}`] : null
  const valor = completa && f.nota !== null && t.nota !== null ? Math.round(f.nota * pesos.fundamentalista + t.nota * pesos.tecnica) : null

  // Convicção: quanto as duas leituras concordam e quão confiáveis são os dados de cada uma.
  const motivos: string[] = []
  let conviccao: Confluencia['conviccao'] = 'media'
  if (!completa) {
    conviccao = 'baixa'
    motivos.push('Uma das análises está indisponível.')
  } else {
    const opostas = (f.postura === 'favoravel' && t.postura === 'desfavoravel') || (f.postura === 'desfavoravel' && t.postura === 'favoravel')
    const iguais = f.postura === t.postura && f.postura !== 'neutra'
    const confTec = entrada.tecnica?.confianca.nivel
    const confVal = entrada.fundamentalista?.valorJusto.aplicavel ? entrada.fundamentalista.valorJusto.confianca : 'baixa'
    if (opostas) {
      conviccao = 'baixa'
      motivos.push('As duas leituras apontam em direções opostas.')
    } else if (iguais && confTec !== 'baixa' && confVal !== 'baixa') {
      conviccao = 'alta'
      motivos.push('As duas leituras apontam na mesma direção, com dados de boa qualidade.')
    } else {
      motivos.push(f.postura === 'neutra' || t.postura === 'neutra' ? 'Pelo menos uma das leituras está neutra.' : 'Leituras na mesma direção, mas com confiança baixa em uma delas.')
    }
    if (confTec === 'baixa') motivos.push('A confiança da leitura técnica é baixa.')
    if (confVal === 'baixa') motivos.push('O valor justo tem baixa confiança ou não pôde ser calculado.')
  }

  const condicoes: string[] = []
  if (entrada.fundamentalista && f.postura !== 'indisponivel') {
    if (preco.precoEntradaFundamentalista !== null && (entrada.tecnica ? entrada.tecnica.preco : (entrada.fundamentalista.mercado.preco ?? 0)) > preco.precoEntradaFundamentalista) {
      condicoes.push(`Fundamentos: preço em torno de ${reais(preco.precoEntradaFundamentalista)} dá margem de segurança de 25% sobre o valor justo base.`)
    }
    condicoes.push(...entrada.fundamentalista.recomendacao.reavaliar.slice(0, 2))
  }
  if (entrada.tecnica && t.postura !== 'indisponivel') {
    condicoes.push(...entrada.tecnica.conclusao.monitorar.slice(0, 2))
    if (f.postura === 'favoravel' && t.postura !== 'favoravel') {
      const r = entrada.tecnica.zonas.filter((z) => z.tipo === 'resistencia')[0]
      if (r) condicoes.push(`Gráfico: fechamento acima de ${reais(r.superior)} (resistência mais próxima) confirmaria a tendência a favor dos fundamentos.`)
    }
    if (f.postura === 'desfavoravel' && t.postura === 'favoravel') {
      const s = entrada.tecnica.zonas.filter((z) => z.tipo === 'suporte')[0]
      if (s) condicoes.push(`Gráfico: a perda de ${reais(s.inferior)} (suporte mais próximo) tiraria o único apoio da alta.`)
    }
  }

  const riscos: string[] = []
  const tec = entrada.tecnica
  const fun = entrada.fundamentalista
  if (tec?.volume.liquidez === 'baixa') riscos.push('Liquidez baixa: sinais técnicos são menos confiáveis e a execução é mais difícil.')
  if (tec && tec.qualidade.saltosNaoConfirmados.length) riscos.push('Há salto de preço não confirmado como desdobramento: o gráfico pode estar distorcido.')
  if (fun?.pontuacao.parcial) riscos.push('A nota fundamentalista é parcial: faltou a avaliação de uma das dimensões.')
  if (fun?.valorJusto.aplicavel && fun.valorJusto.confianca === 'baixa') riscos.push('O valor justo tem baixa confiança: trate a faixa como ordem de grandeza.')
  if (fun) riscos.push(`Os fundamentos usam o balanço de ${fun.dados.ultimoTrimestre.slice(8, 10)}/${fun.dados.ultimoTrimestre.slice(5, 7)}/${fun.dados.ultimoTrimestre.slice(0, 4)}; o preço é mais recente. Resultados novos podem mudar a leitura.`)
  riscos.push('Fundamentos medem o valor ao longo de anos; o gráfico mede o comportamento do preço em dias e semanas. Os dois podem divergir por muito tempo.')
  riscos.push('Esta é uma leitura quantitativa e educacional, baseada no passado e no presente. Não é recomendação de compra ou venda.')

  const situacao = quadro?.situacao ?? 'incompleta'
  const titulo = quadro?.titulo ?? 'Análise incompleta'
  const leitura = quadro
    ? `${quadro.leitura}${preco.relacao !== 'indisponivel' ? ` ${preco.texto}` : ''}`
    : `${f.postura === 'indisponivel' ? `Fundamentos: ${f.detalhe}` : ''} ${t.postura === 'indisponivel' ? `Gráfico: ${t.detalhe}` : ''} Sem as duas leituras, a confluência não pode ser avaliada.`.trim()

  return {
    ticker: entrada.ticker,
    horizonte,
    situacao,
    titulo,
    leitura,
    fundamentalista: f,
    tecnica: t,
    pontuacao: {
      valor,
      pesoFundamentalista: pesos.fundamentalista,
      pesoTecnica: pesos.tecnica,
      explicacao: valor === null ? 'Sem as duas notas, não há pontuação combinada.' : `Média ponderada da nota fundamentalista (${f.nota}) e da técnica (${t.nota}) para o horizonte de ${horizonte === 'curto' ? 'curto' : horizonte === 'medio' ? 'médio' : 'longo'} prazo: ${Math.round(pesos.fundamentalista * 100)}% fundamentos e ${Math.round(pesos.tecnica * 100)}% gráfico. A nota combinada não substitui a leitura de cada análise: duas notas médias podem esconder uma boa e uma ruim.`,
    },
    conviccao,
    conviccaoMotivos: motivos,
    preco,
    condicoes: condicoes.filter((c, i, a) => a.indexOf(c) === i),
    riscosDeInterpretacao: riscos,
  }
}
