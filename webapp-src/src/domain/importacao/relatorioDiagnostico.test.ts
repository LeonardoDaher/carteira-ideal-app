// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest'
import { PDF_NOTA_899 } from './__fixtures__/notaSintetica'
import { base64ParaArrayBuffer } from './__fixtures__/xlsxSinteticos'
import { lerNotaSinacor } from './notaSinacor'
import { lerLinhasPdf, type LinhaPdf } from './pdf'
import { mascararCelula, relatorioDiagnostico } from './relatorioDiagnostico'

let linhas: LinhaPdf[]
let relatorio: string
beforeAll(async () => {
  linhas = await lerLinhasPdf(base64ParaArrayBuffer(PDF_NOTA_899), '899')
  relatorio = relatorioDiagnostico(linhas, lerNotaSinacor(linhas), null, { versaoPdfjs: 'teste', paginas: 1 })
})

describe('mascararCelula', () => {
  it.each([
    ['000.000.000-00', '[oculto]'], // CPF
    ['00.000.000/0001-00', '[oculto]'], // CNPJ
    ['11111111', '[oculto]'], // conta / código de cliente
    ['3-5 11111111', '[oculto]'],
    ['Tel. +55 11 4003-6245', '[oculto]'], // telefone
    ['Ouvidoria: Tel. 0800-722-3730', '[oculto]'],
    ['22440-032', '[oculto]'], // CEP
    ['(27) 99840-5984', '[oculto]'],
  ])('oculta %s', (entrada, esperado) => expect(mascararCelula(entrada)).toBe(esperado))

  it.each([['1.403,60'], ['322,50 C'], ['3.794,07'], ['123.456,78'], ['200'], ['1.600'], ['30/09/2026'], ['CSNMINERACAO'], ['HGBS11'], ['@#']])(
    'deixa passar %s (valor, quantidade, data ou texto da tabela)',
    (entrada) => expect(mascararCelula(entrada)).toBe(entrada),
  )
})

describe('relatorioDiagnostico: seguro para compartilhar', () => {
  it('NÃO contém nenhum dado pessoal do cabeçalho (nome, CPF, endereço, conta, corretora, CNPJ)', () => {
    for (const pessoal of ['CLIENTE EXEMPLO', '000.000.000-00', 'RUA FICTICIA', 'BAIRRO EXEMPLO', '11111111', 'CORRETORA FICTICIA', '00.000.000/0001-00', '987654321']) {
      expect(relatorio).not.toContain(pessoal)
    }
  })
  it('mantém só o formato do nº da nota (dígitos viram #) e a data do pregão', () => {
    expect(relatorio).toContain('#########')
    expect(relatorio).toContain('30/09/2026')
  })
  it('omite as linhas do cabeçalho e diz quantas', () => {
    expect(relatorio).toMatch(/\[\d+ linha\(s\) do cabeçalho omitida\(s\)\]/)
  })
  it('mostra o que precisa ser conferido: negócios, verificações, resumo e a estrutura da tabela', () => {
    expect(relatorio).toContain('conferida (as contas da nota fecham): SIM')
    expect(relatorio).toContain('[ok] Líquido da nota')
    expect(relatorio).toContain('CSNMINERACAO')
    expect(relatorio).toContain('1.000,00')
    expect(relatorio).toContain('Resumo Financeiro')
    expect(relatorio).toMatch(/[\d.]+–[\d.]+ "Quantidade"/) // posições x das colunas
  })
  it('sem a tabela de negócios, não despeja nada do PDF (falha fechada)', () => {
    const r = relatorioDiagnostico([{ pagina: 1, y: 700, celulas: [{ x: 10, xFim: 90, texto: 'FULANO DE TAL 000.000.000-00' }], texto: 'FULANO DE TAL 000.000.000-00' }], null, 'x')
    expect(r).not.toContain('FULANO')
    expect(r).not.toContain('000.000.000-00')
    expect(r).toContain('omitido por segurança')
  })
  it('um dado pessoal que dividisse a linha dos rótulos também seria ocultado', () => {
    const copia: LinhaPdf[] = JSON.parse(JSON.stringify(linhas))
    const i = copia.findIndex((l) => l.texto.includes('Nr. nota'))
    copia[i].celulas.push({ x: 300, xFim: 380, texto: '000.000.000-00' })
    expect(relatorioDiagnostico(copia, null, null)).not.toContain('000.000.000-00')
  })
  it('um erro (ex.: senha) aparece, sem trazer o PDF', () => {
    const r = relatorioDiagnostico([], null, 'Senha incorreta.')
    expect(r).toContain('ERRO: Senha incorreta.')
  })
})
