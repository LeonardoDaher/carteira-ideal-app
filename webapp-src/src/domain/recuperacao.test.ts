import { describe, expect, it } from 'vitest'
import {
  LIMIAR_JUROS_CARO,
  MESES_MAXIMOS,
  RECUPERACAO_VAZIA,
  ehDividaCara,
  minimoNaoCobreJuros,
  ordemDeAtaque,
  primeiraVitoria,
  simularQuitacao,
  somaParcelasMinimas,
  validarRecuperacao,
  jurosAnualDeMensal,
  jurosMensalDeAnual,
} from './recuperacao'
import type { Divida, Recuperacao } from './recuperacao'
import {
  ORCAMENTO_VAZIO,
  PREFIXO_DIVIDA,
  alternarPagamento,
  custoMensalDeVida,
  faseRecuperacao,
  gerarCopia,
  itensDoMes,
  lerCopia,
  metaMiniReserva,
  modoRecuperacaoAtivo,
  planoDoMes,
  valorDoPlano,
  parceladasDesdeOPacto,
  resumoDoMes,
  sugestaoPilar2,
  tetoSugerido,
  validarOrcamento,
} from './orcamento'
import type { Conta, Orcamento } from './orcamento'

const divida = (p: Partial<Divida> & Pick<Divida, 'id'>): Divida => ({
  nome: p.id,
  tipo: 'outra',
  saldo: 1000,
  saldoInicial: p.saldo ?? 1000,
  jurosMensal: 0,
  parcelaMinima: 0,
  ...p,
})

const rec = (dividas: Divida[], p: Partial<Recuperacao> = {}): Recuperacao => ({ ...RECUPERACAO_VAZIA, dividas, ...p })

describe('classificação das dívidas', () => {
  it('tipos da opção [A] do Pilar 2 são caros mesmo com juros digitados baixos', () => {
    expect(ehDividaCara(divida({ id: 'a', tipo: 'cheque-especial', jurosMensal: 0 }))).toBe(true)
    expect(ehDividaCara(divida({ id: 'b', tipo: 'dolar' }))).toBe(true)
  })

  it(`qualquer dívida a partir de ${LIMIAR_JUROS_CARO}% ao mês é cara; financiamento barato não`, () => {
    expect(ehDividaCara(divida({ id: 'a', tipo: 'outra', jurosMensal: 3 }))).toBe(true)
    expect(ehDividaCara(divida({ id: 'b', tipo: 'outra', jurosMensal: 2.9 }))).toBe(false)
    expect(ehDividaCara(divida({ id: 'c', tipo: 'financiamento', jurosMensal: 1.5 }))).toBe(false)
  })

  it('dívida quitada não é cara', () => {
    expect(ehDividaCara(divida({ id: 'a', tipo: 'cartao-rotativo', saldo: 0 }))).toBe(false)
  })

  it('avisa quando a parcela mínima não cobre nem os juros do mês', () => {
    expect(minimoNaoCobreJuros(divida({ id: 'a', saldo: 2000, jurosMensal: 14, parcelaMinima: 280 }))).toBe(true)
    expect(minimoNaoCobreJuros(divida({ id: 'b', saldo: 2000, jurosMensal: 14, parcelaMinima: 300 }))).toBe(false)
    expect(minimoNaoCobreJuros(divida({ id: 'c', saldo: 2000, jurosMensal: 0, parcelaMinima: 0 }))).toBe(false)
  })

  it('soma das mínimas não passa do saldo de cada dívida e ignora as quitadas', () => {
    const lista = [
      divida({ id: 'a', saldo: 80, parcelaMinima: 100 }),
      divida({ id: 'b', saldo: 500, parcelaMinima: 50 }),
      divida({ id: 'c', saldo: 0, parcelaMinima: 70 }),
    ]
    expect(somaParcelasMinimas(lista)).toBe(130)
  })
})

describe('simulação do plano de quitação', () => {
  it('uma dívida: juros entram antes do pagamento, mês a mês', () => {
    // 1.000 + 10% = 1.100 − 600 = 500; 500 + 10% = 550 − 550 = 0
    const p = simularQuitacao([divida({ id: 'a', jurosMensal: 10 })], 600, 'avalanche')
    expect(p.status).toBe('ok')
    expect(p.meses).toBe(2)
    expect(p.jurosTotais).toBe(150)
    expect(p.totalPago).toBe(1150)
    expect(p.quitacoes).toEqual({ a: 2 })
    expect(p.primeiroMes).toEqual({ a: { minimo: 0, extra: 600 } })
  })

  const cara = divida({ id: 'cara', saldo: 1000, jurosMensal: 10, parcelaMinima: 100 })
  const pequena = divida({ id: 'pequena', saldo: 300, jurosMensal: 2, parcelaMinima: 50 })

  it('avalanche ataca os juros mais altos; bola de neve, o menor saldo', () => {
    expect(ordemDeAtaque([pequena, cara], 'avalanche').map((d) => d.id)).toEqual(['cara', 'pequena'])
    expect(ordemDeAtaque([cara, pequena], 'bola-de-neve').map((d) => d.id)).toEqual(['pequena', 'cara'])
  })

  it('paga a mínima de todas e manda o resto para a primeira da ordem', () => {
    // Mês 1: juros 100 e 6; mínimas 100 e 50; sobram 250 para a primeira da ordem
    expect(simularQuitacao([cara, pequena], 400, 'avalanche').primeiroMes).toEqual({
      cara: { minimo: 100, extra: 250 },
      pequena: { minimo: 50, extra: 0 },
    })
    expect(simularQuitacao([cara, pequena], 400, 'bola-de-neve').primeiroMes).toEqual({
      cara: { minimo: 100, extra: 0 },
      pequena: { minimo: 50, extra: 250 },
    })
  })

  it('avalanche paga menos juros; bola de neve dá a primeira vitória antes', () => {
    const av = simularQuitacao([cara, pequena], 400, 'avalanche')
    const bn = simularQuitacao([cara, pequena], 400, 'bola-de-neve')
    expect(av.jurosTotais).toBeLessThan(bn.jurosTotais)
    expect(primeiraVitoria(bn)).toEqual({ id: 'pequena', mes: 2 })
    expect(primeiraVitoria(av)!.mes).toBeGreaterThan(2)
  })

  it('quando uma dívida zera, a parcela dela reforça a seguinte', () => {
    const p = simularQuitacao([cara, pequena], 400, 'bola-de-neve')
    // Sem o reforço, só R$ 100 por mês na dívida de 10% levariam dezenas de meses
    expect(p.status).toBe('ok')
    expect(p.meses).toBeLessThan(6)
  })

  it('não termina quando os pagamentos não cobrem os juros', () => {
    const p = simularQuitacao([divida({ id: 'a', jurosMensal: 10, parcelaMinima: 50 })], 50, 'avalanche')
    expect(p.status).toBe('nao-termina')
    expect(p.meses).toBe(MESES_MAXIMOS)
    expect(primeiraVitoria(p)).toBeNull()
  })

  it('sem dívidas em aberto não há plano', () => {
    expect(simularQuitacao([divida({ id: 'a', saldo: 0 })], 500, 'avalanche').status).toBe('sem-dividas')
  })

  it('não altera as dívidas recebidas', () => {
    const lista = [divida({ id: 'a', jurosMensal: 10 })]
    simularQuitacao(lista, 600, 'avalanche')
    expect(lista[0].saldo).toBe(1000)
  })
})

describe('validação do bloco de dívidas', () => {
  const valido = rec([divida({ id: 'a', tipo: 'cheque-especial', jurosMensal: 8, parcelaMinima: 100 })], { pactoDesde: '2026-10' })

  it('aceita um bloco válido e descarta campos extras', () => {
    const comLixo = { ...valido, extra: 1, dividas: [{ ...valido.dividas[0], banco: 'x' }] }
    expect(validarRecuperacao(comLixo)).toEqual(valido)
  })

  it('recusa tipo desconhecido, juros acima de 100% e mês do pacto inválido', () => {
    expect(validarRecuperacao({ ...valido, dividas: [{ ...valido.dividas[0], tipo: 'agiota' }] })).toBeNull()
    expect(validarRecuperacao({ ...valido, dividas: [{ ...valido.dividas[0], jurosMensal: 150 }] })).toBeNull()
    expect(validarRecuperacao({ ...valido, pactoDesde: 'outubro' })).toBeNull()
    expect(validarRecuperacao({ ...valido, metodo: 'sorteio' })).toBeNull()
  })
})

// ---------------------------------------------------------------- dentro do orçamento

const aluguel: Conta = { id: 'aluguel', nome: 'Aluguel', valor: 1500, tipo: 'mensal' }
const cheque = divida({ id: 'cheque', nome: 'Cheque especial', tipo: 'cheque-especial', saldo: 2000, jurosMensal: 8, parcelaMinima: 200 })
const carro = divida({ id: 'carro', nome: 'Carro', tipo: 'financiamento', saldo: 20000, jurosMensal: 1.5, parcelaMinima: 700 })

const base = (p: Partial<Orcamento> = {}): Orcamento => ({
  ...ORCAMENTO_VAZIO,
  salario: 4000,
  contas: [aluguel],
  potes: { guardar: 200, crescer: 300, quitar: 400 },
  ...p,
})

describe('Modo Recuperação no orçamento', () => {
  it('liga com dívida cara ou por escolha, e fica desligado só com dívida barata', () => {
    expect(modoRecuperacaoAtivo(base())).toBe(false)
    expect(modoRecuperacaoAtivo(base({ recuperacao: rec([cheque]) }))).toBe(true)
    expect(modoRecuperacaoAtivo(base({ recuperacao: rec([carro]) }))).toBe(false)
    expect(modoRecuperacaoAtivo(base({ recuperacao: rec([], { ligadoManual: true }) }))).toBe(true)
    expect(modoRecuperacaoAtivo(base({ recuperacao: rec([{ ...cheque, saldo: 0 }]) }))).toBe(false)
  })

  it('o pote Quitar ocupa o lugar do Fazer Crescer; a mínima sai junto com as contas', () => {
    const o = base({ recuperacao: rec([cheque]) })
    const r = resumoDoMes(o, '2026-10')
    // Plano com R$ 600 (200 da mínima + 400 do pote Quitar)
    expect(r.recuperacao).toBe(true)
    expect(r.dividas).toBe(200)
    expect(r.comprometido).toBe(1700)
    expect(r.crescer).toBe(0)
    expect(r.quitar).toBe(400)
    // 4.000 − 1.700 − 200 (Guardar) − 400 (Quitar) = 1.700
    expect(r.gastar).toBe(1700)
    const item = itensDoMes(o, '2026-10').find((i) => i.origem === 'divida')!
    expect(item.conta.id).toBe(`${PREFIXO_DIVIDA}cheque`)
    expect(item.valorDoMes).toBe(600)
    expect(item.divida).toEqual({ minimo: 200, extra: 400 })
    expect(r.falta).toBe(2100)
  })

  it('no modo, o plano ataca só as dívidas caras; a barata segue com a parcela em dia', () => {
    const o = base({ recuperacao: rec([cheque, carro]) })
    expect(planoDoMes(o).ordem).toEqual(['cheque'])
    expect(valorDoPlano(o)).toBe(600)
    const itens = itensDoMes(o, '2026-10').filter((i) => i.origem === 'divida')
    expect(itens.map((i) => [i.conta.id, i.divida])).toEqual([
      [`${PREFIXO_DIVIDA}cheque`, { minimo: 200, extra: 400 }],
      [`${PREFIXO_DIVIDA}carro`, { minimo: 700, extra: 0 }],
    ])
    const r = resumoDoMes(o, '2026-10')
    expect(r.dividas).toBe(900)
    expect(r.quitar).toBe(400)
  })

  it('ligado à mão sem dívida cara, o plano abrange todas', () => {
    const o = base({ recuperacao: rec([carro], { ligadoManual: true }) })
    expect(planoDoMes(o).ordem).toEqual(['carro'])
    expect(valorDoPlano(o)).toBe(1100)
  })

  it('fora do modo, só dívida barata: paga a mínima e o Fazer Crescer continua', () => {
    const r = resumoDoMes(base({ recuperacao: rec([carro]) }), '2026-10')
    expect(r.recuperacao).toBe(false)
    expect(r.dividas).toBe(700)
    expect(r.quitar).toBe(0)
    expect(r.crescer).toBe(300)
  })

  it('pagamento de dívida ticado guarda o valor, mesmo que o plano mude depois', () => {
    const o = alternarPagamento(base({ recuperacao: rec([cheque]) }), '2026-10', `${PREFIXO_DIVIDA}cheque`, 600)
    const depois = { ...o, potes: { ...o.potes, quitar: 0 } }
    const item = itensDoMes(depois, '2026-10').find((i) => i.origem === 'divida')!
    expect(item.ticado).toBe(true)
    expect(item.valorDoMes).toBe(600)
    expect(resumoDoMes(depois, '2026-10').quitar).toBe(400)
  })

  it('custo de vida, teto do cartão e mini-reserva contam as parcelas mínimas', () => {
    const o = base({ recuperacao: rec([cheque]) })
    expect(custoMensalDeVida(o)).toBe(1700)
    // 4.000 − 1.700 − 200 − 400 (Quitar, no lugar do Crescer)
    expect(tetoSugerido(o)).toBe(1700)
    // metade de 1.700 = 850 → R$ 900
    expect(metaMiniReserva(o)).toBe(900)
    expect(metaMiniReserva(base({ contas: [] }))).toBe(500)
  })

  it('fase 1 até a mini-reserva, fase 2 depois dela', () => {
    expect(faseRecuperacao(base({ recuperacao: rec([cheque]), reserva: 300 }))).toBe('mini-reserva')
    expect(faseRecuperacao(base({ recuperacao: rec([cheque]), reserva: 900 }))).toBe('quitar')
  })

  it('conta as compras parceladas desde o mês do pacto', () => {
    const compras = [
      { id: '1', descricao: 'Antes', valor: 300, mes: '2026-09', parcelas: 3 },
      { id: '2', descricao: 'À vista', valor: 50, mes: '2026-10', parcelas: 1 },
      { id: '3', descricao: 'Depois', valor: 600, mes: '2026-11', parcelas: 2 },
    ]
    const o = base({ cartao: { teto: 0, compras }, recuperacao: rec([cheque], { pactoDesde: '2026-10' }) })
    expect(parceladasDesdeOPacto(o).map((c) => c.id)).toEqual(['3'])
    expect(parceladasDesdeOPacto(base({ cartao: { teto: 0, compras } }))).toEqual([])
  })

  it('sugestão para o Pilar 2 nas faixas da pergunta', () => {
    expect(sugestaoPilar2(base({ recuperacao: rec([cheque]) }))).toBe('a')
    expect(sugestaoPilar2(base({ recuperacao: rec([carro]) }))).toBe('b')
    expect(sugestaoPilar2(base({ contas: [{ ...aluguel, valor: 2500 }] }))).toBe('b')
    expect(sugestaoPilar2(base())).toBe('c')
    expect(sugestaoPilar2(base({ salario: 0 }))).toBeNull()
  })

  it('dívida em dólar, sozinha, não sugere [A] no Pilar 2 (D84); com juros altos, sim', () => {
    const dolar = divida({ id: 'usd', nome: 'Empréstimo em dólar', tipo: 'dolar', saldo: 10000, jurosMensal: 0.8, parcelaMinima: 400 })
    expect(ehDividaCara(dolar)).toBe(true) // o Modo Recuperação continua ligando por ela
    expect(sugestaoPilar2(base({ recuperacao: rec([dolar]) }))).toBe('b')
    expect(sugestaoPilar2(base({ recuperacao: rec([{ ...dolar, jurosMensal: 3.5 }]) }))).toBe('a')
    expect(sugestaoPilar2(base({ recuperacao: rec([dolar, cheque]) }))).toBe('a')
  })
})

describe('compatibilidade das cópias', () => {
  it('ida e volta preserva dívidas, pacto e pote Quitar', () => {
    const o = base({ recuperacao: rec([cheque, carro], { metodo: 'bola-de-neve', pactoDesde: '2026-10' }) })
    expect(lerCopia(gerarCopia(o, new Date('2026-10-05T12:00:00Z')))).toEqual(o)
  })

  it('dado das Etapas 1 e 2 volta idêntico, sem campos novos', () => {
    const antigo = { salario: 1, reserva: 0, potes: { guardar: 0, crescer: 0 }, contas: [], pagamentos: {}, cartao: { teto: 0, compras: [] } }
    const lido = validarOrcamento(antigo)!
    expect(lido).toEqual(antigo)
    expect('recuperacao' in lido).toBe(false)
    expect('quitar' in lido.potes).toBe(false)
  })

  it('recusa bloco de dívidas ou pote Quitar inválidos', () => {
    const antigo = { salario: 1, reserva: 0, potes: { guardar: 0, crescer: 0 }, contas: [], pagamentos: {} }
    expect(validarOrcamento({ ...antigo, recuperacao: { dividas: 'x' } })).toBeNull()
    expect(validarOrcamento({ ...antigo, potes: { guardar: 0, crescer: 0, quitar: -5 } })).toBeNull()
  })
})

describe('juros ao ano e ao mês (juros compostos)', () => {
  it('converte ao ano para ao mês, e não divide por 12', () => {
    expect(jurosMensalDeAnual(12)).toBe(0.9489)
    expect(jurosMensalDeAnual(0)).toBe(0)
    // ~42,58% ao ano é o limiar de dívida cara (3% ao mês)
    expect(jurosMensalDeAnual(42.58)).toBeCloseTo(3, 2)
  })

  it('o caminho inverso, para mostrar na tela', () => {
    expect(jurosAnualDeMensal(3)).toBe(42.58)
    expect(jurosAnualDeMensal(1)).toBe(12.68)
  })
})

