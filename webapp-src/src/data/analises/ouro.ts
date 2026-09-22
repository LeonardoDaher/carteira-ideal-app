import type { AnaliseAtivo } from './types'

export const ouro: AnaliseAtivo = {
    contexto:
      'Metal usado como reserva de valor há séculos, historicamente descorrelacionado das ações e da renda fixa brasileira. Tende a se valorizar em momentos de forte incerteza global (crises, inflação alta, guerras) — funciona como um "seguro" da carteira, não como o motor de retorno. Assim como em Ações, FIIs e BDRs, o principal risco a controlar aqui não é escolher "o ativo certo", e sim não concentrar tudo numa única forma de acesso — ETF, BDR e fundo têm liquidez, custo e tributação diferentes.',
    criterios: [
      'Ouro não paga dividendos nem juros — não espere renda passiva desse ativo, só proteção e valorização de preço.',
      'Uma fatia pequena (5% a 10% da carteira) já costuma ser suficiente para o efeito de proteção, sem pesar demais no retorno em anos de bolsa em alta.',
      'Use a mesma régua de diversificação aplicada às Ações, FIIs e BDRs: combine ETFs (negociação simples via Home Broker), BDRs (acesso direto ao maior mercado de ouro do mundo) e fundos (gestão profissional, sem operar na bolsa) em vez de concentrar tudo num único emissor.',
      'A maioria dos ativos de ouro soma exposição cambial (dólar/real) à variação do próprio metal — só ETFs com hedge cambial (ex.: que replicam o Índice Futuro de Ouro da B3 combinado a Tesouro Selic) isolam o preço do ouro do efeito do dólar.',
      'BDRs de ETFs internacionais mais baratos costumam exigir status de investidor qualificado (mais de R$ 1 milhão investidos ou certificação do mercado financeiro) — confirme o acesso antes de considerar esse ativo na carteira.',
    ],
    blocos: [
      {
        titulo: 'Exemplos por forma de acesso (ilustrativo — não é indicação de compra)',
        itens: [
          { nome: 'ETFs na B3 — 40%', detalhe: 'GOLD11 e GLDX11 (replicam índices internacionais em dólar, sem hedge cambial); OURO11 e GOLB11 (seguem o Índice Futuro de Ouro da B3, em reais); GOLX11 (com proteção cambial, somando o diferencial de juros Brasil x EUA). Negociação simples em bolsa via Home Broker, com liquidez diária e baixo custo de administração.', cor: 'var(--sector-ouro-etf)' },
          { nome: 'BDRs de ETFs Internacionais — 30%', detalhe: 'IAUM34 e GLDM34 (recibos de ETFs americanos de baixo custo, acesso livre); BIAU39 (iShares Gold Trust, da BlackRock); ABGD39 (Abrdn Physical Gold Shares, taxa mais baixa do grupo, mas restrito a investidores qualificados). Acompanham o maior mercado físico de ouro do mundo, com dupla exposição a ouro e dólar.', cor: 'var(--sector-ouro-bdr)' },
          { nome: 'Fundos de Investimento em Ouro — 30%', detalhe: 'Trend Ouro FIM (mesma gestora do GOLD11, acesso via aplicação de fundo, sem precisar de Home Broker); Vitreo Ouro FIM (taxa de administração baixa, com exposição cambial); BTG Reference Ouro USD FIC FIM (fundo em dólar do BTG Pactual). Gestão profissional e aplicação direto pelo app da corretora.', cor: 'var(--sector-ouro-fundo)' },
        ],
      },
    ],
    atencao: 'Ouro não paga dividendos nem juros — o retorno depende inteiramente da variação de preço do metal. Fique atento à tributação de cada formato (15% de IR na venda para ETFs/BDRs vs. come-cotas semestral nos fundos), à dupla exposição cambial presente na maioria dos ativos, e ao "risco de base" dos ETFs que seguem o mercado futuro local (OURO11/GOLB11), que pode divergir ligeiramente do preço internacional convertido em reais.',
    setores: [
      { label: 'ETFs na B3', pct: 40, cor: 'var(--sector-ouro-etf)', fundos: 5, unidade: 'etf', funcao: 'Negociação simples em bolsa via Home Broker, com liquidez diária e baixo custo de administração.' },
      { label: 'BDRs de ETFs Internacionais', pct: 30, cor: 'var(--sector-ouro-bdr)', fundos: 4, unidade: 'bdr', funcao: 'Acesso ao maior mercado físico de ouro do mundo, com dupla exposição a ouro e dólar.' },
      { label: 'Fundos de Investimento em Ouro', pct: 30, cor: 'var(--sector-ouro-fundo)', fundos: 3, unidade: 'fundo', funcao: 'Gestão profissional e aplicação direto pelo app da corretora, sem precisar operar na bolsa.' },
    ],
    notaSetores:
      'Essa divisão em 3 pilares permite capturar liquidez e baixo custo via ETFs na B3, dolarização e escala das maiores gestoras globais (BlackRock, Aberdeen) via BDRs, e conveniência administrativa com a gestão profissional dos fundos — reduzindo o risco de concentrar toda a proteção contra crises num único emissor ou numa única forma de acesso ao metal.',
}
