import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import {
  alertasDoFundo, calcular, canonico, classificarPeloAtivo, competenciaDeReferencia, divisorDaEscala, hashDoResultado, motivoDeExclusao,
  rankPercentual, ranquear, separarAConferir, subtrairMes, verificarSanidade,
} from './fii-baratos-calculo.mjs'
import { concluir, csvRanking, montarInsumos } from './atualizar-fii-baratos.mjs'
import { verificar } from './fii-baratos-verificar.mjs'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const RAIZ = path.resolve(AQUI, '..')
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'config', 'fii-baratos.json'), 'utf8'))
const perto = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`)

// ---------------------------------------------------------------------------------------
// Funções puras
// ---------------------------------------------------------------------------------------

test('configuração: versão, trava de publicação desligada e alertas coerentes com os filtros', () => {
  assert.equal(cfg.versaoMetodologia, '1.4.0')
  assert.equal(cfg.historicoDeVersoes.at(-1).versao, cfg.versaoMetodologia)
  assert.equal(cfg.publicacao.aprovadoPeloResponsavel, false, 'este job não publica nada: a aprovação só muda por decisão do responsável')
  assert.match(cfg.publicacao.avisoProposto, /^Não é recomendação de investimento\./, 'aviso proposto no mesmo tom do Top 15 de ações')
  assert.match(cfg.publicacao.enquadramento.status, /não aprovada/i)
  assert.ok(cfg.publicacao.enquadramento.pontosParaDecisao.length >= 3)
  assert.equal(cfg.dados.precoDiarioObrigatorio, false, 'vira true só quando o responsável decidir publicar')
  assert.equal(cfg.filtros.tijolo.volumeMinimoDiario, 300000, 'mínimo de liquidez único, por decisão do responsável (1.3.0)')
  assert.equal(cfg.filtros.papel.volumeMinimoDiario, cfg.filtros.tijolo.volumeMinimoDiario)
  assert.ok(cfg.filtros.papel.patrimonioMinimo < cfg.filtros.tijolo.patrimonioMinimo)
  assert.ok(cfg.filtros.papel.pvpMinimo > cfg.alertas.pvpMuitoBaixo, 'papel com P/VP baixo já sai pelo filtro, antes do alerta')
  assert.equal(cfg.tamanhoDaLista, 15)
})

test('classificação pelo ativo: tijolo, papel, fundo de fundos e misto (CRI e CRI_CRA nunca contam em dobro)', () => {
  const c = (a) => classificarPeloAtivo(a, cfg.classificacao)
  assert.equal(c({ Direitos_Bens_Imoveis: 700, CRI: 50, FII: 50, Fundos_Renda_Fixa: 200 }).tipo, 'tijolo')
  assert.equal(c({ CRI: 600, LCI: 100, Fundos_Renda_Fixa: 300 }).tipo, 'papel')
  assert.equal(c({ CRI_CRA: 800, Titulos_Publicos: 200 }).tipo, 'papel')
  assert.equal(c({ FII: 900, Titulos_Publicos: 100 }).tipo, 'fundo_de_fundos')
  const misto = c({ Direitos_Bens_Imoveis: 400, CRI: 400, FII: 200 })
  assert.equal(misto.tipo, 'misto')
  assert.deepEqual(Object.keys(misto.fatias), ['imoveis', 'recebiveis', 'cotas'])
  assert.equal(c({}).tipo, 'sem_ativo')
  assert.equal(c(undefined).tipo, 'sem_ativo')
  assert.equal(c({ Acoes_Sociedades_Atividades_FII: 800, Titulos_Publicos: 200 }).tipo, 'tijolo', 'sociedades de atividades de FII contam como imóvel')
  assert.equal(c({ Direitos_Bens_Imoveis: 600, Fundos_Renda_Fixa: 400 }).tipo, 'tijolo', 'exatamente 60% já é tijolo')
  assert.equal(c({ Direitos_Bens_Imoveis: 590, Fundos_Renda_Fixa: 410 }).tipo, 'misto')
})

test('competência de referência: a mais recente com cobertura quase completa (o mês corrente vem com poucos fundos)', () => {
  assert.equal(competenciaDeReferencia({ '2026-07': 1343, '2026-08': 1353, '2026-09': 8 }, 0.8), '2026-08')
  assert.equal(competenciaDeReferencia({ '2026-07': 1000, '2026-08': 850 }, 0.8), '2026-08')
  assert.equal(competenciaDeReferencia({ '2026-07': 1000, '2026-08': 700 }, 0.8), '2026-07')
  assert.equal(competenciaDeReferencia({}, 0.8), null)
  assert.equal(divisorDaEscala(0.008), 1)
  assert.equal(divisorDaEscala(0.8), 100, 'DY em % (mediana acima de 0,05)')
  assert.equal(divisorDaEscala(null), 1)
})

test('meses e ranks percentuais', () => {
  assert.equal(subtrairMes('2026-08', 0), '2026-08')
  assert.equal(subtrairMes('2026-08', 11), '2025-09')
  assert.equal(subtrairMes('2026-02', 2), '2025-12')
  assert.deepEqual(rankPercentual([0.5, 0.9, 1.1], false), [1, 0.5, 0])
  assert.deepEqual(rankPercentual([0.1, 0.3, 0.2], true), [0, 1, 0.5])
  assert.deepEqual(rankPercentual([1, 1, 2], true), [0.25, 0.25, 1])
  assert.deepEqual(rankPercentual([3], true), [1])
})

test('filtros por grupo, na ordem: liquidez, patrimônio, cotistas, P/VP, DY implausível (papel), patrimônio em queda, alavancagem', () => {
  const bom = { volumeLiquidez: 2e6, patrimonio: 1e9, cotistas: 20000, pvp: 0.9, dy12: 0.12, rentabPatrimonial12m: 0.01, alavancagem: 0.05 }
  const cod = (o, g = 'tijolo') => motivoDeExclusao({ ...bom, ...o }, cfg.filtros[g])?.[0] ?? null
  assert.equal(cod({}), null)
  assert.equal(cod({}, 'papel'), null)
  assert.equal(cod({ volumeLiquidez: 1e5 }), 'liquidez_baixa')
  for (const g of ['tijolo', 'papel']) {
    assert.equal(cod({ volumeLiquidez: 3e5 }, g), null, 'exatamente R$ 300 mil passa nos dois grupos')
    assert.equal(cod({ volumeLiquidez: 2.99e5 }, g), 'liquidez_baixa')
  }
  assert.equal(cod({ volumeLiquidez: null }), 'liquidez_baixa')
  assert.equal(cod({ patrimonio: 1e8 }), 'patrimonio_pequeno')
  assert.equal(cod({ cotistas: 500 }), 'poucos_cotistas')
  assert.equal(cod({ cotistas: null }), null, 'sem o dado de cotistas, o filtro não se aplica')
  assert.equal(cod({ pvp: 0.2 }), 'pvp_suspeito')
  assert.equal(cod({ pvp: 0.6 }, 'papel'), 'pvp_suspeito', 'papel com P/VP baixo é perda precificada, não pechincha')
  assert.equal(cod({ pvp: 0.6 }, 'tijolo'), null)
  assert.equal(cod({ dy12: 2.63 }, 'papel'), 'dy_implausivel')
  assert.equal(cod({ rentabPatrimonial12m: -0.9 }), 'patrimonio_em_queda')
  assert.equal(cod({ rentabPatrimonial12m: -0.08 }, 'papel'), 'patrimonio_em_queda', 'papel tolera menos queda que tijolo')
  assert.equal(cod({ rentabPatrimonial12m: -0.08 }, 'tijolo'), null)
  assert.equal(cod({ rentabPatrimonial12m: null }), 'sem_rentabilidade_patrimonial')
  assert.equal(cod({ alavancagem: 0.6 }), 'alavancado')
})

test('ranking e "a conferir": nota = média dos ranks; desempate pelo menor P/VP; suspeito sai ANTES e não desloca os demais', () => {
  const f = (ticker, pvp, dy12) => ({ ticker, pvp, dy12 })
  const r = ranquear([f('AAAA11', 0.9, 0.10), f('BBBB11', 0.5, 0.13), f('CCCC11', 1.0, 0.12), f('DDDD11', 0.7, 0.20)])
  // notas: BBBB = DDDD = 0,833 (desempata o menor P/VP); AAAA = CCCC = 0,167 (idem)
  assert.deepEqual(r.map((x) => x.ticker), ['BBBB11', 'DDDD11', 'AAAA11', 'CCCC11'])
  assert.deepEqual(r.map((x) => x.posicao), [1, 2, 3, 4])
  assert.deepEqual(alertasDoFundo({ pvp: 0.4, dy12: 0.3 }, cfg.alertas), ['pvp_muito_baixo', 'dy_alto'])
  assert.deepEqual(alertasDoFundo({ pvp: 0.95, dy12: 0.1 }, cfg.alertas), [])
  const { limpos, aConferir } = separarAConferir([f('SUSP11', 0.4, 0.28), f('AAAA11', 0.9, 0.10), f('BBBB11', 0.8, 0.12), f('ALTO11', 0.9, 0.19)], cfg.alertas)
  assert.deepEqual(limpos.map((x) => x.ticker), ['AAAA11', 'BBBB11'])
  assert.deepEqual(aConferir.map((x) => [x.ticker, x.alertas]), [['SUSP11', ['pvp_muito_baixo', 'dy_alto']], ['ALTO11', ['dy_alto']]])
  assert.deepEqual(ranquear(limpos).map((x) => [x.ticker, x.nota]), [['BBBB11', 1], ['AAAA11', 0]], 'com o suspeito fora, os dois restantes ocupam as pontas da escala')
})

// ---------------------------------------------------------------------------------------
// Cálculo de ponta a ponta (conta feita à mão)
// ---------------------------------------------------------------------------------------

const REF = '2026-08'
const MESES = Array.from({ length: 14 }, (_, i) => subtrairMes(REF, 13 - i))

/**
 * Fundo fabricado: valor patrimonial 100, DY de 0,8% ao mês (rendimento de R$ 0,80 por cota por mês), rentabilidade
 * patrimonial de 0,1% ao mês. Com cotação 80: P/VP = 0,8; rendimento de 12 meses = 9,60; DY de 12 meses = 12%.
 */
function fundo(ticker, o = {}) {
  const informes = {}
  for (const m of MESES) {
    if ((o.semMeses ?? []).includes(m)) continue
    informes[m] = { versao: 1, dy: o.dy ?? 0.008, vp: o.vp ?? 100, pat: o.pat ?? 0.001, efetiva: 0.009, pl: o.pl ?? 5e8, cotistas: o.cotistas === undefined ? 10000 : o.cotistas, valorAtivo: 5.1e8 }
  }
  const ativoPadrao = o.ativo ?? { Direitos_Bens_Imoveis: 900, Fundos_Renda_Fixa: 100, Total_Passivo: 2e7, Rendimentos_Distribuir: 1e6, Taxa_Administracao_Pagar: 1e6 }
  return {
    ticker, nome: `Fundo ${ticker}`, setor: 'Outros', segmento: 'Multicategoria', cnpj: o.cnpj === null ? null : `${ticker.charCodeAt(0)}${ticker.charCodeAt(1)}`.padStart(14, '0'), origemCnpj: 'ISIN teste',
    cotacao: o.cotacao === undefined ? 80 : o.cotacao, dataCotacao: o.dataCotacao ?? '2026-09-25', volumeMedio: o.volume ?? 2e6, volumeMediano: o.mediano === undefined ? undefined : o.mediano,
    informes, ativos: Object.fromEntries(MESES.map((m) => [m, ativoPadrao])),
  }
}
const papelAtivo = { CRI: 900, Fundos_Renda_Fixa: 100, Total_Passivo: 2e7, Rendimentos_Distribuir: 1e6, Taxa_Administracao_Pagar: 1e6 }
const insumosDe = (fundos, o = {}) => ({
  esquema: 1, dataExecucao: '2026-10-06', dataCotacoes: '2026-09-25',
  contagemPorCompetencia: Object.fromEntries(MESES.map((m) => [m, m === '2026-09' ? 8 : 1300])), medianaDyPorCompetencia: Object.fromEntries(MESES.map((m) => [m, 0.008])), fundos, ...o,
})

test('cálculo à mão: P/VP 0,8, rendimento de 12 meses 9,60, DY 12%, rentabilidade patrimonial (1,001^12 − 1) e alavancagem 1,8/51', () => {
  const { resultado, memoria } = calcular(insumosDe([fundo('ALFA11')]), cfg)
  assert.equal(resultado.competenciaReferencia, '2026-08', 'a competência 2026-09 (8 fundos) não serve de referência')
  assert.equal(resultado.tijolo.length, 1)
  const a = resultado.tijolo[0]
  assert.equal(a.tipo, 'tijolo')
  perto(a.pvp, 0.8, 1e-4)
  perto(a.rendimento12m, 9.6, 1e-4)
  perto(a.dy12, 0.12, 1e-5)
  perto(a.rentabPatrimonial12m, 1.001 ** 12 - 1, 1e-5)
  perto(a.alavancagem, (2e7 - 1e6 - 1e6) / 5.1e8, 1e-4)
  assert.equal(a.mesesComDados, 12)
  perto(a.fatias.imoveis, 0.9, 1e-4)
  assert.equal(memoria.ALFA11.serie.length, 12)
  assert.equal(memoria.ALFA11.derivados.pvp.formula, 'cotação ÷ valor patrimonial da cota')
  assert.equal(memoria.ALFA11.filtro.aprovado, true)
  assert.equal(memoria.ALFA11.ranking.posicao, 1)
  // com 2 dos 12 meses sem informe, o rendimento é anualizado pelos 10 meses com dado: 8,00 × 12 ÷ 10 = 9,60 (e não 8,00)
  const dez = calcular(insumosDe([fundo('ALFA11', { semMeses: [MESES[5], MESES[6]] })]), cfg).resultado.tijolo[0]
  assert.equal(dez.mesesComDados, 10)
  perto(dez.rendimento12m, 9.6, 1e-4)
})

test('cada exclusão tem etapa, código e motivo: sem CNPJ, cotação defasada, dados insuficientes, fundo de fundos, misto, filtros e "a conferir"', () => {
  const insumos = insumosDe([
    fundo('SEMC11', { cnpj: null }),
    fundo('VELH11', { dataCotacao: '2026-07-01' }),
    fundo('SEMP11', { cotacao: null }),
    fundo('POUC11', { semMeses: MESES.slice(3, 11) }), // 4 meses de 12 com dado: abaixo do mínimo de 10
    fundo('FOFA11', { ativo: { FII: 900, Fundos_Renda_Fixa: 100, Total_Passivo: 0 } }),
    fundo('MIST11', { ativo: { Direitos_Bens_Imoveis: 400, CRI: 400, FII: 200, Total_Passivo: 0 } }),
    fundo('ILIQ11', { volume: 1000 }),
    fundo('SUSP11', { cotacao: 40 }), // P/VP 0,4 e DY de 24%: a conferir
    fundo('BOMT11', { cotacao: 85 }), fundo('OUTR11', { cotacao: 75, dy: 0.009 }),
    fundo('PAPB11', { ativo: papelAtivo, cotacao: 90 }),
  ])
  const { resultado } = calcular(insumos, cfg)
  const por = Object.fromEntries(resultado.exclusoes.map((e) => [e.ticker, e]))
  assert.deepEqual([por.SEMC11.etapa, por.SEMC11.codigo], ['universo', 'sem_cnpj'])
  assert.deepEqual([por.VELH11.etapa, por.VELH11.codigo], ['precos', 'cotacao_defasada'])
  assert.deepEqual([por.SEMP11.etapa, por.SEMP11.codigo], ['precos', 'sem_cotacao'])
  assert.deepEqual([por.POUC11.etapa, por.POUC11.codigo], ['dados', 'dados_insuficientes'])
  assert.deepEqual([por.FOFA11.etapa, por.FOFA11.codigo], ['classificacao', 'fundo_de_fundos'])
  assert.deepEqual([por.MIST11.etapa, por.MIST11.codigo], ['classificacao', 'misto'])
  assert.deepEqual([por.ILIQ11.etapa, por.ILIQ11.codigo], ['tijolo', 'liquidez_baixa'])
  assert.ok(Object.values(por).every((e) => e.motivo.length > 10))
  assert.deepEqual(resultado.aConferir.map((f) => [f.ticker, f.grupo, f.alertas]), [['SUSP11', 'tijolo', ['pvp_muito_baixo', 'dy_alto']]])
  assert.deepEqual(resultado.tijolo.map((f) => f.ticker).sort(), ['BOMT11', 'OUTR11'])
  assert.deepEqual(resultado.papel.map((f) => f.ticker), ['PAPB11'])
  assert.ok(!resultado.exclusoes.some((e) => e.ticker === 'SUSP11'), 'a conferir não é exclusão: tem lista própria')
  // OUTR11 (cotação 75, DY 0,9%) é mais barato e rende mais que BOMT11 (cotação 85, DY 0,8%)
  assert.equal(resultado.tijolo[0].ticker, 'OUTR11')
  assert.equal(resultado.tijolo[0].nota, 1)
})

test('rendimento em queda e pico de rendimento: MEDIANA dos 3 últimos meses contra a de 12 meses, e média contra mediana de 12 meses', () => {
  const comDy = (porMes, base = {}) => {
    const f = fundo('QUED11', base)
    for (const [i, dy] of Object.entries(porMes)) { const m = MESES.at(Number(i)); f.informes[m] = { ...f.informes[m], dy } }
    return f
  }
  const roda = (f) => calcular(insumosDe([f]), cfg).resultado
  // corte: 9 meses a R$ 0,80 e 3 meses a R$ 0,20: mediana de 12 meses 0,80, recente 0,20, razão 0,25
  const corte = roda(comDy({ '-3': 0.002, '-2': 0.002, '-1': 0.002 }))
  assert.deepEqual(corte.aConferir.map((f) => [f.ticker, f.alertas]), [['QUED11', ['rendimento_em_queda']]])
  perto(corte.aConferir[0].razaoRendimentoRecente, 0.25, 1e-4)
  perto(corte.aConferir[0].dyRecente, (0.2 * 12) / 80, 1e-5)
  assert.equal(corte.tijolo.length, 0)
  // UM mês com DY zero no informe (caso GTWR11 e BRCO11, que pagam todo mês): a mediana não se deixa enganar
  const mesZerado = roda(comDy({ '-2': 0 }))
  assert.equal(mesZerado.aConferir.length, 0)
  assert.equal(mesZerado.tijolo.length, 1)
  // dois meses zerados dos 3 recentes: aí a mediana recente cai de verdade
  assert.deepEqual(roda(comDy({ '-2': 0, '-1': 0 })).aConferir.map((f) => f.alertas), [['rendimento_em_queda']])
  // pico: dois meses a R$ 2,80 (pagamento extra ou pico no informe) com os outros a R$ 0,80: média 1,13, mediana 0,80 (caso HGRE11)
  const pico = roda(comDy({ '-8': 0.028, '-3': 0.028 }))
  assert.deepEqual(pico.aConferir.map((f) => [f.ticker, f.alertas]), [['QUED11', ['rendimento_com_pico']]])
  perto(pico.aConferir[0].picoDeRendimento, (10 * 0.8 + 2 * 2.8) / 12 / 0.8, 1e-4)
  // um único mês de pico (média 0,97 ÷ mediana 0,80 = 1,21) ainda está abaixo do limite
  assert.equal(roda(comDy({ '-8': 0.028 })).aConferir.length, 0)
  // rendimento subindo: sem alerta
  assert.equal(roda(comDy({ '-3': 0.012, '-2': 0.012, '-1': 0.012 })).tijolo.length, 1)
  // sem os 3 meses recentes com dado, a razão não existe e não há alerta de queda
  const faltaUm = roda(fundo('QUED11', { semMeses: [MESES.at(-2)] }))
  assert.equal(faltaUm.tijolo.length, 1)
  assert.equal(faltaUm.tijolo[0].razaoRendimentoRecente, null)
  assert.equal(faltaUm.tijolo[0].dyRecente, null)
  // sem o informe da própria competência de referência o fundo sai por dados
  assert.ok(roda(fundo('QUED11', { semMeses: [MESES.at(-1)] })).exclusoes.some((e) => e.ticker === 'QUED11' && e.codigo === 'dados_insuficientes'))
  // limites exatos: "abaixo de 0,75" e "acima de 1,25"
  assert.deepEqual(alertasDoFundo({ razaoRendimentoRecente: 0.75 }, cfg.alertas), [])
  assert.deepEqual(alertasDoFundo({ razaoRendimentoRecente: 0.74 }, cfg.alertas), ['rendimento_em_queda'])
  assert.deepEqual(alertasDoFundo({ picoDeRendimento: 1.25 }, cfg.alertas), [])
  assert.deepEqual(alertasDoFundo({ picoDeRendimento: 1.26 }, cfg.alertas), ['rendimento_com_pico'])
})
test('conferência manual: libera só os alertas listados, vale por 90 dias, e alerta novo ou conferência vencida devolvem o fundo para "a conferir"', () => {
  const suspeito = () => fundo('SUSP11', { cotacao: 40 }) // P/VP 0,4 e DY de 24%: pvp_muito_baixo e dy_alto
  const conf = (libera, conferidoEm = '2026-10-06') => ({ ...cfg, conferencia: { validadeDias: 90, fundos: { SUSP11: { conferidoEm, fonte: 'Investidor10', libera, nota: 'dado conferido' } } } })
  const roda = (c, insumos = insumosDe([suspeito(), fundo('OUTR11', { cotacao: 85 })])) => calcular(insumos, c)

  // sem conferência: fica fora
  assert.deepEqual(roda(cfg).resultado.aConferir.map((f) => f.ticker), ['SUSP11'])
  // conferência que cobre só um dos dois alertas: continua fora, com o alerta que falta
  const parcial = roda(conf(['pvp_muito_baixo'])).resultado
  assert.deepEqual(parcial.aConferir.map((f) => [f.ticker, f.alertas]), [['SUSP11', ['dy_alto']]])
  // conferência que cobre os dois: entra no ranking, marcado, com fonte e data
  const { resultado, memoria } = roda(conf(['pvp_muito_baixo', 'dy_alto']))
  assert.equal(resultado.aConferir.length, 0)
  const s = resultado.tijolo.find((f) => f.ticker === 'SUSP11')
  assert.deepEqual(s.alertas, [])
  assert.deepEqual(s.alertasLiberados, ['pvp_muito_baixo', 'dy_alto'])
  assert.deepEqual(s.conferido, { em: '2026-10-06', fonte: 'Investidor10', nota: 'dado conferido' })
  assert.equal(memoria.SUSP11.conferencia.fonte, 'Investidor10')
  assert.match(memoria.SUSP11.conferencia.regra, /libera só os alertas listados/)
  assert.equal(resultado.tijolo.length, 2, 'o fundo conferido participa do ranking como qualquer outro')
  // validade: 90 dias contam a partir de conferidoEm (dataExecucao = 2026-10-06 nos insumos de teste)
  const emDia = (data) => roda(conf(['pvp_muito_baixo', 'dy_alto'], data)).resultado
  assert.equal(emDia('2026-07-08').aConferir.length, 0, 'exatamente 90 dias: ainda vale')
  const vencida = emDia('2026-07-07')
  assert.deepEqual(vencida.aConferir.map((f) => [f.ticker, f.conferenciaVencida]), [['SUSP11', '2026-07-07']], '91 dias: volta para "a conferir", dizendo que a conferência venceu')
  assert.equal(emDia('2026-12-01').aConferir.length, 1, 'conferência datada do futuro não vale')
  // um alerta novo (rendimento em queda) que a conferência não cobre segura o fundo de novo
  const f = suspeito()
  for (const m of MESES.slice(-3)) f.informes[m] = { ...f.informes[m], dy: 0.001 }
  const novo = roda(conf(['pvp_muito_baixo', 'dy_alto']), insumosDe([f])).resultado
  assert.ok(novo.aConferir[0].alertas.includes('rendimento_em_queda'))
  assert.ok(!novo.aConferir[0].alertas.includes('pvp_muito_baixo'), 'o que a conferência cobre não é repetido como pendente')
  // fundo sem alerta com conferência: nada muda
  assert.equal(roda(conf(['pvp_muito_baixo'])).resultado.tijolo.find((x) => x.ticker === 'OUTR11').conferido, undefined)
})

test('configuração de conferência: datas válidas, só alertas conhecidos, fonte e nota preenchidas', () => {
  const conhecidos = ['pvp_muito_baixo', 'dy_alto', 'rendimento_em_queda', 'rendimento_com_pico']
  assert.equal(cfg.conferencia.validadeDias, 90)
  assert.ok(Object.keys(cfg.conferencia.fundos).length >= 1)
  for (const [ticker, c] of Object.entries(cfg.conferencia.fundos)) {
    assert.match(c.conferidoEm, /^\d{4}-\d{2}-\d{2}$/, ticker)
    assert.ok(!Number.isNaN(Date.parse(c.conferidoEm)), ticker)
    assert.ok(c.libera.length > 0 && c.libera.every((a) => conhecidos.includes(a)), `${ticker}: alertas desconhecidos`)
    assert.ok(c.fonte && c.nota, `${ticker}: falta fonte ou nota`)
  }
  assert.equal(cfg.alertas.rendimentoRecenteMinimoSobre12m, 0.75)
  assert.equal(cfg.alertas.picoDeRendimentoMaximo, 1.25)
  assert.equal(cfg.dados.mesesRecentes, 3)
})

test('liquidez pela MEDIANA do volume diário quando existe; sem ela vale a média, e a fonte fica registrada', () => {
  // média R$ 2 mi (puxada por poucos dias de rali), mediana R$ 100 mil: o fundo é ilíquido no dia típico
  const raliSo = fundo('RALI11', { volume: 2e6, mediano: 1e5 })
  // média R$ 2 mi e mediana R$ 1,5 mi: líquido de verdade
  const liquido = fundo('LIQD11', { volume: 2e6, mediano: 1.5e6 })
  // job de FIIs antigo, sem mediana: vale a média
  const semMediana = fundo('ANTG11', { volume: 2e6 })
  const { resultado, memoria } = calcular(insumosDe([raliSo, liquido, semMediana]), cfg)
  assert.deepEqual(resultado.tijolo.map((f) => f.ticker).sort(), ['ANTG11', 'LIQD11'])
  const fora = resultado.exclusoes.find((e) => e.ticker === 'RALI11')
  assert.deepEqual([fora.etapa, fora.codigo], ['tijolo', 'liquidez_baixa'])
  assert.match(fora.motivo, /volume mediano de R\$ 100\.000/)
  assert.deepEqual([resultado.liquidezPorMediana, resultado.liquidezPorMedia], [2, 1])
  assert.deepEqual(resultado.tijolo.map((f) => [f.ticker, f.fonteLiquidez, f.volumeLiquidez]).sort(), [['ANTG11', 'média', 2e6], ['LIQD11', 'mediana', 1.5e6]])
  assert.deepEqual([memoria.LIQD11.liquidez.fonte, memoria.ANTG11.liquidez.fonte], ['mediana', 'média'])
  assert.equal(memoria.RALI11.liquidez.volumeMedio, 2e6)
  // o mesmo mínimo (R$ 300 mil de mediana) vale para tijolo e papel: 4e5 passa nos dois, 2e5 sai nos dois
  const r = calcular(insumosDe([fundo('PAPM11', { ativo: papelAtivo, cotacao: 90, volume: 2e6, mediano: 4e5 }), fundo('TIJM11', { cotacao: 90, volume: 2e6, mediano: 4e5 }), fundo('PAPL11', { ativo: papelAtivo, cotacao: 90, volume: 2e6, mediano: 2e5 }), fundo('TIJL11', { cotacao: 90, volume: 2e6, mediano: 2e5 })]), cfg).resultado
  assert.deepEqual(r.papel.map((f) => f.ticker), ['PAPM11'])
  assert.deepEqual(r.tijolo.map((f) => f.ticker), ['TIJM11'])
  assert.deepEqual(r.exclusoes.filter((e) => e.codigo === 'liquidez_baixa').map((e) => e.ticker).sort(), ['PAPL11', 'TIJL11'])
})

// ---------------------------------------------------------------------------------------
// Preço diário da B3
// ---------------------------------------------------------------------------------------

/** 21 pregões (dias úteis) terminando em 2026-10-05, a véspera da execução dos insumos de teste. */
const PREGOES = (() => {
  const datas = []
  const d = new Date('2026-10-05T12:00:00Z')
  while (datas.length < 21) {
    if (![0, 6].includes(d.getUTCDay())) datas.unshift(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() - 1)
  }
  return datas
})()
/** Série diária: R$ 80 e R$ 1 mi por dia, com ajustes pontuais por índice (-1 = último pregão). */
const serieDiaria = (ajustes = {}) => PREGOES.map((_, i) => {
  const chave = i - PREGOES.length
  const a = ajustes[i] !== undefined ? ajustes[i] : ajustes[chave]
  return a === undefined ? [80, 1e6] : a
})
const comDiario = (fundos, o = {}) => insumosDe(fundos, { pregoesDiarios: PREGOES, ...o })

test('preço diário da B3: cotação do último pregão com negócio, data dele, volume médio e mediano (dia sem negócio conta zero) e a fonte registrada', () => {
  // últimos 3 pregões sem negócio: a cotação é a do 18º pregão; 3 dias zerados em 21 (média 6/7 de R$ 1 mi), mediana R$ 1 mi
  const f = fundo('DIAR11', { cotacao: 999, dataCotacao: '2026-09-25', volume: 5e6 })
  f.precoDiario = serieDiaria({ '-1': null, '-2': null, '-3': null, [PREGOES.length - 4]: [82, 1e6] })
  const { resultado, memoria } = calcular(comDiario([f]), cfg)
  const x = resultado.tijolo[0]
  assert.equal(x.fonteCotacao, 'B3 (boletim diário)')
  assert.equal(x.cotacao, 82, 'a cotação mensal de R$ 999 é ignorada quando há preço diário')
  assert.equal(x.dataCotacao, PREGOES.at(-4))
  perto(x.volumeMedio, (18e6) / 21, 1)
  assert.equal(x.volumeMediano, 1e6)
  assert.equal(x.volumeLiquidez, 1e6, 'a liquidez usa a mediana do volume diário da B3')
  perto(x.pvp, 82 / 100, 1e-4)
  assert.deepEqual([resultado.precoDiarioEm, resultado.precoMensalEm, resultado.ultimoPregaoDiario], [1, 0, PREGOES.at(-1)])
  assert.deepEqual([memoria.DIAR11.preco.fonte, memoria.DIAR11.preco.pregoesNoHistorico], ['B3 (boletim diário)', 21])
})

test('preço diário: sem histórico do fundo ou sem negócio na janela vale o preço mensal; a trava de publicação exige o diário', () => {
  const semHistorico = fundo('MENS11') // precoDiario ausente: fundo fora do histórico
  const semNegocio = fundo('PARA11'); semNegocio.precoDiario = PREGOES.map(() => null)
  const normal = fundo('DIAR11'); normal.precoDiario = serieDiaria()
  const r = calcular(comDiario([semHistorico, semNegocio, normal]), cfg).resultado
  assert.deepEqual(Object.fromEntries(r.tijolo.map((f) => [f.ticker, f.fonteCotacao])), { MENS11: 'brapi (job mensal de FIIs)', PARA11: 'brapi (job mensal de FIIs)', DIAR11: 'B3 (boletim diário)' })
  assert.deepEqual([r.precoDiarioEm, r.precoMensalEm], [1, 2])
  // histórico com poucos pregões: não serve
  const pouco = calcular(insumosDe([normal], { pregoesDiarios: PREGOES.slice(-5) }), cfg).resultado
  assert.equal(pouco.tijolo[0].fonteCotacao, 'brapi (job mensal de FIIs)')
  // preço diário obrigatório (condição para publicar): quem não o tem sai, dizendo por quê
  const obrigatorio = { ...cfg, dados: { ...cfg.dados, precoDiarioObrigatorio: true } }
  const o = calcular(comDiario([semHistorico, semNegocio, normal]), obrigatorio).resultado
  assert.deepEqual(o.tijolo.map((f) => f.ticker), ['DIAR11'])
  const fora = Object.fromEntries(o.exclusoes.map((e) => [e.ticker, e]))
  assert.deepEqual([fora.MENS11.etapa, fora.MENS11.codigo], ['precos', 'sem_preco_diario'])
  assert.match(fora.MENS11.motivo, /fundo fora do histórico/)
  assert.match(fora.PARA11.motivo, /não negociou na janela/)
})

test('preço diário: cotação com mais de 7 dias sai (a mensal aceita 45); salto de preço de um dia para o outro vai para "a conferir"', () => {
  // último negócio há 12 dias: o histórico diário diz que o fundo não negocia, e a cotação diária velha tira o fundo
  const velho = fundo('VELH11')
  velho.precoDiario = serieDiaria(Object.fromEntries(Array.from({ length: 8 }, (_, k) => [-1 - k, null])))
  const r = calcular(comDiario([velho]), cfg).resultado
  const e = r.exclusoes.find((x) => x.ticker === 'VELH11')
  assert.deepEqual([e.etapa, e.codigo], ['precos', 'cotacao_defasada'])
  assert.match(e.motivo, /B3 \(boletim diário\).*máximo 7/)
  // desdobramento 1:3 no meio da janela: R$ 240 → R$ 80, salto de 67%
  const split = fundo('SPLT11')
  split.precoDiario = serieDiaria(Object.fromEntries(PREGOES.slice(0, 10).map((_, i) => [i, [240, 1e6]])))
  const s = calcular(comDiario([split]), cfg).resultado
  assert.deepEqual(s.aConferir.map((f) => [f.ticker, f.alertas]), [['SPLT11', ['salto_de_preco']]])
  perto(s.aConferir[0].saltoMaximo, 2 / 3, 1e-3)
  // oscilação normal de 3% ao dia não alerta
  const calmo = fundo('CALM11')
  calmo.precoDiario = serieDiaria({ '-5': [82.4, 1e6], '-4': [80, 1e6] })
  assert.equal(calcular(comDiario([calmo]), cfg).resultado.aConferir.length, 0)
  // tendência gradual (+5% ao dia, dobra em 15 pregões) não é salto: o que conta é a variação de um dia para o outro
  const tendencia = fundo('TEND11')
  tendencia.precoDiario = PREGOES.map((_, i) => [80 * 1.05 ** i, 1e6])
  const tr = calcular(comDiario([tendencia]), cfg).resultado
  assert.equal(tr.aConferir.some((f) => f.ticker === 'TEND11' && f.alertas.includes('salto_de_preco')), false)
  const tendenciaFundo = [...tr.tijolo, ...tr.aConferir, ...tr.exclusoes].some((f) => f.ticker === 'TEND11')
  assert.ok(tendenciaFundo)
  assert.deepEqual(alertasDoFundo({ saltoMaximo: 0.25 }, cfg.alertas), [])
  assert.deepEqual(alertasDoFundo({ saltoMaximo: 0.26 }, cfg.alertas), ['salto_de_preco'])
})

test('DY em % em vez de fração: a escala vem da mediana da competência e o resultado é o mesmo', () => {
  const emFracao = calcular(insumosDe([fundo('ALFA11')]), cfg).resultado.tijolo[0]
  const emPercentual = (() => {
    const f = fundo('ALFA11', { dy: 0.8, pat: 0.1 })
    return calcular(insumosDe([f], { medianaDyPorCompetencia: Object.fromEntries(MESES.map((m) => [m, 0.8])) }), cfg).resultado.tijolo[0]
  })()
  perto(emPercentual.dy12, emFracao.dy12, 1e-9)
  perto(emPercentual.rentabPatrimonial12m, emFracao.rentabPatrimonial12m, 1e-9)
})

test('determinismo e trava de sanidade', () => {
  const insumos = insumosDe([fundo('ALFA11'), fundo('BETA11', { cotacao: 70 }), fundo('GAMA11', { ativo: papelAtivo })])
  const a = calcular(insumos, cfg)
  const b = calcular(JSON.parse(JSON.stringify(insumos)), cfg)
  assert.equal(hashDoResultado(a.resultado), hashDoResultado(b.resultado))
  assert.notEqual(hashDoResultado(calcular(insumosDe([fundo('ALFA11'), fundo('BETA11', { cotacao: 71 })]), cfg).resultado), hashDoResultado(calcular(insumosDe([fundo('ALFA11'), fundo('BETA11', { cotacao: 70 })]), cfg).resultado))
  const problemas = verificarSanidade(a.resultado, cfg)
  assert.equal(problemas.length, 2, 'poucos fundos nos dois grupos')
  assert.match(problemas.join(' '), /tijolo/)
  assert.deepEqual(verificarSanidade(a.resultado, { publicacao: { sanidade: { minimoNoRankingTijolo: 1, minimoNoRankingPapel: 1, maximoFracaoSemDados: 1 } } }), [])
  const semDados = calcular(insumosDe([fundo('AAAA11', { cnpj: null }), fundo('BBBB11')]), cfg).resultado
  assert.match(verificarSanidade(semDados, { publicacao: { sanidade: { minimoNoRankingTijolo: 0, minimoNoRankingPapel: 0, maximoFracaoSemDados: 0.3 } } }).join(' '), /sem dado utilizável/)
})

// ---------------------------------------------------------------------------------------
// Extração (linhas no layout da CVM → insumos)
// ---------------------------------------------------------------------------------------

const comp = (cnpj, mes, o = {}) => ({ CNPJ_Fundo_Classe: cnpj, Data_Referencia: `${mes}-01`, Versao: String(o.versao ?? 1), Percentual_Dividend_Yield_Mes: o.dy ?? '0.008', Valor_Patrimonial_Cotas: o.vp ?? '100', Percentual_Rentabilidade_Patrimonial_Mes: '0.001', Percentual_Rentabilidade_Efetiva_Mes: '0.009', Patrimonio_Liquido: '500000000', Total_Numero_Cotistas: '9000', Valor_Ativo: '510000000' })
const geral = (cnpj, isin, nome = 'FUNDO') => ({ CNPJ_Fundo_Classe: cnpj, Codigo_ISIN: isin, Nome_Fundo_Classe: nome, Segmento_Atuacao: 'Shoppings' })
const ativoLinha = (cnpj, mes, o = {}) => ({ CNPJ_Fundo_Classe: cnpj, Data_Referencia: `${mes}-01`, Versao: '1', Direitos_Bens_Imoveis: '900', Fundos_Renda_Fixa: '100', Total_Passivo: '20000000', Rendimentos_Distribuir: '1000000', Taxa_Administracao_Pagar: '0', ...o })

test('extração: última versão de cada informe, escala do DY, migração de CNPJ pelo ISIN e campos zerados não ocupam espaço', () => {
  const A = '11.111.111/0001-11'
  const B = '22.222.222/0001-22' // mesmo ISIN (BRXXXXCTF001), CNPJ novo pela Resolução 175
  const meses = ['2026-06', '2026-07', '2026-08']
  const complemento = [
    ...meses.map((m) => comp(A, m)), ...meses.map((m) => comp(B, m, { vp: '110' })), comp(B, '2026-08', { versao: 2, vp: '111' }),
    comp('33.333.333/0001-33', '2026-08'), comp('33.333.333/0001-33', '2026-09'),
  ]
  // o CNPJ antigo (A) para de enviar informe em 2026-05: só o novo (B) tem os meses mais recentes
  const complementoSemA = complemento.filter((l) => !(l.CNPJ_Fundo_Classe === A))
  const g = [geral(A, 'BRXXXXCTF001', 'ANTIGO'), geral(B, 'BRXXXXCTF001', 'NOVO'), geral('33.333.333/0001-33', 'BRZZZZCTF001')]
  const at = [...meses.map((m) => ativoLinha(B, m)), ativoLinha(B, '2026-08', { Versao: '2', Direitos_Bens_Imoveis: '800', CRI: '0', FII: '' })]
  const snapshot = { geradoEm: '2026-09-25T01:00:00Z', fundos: [{ ticker: 'XXXX11', nome: 'Novo', setor: 'Shoppings', cotacao: 80, dataCotacao: '2026-09-25', volumeMedio: 2e6, volumeMediano: 1.5e6 }, { ticker: 'NADA11', cotacao: 10, dataCotacao: '2026-09-25', volumeMedio: 1 }] }
  // histórico diário da B3: 25 pregões (só os 21 últimos entram), XXXX11 sem negócio no último e NADA11 fora do histórico
  const datasH = Array.from({ length: 25 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
  const historicoPrecos = { pregoes: datasH, nomes: {}, ativos: { XXXX11: datasH.map((_, i) => (i === 24 ? null : [80 + i, 79, 81 + i, 1e6 + i])) } }
  const ins = montarInsumos({ complemento: complementoSemA, geral: g, ativo: at, snapshot, cfg, dataExecucao: '2026-10-06', historicoPrecos })
  assert.equal(ins.dataCotacoes, '2026-09-25')
  assert.deepEqual(ins.contagemPorCompetencia, { '2026-06': 1, '2026-07': 1, '2026-08': 2, '2026-09': 1 })
  assert.equal(ins.medianaDyPorCompetencia['2026-08'], 0.008)
  const x = ins.fundos.find((f) => f.ticker === 'XXXX11')
  assert.equal(x.cnpj, B.replace(/\D/g, ''), 'com o CNPJ antigo sem informe, vale o novo (guardado só com dígitos)')
  assert.deepEqual([x.volumeMedio, x.volumeMediano], [2e6, 1.5e6], 'a extração copia a média e a mediana do volume')
  assert.deepEqual(ins.pregoesDiarios, datasH.slice(-21), 'só os 21 últimos pregões entram nos insumos')
  assert.equal(x.precoDiario.length, 21)
  assert.deepEqual(x.precoDiario.slice(-3), [[102, 1000022], [103, 1000023], null], 'cada pregão vira [fechamento, volume em reais]; dia sem negócio, null')
  assert.match(x.origemCnpj, /2 CNPJs/)
  assert.equal(x.informes['2026-08'].vp, 111, 'a reapresentação (versão 2) substitui a original')
  assert.equal(x.informes['2026-08'].versao, 2)
  assert.deepEqual(x.ativos['2026-08'], { Direitos_Bens_Imoveis: 800, Fundos_Renda_Fixa: 100, Total_Passivo: 20000000, Rendimentos_Distribuir: 1000000 }, 'versão 2; campos zerados ou vazios não são guardados')
  const n = ins.fundos.find((f) => f.ticker === 'NADA11')
  assert.equal(n.cnpj, null)
  assert.equal(n.volumeMediano, null, 'job de FIIs antigo, sem mediana: null (o cálculo cai para a média)')
  assert.equal(n.precoDiario, null, 'fundo fora do histórico diário: sem série (o cálculo cai para o preço mensal)')
  assert.match(n.origemCnpj, /ISIN não encontrado/)
})

// ---------------------------------------------------------------------------------------
// Auditoria: gravar → verificar → detectar adulteração
// ---------------------------------------------------------------------------------------

function raizTemporaria() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'fii-teste-'))
  fs.mkdirSync(path.join(raiz, 'scripts'), { recursive: true })
  for (const a of ['fii-baratos-calculo.mjs', 'atualizar-fii-baratos.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(raiz, 'scripts', a))
  return raiz
}
const cfgFolgada = { ...cfg, publicacao: { ...cfg.publicacao, sanidade: { minimoNoRankingTijolo: 1, minimoNoRankingPapel: 1, maximoFracaoSemDados: 1 } } }

test('ciclo da auditoria: grava, verifica sozinha, detecta adulteração de arquivo, de insumo e de resultado, e não regrava se nada mudou', () => {
  const raiz = raizTemporaria()
  const insumos = insumosDe([fundo('ALFA11'), fundo('BETA11', { cotacao: 70 }), fundo('PAPA11', { ativo: papelAtivo }), fundo('SUSP11', { cotacao: 40 })])
  const logs = []
  const agora = new Date('2026-10-06T12:00:00Z')
  const r = concluir({ raiz, cfg: cfgFolgada, insumos, fontes: [{ papel: 'teste', url: 'x', sha256: 'abc' }], log: (m) => logs.push(m), agora })
  const pasta = path.join(raiz, 'auditoria', 'fii-baratos', '2026-10-06')
  const arquivos = fs.readdirSync(pasta).sort()
  assert.deepEqual(arquivos, ['LEIA-ME.md', 'a-conferir.csv', 'config.json', 'exclusoes.csv', 'insumos.json.gz', 'manifesto.json', 'memoria-de-calculo.json.gz', 'ranking-papel.csv', 'ranking-tijolo.csv', 'resultado.json'])
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(raiz, 'auditoria', 'fii-baratos', 'ultima.json'), 'utf8')).pasta, 'auditoria/fii-baratos/2026-10-06')
  assert.ok(logs.some((l) => /NÃO publicado/.test(l)))
  assert.ok(!fs.existsSync(path.join(raiz, 'webapp-src')), 'o job não escreve nada no app')
  const manifesto = JSON.parse(fs.readFileSync(path.join(pasta, 'manifesto.json'), 'utf8'))
  assert.equal(manifesto.publicadoNoApp, false)
  assert.equal(manifesto.hashes.resultado, r.hashes.resultado)

  // verificador independente: só com a pasta de scripts + o cálculo, em ambiente de terceiro, sem os outros arquivos
  const terceiro = fs.mkdtempSync(path.join(os.tmpdir(), 'fii-terceiro-'))
  fs.mkdirSync(path.join(terceiro, 'scripts'))
  for (const a of ['fii-baratos-calculo.mjs', 'fii-baratos-verificar.mjs']) fs.copyFileSync(path.join(AQUI, a), path.join(terceiro, 'scripts', a))
  const copia = path.join(terceiro, 'execucao')
  fs.cpSync(pasta, copia, { recursive: true })
  const roda = () => spawnSync(process.execPath, [path.join(terceiro, 'scripts', 'fii-baratos-verificar.mjs'), copia], { encoding: 'utf8' })
  const ok = roda()
  assert.equal(ok.status, 0, ok.stdout + ok.stderr)
  assert.match(ok.stdout, /VERIFICAÇÃO: OK/)
  assert.match(ok.stdout, /resultado recalculado.*confere/)

  assert.equal(verificar(pasta, raiz).ok, true)

  // adulteração 1: ranking.csv editado à mão
  fs.appendFileSync(path.join(copia, 'ranking-tijolo.csv'), 'FRAUDE;;;;;;;;\n')
  assert.equal(roda().status, 1)
  fs.copyFileSync(path.join(pasta, 'ranking-tijolo.csv'), path.join(copia, 'ranking-tijolo.csv'))
  assert.equal(roda().status, 0)

  // adulteração 2: insumo trocado E manifesto "consertado" para bater o hash do arquivo: o hash canônico e o recálculo pegam
  const ins = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(copia, 'insumos.json.gz'))).toString('utf8'))
  ins.fundos[0].cotacao = 1
  fs.writeFileSync(path.join(copia, 'insumos.json.gz'), zlib.gzipSync(JSON.stringify(ins)))
  const man = JSON.parse(fs.readFileSync(path.join(copia, 'manifesto.json'), 'utf8'))
  const sha = (f) => spawnSync(process.execPath, ['-e', `process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync(${JSON.stringify(f)})).digest('hex'))`], { encoding: 'utf8' }).stdout
  man.hashes.arquivos['insumos.json.gz'] = sha(path.join(copia, 'insumos.json.gz'))
  fs.writeFileSync(path.join(copia, 'manifesto.json'), JSON.stringify(man))
  const falho = roda()
  assert.equal(falho.status, 1)
  assert.match(falho.stdout, /insumos: hash canônico DIVERGE/)
  assert.match(falho.stdout, /resultado recalculado DIVERGE/)

  // reexecução com os mesmos insumos: não regrava
  const antes = fs.statSync(path.join(pasta, 'manifesto.json')).mtimeMs
  const logs2 = []
  concluir({ raiz, cfg: cfgFolgada, insumos, log: (m) => logs2.push(m), agora: new Date('2026-10-06T18:00:00Z') })
  assert.ok(logs2.some((l) => /Sem mudança/.test(l)))
  assert.equal(fs.statSync(path.join(pasta, 'manifesto.json')).mtimeMs, antes)
})

test('trava de sanidade: o job termina com erro, mas a auditoria fica gravada para diagnóstico', () => {
  const raiz = raizTemporaria()
  assert.throws(() => concluir({ raiz, cfg, insumos: insumosDe([fundo('ALFA11')]), log: () => {} }), /trava de sanidade.*tijolo/)
  assert.ok(fs.existsSync(path.join(raiz, 'auditoria', 'fii-baratos', '2026-10-06', 'manifesto.json')))
})

test('CSV: cabeçalho e linhas com o mesmo número de colunas; a conferir sai com "grupo" no lugar da posição', () => {
  const { resultado } = calcular(insumosDe([fundo('ALFA11'), fundo('SUSP11', { cotacao: 40 })]), cfg)
  for (const [lista, opcoes] of [[resultado.tijolo, {}], [resultado.aConferir, { comPosicao: false }]]) {
    const linhas = csvRanking(lista, opcoes).replace(/^﻿/, '').trim().split('\r\n')
    assert.ok(linhas.length > 1)
    assert.ok(linhas.every((l) => l.split(';').length === linhas[0].split(';').length))
  }
  assert.match(csvRanking(resultado.aConferir, { comPosicao: false }), /^﻿grupo;ticker/)
  assert.match(csvRanking(resultado.aConferir, { comPosicao: false }), /tijolo;SUSP11/)
  assert.equal(canonico({ b: 1, a: [2, undefined] }), '{"a":[2,null],"b":1}')
})
