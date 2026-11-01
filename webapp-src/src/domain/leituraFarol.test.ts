import { describe, expect, it } from 'vitest'
import type { Barra, ZonaPreco } from './analiseTecnica'
import type { EntradaDaLeitura } from './leituraFarol'
import { leituraFarol } from './leituraFarol'
import { sinaisDeCandle } from './sinaisDeCandle'

function dia(i: number): string {
  const d = new Date('2025-01-06T12:00:00Z')
  let n = 0
  while (n < i) {
    d.setUTCDate(d.getUTCDate() + 1)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) n++
  }
  return d.toISOString().slice(0, 10)
}
const b = (i: number, abe: number, fech: number, max: number, min: number, vol = 1000): Barra => ({ data: dia(i), abe, fech, max, min, vol })
const calmo = (n = 40, vol = 1000): Barra[] => Array.from({ length: n }, (_, i) => b(i, 100, 100, 101, 99, vol))

const zona = (tipo: ZonaPreco['tipo'], inferior: number, superior: number): ZonaPreco => ({ tipo, inferior, superior, distanciaPct: 0, toques: 3, relevancia: 'alta', ultimaReacao: '', confirmacao: '', invalidacao: '' })

function entrada(barras: Barra[], extra: Partial<EntradaDaLeitura> = {}): EntradaDaLeitura {
  return { barras, sinais: sinaisDeCandle(barras), zonas: [], gaps: [], caixa: null, media200Semanas: null, tendenciaDiaria: 'consolidacao', tendenciaSemanal: 'consolidacao', ...extra }
}

const ignicaoAlta = (vol = 1500) => [...calmo(), b(40, 100, 103.2, 103.4, 100, vol)]

describe('leituraFarol', () => {
  it('candles calmos: sem sinal, sem gatilho e sem stop', () => {
    const l = leituraFarol(entrada(calmo(60)))
    expect(l.setup).toBeNull()
    expect(l.valido).toBe(false)
    expect(l.conclusao).toMatch(/^Sem sinal/)
    expect(l.naoAvaliado.length).toBe(2)
  })

  it('histórico curto não tem leitura', () => {
    expect(leituraFarol(entrada(calmo(20))).conclusao).toMatch(/histórico curto/)
  })

  it('ignição de alta com resistência acima: alvo na resistência e retorno/risco medido contra o stop', () => {
    const l = leituraFarol(entrada(ignicaoAlta(), { zonas: [zona('resistencia', 110, 111), zona('suporte', 95, 96)] }))
    expect(l.setup?.tipo).toBe('ignicao-alta')
    expect(l.alvo?.preco).toBe(110)
    expect(l.alvo?.origem).toContain('resistência')
    expect(l.retornoRisco).toBeCloseTo((110 - 103.4) / 3.4, 6)
    expect(l.valido).toBe(true)
    expect(l.conclusao).toMatch(/^Setup: Barra de ignição de alta/)
    expect(l.filtros.map((f) => f.chave)).toEqual(['liquidez', 'stop', 'retorno-risco', 'esticada', 'exaustao', 'tendencia'])
  })

  it('obstáculo perto do gatilho: retorno/risco abaixo de 1 reprova e a conclusão diz onde', () => {
    const l = leituraFarol(entrada(ignicaoAlta(), { zonas: [zona('resistencia', 104.5, 105)] }))
    expect(l.retornoRisco).toBeLessThan(1)
    expect(l.filtros.find((f) => f.chave === 'retorno-risco')?.status).toBe('reprova')
    expect(l.valido).toBe(false)
    expect(l.conclusao).toMatch(/^Sinal reprovado/)
    expect(l.conclusao).toContain('retorno/risco')
  })

  it('o alvo é o obstáculo mais próximo entre zona, gap, média de 200 semanas e altura da base', () => {
    const gap = { data: '2025-01-02', tipo: 'baixa' as const, inferior: 107, superior: 108, meio: 107.5, preenchido: 0 }
    const l = leituraFarol(entrada(ignicaoAlta(), { zonas: [zona('resistencia', 112, 113)], gaps: [gap], media200Semanas: 115 }))
    expect(l.alvo?.preco).toBe(107)
    expect(l.alvo?.origem).toContain('gap de baixa')
  })

  it('sem nada à frente o alvo fica vazio e o retorno/risco vira alerta, não reprovação', () => {
    const l = leituraFarol(entrada(ignicaoAlta()))
    expect(l.alvo).toBeNull()
    expect(l.retornoRisco).toBeNull()
    expect(l.filtros.find((f) => f.chave === 'retorno-risco')?.status).toBe('alerta')
    expect(l.valido).toBe(true)
    expect(l.conclusao).toContain('sem alvo técnico')
  })

  it('liquidez abaixo de R$ 1 milhão por dia reprova', () => {
    const barras = [...calmo(40, 500), b(40, 100, 103.2, 103.4, 100, 750)]
    const l = leituraFarol(entrada(barras, { zonas: [zona('resistencia', 110, 111)] }))
    expect(l.setup).not.toBeNull()
    expect(l.filtros.find((f) => f.chave === 'liquidez')?.status).toBe('reprova')
    expect(l.valido).toBe(false)
  })

  it('tendência diária e semanal contra a compra reprova; só uma delas é alerta', () => {
    const duas = leituraFarol(entrada(ignicaoAlta(), { tendenciaDiaria: 'baixa', tendenciaSemanal: 'baixa' }))
    expect(duas.filtros.find((f) => f.chave === 'tendencia')?.status).toBe('reprova')
    const uma = leituraFarol(entrada(ignicaoAlta(), { tendenciaDiaria: 'baixa' }))
    expect(uma.filtros.find((f) => f.chave === 'tendencia')?.status).toBe('alerta')
  })

  it('venda: alvo no suporte abaixo do gatilho', () => {
    const barras = [...calmo(), b(40, 100, 96.8, 100, 96.6, 1500)]
    const l = leituraFarol(entrada(barras, { zonas: [zona('suporte', 90, 91)] }))
    expect(l.setup?.lado).toBe('venda')
    expect(l.alvo?.preco).toBe(91)
    expect(l.retornoRisco).toBeCloseTo((96.6 - 91) / 3.4, 6)
  })

  it('sem sinal, mas com 12 altas seguidas: a conclusão cita a exaustão', () => {
    const altas = Array.from({ length: 12 }, (_, k) => b(40 + k, 100 + k * 0.1, 100.1 + k * 0.1, 100.2 + k * 0.1, 99.9 + k * 0.1))
    const l = leituraFarol(entrada([...calmo(), ...altas]))
    expect(l.setup).toBeNull()
    expect(l.conclusao).toMatch(/^Sem sinal/)
    expect(l.conclusao).toContain('fechamentos seguidos')
  })

  it('stop inviável para swing reprova mesmo com alvo longe', () => {
    const barras = [...calmo(), b(40, 100, 103.2, 103.4, 80, 1500)]
    const l = leituraFarol(entrada(barras, { zonas: [zona('resistencia', 140, 141)] }))
    expect(l.setup?.faixaDoStop).toBe('inviavel')
    expect(l.filtros.find((f) => f.chave === 'stop')?.status).toBe('reprova')
    expect(l.valido).toBe(false)
  })
})
