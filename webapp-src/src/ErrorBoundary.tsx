import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  erro: Error | null
}

/**
 * Rede de segurança para exceções não tratadas em qualquer tela (ex.: um dado inesperado
 * chegando em `gerarRecomendacao` ou em algum componente de apresentação). Sem isso, uma
 * exceção durante a renderização derruba a árvore inteira do React e deixa a tela em
 * branco, sem qualquer chance de o usuário se recuperar sem fechar e reabrir o app.
 *
 * Propositalmente não tenta "adivinhar" uma recuperação parcial: como o estado do app vive
 * inteiro em `useAppState` (fora desta boundary), a única forma de garantir consistência
 * depois de um erro é reiniciar o app do zero — daí o botão chamar `limparEComecarDeNovo`,
 * que apaga o estado persistido e recarrega a página.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erro: null }

  static getDerivedStateFromError(erro: Error): State {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Erro não tratado na árvore do app:', erro, info.componentStack)
  }

  limparEComecarDeNovo = () => {
    try {
      localStorage.removeItem('carteiraideal.estado')
    } catch {
      // sem acesso ao localStorage — segue para o reload mesmo assim
    }
    window.location.reload()
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="app-frame">
          <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 18 }}>Algo deu errado</h1>
            <p className="muted small">
              Encontramos um problema inesperado nesta tela. Você pode tentar recomeçar — suas respostas salvas serão apagadas.
            </p>
            <button className="btn btn-outline" onClick={this.limparEComecarDeNovo}>
              Recomeçar o app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
