import type { AnaliseAtivo } from './types'

export const lciLca: AnaliseAtivo = {
    contexto:
      'LCI e LCA são títulos de renda fixa emitidos por bancos — não por securitizadoras — para captar recursos exclusivamente para os setores Imobiliário e do Agronegócio. Diferente do CDB, que pode ser usado para qualquer finalidade do banco, aqui a destinação do dinheiro é regulada. A grande vantagem é a isenção total de Imposto de Renda para pessoa física somada à cobertura do FGC até R$ 250 mil por CPF e por instituição — o que costuma deixar o rendimento líquido acima de um CDB equivalente. Em troca, quase sempre há um prazo de carência mínimo antes do primeiro resgate, então a lógica de diversificação aqui não é "setor da economia", e sim indexador, prazo de carência e a saúde do banco emissor.',
    criterios: [
      'Use a mesma régua de diversificação do CDB — espalhe entre pós-fixado (% do CDI), IPCA+ e prefixado — mas lembre que aqui o dinheiro fica preso até o fim da carência regulatória (normalmente de 9 a 36 meses, dependendo do título e do indexador).',
      'Para saber se a isenção de IR compensa mais que um CDB tributável equivalente, calcule a taxa equivalente: Taxa Equivalente CDB = Taxa da LCI/LCA ÷ (1 − alíquota do IR). Uma LCA a 90% do CDI, por exemplo, equivale a um CDB de aproximadamente 105,9% do CDI depois do IR.',
      'Confirme sempre o rating de crédito do banco emissor — bancos médios pagam mais (95% a 98% do CDI, ou IPCA+ mais alto) justamente para compensar um risco de crédito maior, ainda coberto pelo FGC dentro do limite.',
      'A regra de ouro do FGC vale igual à do CDB: nunca ultrapasse R$ 250 mil por banco (aplicação + rendimento), com teto global de R$ 1 milhão a cada 4 anos.',
      'Só aloque em LCI/LCA o dinheiro que você tem certeza de não precisar antes do fim da carência — diferente do CDB com liquidez diária, aqui não há saída antecipada na maioria dos títulos.',
    ],
    blocos: [
      {
        titulo: 'Carência regulatória: o que muda entre LCI e LCA',
        itens: [
          { nome: 'LCI (Imobiliário)', detalhe: 'Prazo mínimo de carência costuma ser mais longo — normalmente a partir de 36 meses quando não há mercado secundário ativo para o título.' },
          { nome: 'LCA (Agronegócio)', detalhe: 'Prazo mínimo de carência costuma ser mais curto — entre 9 e 36 meses, variando com a estrutura de atualização do índice (pós-fixado, IPCA ou prefixado).' },
        ],
      },
      {
        titulo: 'Exemplos por bloco de risco e indexador (ilustrativo — taxas e emissores mudam com frequência, não é recomendação de compra)',
        itens: [
          { nome: 'Bancos Consolidados (Pós-Fixado) — 40%', detalhe: 'LCI Banco do Brasil, LCA Itaú, LCI Bradesco e LCA CAIXA, todos entre 90% e 92% do CDI — 4 títulos. Risco de crédito mínimo, com isenção fiscal total e sem come-cotas.', cor: 'var(--sector-lcilca-posfixado)' },
          { nome: 'Bancos Médios (Pós-Fixado Turbinado) — 30%', detalhe: 'LCI Banco Inter (96% do CDI), LCA Banco Daycoval (97% do CDI) e LCI Banco BTG Pactual (95% do CDI) — 3 títulos. Prêmio maior sobre o CDI para compensar um risco de crédito levemente superior, ainda dentro do limite do FGC.', cor: 'var(--sector-lcilca-posfixado)' },
          { nome: 'Inflação (IPCA+) — 20%', detalhe: 'LCI IPCA + 5,8% a.a. e LCA IPCA + 6,0% a.a., em bancos médios — 2 títulos. Ganho real isento de IR, indicado para horizontes de 1 a 3 anos.', cor: 'var(--sector-lcilca-ipca)' },
          { nome: 'Prefixada — 10%', detalhe: 'LCI Prefixada 11,8% a.a. — 1 título. Rentabilidade travada no momento da aplicação, vantajosa quando a expectativa é de queda acelerada da Selic.', cor: 'var(--sector-lcilca-prefixado)' },
        ],
      },
    ],
    atencao: 'LCI e LCA quase sempre têm carência mínima antes do primeiro resgate (9 a 36 meses conforme o título) — diferente do CDB com liquidez diária, o dinheiro fica indisponível nesse período mesmo em caso de emergência. Os nomes, bancos e taxas acima são exemplos ilustrativos para explicar a lógica de diversificação por indexador e emissor — não são uma recomendação de compra. Confira sempre as condições atualizadas na sua corretora, e nunca ultrapasse R$ 250 mil por banco (capital + juros) para manter a cobertura total do FGC.',
    setores: [
      { label: 'Pós-Fixada (% do CDI)', pct: 70, cor: 'var(--sector-lcilca-posfixado)', fundos: 7, unidade: 'lci', funcao: 'Captura ciclos de juros altos com isenção fiscal total — combina bancos consolidados (menor prêmio, menor risco) e bancos médios (prêmio maior sobre o CDI).' },
      { label: 'Inflação (IPCA + Taxa)', pct: 20, cor: 'var(--sector-lcilca-ipca)', fundos: 2, unidade: 'lci', funcao: 'Proteção real contra a inflação para horizontes de médio prazo (1 a 3 anos), com ganho isento de IR.' },
      { label: 'Prefixada (Taxa Fixa)', pct: 10, cor: 'var(--sector-lcilca-prefixado)', fundos: 1, unidade: 'lci', funcao: 'Garantia de fluxo previsível quando a expectativa é de queda acelerada da Selic — rentabilidade travada na contratação.' },
    ],
    notaSetores:
      'A inclusão de LCI e LCA na carteira preenche a lacuna de renda fixa privada com isenção total de Imposto de Renda e cobertura do FGC — uma ferramenta para superar a rentabilidade líquida de CDBs tradicionais em prazos de médio prazo, desde que a necessidade de liquidez imediata seja respeitada por conta da carência mínima.',
}
