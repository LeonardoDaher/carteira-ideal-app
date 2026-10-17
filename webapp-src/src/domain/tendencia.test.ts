import { describe, expect, it } from 'vitest'
import { lerTendencia, volImplicitaPertoDoDinheiro } from './tendencia'
import type { AtivoComOpcoes, SerieOpcao, TendenciaAtivo } from './opcoes'
import { precoBs } from './simulaOpcoes'

const base: TendenciaAtivo = {
  data: '2026-10-16', fechamento: 12, sma21: 10, sma63: 8, retorno21: 20, retorno63: 25, posicao52: 95, volRealizada21: 30, volRealizada63: 28,
}

describe('lerTendencia', () => {
  it('preço acima da média curta, que está acima da longa, com retorno de 63 pregões de pelo menos 3%: alta', () => {
    const l = lerTendencia(base)
    expect(l.leitura).toBe('alta')
    expect(l.motivos[0]).toMatch(/Preço R\$\s12,00/)
    expect(l.motivos.join(' ')).toMatch(/\+25,0% em 63/)
    expect(l.motivos.join(' ')).toMatch(/95% /)
  })

  it('o inverso é baixa', () => {
    expect(lerTendencia({ ...base, fechamento: 8, sma21: 10, sma63: 12, retorno21: -15, retorno63: -30 }).leitura).toBe('baixa')
  })

  it('médias alinhadas com retorno pequeno, ou desalinhadas, são lateral, e o motivo explica', () => {
    const pequeno = lerTendencia({ ...base, retorno63: 2 })
    expect(pequeno.leitura).toBe('lateral')
    expect(pequeno.motivos.join(' ')).toMatch(/retorno de 63 pregões é pequeno/)
    const misturado = lerTendencia({ ...base, fechamento: 9, sma21: 10, sma63: 8 })
    expect(misturado.leitura).toBe('lateral')
    expect(misturado.motivos.join(' ')).toMatch(/não estão alinhados/)
  })

  it('sem a posição na faixa de 52 semanas, não cita a faixa', () => {
    expect(lerTendencia({ ...base, posicao52: null }).motivos.join(' ')).not.toMatch(/52 semanas/)
  })
})

describe('volImplicitaPertoDoDinheiro', () => {
  const HOJE = '2026-10-16'
  const VENC = '2026-11-19'
  const r = Math.log(1.1375)
  const serie = (codigo: string, tipo: 'call' | 'put', strike: number, extra: Partial<SerieOpcao> = {}): SerieOpcao => ({
    codigo, tipo, estilo: 'europeia', strike, vencimento: VENC, dataUltimo: HOJE, variacao: null, negocios: 10, volume: 1,
    ultimo: Math.round(precoBs({ tipo, s: 10, strike, t: 22 / 252, r, sigma: 0.4 }) * 100) / 100, ...extra,
  })
  const ativo = (series: SerieOpcao[]): AtivoComOpcoes => ({ ticker: 'X3', nome: 'X', cotacao: 10, volumeOpcoes: 1, lote: 100, series })

  it('média das séries a até 3% do preço, perto da volatilidade usada para precificar', () => {
    const v = volImplicitaPertoDoDinheiro(ativo([serie('C', 'call', 10), serie('P', 'put', 10), serie('C2', 'call', 10.2), serie('LONGE', 'call', 12)]), VENC, HOJE, 13.75)
    expect(v).toBeGreaterThan(36)
    expect(v).toBeLessThan(44)
  })

  it('ignora outros vencimentos e séries com menos de 3 negócios; sem nenhuma série, devolve null', () => {
    expect(volImplicitaPertoDoDinheiro(ativo([serie('C', 'call', 10, { negocios: 2 })]), VENC, HOJE, 13.75)).toBeNull()
    expect(volImplicitaPertoDoDinheiro(ativo([serie('C', 'call', 10, { vencimento: '2026-12-18' })]), VENC, HOJE, 13.75)).toBeNull()
    expect(volImplicitaPertoDoDinheiro(ativo([]), VENC, HOJE, 13.75)).toBeNull()
  })
})
