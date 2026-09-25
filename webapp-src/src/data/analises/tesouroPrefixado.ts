import type { AnaliseAtivo } from './types'

export const tesouroPrefixado: AnaliseAtivo = {
    contexto:
      'Título público com uma taxa de retorno fixa, definida no momento da compra — você já sabe exatamente quanto vai receber no vencimento, em reais (sempre R$ 1.000,00 por título). É o menor risco de crédito do país, mas assim como nos FIIs, Ações e BDRs, o principal risco a controlar aqui não é escolher "o título certo", e sim não ficar refém de um único vencimento ou de uma única forma de uso — combine prazos curtos, longos, pagamento de renda e movimentos táticos.',
    criterios: [
      'Só faz sentido levar o título até o vencimento coincidir com o seu objetivo — vender antes, com os juros em alta, pode gerar perda (marcação a mercado), assim como no IPCA+.',
      'Compare a taxa prefixada oferecida com a expectativa de Selic/CDI para o mesmo período: se a taxa prefixada for menor do que o CDI esperado, pode não compensar o risco de travar a taxa.',
      'É mais indicado quando o cenário de juros está em queda (você "trava" uma taxa boa antes que ela caia mais) do que quando os juros estão subindo.',
      'Use a mesma régua de diversificação aplicada às Ações, FIIs e BDRs: espalhe a carteira entre vencimentos curtos, longos, títulos com juros semestrais e uma fatia tática de marcação a mercado, em vez de concentrar tudo em um único vencimento.',
      'Uma alocação de referência para 7 títulos/lotes combina 2 títulos curtos, 2 longos, 2 com juros semestrais e 1 tático, equilibrando previsibilidade de curto prazo, ganho travado de longo prazo, renda recorrente e potencial de valorização antecipada.',
    ],
    blocos: [
      {
        titulo: 'Exemplos por estratégia/vencimento (ilustrativo — títulos e taxas mudam com frequência, não é recomendação de compra)',
        itens: [
          { nome: 'Prefixado Curto Prazo (1 a 3 anos) — 25%', detalhe: 'Tesouro Prefixado 2027 e Tesouro Prefixado 2028 — trava uma taxa fixa (a taxa do dia aparece em "Taxas de hoje", nesta mesma tela) sem expor o capital a oscilações longas. Ideal para metas com data marcada, como viagens, troca de carro ou aportes futuros.', cor: 'var(--sector-pre-curto)' },
          { nome: 'Prefixado Longo Prazo (acima de 4 anos) — 40%', detalhe: 'Tesouro Prefixado 2031 e Tesouro Prefixado 2032, os vencimentos sem cupom mais longos à venda — excelentes para travar taxas altas no topo do ciclo de juros e carregar a rentabilidade acumulada por muitos anos.', cor: 'var(--sector-pre-longo)' },
          { nome: 'Com Juros Semestrais (NTN-F) — 25%', detalhe: 'Tesouro Prefixado com Juros Semestrais 2033 e Tesouro Prefixado com Juros Semestrais 2035 — pagam cupons de rendimento a cada 6 meses (fevereiro e agosto), ideais para quem quer receber renda recorrente sem precisar vender o título.', cor: 'var(--sector-pre-semestral)' },
          { nome: 'Marcação a Mercado (Tática) — 10%', detalhe: 'Tesouro Prefixado com Juros Semestrais 2037, o prefixado de vencimento mais longo à venda — um dos mais sensíveis às variações dos juros futuros, usado para venda antecipada e ganho de capital quando os juros futuros caem.', cor: 'var(--sector-pre-marcacao)' },
        ],
      },
    ],
    atencao: 'Diferente do Tesouro Selic, o Prefixado pode valer menos do que você pagou se for vendido antes do vencimento em um cenário de alta de juros. Os nomes e vencimentos acima são exemplos ilustrativos para explicar a lógica de diversificação por estratégia — não são uma recomendação de compra; confira sempre as taxas e os vencimentos disponíveis no Tesouro Direto antes de decidir. Fique atento também ao risco de inflação: se a inflação disparar acima da taxa fixa contratada, o ganho real pode ser corroído ou ficar negativo.',
    setores: [
      { label: 'Prefixado Curto Prazo (1 a 3 anos)', pct: 25, cor: 'var(--sector-pre-curto)', fundos: 2, unidade: 'titulo', funcao: 'Previsibilidade e segurança de médio prazo — garante uma taxa fixa para metas com data marcada (viagens, trocas de carro, aportes futuros).' },
      { label: 'Prefixado Longo Prazo (acima de 4 anos)', pct: 40, cor: 'var(--sector-pre-longo)', fundos: 2, unidade: 'titulo', funcao: 'Maximizar o ganho em ciclos de queda de juros — trava rentabilidades elevadas durante períodos em que a Selic está no topo do ciclo.' },
      { label: 'Com Juros Semestrais (NTN-F)', pct: 25, cor: 'var(--sector-pre-semestral)', fundos: 2, unidade: 'titulo', funcao: 'Geração de renda recorrente — paga cupons de rendimento a cada 6 meses, ideal para quem busca complementar a renda passiva sem vender o título.' },
      { label: 'Marcação a Mercado (Tática)', pct: 10, cor: 'var(--sector-pre-marcacao)', fundos: 1, unidade: 'titulo', funcao: 'Busca por ganho de capital antecipado — venda do título antes do vencimento quando os juros futuros caem e o preço do título sobe.' },
    ],
    notaSetores:
      'Diversificar no Tesouro Prefixado significa combinar diferentes vencimentos e formas de uso do mesmo título público: previsibilidade de curto prazo, ganho travado no topo do ciclo de juros no longo prazo, fluxo de caixa semestral via NTN-F e potencial de valorização antecipada com a venda tática de títulos longos — sem depender de um único vencimento para toda a fatia de renda fixa prefixada da carteira.',
}
