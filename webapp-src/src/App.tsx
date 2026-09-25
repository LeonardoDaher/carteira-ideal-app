import type React from 'react'
import { useAppState } from './state/useAppState'
import { Onboarding } from './screens/Onboarding'
import { Idade } from './screens/Idade'
import { Questionario } from './screens/Questionario'
import { QuestionarioArquitetura } from './screens/QuestionarioArquitetura'
import { Processando } from './screens/Processando'
import { Resultado } from './screens/Resultado'
import { Carteira } from './screens/Carteira'
import { Simulador } from './screens/Simulador'
import { DetalheAtivo } from './screens/DetalheAtivo'
import { Aprender } from './screens/Aprender'
import { Trilha } from './screens/Trilha'
import { AprenderVideo } from './screens/AprenderVideo'
import { SimuleFii } from './screens/SimuleFii'
import { SimuleTesouro } from './screens/SimuleTesouro'

function App() {
  const ctx = useAppState()

  // Enquanto lê o estado salvo no aparelho, não renderiza nada: evita piscar a tela de
  // onboarding antes de restaurar onde o usuário parou.
  if (!ctx.hidratado) return <div className="app-frame" />

  const screens: Record<typeof ctx.screen, () => React.ReactElement> = {
    onboarding: () => <Onboarding ctx={ctx} />,
    idade: () => <Idade ctx={ctx} />,
    questionario: () => <Questionario ctx={ctx} />,
    questionarioArquitetura: () => <QuestionarioArquitetura ctx={ctx} />,
    processando: () => <Processando ctx={ctx} />,
    resultado: () => <Resultado ctx={ctx} />,
    carteira: () => <Carteira ctx={ctx} />,
    simulador: () => <Simulador ctx={ctx} />,
    detalheAtivo: () => <DetalheAtivo ctx={ctx} key={ctx.ativoSelecionado} />,
    aprender: () => <Aprender ctx={ctx} />,
    simuleFii: () => <SimuleFii ctx={ctx} />,
    simuleTesouro: () => <SimuleTesouro ctx={ctx} />,
    trilha: () => <Trilha ctx={ctx} key={ctx.trilhaSelecionadaId} />,
    aprenderVideo: () => <AprenderVideo ctx={ctx} key={ctx.aulaAtualRef ? `${ctx.aulaAtualRef.trilhaId}:${ctx.aulaAtualRef.topicoId}:${ctx.aulaAtualRef.aulaId}` : 'nenhuma'} />,
  }

  return <div className="app-frame">{screens[ctx.screen]()}</div>
}

export default App
