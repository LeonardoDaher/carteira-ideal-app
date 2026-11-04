/**
 * Leva a pessoa até o cartão de resultado depois de escolher um ativo (D44).
 *
 * Celular e tablet em pé (< 960 px): o cartão fica abaixo da lista, então sempre rola até ele.
 * Computador (>= 960 px): o cartão fica numa coluna ao lado da lista, mas só é "fixo" (sticky)
 * quando a janela tem 720 px de altura ou mais. Em notebook com janela baixa a coluna rola junto
 * com a página, e quem clica num ativo no meio da lista deixava o resultado lá em cima. Por isso
 * a regra agora olha onde o cartão está: se o topo dele já está à vista, não mexe; se ficou fora
 * da janela (acima ou abaixo), rola até ele. Sem animação se o aparelho pede menos movimento.
 */
export function rolarParaResultado(id: string, opcoes: { soNoComputador?: boolean } = {}): void {
  requestAnimationFrame(() => {
    const cartao = document.getElementById(id)
    if (!cartao || typeof cartao.scrollIntoView !== 'function') return
    const noComputador = window.matchMedia?.('(min-width: 960px)').matches ?? false
    // Tesouro: no celular o resultado já aparece logo abaixo das opções, então nada muda ali.
    if (opcoes.soNoComputador && !noComputador) return
    if (noComputador) {
      const { top } = cartao.getBoundingClientRect()
      const altura = window.innerHeight || document.documentElement.clientHeight
      // Topo à vista, com folga embaixo para o começo do cartão ser legível: já está bom.
      if (top >= 0 && top <= altura - 160) return
    }
    const semAnimacao = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    cartao.scrollIntoView({ behavior: semAnimacao ? 'auto' : 'smooth', block: 'start' })
  })
}

/**
 * Leva a pessoa ao conteúdo de uma aba (ou de um contrato) logo depois do clique nas caixinhas do topo.
 *
 * As telas Simule têm várias caixinhas empilhadas antes do conteúdo; em qualquer tela o conteúdo da aba escolhida ficava
 * abaixo da dobra e a pessoa precisava rolar. Aqui o topo do painel vai para o topo da janela (com a folga de
 * `scroll-margin-top` do CSS). Se o painel já está encostado no topo, não mexe. Sem animação se o aparelho pede menos movimento.
 */
export function rolarParaPainel(id: string): void {
  // Dois quadros: o primeiro deixa o React trocar o conteúdo, o segundo mede o painel já com a altura nova.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const painel = document.getElementById(id)
      if (!painel || typeof painel.scrollIntoView !== 'function') return
      const { top } = painel.getBoundingClientRect()
      if (Math.abs(top) < 8) return
      const semAnimacao = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      painel.scrollIntoView({ behavior: semAnimacao ? 'auto' : 'smooth', block: 'start' })
    })
  })
}
