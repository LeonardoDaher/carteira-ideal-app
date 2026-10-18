import { describe, expect, it } from 'vitest'
import { OBJETIVOS, perfilDoModelo } from './objetivosDeEstrategia'
import { MODELOS } from './modelosDeEstrategia'

const modelo = (id: string) => MODELOS.find((m) => m.id === id)!

describe('objetivos de estratégia', () => {
  it('cada objetivo tem estruturas, e todas existem no catálogo, sem repetição', () => {
    expect(OBJETIVOS.map((o) => o.id)).toEqual(['renda', 'protecao', 'alta', 'baixa', 'parado', 'movimento'])
    for (const o of OBJETIVOS) {
      expect(o.modelos.length, o.id).toBeGreaterThanOrEqual(2)
      const ids = o.modelos.map((x) => x.id)
      expect(new Set(ids).size, o.id).toBe(ids.length)
      for (const x of o.modelos) {
        expect(MODELOS.some((m) => m.id === x.id), `${o.id}/${x.id}`).toBe(true)
        expect(x.porque.length).toBeGreaterThan(10)
      }
    }
  })

  it('todo modelo do catálogo serve a pelo menos um objetivo', () => {
    const usados = new Set(OBJETIVOS.flatMap((o) => o.modelos.map((x) => x.id)))
    // as vendas a descoberto (straddle e strangle vendidos) ficam de fora de propósito: não se sugere risco ilimitado por objetivo
    const fora = MODELOS.filter((m) => !usados.has(m.id)).map((m) => m.id)
    expect(fora.sort()).toEqual(['straddleVendido', 'strangleVendido'])
  })

  it('os objetivos de renda e de proteção avisam que nada é garantido ou levam à aba certa', () => {
    expect(OBJETIVOS.find((o) => o.id === 'renda')!.cuidado).toMatch(/Nenhuma estrutura garante renda/)
    expect(OBJETIVOS.find((o) => o.id === 'renda')!.cuidado).toMatch(/aba Roda/)
    expect(OBJETIVOS.find((o) => o.id === 'protecao')!.cuidado).toMatch(/botão C/)
  })

  it('a etiqueta de perfil separa risco grande, ações, vencimentos diferentes e risco limitado', () => {
    expect(perfilDoModelo(modelo('slidePut'))).toEqual({ rotulo: 'Risco grande se for contra', tom: 'atencao' })
    expect(perfilDoModelo(modelo('putOtimizada')).tom).toBe('atencao')
    expect(perfilDoModelo(modelo('vendaCoberta'))).toEqual({ rotulo: 'Exige ter as ações', tom: 'info' })
    expect(perfilDoModelo(modelo('thlCall')).tom).toBe('info')
    expect(perfilDoModelo(modelo('straddleComprado'))).toEqual({ rotulo: 'Perda limitada ao prêmio pago', tom: 'limitado' })
    expect(perfilDoModelo(modelo('condorFerro'))).toEqual({ rotulo: 'Ganho e perda limitados', tom: 'limitado' })
  })

  it('nenhum texto promete resultado', () => {
    const tudo = OBJETIVOS.flatMap((o) => [o.resumo, o.cuidado ?? '', ...o.modelos.map((x) => x.porque)]).join(' ').toLowerCase()
    expect(tudo).not.toMatch(/garantid|sem risco|certeza|lucro certo|melhor estrat/)
  })
})
