// @vitest-environment node
// (jsdom cria um ArrayBuffer de outro "realm" que o pdf.js não reconhece; no navegador isso não ocorre.)
import { describe, expect, it } from 'vitest'
import { PDF_SENHA_899, SENHA_CERTA } from './__fixtures__/pdfSintetico'
import { base64ParaArrayBuffer } from './__fixtures__/xlsxSinteticos'
import { PdfInvalidoError, SenhaIncorretaError, SenhaNecessariaError, lerLinhasPdf, senhaValidaDe3Digitos } from './pdf'

const pdf = () => base64ParaArrayBuffer(PDF_SENHA_899)

describe('lerLinhasPdf: senha', () => {
  it('sem senha: pede a senha', async () => {
    await expect(lerLinhasPdf(pdf())).rejects.toBeInstanceOf(SenhaNecessariaError)
  })
  it('senha errada: diz que está incorreta (e não confunde com "falta a senha")', async () => {
    const e = await lerLinhasPdf(pdf(), '123').catch((x) => x)
    expect(e).toBeInstanceOf(SenhaIncorretaError)
    expect(e).not.toBeInstanceOf(SenhaNecessariaError)
  })
  it('senha certa abre', async () => {
    expect((await lerLinhasPdf(pdf(), SENHA_CERTA)).length).toBeGreaterThan(0)
  })
  it('depois de errar, dá para tentar de novo com o MESMO buffer (o chamador não perde o arquivo)', async () => {
    const bytes = pdf()
    await expect(lerLinhasPdf(bytes, '000')).rejects.toBeInstanceOf(SenhaIncorretaError)
    expect((await lerLinhasPdf(bytes, SENHA_CERTA)).length).toBeGreaterThan(0)
  })
  it('arquivo que não é PDF: erro claro, sem estourar exceção estranha', async () => {
    await expect(lerLinhasPdf(new TextEncoder().encode('isto não é um pdf'), '899')).rejects.toBeInstanceOf(PdfInvalidoError)
  })
})

describe('lerLinhasPdf: linhas e colunas', () => {
  it('reconstrói as linhas de cima para baixo e as células da esquerda para a direita', async () => {
    const linhas = await lerLinhasPdf(pdf(), SENHA_CERTA)
    expect(linhas[0].texto).toContain('NOTA DE NEGOCIACAO')
    expect(linhas[0].texto).toContain('30/09/2026')
    const negocio = linhas.find((l) => l.texto.includes('CMIN3'))!
    // colunas da tabela viram células separadas, na ordem
    expect(negocio.celulas.map((c) => c.texto)).toEqual(['1-BOVESPA', 'C', 'CMIN3 ON NM', '100', '4,97', '497,00'])
    const xs = negocio.celulas.map((c) => c.x)
    expect([...xs].sort((a, b) => a - b)).toEqual(xs)
  })
  it('colunas coladas (o texto de uma começa antes de a anterior terminar) não se fundem', async () => {
    // No fixture, "CMIN3 ON NM" e a quantidade se sobrepõem; o cabeçalho também.
    const linhas = await lerLinhasPdf(pdf(), SENHA_CERTA)
    expect(linhas.find((l) => l.texto.includes('HGBS11'))!.celulas.map((c) => c.texto)).toEqual(['1-BOVESPA', 'C', 'HGBS11 CI', '12', '18,58', '222,96'])
    expect(linhas.find((l) => l.texto.includes('Especificacao'))!.celulas.map((c) => c.texto)).toContain('Quantidade')
  })
  it('a ordem das linhas segue a página (cabeçalho, colunas, negócios, taxas)', async () => {
    const linhas = await lerLinhasPdf(pdf(), SENHA_CERTA)
    const ordem = ['NOTA DE NEGOCIACAO', 'Negociacao', 'CMIN3', 'HGBS11', 'Taxa de liquidacao', 'Emolumentos']
    const idx = ordem.map((t) => linhas.findIndex((l) => l.texto.includes(t)))
    expect(idx.every((i) => i >= 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })
  it('lê os números das taxas na coluna da direita', async () => {
    const linhas = await lerLinhasPdf(pdf(), SENHA_CERTA)
    const taxa = linhas.find((l) => l.texto.includes('Taxa de liquidacao'))!
    expect(taxa.celulas[taxa.celulas.length - 1].texto).toBe('0,18 D')
  })
})

describe('senhaValidaDe3Digitos', () => {
  it('aceita só 3 dígitos', () => {
    expect(senhaValidaDe3Digitos('899')).toBe(true)
    expect(senhaValidaDe3Digitos(' 899 ')).toBe(true)
    expect(senhaValidaDe3Digitos('89')).toBe(false)
    expect(senhaValidaDe3Digitos('8999')).toBe(false)
    expect(senhaValidaDe3Digitos('12a')).toBe(false)
    expect(senhaValidaDe3Digitos('')).toBe(false)
  })
})
