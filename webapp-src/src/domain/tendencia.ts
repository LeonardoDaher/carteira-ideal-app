import { montarLinha } from './opcoes'
import type { AtivoComOpcoes, TendenciaAtivo } from './opcoes'

// Leitura da tendência do ativo, para a aba "Por visão de mercado". É uma leitura do PASSADO, feita com médias móveis e
// retornos: não prevê nada, e a pessoa pode escolher outra visão.

export type Visao = 'alta' | 'baixa' | 'lateral' | 'oscilacao'

export const ROTULO_VISAO: Record<Visao, string> = {
  alta: 'Alta',
  baixa: 'Baixa',
  lateral: 'Lateral',
  oscilacao: 'Muita oscilação',
}

/** Retorno mínimo em 63 pregões (%) para a leitura deixar de ser lateral. */
export const RETORNO_MINIMO_PCT = 3

export interface LeituraDeTendencia {
  /** A leitura de tendência só tem três estados; "muita oscilação" é uma visão que a pessoa escolhe. */
  leitura: 'alta' | 'baixa' | 'lateral'
  /** Frases com os números que levaram à leitura. */
  motivos: string[]
}

const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (v: number, sinal = false) => `${sinal && v > 0 ? '+' : ''}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

/**
 * Alta: preço acima da média de 21 pregões, que está acima da de 63, com retorno de 63 pregões de pelo menos +3%. Baixa: o
 * inverso. Qualquer outra combinação é lateral.
 */
export function lerTendencia(t: TendenciaAtivo): LeituraDeTendencia {
  const acima = t.fechamento > t.sma21 && t.sma21 > t.sma63
  const abaixo = t.fechamento < t.sma21 && t.sma21 < t.sma63
  const leitura = acima && t.retorno63 >= RETORNO_MINIMO_PCT ? 'alta' : abaixo && t.retorno63 <= -RETORNO_MINIMO_PCT ? 'baixa' : 'lateral'
  const motivos = [
    `Preço ${reais(t.fechamento)}, média de 21 pregões ${reais(t.sma21)} e de 63 pregões ${reais(t.sma63)}.`,
    `Retorno de ${pct(t.retorno21, true)} em 21 pregões e de ${pct(t.retorno63, true)} em 63.`,
  ]
  if (t.posicao52 !== null) motivos.push(`Na faixa de 52 semanas, o preço está em ${t.posicao52.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% (0% é a mínima, 100% a máxima).`)
  if (leitura === 'lateral') {
    motivos.push(
      acima || abaixo
        ? `As médias apontam ${acima ? 'alta' : 'baixa'}, mas o retorno de 63 pregões é pequeno (menos de ${RETORNO_MINIMO_PCT}%): leitura lateral.`
        : 'Preço e médias não estão alinhados em uma direção: leitura lateral.',
    )
  }
  return { leitura, motivos }
}

/**
 * Volatilidade implícita (% ao ano) perto do dinheiro no vencimento: média das séries com strike a até 3% do preço do ativo e
 * ao menos 3 negócios. null se não houver série assim. Serve para comparar com a volatilidade realizada: implícita acima da
 * realizada indica opções caras em relação ao que o ativo vem oscilando.
 */
export function volImplicitaPertoDoDinheiro(ativo: AtivoComOpcoes, vencimento: string, hoje: string, jurosAnual: number): number | null {
  const vols = ativo.series
    .filter((s) => s.vencimento === vencimento && s.negocios >= 3 && Math.abs(s.strike / ativo.cotacao - 1) <= 0.03)
    .map((s) => montarLinha(s, ativo.cotacao, hoje, jurosAnual).volImplicita)
    .filter((v): v is number => v !== null)
  if (vols.length === 0) return null
  return vols.reduce((a, b) => a + b, 0) / vols.length
}
