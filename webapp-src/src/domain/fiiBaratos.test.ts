import { describe, expect, it } from 'vitest'
import { GRUPOS_FII, ROTULO_ALERTA, ROTULO_EXCLUSAO, contarExclusoes, formatarPvp, formatarVolumeDiario, validadeDaConferencia } from './fiiBaratos'
import type { ExclusaoTriagem } from './acoesBaratas'

const ex = (ticker: string, codigo: string): ExclusaoTriagem => ({ ticker, nome: `Fundo ${ticker}`, setor: 'Outros', etapa: 'tijolo', codigo, motivo: 'motivo' })

describe('contarExclusoes', () => {
  it('agrupa por motivo, do mais frequente para o menos, e desempata por ordem alfabética do rótulo', () => {
    const r = contarExclusoes([ex('A', 'liquidez_baixa'), ex('B', 'liquidez_baixa'), ex('C', 'misto'), ex('D', 'fundo_de_fundos'), ex('E', 'liquidez_baixa')])
    expect(r.map((x) => [x.codigo, x.total])).toEqual([['liquidez_baixa', 3], ['fundo_de_fundos', 1], ['misto', 1]])
    expect(r[0].rotulo).toBe('Pouca liquidez')
  })
  it('motivo desconhecido aparece com o próprio código, sem quebrar', () => {
    expect(contarExclusoes([ex('A', 'motivo_novo')])).toEqual([{ codigo: 'motivo_novo', rotulo: 'motivo_novo', total: 1 }])
    expect(contarExclusoes([])).toEqual([])
  })
})

describe('formatação', () => {
  it('P/VP com duas casas e traço quando não existe', () => {
    expect(formatarPvp(0.7363)).toBe('0,74')
    expect(formatarPvp(1)).toBe('1,00')
    expect(formatarPvp(null)).toBe('—')
    expect(formatarPvp(undefined)).toBe('—')
    expect(formatarPvp(Number.NaN)).toBe('—')
  })
  it('volume diário em mil e em milhão de reais', () => {
    expect(formatarVolumeDiario(334_000)).toBe('R$ 334 mil')
    expect(formatarVolumeDiario(2_550_150)).toBe('R$ 2,6 mi')
    expect(formatarVolumeDiario(1_000_000)).toBe('R$ 1,0 mi')
    expect(formatarVolumeDiario(null)).toBe('—')
  })
  it('validade da conferência: data + dias, atravessando o fim do mês e do ano', () => {
    expect(validadeDaConferencia('2026-10-07', 90)).toBe('2027-01-05')
    expect(validadeDaConferencia('2026-01-31', 1)).toBe('2026-02-01')
    expect(validadeDaConferencia('2026-10-07', null)).toBeNull()
  })
})

describe('rótulos', () => {
  it('há texto para os cinco alertas que o job gera, e dois grupos (tijolo e papel)', () => {
    expect(Object.keys(ROTULO_ALERTA).sort()).toEqual(['dy_alto', 'pvp_muito_baixo', 'rendimento_com_pico', 'rendimento_em_queda', 'salto_de_preco'])
    for (const a of Object.values(ROTULO_ALERTA)) expect(a.titulo.length > 5 && a.texto.length > 30).toBe(true)
    expect(GRUPOS_FII.map((g) => g.id)).toEqual(['tijolo', 'papel'])
  })
  it('há rótulo para todos os motivos de exclusão que o cálculo gera', () => {
    for (const c of ['sem_cnpj', 'sem_cotacao', 'sem_preco_diario', 'cotacao_defasada', 'dados_insuficientes', 'fundo_de_fundos', 'misto', 'liquidez_baixa', 'patrimonio_pequeno', 'poucos_cotistas', 'pvp_suspeito', 'dy_implausivel', 'patrimonio_em_queda', 'alavancado']) {
      expect(ROTULO_EXCLUSAO[c], c).toBeTruthy()
    }
  })
})
