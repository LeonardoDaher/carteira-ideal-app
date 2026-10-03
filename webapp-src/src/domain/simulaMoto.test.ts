import { describe, expect, it } from 'vitest'
import { PRESET_TIPO_MOTO, aplicarTipoMoto, inputsMotoPadrao, simularComparativoMoto } from './simulaMoto'
import { inputsCarroPadrao, simularComparativoCarro, validarInputsCarro } from './simulaCarro'
import type { ChaveCarro } from './simulaCarro'

const TODAS: ChaveCarro[] = ['avista', 'financiamento', 'consorcio', 'semCarro']

describe('valores de partida da moto', () => {
  it('são de moto: bem, valor e tipo, e o carro continua com os seus', () => {
    const m = inputsMotoPadrao()
    expect(m.bem).toBe('moto')
    expect(m.valorCarro).toBe(20_000)
    expect(m.entrada).toBe(6_000)
    expect(m.deprecAno1Pct).toBe(PRESET_TIPO_MOTO.zeroKm.deprecAno1Pct)
    expect(inputsCarroPadrao().bem).toBe('carro')
    expect(inputsCarroPadrao().valorCarro).toBe(100_000)
  })
  it('moto deprecia menos que carro, mas tem seguro e juros maiores', () => {
    const m = inputsMotoPadrao()
    const c = inputsCarroPadrao()
    expect(m.deprecAno1Pct).toBeLessThan(c.deprecAno1Pct)
    expect(m.seguroPct).toBeGreaterThan(c.seguroPct)
    expect(m.jurosMensalPct).toBeGreaterThan(c.jurosMensalPct)
  })
  it('o tipo seminovo recarrega só depreciação e manutenção, sem mexer em valor nem entrada', () => {
    const i = inputsMotoPadrao({ valorCarro: 15_000, entrada: 4_000 })
    const s = aplicarTipoMoto(i, 'seminovo')
    expect(s.tipo).toBe('seminovo')
    expect(s.valorCarro).toBe(15_000)
    expect(s.entrada).toBe(4_000)
    expect(s.deprecAno1Pct).toBe(PRESET_TIPO_MOTO.seminovo.deprecAno1Pct)
    expect(s.manutencaoAA).toBe(PRESET_TIPO_MOTO.seminovo.manutencaoAA)
    expect(s.bem).toBe('moto')
  })
  it('um campo informado prevalece sobre o valor de partida e o bem continua sendo moto', () => {
    const m = inputsMotoPadrao({ valorCarro: 30_000, bem: 'carro' })
    expect(m.valorCarro).toBe(30_000)
    expect(m.bem).toBe('moto')
  })
})

describe('o motor do carro serve à moto sem perder as regras', () => {
  const cenarios: [string, Parameters<typeof simularComparativoMoto>[0]][] = [
    ['padrão', {}],
    ['seminovo', { tipo: 'seminovo', ...PRESET_TIPO_MOTO.seminovo }],
    ['com dinheiro para o à vista', { dinheiroDisponivel: 30_000 }],
    ['com deságio de revenda', { descontarCustosVenda: true, dinheiroDisponivel: 30_000 }],
    ['com lance', { lance: 3_000, mesContemplacao: 10 }],
    ['horizonte maior que o financiamento', { horizonteAnos: 6, prazoFinanciamentoMeses: 24 }],
  ]
  for (const [nome, parcial] of cenarios) {
    it(`a contabilidade fecha em ${nome}`, () => {
      const r = simularComparativoMoto(parcial)
      for (const c of r.rotas) expect(Math.abs(r.detalhe.contabilidade[c].diferenca), c).toBeLessThan(0.05)
      expect(new Set(r.rotas.map((c) => r.detalhe.contabilidade[c].totalColocado)).size).toBe(1)
    })
  }
  it('custo líquido = dinheiro colocado − patrimônio, e a ordem por custo é a inversa da ordem por patrimônio', () => {
    const r = simularComparativoMoto({ dinheiroDisponivel: 30_000 })
    for (const c of r.rotas) expect(r.cenarios[c].custoLiquido).toBeCloseTo(r.detalhe.contabilidade[c].totalColocado - r.cenarios[c].patrimonioFinal, 1)
    expect([...r.rotas].sort((a, b) => r.cenarios[a].custoLiquido - r.cenarios[b].custoLiquido)).toEqual(r.ranking)
  })
  it('sem dinheiro informado a rota à vista fica de fora e diz quanto falta; com dinheiro ela entra', () => {
    const sem = simularComparativoMoto({})
    expect(sem.rotas).not.toContain('avista')
    expect(sem.avista.falta).toBeGreaterThan(0)
    expect(sem.avista.necessario).toBeCloseTo(20_000 + 500, 2)
    const com = simularComparativoMoto({ dinheiroDisponivel: 30_000 })
    expect(com.rotas).toEqual(expect.arrayContaining(TODAS))
  })
  it('a moto perde valor e o ponto de virada separa os dois mundos', () => {
    const r = simularComparativoMoto({})
    expect(r.cenarios.financiamento.depreciacao).toBeGreaterThan(0)
    const virada = r.pontoDeVirada!.financiamento as number
    expect(virada).toBeGreaterThan(0)
    const abaixo = simularComparativoMoto({ mobilidadeMensal: virada - 50 })
    const acima = simularComparativoMoto({ mobilidadeMensal: virada + 50 })
    expect(abaixo.patrimonioSemCustosVenda.semCarro).toBeGreaterThan(abaixo.patrimonioSemCustosVenda.financiamento)
    expect(acima.patrimonioSemCustosVenda.financiamento).toBeGreaterThan(acima.patrimonioSemCustosVenda.semCarro)
  })
})

describe('vocabulário: moto fala de moto e carro continua falando de carro', () => {
  it('as mensagens de erro e o nome do vencedor usam o gênero certo', () => {
    expect(validarInputsCarro(inputsMotoPadrao({ valorCarro: 0 }))).toContain('Informe o valor da moto.')
    expect(validarInputsCarro(inputsCarroPadrao({ valorCarro: 0 }))).toContain('Informe o valor do carro.')
    expect(validarInputsCarro(inputsMotoPadrao({ entrada: 99_999 }))[0]).toMatch(/valor da moto/)
    expect(validarInputsCarro(inputsMotoPadrao({ mobilidadeMensal: -1 }))[0]).toBe('O gasto mensal sem moto não pode ser negativo.')
    expect(validarInputsCarro(inputsCarroPadrao({ mobilidadeMensal: -1 }))[0]).toBe('O gasto mensal sem carro não pode ser negativo.')
    expect(simularComparativoMoto({ mobilidadeMensal: 100 }).nomeVencedor).toBe('Sem moto')
    expect(simularComparativoCarro({ mobilidadeMensal: 200 }).nomeVencedor).toBe('Sem carro')
  })
  it('os avisos e a descrição do custo dizem moto', () => {
    const r = simularComparativoMoto({ horizonteAnos: 9, mesContemplacao: 12 })
    expect(r.avisos.join(' ')).toMatch(/a moto fica velha/)
    expect(r.avisos.join(' ')).not.toMatch(/carro/i)
    expect(r.cenarios.semCarro.custoDescricao).toMatch(/sem moto/)
    expect(r.cenarios.consorcio.custoDescricao).toMatch(/sem moto/)
    const c = simularComparativoCarro({ horizonteAnos: 9, mesContemplacao: 12 })
    expect(c.avisos.join(' ')).toMatch(/o carro fica velho/)
    expect(c.cenarios.semCarro.custoDescricao).toMatch(/sem carro/)
  })
})
