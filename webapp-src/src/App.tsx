import { Suspense, useEffect } from 'react'
import type React from 'react'
import { useAppState } from './state/useAppState'
import { Onboarding } from './screens/Onboarding'
import { Marca } from './ui/Marca'
import { ComDados } from './ui/ComDados'
import { DADOS_DA_TELA } from './data/dadosDaTela'
import type { Screen } from './state/useAppState'
import { telaPreguicosa } from './ui/telaPreguicosa'
import type { TelaPreguicosa } from './ui/telaPreguicosa'

// Cada tela, menos a inicial, é um arquivo próprio baixado quando a pessoa chega nela (D138).
const Idade = telaPreguicosa(() => import('./screens/Idade'), 'Idade')
const Questionario = telaPreguicosa(() => import('./screens/Questionario'), 'Questionario')
const QuestionarioArquitetura = telaPreguicosa(() => import('./screens/QuestionarioArquitetura'), 'QuestionarioArquitetura')
const Processando = telaPreguicosa(() => import('./screens/Processando'), 'Processando')
const Resultado = telaPreguicosa(() => import('./screens/Resultado'), 'Resultado')
const Carteira = telaPreguicosa(() => import('./screens/Carteira'), 'Carteira')
const Simulador = telaPreguicosa(() => import('./screens/Simulador'), 'Simulador')
const DetalheAtivo = telaPreguicosa(() => import('./screens/DetalheAtivo'), 'DetalheAtivo')
const Aprender = telaPreguicosa(() => import('./screens/Aprender'), 'Aprender')
const Trilha = telaPreguicosa(() => import('./screens/Trilha'), 'Trilha')
const AprenderVideo = telaPreguicosa(() => import('./screens/AprenderVideo'), 'AprenderVideo')
const SimuleFii = telaPreguicosa(() => import('./screens/SimuleFii'), 'SimuleFii')
const SimuleTesouro = telaPreguicosa(() => import('./screens/SimuleTesouro'), 'SimuleTesouro')
const SimuleBdr = telaPreguicosa(() => import('./screens/SimuleBdr'), 'SimuleBdr')
const SimuleEtf = telaPreguicosa(() => import('./screens/SimuleEtf'), 'SimuleEtf')
const SimuleFuturos = telaPreguicosa(() => import('./screens/SimuleFuturos'), 'SimuleFuturos')
const SimuleOpcoes = telaPreguicosa(() => import('./screens/SimuleOpcoes'), 'SimuleOpcoes')
const SimuleAtivos = telaPreguicosa(() => import('./screens/SimuleAtivos'), 'SimuleAtivos')
const SimuleAcoes = telaPreguicosa(() => import('./screens/SimuleAcoes'), 'SimuleAcoes')
const SimuleBens = telaPreguicosa(() => import('./screens/SimuleBens'), 'SimuleBens')
const SuaHp12c = telaPreguicosa(() => import('./screens/SuaHp12c'), 'SuaHp12c')
const SimuleImovel = telaPreguicosa(() => import('./screens/SimuleImovel'), 'SimuleImovel')
const SimuleCarro = telaPreguicosa(() => import('./screens/SimuleCarro'), 'SimuleCarro')
const SimuleMoto = telaPreguicosa(() => import('./screens/SimuleMoto'), 'SimuleMoto')
const MeuMes = telaPreguicosa(() => import('./screens/MeuMes'), 'MeuMes')
const MinhaCarteira = telaPreguicosa(() => import('./screens/MinhaCarteira'), 'MinhaCarteira')

const TELAS_PRELOAD: Partial<Record<Screen, TelaPreguicosa>> = {
  idade: Idade, questionario: Questionario, questionarioArquitetura: QuestionarioArquitetura, processando: Processando, resultado: Resultado,
  carteira: Carteira, simulador: Simulador, detalheAtivo: DetalheAtivo, aprender: Aprender, simuleFii: SimuleFii, simuleTesouro: SimuleTesouro,
  simuleBdr: SimuleBdr, simuleEtf: SimuleEtf, simuleFuturos: SimuleFuturos, simuleOpcoes: SimuleOpcoes, simuleAcoes: SimuleAcoes,
  simuleAtivos: SimuleAtivos, simuleImovel: SimuleImovel, simuleCarro: SimuleCarro, simuleMoto: SimuleMoto, simuleBens: SimuleBens,
  suaHp12c: SuaHp12c, meuMes: MeuMes, minhaCarteira: MinhaCarteira, trilha: Trilha, aprenderVideo: AprenderVideo,
}

// Quem está na tela inicial quase sempre segue para o questionário: baixa essas telas em segundo plano, quando o navegador
// está ocioso, para a passagem de uma para a outra não esperar a rede.
const FLUXO_DO_QUESTIONARIO = [Idade, Questionario, QuestionarioArquitetura, Processando, Resultado, Carteira]

const TELAS_COM_LOGO_PROPRIA: Screen[] = ['onboarding', 'aprender', 'simuleTesouro', 'simuleFii', 'simuleBdr', 'simuleEtf', 'simuleFuturos', 'simuleOpcoes', 'simuleAcoes', 'simuleAtivos', 'simuleImovel', 'simuleCarro', 'simuleMoto', 'simuleBens', 'suaHp12c', 'meuMes', 'minhaCarteira']

function App() {
  const ctx = useAppState()

  // Começa a baixar o código da tela já na hora de decidir qual desenhar, junto com os dados de mercado dela.
  useEffect(() => {
    if (ctx.hidratado) TELAS_PRELOAD[ctx.screen]?.preload()
  }, [ctx.hidratado, ctx.screen])
  useEffect(() => {
    if (!ctx.hidratado || ctx.screen !== 'onboarding') return
    const baixar = () => FLUXO_DO_QUESTIONARIO.forEach((tela) => tela.preload())
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(baixar, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(baixar, 2000)
    return () => window.clearTimeout(id)
  }, [ctx.hidratado, ctx.screen])

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
    simuleBdr: () => <SimuleBdr ctx={ctx} />,
    simuleEtf: () => <SimuleEtf ctx={ctx} />,
    simuleFuturos: () => <SimuleFuturos ctx={ctx} />,
    simuleOpcoes: () => <SimuleOpcoes ctx={ctx} />,
    simuleAcoes: () => <SimuleAcoes ctx={ctx} />,
    simuleAtivos: () => <SimuleAtivos ctx={ctx} />,
    simuleImovel: () => <SimuleImovel ctx={ctx} />,
    simuleCarro: () => <SimuleCarro ctx={ctx} />,
    simuleMoto: () => <SimuleMoto ctx={ctx} />,
    simuleBens: () => <SimuleBens ctx={ctx} />,
    suaHp12c: () => <SuaHp12c ctx={ctx} />,
    meuMes: () => <MeuMes ctx={ctx} />,
    minhaCarteira: () => <MinhaCarteira ctx={ctx} />,
    trilha: () => <Trilha ctx={ctx} key={ctx.trilhaSelecionadaId} />,
    aprenderVideo: () => <AprenderVideo ctx={ctx} key={ctx.aulaAtualRef ? `${ctx.aulaAtualRef.trilhaId}:${ctx.aulaAtualRef.topicoId}:${ctx.aulaAtualRef.aulaId}` : 'nenhuma'} />,
  }

  // A classe tela-* deixa o CSS escolher a largura da tela no computador (D20): questionário
  // estreito, leitura média, painéis largos. No celular todas ocupam a mesma coluna de sempre.
  // Logo no topo de cada tela (D20). As telas com "← Início" já trazem a logo ao lado do
  // link (VoltarInicio) e a tela inicial a traz acima do seletor Claro/Escuro. No computador,
  // nas telas com abas, a logo fica no topo do menu lateral e esta some pelo CSS.
  const temLogoPropria = TELAS_COM_LOGO_PROPRIA.includes(ctx.screen)
  const chavesDaTela = DADOS_DA_TELA[ctx.screen]
  return (
    <div className={`app-frame tela-${ctx.screen}`}>
      {!temLogoPropria && <Marca className="marca-topo" />}
      <Suspense fallback={<p className="tiny muted" role="status" style={{ margin: '32px 0', textAlign: 'center' }}>Carregando a tela…</p>}>
        {chavesDaTela ? <ComDados chaves={chavesDaTela}>{screens[ctx.screen]()}</ComDados> : screens[ctx.screen]()}
      </Suspense>
    </div>
  )
}

export default App
