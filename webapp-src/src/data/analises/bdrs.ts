import type { AnaliseAtivo } from './types'

export const bdrs: AnaliseAtivo = {
    contexto:
      'Recibos negociados na B3 que representam ações de empresas listadas no exterior (principalmente EUA), com exposição direta à variação do dólar (risco cambial). Permitem investir nas maiores multinacionais do mundo sem precisar abrir conta em corretora internacional. Assim como em Ações e FIIs, o principal risco a controlar aqui não é escolher "o BDR certo", e sim não ficar refém de um único setor ou de um único país.',
    criterios: [
      'Use a mesma régua de diversificação aplicada às Ações e aos FIIs: espalhe a carteira entre vários setores globais (tecnologia, saúde, consumo, financeiro, indústria, energia, mídia) em vez de concentrar tudo em tecnologia.',
      'BDRs "patrocinados" (com programa oficial da empresa) costumam ter melhor liquidez do que os "não patrocinados" — prefira sempre os mais líquidos.',
      'Você assume risco cambial: o valor do BDR reflete a ação original convertida para reais, então a variação do dólar também afeta o resultado, para cima ou para baixo.',
      'Uma alocação de referência para 20 BDRs é 5% por ativo, combinando líderes de peso (Big Techs) com setores mais defensivos (saúde, consumo) para equilibrar crescimento e estabilidade.',
    ],
    blocos: [
      {
        titulo: 'Exemplos por setor (tickers na B3 — ilustrativo, não é indicação de compra)',
        itens: [
          { nome: 'Big Techs & Inteligência Artificial', detalhe: 'AAPL34 (Apple), MSFT34 (Microsoft), NVDC34 (Nvidia), GOGL34 (Alphabet/Google), AMZO34 (Amazon) — líderes mundiais em tecnologia, nuvem, IA e plataformas digitais, com alta margem e crescimento consistente.', cor: 'var(--sector-bigtechs)' },
          { nome: 'Saúde, Farmacêutica e Biotecnologia', detalhe: 'JNJB34 (Johnson & Johnson), LLLY34 (Eli Lilly), UNHH34 (UnitedHealth Group) — setor defensivo, mais imune a ciclos econômicos, com portfólios diversificados em medicamentos, inovação médica e planos de saúde.', cor: 'var(--sector-saude-global)' },
          { nome: 'Consumo Global & Marcas Fortes', detalhe: 'COCA34 (Coca-Cola), PGCO34 (Procter & Gamble), WALM34 (Walmart) — conglomerados globais de bens de consumo, com marcas consolidadas e alto poder de repasse de preços em qualquer cenário econômico.', cor: 'var(--sector-consumo-global)' },
          { nome: 'Serviços Financeiros & Meios de Pagamento', detalhe: 'VISA34 (Visa), MSCD34 (Mastercard), JPMC34 (JPMorgan Chase) — processadoras de pagamento com margens elevadas e o maior banco dos EUA em ativos, todos lucrando com o volume do comércio mundial.', cor: 'var(--sector-financeiro-global)' },
          { nome: 'Indústria, Defesa e Logística Global', detalhe: 'CATP34 (Caterpillar), LMTB34 (Lockheed Martin) — máquinas pesadas e automação industrial, além de defesa e aeroespacial com contratos governamentais de longo prazo.', cor: 'var(--sector-industria-defesa)' },
          { nome: 'Energia & Commodities Globais', detalhe: 'EXXO34 (ExxonMobil), CVSH34 (Chevron) — petroleiras integradas com forte geração de caixa em dólar e histórico consistente de dividendos.', cor: 'var(--sector-energia-global)' },
          { nome: 'Comunicação, Mídia e Entretenimento', detalhe: 'DISB34 (Disney), NFLX34 (Netflix) — streaming, conteúdo e publicidade digital com alcance global e receita recorrente por assinatura.', cor: 'var(--sector-midia-global)' },
        ],
      },
    ],
    atencao: 'BDRs somam dois riscos: o da empresa e o cambial (dólar/real) — uma queda da ação no exterior pode ser amplificada ou suavizada pela variação do dólar. Evite concentrar tudo num único setor, como fizeram muitos investidores só em tecnologia nos últimos anos; os nomes acima são exemplos para ilustrar os critérios, não uma recomendação de compra.',
    setores: [
      { label: 'Big Techs & Inteligência Artificial', pct: 25, cor: 'var(--sector-bigtechs)', fundos: 5, unidade: 'bdr', funcao: 'Líderes mundiais em tecnologia, nuvem, IA e plataformas digitais, com alta margem e crescimento.' },
      { label: 'Saúde, Farmacêutica e Biotecnologia', pct: 15, cor: 'var(--sector-saude-global)', fundos: 3, unidade: 'bdr', funcao: 'Setor defensivo, imune a ciclos econômicos, focado em inovação médica e farmacêutica.' },
      { label: 'Consumo Global & Marcas Fortes', pct: 15, cor: 'var(--sector-consumo-global)', fundos: 3, unidade: 'bdr', funcao: 'Conglomerados globais de consumo com alto poder de repasse de preços e presença planetária.' },
      { label: 'Serviços Financeiros & Meios de Pagamento', pct: 15, cor: 'var(--sector-financeiro-global)', fundos: 3, unidade: 'bdr', funcao: 'Processadoras de pagamento e gigantes bancárias globais que lucram com o comércio mundial.' },
      { label: 'Indústria, Defesa e Logística Global', pct: 10, cor: 'var(--sector-industria-defesa)', fundos: 2, unidade: 'bdr', funcao: 'Concessionárias de transporte, aeroespacial, defesa e automação industrial.' },
      { label: 'Energia & Commodities Globais', pct: 10, cor: 'var(--sector-energia-global)', fundos: 2, unidade: 'bdr', funcao: 'Gigantes do petróleo, gás e transição energética com forte geração de caixa em dólar.' },
      { label: 'Comunicação, Mídia e Entretenimento', pct: 10, cor: 'var(--sector-midia-global)', fundos: 2, unidade: 'bdr', funcao: 'Plataformas de streaming, conteúdo e publicidade digital.' },
    ],
    notaSetores:
      'Diversificar em BDRs significa expor o patrimônio às maiores e mais sólidas empresas globais cotadas em dólar, reduzindo a dependência da economia brasileira e do real, ao mesmo tempo em que equilibra a alta capacidade de crescimento do setor de tecnologia com a estabilidade de gigantes de consumo, saúde e finanças mundiais.',
}
