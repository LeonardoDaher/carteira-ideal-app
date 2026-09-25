import type { AnaliseAtivo, ObjetivoAlocacao } from './types'
import { tesouroSelic } from './tesouroSelic'
import { tesouroPrefixado } from './tesouroPrefixado'

/**
 * Objetivos de uso do Tesouro IPCA+ dentro da carteira — a mesma pergunta e os mesmos
 * três botões que existiam quando o IPCA+ era um ativo separado na carteira (ver chip
 * "IPCA+" dentro de `composicaoPorTipo`, mais abaixo).
 */
const objetivosIPCA: ObjetivoAlocacao[] = [
  {
    id: 'aposentadoria',
    label: 'Aposentadoria',
    resumo:
      'Foco em maximizar o efeito dos juros compostos reais ao longo de décadas: a maior fatia fica em vencimentos longuíssimos sem cupom, com uma parcela menor em vencimentos mais próximos para começar a servir de ponte quando a aposentadoria se aproximar.',
    setores: [
      { label: 'Vencimento Longuíssimo (Sem Cupom)', pct: 55, cor: 'var(--sector-ipca-apo-longuissimo)', fundos: 3, unidade: 'titulo', funcao: 'Maximiza o efeito dos juros compostos reais ao longo de décadas — o rendimento é reinvestido automaticamente até o vencimento, sem o desconto do IR a cada cupom.' },
      { label: 'Vencimento Longo (Sem Cupom)', pct: 30, cor: 'var(--sector-ipca-apo-longo)', fundos: 2, unidade: 'titulo', funcao: 'Vencimento intermediário dentro da estratégia — ainda décadas de reinvestimento automático pela frente, mas já começa a amadurecer perto do período em que a aposentadoria se torna mais concreta.' },
      { label: 'Vencimento Intermediário (Sem Cupom)', pct: 15, cor: 'var(--sector-ipca-apo-medio)', fundos: 1, unidade: 'titulo', funcao: 'Vencimento mais próximo da estratégia — a primeira fatia a virar liquidez quando a aposentadoria se aproximar, servindo de ponte para o início do usufruto.' },
    ],
    blocos: [
      {
        titulo: 'Exemplos por vencimento (ilustrativo — títulos e taxas mudam com frequência, não é recomendação de compra)',
        itens: [
          { nome: 'Vencimento Longuíssimo (Sem Cupom) — 55%', detalhe: 'Tesouro IPCA+ 2040, Tesouro IPCA+ 2045 e Tesouro IPCA+ 2050 — os vencimentos sem cupom mais longos disponíveis no Tesouro Direto. Ideal para quem ainda tem décadas até a aposentadoria e quer priorizar o efeito bola de neve dos juros reais.', cor: 'var(--sector-ipca-apo-longuissimo)' },
          { nome: 'Vencimento Longo (Sem Cupom) — 30%', detalhe: 'Tesouro IPCA+ 2032 e Tesouro IPCA+ 2035 — vencimentos escalonados para reduzir o risco de reinvestir tudo num único momento da curva de juros real. Ideal para quem está a 10-15 anos da aposentadoria.', cor: 'var(--sector-ipca-apo-longo)' },
          { nome: 'Vencimento Intermediário (Sem Cupom) — 15%', detalhe: 'Tesouro IPCA+ 2029 — vencimento mais curto dentro da estratégia de aposentadoria. Ideal para quem está a menos de 5 anos de começar a usar parte do patrimônio.', cor: 'var(--sector-ipca-apo-medio)' },
        ],
      },
    ],
    notaSetores:
      'Para aposentadoria, priorizar títulos IPCA+ sem cupom é o que faz a diferença: cada cupom semestral recebido antecipadamente sofre desconto de Imposto de Renda e perde parte do efeito bola de neve dos juros compostos. Uma carteira de referência com 6 títulos, escalonados entre 2029 e 2050, evita concentrar tudo numa única data e cria uma transição natural conforme a aposentadoria se aproxima.',
  },
  {
    id: 'educacao',
    label: 'Educação',
    resumo:
      'Vencimentos calibrados para coincidir com a data em que o dinheiro vai ser usado (início da faculdade ou curso), com uma pequena fatia de juros semestrais para começar a gerar caixa assim que as primeiras despesas surgirem.',
    setores: [
      { label: 'Vencimento Alvo (Sem Cupom)', pct: 60, cor: 'var(--sector-ipca-edu-alvo)', fundos: 2, unidade: 'titulo', funcao: 'Vencimento calibrado para coincidir com o início do curso ou faculdade — sem cupom, para reinvestir tudo até a data em que o dinheiro será efetivamente usado.' },
      { label: 'Vencimento Intermediário (Sem Cupom)', pct: 25, cor: 'var(--sector-ipca-edu-intermediario)', fundos: 1, unidade: 'titulo', funcao: 'Fatia intermediária, pensada para reforçar os anos seguintes do curso enquanto o restante da estratégia continua rendendo até os vencimentos mais distantes.' },
      { label: 'Com Juros Semestrais (Início do Uso)', pct: 15, cor: 'var(--sector-ipca-edu-semestral)', fundos: 1, unidade: 'titulo', funcao: 'Paga cupons a cada 6 meses — útil para complementar mensalidades ou despesas correntes assim que o curso começa, sem precisar vender o título principal.' },
    ],
    blocos: [
      {
        titulo: 'Exemplos por vencimento (ilustrativo — títulos e taxas mudam com frequência, não é recomendação de compra)',
        itens: [
          { nome: 'Vencimento Alvo (Sem Cupom) — 60%', detalhe: 'Tesouro IPCA+ 2029 e Tesouro IPCA+ 2032 — os vencimentos sem cupom mais próximos à venda, para cobrir os primeiros anos de faculdade ou curso. Ideal para quem já sabe a data aproximada de início.', cor: 'var(--sector-ipca-edu-alvo)' },
          { nome: 'Vencimento Intermediário (Sem Cupom) — 25%', detalhe: 'Tesouro IPCA+ 2035 — cobre os anos finais do curso, mantendo o rendimento protegido da inflação até bem perto da data de uso. Ideal para completar a faculdade sem precisar vender títulos antes do vencimento.', cor: 'var(--sector-ipca-edu-intermediario)' },
          { nome: 'Com Juros Semestrais (Início do Uso) — 15%', detalhe: 'Tesouro IPCA+ com Juros Semestrais 2030 — gera renda recorrente a partir do início do curso, complementando o caixa mês a mês. Ideal para quem quer folga de liquidez logo nos primeiros anos.', cor: 'var(--sector-ipca-edu-semestral)' },
        ],
      },
    ],
    notaSetores:
      'Diferente da aposentadoria, aqui a data de vencimento importa mais do que maximizar o efeito bola de neve: os títulos principais (hoje, 2029 e 2032) devem coincidir com o início do curso, para evitar vender antes do vencimento e correr risco de marcação a mercado justamente na hora de usar o dinheiro. Como o Tesouro hoje oferece IPCA+ sem cupom só a cada 3 a 5 anos, uma carteira de referência com 4 títulos cobre o curso sem depender de um único vencimento. Para quem quer datas exatas, existe o Tesouro Educa+, criado para esse objetivo: a partir do ano escolhido, paga 60 parcelas mensais corrigidas pela inflação, uma para cada mês de 5 anos de curso.',
  },
  {
    id: 'renda-passiva',
    label: 'Renda Passiva',
    resumo:
      'Concentra a maior parte da carteira em títulos com juros semestrais, que pagam cupons de rendimento a cada 6 meses sem precisar vender o título, com uma fatia menor sem cupom para reforçar o caixa quando as taxas estiverem atrativas.',
    setores: [
      { label: 'Com Juros Semestrais (Vencimento Mais Próximo)', pct: 45, cor: 'var(--sector-ipca-renda-semestral-curto)', fundos: 4, unidade: 'titulo', funcao: 'Espinha dorsal da renda passiva — paga cupons a cada 6 meses com proteção contra a inflação, sem precisar vender o título.' },
      { label: 'Com Juros Semestrais (Vencimento Mais Longo)', pct: 30, cor: 'var(--sector-ipca-renda-semestral-longo)', fundos: 3, unidade: 'titulo', funcao: 'Mesmo formato de cupons semestrais, mas com vencimento bem mais longo — ajuda a sustentar a renda passiva por mais décadas, sem depender de reinvestimento no meio do caminho.' },
      { label: 'Sem Cupom (Reforço Futuro)', pct: 25, cor: 'var(--sector-ipca-renda-reserva)', fundos: 1, unidade: 'titulo', funcao: 'Pequena reserva sem cupom — pode ser levada ao vencimento para reforçar a renda futura ou realocada quando surgirem taxas mais atrativas no mercado.' },
    ],
    blocos: [
      {
        titulo: 'Exemplos por vencimento (ilustrativo — títulos e taxas mudam com frequência, não é recomendação de compra)',
        itens: [
          { nome: 'Com Juros Semestrais (Vencimento Mais Próximo) — 45%', detalhe: 'Tesouro IPCA+ com Juros Semestrais 2030, 2032, 2035 e 2037 — vencimentos escalonados que já geram um fluxo de cupons semestrais nos próximos anos. Ideal para quem quer complementar a renda no curto/médio prazo.', cor: 'var(--sector-ipca-renda-semestral-curto)' },
          { nome: 'Com Juros Semestrais (Vencimento Mais Longo) — 30%', detalhe: 'Tesouro IPCA+ com Juros Semestrais 2040, 2045 e 2050 — garantem cupons de renda protegidos da inflação por décadas. Ideal para quem quer manter o fluxo de renda passiva por muito tempo, sem se preocupar em recomprar títulos.', cor: 'var(--sector-ipca-renda-semestral-longo)' },
          { nome: 'Sem Cupom (Reforço Futuro) — 25%', detalhe: 'Tesouro IPCA+ 2032 — cresce sem o desconto de IR a cada cupom, funcionando como reserva de valorização para reforçar a renda mais à frente ou aproveitar boas taxas de reinvestimento.', cor: 'var(--sector-ipca-renda-reserva)' },
        ],
      },
    ],
    notaSetores:
      'Os cupons semestrais dos títulos "com Juros Semestrais" sofrem desconto de Imposto de Renda a cada pagamento (tabela regressiva) — por isso, mesmo buscando renda, vale manter uma fatia sem cupom: ela cresce sem esse desconto intermediário e pode ser convertida em renda no momento mais conveniente. No total, uma carteira de referência de 8 títulos equilibra fluxo de caixa recorrente com reforço de longo prazo.',
  },
]

export const tesouroIPCA: AnaliseAtivo = {
    contexto:
      'O Tesouro Direto reúne os três títulos públicos mais usados numa carteira: o Selic (pós-fixado, liquidez diária), o Prefixado (taxa fixa conhecida na compra) e o IPCA+ (protege o poder de compra, combinando juro fixo com a inflação). Assim como nas Ações, FIIs e BDRs, o principal risco a controlar aqui não é escolher "o título certo", e sim montar os 10 ativos certos dentro de cada tipo, respeitando a data em que você vai precisar do dinheiro.',
    criterios: [
      'Combine a data de vencimento do título com a data em que você realmente vai precisar do dinheiro — vender antes do vencimento de um título prefixado ou IPCA+ expõe você à "marcação a mercado" (o preço sobe e desce com os juros futuros, podendo gerar perda mesmo num título do governo).',
      'Compare a taxa real (acima da inflação) do IPCA+ ou a taxa nominal do Prefixado oferecida em vencimentos diferentes — geralmente vencimentos mais longos pagam uma taxa maior, mas oscilam mais até o vencimento.',
      'O objetivo do dinheiro define o tipo certo: Selic para a reserva de emergência e o curto prazo, Prefixado para uma meta com data e valor já conhecidos, e IPCA+ para objetivos de longuíssimo prazo como aposentadoria, onde proteger o poder de compra importa mais do que a taxa nominal.',
      'Para objetivos de muito longo prazo (aposentadoria, 10+ anos), prefira os títulos IPCA+ sem cupom — todo o rendimento é reinvestido automaticamente, maximizando o efeito dos juros compostos reais, sem o desconto do IR a cada rolagem.',
      'Uma alocação de referência para 10 títulos/lotes é 10% por posição — escalone os vencimentos dentro de cada tipo (em vez de comprar tudo na mesma data) para reduzir o risco de reinvestir tudo num único momento da curva de juros.',
    ],
    blocos: [],
    atencao: 'Se você vender um título Prefixado ou IPCA+ antes do vencimento em um momento de alta nos juros futuros, o preço do título pode ter caído — isso é normal e esperado, mas surpreende quem não conhece a marcação a mercado. O Tesouro Selic não sofre esse efeito, por isso é o tipo indicado para a reserva de emergência. Taxas e vencimentos disponíveis mudam com frequência; confira sempre os números atualizados no Tesouro Direto antes de decidir.',
    composicaoPorTipo: {
      titulo: 'Percentual por tipo de Tesouro Direto',
      tipos: [
        {
          chave: 'tesouroIPCA',
          label: 'IPCA+',
          tituloObjetivos: 'Qual é o seu objetivo com o Tesouro IPCA+?',
          objetivos: objetivosIPCA,
        },
        {
          chave: 'tesouroPrefixado',
          label: 'Prefixado',
          setores: tesouroPrefixado.setores,
          blocos: tesouroPrefixado.blocos,
          notaSetores: tesouroPrefixado.notaSetores,
        },
        {
          chave: 'tesouroSelic',
          label: 'Selic',
          setores: tesouroSelic.setores,
          blocos: tesouroSelic.blocos,
          notaSetores: tesouroSelic.notaSetores,
        },
      ],
    },
}
