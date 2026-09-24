import type { AppCtx, Screen } from '../state/useAppState'

// "Simule FII" e "Aprender" saíram da barra: agora são abertas direto pela landing
// (./app/?tela=simuleFii e ./app/?tela=aprender), sem depender do questionário.
// A barra fica só com as telas que dependem do resultado.
const ABAS: { screen: Screen; label: string; icone: string }[] = [
  { screen: 'resultado', label: 'Perfil', icone: '🧭' },
  { screen: 'carteira', label: 'Carteira', icone: '📊' },
  { screen: 'simulador', label: 'Simular', icone: '🧮' },
]

export function TabBar({ ctx }: { ctx: AppCtx }) {
  return (
    <div className="tabbar">
      {ABAS.map((aba) => (
        <button
          key={aba.screen}
          className={`tab ${ctx.screen === aba.screen ? 'active' : ''}`}
          onClick={() => ctx.setScreen(aba.screen)}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>{aba.icone}</span>
          <span>{aba.label}</span>
        </button>
      ))}
    </div>
  )
}
