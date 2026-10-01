import { describe, expect, it } from 'vitest'
import { CARTEIRA_VAZIA, VERSAO_CARTEIRA, aplicarImportacao, carteiraVazia, dataDaPosicaoPeloNome, lerCarteiraSalva, serializarCarteira } from './carteiraSalva'
import type { ItemPosicaoB3, ResultadoImportacao } from './importacao/planilha'
import { mesclarLancamentos, type LancamentoNovo } from './lancamentos'

const L = (o: Partial<LancamentoNovo> = {}): LancamentoNovo => ({
  data: '2026-03-02', tipo: 'compra', ativo: 'VALE3', quantidade: 100, preco: 10, valor: 1000, taxas: 0, origem: 'b3-negociacao', ...o,
})
const resultado = (o: Partial<ResultadoImportacao> = {}): ResultadoImportacao => ({ perfil: 'b3-negociacao', lancamentos: [], avisos: [], erros: [], linhasLidas: 0, ...o })
const pos = (ativo = 'VALE3'): ItemPosicaoB3 => ({ ativo, categoria: 'acoes', quantidade: 100, precoFechamento: 15, valorAtualizado: 1500, valorAplicado: null })

describe('serializar e ler: ida e volta', () => {
  it('uma carteira completa sobrevive à gravação', () => {
    const c = { ...carteiraVazia(), lancamentos: mesclarLancamentos([], [L(), L({ tipo: 'provento', valor: 5, quantidade: 0, preco: 0, subtipo: 'jcp' })]).lancamentos, excluidas: ['x#1'], posicao: [pos()], dataPosicao: '2026-09-30' }
    expect(lerCarteiraSalva(serializarCarteira(c))).toEqual(c)
  })
})

describe('lerCarteiraSalva: dado ruim nunca trava o app', () => {
  it.each([[null], [''], ['{isto não é json'], ['null'], ['[]'], [JSON.stringify({ versao: 99, carteira: {} })], [JSON.stringify({ versao: VERSAO_CARTEIRA })]])('%j -> null', (b) => {
    expect(lerCarteiraSalva(b as string | null)).toBeNull()
  })
  it('descarta só os itens inválidos e guarda os bons', () => {
    const bom = mesclarLancamentos([], [L()]).lancamentos[0]
    const bruto = JSON.stringify({
      versao: VERSAO_CARTEIRA,
      carteira: {
        lancamentos: [bom, { ...bom, id: 'ruim1', data: '05/03/2026' }, { ...bom, id: 'ruim2', quantidade: 'cem' }, { ...bom, id: 'ruim3', tipo: 'doação' }, { ...bom, id: 'ruim4', quantidade: 0 }, 42, null],
        excluidas: ['a#1', 7, ''],
        posicao: [pos(), { ativo: 'X', categoria: 'inventada', quantidade: 1, valorAtualizado: 1 }, { ativo: '', categoria: 'acoes' }],
        dataPosicao: '2026-09-30',
        eventosFuturos: [{ ativo: 'A', tipoEvento: 'jcp', previsao: '2026-10-01', quantidade: 1, precoUnitario: 1, valorLiquido: 2 }, { ativo: 'B', previsao: 'ontem' }],
      },
    })
    const c = lerCarteiraSalva(bruto)!
    expect(c.lancamentos.map((l) => l.id)).toEqual([bom.id])
    expect(c.excluidas).toEqual(['a#1'])
    expect(c.posicao).toHaveLength(1)
    expect(c.eventosFuturos).toHaveLength(1)
  })
  it('data da posição inválida vira null; posição vazia vira null', () => {
    const c = lerCarteiraSalva(JSON.stringify({ versao: VERSAO_CARTEIRA, carteira: { lancamentos: [], excluidas: [], posicao: [], dataPosicao: 'amanhã', eventosFuturos: [] } }))!
    expect(c.dataPosicao).toBeNull()
    expect(c.posicao).toBeNull()
  })
})

describe('dataDaPosicaoPeloNome', () => {
  it('é o pregão anterior ao dia do download que está no nome do arquivo', () => {
    expect(dataDaPosicaoPeloNome('posicao-2026-10-01-11-42-59.xlsx', '2026-12-25')).toBe('2026-09-30')
    expect(dataDaPosicaoPeloNome('posicao-2026-10-05-08-00-00.xlsx', '2026-12-25')).toBe('2026-10-02') // segunda -> sexta
  })
  it('sem data no nome, usa o pregão anterior a hoje', () => {
    expect(dataDaPosicaoPeloNome('minha posicao.xlsx', '2026-10-01')).toBe('2026-09-30')
    expect(dataDaPosicaoPeloNome('posicao-2026-13-45.xlsx', '2026-10-01')).toBe('2026-09-30') // data impossível
  })
})

describe('aplicarImportacao', () => {
  const hoje = '2026-10-01'
  it('soma os lançamentos de vários arquivos e resume cada um', () => {
    const a = aplicarImportacao(carteiraVazia(), [
      { nome: 'negociacao.xlsx', resultado: resultado({ lancamentos: [L(), L({ ativo: 'BBAS3' })] }) },
      { nome: 'proventos.xlsx', resultado: resultado({ perfil: 'b3-proventos-recebidos', lancamentos: [L({ tipo: 'provento', valor: 5, quantidade: 0, preco: 0 })], erros: [{ linha: 3, motivo: 'x' }], avisos: ['aviso'] }) },
    ], hoje)
    expect(a.carteira.lancamentos).toHaveLength(3)
    expect(a.resumos.map((r) => [r.nome, r.adicionados, r.erros])).toEqual([['negociacao.xlsx', 2, 0], ['proventos.xlsx', 1, 1]])
    expect(a.resumos[1].avisos).toEqual(['aviso'])
  })
  it('reimportar o mesmo arquivo não duplica e conta os repetidos', () => {
    const r = resultado({ lancamentos: [L(), L({ ativo: 'BBAS3' })] })
    const a = aplicarImportacao(carteiraVazia(), [{ nome: 'n.xlsx', resultado: r }], hoje)
    const b = aplicarImportacao(a.carteira, [{ nome: 'n.xlsx', resultado: r }], hoje)
    expect(b.carteira.lancamentos).toHaveLength(2)
    expect(b.resumos[0]).toMatchObject({ adicionados: 0, repetidos: 2 })
  })
  it('respeita o que a pessoa excluiu: o lançamento errado não volta no extrato', () => {
    const r = resultado({ lancamentos: [L()] })
    const a = aplicarImportacao(carteiraVazia(), [{ nome: 'n.xlsx', resultado: r }], hoje)
    const sem = { ...a.carteira, lancamentos: [], excluidas: [a.carteira.lancamentos[0].id] }
    const b = aplicarImportacao(sem, [{ nome: 'n.xlsx', resultado: r }], hoje)
    expect(b.carteira.lancamentos).toEqual([])
  })
  it('a Posição entra com a data do pregão anterior ao download; a mais nova substitui a anterior', () => {
    const a = aplicarImportacao(carteiraVazia(), [{ nome: 'posicao-2026-10-01-11-42-59.xlsx', resultado: resultado({ perfil: 'b3-posicao', posicao: [pos()] }) }], hoje)
    expect(a.carteira).toMatchObject({ dataPosicao: '2026-09-30' })
    expect(a.carteira.posicao).toHaveLength(1)
    const b = aplicarImportacao(a.carteira, [{ nome: 'posicao-2026-10-08-09-00-00.xlsx', resultado: resultado({ perfil: 'b3-posicao', posicao: [pos('BBAS3'), pos('PETR4')] }) }], hoje)
    expect(b.carteira.posicao!.map((p) => p.ativo)).toEqual(['BBAS3', 'PETR4'])
    expect(b.carteira.dataPosicao).toBe('2026-10-07')
  })
  it('arquivo sem Posição não apaga a Posição que já existia', () => {
    const a = aplicarImportacao(carteiraVazia(), [{ nome: 'posicao-2026-10-01.xlsx', resultado: resultado({ perfil: 'b3-posicao', posicao: [pos()] }) }], hoje)
    const b = aplicarImportacao(a.carteira, [{ nome: 'neg.xlsx', resultado: resultado({ lancamentos: [L()] }) }], hoje)
    expect(b.carteira.posicao).toHaveLength(1)
  })
  it('arquivo com erro geral entra no resumo e não altera nada', () => {
    const a = aplicarImportacao(carteiraVazia(), [{ nome: 'x.xlsx', resultado: resultado({ perfil: null, erroGeral: 'colunas mínimas' }) }], hoje)
    expect(a.carteira).toEqual(CARTEIRA_VAZIA)
    expect(a.resumos[0].erroGeral).toBe('colunas mínimas')
  })
  it('agenda de proventos a receber: o arquivo novo substitui a agenda antiga', () => {
    const ev = (ativo: string) => ({ ativo, tipoEvento: 'jcp' as const, previsao: '2026-10-05', quantidade: 1, precoUnitario: 1, valorLiquido: 2 })
    const a = aplicarImportacao(carteiraVazia(), [{ nome: 'a.xlsx', resultado: resultado({ perfil: 'b3-proventos-a-receber', eventosFuturos: [ev('A'), ev('B')] }) }], hoje)
    const b = aplicarImportacao(a.carteira, [{ nome: 'b.xlsx', resultado: resultado({ perfil: 'b3-proventos-a-receber', eventosFuturos: [ev('C')] }) }], hoje)
    expect(b.carteira.eventosFuturos.map((e) => e.ativo)).toEqual(['C'])
  })
})
