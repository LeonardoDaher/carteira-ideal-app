import type { AnaliseAtivo } from './types'

export const tesouroSelic: AnaliseAtivo = {
    contexto:
      'Título público pós-fixado, acompanha a taxa Selic dia a dia. É o "porto seguro" da carteira: baixíssimo risco de crédito (o emissor é o Tesouro Nacional), liquidez diária e, diferente do IPCA+ e do Prefixado, praticamente não oscila de preço no meio do caminho. Assim como em Ações, FIIs e BDRs, o principal risco a controlar aqui não é escolher "o título certo", e sim não concentrar tudo num único vencimento — separe os lotes por função (resgate imediato, metas programadas e caixa de oportunidades) em vez de comprar tudo de uma vez no mesmo título.',
    criterios: [
      'Priorize sempre o Tesouro Selic para a reserva de emergência — é o único dos três tipos de Tesouro sem risco relevante de perda se você precisar vender antes do vencimento.',
      'Use a mesma régua de diversificação aplicada às Ações, aos FIIs e aos BDRs, trocando "setor" por vencimento: separe o dinheiro por função (resgate imediato, metas de 1 a 2 anos, caixa de oportunidades) em vez de deixar tudo num único título.',
      'Compare a taxa de custódia da B3 (0,20% a.a.) e a taxa da corretora — isenção da taxa de custódia até R$ 10.000 por CPF, somando todos os títulos do Tesouro Direto, e várias corretoras já isentam também o que exceder esse teto.',
      'Evite resgatar antes de 30 dias corridos: há IOF regressivo sobre o rendimento nesse período.',
      'Uma alocação de referência para 3 lotes é 33,3% cada — dois no vencimento mais próximo (liquidez para emergência e metas de curto prazo) e um em vencimento mais distante, travando o prêmio pós-fixado por um horizonte maior.',
    ],
    blocos: [
      {
        titulo: 'Exemplos por função (ilustrativo — vencimentos disponíveis mudam com frequência, não é recomendação de compra)',
        itens: [
          { nome: 'Tesouro Selic 2029 (Reserva Imediata) — 33,3%', detalhe: 'Vencimento mais próximo dos três lotes, para minimizar o impacto de variações de taxa no resgate diário. Isento da taxa de custódia da B3 até R$ 10.000 por CPF.', cor: 'var(--sector-selic-reserva)' },
          { nome: 'Tesouro Selic 2029 (Metas de Curtíssimo Prazo) — 33,3%', detalhe: 'Mesmo vencimento do lote de reserva, mas separado para despesas já programadas (IPVA, IPTU, viagens, impostos, reformas) — preserva o valor nominal até a data de uso, sem volatilidade negativa.', cor: 'var(--sector-selic-metas)' },
          { nome: 'Tesouro Selic 2031 (Caixa & Transição de Aportes) — 33,3%', detalhe: 'Vencimento mais distante, trava o prêmio de rentabilidade pós-fixada por um horizonte maior enquanto aguarda oportunidades de mercado ou a transição gradual de aportes para a bolsa.', cor: 'var(--sector-selic-oportunidades)' },
        ],
      },
      {
        titulo: 'Onde acompanhar',
        itens: [
          { nome: 'Tesouro Direto (site oficial)', detalhe: 'Preço e rentabilidade diária atualizados pelo Tesouro Nacional.' },
          { nome: 'App da sua corretora', detalhe: 'Confirme se a corretora cobra taxa de administração adicional — o ideal é 0%.' },
        ],
      },
    ],
    atencao: 'O Tesouro Selic quase nunca perde para a poupança e tem liquidez D+0/D+1 — mas ainda paga Imposto de Renda regressivo (começa em 22,5% e cai até 15% após 2 anos) e IOF regressivo nos primeiros 30 dias corridos. Os vencimentos usados nos exemplos acima (2029 e 2031) mudam com o tempo; confira sempre os títulos disponíveis no Tesouro Direto antes de decidir.',
    setores: [
      { label: 'Reserva Imediata', pct: 33.3, cor: 'var(--sector-selic-reserva)', fundos: 1, unidade: 'titulo', funcao: 'Exemplo: Tesouro Selic 2029. Reserva de emergência e resgate curto — foco no vencimento mais próximo para minimizar o impacto de variações de taxa no resgate diário.' },
      { label: 'Metas de Curtíssimo Prazo', pct: 33.3, cor: 'var(--sector-selic-metas)', fundos: 1, unidade: 'titulo', funcao: 'Exemplo: Tesouro Selic 2029. Caixa para compromissos de 1 a 2 anos — despesas programadas (IPVA/IPTU, viagens, impostos ou reformas), garantindo a preservação nominal do valor.' },
      { label: 'Caixa & Transição de Aportes', pct: 33.4, cor: 'var(--sector-selic-oportunidades)', fundos: 1, unidade: 'titulo', funcao: 'Exemplo: Tesouro Selic 2031. Caixa de oportunidades de longo prazo — trava o prêmio de rentabilidade pós-fixada por um horizonte maior enquanto aguarda oportunidades de mercado ou transição para a bolsa.' },
    ],
    notaSetores:
      'Uma carteira de apenas 3 lotes em Tesouro Selic simplifica ao máximo a gestão de caixa: 66,6% do patrimônio fica no vencimento mais próximo (2029) para urgências e metas imediatas sem sobressaltos, e 33,3% no vencimento mais distante (2031) para otimizar o prêmio pós-fixado de longo prazo e manter munição pronta para oportunidades.',
}
