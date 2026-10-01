import { dataCurta, reais } from '../../domain/mercadoOficial'

export { dataCurta, reais }

/** "+12,35%" / "-3,10%" (sinal de + só para positivo). */
export function pct(n: number, comSinal = true): string {
  const t = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n < 0 ? '-' : comSinal && n > 0 ? '+' : ''}${t}%`
}

/** Quantidade sem zeros inúteis ("100", "0,4", "1.600"). */
export function quantidadeBR(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

/** "Set" a partir de "2026-09". */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export function mesPorExtensoDe(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`
}
