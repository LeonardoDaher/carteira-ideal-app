import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarRecomendacao, ErroRecomendacao } from '../data/apiRecomendacao'
import { PERGUNTAS } from '../data/questions'
import { PERGUNTAS_ARQUITETURA } from '../data/perguntasArquitetura'
import { storage } from '../data/storage'
import { useQuestionario } from './useQuestionario'
import type { AtivoKey, RespostasArquitetura, RespostasQuestionario, ResultadoRecomendacao } from '../domain/types'

export type Screen =
  | 'onboarding'
  | 'idade'
  | 'questionario'
  | 'questionarioArquitetura'
  | 'processando'
  | 'resultado'
  | 'carteira'
  | 'simulador'
  | 'detalheAtivo'
  | 'aprender'
  | 'trilha'
  | 'aprenderVideo'
  | 'simuleFii'

export type Tema = 'dark' | 'light'

const CHAVE_ARMAZENAMENTO = 'carteiraideal.estado'
const VERSAO_ARMAZENAMENTO = 2

type EstadoPersistido = {
  versao: number
  screen: Screen
  idade: number
  respostas: Partial<RespostasQuestionario>
  respostasArquitetura: Partial<RespostasArquitetura>
  tema: Tema
}

export function useAppState() {
  const [screen, setScreen] = useState<Screen>('onboarding')
  const [idade, setIdade] = useState<number>(30)
  const [valorSimulacao, setValorSimulacao] = useState(1000)
  const [hidratado, setHidratado] = useState(false)
  const [ativoSelecionado, setAtivoSelecionado] = useState<AtivoKey | null>(null)
  const [origemDetalhe, setOrigemDetalhe] = useState<Screen>('resultado')
  const [trilhaSelecionadaId, setTrilhaSelecionadaId] = useState<string | null>(null)
  const [aulaAtualRef, setAulaAtualRef] = useState<{ trilhaId: string; topicoId: string; aulaId: string } | null>(null)
  const [tema, setTema] = useState<Tema>('dark')

  // As 14 perguntas do fluxo (7 de suitability + 7 de Arquitetura Patrimonial) são dois
  // questionários paginados independentes — ver useQuestionario.ts. O que os liga um ao
  // outro é só a navegação entre telas, feita aqui via onCompletar/onVoltarAntesDoInicio.
  const questionario = useQuestionario(PERGUNTAS, {
    onCompletar: () => {
      arquitetura.setPasso(0)
      setScreen('questionarioArquitetura')
    },
    onVoltarAntesDoInicio: () => setScreen('idade'),
  })

  const arquitetura = useQuestionario(PERGUNTAS_ARQUITETURA, {
    onCompletar: () => setScreen('processando'),
    onVoltarAntesDoInicio: () => {
      // Depois das 7 perguntas de suitability, segue direto para as 7 novas perguntas da
      // Arquitetura Patrimonial — voltar da primeira delas devolve à última do suitability.
      questionario.setPasso(PERGUNTAS.length - 1)
      setScreen('questionario')
    },
  })

  useEffect(() => {
    let cancelado = false
    async function carregar() {
      const bruto = await storage.getItem(CHAVE_ARMAZENAMENTO)
      if (cancelado) return
      if (bruto) {
        try {
          const salvo = JSON.parse(bruto) as Partial<EstadoPersistido> | null
          if (salvo && salvo.versao === VERSAO_ARMAZENAMENTO) {
            // Mesma versão: restaura o estado inteiro, como salvo.
            setScreen(salvo.screen ?? 'onboarding')
            setIdade(salvo.idade ?? 30)
            questionario.restaurar(salvo.respostas)
            arquitetura.restaurar(salvo.respostasArquitetura)
            setTema(salvo.tema ?? 'dark')
          } else if (salvo) {
            // Versão diferente da atual: decisão deliberada é descartar o progresso do
            // questionário (a estrutura das respostas pode ter mudado entre versões e não
            // vale a pena escrever um migrador para cada bump), mas preservar o tema, que
            // é só preferência visual e nunca muda de formato entre versões.
            if (salvo.tema === 'dark' || salvo.tema === 'light') setTema(salvo.tema)
          }
        } catch {
          // dado corrompido (JSON inválido): começa do zero em vez de travar o app
        }
      }

      // A landing ("Ver minha carteira de referência") linka para ./app/?tela=resultado
      // quando já existe uma carteira salva neste aparelho. Sem isso, o app abriria na
      // última tela em que o usuário esteve (ex: no meio de uma trilha de aprendizagem),
      // contrariando o que o próprio botão prometeu. O parâmetro só empurra para o
      // resultado — se não houver resultado calculado ainda, a tela de Resultado já
      // mostra o convite para começar o questionário (não quebra nada).
      try {
        const parametros = new URLSearchParams(window.location.search)
        if (parametros.get('tela') === 'resultado') {
          setScreen('resultado')
          // Remove o parâmetro da URL para não prender a navegação seguinte (troca de
          // abas, "Voltar", etc.) a essa tela sempre que a página for recarregada.
          const semParametro = window.location.pathname + window.location.hash
          window.history.replaceState(null, '', semParametro)
        }
      } catch {
        // URL ou history indisponíveis (ambiente de teste, por exemplo): ignora
      }

      setHidratado(true)
    }
    carregar()
    return () => {
      cancelado = true
    }
    // Roda só na montagem: chamar as funções do questionário aqui não deve reagendar a leitura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Aplica o tema escolhido no documento inteiro (não só dentro do app-frame), para que
  // a página toda — inclusive as margens em telas largas — reflita a escolha do usuário.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema)
  }, [tema])

  useEffect(() => {
    if (!hidratado) return
    const estado: EstadoPersistido = {
      versao: VERSAO_ARMAZENAMENTO,
      screen,
      idade,
      respostas: questionario.respostas,
      respostasArquitetura: arquitetura.respostas,
      tema,
    }
    storage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(estado))
  }, [hidratado, screen, idade, questionario.respostas, arquitetura.respostas, tema])

  async function limparDados() {
    await storage.removeItem(CHAVE_ARMAZENAMENTO)
    questionario.reiniciar()
    arquitetura.reiniciar()
    setIdade(30)
    setValorSimulacao(1000)
    setResultado(null)
    setErroResultado(null)
    setScreen('onboarding')
  }

  function iniciarQuestionario() {
    setScreen('idade')
  }

  function confirmarIdade(valor: number) {
    setIdade(valor)
    questionario.setPasso(0)
    setScreen('questionario')
  }

  function finalizarProcessamento() {
    setScreen('resultado')
  }

  /** Abre a análise detalhada de uma classe de ativo, lembrando de qual tela o usuário veio
   * (Resultado ou Carteira) para o botão "Voltar" devolver ao lugar certo. */
  function abrirDetalheAtivo(ativo: AtivoKey) {
    setOrigemDetalhe(screen === 'carteira' ? 'carteira' : 'resultado')
    setAtivoSelecionado(ativo)
    setScreen('detalheAtivo')
  }

  function voltarDoDetalhe() {
    setAtivoSelecionado(null)
    setScreen(origemDetalhe)
  }

  /** Abre a trilha de aprendizagem escolhida na aba "Aprender". */
  function abrirTrilha(trilhaId: string) {
    setTrilhaSelecionadaId(trilhaId)
    setScreen('trilha')
  }

  function voltarDaTrilha() {
    setTrilhaSelecionadaId(null)
    setScreen('aprender')
  }

  /** Abre a aula em vídeo (~2 min) de um tópico dentro de uma trilha. */
  function abrirAula(trilhaId: string, topicoId: string, aulaId: string) {
    setAulaAtualRef({ trilhaId, topicoId, aulaId })
    setScreen('aprenderVideo')
  }

  function voltarDaAula() {
    setAulaAtualRef(null)
    setScreen('trilha')
  }

  // O cálculo da recomendação agora é assíncrono: as respostas são enviadas para
  // /api/recomendacao (função serverless) e o motor real roda no servidor, nunca no
  // navegador do usuário. `idRequisicaoRef` evita "race conditions" — se o usuário voltar
  // e mudar respostas antes da requisição anterior terminar, o resultado antigo é descartado.
  const [resultado, setResultado] = useState<ResultadoRecomendacao | null>(null)
  const [carregandoResultado, setCarregandoResultado] = useState(false)
  const [erroResultado, setErroResultado] = useState<string | null>(null)
  const idRequisicaoRef = useRef(0)

  const calcularResultado = useCallback(() => {
    if (!questionario.completas) return
    const idDestaRequisicao = ++idRequisicaoRef.current
    setCarregandoResultado(true)
    setErroResultado(null)

    buscarRecomendacao(questionario.completas, { idade }, arquitetura.completas ?? undefined)
      .then((res) => {
        if (idRequisicaoRef.current !== idDestaRequisicao) return // resposta obsoleta, ignora
        setResultado(res)
      })
      .catch((err: unknown) => {
        if (idRequisicaoRef.current !== idDestaRequisicao) return
        const mensagem = err instanceof ErroRecomendacao ? err.message : 'Erro inesperado ao calcular sua recomendação.'
        setErroResultado(mensagem)
        setResultado(null)
      })
      .finally(() => {
        if (idRequisicaoRef.current !== idDestaRequisicao) return
        setCarregandoResultado(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionario.completas, idade, arquitetura.completas])

  // Dispara o cálculo assim que as 7 (ou 14) respostas estiverem completas — a tela
  // "processando" observa `carregandoResultado`/`resultado`/`erroResultado` para decidir
  // quando avançar para a tela de resultado.
  useEffect(() => {
    calcularResultado()
  }, [calcularResultado])

  return {
    hidratado,
    limparDados,
    screen,
    setScreen,
    idade,
    respostas: questionario.respostas,
    passoAtual: questionario.passo,
    valorSimulacao,
    setValorSimulacao,
    resultado,
    carregandoResultado,
    erroResultado,
    tentarCalcularNovamente: calcularResultado,
    perguntaAtual: questionario.atual,
    totalPerguntas: questionario.total,
    perguntaArquiteturaAtual: arquitetura.atual,
    passoArquitetura: arquitetura.passo,
    totalPerguntasArquitetura: arquitetura.total,
    /** Total combinado das 14 perguntas (7 suitability + 7 arquitetura), para a barra de
     * progresso mostrar "pergunta X de 14" ao longo de todo o fluxo. */
    totalPerguntasCombinado: PERGUNTAS.length + PERGUNTAS_ARQUITETURA.length,
    respostasArquitetura: arquitetura.respostas,
    iniciarQuestionario,
    confirmarIdade,
    responderPergunta: questionario.responder,
    voltarPergunta: questionario.voltar,
    responderPerguntaArquitetura: arquitetura.responder,
    voltarPerguntaArquitetura: arquitetura.voltar,
    finalizarProcessamento,
    ativoSelecionado,
    abrirDetalheAtivo,
    voltarDoDetalhe,
    trilhaSelecionadaId,
    abrirTrilha,
    voltarDaTrilha,
    aulaAtualRef,
    abrirAula,
    voltarDaAula,
    tema,
    setTema,
  }
}

export type AppCtx = ReturnType<typeof useAppState>
