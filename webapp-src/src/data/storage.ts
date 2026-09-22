/**
 * Armazenamento local do app (versão web) — guarda o estado no navegador via localStorage.
 *
 * A versão React Native/Expo tem um arquivo com esta mesma interface, implementado sobre
 * AsyncStorage. Todo o resto do app (inclusive useAppState.ts) é idêntico nas duas versões
 * justamente porque conversa só com esta interface.
 *
 * Toda leitura/escrita é protegida: em aba anônima, com cookies/armazenamento bloqueado ou
 * com a cota estourada, o localStorage lança exceção — nesse caso o app segue funcionando
 * normalmente, só sem lembrar dos dados na próxima abertura.
 */
export const storage = {
  async getItem(chave: string): Promise<string | null> {
    try {
      return localStorage.getItem(chave)
    } catch {
      return null
    }
  },
  async setItem(chave: string, valor: string): Promise<void> {
    try {
      localStorage.setItem(chave, valor)
    } catch {
      // sem espaço ou armazenamento bloqueado — segue sem persistir
    }
  },
  async removeItem(chave: string): Promise<void> {
    try {
      localStorage.removeItem(chave)
    } catch {
      // idem
    }
  },
}
