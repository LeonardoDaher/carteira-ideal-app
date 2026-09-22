import type { AtivoKey } from '../../domain/types'

export interface ItemRecomendado {
  nome: string
  detalhe: string
  /** Cor do segmento correspondente no sub-gráfico `setores`, quando o exemplo pertence a um. */
  cor?: string
}

export interface BlocoAnalise {
  titulo: string
  itens: ItemRecomendado[]
}

export interface SetorGrafico {
  label: string
  pct: number
  cor: string
  /** Nº de ativos sugeridos nesse segmento (fundos, ações etc.), quando a análise trouxer essa referência. */
  fundos?: number
  /** Tipo de unidade contada em `fundos`, usado para pluralizar o rótulo. Padrão: 'fundo'. */
  unidade?: 'fundo' | 'acao' | 'bdr' | 'cdb' | 'etf' | 'moeda' | 'titulo' | 'lci'
  /** Papel que o segmento cumpre dentro da carteira — exibido como explicação abaixo do gráfico. */
  funcao?: string
}

export interface TipoComposicao {
  /** Chave do ativo (AtivoKey) cujo percentual real na carteira será exibido. */
  chave: AtivoKey
  /** Rótulo curto exibido no chip (ex.: "IPCA+", "Prefixado", "Selic"). */
  label: string
  /**
   * Conteúdo exibido logo abaixo dos chips quando este tipo está selecionado — o
   * mesmo gráfico de segmentos e os mesmos exemplos ilustrativos que apareciam na
   * tela de detalhe própria desse tipo, de quando Selic, Prefixado e IPCA+ eram
   * três ativos separados na carteira (antes de virarem uma única fatia "Tesouro
   * Direto"). Um tipo tem OU (`setores` + `blocos`) OU (`objetivos`), nunca os
   * dois — mesma regra do restante deste arquivo.
   */
  setores?: SetorGrafico[]
  blocos?: BlocoAnalise[]
  notaSetores?: string
  /**
   * Alternativa a `setores`/`blocos` quando o próprio tipo tiver mais de uma forma
   * de uso dentro da carteira (ex.: o IPCA+ pode ser usado para Aposentadoria,
   * Educação ou Renda Passiva). Quando presente, um segundo seletor aparece abaixo
   * do chip do tipo, com um gráfico e exemplos diferentes para cada objetivo.
   */
  objetivos?: ObjetivoAlocacao[]
  /** Pergunta exibida acima do seletor de `objetivos` deste tipo (ex.: "Qual é o seu objetivo com o Tesouro IPCA+?"). */
  tituloObjetivos?: string
}

export interface AnaliseAtivo {
  contexto: string
  criterios: string[]
  blocos: BlocoAnalise[]
  atencao: string
  /** Sub-gráfico opcional de composição interna da classe (ex.: segmentos de FIIs). */
  setores?: SetorGrafico[]
  /** Texto de destaque exibido junto ao sub-gráfico de setores, quando houver. */
  notaSetores?: string
  /**
   * Objetivos alternativos de alocação dentro da mesma classe de ativo (ex.: Tesouro
   * IPCA+ usado para Aposentadoria, Educação ou Renda Passiva). Quando presente, a tela
   * de detalhe troca `setores`/`blocos`/`notaSetores` por botões — um gráfico e um
   * conjunto de exemplos diferente para cada objetivo escolhido pelo usuário.
   */
  objetivos?: ObjetivoAlocacao[]
  /**
   * Pergunta exibida acima dos botões de objetivo, quando `objetivos` está presente
   * (ex.: "Qual é o seu objetivo com o Tesouro IPCA+?"). Cada ativo define a sua própria
   * pergunta — nunca deve ficar fixa num componente, já que qualquer ativo pode vir a
   * ganhar `objetivos` no futuro.
   */
  tituloObjetivos?: string
  /**
   * Quando este ativo agrega, na carteira exibida ao cliente, o percentual de outras
   * classes internas (ex.: "Tesouro Direto" agrega Selic + Prefixado + IPCA+ numa única
   * fatia do gráfico), esta lista define quais classes compõem o agregado, com o rótulo
   * de cada uma. Substitui o seletor de objetivos nessa tela: em vez de perguntar o
   * objetivo do cliente, mostra o percentual real de cada tipo dentro da carteira
   * recomendada. Um ativo nunca tem `objetivos` e `composicaoPorTipo` ao mesmo tempo.
   */
  composicaoPorTipo?: {
    /** Frase exibida acima dos chips (ex.: "Percentual por tipo de Tesouro Direto"). */
    titulo: string
    tipos: TipoComposicao[]
  }
}

export interface ObjetivoAlocacao {
  /** Identificador estável do objetivo, usado apenas para controlar qual botão está ativo. */
  id: string
  /** Rótulo curto exibido no botão (ex.: "Aposentadoria"). */
  label: string
  /** Frase de uma linha exibida abaixo dos botões, explicando o foco desse objetivo. */
  resumo: string
  /** Sub-gráfico de composição para esse objetivo — sempre soma 100% dos ativos da carteira. */
  setores: SetorGrafico[]
  /** Blocos de exemplos ilustrativos específicos desse objetivo. */
  blocos: BlocoAnalise[]
  /** Texto de destaque exibido junto ao sub-gráfico desse objetivo. */
  notaSetores?: string
}
