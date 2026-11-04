import assert from 'node:assert/strict'
import test from 'node:test'
import { datasDoBoletim, datasQueFaltam, extrairIndices } from './atualizar-indices.mjs'

// Formato conferido no arquivo IR261103 da B3 (valores do IBOV e do IFIX de 03/11/2026).
const bloco = (ticker, abe, min, max, fech, desc = ticker) => `
        <IndxInf>
            <SctyInf>
                <SctyId>
                    <TckrSymb>${ticker}</TckrSymb>
                </SctyId>
                <OpngPric Ccy="BRL">${abe}</OpngPric>
                <MinPric Ccy="BRL">${min}</MinPric>
                <MaxPric Ccy="BRL">${max}</MaxPric>
                <TradAvrgPric Ccy="BRL">165394.51</TradAvrgPric>
                <PrvsDayClsgPric Ccy="BRL">167921.8</PrvsDayClsgPric>
                <ClsgPric Ccy="BRL">${fech}</ClsgPric>
                <IndxVal Ccy="BRL">${fech}</IndxVal>
            </SctyInf>
            <AsstDesc>${desc}</AsstDesc>
        </IndxInf>`
const xml = (extra = '') => `<Document><TradDt><Dt>2026-11-03</Dt></TradDt>${bloco('IBOVEQWEIGHT', 2000, 1990, 2010, 2007.68)}${bloco('IBOV', 167917.3, 164446.53, 168005.46, 165528.92)}${bloco('IFIX', 3646.58, 3522.28, 3646.58, 3525.27)}${extra}</Document>`

test('extrairIndices: lê IBOV e IFIX por igualdade (IBOVEQWEIGHT não entra)', () => {
  const r = extrairIndices(xml(), ['IBOV', 'IFIX'], '2026-11-03')
  assert.deepEqual(r.get('IBOV'), ['2026-11-03', 167917.3, 168005.46, 164446.53, 165528.92, 0])
  assert.deepEqual(r.get('IFIX'), ['2026-11-03', 3646.58, 3646.58, 3522.28, 3525.27, 0])
  assert.equal(r.size, 2)
})

test('extrairIndices: erra quando falta um índice, número inválido ou máxima abaixo do fechamento', () => {
  assert.throws(() => extrairIndices(xml().replace(/<IndxInf>(?:(?!<\/IndxInf>)[\s\S])*IFIX[\s\S]*?<\/IndxInf>/, ''), ['IBOV', 'IFIX'], '2026-11-03'), /não trouxe IFIX/)
  assert.throws(() => extrairIndices(xml().replace('165528.92</ClsgPric>', '</ClsgPric>'), ['IBOV'], '2026-11-03'), /maiores que zero/)
  assert.throws(() => extrairIndices(`<D>${bloco('IBOV', 100, 99, 100.5, 101)}</D>`, ['IBOV'], '2026-11-03'), /não cobrem/)
})

test('datasDoBoletim: junta as datas distintas do arquivo', () => {
  assert.deepEqual(datasDoBoletim(xml()), ['2026-11-03'])
  assert.deepEqual(datasDoBoletim(xml('<Dt>2026-11-02</Dt>')), ['2026-11-02', '2026-11-03'])
  assert.deepEqual(datasDoBoletim('<a/>'), [])
})

test('datasQueFaltam: dia a dia para na primeira conhecida; carga inicial pula as que já tem', () => {
  const candidatas = ['2026-11-04', '2026-11-03', '2026-11-02', '2026-10-30']
  const jaTem = new Set(['2026-11-02', '2026-10-30'])
  assert.deepEqual(datasQueFaltam(candidatas, jaTem), ['2026-11-03', '2026-11-04'])
  assert.deepEqual(datasQueFaltam(candidatas, jaTem, true), ['2026-11-04', '2026-11-03'])
  assert.deepEqual(datasQueFaltam(candidatas, new Set(candidatas)), [])
})
