// Perfil setorial da análise dos balanços: cada setor da B3 cadastrado no app cai em um grupo, e o grupo diz quais indicadores
// (entre os que dá para calcular com as demonstrações da CVM) a análise acrescenta e o que mais pesa na leitura. Os indicadores
// operacionais do setor (vendas mesmas lojas, ARPU, produção, ocupação...) não estão na base aberta e ficam de fora.

export type GrupoSetor = 'varejo' | 'construcao' | 'infraestrutura' | 'commodities' | 'industria' | 'servicos' | 'financeiro' | 'padrao'

export type IndicadorSetorial = 'margemBruta' | 'margemEbitda' | 'roic' | 'estoque' | 'capexReceita'

export interface PerfilSetorial {
  grupo: GrupoSetor
  rotulo: string
  /** Indicadores que a análise acrescenta às contas comuns. */
  indicadores: IndicadorSetorial[]
  /** O que mais pesa na leitura do setor (texto para a tela). */
  foco: string
  /** Indicadores que o setor acompanha e que a base aberta não traz. */
  foraDaBase: string
}

const PERFIS: Record<GrupoSetor, Omit<PerfilSetorial, 'grupo'>> = {
  varejo: {
    rotulo: 'Varejo',
    indicadores: ['margemBruta', 'margemEbitda', 'estoque', 'roic'],
    foco: 'margem bruta, estoque e giro, retorno sobre o capital investido (ROIC)',
    foraDaBase: 'vendas mesmas lojas (SSS)',
  },
  construcao: {
    rotulo: 'Construção e incorporação',
    indicadores: ['margemBruta', 'estoque', 'roic'],
    foco: 'margem bruta, estoque de imóveis e geração de caixa',
    foraDaBase: 'velocidade de vendas (VSO) e distratos',
  },
  infraestrutura: {
    rotulo: 'Infraestrutura e serviços regulados',
    indicadores: ['margemEbitda', 'capexReceita'],
    foco: 'EBITDA, dívida líquida sobre EBITDA e investimento (capex)',
    foraDaBase: 'receita anual permitida (RAP), perdas, ARPU, churn e ocupação',
  },
  commodities: {
    rotulo: 'Commodities e ciclo',
    indicadores: ['margemEbitda', 'margemBruta', 'capexReceita', 'roic'],
    foco: 'margem EBITDA, fluxo de caixa livre e dívida, que variam com o preço da commodity',
    foraDaBase: 'produção, custo unitário e preço realizado',
  },
  industria: {
    rotulo: 'Indústria e bens de consumo',
    indicadores: ['margemBruta', 'margemEbitda', 'estoque', 'roic'],
    foco: 'margem bruta, margem operacional, ROIC e geração de caixa',
    foraDaBase: 'carteira de pedidos (backlog) e volumes',
  },
  servicos: {
    rotulo: 'Serviços',
    indicadores: ['margemEbitda', 'roic'],
    foco: 'margem EBITDA, ROIC e dívida',
    foraDaBase: 'sinistralidade, ocupação, alunos, evasão e ARR',
  },
  financeiro: {
    rotulo: 'Financeiro',
    indicadores: [],
    foco: 'ROE, ROA e, nos bancos, capital regulatório (Basileia)',
    foraDaBase: 'inadimplência, cobertura de provisões e margem financeira',
  },
  padrao: {
    rotulo: 'Geral',
    indicadores: ['margemEbitda', 'roic'],
    foco: 'margem EBITDA, ROIC, dívida e caixa',
    foraDaBase: 'indicadores operacionais do setor',
  },
}

const SETOR_PARA_GRUPO: Record<string, GrupoSetor> = {
  'Varejo alimentar': 'varejo',
  'Varejo de eletro, móveis e e-commerce': 'varejo',
  'Moda e vestuário': 'varejo',
  'Calçados e artigos esportivos': 'varejo',
  'Farmácias, higiene e beleza': 'varejo',
  'Construção civil e incorporação': 'construcao',
  'Energia elétrica: distribuição': 'infraestrutura',
  'Energia elétrica: geração': 'infraestrutura',
  'Energia elétrica: transmissão': 'infraestrutura',
  'Saneamento e resíduos': 'infraestrutura',
  'Telecomunicações': 'infraestrutura',
  'Transporte e infraestrutura': 'infraestrutura',
  'Shoppings e imóveis comerciais': 'infraestrutura',
  'Locação de veículos e frotas': 'infraestrutura',
  'Mineração': 'commodities',
  'Siderurgia e metalurgia': 'commodities',
  'Petróleo e gás': 'commodities',
  'Papel, celulose e madeira': 'commodities',
  'Química e petroquímica': 'commodities',
  'Agronegócio, açúcar e etanol': 'commodities',
  'Carnes e proteínas': 'commodities',
  'Distribuição de combustíveis e etanol': 'commodities',
  'Máquinas, equipamentos e aeroespacial': 'industria',
  'Autopeças e veículos': 'industria',
  'Materiais de construção e acabamento': 'industria',
  'Têxtil e eletrodomésticos': 'industria',
  'Hardware e eletrônicos': 'industria',
  'Alimentos e bebidas': 'industria',
  'Medicamentos e saúde animal': 'industria',
  'Hospitais, planos e diagnósticos': 'servicos',
  'Educação': 'servicos',
  'Software e serviços de TI': 'servicos',
  'Turismo, lazer e restaurantes': 'servicos',
  'Serviços e locação de equipamentos': 'servicos',
  'Bancos': 'financeiro',
  'Bolsa, holdings e serviços financeiros': 'financeiro',
  'Seguros e previdência': 'financeiro',
}

/** Perfil do setor da empresa; setor desconhecido (ou financeira sem setor cadastrado) usa o perfil geral. */
export function perfilDoSetor(setor: string | null, financeira = false): PerfilSetorial {
  const grupo: GrupoSetor = financeira ? 'financeiro' : (setor ? SETOR_PARA_GRUPO[setor] : undefined) ?? 'padrao'
  return { grupo, ...PERFIS[grupo] }
}
