import { describe, expect, it } from 'vitest'
import { lerCsv } from './csv'
import { MODELO_CSV, ativoDoTexto, importarMatriz, instituicaoDe } from './planilha'

describe('ativoDoTexto', () => {
  it.each([
    ['MXRF11 - MAXI RENDA FII', 'MXRF11'],
    ['bbse3', 'BBSE3'],
    ['PETR4F', 'PETR4'],
    ['Tesouro Selic 2029', 'TESOURO SELIC 2029'],
    ['CDB - BANCO ÁGIL', 'CDB - BANCO AGIL'],
    ['B3SA3 - B3 S.A. - BRASIL, BOLSA, BALCAO', 'B3SA3'], // dígito no meio do código
    ['A1MD34 - ADVANCED MICRO DEVICES', 'A1MD34'],
    ['B3SA3F', 'B3SA3'], // fracionário
  ])('%s -> %s', (a, b) => expect(ativoDoTexto(a)).toBe(b))
})

describe('perfil genérico (planilha própria / CSV)', () => {
  const r = importarMatriz(lerCsv(MODELO_CSV))
  it('lê o modelo inteiro sem erros', () => {
    expect(r.perfil).toBe('generico')
    expect(r.erros).toEqual([])
    expect(r.lancamentos).toHaveLength(5)
    expect(r.lancamentos.map((l) => l.tipo)).toEqual(['compra', 'compra', 'provento', 'venda', 'compra'])
  })
  it('lê preço e quantidade em formato brasileiro', () => {
    const t = r.lancamentos[4]
    expect(t.ativo).toBe('TESOURO SELIC 2029')
    expect(t.quantidade).toBeCloseTo(0.5, 8)
    expect(t.preco).toBeCloseTo(15200, 8)
    expect(t.valor).toBeCloseTo(7600, 8)
  })
  it('dividendo no modelo vira provento com valor = qtd × valor por cota', () => {
    const p = r.lancamentos[2]
    expect(p.subtipo).toBe('dividendo')
    expect(p.valor).toBeCloseTo(31 * 0.8, 8)
  })

  it('aceita C/V e sinônimos de cabeçalho', () => {
    const m = lerCsv('Dt;C/V;Papel;Qtd;PU\n01/02/2026;C;VALE3;10;60,5\n02/02/2026;V;VALE3;5;61')
    const x = importarMatriz(m)
    expect(x.erros).toEqual([])
    expect(x.lancamentos.map((l) => l.tipo)).toEqual(['compra', 'venda'])
  })

  it('completa o preço a partir do valor total', () => {
    const x = importarMatriz(lerCsv('Data;Tipo;Ativo;Quantidade;Valor\n01/02/2026;Compra;VALE3;10;605,00'))
    expect(x.lancamentos[0].preco).toBeCloseTo(60.5, 8)
  })

  it('reporta cada linha ruim com o número da linha e segue com as boas', () => {
    const x = importarMatriz(
      lerCsv(
        [
          'Data;Tipo;Ativo;Quantidade;Preço',
          '01/02/2026;Compra;VALE3;10;60,5', // linha 2: ok
          '99/02/2026;Compra;VALE3;10;60,5', // linha 3: data
          '03/02/2026;Trocar;VALE3;10;60,5', // linha 4: tipo
          '04/02/2026;Compra;;10;60,5', // linha 5: ativo
          '05/02/2026;Compra;VALE3;;', // linha 6: faltam números
          '', // linha 7: vazia, não conta
          '06/02/2026;Compra;VALE3;0;60,5', // linha 8: quantidade zero
        ].join('\n'),
      ),
    )
    expect(x.lancamentos).toHaveLength(1)
    expect(x.linhasLidas).toBe(6)
    expect(x.erros.map((e) => e.linha)).toEqual([3, 4, 5, 6, 8])
    expect(x.erros[1].motivo).toContain('Trocar')
  })

  it('acha o cabeçalho depois de linhas de título', () => {
    const m = lerCsv('Minha carteira;;;\nexportado hoje;;;\n;;;\nData;Tipo;Ativo;Quantidade;Preço\n01/02/2026;Compra;VALE3;10;60,5')
    const x = importarMatriz(m)
    expect(x.lancamentos).toHaveLength(1)
    expect(x.erros).toEqual([])
  })

  it('sem colunas mínimas: erro geral claro, nada importado', () => {
    const x = importarMatriz(lerCsv('Nome;Idade\nAna;30'))
    expect(x.perfil).toBeNull()
    expect(x.lancamentos).toEqual([])
    expect(x.erroGeral).toContain('colunas mínimas')
  })

  it('proventos aceitam só o valor, e quantidade negativa vira positiva', () => {
    const x = importarMatriz(lerCsv('Data;Tipo;Ativo;Quantidade;Preço;Valor\n10/02/2026;JCP;BBSE3;;;13,18\n11/02/2026;Compra;VALE3;-10;60;'))
    expect(x.lancamentos[0]).toMatchObject({ tipo: 'provento', subtipo: 'jcp', valor: 13.18 })
    expect(x.lancamentos[1].quantidade).toBe(10)
  })
})

describe('perfil B3 Movimentação', () => {
  const cab = ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação']
  it('compra, venda, proventos, desdobramento; ignora transferência de custódia e avisa', () => {
    const x = importarMatriz([
      cab,
      ['Credito', '05/03/2026', 'Transferência - Liquidação', 'MXRF11 - MAXI RENDA FII', 'XP', 100, 10.05, 1005],
      ['Debito', '15/05/2026', 'Transferência - Liquidação', 'MXRF11 - MAXI RENDA FII', 'XP', 20, 10.4, 208],
      ['Credito', '10/04/2026', 'Rendimento', 'MXRF11 - MAXI RENDA FII', 'XP', 100, 0.1, 10],
      ['Credito', '20/04/2026', 'Juros Sobre Capital Próprio', 'BBSE3 - BB SEGURIDADE', 'XP', 31, 0.4, 12.4],
      ['Credito', '01/07/2026', 'Desdobramento', 'BBSE3 - BB SEGURIDADE', 'XP', 31, '-', '-'],
      ['Credito', '02/06/2026', 'Transferência', 'PETR4 - PETROBRAS', 'XP', 10, '-', '-'],
      ['Credito', '03/06/2026', 'Empréstimo', 'PETR4 - PETROBRAS', 'XP', 10, '-', '-'],
    ])
    expect(x.perfil).toBe('b3-movimentacao')
    expect(x.erros).toEqual([])
    expect(x.lancamentos.map((l) => `${l.tipo}:${l.ativo}`)).toEqual([
      'compra:MXRF11', 'venda:MXRF11', 'provento:MXRF11', 'provento:BBSE3', 'ajusteQuantidade:BBSE3',
    ])
    expect(x.lancamentos[2].subtipo).toBe('rendimento')
    expect(x.lancamentos[3].subtipo).toBe('jcp')
    expect(x.lancamentos.every((l) => l.origem === 'b3-movimentacao')).toBe(true)
    expect(x.avisos.some((a) => a.includes('liquidação'))).toBe(true)
    expect(x.avisos.some((a) => a.includes('"Transferência"'))).toBe(true)
    expect(x.avisos.some((a) => a.includes('"Empréstimo"'))).toBe(true)
  })
  it('Entrada/Saída em branco numa liquidação vira erro, não palpite', () => {
    const x = importarMatriz([cab, ['', '05/03/2026', 'Transferência - Liquidação', 'MXRF11', 'XP', 1, 10, 10]])
    expect(x.lancamentos).toEqual([])
    expect(x.erros[0].motivo).toContain('compra ou venda')
  })
})

describe('perfil B3 Negociação', () => {
  it('lê compra e venda, junta fracionário ao lote padrão e ignora opções', () => {
    const x = importarMatriz([
      ['Extrato de Negociação'],
      [],
      ['Data do Negócio', 'Tipo de Movimentação', 'Mercado', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor'],
      ['05/03/2026', 'Compra', 'Mercado Fracionário', 'XP', 'PETR4F', 3, 38.1, 114.3],
      ['05/03/2026', 'Venda', 'Mercado à Vista', 'XP', 'PETR4', 1, 39, 39],
      ['06/03/2026', 'Compra', 'Opções', 'XP', 'PETRC300', 1, 1.2, 120],
    ])
    expect(x.perfil).toBe('b3-negociacao')
    expect(x.lancamentos.map((l) => `${l.tipo}:${l.ativo}`)).toEqual(['compra:PETR4', 'venda:PETR4'])
    expect(x.avisos.some((a) => a.includes('Opções'))).toBe(true)
    expect(x.avisos.some((a) => a.includes('liquidação'))).toBe(false)
  })

  it('contrato futuro tem formato de ticker (WINM26) e NÃO pode virar ação: a coluna Mercado decide', () => {
    const x = importarMatriz([
      ['Data do Negócio', 'Tipo de Movimentação', 'Mercado', 'Prazo/Vencimento', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço', 'Valor'],
      ['05/03/2026', 'Compra', 'Futuro', '17/06/2026', 'XP', 'WINM26', 1, 130000, 130000],
      ['05/03/2026', 'Venda', 'Futuro', '17/06/2026', 'XP', 'WINM26', 1, 130100, 130100],
      ['05/03/2026', 'Venda', 'Opção de Venda sobre Ações', '21/08/2026', 'XP', 'PETRS300', 100, 0.5, 50],
      ['05/03/2026', 'Compra', 'Mercado à Vista', '-', 'XP', 'VALE3', 10, 60, 600],
    ])
    expect(x.lancamentos.map((l) => l.ativo)).toEqual(['VALE3'])
    expect(x.avisos.some((a) => a.includes('2 linha(s)') && a.includes('Futuro'))).toBe(true)
    expect(x.avisos.some((a) => a.includes('1 linha(s)') && a.includes('Opção de Venda'))).toBe(true)
  })

  it('sem a coluna Mercado, cai para o formato do código (arquivo próprio)', () => {
    const x = importarMatriz([
      ['Data do Negócio', 'Tipo de Movimentação', 'Código de Negociação', 'Quantidade', 'Preço'],
      ['05/03/2026', 'Compra', 'VALE3', 10, 60],
      ['05/03/2026', 'Compra', 'PETRS300', 100, 0.5],
    ])
    expect(x.lancamentos.map((l) => l.ativo)).toEqual(['VALE3'])
  })
})

describe('perfil B3 Proventos Recebidos', () => {
  const cab = ['Produto', 'Pagamento', 'Tipo de Evento', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor líquido']
  const x = importarMatriz([
    cab,
    ['MXRF11 - MAXI RENDA FII', '25/09/2026', 'Rendimento', 'CORRETORA X', '250', 0.1, 25],
    ['BBAS3 - BANCO DO BRASIL', '19/09/2026', 'Juros Sobre Capital Próprio', 'CORRETORA X', '1.600', 0.04, 45.55], // milhar em texto
    ['BBSE3 - BB SEGURIDADE', '15/09/2026', 'Dividendo', 'CORRETORA X', '200', 1.98, 396.65],
    ['XPTO11 - FUNDO QUALQUER', '10/09/2026', 'Amortização', 'CORRETORA X', '10', 5, 50],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', 'Total', ''],
    ['', '', '', '', '', '', 517.2],
  ])
  it('lê os proventos como a B3 os conta (dividendo, JCP, rendimento e amortização), com a data de pagamento e o valor líquido', () => {
    expect(x.perfil).toBe('b3-proventos-recebidos')
    expect(x.erros).toEqual([])
    expect(x.lancamentos.map((l) => `${l.data}:${l.ativo}:${l.subtipo}:${l.valor}`)).toEqual([
      '2026-09-25:MXRF11:rendimento:25',
      '2026-09-19:BBAS3:jcp:45.55',
      '2026-09-15:BBSE3:dividendo:396.65',
      '2026-09-10:XPTO11:amortizacao:50',
    ])
    expect(x.lancamentos.every((l) => l.origem === 'b3-proventos')).toBe(true)
  })
  it('quantidade "1.600" em texto é 1600 (o valor pago confirma), não 1,6', () => {
    expect(x.lancamentos[1].quantidade).toBe(1600)
  })
  it('linhas de Total e em branco não geram erro nem lançamento', () => {
    expect(x.erros).toEqual([])
    expect(x.lancamentos).toHaveLength(4)
  })
  it('um evento que não é provento (ex.: bonificação em ações) continua ignorado com aviso', () => {
    const y = importarMatriz([cab, ['XPTO11 - FUNDO QUALQUER', '10/09/2026', 'Bonificação em Ativos', 'CORRETORA X', '10', 5, 50]])
    expect(y.lancamentos).toEqual([])
    expect(y.avisos.some((a) => a.includes('Bonificação'))).toBe(true)
  })
})

describe('perfil B3 Proventos a Receber / Eventos', () => {
  const x = importarMatriz([
    ['Produto', 'Tipo', 'Tipo de Evento', 'Previsão de pagamento', 'Instituição', 'Conta', 'Quantidade', 'Preço unitário', 'Valor líquido'],
    ['BBDC3 - BANCO BRADESCO', 'ON', 'JUROS SOBRE CAPITAL PRÓPRIO', '01/10/2026', 'CORRETORA X', '123', '200', 0.02, 2.84],
    ['BOAC34 - BANK OF AMERICA', 'BDR', 'DIVIDENDO', '01/10/2026', 'CORRETORA X', '123', '15', 0.28, 4.23],
  ])
  it('são previsões: não viram lançamento, saem como eventos futuros', () => {
    expect(x.perfil).toBe('b3-proventos-a-receber')
    expect(x.lancamentos).toEqual([])
    expect(x.eventosFuturos).toEqual([
      { ativo: 'BBDC3', tipoEvento: 'jcp', previsao: '2026-10-01', quantidade: 200, precoUnitario: 0.02, valorLiquido: 2.84, instituicao: 'CORRETORA X' },
      { ativo: 'BOAC34', tipoEvento: 'dividendo', previsao: '2026-10-01', quantidade: 15, precoUnitario: 0.28, valorLiquido: 4.23, instituicao: 'CORRETORA X' },
    ])
    expect(x.avisos.some((a) => a.includes('previsões'))).toBe(true)
  })
})

describe('perfil B3 Calendário de proventos', () => {
  it('é do mercado, não do investidor: reconhecido, nada importado, explica por quê', () => {
    const x = importarMatriz([
      ['Data Referência', 'Produto', 'Tipo', 'Tipo de Evento', 'Data COM', 'Data de Pagamento', 'Preço Unitário Bruto', 'Preço Fechamento', 'DY', 'Minha Carteira', 'Url Fato Relevante'],
      ['30/09/2026', 'BAOA39 - ISHARES CORE 80/20', 'BDR', 'DIVIDENDO', '01/10/2026', '14/10/2026', '0,163547', '83,94', '0,19', 'Nao', 'https://x'],
    ])
    expect(x.perfil).toBe('b3-calendario')
    expect(x.lancamentos).toEqual([])
    expect(x.erros).toEqual([])
    expect(x.avisos[0]).toContain('calendário de proventos do mercado')
  })
})

describe('perfil B3 Posição (uma aba por categoria)', () => {
  it('lê a foto; só o Tesouro traz o valor aplicado', () => {
    const acoes = importarMatriz(
      [
        ['Produto', 'Instituição', 'Conta', 'Código de Negociação', 'Tipo', 'Quantidade', 'Preço de Fechamento', 'Valor Atualizado'],
        ['BBAS3 - BCO BRASIL S.A.', 'CORRETORA X', '1', 'BBAS3', 'ON', 1500, 23.07, 34605],
        ['VALE3 - VALE S.A.', 'CORRETORA X', '1', 'VALE3', 'ON', 0, 60, 0], // zerada: ignorada
      ],
      'Acoes',
    )
    expect(acoes.perfil).toBe('b3-posicao')
    expect(acoes.lancamentos).toEqual([])
    expect(acoes.posicao).toEqual([
      { ativo: 'BBAS3', categoria: 'acoes', quantidade: 1500, precoFechamento: 23.07, valorAtualizado: 34605, valorAplicado: null, instituicao: 'CORRETORA X', vencimento: undefined, indexador: undefined },
    ])
    const tesouro = importarMatriz(
      [
        ['Produto', 'Instituição', 'Indexador', 'Vencimento', 'Quantidade', 'Valor Aplicado', 'Valor Atualizado'],
        ['Tesouro IPCA+ 2029', 'CORRETORA X', 'IPCA', '15/05/2029', 1.67, 5000, 5800],
      ],
      'Tesouro Direto',
    )
    expect(tesouro.posicao![0]).toMatchObject({ ativo: 'TESOURO IPCA+ 2029', categoria: 'tesouro', quantidade: 1.67, valorAplicado: 5000, valorAtualizado: 5800, vencimento: '2029-05-15', indexador: 'IPCA' })
  })
  it('avisa que a posição não tem data de compra nem preço médio', () => {
    const r = importarMatriz([['Produto', 'Quantidade', 'Valor Atualizado'], ['BBAS3 - X', 1, 10]], 'BDR')
    expect(r.avisos[0]).toContain('preço médio')
  })
})

describe('instituicaoDe', () => {
  it('a mesma corretora com e sem ponto final vira uma só (a B3 mistura as duas grafias)', () => {
    expect(instituicaoDe('XP INVESTIMENTOS CCTVM S/A')).toBe('XP INVESTIMENTOS CCTVM S/A')
    expect(instituicaoDe('XP INVESTIMENTOS CCTVM S/A.')).toBe('XP INVESTIMENTOS CCTVM S/A')
    expect(instituicaoDe('  xp investimentos cctvm s/a. ')).toBe('XP INVESTIMENTOS CCTVM S/A')
    expect(instituicaoDe('')).toBeUndefined()
    expect(instituicaoDe(null)).toBeUndefined()
  })
  it('o mesmo negócio com as duas grafias gera lançamentos com a mesma chave', () => {
    const linha = (inst: string) => ['Data do Negócio', 'Tipo de Movimentação', 'Mercado', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço']
      .map((_, i) => ['05/03/2026', 'Compra', 'Mercado à Vista', inst, 'VALE3', 10, 60][i])
    const cab = ['Data do Negócio', 'Tipo de Movimentação', 'Mercado', 'Instituição', 'Código de Negociação', 'Quantidade', 'Preço']
    const a = importarMatriz([cab, linha('XP INVESTIMENTOS CCTVM S/A')]).lancamentos[0]
    const b = importarMatriz([cab, linha('XP INVESTIMENTOS CCTVM S/A.')]).lancamentos[0]
    expect(a.instituicao).toBe(b.instituicao)
  })
})

describe('Movimentação com produto de código com dígito no meio', () => {
  it('B3SA3 vira o ticker, e não o nome inteiro do produto', () => {
    const x = importarMatriz([
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '02/09/2026', 'Transferência - Liquidação', 'B3SA3 - B3 S.A. - BRASIL, BOLSA, BALCAO', 'XP', 100, 12.5, 1250],
      ['Credito', '10/09/2026', 'Rendimento', 'A1MD34 - ADVANCED MICRO DEVICES', 'XP', 10, 0.2, 2],
    ])
    expect(x.lancamentos.map((l) => l.ativo)).toEqual(['B3SA3', 'A1MD34'])
  })
})

describe('os tipos de provento que a B3 conta: amortização, reembolso e juros', () => {
  const mov = (tipo: string) =>
    importarMatriz([
      ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
      ['Credito', '10/09/2026', tipo, 'XPTO11 - FUNDO QUALQUER', 'CORRETORA X', 10, 5, 50],
    ])
  it.each([
    ['Amortização', 'amortizacao'],
    ['Reembolso', 'reembolso'],
    ['Juros', 'juros'],
    ['Rendimento', 'rendimento'],
    ['Dividendo', 'dividendo'],
    ['Juros Sobre Capital Próprio', 'jcp'],
  ])('Movimentação "%s" vira provento do tipo %s', (tipo, subtipo) => {
    const x = mov(tipo)
    expect(x.lancamentos).toHaveLength(1)
    expect(x.lancamentos[0]).toMatchObject({ tipo: 'provento', subtipo, valor: 50 })
  })
  it('"Juros Sobre Capital Próprio" continua sendo JCP (não vira "juros")', () => {
    expect(mov('Juros Sobre Capital Próprio').lancamentos[0].subtipo).toBe('jcp')
  })
  it('o que não é provento segue ignorado: cessão de direitos, direito de subscrição, atualização', () => {
    for (const t of ['Cessão de Direitos', 'Direito de Subscrição', 'Atualização']) expect(mov(t).lancamentos).toEqual([])
  })
})

describe('Movimentação com proventos repetidos em par (transferência de custódia)', () => {
  const cab = ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação']
  const linha = (data: string, ativo: string, valor: number, es = 'Credito', inst = 'CORRETORA X') => [es, data, 'Rendimento', `${ativo} - FUNDO`, inst, 100, valor / 100, valor]

  it('o par (crédito e débito, de corretoras diferentes) é descartado, com aviso; o pagamento verdadeiro fica', () => {
    const x = importarMatriz([cab, linha('04/08/2026', 'HGLG11', 16.38), linha('04/08/2026', 'HGLG11', 16.38, 'Debito', 'OUTRA CORRETORA'), linha('14/08/2026', 'HGLG11', 16.38)])
    expect(x.lancamentos.map((l) => l.data)).toEqual(['2026-08-14'])
    expect(x.avisos.some((a) => a.includes('2 provento(s) repetidos em par'))).toBe(true)
  })
  it('sem pares, nada é descartado e não há aviso sobre isso', () => {
    const x = importarMatriz([cab, linha('04/08/2026', 'HGLG11', 16.38), linha('14/08/2026', 'MXRF11', 25)])
    expect(x.lancamentos).toHaveLength(2)
    expect(x.avisos.some((a) => a.includes('repetidos em par'))).toBe(false)
  })
  it('compras e vendas na Movimentação nunca entram nessa regra', () => {
    const compra = ['Credito', '04/08/2026', 'Transferência - Liquidação', 'VALE3 - VALE', 'CORRETORA X', 10, 5, 50]
    expect(importarMatriz([cab, compra, compra]).lancamentos).toHaveLength(2)
  })
})
