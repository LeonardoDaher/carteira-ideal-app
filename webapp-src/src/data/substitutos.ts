import type { AtivoKey } from '../domain/types'

/** Quão segura é a alternativa em relação à classe da carteira. Para classes de renda variável, é o risco do papel em si. */
export type NivelSeguranca = 'maior' | 'igual' | 'parecido' | 'menor'

export const ROTULO_SEGURANCA: Record<NivelSeguranca, string> = {
  maior: 'Mais seguro',
  igual: 'Mesma segurança',
  parecido: 'Segurança parecida',
  menor: 'Menos seguro',
}

export interface Substituto {
  nome: string
  nivel: NivelSeguranca
  /** O que é, o que tem de igual e o que muda (garantia, liquidez, imposto, risco). */
  detalhe: string
}

/**
 * Alternativas do mercado para cada classe da carteira — tela de detalhe do ativo.
 * Conteúdo educativo: não é recomendação de compra e os nomes de produtos são só exemplos.
 */
export const SUBSTITUTOS: Record<AtivoKey, Substituto[]> = {
  tesouroSelic: [
    { nome: 'CDB com liquidez diária de banco grande', nivel: 'parecido', detalhe: 'Rende perto de 100% do CDI e resgata no mesmo dia. A garantia é o FGC (até R$ 250 mil por CPF e por instituição), em vez do Tesouro Nacional.' },
    { nome: 'Conta remunerada de banco ou corretora', nivel: 'parecido', detalhe: 'Na prática é um CDB com liquidez imediata embutido na conta. Confira se o rendimento é 100% do CDI e se a garantia é o FGC.' },
    { nome: 'Fundo DI / renda fixa simples', nivel: 'menor', detalhe: 'Aplica em títulos públicos pós-fixados, mas cobra taxa de administração e não tem FGC. Só vale a pena com taxa muito baixa.' },
    { nome: 'Poupança', nivel: 'parecido', detalhe: 'Coberta pelo FGC e isenta de IR, mas rende bem menos que a Selic quando os juros estão altos.' },
  ],
  tesouroIPCA: [
    { nome: 'CDB IPCA+ de banco sólido', nivel: 'parecido', detalhe: 'Mesma lógica (inflação + taxa), com garantia do FGC até R$ 250 mil por instituição. Em geral tem menos liquidez e taxa próxima à do Tesouro.' },
    { nome: 'ETF ou fundo de títulos IPCA+ (ex.: IMAB11)', nivel: 'igual', detalhe: 'Carteira de títulos públicos atrelados à inflação. O risco de crédito é o mesmo, mas o preço oscila todo dia (sem garantir a taxa se vender antes).' },
    { nome: 'Debênture incentivada IPCA+', nivel: 'menor', detalhe: 'Isenta de IR e costuma pagar mais, porém o risco é da empresa emissora e não há FGC. Exige escolher bem o emissor e diversificar.' },
    { nome: 'LCI / LCA indexada ao IPCA', nivel: 'parecido', detalhe: 'Isenta de IR para pessoa física e coberta pelo FGC, mas é menos comum e costuma ter carência.' },
  ],
  tesouroPrefixado: [
    { nome: 'CDB prefixado de banco sólido', nivel: 'parecido', detalhe: 'Taxa fixa travada, com garantia do FGC. Você troca o risco soberano pelo risco do banco (limitado ao teto do FGC).' },
    { nome: 'LCI / LCA prefixada', nivel: 'parecido', detalhe: 'Taxa fixa e isenta de IR, com FGC. Normalmente tem carência e prazo mais curto que o título público.' },
    { nome: 'ETF de prefixados (ex.: IRFM11)', nivel: 'igual', detalhe: 'Carteira de títulos públicos prefixados. Mesma base de risco, mas a cota oscila e a taxa não fica travada.' },
    { nome: 'Debênture prefixada', nivel: 'menor', detalhe: 'Pode pagar mais, porém o risco é da empresa e não há FGC.' },
  ],
  cdbLiquidez: [
    { nome: 'Tesouro Selic', nivel: 'maior', detalhe: 'Garantido pelo governo federal, sem teto de cobertura, com liquidez diária. Rende um pouco menos por causa da taxa de custódia e do IR.' },
    { nome: 'Conta remunerada ou conta digital que rende CDI', nivel: 'parecido', detalhe: 'Dinheiro disponível na hora, com garantia do FGC. Confira o percentual do CDI pago.' },
    { nome: 'LCI / LCA', nivel: 'parecido', detalhe: 'Mesma garantia do FGC e isenta de IR, mas com carência: serve para a parte do dinheiro que você não vai precisar logo.' },
    { nome: 'Fundo DI', nivel: 'menor', detalhe: 'Liquidez rápida (D+0 ou D+1) e títulos públicos por trás, mas com taxa de administração e sem FGC.' },
    { nome: 'Poupança', nivel: 'parecido', detalhe: 'Mesma cobertura do FGC e liquidez imediata, porém com rendimento geralmente inferior ao CDI.' },
  ],
  lciLca: [
    { nome: 'CDB de prazo equivalente', nivel: 'igual', detalhe: 'Mesma garantia do FGC e do mesmo tipo de banco, mas com IR. Compare sempre o retorno líquido: um CDB precisa pagar mais para empatar com a LCI/LCA isenta.' },
    { nome: 'Tesouro IPCA+ ou Prefixado de prazo parecido', nivel: 'maior', detalhe: 'Risco soberano, sem teto de garantia, mas cobra IR regressivo.' },
    { nome: 'CRI / CRA', nivel: 'menor', detalhe: 'Também isentos de IR e costumam pagar mais, mas não têm FGC: o risco é do devedor da operação.' },
    { nome: 'Debênture incentivada', nivel: 'menor', detalhe: 'Isenta de IR e atrelada à inflação, com risco da empresa emissora e sem FGC.' },
  ],
  ouro: [
    { nome: 'ETF de ouro na bolsa (ex.: GOLD11)', nivel: 'igual', detalhe: 'Acompanha o preço do ouro, com liquidez na bolsa e custo baixo. É a forma mais simples de ter a mesma exposição.' },
    { nome: 'Fundos de investimento em ouro', nivel: 'parecido', detalhe: 'Mesma exposição, porém com taxas de administração mais altas.' },
    { nome: 'Ouro físico (barras ou moedas)', nivel: 'igual', detalhe: 'Mesma proteção, com custos de guarda, seguro e spread na compra e venda.' },
    { nome: 'Ações de mineradoras de ouro (via BDR)', nivel: 'menor', detalhe: 'Sobem com o ouro, mas misturam o risco da empresa e do mercado de ações. Não substituem o papel de proteção.' },
  ],
  fiis: [
    { nome: 'FIAgro', nivel: 'parecido', detalhe: 'Fundo do agronegócio com renda mensal e as mesmas regras de tributação dos FIIs. O risco muda de imóvel/crédito imobiliário para o campo.' },
    { nome: 'Fundo de fundos imobiliários (FoF)', nivel: 'parecido', detalhe: 'Compra cotas de vários FIIs e já entrega diversificação. Há uma camada extra de custos.' },
    { nome: 'CRI', nivel: 'menor', detalhe: 'Renda isenta de IR e atrelada ao devedor, sem FGC. Costuma exigir mais conhecimento e valor mínimo mais alto.' },
    { nome: 'Ações de shoppings, logística e incorporadoras', nivel: 'menor', detalhe: 'Ligadas ao mesmo setor, mas com mais volatilidade, IR sobre ganho de capital e dividendos menos previsíveis.' },
  ],
  acoesETFs: [
    { nome: 'ETF de índice amplo (ex.: BOVA11)', nivel: 'parecido', detalhe: 'Reúne dezenas de ações em uma só cota. Reduz o risco de uma empresa específica, mas acompanha as quedas do mercado.' },
    { nome: 'ETF de dividendos (ex.: DIVO11)', nivel: 'parecido', detalhe: 'Concentra empresas pagadoras de dividendos. Costuma ser menos volátil que o índice inteiro.' },
    { nome: 'Fundos de ações', nivel: 'parecido', detalhe: 'Um gestor escolhe as ações por você, mas cobra taxa de administração e, às vezes, de performance.' },
    { nome: 'BDRs de empresas globais', nivel: 'menor', detalhe: 'Trocam o risco Brasil por empresas estrangeiras e adicionam o risco cambial.' },
  ],
  bdrs: [
    { nome: 'ETF internacional na bolsa (ex.: IVVB11)', nivel: 'maior', detalhe: 'Reúne centenas de empresas do exterior em uma só cota. Mais diversificado que um BDR individual.' },
    { nome: 'Ações ou ETFs em corretora internacional', nivel: 'igual', detalhe: 'Mesmo ativo de origem, com custos de câmbio, declaração do Imposto de Renda do exterior e risco de custódia.' },
    { nome: 'Fundos de ações globais', nivel: 'parecido', detalhe: 'Gestor escolhe empresas do exterior por você, com taxa de administração.' },
    { nome: 'Ações brasileiras com receita em dólar', nivel: 'menor', detalhe: 'Exportadoras ganham quando o dólar sobe, mas ainda dependem do risco Brasil e da própria empresa.' },
  ],
  fundosInternacionais: [
    { nome: 'BDRs de ETF (final 39)', nivel: 'igual', detalhe: 'Dão acesso às bolsas estrangeiras pela B3, em reais. Podem ter menos liquidez e spread maior.' },
    { nome: 'Fundos de investimento no exterior ou cambiais', nivel: 'parecido', detalhe: 'Mesma exposição ao dólar e a mercados globais, com taxas de administração mais altas.' },
    { nome: 'ETFs diretamente em corretora internacional', nivel: 'igual', detalhe: 'Maior variedade de índices e custo baixo, mas com custos de câmbio e tributação específica.' },
    { nome: 'BDRs de empresas individuais', nivel: 'menor', detalhe: 'Dão exposição internacional, porém concentram o risco em poucas empresas.' },
  ],
  cripto: [
    { nome: 'ETFs de criptomoedas na bolsa (ex.: HASH11)', nivel: 'igual', detalhe: 'Mesma exposição ao preço das moedas, com custódia na bolsa e sem carteira própria para cuidar.' },
    { nome: 'Fundos de cripto', nivel: 'parecido', detalhe: 'Mesma exposição por um gestor, com taxas maiores.' },
    { nome: 'BDRs de empresas do setor (corretoras e mineradoras)', nivel: 'menor', detalhe: 'Acompanham o setor, mas misturam o risco da empresa e do mercado de ações.' },
  ],
}
