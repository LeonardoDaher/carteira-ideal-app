// POST /api/top15  { codigo }
//
// Devolve o Top 15 ações mais baratas (dados-privados/acoes-baratas.json) a quem informar o código
// do mês. Toda a lógica está em _top15.ts (testada em scripts/top15-acesso.test.mjs); aqui só se
// ligam as dependências reais: variável de ambiente, arquivo e Redis.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { criarHandler, limitadorComReserva, limitadorEmMemoria, limitadorRedis } from './_top15.js'
import type { EventoDeAcesso } from './_top15.js'
import { dataBrasilia } from './_eventos.js'
import { metricasHabilitadas, pipeline } from './_redis.js'

const reserva = limitadorEmMemoria()

async function lerDados(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'dados-privados', 'acoes-baratas.json'), 'utf8'))
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
    await pipeline([['HINCRBY', `top15:acessos:${dataBrasilia().slice(0, 7)}`, evento, 1]])
  },
})
