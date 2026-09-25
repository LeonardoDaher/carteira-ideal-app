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

/**
 * Chave do tema compartilhada com a landing (script.js e o <script> do index.html da raiz).
 * É a fonte única da preferência: quem troca o tema na landing e abre o app pelos botões
 * (Simule FII, Aprender, questionário) continua no mesmo tema, e vice-versa.
 */
export const CHAVE_TEMA_COMPARTILHADA = 'theme'

/** Telas abertas direto pela landing (./app/?tela=aprender e ./app/?tela=simuleFii), sem
 * depender do questionário. Ficam fora da barra de abas e nunca são salvas como "última
 * tela": assim o botão amarelo da landing (./app/) continua devolvendo a pessoa ao ponto
 * em que parou no fluxo do questionário/resultado, e não à aula que ela viu por último. */
export const TELAS_AVULSAS: readonly Screen[] = ['aprender', 'trilha', 'aprenderVideo', 'simuleFii']

export function ehTelaAvulsa(tela: Screen) {
  return TELAS_AVULSAS.includes(tela)
}

/** Valores aceitos no parâmetro ?tela= vindo da landing. */
const TELAS_PELA_URL: Record<string, Screen> = {
  resultado: 'resultado',
  aprender: 'aprender',
  simuleFii: 'simuleFii',
}

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
  // Última tela do fluxo principal (questionário/resultado). É ela que vai para o
  // armazenamento quando a pessoa está numa tela avulsa (Aprender, Simule FII).
  const telaDoFluxoRef = useRef<Screen>('onboarding')

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
            // Estados salvos por versões anteriores podem ter parado numa tela que hoje é
            // avulsa. Antes, essas telas só existiam depois do resultado, então o lugar
            // certo para retomar é o resultado.
            const telaSalva = salvo.screen ?? 'onboarding'
            const telaRestaurada = ehTelaAvulsa(telaSalva) ? 'resultado' : telaSalva
            telaDoFluxoRef.current = telaRestaurada
            setScreen(telaRestaurada)
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

      // O tema escolhido na landing vence o que estiver no estado salvo do app: é a escolha
      // mais recente, porque a landing é a porta de entrada. Antes, o app só olhava o
      // próprio estado e abria no escuro mesmo com a landing no claro.
      const temaCompartilhado = await storage.getItem(CHAVE_TEMA_COMPARTILHADA)
      if (cancelado) return
      if (temaCompartilhado === 'light' || temaCompartilhado === 'dark') setTema(temaCompartilhado)

      // A landing abre o app em telas específicas pelo parâmetro ?tela=:
      // - ?tela=resultado: botão "Ver minha carteira de referência", para quem já tem carteira
      //   salva. Sem isso, o app abriria na última tela em que o usuário esteve. Se ainda não
      //   houver resultado, a própria tela de Resultado mostra o convite para começar.
      // - ?tela=aprender e ?tela=simuleFii: botões da landing que abrem essas telas direto,
      //   sem exigir o questionário.
      try {
        const parametros = new URLSearchParams(window.location.search)
        const telaPedida = TELAS_PELA_URL[parametros.get('tela') ?? '']
        if (telaPedida) {
          setScreen(telaPedida)
          if (!ehTelaAvulsa(telaPedida)) {
            // Remove o parâmetro da URL para não prender a navegação seguinte (troca de
            // abas, "Voltar", etc.) a essa tela sempre que a página for recarregada. Nas
            // telas avulsas ele fica: recarregar a página mantém a pessoa onde ela está.
            const semParametro = window.location.pathname + window.location.hash
            window.history.replaceState(null, '', semParametro)
          }
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

  // Grava na chave compartilhada só depois de ler o que já existia: antes da hidratação o
  // tema é o padrão (escuro), e gravá-lo apagaria a escolha feita na landing.
  useEffect(() => {
    if (!hidratado) return
    storage.setItem(CHAVE_TEMA_COMPARTILHADA, tema)
  }, [hidratado, tema])

  useEffect(() => {
    if (!hidratado) return
    if (!ehTelaAvulsa(screen)) telaDoFluxoRef.current = screen
    const estado: EstadoPersistido = {
      versao: VERSAO_ARMAZENAMENTO,
      screen: telaDoFluxoRef.current,
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
