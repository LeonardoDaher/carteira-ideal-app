import { describe, expect, it } from 'vitest'
import { analisarConfluencia, PESOS_POR_HORIZONTE, posturaFundamentalista, posturaTecnica } from './confluencia'
import type { AnaliseFundamentalista, CategoriaAnalise } from './analiseFundamentalista'
import type { AnaliseTecnica, Viés, ZonaPreco } from './analiseTecnica'

function fundamentos(categoria: CategoriaAnalise, extra: { total?: number | null; ms?: number | null; entrada?: number | null; confianca?: 'alta' | 'media' | 'baixa'; dados?: boolean; preco?: number } = {}): AnaliseFundamentalista {
  const aplicavel = extra.ms !== null && extra.ms !== undefined
  return {
    ticker: 'TESTE3',
    categoria,
    pontuacao: { total: extra.total === undefined ? 70 : extra.total, parcial: false },
    valorJusto: {
      aplicavel,
      margemSegurancaPct: extra.ms ?? null,
      precoEntrada: extra.entrada === undefined ? 7.5 : extra.entrada,
      confianca: extra.confianca ?? 'alta',
    },
    mercado: { preco: extra.preco ?? 10 },
    alertas: extra.dados ? [{ id: 'dados', titulo: 'Dados', detalhe: '', gravidade: 'critico' }] : [],
    recomendacao: { categoria: 'manter-acompanhar', justificativa: [], reavaliar: ['Piora de margens nos próximos balanços.'] },
    dados: { ultimoTrimestre: '2026-06-30' },
  } as unknown as AnaliseFundamentalista
}

function tecnica(vies: Viés, extra: { total?: number; semSinal?: boolean; preco?: number; zonas?: Partial<ZonaPreco>[]; liquidez?: 'alta' | 'baixa'; confianca?: 'alta' | 'media' | 'baixa'; saltos?: number } = {}): AnaliseTecnica {
  return {
    ticker: 'TESTE3',
    preco: extra.preco ?? 10,
    pontuacao: { total: extra.total ?? 60, vies, componentes: [] },
    confianca: { nivel: extra.confianca ?? 'alta', valor: 80, motivos: [] },
    conclusao: { vies, semSinal: extra.semSinal ?? false, resumo: '', favoraveis: [], desfavoraveis: [], monitorar: ['Fechamento acima de R$ 11,00.'] },
    zonas: extra.zonas ?? [
      { tipo: 'suporte', inferior: 8.8, superior: 9.2, distanciaPct: -10 },
      { tipo: 'resistencia', inferior: 11, superior: 11.4, distanciaPct: 12 },
    ],
    volume: { liquidez: extra.liquidez ?? 'alta' },
    qualidade: { saltosNaoConfirmados: Array(extra.saltos ?? 0).fill({ data: '2026-01-01', de: 1, para: 2 }) },
  } as unknown as AnaliseTecnica
}

describe('posturas', () => {
  it('fundamentalista: atrativa e com ressalvas são favoráveis; pouco atrativa e evitar são desfavoráveis; neutra é neutra', () => {
    const p = (c: CategoriaAnalise) => posturaFundamentalista(fundamentos(c)).postura
    expect(p('atrativa')).toBe('favoravel')
    expect(p('atrativa-com-ressalvas')).toBe('favoravel')
    expect(p('neutra')).toBe('neutra')
    expect(p('pouco-atrativa')).toBe('desfavoravel')
    expect(p('evitar')).toBe('desfavoravel')
  })

  it('fundamentalista: problema de dados é "indisponível", nunca desfavorável', () => {
    expect(posturaFundamentalista(fundamentos('neutra', { dados: true })).postura).toBe('indisponivel')
    expect(posturaFundamentalista(fundamentos('neutra', { total: null })).postura).toBe('indisponivel')
    expect(posturaFundamentalista(null).postura).toBe('indisponivel')
  })

  it('técnica: viés altista é favorável, baixista é desfavorável e sem sinal é neutra', () => {
    expect(posturaTecnica(tecnica('altista')).postura).toBe('favoravel')
    expect(posturaTecnica(tecnica('moderadamente-altista')).postura).toBe('favoravel')
    expect(posturaTecnica(tecnica('baixista')).postura).toBe('desfavoravel')
    expect(posturaTecnica(tecnica('moderadamente-baixista')).postura).toBe('desfavoravel')
    expect(posturaTecnica(tecnica('neutro')).postura).toBe('neutra')
    expect(posturaTecnica(tecnica('altista', { semSinal: true })).postura).toBe('neutra')
    expect(posturaTecnica(null).postura).toBe('indisponivel')
  })
})

describe('quadro de confluência', () => {
  const casos: [CategoriaAnalise, Viés, string][] = [
    ['atrativa', 'altista', 'confluencia-positiva'],
    ['atrativa', 'neutro', 'fundamento-favoravel-grafico-neutro'],
    ['atrativa', 'baixista', 'fundamento-favoravel-grafico-contra'],
    ['neutra', 'altista', 'grafico-favoravel-fundamento-neutro'],
    ['neutra', 'neutro', 'sem-direcao'],
    ['neutra', 'baixista', 'grafico-desfavoravel-fundamento-neutro'],
    ['evitar', 'altista', 'grafico-favoravel-fundamento-contra'],
    ['evitar', 'neutro', 'fundamento-desfavoravel-grafico-neutro'],
    ['evitar', 'baixista', 'confluencia-negativa'],
  ]
  it.each(casos)('fundamentos %s + gráfico %s => %s', (cat, vies, esperado) => {
    const c = analisarConfluencia({ ticker: 'TESTE3', fundamentalista: fundamentos(cat), tecnica: tecnica(vies) })
    expect(c.situacao).toBe(esperado)
    expect(c.titulo.length).toBeGreaterThan(5)
    expect(c.leitura.length).toBeGreaterThan(40)
  })

  it('sem uma das análises, a confluência é "incompleta" e não inventa pontuação', () => {
    const semTec = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa'), tecnica: null })
    expect(semTec.situacao).toBe('incompleta')
    expect(semTec.pontuacao.valor).toBeNull()
    expect(semTec.conviccao).toBe('baixa')
    expect(semTec.leitura).toMatch(/não pode ser avaliada/)
    const semFun = analisarConfluencia({ ticker: 'X', fundamentalista: null, tecnica: tecnica('altista') })
    expect(semFun.situacao).toBe('incompleta')
  })
})

describe('pontuação combinada e horizonte', () => {
  it('pesos por horizonte: longo prazo pesa os fundamentos; curto pesa o gráfico', () => {
    expect(PESOS_POR_HORIZONTE.longo.fundamentalista).toBeGreaterThan(PESOS_POR_HORIZONTE.longo.tecnica)
    expect(PESOS_POR_HORIZONTE.curto.tecnica).toBeGreaterThan(PESOS_POR_HORIZONTE.curto.fundamentalista)
    for (const h of Object.values(PESOS_POR_HORIZONTE)) expect(h.fundamentalista + h.tecnica).toBeCloseTo(1, 10)
  })

  it('a nota combinada é a média ponderada das duas', () => {
    const f = fundamentos('atrativa', { total: 80 })
    const t = tecnica('altista', { total: 40 })
    const curto = analisarConfluencia({ ticker: 'X', fundamentalista: f, tecnica: t, horizonte: 'curto' })
    const longo = analisarConfluencia({ ticker: 'X', fundamentalista: f, tecnica: t, horizonte: 'longo' })
    expect(curto.pontuacao.valor).toBe(Math.round(80 * 0.3 + 40 * 0.7))
    expect(longo.pontuacao.valor).toBe(Math.round(80 * 0.7 + 40 * 0.3))
    expect(longo.pontuacao.valor as number).toBeGreaterThan(curto.pontuacao.valor as number)
  })
})

describe('convicção', () => {
  it('alta só quando as duas apontam para o mesmo lado e os dados são bons', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 30 }), tecnica: tecnica('altista') })
    expect(c.conviccao).toBe('alta')
  })

  it('baixa quando as leituras são opostas', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 30 }), tecnica: tecnica('baixista') })
    expect(c.conviccao).toBe('baixa')
    expect(c.conviccaoMotivos.join(' ')).toMatch(/opostas/)
  })

  it('não é alta se a confiança técnica ou a do valor justo é baixa', () => {
    expect(analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 30 }), tecnica: tecnica('altista', { confianca: 'baixa' }) }).conviccao).not.toBe('alta')
    expect(analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 30, confianca: 'baixa' }), tecnica: tecnica('altista') }).conviccao).not.toBe('alta')
  })

  it('média quando uma das leituras é neutra', () => {
    expect(analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 30 }), tecnica: tecnica('neutro') }).conviccao).toBe('media')
  })
})

describe('convergência de preço', () => {
  it('o preço de entrada pelos fundamentos dentro do suporte técnico é uma confluência de preço', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 10, entrada: 9.0 }), tecnica: tecnica('altista') })
    expect(c.preco.relacao).toBe('coincide')
    expect(c.preco.texto).toMatch(/coincide com o suporte técnico/)
    expect(c.leitura).toMatch(/fundamentos e gráfico se encontram/)
  })

  it('preço de entrada abaixo do suporte exige perder o suporte', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 10, entrada: 7.0 }), tecnica: tecnica('altista') })
    expect(c.preco.relacao).toBe('abaixo-do-suporte')
    expect(c.preco.texto).toMatch(/perder esse suporte/)
  })

  it('preço de entrada entre o suporte e o preço atual', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 10, entrada: 9.6 }), tecnica: tecnica('altista') })
    expect(c.preco.relacao).toBe('acima-do-suporte')
  })

  it('preço atual já abaixo do preço de entrada', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 40, entrada: 12 }), tecnica: tecnica('altista', { preco: 10 }) })
    expect(c.preco.relacao).toBe('abaixo-do-preco-atual')
  })

  it('sem valor justo, não compara preços', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('neutra', { ms: null }), tecnica: tecnica('altista') })
    expect(c.preco.relacao).toBe('indisponivel')
    expect(c.preco.precoEntradaFundamentalista).toBeNull()
  })
})

describe('condições e riscos de interpretação', () => {
  it('fundamentos bons com gráfico fraco: pede confirmação pela resistência mais próxima', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 30 }), tecnica: tecnica('neutro') })
    expect(c.condicoes.join(' ')).toMatch(/resistência mais próxima/)
  })

  it('gráfico forte com fundamentos fracos: avisa qual suporte sustenta a alta', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('evitar'), tecnica: tecnica('altista') })
    expect(c.condicoes.join(' ')).toMatch(/suporte mais próximo/)
  })

  it('lista riscos de interpretação: liquidez, salto de preço, valor justo frágil e o aviso de que não é recomendação', () => {
    const c = analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos('atrativa', { ms: 30, confianca: 'baixa' }), tecnica: tecnica('altista', { liquidez: 'baixa', saltos: 1 }) })
    const r = c.riscosDeInterpretacao.join(' ')
    expect(r).toMatch(/Liquidez baixa/)
    expect(r).toMatch(/salto de preço/)
    expect(r).toMatch(/baixa confiança/)
    expect(r).toMatch(/Não é recomendação/)
    expect(r).toMatch(/30\/06\/2026/)
  })

  it('sem linguagem de promessa', () => {
    for (const cat of ['atrativa', 'neutra', 'evitar'] as CategoriaAnalise[]) {
      for (const v of ['altista', 'neutro', 'baixista'] as Viés[]) {
        const t = JSON.stringify(analisarConfluencia({ ticker: 'X', fundamentalista: fundamentos(cat, { ms: 20 }), tecnica: tecnica(v) }))
        expect(t).not.toMatch(/garant|certeza|vai subir|vai cair|compre agora|venda agora/i)
      }
    }
  })
})
