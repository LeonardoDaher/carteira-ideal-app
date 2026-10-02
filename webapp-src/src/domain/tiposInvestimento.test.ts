import { describe, expect, it } from 'vitest'
import { categoriaDoManual } from './ativosManuais'
import { ehClasseValida } from './classesDaCarteira'
import { ROTULOS_CATEGORIA } from './painelCarteira'
import { buscarTipos, GRUPOS_TIPO, TIPOS_INVESTIMENTO, tipoPorId, tiposDaCategoria } from './tiposInvestimento'

describe('catálogo de tipos de investimento', () => {
  it('ids únicos, classe válida (ou nenhuma), bloco de Posições com rótulo e grupo existente', () => {
    const ids = TIPOS_INVESTIMENTO.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of TIPOS_INVESTIMENTO) {
      expect(t.classe === null || ehClasseValida(t.classe)).toBe(true)
      expect(ROTULOS_CATEGORIA[t.categoria]).toBeTruthy()
      expect(GRUPOS_TIPO.some((g) => g.id === t.grupo)).toBe(true)
      expect(t.exemplo.length).toBeGreaterThan(0)
    }
  })
  it('traz o que o mercado oferece: CRI, CRA, fundos de renda fixa e DI, debênture, previdência, Tesouro, bolsa', () => {
    const rotulos = TIPOS_INVESTIMENTO.map((t) => t.rotulo)
    for (const esperado of ['CRI', 'CRA', 'Fundo de renda fixa', 'Fundo DI / Referenciado DI', 'Debênture', 'PGBL', 'VGBL', 'Tesouro Selic', 'LCI / LCA', 'FIIs e Fiagro', 'Ações e units', 'Criptomoedas', 'Ouro']) {
      expect(rotulos).toContain(esperado)
    }
  })
  it('só "Outro investimento" deixa a classe para a pessoa', () => {
    expect(TIPOS_INVESTIMENTO.filter((t) => t.classe === null).map((t) => t.id)).toEqual(['outro'])
  })
  it('o que não existe na carteira sugerida é ALOCADO na classe mais parecida, com a observação que aparece embaixo da classe', () => {
    for (const id of ['cri', 'cra']) {
      expect(tipoPorId(id)).toMatchObject({ classe: 'lciLca' })
      expect(tipoPorId(id)!.equivalencia).toMatch(/LCI \/ LCA/)
    }
    // só CRI e CRA entram em LCI / LCA; os demais papéis de crédito e fundos de renda fixa ficam fora da comparação
    for (const id of ['cdb', 'lc', 'debenture', 'fundo-credito', 'fundo-rf']) {
      expect(tipoPorId(id)!.classe).toBe('foraDaRegua')
      expect(tipoPorId(id)!.equivalencia).toBeUndefined()
    }
    expect(TIPOS_INVESTIMENTO.filter((t) => t.classe === 'lciLca').map((t) => t.id).sort()).toEqual(['cra', 'cri', 'lci-lca'])
    expect(tipoPorId('fundo-di')).toMatchObject({ classe: 'tesouroSelic' })
    expect(tipoPorId('poupanca')).toMatchObject({ classe: 'cdbLiquidez' })
    // toda classe que não é a "própria" do tipo traz a observação
    for (const t of TIPOS_INVESTIMENTO.filter((x) => ['cri', 'cra', 'fundo-di', 'fundo-multi', 'poupanca'].includes(x.id))) {
      expect(t.equivalencia, t.id).toBeTruthy()
    }
  })
  it('multimercado é repartido como a carteira sugerida trata multimercados (40% FIIs, 20% Ouro, 20% BDRs, 20% Internacionais)', () => {
    const d = tipoPorId('fundo-multi')!.distribuicao!
    expect(d).toEqual({ fiis: 0.4, ouro: 0.2, bdrs: 0.2, fundosInternacionais: 0.2 })
    expect(Object.values(d).reduce((s, x) => s + (x ?? 0), 0)).toBeCloseTo(1, 10)
  })
  it('ficam fora da régua: previdência, COE, CDB com prazo, LC, debênture, fundo de crédito e fundo de renda fixa', () => {
    const fora = TIPOS_INVESTIMENTO.filter((t) => t.classe === 'foraDaRegua' && !t.distribuicao).map((t) => t.id)
    expect(fora.sort()).toEqual(['cdb', 'coe', 'debenture', 'fundo-credito', 'fundo-rf', 'lc', 'pgbl', 'vgbl'])
  })
  it('vencimento na renda fixa e no COE; taxa na renda fixa, nos fundos e na previdência; bolsa não tem nenhum dos dois', () => {
    for (const id of ['tesouro-selic', 'cdb', 'lci-lca', 'cri', 'cra', 'debenture', 'coe']) expect(tipoPorId(id)!.vencimento, id).toBe(true)
    for (const id of ['cdb', 'cri', 'fundo-di', 'fundo-rf', 'pgbl', 'vgbl']) expect(tipoPorId(id)!.taxaExemplo, id).toBeTruthy()
    for (const id of ['acao', 'fii', 'etf', 'bdr', 'ouro', 'cripto']) {
      expect(tipoPorId(id)!.vencimento).toBeFalsy()
      expect(tipoPorId(id)!.taxaExemplo).toBeFalsy()
    }
  })
  it('busca sem acento e em qualquer parte do nome ou da descrição', () => {
    expect(buscarTipos('debenture').map((t) => t.id)).toContain('debenture')
    expect(buscarTipos('previdencia').map((t) => t.id)).toEqual(expect.arrayContaining(['pgbl', 'vgbl']))
    expect(buscarTipos('xyz-nada')).toEqual([])
    expect(buscarTipos('')).toHaveLength(TIPOS_INVESTIMENTO.length)
  })
  it('tiposDaCategoria: o que cabe em cada bloco de Posições', () => {
    expect(tiposDaCategoria('acoes').map((t) => t.id)).toEqual(['acao'])
    expect(tiposDaCategoria('rendaFixa').map((t) => t.id)).toEqual(expect.arrayContaining(['cdb', 'cri', 'cra', 'lci-lca']))
    expect(tiposDaCategoria('fundosInvest').length).toBeGreaterThan(3)
  })
  it('categoriaDoManual: o tipo manda; sem tipo (ativo antigo), vale a classe', () => {
    expect(categoriaDoManual({ classe: 'foraDaRegua', tipo: 'cri' })).toBe('rendaFixa')
    expect(categoriaDoManual({ classe: 'foraDaRegua', tipo: 'pgbl' })).toBe('previdencia')
    expect(categoriaDoManual({ classe: 'tesouroSelic', tipo: 'fundo-di' })).toBe('fundosInvest')
    expect(categoriaDoManual({ classe: 'cdbLiquidez' })).toBe('rendaFixa')
    expect(categoriaDoManual({ classe: 'cdbLiquidez', tipo: 'id-que-nao-existe' })).toBe('rendaFixa')
    expect(categoriaDoManual({ classe: 'lciLca', tipo: 'outro' })).toBe('rendaFixa') // "Outro" segue a classe escolhida
  })
})
