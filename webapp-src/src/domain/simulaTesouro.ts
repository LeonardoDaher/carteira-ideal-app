// Simulador do Tesouro Direto (aba "Simule Tesouro").
//
// Estima quanto um valor aplicado hoje num título SEM CUPOM vira no vencimento, com a
// custódia da B3 e o IR regressivo, e quanto isso vale em dinheiro de hoje. Como em
// rendaFii.ts, é aritmética sobre dados públicos (Tesouro Transparente e Boletim Focus),
// sem metodologia proprietária, por isso roda no app.
//
// Simplificações assumidas e ditas na tela:
// - O prazo é contado em dias corridos / 365 (o Tesouro usa dias úteis / 252). Para
//   estimativa de vencimento, a diferença é pequena.
// - Tesouro Selic: a Selic de cada ano é a média entre o valor no início e a projeção do
//   Focus para o fim do ano. IPCA+: a inflação de cada ano é a projeção do Focus. Depois do
//   último ano projetado, repete o último valor.
// - Custódia de 0,20% a.a. sobre o valor médio do título em cada trecho; no Tesouro Selic,
//   só sobre o que passar de R$ 10 mil (supondo que seja o único Tesouro Selic da pessoa).
// - IR regressivo sobre o ganho já descontada a custódia.
// - Títulos com juros semestrais ficam fora: os cupons são pagos e tributados no caminho,
//   e simular exigiria uma premissa de reinvestimento.

import type { SnapshotMercado, TituloTesouro } from './mercadoOficial'

export const TAXA_CUSTODIA_AA = 0.002
export const ISENCAO_CUSTODIA_SELIC = 10_000
export const INVESTIMENTO_MINIMO = 30
export const VALORES_PADRAO = [1_000, 5_000, 10_000, 50_000]

export interface PremissasFocus {
  /** Data da coleta do Focus, AAAA-MM-DD */
  data: string
  ipca: Record<string, number>
  selic: Record<string, number>
}

export interface ResultadoSimulacao {
  aplicado: number
  /** Dias corridos até o vencimento */
  dias: number
  anos: number
  bruto: number
  custodia: number
  /** Alíquota de IR aplicada, em % (22,5; 20; 17,5 ou 15) */
  aliquotaIr: number
  ir: number
  liquido: number
  /** Rentabilidade líquida ao ano, em % */
  liquidoAoAno: number
  /** Valor líquido em dinheiro de hoje, descontada a inflação projetada */
  liquidoHoje: number
  /** Ganho acima da inflação projetada, ao ano, em % */
  ganhoRealAoAno: number
}

/** Tabela regressiva de IR da renda fixa, pelo prazo total em dias corridos. */
export function aliquotaIr(dias: number): number {
  if (dias <= 180) return 22.5
  if (dias <= 360) return 20
  if (dias <= 720) return 17.5
  return 15
}

/** Títulos que o simulador aceita: à venda e sem cupom, nas três famílias principais. */
export function simulavel(t: TituloTesouro): boolean {
  return t.aVenda && t.taxaCompra != null && t.cupom === 'sem cupom' && ['Tesouro Selic', 'Tesouro Prefixado', 'Tesouro IPCA+'].includes(t.familia)
}

/** Valor mínimo de compra: 1% do preço do título, respeitando o piso de R$ 30. */
export function minimoDeCompra(t: TituloTesouro): number {
  return Math.max(INVESTIMENTO_MINIMO, Math.ceil((t.puCompra ?? 0) * 0.01 * 100) / 100)
}

/** Valor anual de uma projeção por ano; depois do último ano projetado, repete o último. */
export function projecaoDoAno(porAno: Record<string, number>, ano: number): number | null {
  const anos = Object.keys(porAno).map(Number).sort((a, b) => a - b)
  if (anos.length === 0) return null
  if (String(ano) in porAno) return porAno[String(ano)]
  if (ano > anos.at(-1)!) return porAno[String(anos.at(-1))]
  return porAno[String(anos[0])]
}

interface Trecho {
  ano: number
  /** Fração de ano do trecho (dias / 365) */
  fracao: number
}

/** Divide o período entre duas datas em trechos por ano civil. */
export function trechosPorAno(inicioIso: string, fimIso: string): Trecho[] {
  const trechos: Trecho[] = []
  const t0 = Date.parse(`${inicioIso}T00:00:00Z`)
  const t1 = Date.parse(`${fimIso}T00:00:00Z`)
  let cursor = t0
  while (cursor < t1) {
    const ano = new Date(cursor).getUTCFullYear()
    const viradaDoAno = Date.UTC(ano + 1, 0, 1)
    const fim = Math.min(viradaDoAno, t1)
    trechos.push({ ano, fracao: (fim - cursor) / 86_400_000 / 365 })
    cursor = fim
  }
  return trechos
}

/**
 * Simula a aplicação até o vencimento. `hojeIso` é a data-base das taxas (o dia em que a
 * compra seria feita) e `selicHoje` é a Selic meta vigente, ponto de partida da Selic.
 */
export function simular(
  titulo: TituloTesouro,
  aplicado: number,
  { hojeIso, focus, selicHoje }: { hojeIso: string; focus: PremissasFocus; selicHoje: number },
): ResultadoSimulacao | null {
  if (!simulavel(titulo) || !(aplicado > 0) || titulo.vencimento <= hojeIso) return null
  const taxa = titulo.taxaCompra! / 100
  const trechos = trechosPorAno(hojeIso, titulo.vencimento)
  const dias = Math.round((Date.parse(`${titulo.vencimento}T00:00:00Z`) - Date.parse(`${hojeIso}T00:00:00Z`)) / 86_400_000)
  const anos = dias / 365

  let valor = aplicado
  let custodia = 0
  let deflator = 1
  let selicInicioDoAno = selicHoje
  const anoInicial = trechos[0]?.ano

  for (const { ano, fracao } of trechos) {
    const ipca = (projecaoDoAno(focus.ipca, ano) ?? 0) / 100
    let fator: number
    if (titulo.indexador === 'prefixado') {
      fator = (1 + taxa) ** fracao
    } else if (titulo.indexador === 'ipca') {
      fator = ((1 + taxa) * (1 + ipca)) ** fracao
    } else {
      const selicFim = projecaoDoAno(focus.selic, ano) ?? selicInicioDoAno
      const inicio = ano === anoInicial ? selicHoje : selicInicioDoAno
      const selicMedia = (inicio + selicFim) / 2 / 100
      fator = (1 + selicMedia + taxa) ** fracao
      selicInicioDoAno = selicFim
    }
    const valorFinal = valor * fator
    const valorMedio = (valor + valorFinal) / 2
    const base = titulo.indexador === 'selic' ? Math.max(0, valorMedio - ISENCAO_CUSTODIA_SELIC) : valorMedio
    custodia += base * TAXA_CUSTODIA_AA * fracao
    valor = valorFinal
    deflator *= (1 + ipca) ** fracao
  }

  const bruto = valor
  const aliquota = aliquotaIr(dias)
  const ganhoTributavel = Math.max(0, bruto - aplicado - custodia)
  const ir = ganhoTributavel * (aliquota / 100)
  const liquido = bruto - custodia - ir
  const liquidoHoje = liquido / deflator
  const aoAno = (v: number) => ((v / aplicado) ** (1 / anos) - 1) * 100

  const r2 = (v: number) => Math.round(v * 100) / 100
  return {
    aplicado,
    dias,
    anos,
    bruto: r2(bruto),
    custodia: r2(custodia),
    aliquotaIr: aliquota,
    ir: r2(ir),
    liquido: r2(liquido),
    liquidoAoAno: r2(aoAno(liquido)),
    liquidoHoje: r2(liquidoHoje),
    ganhoRealAoAno: r2(aoAno(liquidoHoje)),
  }
}

/** Premissas do Focus presentes no snapshot, ou null se o job ainda não as trouxe. */
export function premissasDoSnapshot(s: SnapshotMercado): PremissasFocus | null {
  const f = s.focus
  if (!f?.data || !f.ipca || !f.selic || Object.keys(f.ipca).length === 0) return null
  return f
}

/** "R$ 5.000" → 5000. Aceita só dígitos (centavos não fazem diferença na simulação). */
export function lerValor(texto: string): number {
  const digitos = texto.replace(/\D/g, '').slice(0, 10)
  return digitos ? Number(digitos) : 0
}

/** 730 dias → "2 anos"; 480 dias → "1 ano e 4 meses" */
export function prazoPorExtenso(dias: number): string {
  const meses = Math.round(dias / 30.4375)
  const a = Math.floor(meses / 12)
  const m = meses % 12
  const partes: string[] = []
  if (a > 0) partes.push(`${a} ${a === 1 ? 'ano' : 'anos'}`)
  if (m > 0) partes.push(`${m} ${m === 1 ? 'mês' : 'meses'}`)
  return partes.join(' e ') || 'menos de 1 mês'
}
