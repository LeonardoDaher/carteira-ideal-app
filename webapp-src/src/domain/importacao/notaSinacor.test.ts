// @vitest-environment node
// (o pdf.js não reconhece o ArrayBuffer do jsdom; ver pdf.test.ts)
import { beforeAll, describe, expect, it } from 'vitest'
import { PDF_NOTA_MISTA_899 } from './__fixtures__/notaMistaSintetica'
import { PDF_NOTA_899 } from './__fixtures__/notaSintetica'
import { base64ParaArrayBuffer } from './__fixtures__/xlsxSinteticos'
import {
  NotaNaoReconhecidaError,
  chaveNomePregao,
  combinarResolvedores,
  lerNotaSinacor,
  notaParaLancamentos,
  ratearCentavos,
  resolverPorCruzamento,
  resolverPorTabela,
  separarEspecificacao,
  type NotaConvertida,
  type NotaNegociacao,
} from './notaSinacor'
import { importarNotaPdf } from './index'
import { SenhaIncorretaError, lerLinhasPdf, type LinhaPdf } from './pdf'

let linhas: LinhaPdf[]
let linhasMista: LinhaPdf[]
let nota: NotaNegociacao
beforeAll(async () => {
  linhas = await lerLinhasPdf(base64ParaArrayBuffer(PDF_NOTA_899), '899')
  nota = lerNotaSinacor(linhas)
  linhasMista = await lerLinhasPdf(base64ParaArrayBuffer(PDF_NOTA_MISTA_899), '899')
})

const tabela = new Map([
  [chaveNomePregao('CSNMINERACAO', 'ON N2'), 'CMIN3'],
  [chaveNomePregao('ITAUUNIBANCO', 'PN N1'), 'ITUB4'],
  [chaveNomePregao('VALE', 'ON NM'), 'VALE3'],
])

describe('lerNotaSinacor: do PDF com senha aos negócios', () => {
  it('lê os 5 negócios, com lado, mercado, quantidade, preço, valor e D/C', () => {
    expect(nota.negocios).toHaveLength(5)
    expect(nota.negocios.map((n) => `${n.compraVenda} ${n.mercado} ${n.quantidade}x${n.preco}=${n.valor}${n.debitoCredito}`)).toEqual([
      'C VISTA 200x5=1000D',
      'C VISTA 10x18.5=185D',
      'C VISTA 5x18.5=92.5D',
      'V VISTA 100x30=3000C',
      'C FRACIONARIO 20x70=1400D',
    ])
  })
  it('fundos trazem o ticker na especificação; ações trazem só o nome de pregão e a espécie', () => {
    expect(nota.negocios.map((n) => n.ticker)).toEqual([null, 'HGBS11', 'HGBS11', null, null])
    expect(nota.negocios[0]).toMatchObject({ nome: 'CSNMINERACAO', especie: 'ON N2' })
    expect(nota.negocios[3]).toMatchObject({ nome: 'ITAUUNIBANCO', especie: 'PN N1' })
    expect(nota.negocios[4]).toMatchObject({ nome: 'VALE', especie: 'ON NM' })
  })
  it('separa a coluna Obs. da especificação', () => {
    expect(nota.negocios[0].observacoes).toBe('@#')
    expect(nota.negocios[3].observacoes).toBe('@')
    expect(nota.negocios[1].especificacao).toBe('FII HEDGEBS HGBS11 CI')
  })
  it('as duas execuções de HGBS11 ficam separadas (a B3 as agrega num negócio só)', () => {
    expect(nota.negocios.filter((n) => n.ticker === 'HGBS11').map((n) => n.quantidade)).toEqual([10, 5])
  })

  it('lê o resumo financeiro, separando a caixa da esquerda da caixa da direita', () => {
    expect(nota.resumo.comprasAVista).toBe(2677.5)
    expect(nota.resumo.vendasAVista).toBe(3000)
    expect(nota.resumo.valorLiquidoOperacoes).toEqual({ valor: 322.5, dc: 'C' })
    expect(nota.resumo.taxaLiquidacao).toEqual({ valor: 1.56, dc: 'D' })
    expect(nota.resumo.emolumentos).toEqual({ valor: 0.3, dc: 'D' })
    expect(nota.resumo.taxaTransfAtivos).toEqual({ valor: 0.12, dc: 'D' })
    expect(nota.resumo.irrf).toEqual({ valor: 0.15, dc: 'D' })
    expect(nota.resumo.liquido).toEqual({ valor: 320.37, dc: 'C' })
    expect(nota.resumo.dataLiquidacao).toBe('2026-10-02')
  })
  it('lê o número da nota e a data do pregão do cabeçalho', () => {
    expect(nota.numero).toBe('987654321')
    expect(nota.dataPregao).toBe('2026-09-30')
    expect(nota.origemDataPregao).toBe('cabecalho')
  })
  it('PRIVACIDADE: nenhum dado pessoal do cabeçalho (nome, CPF, endereço, conta) é lido ou devolvido', () => {
    const tudo = JSON.stringify(nota)
    for (const pessoal of ['CLIENTE EXEMPLO', '000.000.000-00', 'RUA FICTICIA', '11111111', 'CORRETORA FICTICIA', '00.000.000/0001-00']) {
      expect(tudo).not.toContain(pessoal)
    }
    // e a conversão em lançamentos também não carrega nada disso
    expect(JSON.stringify(notaParaLancamentos(nota, resolverPorTabela(tabela)))).not.toContain('000.000.000-00')
  })
  it('o valor lido sob "Nr. nota" é o da própria caixa, não o da "Folha" nem o do CPF logo abaixo', () => {
    expect(nota.numero).toBe('987654321')
    expect(nota.dataPregao).toBe('2026-09-30')
  })
  it('as contas da própria nota fecham: conferida', () => {
    expect(nota.verificacoes.map((v) => v.nome)).toEqual([
      'Compras à vista',
      'Vendas à vista',
      'Opções - compras',
      'Opções - vendas',
      'Valor líquido das operações',
      'Líquido da nota',
    ])
    expect(nota.verificacoes.every((v) => v.ok)).toBe(true)
    expect(nota.conferida).toBe(true)
  })
})

describe('autoverificação: recusa leitura cujas contas não fecham', () => {
  const adulterar = (f: (l: LinhaPdf) => void): NotaNegociacao => {
    const copia: LinhaPdf[] = JSON.parse(JSON.stringify(linhas))
    copia.forEach(f)
    return lerNotaSinacor(copia)
  }
  it('um valor de negócio lido errado derruba a conferência', () => {
    const n = adulterar((l) => l.celulas.forEach((c) => { if (c.texto === '1.000,00') c.texto = '1.100,00' }))
    expect(n.conferida).toBe(false)
    expect(n.verificacoes.some((v) => !v.ok)).toBe(true)
  })
  it('um custo lido errado derruba a conferência do líquido', () => {
    const n = adulterar((l) => l.celulas.forEach((c) => { if (c.texto === '0,30 D') c.texto = '0,90 D' }))
    expect(n.verificacoes.find((v) => v.nome === 'Líquido da nota')!.ok).toBe(false)
    expect(n.conferida).toBe(false)
  })
  it('nota não conferida NÃO vira lançamento e explica por quê', () => {
    const n = adulterar((l) => l.celulas.forEach((c) => { if (c.texto === '1.000,00') c.texto = '1.100,00' }))
    const r = notaParaLancamentos(n, resolverPorTabela(tabela))
    expect(r.lancamentos).toEqual([])
    expect(r.avisos[0]).toContain('não passou na conferência')
  })
  it('PDF sem a tabela de negócios: erro específico', () => {
    expect(() => lerNotaSinacor([{ pagina: 1, y: 700, celulas: [{ x: 10, xFim: 80, texto: 'Extrato qualquer' }], texto: 'Extrato qualquer' }])).toThrow(NotaNaoReconhecidaError)
  })
  it('sem o Resumo Financeiro não há como conferir: não é "conferida"', () => {
    const semResumo = linhas.slice(0, linhas.findIndex((l) => l.texto.includes('Resumo dos Neg')))
    const n = lerNotaSinacor(semResumo)
    expect(n.conferida).toBe(false)
    expect(n.avisos.some((a) => a.includes('Resumo Financeiro'))).toBe(true)
  })
  it('tolera valor e D/C em células separadas ou fundidas', () => {
    // desfaz a fusão "322,50 C" -> ["322,50", "C"] e confere que o resultado é o mesmo
    const separado: LinhaPdf[] = JSON.parse(JSON.stringify(linhas))
    for (const l of separado) {
      l.celulas = l.celulas.flatMap((c) => {
        const m = c.texto.match(/^(\d[\d.]*,\d{2}) ([DC])$/)
        return m ? [{ x: c.x, xFim: c.xFim - 6, texto: m[1] }, { x: c.xFim - 5, xFim: c.xFim, texto: m[2] }] : [c]
      })
    }
    const n = lerNotaSinacor(separado)
    expect(n.conferida).toBe(true)
    expect(n.resumo.liquido).toEqual({ valor: 320.37, dc: 'C' })
  })
})

describe('data do pregão', () => {
  it('sem o cabeçalho, deduz da liquidação (−2 dias úteis) e AVISA', () => {
    const semCab = linhas.filter((l) => !l.texto.includes('Data preg') && !l.texto.includes('30/09/2026'))
    const n = lerNotaSinacor(semCab)
    expect(n.origemDataPregao).toBe('deduzida')
    expect(n.dataPregao).toBe('2026-09-30')
    expect(n.avisos.some((a) => a.includes('deduzida') && a.includes('feriado'))).toBe(true)
  })
})

describe('notaParaLancamentos', () => {
  let r: NotaConvertida
  beforeAll(() => {
    r = notaParaLancamentos(nota, resolverPorTabela(tabela))
  })
  it('converte tudo, resolvendo o ticker das ações pela tabela de nomes de pregão', () => {
    expect(r.pendentes).toEqual([])
    expect(r.lancamentos.map((l) => `${l.tipo} ${l.ativo} ${l.quantidade}@${l.preco}`)).toEqual([
      'compra CMIN3 200@5',
      'compra HGBS11 10@18.5',
      'compra HGBS11 5@18.5',
      'venda ITUB4 100@30',
      'compra VALE3 20@70', // fracionário: o ticker é o do lote padrão
    ])
    expect(r.lancamentos.every((l) => l.origem === 'b3-nota' && l.data === '2026-09-30')).toBe(true)
  })
  it('rateia as taxas (liquidação + emolumentos + transf. de ativos = 1,98) por valor, sem perder centavo', () => {
    const taxas = r.lancamentos.map((l) => l.taxas)
    expect(Math.round(taxas.reduce((s, t) => s + t, 0) * 100)).toBe(198)
    // proporcional ao valor: o negócio de R$ 3.000 paga mais que o de R$ 92,50
    expect(r.lancamentos[3].taxas).toBeGreaterThan(r.lancamentos[0].taxas)
    expect(r.lancamentos[2].taxas).toBeLessThan(r.lancamentos[1].taxas)
  })
  it('o IRRF é imposto retido, não custo de aquisição: fica de fora do rateio', () => {
    const totalTaxas = r.lancamentos.reduce((s, l) => s + l.taxas, 0)
    expect(totalTaxas).toBeCloseTo(1.98, 8)
    expect(totalTaxas).not.toBeCloseTo(2.13, 2)
  })
  it('sem resolvedor, só os fundos entram; as ações ficam pendentes para a pessoa escolher', () => {
    const sem = notaParaLancamentos(nota)
    expect(sem.lancamentos.map((l) => l.ativo)).toEqual(['HGBS11', 'HGBS11'])
    expect(sem.pendentes.map((p) => p.nome)).toEqual(['CSNMINERACAO', 'ITAUUNIBANCO', 'VALE'])
    expect(sem.avisos[0]).toContain('3 negócio(s) sem ticker')
  })
})

describe('resolvedores de ticker', () => {
  it('por cruzamento com a Negociação importada do mesmo dia (a B3 agrega as execuções)', () => {
    const existentes = [
      { data: '2026-09-30', tipo: 'compra', ativo: 'CMIN3', quantidade: 200, preco: 5 },
      { data: '2026-09-30', tipo: 'venda', ativo: 'ITUB4', quantidade: 100, preco: 30 },
      { data: '2026-09-30', tipo: 'compra', ativo: 'VALE3', quantidade: 20, preco: 70 },
      { data: '2026-09-29', tipo: 'compra', ativo: 'OUTR3', quantidade: 200, preco: 5 }, // outro dia: ignorado
    ]
    const r = notaParaLancamentos(nota, resolverPorCruzamento(existentes))
    expect(r.pendentes).toEqual([])
    expect(r.lancamentos.map((l) => l.ativo)).toEqual(['CMIN3', 'HGBS11', 'HGBS11', 'ITUB4', 'VALE3'])
  })
  it('ambíguo (dois ativos com mesmo preço e quantidade) não é adivinhado', () => {
    const existentes = [
      { data: '2026-09-30', tipo: 'compra', ativo: 'AAAA3', quantidade: 200, preco: 5 },
      { data: '2026-09-30', tipo: 'compra', ativo: 'BBBB3', quantidade: 300, preco: 5 },
    ]
    const r = notaParaLancamentos(nota, resolverPorCruzamento(existentes))
    expect(r.pendentes.map((p) => p.nome)).toContain('CSNMINERACAO')
  })
  it('combinar: a tabela tem prioridade; o cruzamento cobre o que ela não conhece', () => {
    const soCsn = new Map([[chaveNomePregao('CSNMINERACAO', 'ON N2'), 'CMIN3']])
    const cruz = resolverPorCruzamento([{ data: '2026-09-30', tipo: 'venda', ativo: 'ITUB4', quantidade: 100, preco: 30 }])
    const r = notaParaLancamentos(nota, combinarResolvedores(resolverPorTabela(soCsn), cruz))
    expect(r.lancamentos.map((l) => l.ativo)).toEqual(['CMIN3', 'HGBS11', 'HGBS11', 'ITUB4'])
    expect(r.pendentes.map((p) => p.nome)).toEqual(['VALE'])
  })
})

describe('day trade e ratearCentavos', () => {
  it('negócio marcado como day trade (D na coluna Obs.) gera aviso', () => {
    const copia: LinhaPdf[] = JSON.parse(JSON.stringify(linhas))
    for (const l of copia) for (const c of l.celulas) if (c.texto === '@') { c.texto = 'D'; break }
    expect(lerNotaSinacor(copia).avisos.some((a) => a.includes('day trade'))).toBe(true)
  })
  it('rateio fecha exatamente em centavos', () => {
    const r = ratearCentavos(1.98, [1000, 185, 92.5, 3000, 1400])
    expect(Math.round(r.reduce((s, x) => s + x, 0) * 100)).toBe(198)
    expect(ratearCentavos(0.01, [1, 1, 1]).reduce((s, x) => s + x, 0)).toBeCloseTo(0.01, 8)
  })
  it('sem custo ou sem peso devolve zeros', () => {
    expect(ratearCentavos(0, [1, 2])).toEqual([0, 0])
    expect(ratearCentavos(5, [0, 0])).toEqual([0, 0])
  })
  it('separarEspecificacao', () => {
    expect(separarEspecificacao('CSNMINERACAO ON N2')).toEqual({ nome: 'CSNMINERACAO', especie: 'ON N2', ticker: null })
    expect(separarEspecificacao('FII HEDGEBS HGBS11 CI')).toEqual({ nome: 'FII HEDGEBS', especie: 'CI', ticker: 'HGBS11' })
    expect(separarEspecificacao('ITAUUNIBANCO PN N1').especie).toBe('PN N1')
  })
})

describe('importarNotaPdf: do arquivo aos lançamentos', () => {
  it('abre com a senha, confere e converte', async () => {
    const r = await importarNotaPdf(base64ParaArrayBuffer(PDF_NOTA_899), '899', resolverPorTabela(tabela))
    expect(r.nota.conferida).toBe(true)
    expect(r.lancamentos).toHaveLength(5)
    expect(r.pendentes).toEqual([])
  })
  it('senha errada: lança o erro específico e não devolve nada', async () => {
    await expect(importarNotaPdf(base64ParaArrayBuffer(PDF_NOTA_899), '123')).rejects.toBeInstanceOf(SenhaIncorretaError)
  })
})

describe('nota MISTA: opções, unit, BDR, direito de subscrição (layouts de notas reais, dados fictícios)', () => {
  let mista: NotaNegociacao
  beforeAll(async () => {
    mista = lerNotaSinacor(await lerLinhasPdf(base64ParaArrayBuffer(PDF_NOTA_MISTA_899), '899'))
  })

  it('lê as 9 linhas e classifica o mercado de cada uma', () => {
    expect(mista.negocios).toHaveLength(9)
    expect(mista.negocios.map((n) => n.categoria)).toEqual(['vista', 'vista', 'vista', 'vista', 'vista', 'vista', 'opcao', 'opcao', 'vista'])
    expect(mista.negocios[6].mercado).toBe('OPCAO DE VENDA')
  })
  it('o prazo mensal da opção ("08/26") não vaza para a especificação do título', () => {
    expect(mista.negocios[6].especificacao).toBe('MGLUT430 ON 4,31 MGLUE')
    expect(mista.negocios[6].especificacao).not.toContain('08/26')
  })
  it('obs. "#" sozinha é lida como observação, não como parte do título', () => {
    expect(mista.negocios[6].observacoes).toBe('#')
  })
  it('as contas fecham por mercado: à vista e opções são conferidos separadamente, e o caixa inclui os prêmios', () => {
    const v = (nome: string) => mista.verificacoes.find((x) => x.nome === nome)!
    expect(v('Compras à vista')).toMatchObject({ esperado: 3350, obtido: 3350, ok: true })
    expect(v('Vendas à vista')).toMatchObject({ esperado: 2003.3, obtido: 2003.3, ok: true })
    expect(v('Opções - vendas')).toMatchObject({ esperado: 60, obtido: 60, ok: true })
    expect(v('Líquido da nota').ok).toBe(true)
    expect(mista.conferida).toBe(true)
  })
  it('separa nome e espécie de unit, BDR, EDJ e direito de subscrição', () => {
    expect(mista.negocios.map((n) => [n.nome, n.especie])).toEqual([
      ['BRASIL', 'ON NM'],
      ['TAESA', 'UNT N2'],
      ['TEGMA', 'ON EDJ NM'],
      ['EXXON MOBIL', 'DRN'],
      ['EXXON MOBIL', 'DRN'],
      ['BRADESCO', 'DO 15,43'],
      ['MGLUT430 ON 4,31 MGLUE', ''],
      ['MRVET420 ON 4,20 MRVEE', ''],
      ['FII VALORAIP', 'CI'],
    ])
  })
  it('só os negócios à vista viram lançamento; as opções são ignoradas com aviso', () => {
    const r = notaParaLancamentos(mista, () => null)
    expect(r.lancamentos.map((l) => l.ativo)).toEqual(['VGIP11']) // os demais ficam pendentes (sem ticker)
    expect(r.pendentes).toHaveLength(6)
    expect(r.pendentes.every((p) => p.categoria === 'vista')).toBe(true)
    expect(mista.avisos.some((a) => a.includes('2 negócio(s) em mercado fora') && a.includes('OPCAO DE VENDA'))).toBe(true)
  })
  it('RATEIO: as taxas das opções NÃO são cobradas das ações (todos os negócios entram no denominador)', () => {
    const valores = mista.negocios.map((n) => n.valor)
    const todos = ratearCentavos(2.2, valores)
    const resolver = (n: { nome: string }) => ({ BRASIL: 'BBAS3', TAESA: 'TAEE11', TEGMA: 'TGMA3', 'EXXON MOBIL': 'EXXO34', BRADESCO: 'BBDC1' } as Record<string, string>)[n.nome] ?? null
    const r = notaParaLancamentos(mista, resolver)
    expect(r.pendentes).toEqual([])
    expect(r.lancamentos).toHaveLength(7)
    const taxasAcoes = r.lancamentos.reduce((s, l) => s + l.taxas, 0)
    const taxasOpcoes = todos[6] + todos[7]
    expect(taxasOpcoes).toBeGreaterThan(0) // as opções pagam uma fatia
    expect(Math.round((taxasAcoes + taxasOpcoes) * 100)).toBe(220) // nada se perde
    expect(taxasAcoes).toBeLessThan(2.2) // e as ações não absorvem a fatia das opções
  })
  it('direito de subscrição fracionário (BRADESCO DO) é resolvido por cruzamento com a Negociação', () => {
    const existentes = [{ data: '2026-09-30', tipo: 'venda', ativo: 'BBDC1', quantidade: 11, preco: 0.3 }]
    const r = notaParaLancamentos(mista, combinarResolvedores(resolverPorCruzamento(existentes), () => null))
    expect(r.lancamentos.find((l) => l.ativo === 'BBDC1')).toMatchObject({ tipo: 'venda', quantidade: 11 })
  })
  it('as várias execuções idênticas de BDR (1 cota por vez) viram lançamentos separados', () => {
    const r = notaParaLancamentos(mista, (n) => (n.nome === 'EXXON MOBIL' ? 'EXXO34' : null))
    expect(r.lancamentos.filter((l) => l.ativo === 'EXXO34').map((l) => l.quantidade)).toEqual([2, 1])
  })

  it('nota SÓ de opções: conferida, mas não importa nada e explica por quê', () => {
    const so = JSON.parse(JSON.stringify(mista)) as NotaNegociacao
    so.negocios = so.negocios.filter((n) => n.categoria === 'opcao')
    const r = notaParaLancamentos({ ...so, conferida: true }, () => null)
    expect(r.lancamentos).toEqual([])
    expect(r.avisos[0]).toContain('só opções')
  })
  it('exercício de opção gera aviso específico (altera a posição, não é importado)', () => {
    const copia: LinhaPdf[] = JSON.parse(JSON.stringify(linhasMista))
    let alteradas = 0
    for (const l of copia) for (const c of l.celulas) if (c.texto.startsWith('OPCAO DE VENDA')) { c.texto = c.texto.replace('OPCAO DE VENDA', 'EXERC OPC VENDA'); alteradas++ }
    expect(alteradas).toBe(2) // trava: o teste só vale se a alteração aconteceu de fato
    const n = lerNotaSinacor(copia)
    expect(n.negocios.filter((x) => x.categoria === 'exercicio')).toHaveLength(2)
    expect(n.avisos.some((a) => a.includes('EXERCÍCIO'))).toBe(true)
  })
  it('mercado dividido em várias células ("OPCAO" + "DE VENDA ...") é lido do mesmo jeito', () => {
    const copia: LinhaPdf[] = JSON.parse(JSON.stringify(linhasMista))
    let divididas = 0
    for (const l of copia) {
      const i = l.celulas.findIndex((c) => c.texto.startsWith('OPCAO DE VENDA'))
      if (i < 0) continue
      const c = l.celulas[i]
      l.celulas.splice(i, 1, { x: c.x, xFim: c.x + 25, texto: 'OPCAO' }, { x: c.x + 30, xFim: c.xFim, texto: c.texto.replace('OPCAO ', '') })
      divididas++
    }
    expect(divididas).toBe(2) // trava contra teste vazio
    const n = lerNotaSinacor(copia)
    expect(n.negocios[6].categoria).toBe('opcao')
    expect(n.negocios[6].especificacao).toBe('MGLUT430 ON 4,31 MGLUE')
    expect(n.conferida).toBe(true)
  })
  it('o PDF funde o mercado e o prazo numa célula só ("OPCAO DE VENDA 08/26"): é separado do mesmo jeito', () => {
    const celula = linhasMista.flatMap((l) => l.celulas).find((c) => c.texto.startsWith('OPCAO DE VENDA'))!
    expect(celula.texto).toBe('OPCAO DE VENDA 08/26') // é assim que o pdf.js entrega, de fato
    expect(mista.negocios[6].mercado).toBe('OPCAO DE VENDA')
  })
  it('C/V e D/C que não combinam geram aviso, sem derrubar a conferência pelos totais', () => {
    const copia: LinhaPdf[] = JSON.parse(JSON.stringify(linhasMista))
    const l = copia.find((x) => x.texto.includes('BRASIL'))! // a venda de BRASIL, que é C
    l.celulas[l.celulas.length - 1].texto = 'D'
    const n = lerNotaSinacor(copia)
    expect(n.avisos.some((a) => a.includes('C/V e D/C que não combinam'))).toBe(true)
    expect(n.conferida).toBe(true)
  })
})
