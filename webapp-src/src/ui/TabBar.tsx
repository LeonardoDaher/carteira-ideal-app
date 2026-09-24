import type { AppCtx, Screen } from '../state/useAppState'

const ABAS: { screen: Screen; label: string; icone: string }[] = [
  { screen: 'resultado', label: 'Perfil', icone: '🧭' },
  { screen: 'carteira', label: 'Carteira', icone: '📊' },
  { screen: 'simulador', label: 'Simular', icone: '🧮' },
  { screen: 'simuleFii', label: 'Simule FII', icone: '🏢' },
  { screen: 'aprender', label: 'Aprender', icone: '🎓' },
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
