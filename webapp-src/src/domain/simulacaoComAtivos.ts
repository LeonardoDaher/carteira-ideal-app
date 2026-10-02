// Simular com os MEUS ATIVOS: quanto a pessoa precisa investir, SEM VENDER NADA, para que a carteira que ela já tem
// chegue aos percentuais da carteira sugerida. Módulo puro (sem React, sem rede): os dados da pessoa ficam no aparelho.
//
// Método (o mesmo de qualquer rebalanceamento só com aportes):
//  - Cada classe da carteira sugerida tem um alvo p. Como não há venda, uma classe que já passou do alvo só "diminui"
//    de peso quando o patrimônio total cresce. Logo, o total necessário é definido pela classe MAIS ACIMA DO ALVO:
//    T = max(V_i / p_i). As demais recebem o que falta: aporte_i = p_i × T − V_i.
//  - Modo "faixa": em vez do percentual exato, basta cada classe ficar DENTRO DO ALVO (a mesma tolerância da
//    comparação: o maior entre 2 pp e 20% do alvo). Exige bem menos dinheiro.
//  - Base de cálculo: só o que está nas classes da carteira sugerida. O que está "fora" dela (previdência, COE, CDB com
//    prazo...) e as classes sem alvo não entram, porque sem vender não dá para levá-los a 0%. A tela mostra o valor à parte.
import { montarPainel } from './painelCarteira'
import type { CarteiraSalva } from './carteiraSalva'
import { agruparTesouroDireto, classificarPosicoes, valoresPorClasse, type AtivoClassificado } from './classesDaCarteira'
import type { CatalogoAtivos, ClasseCarteira } from './classificadorAtivo'
import { compararComReferencia, distribuirAporte, ORDEM_CLASSES, referenciaNormalizada, toleranciaPp } from './carteiraAtual'
import type { AtivoKey, Carteira } from './types'

export type ModoSimulacao = 'exato' | 'faixa'

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

export interface LinhaSimulacao {
  classe: AtivoKey
  /** Quanto a pessoa tem hoje na classe. */
  atual: number
  pctAtual: number
  /** Alvo da carteira sugerida, em %. */
  alvoPct: number
  /** Quanto investir nesta classe. */
  aporte: number
  /** Quanto a classe passa a valer depois do aporte. */
  final: number
  pctFinal: number
}

export interface ResultadoSimulacao {
  modo: ModoSimulacao
  /** Há patrimônio em classes da carteira sugerida para calcular. */
  temBase: boolean
  /** Patrimônio nas classes da carteira sugerida (a base da conta). */
  patrimonioBase: number
  /** Valor que ficou de fora da conta (fora da carteira sugerida ou em classe sem alvo). */
  foraDaBase: number
  aporteTotal: number
  patrimonioFinal: number
  /** Só as classes com alvo, na ordem da carteira sugerida. */
  linhas: LinhaSimulacao[]
  /** Classe que já está mais acima do alvo e, por isso, define o total a investir. null se nenhuma limita. */
  ancora: AtivoKey | null
}

const EPS = 1e-9
const cent = (n: number) => Math.round(n * 100) / 100

export function simularAporteParaAtingir(valores: Partial<Record<ClasseCarteira, number>>, referencia: Carteira, modo: ModoSimulacao): ResultadoSimulacao {
  const ref = referenciaNormalizada(referencia)
  const classes = ORDEM_CLASSES.filter((k) => (ref[k] ?? 0) > 0)
  const v = (k: AtivoKey) => Math.max(0, valores[k] ?? 0)
  const patrimonioBase = classes.reduce((s, k) => s + v(k), 0)
  const total = Object.values(valores).reduce<number>((s, x) => s + Math.max(0, x ?? 0), 0)
  const foraDaBase = Math.max(0, total - patrimonioBase)
  const vazio: ResultadoSimulacao = { modo, temBase: false, patrimonioBase, foraDaBase, aporteTotal: 0, patrimonioFinal: patrimonioBase, linhas: [], ancora: null }
  if (!(patrimonioBase > EPS) || !classes.length) return vazio

  const p = (k: AtivoKey) => (ref[k] ?? 0) / 100
  const hi = (k: AtivoKey) => (modo === 'exato' ? p(k) : Math.min(1, p(k) + toleranciaPp(ref[k] ?? 0) / 100))
  const lo = (k: AtivoKey) => (modo === 'exato' ? p(k) : Math.max(0, p(k) - toleranciaPp(ref[k] ?? 0) / 100))

  // Menor patrimônio total T em que nenhuma classe passa do teto (hi) e todas cabem (soma dos pisos <= T).
  const limites = classes.map((k) => ({ k, t: v(k) / hi(k) }))
  const tMin = Math.max(patrimonioBase, ...limites.map((x) => x.t))
  const sobra = (t: number) => classes.reduce((s, k) => s + Math.max(v(k), lo(k) * t), 0) - t // não cresce com t (soma dos pisos < 1)
  let T = tMin
  if (sobra(T) > EPS) {
    let alto = T * 2
    for (let i = 0; i < 80 && sobra(alto) > EPS; i++) alto *= 2
    let baixo = T
    for (let i = 0; i < 100; i++) {
      const meio = (baixo + alto) / 2
      if (sobra(meio) > EPS) baixo = meio
      else alto = meio
    }
    T = alto
  }

  // Cada classe vai ao seu piso (ou fica onde está); o que resta anda em direção ao alvo, sem passar do teto.
  const final = new Map<AtivoKey, number>(classes.map((k) => [k, Math.max(v(k), lo(k) * T)]))
  const resta = T - [...final.values()].reduce((s, x) => s + x, 0)
  if (resta > EPS) {
    const faltas = classes.map((k) => ({ k, d: Math.max(0, p(k) * T - (final.get(k) ?? 0)) }))
    const somaFaltas = faltas.reduce((s, f) => s + f.d, 0)
    if (somaFaltas > EPS) for (const f of faltas) final.set(f.k, (final.get(f.k) ?? 0) + (resta * f.d) / somaFaltas)
  }

  // Em centavos, fechando a soma exata pelo maior resto.
  const alvoCent = Math.max(0, Math.round((T - patrimonioBase) * 100))
  const brutos = classes.map((k) => ({ k, c: Math.max(0, ((final.get(k) ?? 0) - v(k)) * 100) }))
  const pisos = brutos.map((b) => ({ k: b.k, c: Math.floor(b.c + 1e-7), resto: b.c - Math.floor(b.c + 1e-7) }))
  let falta = alvoCent - pisos.reduce((s, x) => s + x.c, 0)
  for (const x of [...pisos].sort((a, b) => b.resto - a.resto)) {
    if (falta <= 0) break
    x.c += 1
    falta -= 1
  }
  const aporteDe = new Map(pisos.map((x) => [x.k, x.c / 100]))
  const aporteTotal = cent(pisos.reduce((s, x) => s + x.c, 0) / 100)
  const patrimonioFinal = cent(patrimonioBase + aporteTotal)

  const linhas: LinhaSimulacao[] = classes.map((k) => {
    const aporte = aporteDe.get(k) ?? 0
    const fim = cent(v(k) + aporte)
    return {
      classe: k,
      atual: v(k),
      pctAtual: (v(k) / patrimonioBase) * 100,
      alvoPct: ref[k] ?? 0,
      aporte,
      final: fim,
      pctFinal: patrimonioFinal > 0 ? (fim / patrimonioFinal) * 100 : 0,
    }
  })
  const maisAcima = [...limites].sort((a, b) => b.t - a.t)[0]
  const ancora = aporteTotal > 0 && (aporteDe.get(maisAcima.k) ?? 0) === 0 ? maisAcima.k : null
  return { modo, temBase: true, patrimonioBase, foraDaBase, aporteTotal, patrimonioFinal, linhas, ancora }
}

export interface ResultadoAporteDado {
  aporte: number
  /** Quanto vai para cada classe (só as que estão abaixo do alvo). */
  alocacoes: { classe: AtivoKey; valor: number }[]
  /** Aderência à carteira sugerida (0 a 100) antes e depois do aporte; null sem patrimônio. */
  aderenciaAntes: number | null
  aderenciaDepois: number | null
}

/** "E se eu investir só X agora?": distribui o valor entre as classes abaixo do alvo e mostra a aderência antes e depois. */
export function simularAporteDado(valores: Partial<Record<ClasseCarteira, number>>, referencia: Carteira, aporte: number): ResultadoAporteDado {
  const alocacoes = distribuirAporte(valores, referencia, aporte)
  const depois: Partial<Record<ClasseCarteira, number>> = { ...valores }
  for (const a of alocacoes) depois[a.classe] = (depois[a.classe] ?? 0) + a.valor
  return {
    aporte,
    alocacoes,
    aderenciaAntes: compararComReferencia(valores, referencia).aderencia,
    aderenciaDepois: alocacoes.length ? compararComReferencia(depois, referencia).aderencia : compararComReferencia(valores, referencia).aderencia,
  }
}
