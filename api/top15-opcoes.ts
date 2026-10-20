// POST /api/top15-opcoes  { codigo }
//
// Porta do "Top 15 prêmios de opções": confere o código do mês DESTA lista (variável TOP15_OPCOES_CODIGOS da Vercel, nunca no
// repositório; D66/D117). Ele é DIFERENTE dos códigos das ações, dos FIIs e dos BDRs: um não abre o outro, e sem
// TOP15_OPCOES_CODIGOS esta porta fica fechada. Diferente das outras listas, o ranking NÃO sai daqui: ele é calculado no app, com o
// arquivo de opções (público); a função devolve só a confirmação (dados-privados/opcoes-premios.json). O limite de tentativas por IP é
// o mesmo das outras listas. Toda a lógica está em _top15.ts (testada em scripts/top15-acesso.test.mjs).
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { criarHandler, limitadorComReserva, limitadorEmMemoria, limitadorRedis } from './_top15.js'
import type { EventoDeAcesso } from './_top15.js'
import { dataBrasilia } from './_eventos.js'
import { metricasHabilitadas, pipeline } from './_redis.js'

const reserva = limitadorEmMemoria()

async function lerDados(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'dados-privados', 'opcoes-premios.json'), 'utf8'))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
}

export default criarHandler({
  codigos: () => process.env.TOP15_OPCOES_CODIGOS,
  lerDados,
  limitador: metricasHabilitadas() ? limitadorComReserva(limitadorRedis(pipeline), reserva) : reserva,
  sal: process.env.TOP15_SAL ?? '',
  contar: async (evento: EventoDeAcesso) => {
    if (!metricasHabilitadas()) return
    await pipeline([['HINCRBY', `top15opcoes:acessos:${dataBrasilia().slice(0, 7)}`, evento, 1]])
  },
})
