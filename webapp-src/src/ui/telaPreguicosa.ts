import { lazy } from 'react'
import type { ComponentType } from 'react'
import type { useAppState } from '../state/useAppState'

/**
 * Código de cada tela baixado só quando a pessoa chega nela (D138). Antes, o app era um arquivo único com todas as telas dentro.
 *
 * Cada tela vira um arquivo próprio, com nome que muda quando o código dela muda. Dois cuidados:
 *  - `preload()` começa o download do arquivo da tela antes de ela ser desenhada, em paralelo com os dados de mercado dela
 *    (ComDados), em vez de um depois do outro;
 *  - se o arquivo não existir mais (a pessoa deixou o app aberto enquanto saiu uma versão nova, e o arquivo antigo saiu do ar),
 *    a página recarrega uma vez para pegar a versão nova. A trava fica no sessionStorage para não recarregar em loop se o
 *    problema for a rede: na segunda falha o erro aparece na tela de erro do app, com a opção de tentar de novo.
 */

type Ctx = ReturnType<typeof useAppState>
type Tela = ComponentType<{ ctx: Ctx }>

const CHAVE_RECARGA = 'ci:recarga-por-arquivo-antigo'

export type TelaPreguicosa = Tela & { preload: () => Promise<unknown> }

export function telaPreguicosa<M extends Record<string, unknown>>(importar: () => Promise<M>, nome: keyof M & string) {
  const Componente = lazy(async () => {
    try {
      const modulo = await importar()
      try {
        sessionStorage.removeItem(CHAVE_RECARGA)
      } catch {
        // sem sessionStorage (janela privada com dados bloqueados): segue sem a trava
      }
      return { default: modulo[nome] as unknown as Tela }
    } catch (erro) {
      let jaTentou = true
      try {
        jaTentou = sessionStorage.getItem(CHAVE_RECARGA) === '1'
        if (!jaTentou) sessionStorage.setItem(CHAVE_RECARGA, '1')
      } catch {
        // sem sessionStorage: não recarrega, para não correr o risco de laço
      }
      if (!jaTentou) {
        location.reload()
        return new Promise<never>(() => {})
      }
      throw erro
    }
  })
  return Object.assign(Componente, { preload: () => importar().catch(() => undefined) }) as unknown as TelaPreguicosa
}
