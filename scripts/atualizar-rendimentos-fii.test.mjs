// Testes do script mensal (node --test). Os CSVs abaixo imitam o formato do Portal de
// Dados Abertos da CVM: ";" como separador, cabeçalho na primeira linha, reapresentações
// com número de versão e nomes de coluna do padrão da Resolução CVM 175.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acharColuna,
  competenciaDe,
  divisorEscalaDy,
  lerCsv,
  lerNumero,
  montarRendimentos,
  prefixoTickerDoIsin,
  rendimentoPlausivel,
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
