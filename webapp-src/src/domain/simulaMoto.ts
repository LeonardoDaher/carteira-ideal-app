// Comparativo de MOTO (D48): comprar à vista, financiar, consórcio ou ficar sem moto.
//
// Não há motor novo. A moto REAPROVEITA o motor do carro (`simulaCarro.ts`): é o mesmo bem que perde valor, com a mesma regra do mesmo
// dinheiro, a mesma contabilidade que fecha, as mesmas quatro rotas e as duas leituras lado a lado (custo e patrimônio). O que muda são
// os VALORES DE PARTIDA (moto custa menos, deprecia menos, paga seguro proporcionalmente mais caro e tem juros maiores) e o vocabulário
// das mensagens, que o motor escolhe pelo campo `bem`.
//
// Escopo da primeira versão: moto de USO PESSOAL. A moto de TRABALHO (que gera renda: entrega, mototáxi) NÃO está modelada: a renda
// que o bem produz mudaria a pergunta ("quanto o bem se paga?"), e o motor não tem esse fluxo. Fica como caso à parte (docs/06).
//
// Todo valor de partida abaixo é NOSSO e editável na tela: estimativas de ordem de grandeza, a conferir com a tabela FIPE de motos, a
// cotação de seguro e o IPVA do estado antes de divulgar. Nenhum vem de fonte oficial; a única série oficial já identificada (SGS 25471,
// juros médios de aquisição de veículos, PF) não separa moto.

import { inputsCarroPadrao, simularComparativoCarro } from './simulaCarro'
import type { InputsCarro, ResultadoCarro, TipoCarro } from './simulaCarro'

export { inputsCarroDoSnapshot as inputsMotoDoSnapshot } from './simulaCarro'

/** Depreciação e manutenção por tipo. Moto de baixa cilindrada retém mais valor que carro, mas gasta mais em manutenção (corrente, pneus, óleo). */
export const PRESET_TIPO_MOTO: Record<TipoCarro, Pick<InputsCarro, 'deprecAno1Pct' | 'deprecDemaisPct' | 'manutencaoAA' | 'envelhecimentoManutencaoAA'>> = {
  zeroKm: { deprecAno1Pct: 10, deprecDemaisPct: 7, manutencaoAA: 3, envelhecimentoManutencaoAA: 8 },
  seminovo: { deprecAno1Pct: 7, deprecDemaisPct: 5, manutencaoAA: 4, envelhecimentoManutencaoAA: 6 },
}

/** Valores de partida que não dependem do tipo. Valor de uma moto de baixa cilindrada; seguro maior por causa do risco de roubo. */
const BASE_MOTO: Partial<InputsCarro> = {
  bem: 'moto',
  valorCarro: 20_000,
  entrada: 6_000,
  ipvaPct: 2,
  seguroPct: 6,
  usoMensal: 250,
  emplacamentoPct: 2.5,
  jurosMensalPct: 2.2,
  prazoFinanciamentoMeses: 36,
  iofPct: 3,
  gravame: 400,
  taxaAdmTotalPct: 15,
  fundoReservaPct: 2,
  prazoConsorcioMeses: 60,
  mesContemplacao: 12,
  mobilidadeMensal: 600,
}

/** Entradas padrão da moto: o motor do carro com os valores de partida da moto. Qualquer campo de `parcial` prevalece. */
export function inputsMotoPadrao(parcial: Partial<InputsCarro> = {}): InputsCarro {
  const tipo = parcial.tipo ?? 'zeroKm'
  return inputsCarroPadrao({ ...BASE_MOTO, ...PRESET_TIPO_MOTO[tipo], tipo, ...parcial, bem: 'moto' })
}

/** Troca 0 km por seminovo (ou o contrário) e recarrega só os valores de partida que dependem do tipo. */
export function aplicarTipoMoto(i: InputsCarro, tipo: TipoCarro): InputsCarro {
  return { ...i, tipo, ...PRESET_TIPO_MOTO[tipo] }
}

/** Função pública: como `simularComparativoCarro`, mas completando o que faltar com os valores de partida da moto. */
export function simularComparativoMoto(entrada: Partial<InputsCarro>): ResultadoCarro {
  return simularComparativoCarro(inputsMotoPadrao(entrada))
}
