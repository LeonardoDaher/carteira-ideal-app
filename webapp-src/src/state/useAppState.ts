import { useCallback, useEffect, useRef, useState } from 'react'
import { buscarRecomendacao, ErroRecomendacao } from '../data/apiRecomendacao'
import { registrarEvento } from '../data/analytics'
import { PERGUNTAS } from '../data/questions'
import { PERGUNTAS_ARQUITETURA, perguntaArquiteturaVisivel } from '../data/perguntasArquitetura'
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
  | 'simuleTesouro'
  | 'simuleBdr'
  | 'simuleEtf'
  | 'simuleFuturos'
  | 'simuleOpcoes'
  | 'simuleAcoes'
  | 'simuleAtivos'
  | 'simuleImovel'
  | 'simuleCarro'
  | 'simuleMoto'
  | 'simuleBens'
  | 'suaHp12c'
  | 'meuMes'
  | 'minhaCarteira'

export type Tema = 'dark' | 'light'

/**
 * Chave do tema compartilhada com a landing (script.js e o <script> do index.html da raiz).
 * É a fonte única da preferência: quem troca o tema na landing e abre o app pelos botões
 * (Simule FII, Aprender, questionário) continua no mesmo tema, e vice-versa.
 */
export const CHAVE_TEMA_COMPARTILHADA = 'theme'

/** Telas abertas direto pela landing (./app/?tela=aprender, simuleFii, simuleTesouro, simuleBdr, simuleEtf e meuMes), sem
 * depender do questionário. Ficam fora da barra de abas e nunca são salvas como "última
 * tela": assim o botão amarelo da landing (./app/) continua devolvendo a pessoa ao ponto
 * em que parou no fluxo do questionário/resultado, e não à aula que ela viu por último. */
export const TELAS_AVULSAS: readonly Screen[] = ['aprender', 'trilha', 'aprenderVideo', 'simuleFii', 'simuleTesouro', 'simuleBdr', 'simuleEtf', 'simuleFuturos', 'simuleOpcoes', 'simuleAcoes', 'simuleAtivos', 'simuleImovel', 'simuleCarro', 'simuleMoto', 'simuleBens', 'suaHp12c', 'meuMes', 'minhaCarteira']

export function ehTelaAvulsa(tela: Screen) {
  return TELAS_AVULSAS.includes(tela)
}

/** Telas que só fazem sentido com o questionário respondido (dependem do resultado). Nunca devem
 * ser gravadas como "onde a pessoa parou" enquanto as 7 perguntas de suitability não existirem:
 * quem toca em Perfil/Carteira/Simular sem ter respondido vê o convite para começar, e gravar essa
 * tela fazia o botão da landing abrir o convite vazio nas visitas seguintes, em vez do onboarding. */
export const TELAS_QUE_EXIGEM_RESPOSTAS: readonly Screen[] = ['resultado', 'carteira', 'simulador', 'detalheAtivo']

/** As 7 respostas de suitability estão todas presentes? (mesma regra de `questionario.completas`) */
function suitabilityRespondido(respostas: Partial<RespostasQuestionario> | undefined) {
  const salvas = respostas as Record<string, unknown> | undefined
  return PERGUNTAS.every((p) => salvas?.[p.id] !== undefined)
}

/** Valores aceitos no parâmetro ?tela= vindo da landing. */
const TELAS_PELA_URL: Record<string, Screen> = {
  resultado: 'resultado',
  aprender: 'aprender',
  simuleFii: 'simuleFii',
  simuleTesouro: 'simuleTesouro',
  simuleBdr: 'simuleBdr',
  // Simule ETF (D23): dados oficiais da B3, no molde do Simule BDR.
  simuleEtf: 'simuleEtf',
  // Simule Futuros: índice, dólar, juros e agro da B3, com simulador de resultado e análise gráfica (aba Tendência).
  simuleFuturos: 'simuleFuturos',
  // Simule Opções: séries reais da B3 (COTAHIST) e simulador de estratégias.
  simuleOpcoes: 'simuleOpcoes',
  // Simule Ações (D43): setores da B3 com as principais empresas de cada um; dados oficiais da B3.
  simuleAcoes: 'simuleAcoes',
  // Simule Ativos (D42): hub único que reúne Ações, Opções, FII, Tesouro, BDR e ETF; a landing só tem este botão.
  simuleAtivos: 'simuleAtivos',
  // Simule Imóvel (D44): financiar × alugar × consórcio; cartão próprio na landing.
  simuleImovel: 'simuleImovel',
  // Simule Carro (D47): à vista × financiar × consórcio × sem carro, no molde do imóvel; aberto pelo hub Simule Bens.
  simuleCarro: 'simuleCarro',
  // Simule Moto (D48): o mesmo motor do carro com valores de partida de moto; aberto pelo hub Simule Bens.
  simuleMoto: 'simuleMoto',
  // Simule Bens (D45): hub do comparativo de imóvel (e, depois, carro e moto); é o que o cartão da landing abre.
  simuleBens: 'simuleBens',
  // Sua HP12C: problemas de matemática financeira falados ou digitados, com banco de questões; aberto pelo hub Simule Bens.
  suaHp12c: 'suaHp12c',
  // Meu Mês (D21): botão na landing desde a Etapa 4; também aberto pelo resultado e pela
  // trilha "Sair das dívidas".
  meuMes: 'meuMes',
  // Minha Carteira (D36): painel de gestão da carteira real, aberto por ?tela=minhaCarteira.
  minhaCarteira: 'minhaCarteira',
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

// Funções de módulo (referência estável): se mudassem a cada render, `completas` seria recalculado
// sempre e dispararia o cálculo do resultado em loop.
const perguntaArquiteturaOpcional = (pergunta: { opcional?: boolean }) => pergunta.opcional === true

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
      registrarEvento('suitability_concluido')
      arquitetura.setPasso(0)
      setScreen('questionarioArquitetura')
    },
    onVoltarAntesDoInicio: () => setScreen('idade'),
  })

  const arquitetura = useQuestionario(PERGUNTAS_ARQUITETURA, {
    visivel: perguntaArquiteturaVisivel,
    opcional: perguntaArquiteturaOpcional,
    onCompletar: () => {
      registrarEvento('arquitetura_concluida')
      setScreen('processando')
    },
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
            // O detalhe de um ativo também não é ponto de retomada: o ativo escolhido não é gravado,
            // então reabrir nele mostrava "Nenhum ativo selecionado". Volta para o resultado.
            const telaCandidata = ehTelaAvulsa(telaSalva) || telaSalva === 'detalheAtivo' ? 'resultado' : telaSalva
            // Estado salvo apontando para uma tela que depende do resultado, mas sem as respostas:
            // foi gravado por engano (ver TELAS_QUE_EXIGEM_RESPOSTAS). Abre o onboarding, que é o
            // que a pessoa esperava ao tocar no botão da landing. Cura também quem já ficou assim.
            const telaRestaurada =
              TELAS_QUE_EXIGEM_RESPOSTAS.includes(telaCandidata) && !suitabilityRespondido(salvo.respostas)
                ? 'onboarding'
                : telaCandidata
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
      // - ?tela=aprender, ?tela=simuleFii, ?tela=simuleTesouro, ?tela=simuleBdr, ?tela=simuleEtf e ?tela=meuMes: botões da landing que abrem essas telas direto,
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
    if (!ehTelaAvulsa(screen) && screen !== 'detalheAtivo') telaDoFluxoRef.current = screen
    // Sem as 7 respostas, uma tela que depende do resultado não é um ponto de retomada válido.
    const telaParaSalvar =
      TELAS_QUE_EXIGEM_RESPOSTAS.includes(telaDoFluxoRef.current) && !questionario.completas
        ? 'onboarding'
        : telaDoFluxoRef.current
    const estado: EstadoPersistido = {
      versao: VERSAO_ARMAZENAMENTO,
      screen: telaParaSalvar,
      idade,
      respostas: questionario.respostas,
      respostasArquitetura: arquitetura.respostas,
      tema,
    }
    storage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(estado))
  }, [hidratado, screen, idade, questionario.respostas, questionario.completas, arquitetura.respostas, tema])

  // Métricas anônimas: 1 visita por sessão e as telas de conteúdo/ferramentas mais abertas.
  useEffect(() => {
    if (!hidratado) return
    registrarEvento('visita', undefined, { unicoPorSessao: true })
    // Instalação do app (PWA): conta quando o navegador avisa que a pessoa adicionou à tela inicial.
    const aoInstalar = () => void registrarEvento('app_instalado', undefined, { unicoPorSessao: true })
    window.addEventListener('appinstalled', aoInstalar)
    return () => window.removeEventListener('appinstalled', aoInstalar)
  }, [hidratado])

  useEffect(() => {
    if (!hidratado) return
    if (ehTelaAvulsa(screen) || screen === 'carteira' || screen === 'simulador') {
      registrarEvento('tela_vista', { tela: screen }, { unicoPorSessao: true })
    }
  }, [hidratado, screen])

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
    registrarEvento('questionario_iniciado', undefined, { unicoPorSessao: true })
    setIdade(valor)
    questionario.setPasso(0)
    setScreen('questionario')
  }

  function finalizarProcessamento() {
    // Conta a recomendação só quando a pessoa realmente chega ao resultado, e só com rótulos
    // agregados (nada das respostas individuais).
    if (resultado) {
      registrarEvento(
        'recomendacao_gerada',
        {
          perfil: resultado.perfilFinalCarteira ?? resultado.perfilFinal,
          prazo: resultado.prazo,
          capacidade: resultado.capacidadeReal,
          veto: resultado.vetoAplicado,
        },
      )
    }
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
        registrarEvento('recomendacao_erro')
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

  // A pessoa já respondeu o questionário e a carteira sugerida está a caminho: ainda não há `resultado`,
  // nem erro. As telas usam isto para mostrar "montando…" em vez do convite para responder (que seria
  // falso). Vale desde a PRIMEIRA renderização depois de ler o aparelho, sem esperar o pedido começar.
  const resultadoPendente = !!questionario.completas && !resultado && !erroResultado

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
    resultadoPendente,
    erroResultado,
    tentarCalcularNovamente: calcularResultado,
    perguntaAtual: questionario.atual,
    totalPerguntas: questionario.total,
    perguntaArquiteturaAtual: arquitetura.atual,
    passoArquitetura: arquitetura.passo,
    totalPerguntasArquitetura: arquitetura.total,
    /** Total combinado das 14 perguntas (7 suitability + 7 arquitetura), para a barra de
     * progresso mostrar "pergunta X de 14" ao longo de todo o fluxo. */
    totalPerguntasCombinado: PERGUNTAS.length + arquitetura.total,
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
