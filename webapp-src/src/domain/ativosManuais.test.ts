import { describe, expect, it } from 'vitest'
import { categoriaDaClasse, chaveDoAtivoManual, validarAtivoManual, type AtivoManual } from './ativosManuais'
import { CLASSES_ESCOLHA } from './classesDaCarteira'
import { VERSAO_CARTEIRA, carteiraVazia, lerCarteiraSalva, serializarCarteira } from './carteiraSalva'
import type { ItemPosicaoB3 } from './importacao/planilha'
import { mesclarLancamentos, type LancamentoNovo } from './lancamentos'
import { agruparPosicoes, composicaoDasLinhas, montarPainel } from './painelCarteira'

const M = (o: Partial<AtivoManual> = {}): AtivoManual => ({ ativo: 'CDB BANCO X', nome: 'CDB Banco X', quantidade: 1, precoMedio: 10000, valorAtual: 10500, classe: 'cdbLiquidez', ...o })
const L = (o: Partial<LancamentoNovo> = {}): LancamentoNovo => ({ data: '2026-03-02', tipo: 'compra', ativo: 'VALE3', quantidade: 100, preco: 10, valor: 1000, taxas: 0, origem: 'b3-negociacao', ...o })
const P = (ativo: string, quantidade: number, valorAtualizado: number): ItemPosicaoB3 => ({ ativo, categoria: 'acoes', quantidade, precoFechamento: 10, valorAtualizado, valorAplicado: null })
const DATA = '2026-09-30'

describe('chave e validação', () => {
  it('a chave ignora acento, caixa e espaços repetidos (como um ticker)', () => {
    expect(chaveDoAtivoManual('  cdb   Banco Ágil ')).toBe('CDB BANCO AGIL')
  })
  it('aceita um ativo completo e um sem valor atual', () => {
    expect(validarAtivoManual({ nome: 'CDB X', quantidade: 1, precoMedio: 100, valorAtual: 110 })).toBeNull()
    expect(validarAtivoManual({ nome: 'CDB X', quantidade: 1, precoMedio: 100, valorAtual: null })).toBeNull()
  })
  it.each([
    [{ nome: '  ', quantidade: 1, precoMedio: 1, valorAtual: null }, 'nome'],
    [{ nome: 'X', quantidade: 0, precoMedio: 1, valorAtual: null }, 'quantidade'],
    [{ nome: 'X', quantidade: -1, precoMedio: 1, valorAtual: null }, 'quantidade'],
    [{ nome: 'X', quantidade: 1, precoMedio: 0, valorAtual: null }, 'preço médio'],
    [{ nome: 'X', quantidade: 1, precoMedio: Number.NaN, valorAtual: null }, 'preço médio'],
    [{ nome: 'X', quantidade: 1, precoMedio: 1, valorAtual: 0 }, 'valor atual'],
  ])('recusa %j', (dados, palavra) => {
    expect(validarAtivoManual(dados)).toContain(palavra)
  })
})

describe('categoriaDaClasse: em que bloco de "Posições" cada classe aparece', () => {
  it('todas as 12 classes têm um bloco', () => {
    for (const c of CLASSES_ESCOLHA) expect(categoriaDaClasse(c)).toBeTruthy()
  })
  it.each([
    ['acoesETFs', 'acoes'], ['fiis', 'fundos'], ['bdrs', 'bdr'], ['fundosInternacionais', 'etf'],
    ['tesouroSelic', 'tesouro'], ['tesouroIPCA', 'tesouro'], ['tesouroPrefixado', 'tesouro'],
    ['cdbLiquidez', 'rendaFixa'], ['lciLca', 'rendaFixa'], ['ouro', 'ouro'], ['cripto', 'cripto'], ['foraDaRegua', 'outra'],
  ] as const)('%s -> %s', (classe, cat) => expect(categoriaDaClasse(classe)).toBe(cat))
})

describe('montarPainel com ativos digitados à mão', () => {
  it('é POSIÇÃO: aparece com preço médio informado, valor atual e resultado, sem nenhum lançamento', () => {
    const p = montarPainel([], null, null, {}, [M()])
    expect(p.linhas[0]).toMatchObject({ ativo: 'CDB BANCO X', manual: true, categoria: 'rendaFixa', quantidade: 1, precoMedio: 10000, origemPrecoMedio: 'informado', custoTotal: 10000, valorAtual: 10500, resultado: 500, resultadoPct: 5, classeManual: 'cdbLiquidez' })
    expect(p.resumo.capitalAplicado).toBe(10000)
  })
  it('sem valor atual: pesa pelo custo, não inventa resultado', () => {
    const p = montarPainel([], [P('VALE3', 10, 100)], DATA, {}, [M({ valorAtual: null })])
    const l = p.linhas.find((x) => x.ativo === 'CDB BANCO X')!
    expect(l).toMatchObject({ valorAtual: null, resultado: null, custoTotal: 10000 })
    expect(p.resumo.patrimonio).toBe(100 + 10000) // o ativo digitado conta pelo custo
  })
  it('com a Posição da B3: soma ao patrimônio e ao resultado, sem mexer nos ativos da B3', () => {
    const p = montarPainel(mesclarLancamentos([], [L()]).lancamentos, [P('VALE3', 100, 1500)], DATA, {}, [M()])
    expect(p.linhas.map((l) => l.ativo).sort()).toEqual(['CDB BANCO X', 'VALE3'])
    expect(p.resumo.patrimonio).toBe(1500 + 10500)
    expect(p.resumo.resultado).toEqual({ valor: 500 + 500, pct: ((500 + 500) / (1000 + 10000)) * 100, cobertura: 1 })
  })
  it('NÃO vira lançamento: o histórico continua só com o que veio dos extratos ou foi lançado como compra', () => {
    const lancs = mesclarLancamentos([], [L()]).lancamentos
    montarPainel(lancs, [P('VALE3', 100, 1500)], DATA, {}, [M()])
    expect(lancs).toHaveLength(1)
  })
  it('um ativo digitado com o mesmo nome de um da B3 substitui a linha calculada (vale o que a pessoa digitou)', () => {
    const p = montarPainel(mesclarLancamentos([], [L()]).lancamentos, [P('VALE3', 100, 1500)], DATA, {}, [M({ ativo: 'VALE3', nome: 'VALE3', quantidade: 50, precoMedio: 20, valorAtual: 1100, classe: 'acoesETFs' })])
    expect(p.linhas).toHaveLength(1)
    expect(p.linhas[0]).toMatchObject({ manual: true, quantidade: 50, precoMedio: 20 })
  })
  it('aparece no agrupamento, no bloco da sua classe, e na composição', () => {
    const p = montarPainel([], [P('VALE3', 10, 1000)], DATA, {}, [M({ valorAtual: 1000 })])
    const grupos = agruparPosicoes(p.linhas)
    expect(grupos.map((g) => g.rotulo).sort()).toEqual(['Ações', 'Renda fixa'])
    expect(composicaoDasLinhas(p.linhas).map((f) => [f.rotulo, f.pct])).toEqual([['Ações', 50], ['Renda fixa', 50]].sort())
  })
})

describe('persistência dos ativos digitados à mão', () => {
  const bruto = (lista: unknown) => JSON.stringify({ versao: VERSAO_CARTEIRA, carteira: { lancamentos: [], excluidas: [], posicao: null, dataPosicao: null, eventosFuturos: [], classes: {}, precosMedios: {}, ativosManuais: lista } })

  it('sobrevivem à gravação', () => {
    const c = { ...carteiraVazia(), ativosManuais: [M(), M({ ativo: 'PETR4', nome: 'PETR4', quantidade: 100, precoMedio: 30, valorAtual: null, classe: 'acoesETFs' })] }
    expect(lerCarteiraSalva(serializarCarteira(c))!.ativosManuais).toEqual(c.ativosManuais)
  })
  it('descarta os inválidos, os repetidos e os de classe inventada', () => {
    const lista = [
      { nome: 'A', quantidade: 1, precoMedio: 1, valorAtual: null, classe: 'fiis' },
      { nome: 'a', quantidade: 2, precoMedio: 2, valorAtual: null, classe: 'fiis' }, // repetido (mesma chave)
      { nome: 'B', quantidade: 0, precoMedio: 1, valorAtual: null, classe: 'fiis' },
      { nome: 'C', quantidade: 1, precoMedio: 1, valorAtual: null, classe: 'inventada' },
      { nome: '', quantidade: 1, precoMedio: 1, valorAtual: null, classe: 'fiis' },
      42, null,
    ]
    expect(lerCarteiraSalva(bruto(lista))!.ativosManuais.map((m) => m.ativo)).toEqual(['A'])
  })
  it('carteira gravada antes deste recurso abre normalmente, sem ativos digitados', () => {
    const antiga = JSON.stringify({ versao: VERSAO_CARTEIRA, carteira: { lancamentos: [], excluidas: [], posicao: null, dataPosicao: null, eventosFuturos: [] } })
    expect(lerCarteiraSalva(antiga)!.ativosManuais).toEqual([])
    expect(lerCarteiraSalva(bruto('texto'))!.ativosManuais).toEqual([])
  })
  it('a categoria nova (renda fixa) também é aceita na Posição gravada', () => {
    const c = { ...carteiraVazia(), posicao: [{ ativo: 'X', categoria: 'rendaFixa' as const, quantidade: 1, precoFechamento: null, valorAtualizado: 1, valorAplicado: null }] }
    expect(lerCarteiraSalva(serializarCarteira(c))!.posicao).toHaveLength(1)
  })
})

describe('vencimento e taxa do ativo digitado', () => {
  const ok = { nome: 'CRI A', quantidade: 1, precoMedio: 100, valorAtual: null }
  it('validam: data real no calendário e taxa curta; sem eles, tudo certo', () => {
    expect(validarAtivoManual(ok)).toBeNull()
    expect(validarAtivoManual({ ...ok, vencimento: '2031-03-15', taxa: 'IPCA + 7,5% a.a.' })).toBeNull()
    expect(validarAtivoManual({ ...ok, vencimento: '2031-02-30' })).toMatch(/vencimento/)
    expect(validarAtivoManual({ ...ok, vencimento: '15/03/2031' })).toMatch(/vencimento/)
    expect(validarAtivoManual({ ...ok, taxa: 'x'.repeat(61) })).toMatch(/taxa/i)
  })
  it('sobrevivem à gravação e aparecem na linha da posição', () => {
    const m = { ...M(), tipo: 'cri', classe: 'lciLca' as const, vencimento: '2031-03-15', taxa: 'IPCA + 7,5% a.a.' }
    const c = { ...carteiraVazia(), ativosManuais: [m] }
    const lido = lerCarteiraSalva(serializarCarteira(c))!.ativosManuais
    expect(lido).toEqual([m])
    const p = montarPainel([], null, null, {}, lido)
    expect(p.linhas[0]).toMatchObject({ vencimentoManual: '2031-03-15', taxaManual: 'IPCA + 7,5% a.a.', tipoManual: 'cri' })
  })
  it('lendo do aparelho, descarta vencimento inválido e taxa comprida demais, mas mantém o ativo', () => {
    const bruto = JSON.stringify({ versao: VERSAO_CARTEIRA, carteira: { lancamentos: [], excluidas: [], posicao: null, dataPosicao: null, eventosFuturos: [], classes: {}, precosMedios: {}, ativosManuais: [{ nome: 'A', quantidade: 1, precoMedio: 1, valorAtual: null, classe: 'fiis', vencimento: '2031-13-45', taxa: 'x'.repeat(200) }] } })
    const [a] = lerCarteiraSalva(bruto)!.ativosManuais
    expect(a.ativo).toBe('A')
    expect(a.vencimento).toBeUndefined()
    expect(a.taxa).toBeUndefined()
  })
})
