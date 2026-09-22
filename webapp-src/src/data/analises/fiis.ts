import type { AnaliseAtivo } from './types'

export const fiis: AnaliseAtivo = {
    contexto:
      'Fundos listados em bolsa que investem em imóveis físicos (galpões, shoppings, lajes corporativas — os "FIIs de tijolo") ou em recebíveis imobiliários, como CRIs ("FIIs de papel"). Distribuem renda mensal, isenta de IR para pessoa física, com risco moderado.',
    criterios: [
      'P/VP (preço sobre valor patrimonial): abaixo de 1,0x pode indicar desconto, mas verifique se o motivo não é um problema estrutural do fundo.',
      'Dividend Yield (DY) dos últimos 12 meses: compare com a média do setor do fundo, não com o mercado todo.',
      'Vacância (para FIIs de tijolo): fundos com vacância baixa e contratos longos tendem a ter renda mais previsível.',
      'Diversifique entre "tijolo" (logística, shoppings, lajes corporativas) e "papel" (CRIs) para equilibrar previsibilidade e sensibilidade a juros.',
    ],
    blocos: [
      {
        titulo: 'Exemplos por segmento (ilustrativo — vários fundos por segmento, não é indicação de nenhum específico)',
        itens: [
          { nome: 'Papel / CRIs', detalhe: 'KNCR11, MXRF11, CPTS11 — recebíveis atrelados a CDI ou IPCA, com rendimento mensal previsível e baixa oscilação de preço.', cor: 'var(--sector-papel)' },
          { nome: 'Galpões Logísticos', detalhe: 'HGLG11, BTLG11, XPLG11 — galpões arrendados a operações de e-commerce e indústria, setor beneficiado pelo crescimento do varejo online.', cor: 'var(--sector-logistica)' },
          { nome: 'Shopping Centers', detalhe: 'XPML11, VISC11, HGBS11 — renda ligada ao consumo e ao varejo físico, incluindo aluguel variável em datas de pico.', cor: 'var(--sector-shopping)' },
          { nome: 'Renda Urbana / Varejo', detalhe: 'HGRU11, TRXF11 — contratos atípicos e de longo prazo com inquilinos essenciais, como supermercados e farmácias.', cor: 'var(--sector-rendaurbana)' },
          { nome: 'Fiagros (Agronegócio)', detalhe: 'SNAG11, RZAG11, KNCA11, VGIA11 — crédito e recebíveis ligados ao agronegócio brasileiro. Tecnicamente são Fiagros, não FIIs — seguem lógica parecida (renda mensal isenta de IR, negociados em bolsa), mas são outro tipo de fundo.', cor: 'var(--sector-fiagro)' },
          { nome: 'FOFs / Multiestratégia', detalhe: 'BCFF11, RBRF11 — carteiras formadas por cotas de outros FIIs, com gestão ativa comprando e vendendo no mercado secundário.', cor: 'var(--sector-multi)' },
          { nome: 'Lajes Corporativas', detalhe: 'PVBI11, BRCR11, RCRB11 — escritórios de alto padrão (Prime/AAA), sensíveis à demanda por espaço corporativo.', cor: 'var(--sector-lajes)' },
          { nome: 'Hospital / Saúde', detalhe: 'NSLU11, HCRI11, NVHO11 — hospitais com contratos atípicos de longuíssimo prazo, setor defensivo com baixíssimo risco de vacância.', cor: 'var(--sector-saude)' },
          { nome: 'Energia / Infraestrutura', detalhe: 'SNEL11 — usinas fotovoltaicas de geração distribuída. Diferente dos outros segmentos, esse ainda é um nicho recente e concentrado: hoje é praticamente o único fundo relevante desse tipo na B3, então a diversificação dentro do próprio segmento é mais limitada.', cor: 'var(--sector-energia)' },
        ],
      },
    ],
    atencao: 'Um DY muito acima da média do segmento pode ser "dividend trap": o fundo está distribuindo mais do que sua geração de caixa sustenta.',
    setores: [
      { label: 'Papel / CRIs', pct: 25, cor: 'var(--sector-papel)', fundos: 5, funcao: 'Renda mensal previsível e proteção contra inflação/CDI.' },
      { label: 'Galpões Logísticos', pct: 20, cor: 'var(--sector-logistica)', fundos: 4, funcao: 'Resiliência operacional, com contratos atípicos junto a grandes indústrias e players de e-commerce.' },
      { label: 'Shopping Centers', pct: 10, cor: 'var(--sector-shopping)', fundos: 2, funcao: 'Proteção real e ganho direto ligado ao consumo, incluindo datas comemorativas.' },
      { label: 'Renda Urbana / Varejo', pct: 10, cor: 'var(--sector-rendaurbana)', fundos: 2, funcao: 'Inquilinos essenciais (supermercados e farmácias) com contratos longos.' },
      { label: 'Fiagros (Agronegócio)', pct: 10, cor: 'var(--sector-fiagro)', fundos: 2, funcao: 'Exposição direta ao crédito e aos imóveis do agronegócio brasileiro.' },
      { label: 'FOFs / Multiestratégia', pct: 10, cor: 'var(--sector-multi)', fundos: 2, funcao: 'Gestão ativa para captura de oportunidades no mercado secundário.' },
      { label: 'Lajes Corporativas', pct: 5, cor: 'var(--sector-lajes)', fundos: 1, funcao: 'Edifícios empresariais nos principais eixos econômicos (padrão Prime/AAA).' },
      { label: 'Hospital / Saúde', pct: 5, cor: 'var(--sector-saude)', fundos: 1, funcao: 'Setor ultra-defensivo, com contratos atípicos e baixíssimo risco de vacância.' },
      { label: 'Energia / Infraestrutura', pct: 5, cor: 'var(--sector-energia)', fundos: 1, funcao: 'Fluxo de caixa previsível, lastreado em contratos de concessão e transmissão.' },
    ],
    notaSetores:
      'Diversificar em FIIs significa distribuir o patrimônio entre diferentes tipos de ativos (como imóveis físicos e papéis de dívida) e diversos setores da economia (como galpões, shoppings e agronegócio), reduzindo o risco de perda por vacância, inadimplência ou crises em um segmento específico, o que garante maior previsibilidade de renda mensal e estabilidade no recebimento dos dividendos ao longo do tempo.',
}
