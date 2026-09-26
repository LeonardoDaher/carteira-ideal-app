import { describe, expect, it } from 'vitest'
import {
  ID_FATURA,
  ORCAMENTO_VAZIO,
  comprasDoMes,
  faturaDoMes,
  gastoNoCartao,
  parcelaNoMes,
  parcelasFuturas,
  semaforoDoCartao,
  tetoSugerido,
  aporteDoCofrinho,
  alternarPagamento,
  custoMensalDeVida,
  gerarCopia,
  guardadoNoCofrinho,
  itensDoMes,
  lerCopia,
  lerReais,
  mesPorExtenso,
  mesesAteVencimento,
  mesesDeReserva,
  resumoDoMes,
  somarMeses,
  sugestaoPilar1,
  validarOrcamento,
} from './orcamento'
import type { Compra, Conta, Orcamento } from './orcamento'

const aluguel: Conta = { id: 'aluguel', nome: 'Aluguel', valor: 1500, tipo: 'mensal' }
const luz: Conta = { id: 'luz', nome: 'Luz', valor: 200, tipo: 'mensal' }
const ipva: Conta = { id: 'ipva', nome: 'IPVA', valor: 1200, tipo: 'anual', mesVencimento: 1 }

const orc = (p: Partial<Orcamento> = {}): Orcamento => ({ ...ORCAMENTO_VAZIO, ...p })

describe('lerReais', () => {
  it.each([
    ['1.234,56', 1234.56],
    ['1234,5', 1234.5],
    ['R$ 800', 800],
    ['800.00', 800],
    ['3.500', 3500],
    ['10.000.000', 10_000_000],
    ['', 0],
    ['abc', 0],
    ['-50', 50],
  ])('"%s" → %s', (texto, esperado) => {
    expect(lerReais(texto)).toBe(esperado)
  })
})

describe('meses', () => {
  it('soma e subtrai meses atravessando o ano', () => {
    expect(somarMeses('2026-10', 3)).toBe('2027-01')
    expect(somarMeses('2027-01', -11)).toBe('2026-02')
    expect(somarMeses('2026-12', 0)).toBe('2026-12')
  })

  it('escreve o mês por extenso', () => {
    expect(mesPorExtenso('2026-10')).toBe('outubro de 2026')
  })

  it('conta os meses até o vencimento, com zero no próprio mês', () => {
    expect(mesesAteVencimento('2026-10', 1)).toBe(3)
    expect(mesesAteVencimento('2027-01', 1)).toBe(0)
    expect(mesesAteVencimento('2027-02', 1)).toBe(11)
  })
})

describe('cofrinho das contas anuais', () => {
  it('ciclo completo: guarda 1/12 por mês', () => {
    expect(aporteDoCofrinho(ipva, {}, '2026-02')).toBe(100)
  })

  it('quem começa tarde divide pelos meses que faltam, contando o mês do vencimento', () => {
    // Outubro, novembro, dezembro e janeiro: 4 meses para juntar R$ 1.200
    expect(aporteDoCofrinho(ipva, {}, '2026-10')).toBe(300)
  })

  it('considera o que já foi depositado no ciclo', () => {
    const pagamentos = { '2026-10': { ipva: 300 }, '2026-11': { ipva: 300 } }
    expect(guardadoNoCofrinho(ipva, pagamentos, '2026-12')).toBe(600)
    expect(aporteDoCofrinho(ipva, pagamentos, '2026-12')).toBe(300)
  })

  it('pulou um mês: o que faltou se espalha pelos meses restantes', () => {
    const pagamentos = { '2026-10': { ipva: 300 } }
    // Faltam R$ 900 para dezembro e janeiro
    expect(aporteDoCofrinho(ipva, pagamentos, '2026-12')).toBe(450)
  })

  it('no mês do vencimento, o aporte é o que falta para pagar', () => {
    const pagamentos = { '2026-10': { ipva: 300 }, '2026-11': { ipva: 300 }, '2026-12': { ipva: 300 } }
    expect(aporteDoCofrinho(ipva, pagamentos, '2027-01')).toBe(300)
  })

  it('depois do vencimento começa um ciclo novo, sem contar os depósitos antigos', () => {
    const pagamentos = { '2026-12': { ipva: 300 }, '2027-01': { ipva: 300 } }
    expect(guardadoNoCofrinho(ipva, pagamentos, '2027-02')).toBe(0)
    expect(aporteDoCofrinho(ipva, pagamentos, '2027-02')).toBe(100)
  })

  it('cofrinho cheio antes da hora não pede mais depósito', () => {
    expect(aporteDoCofrinho(ipva, { '2026-10': { ipva: 1200 } }, '2026-11')).toBe(0)
  })

  it('conta mensal não tem cofrinho', () => {
    expect(aporteDoCofrinho(aluguel, {}, '2026-10')).toBe(0)
  })
})

describe('o mês', () => {
  const base = orc({ salario: 4000, contas: [aluguel, luz, ipva], potes: { guardar: 500, crescer: 300 } })

  it('lista os itens do mês, marcando a conta anual que vence nele', () => {
    const itens = itensDoMes(base, '2027-01')
    expect(itens.map((i) => i.conta.id)).toEqual(['aluguel', 'luz', 'ipva'])
    expect(itens[2].venceNesteMes).toBe(true)
    expect(itensDoMes(base, '2026-10')[2].venceNesteMes).toBe(false)
  })

  it('resume o caminho do salário até o pote Gastar', () => {
    const r = resumoDoMes(base, '2026-10')
    expect(r.contasMensais).toBe(1700)
    expect(r.cofrinhos).toBe(300)
    expect(r.comprometido).toBe(2000)
    expect(r.sobra).toBe(2000)
    expect(r.gastar).toBe(1200)
    expect(r.situacao).toBe('folga')
    expect(r.falta).toBe(2000)
    expect(r.totalItens).toBe(3)
  })

  it('apertado: as contas cabem, os potes não', () => {
    const r = resumoDoMes({ ...base, salario: 2500 }, '2026-10')
    expect(r.sobra).toBe(500)
    expect(r.gastar).toBe(-300)
    expect(r.situacao).toBe('apertado')
  })

  it('negativo: as contas sozinhas passam do salário', () => {
    expect(resumoDoMes({ ...base, salario: 1800 }, '2026-10').situacao).toBe('negativo')
  })

  it('ticar guarda o valor do momento e atualiza pago e falta', () => {
    let o = alternarPagamento(base, '2026-10', 'aluguel', 1500)
    o = alternarPagamento(o, '2026-10', 'ipva', 300)
    const r = resumoDoMes(o, '2026-10')
    expect(r.pago).toBe(1800)
    expect(r.falta).toBe(200)
    expect(r.itensTicados).toBe(2)
  })

  it('item ticado mantém o valor mesmo se a conta mudar depois', () => {
    const o = alternarPagamento(base, '2026-10', 'luz', 200)
    const luzMaisCara = { ...o, contas: o.contas.map((c) => (c.id === 'luz' ? { ...c, valor: 260 } : c)) }
    expect(itensDoMes(luzMaisCara, '2026-10')[1].valorDoMes).toBe(200)
    expect(itensDoMes(luzMaisCara, '2026-11')[1].valorDoMes).toBe(260)
  })

  it('ticar de novo desmarca e não deixa mês vazio para trás', () => {
    const o = alternarPagamento(alternarPagamento(base, '2026-10', 'luz', 200), '2026-10', 'luz', 200)
    expect(o.pagamentos).toEqual({})
  })

  it('não altera o orçamento recebido', () => {
    alternarPagamento(base, '2026-10', 'luz', 200)
    expect(base.pagamentos).toEqual({})
  })

  it('o depósito ticado no cofrinho conta para o mês seguinte', () => {
    const o = alternarPagamento(base, '2026-10', 'ipva', 300)
    expect(itensDoMes(o, '2026-11')[2].valorDoMes).toBe(300)
    expect(itensDoMes(o, '2026-11')[2].guardadoAntes).toBe(300)
  })
})

describe('reserva', () => {
  it('custo de vida usa 1/12 das contas anuais', () => {
    expect(custoMensalDeVida(orc({ contas: [aluguel, luz, ipva] }))).toBe(1800)
  })

  it('meses de reserva e sugestão para o Pilar 1 nas mesmas faixas da pergunta', () => {
    const contas = [aluguel, luz, ipva] // R$ 1.800 por mês
    expect(mesesDeReserva(orc({ contas, reserva: 3600 }))).toBe(2)
    expect(sugestaoPilar1(orc({ contas, reserva: 3600 }))).toBe('a')
    expect(sugestaoPilar1(orc({ contas, reserva: 5400 }))).toBe('b')
    expect(sugestaoPilar1(orc({ contas, reserva: 21600 }))).toBe('b')
    expect(sugestaoPilar1(orc({ contas, reserva: 25000 }))).toBe('c')
  })

  it('sem contas não há régua', () => {
    expect(mesesDeReserva(orc({ reserva: 1000 }))).toBeNull()
    expect(sugestaoPilar1(orc())).toBeNull()
  })
})

describe('cópia de segurança', () => {
  const completo = orc({
    salario: 4000,
    reserva: 2000,
    contas: [aluguel, ipva],
    potes: { guardar: 200, crescer: 100 },
    pagamentos: { '2026-10': { aluguel: 1500 } },
  })

  it('ida e volta preserva tudo', () => {
    expect(lerCopia(gerarCopia(completo, new Date('2026-10-05T12:00:00Z')))).toEqual(completo)
  })

  it('recusa arquivo que não é cópia do Meu Mês', () => {
    expect(lerCopia('isto não é json')).toBeNull()
    expect(lerCopia(JSON.stringify({ formato: 'outro', orcamento: completo }))).toBeNull()
    expect(lerCopia(JSON.stringify({ versao: 2, screen: 'resultado' }))).toBeNull()
  })

  it('recusa cópia com campos inválidos', () => {
    const envelope = (o: unknown) => JSON.stringify({ formato: 'carteiraideal.meumes', orcamento: o })
    expect(lerCopia(envelope({ ...completo, salario: -1 }))).toBeNull()
    expect(lerCopia(envelope({ ...completo, contas: [{ ...ipva, mesVencimento: 13 }] }))).toBeNull()
    expect(lerCopia(envelope({ ...completo, contas: [{ ...aluguel, tipo: 'semanal' }] }))).toBeNull()
    expect(lerCopia(envelope({ ...completo, pagamentos: { '2026-13': {} } }))).toBeNull()
  })

  it('descarta campos extras', () => {
    const comLixo = { ...completo, contas: [{ ...aluguel, mesVencimento: 5, extra: true }], extra: 1 }
    expect(validarOrcamento(comLixo)?.contas[0]).toEqual(aluguel)
  })
})

describe('cartão de crédito', () => {
  const tenis: Compra = { id: 't', descricao: 'Tênis', valor: 300, mes: '2026-10', parcelas: 3 }
  const mercado: Compra = { id: 'm', descricao: 'Mercado', valor: 450, mes: '2026-10', parcelas: 1 }
  const geladeira: Compra = { id: 'g', descricao: 'Geladeira', valor: 1000, mes: '2026-10', parcelas: 3 }

  it('parcela cai do mês da compra em diante; a última fecha os centavos', () => {
    expect(parcelaNoMes(tenis, '2026-09')).toBe(0)
    expect(parcelaNoMes(tenis, '2026-10')).toBe(100)
    expect(parcelaNoMes(tenis, '2026-12')).toBe(100)
    expect(parcelaNoMes(tenis, '2027-01')).toBe(0)
    expect(parcelaNoMes(geladeira, '2026-10')).toBe(333.33)
    expect(parcelaNoMes(geladeira, '2026-12')).toBe(333.34)
  })

  it('à vista cai só no mês da compra', () => {
    expect(parcelaNoMes(mercado, '2026-10')).toBe(450)
    expect(parcelaNoMes(mercado, '2026-11')).toBe(0)
  })

  const comCartao = orc({
    salario: 4000,
    contas: [aluguel],
    cartao: { teto: 800, compras: [tenis, mercado] },
  })

  it('gasto do mês soma compras à vista e parcelas; a fatura é o gasto do mês anterior', () => {
    expect(gastoNoCartao(comCartao, '2026-10')).toBe(550)
    expect(gastoNoCartao(comCartao, '2026-11')).toBe(100)
    expect(faturaDoMes(comCartao, '2026-11')).toBe(550)
    expect(faturaDoMes(comCartao, '2026-10')).toBe(0)
  })

  it('a fatura aparece como conta ticável no mês seguinte e entra no comprometido', () => {
    expect(itensDoMes(comCartao, '2026-10').some((i) => i.origem === 'fatura')).toBe(false)
    const itens = itensDoMes(comCartao, '2026-11')
    const fatura = itens.find((i) => i.origem === 'fatura')!
    expect(fatura.conta.id).toBe(ID_FATURA)
    expect(fatura.valorDoMes).toBe(550)
    const r = resumoDoMes(comCartao, '2026-11')
    expect(r.contasMensais).toBe(1500)
    expect(r.fatura).toBe(550)
    expect(r.comprometido).toBe(2050)
    expect(r.gastar).toBe(1950)
  })

  it('fatura ticada mantém o valor mesmo com compra lançada depois', () => {
    let o = alternarPagamento(comCartao, '2026-11', ID_FATURA, 550)
    o = { ...o, cartao: { ...o.cartao, compras: [...o.cartao.compras, { id: 'x', descricao: 'Esquecida', valor: 50, mes: '2026-10', parcelas: 1 }] } }
    expect(resumoDoMes(o, '2026-11').fatura).toBe(550)
  })

  it('semáforo: verde até 70%, amarelo até 100%, vermelho acima', () => {
    expect(semaforoDoCartao(0, 0)).toBe('sem-teto')
    expect(semaforoDoCartao(560, 800)).toBe('verde')
    expect(semaforoDoCartao(561, 800)).toBe('amarelo')
    expect(semaforoDoCartao(800, 800)).toBe('amarelo')
    expect(semaforoDoCartao(801, 800)).toBe('vermelho')
  })

  it('lista as compras do mês com o número da parcela', () => {
    const nov = comprasDoMes(comCartao, '2026-11')
    expect(nov).toEqual([{ compra: tenis, parcela: 2, valor: 100 }])
  })

  it('mostra as parcelas já assumidas nos meses seguintes', () => {
    expect(parcelasFuturas(comCartao, '2026-10')).toEqual([
      { mes: '2026-11', valor: 100 },
      { mes: '2026-12', valor: 100 },
    ])
    expect(parcelasFuturas(comCartao, '2026-12')).toEqual([])
  })

  it('teto sugerido é o pote Gastar de um mês típico, arredondado para baixo', () => {
    // 4.000 − 1.500 − 1.200/12 − 500 − 300 = 1.600
    expect(tetoSugerido(orc({ salario: 4000, contas: [aluguel, ipva], potes: { guardar: 500, crescer: 300 } }))).toBe(1600)
    expect(tetoSugerido(orc({ salario: 4005, contas: [aluguel] }))).toBe(2500)
    expect(tetoSugerido(orc({ salario: 1000, contas: [aluguel] }))).toBeNull()
  })

  it('cópia sem cartão (Etapa 1) continua válida, com cartão vazio', () => {
    const antigo = { salario: 1, reserva: 0, potes: { guardar: 0, crescer: 0 }, contas: [], pagamentos: {} }
    expect(validarOrcamento(antigo)?.cartao).toEqual({ teto: 0, compras: [] })
  })

  it('cópia com compra inválida é recusada', () => {
    const base = { salario: 1, reserva: 0, potes: { guardar: 0, crescer: 0 }, contas: [], pagamentos: {} }
    expect(validarOrcamento({ ...base, cartao: { teto: 100, compras: [{ ...tenis, parcelas: 0 }] } })).toBeNull()
    expect(validarOrcamento({ ...base, cartao: { teto: 100, compras: [{ ...tenis, mes: 'outubro' }] } })).toBeNull()
    expect(validarOrcamento({ ...base, cartao: { teto: -1, compras: [] } })).toBeNull()
    expect(validarOrcamento({ ...base, cartao: { teto: 100, compras: [tenis] } })?.cartao.compras).toEqual([tenis])
  })
})
