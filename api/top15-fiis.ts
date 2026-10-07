// POST /api/top15-fiis  { codigo }
//
// Devolve o Top 15 FIIs baratos (dados-privados/fii-baratos.json) a quem informar o código do mês, o MESMO
// do Top 15 de ações (variável TOP15_CODIGOS da Vercel, nunca no repositório), com o mesmo limite de tentativas
// por IP (o hash do IP é o mesmo, então errar aqui conta junto com errar em /api/top15). Toda a lógica está em
// _top15.ts (testada em scripts/top15-acesso.test.mjs); aqui só se ligam as dependências reais.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { criarHandler, limitadorComReserva, limitadorEmMemoria, limitadorRedis } from './_top15.js'
import type { EventoDeAcesso } from './_top15.js'
import { dataBrasilia } from './_eventos.js'
import { metricasHabilitadas, pipeline } from './_redis.js'

const reserva = limitadorEmMemoria()

async function lerDados(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'dados-privados', 'fii-baratos.json'), 'utf8'))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export default criarHandler({
  codigos: () => process.env.TOP15_CODIGOS,
  lerDados,
  limitador: metricasHabilitadas() ? limitadorComReserva(limitadorRedis(pipeline), reserva) : reserva,
  sal: process.env.TOP15_SAL ?? '',
  contar: async (evento: EventoDeAcesso) => {
    if (!metricasHabilitadas()) return
    await pipeline([['HINCRBY', `top15fiis:acessos:${dataBrasilia().slice(0, 7)}`, evento, 1]])
  },
})
