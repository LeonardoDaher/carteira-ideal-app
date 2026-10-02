// Simular com os MEUS ATIVOS: o que o investidor precisa ATACAR primeiro. Compara a carteira que ele já tem com a
// carteira sugerida e ordena as classes por prioridade, para guiar o próximo aporte. Módulo puro (sem React, sem rede):
// os dados da pessoa ficam no aparelho.
//
// A lógica (a pedida pelo usuário): quem está muito mais posicionado em uma classe precisa primeiro levar as outras ao
// percentual delas, antes de colocar mais dinheiro naquela em que já está forte.
//  - ATACAR: classe abaixo do alvo, fora da faixa de tolerância. Recebe número de prioridade: 1 é a mais distante do alvo.
//  - PERTO: classe dentro da faixa de tolerância (a mesma da comparação: o maior entre 2 pp e 20% do alvo).
//  - SEGURAR: classe acima do alvo, fora da faixa. Não receber aporte até as demais alcançarem.
//  - Base de cálculo: só o que está nas classes da carteira sugerida. O que está "fora" dela (previdência, COE, CDB com
//    prazo...) e as classes sem alvo não entram; a tela mostra o valor à parte.
import { montarPainel } from './painelCarteira'
import type { CarteiraSalva } from './carteiraSalva'
import { agruparTesouroDireto, classificarPosicoes, valoresPorClasse, type AtivoClassificado } from './classesDaCarteira'
import type { CatalogoAtivos, ClasseCarteira } from './classificadorAtivo'
import { compararComReferencia, distribuirAporte, ORDEM_CLASSES, referenciaNormalizada, toleranciaPp } from './carteiraAtual'
import type { AtivoKey, Carteira } from './types'

export interface BaseDaCarteira {
  /** Valor por classe, com os três Tesouros somados em "Tesouro Direto" (chave tesouroIPCA), como na comparação. */
  valores: Partial<Record<ClasseCarteira, number>>
  /** Ativos sem classe (ficam de fora até a pessoa escolher) e quanto valem. */
  pendentes: AtivoClassificado[]
  valorPendente: number
}

/** Lê a carteira salva (Meus Ativos) e devolve o valor por classe. A mesma classificação da tela de comparação. */
export function baseDaCarteira(c: CarteiraSalva, catalogo: CatalogoAtivos): BaseDaCarteira {
  const painel = montarPainel(c.lancamentos, c.posicao, c.dataPosicao, c.precosMedios, c.ativosManuais, c.ativosExcluidos)
  // A classe de um ativo digitado à mão é a que a pessoa escolheu; vale mais que qualquer outra.
  const classes = { ...c.classes, ...Object.fromEntries(c.ativosManuais.map((m) => [m.ativo, m.classe])) } as Record<string, ClasseCarteira>
  const { valores, pendentes, valorPendente } = valoresPorClasse(classificarPosicoes(painel.linhas, catalogo, classes))
  return { valores: agruparTesouroDireto(valores), pendentes, valorPendente }
}

export type SituacaoClasse = 'atacar' | 'perto' | 'segurar'

export interface LinhaPrioridade {
  classe: AtivoKey
  /** Quanto a pessoa tem hoje na classe. */
  atual: number
  pctAtual: number
  /** Alvo da carteira sugerida, em %. */
  alvoPct: number
  /** Alvo menos o que tem hoje, em pontos percentuais: positivo = falta, negativo = passou do alvo. */
  difPp: number
  /** Quanto valeria a diferença no patrimônio de hoje (só quando falta; 0 se está no alvo ou acima). */
  faltaReais: number
  /** Quanto do alvo já está preenchido, de 0 a 100 (acima do alvo fica em 100). */
  preenchidoPct: number
  situacao: SituacaoClasse
  /** 1, 2, 3... só para as classes a atacar (1 = a mais distante do alvo); null nas demais. */
  prioridade: number | null
}

export interface ResultadoPrioridade {
  /** Há patrimônio em classes da carteira sugerida para comparar. */
  temBase: boolean
  /** Patrimônio nas classes da carteira sugerida (a base da conta). */
  patrimonioBase: number
  /** Valor que ficou de fora da conta (fora da carteira sugerida ou em classe sem alvo). */
  foraDaBase: number
  /** Todas as classes com alvo, na ordem de prioridade: atacar, perto, segurar. */
  linhas: LinhaPrioridade[]
  atacar: LinhaPrioridade[]
  perto: LinhaPrioridade[]
  segurar: LinhaPrioridade[]
}

const EPS = 1e-9
const cent = (n: number) => Math.round(n * 100) / 100

/**
 * Diz o que atacar primeiro. Ordena por distância do alvo em pontos percentuais: quem está mais abaixo vem antes;
 * entre as que passaram do alvo, quem passou mais vem antes (é onde mais convém segurar a mão).
 */
export function priorizarClasses(valores: Partial<Record<ClasseCarteira, number>>, referencia: Carteira): ResultadoPrioridade {
  const ref = referenciaNormalizada(referencia)
  const classes = ORDEM_CLASSES.filter((k) => (ref[k] ?? 0) > 0)
  const v = (k: AtivoKey) => Math.max(0, valores[k] ?? 0)
  const patrimonioBase = classes.reduce((s, k) => s + v(k), 0)
  const total = Object.values(valores).reduce<number>((s, x) => s + Math.max(0, x ?? 0), 0)
  const foraDaBase = Math.max(0, total - patrimonioBase)
  if (!(patrimonioBase > EPS) || !classes.length) return { temBase: false, patrimonioBase, foraDaBase, linhas: [], atacar: [], perto: [], segurar: [] }

  const base = classes.map((k) => {
    const alvoPct = ref[k] ?? 0
    const pctAtual = (v(k) / patrimonioBase) * 100
    const difPp = alvoPct - pctAtual
    const tol = toleranciaPp(alvoPct)
    const situacao: SituacaoClasse = difPp > tol ? 'atacar' : difPp < -tol ? 'segurar' : 'perto'
    return {
      classe: k,
      atual: v(k),
      pctAtual,
      alvoPct,
      difPp,
      faltaReais: difPp > 0 ? cent((difPp / 100) * patrimonioBase) : 0,
      preenchidoPct: Math.min(100, (pctAtual / alvoPct) * 100),
      situacao,
      prioridade: null as number | null,
    }
  })
  const mesmaOrdem = (a: { classe: AtivoKey }, b: { classe: AtivoKey }) => ORDEM_CLASSES.indexOf(a.classe) - ORDEM_CLASSES.indexOf(b.classe)
  const atacar = base.filter((l) => l.situacao === 'atacar').sort((a, b) => b.difPp - a.difPp || mesmaOrdem(a, b))
  atacar.forEach((l, i) => { l.prioridade = i + 1 })
  const perto = base.filter((l) => l.situacao === 'perto').sort((a, b) => b.difPp - a.difPp || mesmaOrdem(a, b))
  const segurar = base.filter((l) => l.situacao === 'segurar').sort((a, b) => a.difPp - b.difPp || mesmaOrdem(a, b))
  return { temBase: true, patrimonioBase, foraDaBase, linhas: [...atacar, ...perto, ...segurar], atacar, perto, segurar }
}

export interface ResultadoAporteDado {
  aporte: number
  /** Quanto vai para cada classe (só as que estão abaixo do alvo). */
  alocacoes: { classe: AtivoKey; valor: number }[]
  /** Aderência à carteira sugerida (0 a 100) antes e depois do aporte; null sem patrimônio. */
  aderenciaAntes: number | null
  aderenciaDepois: number | null
}

/**
 * "E se eu investir X agora?": distribui o valor entre as classes abaixo do alvo e mostra a aderência antes e depois.
 * Usa a MESMA base do ranking (só as classes da carteira sugerida), para que uma classe marcada como "segurar" não
 * receba dinheiro por causa do que está fora da conta.
 */
export function simularAporteDado(valores: Partial<Record<ClasseCarteira, number>>, referencia: Carteira, aporte: number): ResultadoAporteDado {
  const ref = referenciaNormalizada(referencia)
  const naBase: Partial<Record<ClasseCarteira, number>> = {}
  for (const k of ORDEM_CLASSES) if ((ref[k] ?? 0) > 0 && (valores[k] ?? 0) > 0) naBase[k] = valores[k]
  const alocacoes = distribuirAporte(naBase, referencia, aporte)
  const depois: Partial<Record<ClasseCarteira, number>> = { ...naBase }
  for (const a of alocacoes) depois[a.classe] = (depois[a.classe] ?? 0) + a.valor
  const antes = compararComReferencia(naBase, referencia).aderencia
  return { aporte, alocacoes, aderenciaAntes: antes, aderenciaDepois: alocacoes.length ? compararComReferencia(depois, referencia).aderencia : antes }
}
