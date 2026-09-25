// Testes do script mensal (node --test). Os CSVs abaixo imitam o formato do Portal de
// Dados Abertos da CVM: ";" como separador, cabeçalho na primeira linha, reapresentações
// com número de versão e nomes de coluna do padrão da Resolução CVM 175.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acharColuna,
  competenciaDe,
  divisorEscalaDy,
  escolherRendimento,
  lerCsv,
  mesesIdenticos,
  lerNumero,
  montarRendimentos,
  montarTodosOsFundos,
  prefixoTickerDoIsin,
  rendimentoPlausivel,
  subtrairMeses,
  avaliarConfianca,
  formatarSnapshot,
  setorDoFundo,
  volumeMedioDiario,
} from './atualizar-rendimentos-fii.mjs'

const GERAL = `CNPJ_Fundo_Classe;Data_Referencia;Versao;Nome_Fundo_Classe;Codigo_ISIN
11.111.111/0001-11;2026-07-31;1;"FUNDO AAAA ; LOGISTICA FII";BRAAAACTF001
22.222.222/0001-22;2026-07-31;1;FUNDO BBBB PAPEL FII;BRBBBBCTF005
`

// DY em fração (0,0085 = 0,85% ao mês), com uma reapresentação (versão 2) em jul/2026
const COMPLEMENTO = `CNPJ_Fundo_Classe;Data_Referencia;Versao;Valor_Patrimonial_Cotas;Percentual_Dividend_Yield_Mes
11.111.111/0001-11;2026-05-31;1;100,00;0,0080
11.111.111/0001-11;2026-06-30;1;100,00;0,0082
11.111.111/0001-11;2026-07-31;1;100,00;0,0999
11.111.111/0001-11;2026-07-31;2;100,00;0,0085
22.222.222/0001-22;2026-06-30;1;9,50;0,0105
22.222.222/0001-22;2026-07-31;1;9,50;0,0110
`

describe('lerCsv', () => {
  it('respeita aspas com ";" dentro do campo', () => {
    const linhas = lerCsv(GERAL)
    assert.equal(linhas.length, 2)
    assert.equal(linhas[0].Nome_Fundo_Classe, 'FUNDO AAAA ; LOGISTICA FII')
    assert.equal(linhas[1].Codigo_ISIN, 'BRBBBBCTF005')
  })

  it('aceita quebra de linha do Windows e arquivo sem quebra no final', () => {
    const linhas = lerCsv('A;B\r\n1;2\r\n3;4')
    assert.deepEqual(linhas, [
      { A: '1', B: '2' },
      { A: '3', B: '4' },
    ])
  })
})

describe('auxiliares', () => {
  it('lê números com vírgula ou ponto decimal', () => {
    assert.equal(lerNumero('0,0085'), 0.0085)
    assert.equal(lerNumero('1.234,56'), 1234.56)
    assert.equal(lerNumero('0.0085'), 0.0085)
    assert.equal(lerNumero(''), null)
  })

  it('extrai o prefixo do ticker do ISIN da cota', () => {
    assert.equal(prefixoTickerDoIsin('BRHGLGCTF004'), 'HGLG')
    assert.equal(prefixoTickerDoIsin('BRPETRACNPR6'), null) // ação, não FII
  })

  it('normaliza a data de referência para AAAA-MM', () => {
    assert.equal(competenciaDe('2026-07-31'), '2026-07')
    assert.equal(competenciaDe('31/07/2026'), '2026-07')
  })

  it('detecta se o DY veio em fração ou em %', () => {
    assert.equal(divisorEscalaDy([0.008, 0.0085, 0.011]), 1)
    assert.equal(divisorEscalaDy([0.8, 0.85, 1.1]), 100)
  })

  it('falha com mensagem clara quando a CVM renomeia uma coluna', () => {
    assert.throws(() => acharColuna(['CNPJ', 'Outra'], [/dividend_yield/i], { descricao: 'dividend yield do mês' }), /dividend yield do mês/)
  })

  it('rejeita rendimento implausível diante da cotação', () => {
    assert.equal(rendimentoPlausivel(0.1, 9.02), true) // 1,1% ao mês
    assert.equal(rendimentoPlausivel(10, 9.02), false) // escala trocada
    assert.equal(rendimentoPlausivel(0.001, 9.02), false)
  })
})

describe('montarRendimentos', () => {
  const geral = lerCsv(GERAL)
  const complemento = lerCsv(COMPLEMENTO)

  it('acha o fundo pelo ISIN, usa a versão mais recente e ordena do mês mais novo para o mais antigo', () => {
    const [a] = montarRendimentos(complemento, geral, [{ ticker: 'AAAA11' }])
    assert.equal(a.erro, undefined)
    assert.equal(a.nome, 'FUNDO AAAA ; LOGISTICA FII')
    assert.deepEqual(a.rendimentos, [
      { competencia: '2026-07', valorPorCota: 0.85 }, // versão 2 (0,0085 × 100), não a 1
      { competencia: '2026-06', valorPorCota: 0.82 },
      { competencia: '2026-05', valorPorCota: 0.8 },
    ])
  })

  it('dá o mesmo resultado quando o DY vem em %', () => {
    const emPct = lerCsv(COMPLEMENTO.replace(/;0,0(\d)(\d{2})\n/g, (_, a, b) => `;${a},${b}\n`))
    const [b] = montarRendimentos(emPct, geral, [{ ticker: 'BBBB11' }])
    assert.equal(b.rendimentos[0].valorPorCota, 0.1045) // 1,10% × 9,50
  })

  it('usa o CNPJ da configuração quando informado', () => {
    const [b] = montarRendimentos(complemento, geral, [{ ticker: 'XXXX11', cnpj: '22.222.222/0001-22' }])
    assert.equal(b.cnpj, '22222222000122')
    assert.equal(b.rendimentos.length, 2)
  })

  it('devolve erro por fundo (sem derrubar os outros) quando não encontra o CNPJ', () => {
    const [z, a] = montarRendimentos(complemento, geral, [{ ticker: 'ZZZZ11' }, { ticker: 'AAAA11' }])
    assert.match(z.erro, /CNPJ não encontrado/)
    assert.equal(a.rendimentos.length, 3)
  })

  it('fundo migrado para CNPJ novo (CVM 175): usa o CNPJ com informe mais recente', () => {
    const geralMigrado = lerCsv(GERAL + '33.333.333/0001-33;2026-07-31;1;FUNDO AAAA NOVO CNPJ;BRAAAACTF001\n')
    const compMigrado = lerCsv(
      COMPLEMENTO.replace(/11\.111\.111\/0001-11;2026-07-31;[^\n]*\n/g, '') +
        '33.333.333/0001-33;2026-07-31;1;100,00;0,0090\n',
    )
    const [a] = montarRendimentos(compMigrado, geralMigrado, [{ ticker: 'AAAA11' }])
    assert.equal(a.cnpj, '33333333000133')
    assert.equal(a.rendimentos[0].valorPorCota, 0.9)
    assert.match(a.aviso, /informe mais recente \(2026-07\)/)
  })

  it('continua pedindo o CNPJ manual quando os dois têm informe do mesmo mês', () => {
    const geralDuplo = lerCsv(GERAL + '33.333.333/0001-33;2026-07-31;1;OUTRO;BRAAAACTF001\n')
    const compDuplo = lerCsv(COMPLEMENTO + '33.333.333/0001-33;2026-07-31;1;50,00;0,0090\n')
    const [a] = montarRendimentos(compDuplo, geralDuplo, [{ ticker: 'AAAA11' }])
    assert.match(a.erro, /mesmo mês/)
  })
})

// Cenários com os números reais do rendimentosFii.json de 24/09/2026 e com os meses
// distorcidos identificados na validação contra os valores anunciados pelos fundos.
const serie = (...valores) => valores.map((v, i) => ({ competencia: `2026-${String(8 - i).padStart(2, '0')}`, valorPorCota: v }))

describe('escolherRendimento', () => {
  it('GGRC11 (dados reais): mantém agosto, 0,0984 (real anunciado: 0,10)', () => {
    const { escolhido } = escolherRendimento(serie(0.0984, 0.1504, 0.1217))
    assert.equal(escolhido.valorPorCota, 0.0984)
  })

  it('MXRF11 em mês de emissão: descarta o 0,0748 de julho e publica o mês típico anterior', () => {
    const r = escolherRendimento(serie(0.0748, 0.108, 0.1, 0.1, 0.1, 0.098))
    assert.equal(r.descartados[0].valorPorCota, 0.0748)
    assert.equal(r.escolhido.valorPorCota, 0.108)
  })

  it('TRXF11 em fechamento de semestre: descarta o 1,4606 de junho', () => {
    const r = escolherRendimento(serie(1.4606, 0.93, 0.93, 0.94, 0.93, 0.92))
    assert.equal(r.escolhido.valorPorCota, 0.93)
    assert.equal(r.descartados.length, 1)
  })

  it('KNIP11 (fundo de inflação): com tolerância própria de 50%, aceita a variação real', () => {
    assert.equal(escolherRendimento(serie(0.6537, 0.9582, 1.1036), 0.5).escolhido.valorPorCota, 0.6537)
    // com a tolerância padrão, o mesmo valor seria tratado como distorção
    assert.equal(escolherRendimento(serie(0.6537, 0.9582, 1.1036), 0.2).escolhido.valorPorCota, 0.9582)
  })

  it('não publica nada quando os meses são dispersos demais para haver um valor típico', () => {
    // mediana 2,05: todos os meses ficam a mais de 40% dela
    assert.equal(escolherRendimento(serie(1, 1.1, 3, 3.2)).escolhido, null)
  })

  it('fora do destaque, fundo de inflação (caso VGIP11) publica o mês mais próximo da mediana, marcado como variável', () => {
    const valores = serie(0.6, 1.5, 0.7, 1.4, 0.65, 1.45)
    assert.equal(escolherRendimento(valores).escolhido, null) // regra dos destaques: descarta
    const r = escolherRendimento(valores, 0.2, { aceitarVariavel: true })
    assert.equal(r.variavel, true)
    // mediana = (0,7 + 1,4) / 2 = 1,05; mais próximos: 1,4 (33%) e 0,7 (33%) → vale o mais recente
    assert.equal(r.escolhido.valorPorCota, 0.7)
    assert.equal(r.escolhido.desvio, undefined) // não vaza campo interno para o JSON
    assert.equal(r.descartados.length, 5)
  })

  it('aceitarVariavel não muda nada quando há mês típico', () => {
    const r = escolherRendimento(serie(0.0748, 0.108, 0.1, 0.1, 0.1, 0.098), 0.2, { aceitarVariavel: true })
    assert.equal(r.escolhido.valorPorCota, 0.108)
    assert.equal(r.variavel, undefined)
  })

  it('com menos de 3 meses, publica o mais recente sinalizando que não houve conferência', () => {
    const r = escolherRendimento(serie(0.5, 0.9))
    assert.equal(r.escolhido.valorPorCota, 0.5)
    assert.equal(r.semReferencia, true)
  })
})

describe('mesesIdenticos', () => {
  it('detecta o padrão do XPML11 (três meses com 0,8576)', () => {
    assert.equal(mesesIdenticos(serie(0.8576, 0.8576, 0.8576)), 3)
    assert.equal(mesesIdenticos(serie(0.818, 0.8189, 0.8183)), 1)
  })
})


// ---------------------------------------------------------------------------------------
// Lista ampla (decisão D12): todos os FIIs do informe, além dos 10 em destaque
// ---------------------------------------------------------------------------------------

const GERAL_AMPLO = `CNPJ_Fundo_Classe;Data_Referencia;Versao;Nome_Fundo_Classe;Codigo_ISIN
11.111.111/0001-11;2026-07-31;1;FUNDO AAAA LOGISTICA FII;BRAAAACTF001
22.222.222/0001-22;2026-07-31;1;FUNDO BBBB PAPEL FII;BRBBBBCTF005
44.444.444/0001-44;2026-07-31;1;FUNDO CCCC PEQUENO FII;BRCCCCCTF000
55.555.555/0001-55;2026-07-31;1;FUNDO DDDD GRANDE FII;BRDDDDCTF003
66.666.666/0001-66;2026-03-31;1;FUNDO EEEE ENCERRADO FII;BREEEECTF002
77.777.777/0001-77;2026-07-31;1;FUNDO FFFF RESTRITO FII;BRFFFFCTF009
88.888.888/0001-88;2026-07-31;1;SEM ISIN FII;
`

const COMPLEMENTO_AMPLO = `CNPJ_Fundo_Classe;Data_Referencia;Versao;Patrimonio_Liquido;Total_Numero_Cotistas;Valor_Patrimonial_Cotas;Percentual_Dividend_Yield_Mes
11.111.111/0001-11;2026-06-30;1;500000000;90000;100,00;0,0082
11.111.111/0001-11;2026-07-31;1;500000000;90000;100,00;0,0085
22.222.222/0001-22;2026-07-31;1;300000000;50000;9,50;0,0110
44.444.444/0001-44;2026-06-30;1;20000000;800;10,00;0,0090
44.444.444/0001-44;2026-07-31;1;20000000;800;10,00;0,0091
55.555.555/0001-55;2026-06-30;1;2000000000;200000;100,00;0,0080
55.555.555/0001-55;2026-07-31;1;2000000000;200000;100,00;0,0081
66.666.666/0001-66;2026-03-31;1;90000000;5000;100,00;0,0070
77.777.777/0001-77;2026-07-31;1;900000000;12;100,00;0,0090
88.888.888/0001-88;2026-07-31;1;100000000;3000;100,00;0,0090
`

describe('montarTodosOsFundos', () => {
  const geral = lerCsv(GERAL_AMPLO)
  const complemento = lerCsv(COMPLEMENTO_AMPLO)
  const opcoes = { destaques: [{ ticker: 'BBBB11' }, { ticker: 'AAAA11' }], mesesMaximoAtraso: 3, minimoCotistas: 100 }

  it('põe os destaques primeiro, na ordem da configuração, e os demais do maior patrimônio para o menor', () => {
    const { resultados } = montarTodosOsFundos(complemento, geral, opcoes)
    assert.deepEqual(
      resultados.map((r) => [r.ticker, r.destaque ?? false]),
      [['BBBB11', true], ['AAAA11', true], ['DDDD11', false], ['CCCC11', false]],
    )
    assert.equal(resultados.find((r) => r.ticker === 'DDDD11').nome, 'FUNDO DDDD GRANDE FII')
  })

  it('não repete um destaque na lista dos demais', () => {
    const { resultados } = montarTodosOsFundos(complemento, geral, opcoes)
    assert.equal(resultados.filter((r) => r.ticker.startsWith('AAAA')).length, 1)
  })

  it('ignora fundo sem informe recente e registra o motivo', () => {
    const { ignorados, competenciaMaisRecente } = montarTodosOsFundos(complemento, geral, opcoes)
    assert.equal(competenciaMaisRecente, '2026-07')
    assert.deepEqual(
      ignorados.map((i) => [i.ticker, i.motivo]),
      [['EEEE11', 'sem-informe-recente']],
    )
  })

  it('descarta fundo com poucos cotistas (restrito, em geral fora da bolsa) sem gastar requisição', () => {
    const r = montarTodosOsFundos(complemento, geral, opcoes)
    assert.equal(r.poucosCotistas, 1)
    assert.equal(r.resultados.some((x) => x.ticker === 'FFFF11'), false)
    const semFiltro = montarTodosOsFundos(complemento, geral, { ...opcoes, minimoCotistas: 0 })
    assert.equal(semFiltro.resultados.some((x) => x.ticker === 'FFFF11'), true)
  })

  it('CNPJ ambíguo fora do destaque vira "cadastro-ambiguo" (fundo real, código certo)', () => {
    const geralDuplo = lerCsv(GERAL_AMPLO + '99.999.999/0001-99;2026-07-31;1;OUTRO CCCC;BRCCCCCTF000\n')
    const compDuplo = lerCsv(COMPLEMENTO_AMPLO + '99.999.999/0001-99;2026-07-31;1;1000;500;10,00;0,0090\n')
    const { ignorados, resultados } = montarTodosOsFundos(compDuplo, geralDuplo, opcoes)
    assert.deepEqual(ignorados.find((i) => i.ticker === 'CCCC11')?.motivo, 'cadastro-ambiguo')
    assert.equal(resultados.some((r) => r.ticker === 'CCCC11'), false)
  })

  it('ignora prefixo de ISIN que começa com número (fundo não listado, caso "0D7011")', () => {
    const geralNum = lerCsv(GERAL_AMPLO + '12.121.212/0001-12;2026-07-31;1;BTG INCORPORACAO FII;BR0D70CTF001\n')
    const compNum = lerCsv(COMPLEMENTO_AMPLO + '12.121.212/0001-12;2026-07-31;1;900000000;5000;100,00;0,0090\n')
    const { resultados, ignorados } = montarTodosOsFundos(compNum, geralNum, opcoes)
    assert.equal([...resultados, ...ignorados].some((r) => r.ticker.startsWith('0D70')), false)
  })

  it('código renomeado na B3 (caso RVBI11 → PSEC11) usa o código atual e guarda o antigo', () => {
    const { resultados } = montarTodosOsFundos(complemento, geral, { ...opcoes, renomeados: { 'DDDD11': 'NOVO11' } })
    const r = resultados.find((x) => x.nome === 'FUNDO DDDD GRANDE FII')
    assert.equal(r.ticker, 'NOVO11')
    assert.equal(r.tickerAnterior, 'DDDD11')
    assert.equal(r.rendimentos.length, 2) // os dados continuam vindo do CNPJ certo
  })

  it('funciona sem as colunas opcionais de patrimônio e cotistas', () => {
    const semOpcionais = lerCsv(COMPLEMENTO_AMPLO.replace(/Patrimonio_Liquido;Total_Numero_Cotistas;/, 'X;Y;'))
    const { resultados } = montarTodosOsFundos(semOpcionais, geral, opcoes)
    // sem patrimônio, os demais ficam em ordem alfabética; sem cotistas, o FFFF11 entra
    assert.deepEqual(resultados.slice(2).map((r) => r.ticker), ['CCCC11', 'DDDD11', 'FFFF11'])
  })

  it('mantém o erro do destaque (o script decide se aborta) sem derrubar os demais', () => {
    const { resultados } = montarTodosOsFundos(complemento, geral, { ...opcoes, destaques: [{ ticker: 'ZZZZ11' }] })
    assert.match(resultados[0].erro, /CNPJ não encontrado/)
    assert.ok(resultados.length > 1)
  })
})

describe('publicação', () => {
  it('subtrai meses atravessando a virada do ano', () => {
    assert.equal(subtrairMeses('2026-07', 2), '2026-05')
    assert.equal(subtrairMeses('2026-02', 3), '2025-11')
  })

  it('marca baixa confiança com poucos meses, valor repetido ou cotação parada', () => {
    const hoje = new Date('2026-10-20T12:00:00Z')
    assert.deepEqual(avaliarConfianca({ dataCotacao: '2026-10-17', hoje }), [])
    assert.deepEqual(avaliarConfianca({ semReferencia: true, dataCotacao: '2026-10-17', hoje }), ['poucos-meses'])
    assert.deepEqual(avaliarConfianca({ identicos: 3, dataCotacao: '2026-10-17', hoje }), ['valor-repetido'])
    assert.deepEqual(avaliarConfianca({ dataCotacao: '2026-09-30', hoje }), ['pouca-negociacao'])
    assert.deepEqual(avaliarConfianca({ variavel: true, dataCotacao: '2026-10-17', hoje }), ['rendimento-variavel'])
    // caso HBRH11: informe até ago/2026, publicado dez/2025
    const base = { dataCotacao: '2026-10-17', hoje, competenciaMaisRecente: '2026-08' }
    assert.deepEqual(avaliarConfianca({ ...base, competencia: '2025-12' }), ['mes-antigo'])
    assert.deepEqual(avaliarConfianca({ ...base, competencia: '2026-05' }), ['mes-antigo'])
    assert.deepEqual(avaliarConfianca({ ...base, competencia: '2026-06' }), []) // 2 meses: aceitável (D10)
  })

  it('grava um fundo por linha e o resultado continua sendo JSON válido', () => {
    const snapshot = {
      geradoEm: '2026-10-20T12:00:00.000Z',
      vigenciaIfix: 'set a dez/2026',
      destaques: ['AAAA11'],
      fundos: [
        { ticker: 'AAAA11', nome: 'A', cotacao: 100, dataCotacao: '2026-10-17', rendimentos: [{ competencia: '2026-08', valorPorCota: 0.85 }] },
        { ticker: 'BBBB11', nome: 'B', cotacao: 9.5, dataCotacao: '2026-10-17', rendimentos: [{ competencia: '2026-08', valorPorCota: 0.1 }] },
      ],
      indisponiveis: [],
    }
    const texto = formatarSnapshot(snapshot)
    assert.deepEqual(JSON.parse(texto), snapshot)
    assert.equal(texto.split('\n').filter((l) => l.includes('"ticker"')).length, 2)
  })
})

// ---------------------------------------------------------------------------------------
// Lista por liquidez e setor (decisão D13)
// ---------------------------------------------------------------------------------------

describe('setorDoFundo', () => {
  it('traduz o segmento declarado à CVM para o nome que o investidor conhece', () => {
    assert.equal(setorDoFundo({ segmento: 'Logística' }), 'Logística')
    assert.equal(setorDoFundo({ segmento: 'Shoppings' }), 'Shoppings')
    assert.equal(setorDoFundo({ segmento: 'Lajes Corporativas' }), 'Escritórios')
    assert.equal(setorDoFundo({ segmento: 'Títulos e Val. Mob.' }), 'Papel (CRI)')
    assert.equal(setorDoFundo({ segmento: 'Híbrido' }), 'Híbrido')
    assert.equal(setorDoFundo({ segmento: 'Hospital' }), 'Saúde')
    assert.equal(setorDoFundo({ segmento: 'Agências de Bancos' }), 'Varejo e renda urbana')
  })

  it('reconhece fundo de fundos pelo nome, mesmo que o segmento diga outra coisa', () => {
    assert.equal(setorDoFundo({ nome: 'HEDGE TOP FOFII 3 FUNDO DE INVESTIMENTO IMOBILIÁRIO', segmento: 'Títulos e Val. Mob.' }), 'Fundo de fundos')
    assert.equal(setorDoFundo({ nome: 'FUNDO DE FUNDOS DE INVESTIMENTO IMOBILIÁRIO KINEA FII', segmento: 'Outros' }), 'Fundo de fundos')
  })

  it('usa mandato e nome quando o segmento vem vazio', () => {
    assert.equal(setorDoFundo({ nome: 'X', segmento: '', mandato: 'Títulos e Valores Mobiliários' }), 'Papel (CRI)')
    assert.equal(setorDoFundo({ nome: 'VALORA CRI CDI FII', segmento: '' }), 'Papel (CRI)')
    assert.equal(setorDoFundo({ nome: 'X', segmento: 'Outros' }), 'Outros')
  })

  it('mandato "Títulos e Valores Mobiliários" vence o segmento "Híbrido" (fundo de CRI)', () => {
    assert.equal(setorDoFundo({ nome: 'KINEA RENDIMENTOS', segmento: 'Híbrido', mandato: 'Títulos e Valores Mobiliários' }), 'Papel (CRI)')
    assert.equal(setorDoFundo({ nome: 'KINEA RENDA', segmento: 'Híbrido', mandato: 'Renda' }), 'Híbrido')
    // fundo de fundos continua reconhecido pelo nome, mesmo com mandato de títulos
    assert.equal(setorDoFundo({ nome: 'KINEA FOF', segmento: 'Híbrido', mandato: 'Títulos e Valores Mobiliários' }), 'Fundo de fundos')
  })

  it('a correção manual da configuração vence a classificação da CVM', () => {
    assert.equal(setorDoFundo({ segmento: 'Híbrido', correcao: 'Logística' }), 'Logística')
  })
})

describe('volumeMedioDiario', () => {
  const dia = (d, close, volume) => ({ date: d, close, volume })

  it('converte cotas negociadas em reais (volume × fechamento) e tira a média', () => {
    const hist = [dia(1, 100, 20000), dia(2, 100, 10000)] // R$ 2 mi e R$ 1 mi
    assert.equal(volumeMedioDiario(hist), 1_500_000)
  })

  it('dia sem negócio entra como zero, porque liquidez é frequência de negócios', () => {
    assert.equal(volumeMedioDiario([dia(1, 10, 300000), dia(2, 10, 0), dia(3, 10, 0)]), 1_000_000)
  })

  it('usa só as sessões mais recentes, em ordem de data', () => {
    const hist = [dia(3, 10, 100), dia(1, 10, 999999999), dia(2, 10, 100)]
    assert.equal(volumeMedioDiario(hist, 2), 1000)
  })

  it('sem histórico devolve null (não inventa liquidez)', () => {
    assert.equal(volumeMedioDiario(undefined), null)
    assert.equal(volumeMedioDiario([]), null)
  })
})
