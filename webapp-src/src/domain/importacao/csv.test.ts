import { describe, expect, it } from 'vitest'
import { decodificarTexto, detectarSeparador, lerCsv } from './csv'

describe('csv', () => {
  it('detecta ponto e vírgula (Excel brasileiro) sem confundir com a vírgula decimal', () => {
    const t = 'Data;Tipo;Ativo;Preço\n05/03/2026;Compra;MXRF11;10,05\n06/03/2026;Compra;BBSE3;35,15'
    expect(detectarSeparador(t)).toBe(';')
    expect(lerCsv(t)[1]).toEqual(['05/03/2026', 'Compra', 'MXRF11', '10,05'])
  })
  it('detecta vírgula e tabulação', () => {
    expect(detectarSeparador('Date,Type,Ticker\n2026-03-05,Buy,MXRF11')).toBe(',')
    expect(detectarSeparador('Data\tTipo\tAtivo\n05/03/2026\tCompra\tMXRF11')).toBe('\t')
  })
  it('respeita aspas, separador dentro de aspas e aspas duplas', () => {
    const m = lerCsv('a;b;c\n"x;y";"diz ""oi""";3')
    expect(m[1]).toEqual(['x;y', 'diz "oi"', '3'])
  })
  it('aceita CRLF, BOM e última linha sem quebra', () => {
    const m = lerCsv('\uFEFFa;b\r\n1;2\r\n3;4')
    expect(m).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
  })
  it('decodifica UTF-8 e cai para Windows-1252', () => {
    expect(decodificarTexto(new TextEncoder().encode('Preço'))).toBe('Preço')
    // "Preço" em Windows-1252: ç = 0xE7
    expect(decodificarTexto(new Uint8Array([0x50, 0x72, 0x65, 0xe7, 0x6f]))).toBe('Preço')
  })
})
