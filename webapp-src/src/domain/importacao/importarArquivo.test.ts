// @vitest-environment node
// (jsdom cria um ArrayBuffer de outro "realm" que a biblioteca de XLSX não reconhece; num navegador real isso não ocorre.)
import { describe, expect, it } from 'vitest'
import { derivarPosicoes, mesclarLancamentos } from '../lancamentos'
import { importarArquivo } from './index'
import { XLSX_MOVIMENTACAO, XLSX_NEGOCIACAO, XLSX_POSICAO, base64ParaArrayBuffer } from './__fixtures__/xlsxSinteticos'

const abrir = (nome: 'movimentacao-sintetico.xlsx' | 'negociacao-sintetico.xlsx'): ArrayBuffer =>
  base64ParaArrayBuffer(nome.startsWith('mov') ? XLSX_MOVIMENTACAO : XLSX_NEGOCIACAO)

describe('importarArquivo: XLSX estilo extrato de Movimentação', () => {
  it('lê datas do Excel, textos em formato brasileiro e ignora a transferência', async () => {
    const r = await importarArquivo('movimentacao.xlsx', abrir('movimentacao-sintetico.xlsx'))
    expect(r.perfil).toBe('b3-movimentacao')
    expect(r.erroGeral).toBeUndefined()
    expect(r.erros).toEqual([])
    expect(r.linhasLidas).toBe(9)
    expect(r.lancamentos).toHaveLength(8)
    expect(r.lancamentos[0]).toMatchObject({ data: '2026-03-05', tipo: 'compra', ativo: 'MXRF11', quantidade: 100, preco: 10.05 })
    const tesouro = r.lancamentos.find((l) => l.ativo === 'TESOURO SELIC 2029')!
    expect(tesouro).toMatchObject({ data: '2026-06-15', quantidade: 0.5, preco: 15200, valor: 7600 })
    expect(r.avisos.some((a) => a.includes('"Transferência"'))).toBe(true)
  })

  it('as posições derivadas batem com a conta à mão', async () => {
    const r = await importarArquivo('movimentacao.xlsx', abrir('movimentacao-sintetico.xlsx'))
    const { lancamentos } = mesclarLancamentos([], r.lancamentos)
    const { posicoes, avisos } = derivarPosicoes(lancamentos)
    const p = (a: string) => posicoes.find((x) => x.ativo === a)!
    expect(avisos).toEqual([])
    expect(p('MXRF11').quantidade).toBe(80)
    expect(p('MXRF11').precoMedio).toBeCloseTo(10.05, 8)
    expect(p('MXRF11').resultadoRealizado).toBeCloseTo(7, 8) // 208 − 20×10,05
    expect(p('MXRF11').proventos).toBeCloseTo(10, 8)
    expect(p('BBSE3').quantidade).toBe(62) // desdobramento dobra a quantidade
    expect(p('BBSE3').precoMedio).toBeCloseTo(1089.65 / 62, 8) // custo total não muda
    expect(p('BBSE3').proventos).toBeCloseTo(24.8 + 12.4, 8)
  })

  it('reimportar o mesmo arquivo não duplica nada', async () => {
    const r1 = await importarArquivo('m.xlsx', abrir('movimentacao-sintetico.xlsx'))
    const a = mesclarLancamentos([], r1.lancamentos)
    const r2 = await importarArquivo('m.xlsx', abrir('movimentacao-sintetico.xlsx'))
    const b = mesclarLancamentos(a.lancamentos, r2.lancamentos)
    expect(b.adicionados).toBe(0)
    expect(b.repetidos).toBe(8)
    expect(b.lancamentos).toHaveLength(8)
  })
})

describe('importarArquivo: XLSX estilo extrato de Negociação', () => {
  it('pula as linhas de título, junta PETR4F a PETR4 e ignora a opção', async () => {
    const r = await importarArquivo('negociacao.xlsx', abrir('negociacao-sintetico.xlsx'))
    expect(r.perfil).toBe('b3-negociacao')
    expect(r.erros).toEqual([])
    expect(r.lancamentos).toHaveLength(4)
    const { posicoes } = derivarPosicoes(mesclarLancamentos([], r.lancamentos).lancamentos)
    const petr = posicoes.find((x) => x.ativo === 'PETR4')!
    expect(petr.quantidade).toBe(103)
    expect(petr.custoTotal).toBeCloseTo(114.3 + 3800, 6)
    expect(posicoes.find((x) => x.ativo === 'WEGE3')!.quantidade).toBe(6)
  })
})

describe('importarArquivo: CSV e formatos inválidos', () => {
  const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer
  it('CSV com ponto e vírgula', async () => {
    const r = await importarArquivo('carteira.csv', bytes('Data;Tipo;Ativo;Quantidade;Preço\n01/02/2026;Compra;VALE3;10;60,5'))
    expect(r.lancamentos).toHaveLength(1)
    expect(r.lancamentos[0].origem).toBe('arquivo')
  })
  it('.xls antigo: orienta a salvar como .xlsx', async () => {
    const r = await importarArquivo('velho.xls', bytes('x'))
    expect(r.erroGeral).toContain('.xlsx')
  })
  it('extensão desconhecida e arquivo corrompido não estouram exceção', async () => {
    expect((await importarArquivo('a.pdf', bytes('x'))).erroGeral).toContain('Formato')
    expect((await importarArquivo('a.xlsx', bytes('isto não é um zip'))).erroGeral).toContain('Não conseguimos abrir')
  })
})

describe('importarArquivo: XLSX estilo extrato de Posição (várias abas)', () => {
  it('junta as abas reconhecidas, avisa da aba que não reconheceu e traz o custo só do Tesouro', async () => {
    const r = await importarArquivo('posicao.xlsx', base64ParaArrayBuffer(XLSX_POSICAO))
    expect(r.perfil).toBe('b3-posicao')
    expect(r.erros).toEqual([])
    expect(r.lancamentos).toEqual([])
    expect(r.posicao!.map((p) => `${p.categoria}:${p.ativo}`)).toEqual([
      'acoes:BBAS3', 'acoes:VALE3', 'bdr:AAPL34', 'fundos:MXRF11', 'tesouro:TESOURO IPCA+ 2029',
    ])
    expect(r.posicao!.find((p) => p.ativo === 'MXRF11')!.quantidade).toBe(250) // veio como texto
    const tesouro = r.posicao!.find((p) => p.categoria === 'tesouro')!
    expect(tesouro).toMatchObject({ quantidade: 1.67, valorAplicado: 5000, vencimento: '2029-05-15' })
    expect(r.posicao!.filter((p) => p.categoria !== 'tesouro').every((p) => p.valorAplicado === null)).toBe(true)
    expect(r.avisos.some((a) => a.includes('Renda Fixa') && a.includes('ignoradas'))).toBe(true)
    expect(r.avisos.filter((a) => a.includes('foto')).length).toBe(1) // aviso repetido entre abas sai uma vez
  })
})
