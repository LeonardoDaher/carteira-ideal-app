import { useCallback, useEffect, useState } from 'react'

/**
 * Dados de mercado carregados sob demanda (D137).
 *
 * Antes, os 20 JSON gerados pelos jobs diários eram importados pelo código e embutidos no `index.html` do app (cerca de 2,5 MB dos
 * 3 MB do arquivo, 86% do que se baixa), e toda atualização de preço invalidava o cache do código também. Agora cada JSON é
 * publicado como arquivo próprio em `dados/<chave>.json` (o plugin de `vite.config.ts` o copia no build) e é baixado só quando a
 * pessoa abre uma tela que precisa dele. O questionário, o resultado, a carteira, as aulas e o Meu Mês não baixam nenhum.
 *
 * Como funciona, para não mexer em dezenas de telas: cada módulo `snapshot*.ts` continua exportando a mesma constante de antes
 * (`SNAPSHOT_ACOES` etc.), agora como `export let`, que o registro preenche quando o arquivo chega (ligação viva do ES module).
 * O `App.tsx` só renderiza uma tela depois que todos os arquivos que ela alcança estão carregados (`ComDados`). Quem lê uma
 * constante antes disso leva um erro alto, em vez de mostrar dado vazio como se fosse verdadeiro. O teste
 * `dadosPorTela.test.ts` confere que a tabela de `DADOS_DA_TELA` cobre tudo o que cada tela importa, direta ou indiretamente.
 */

/** Chave = nome do arquivo em `src/data/` sem o `.json` (os jobs continuam gravando lá; o build publica em `dados/`). */
export const CHAVES_DE_DADOS = [
  'acoes',
  'acoesBaratas',
  'acoesDividendos',
  'acoesEndividadas',
  'acoesMaisNegociadas',
  'bdrs',
  'bdrsDesconto',
  'bdrsMaisNegociados',
  'etfs',
  'etfsMaisNegociados',
  'fiiBaratos',
  'fiisMaisNegociados',
  'fiisPreco',
  'futuros',
  'ibovMaioresPesos',
  'ifixMaioresPesos',
  'mercadoOficial',
  'radarDividendos',
  'radarInteligente',
  'rendimentosFii',
] as const

export type ChaveDeDados = (typeof CHAVES_DE_DADOS)[number]

const valores = new Map<ChaveDeDados, unknown>()
const aplicadores = new Map<ChaveDeDados, Set<(dados: unknown) => void>>()
const buscando = new Map<ChaveDeDados, Promise<void>>()

/** Cada módulo `snapshot*.ts` registra aqui como preencher a sua constante. Se o dado já chegou, preenche na hora. */
export function registrarDados<T>(chave: ChaveDeDados, aplicar: (dados: T) => void): void {
  const f = aplicar as (dados: unknown) => void
  const conjunto = aplicadores.get(chave) ?? new Set()
  conjunto.add(f)
  aplicadores.set(chave, conjunto)
  if (valores.has(chave)) f(valores.get(chave))
}

/** Entrega o dado ao registro (usado pelo download e pelos testes, que carregam os arquivos do disco). */
export function definirDados(chave: ChaveDeDados, dados: unknown): void {
  valores.set(chave, dados)
  for (const f of aplicadores.get(chave) ?? []) f(dados)
}

export function dadosProntos(chaves: readonly ChaveDeDados[]): boolean {
  return chaves.every((c) => valores.has(c))
}

async function baixar(chave: ChaveDeDados): Promise<void> {
  const resposta = await fetch(new URL(`dados/${chave}.json`, document.baseURI))
  if (!resposta.ok) throw new Error(`dados/${chave}.json respondeu ${resposta.status}`)
  definirDados(chave, await resposta.json())
}

/** Baixa o que falta, em paralelo. Pedidos repetidos do mesmo arquivo dividem a mesma busca; falha não fica guardada. */
export function carregarDados(chaves: readonly ChaveDeDados[]): Promise<void> {
  const pendentes = chaves.filter((c) => !valores.has(c)).map((c) => {
    let busca = buscando.get(c)
    if (!busca) {
      busca = baixar(c).finally(() => buscando.delete(c))
      buscando.set(c, busca)
    }
    return busca
  })
  return pendentes.length ? Promise.all(pendentes).then(() => undefined) : Promise.resolve()
}

export type EstadoDosDados = 'pronto' | 'carregando' | 'erro'

/** Estado do carregamento de um conjunto de arquivos. Já carregados: `pronto` na primeira renderização, sem piscar. */
export function useDadosDeMercado(chaves: readonly ChaveDeDados[]): [EstadoDosDados, () => void] {
  // `rodada` sobe quando o download termina ou quando a pessoa pede "tentar de novo": refaz a leitura do registro e o efeito.
  const [rodada, setRodada] = useState(0)
  const [falhou, setFalhou] = useState(false)
  const pronto = dadosProntos(chaves)
  const lista = chaves.join(',')

  useEffect(() => {
    const pedidas = (lista ? lista.split(',') : []) as ChaveDeDados[]
    if (dadosProntos(pedidas)) return
    let vivo = true
    setFalhou(false)
    carregarDados(pedidas)
      .then(() => vivo && setRodada((n) => n + 1))
      .catch(() => vivo && setFalhou(true))
    return () => {
      vivo = false
    }
  }, [lista, rodada])

  const tentarDeNovo = useCallback(() => setRodada((n) => n + 1), [])
  return [pronto ? 'pronto' : falhou ? 'erro' : 'carregando', tentarDeNovo]
}

/** Só para testes: apaga tudo o que foi carregado. */
export function limparDadosParaTeste(): void {
  valores.clear()
  buscando.clear()
}
