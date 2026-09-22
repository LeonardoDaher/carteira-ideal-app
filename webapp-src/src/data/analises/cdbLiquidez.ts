import type { AnaliseAtivo } from './types'

export const cdbLiquidez: AnaliseAtivo = {
    contexto:
      'CDB é um empréstimo que você faz a um banco, geralmente coberto pelo FGC até R$ 250 mil — um título de renda fixa emitido para captar recursos. Por isso, a lógica de diversificação aqui não busca setores da economia, e sim equilibrar indexadores (tipos de rentabilidade), prazos de resgate (liquidez) e a saúde dos bancos emissores.',
    criterios: [
      'Use a mesma régua de diversificação aplicada às Ações, aos FIIs e aos BDRs — mas trocando "setor" por indexador: espalhe a carteira entre pós-fixado (CDI), IPCA+ e prefixado, em vez de concentrar tudo num único tipo de rentabilidade.',
      'Combine prazos diferentes: uma parte com liquidez diária para emergências, outra travada em médio/longo prazo para captar taxas melhores.',
      'Confirme o rating de crédito do banco emissor (agências como Moody\'s, Fitch ou S&P), especialmente em CDBs de bancos médios sem liquidez diária.',
      'A regra de ouro do FGC: nunca ultrapasse R$ 250 mil no mesmo banco (somando o valor aplicado + o rendimento futuro) — esse é o limite de cobertura por CPF e por instituição, com teto global de R$ 1 milhão a cada 4 anos.',
      'Uma alocação de referência para 10 CDBs é 10% por título, combinando liquidez de curto prazo, proteção contra a inflação e aposta na queda dos juros.',
    ],
    blocos: [
      {
        titulo: 'A Regra de Ouro: o limite do FGC',
        itens: [
          { nome: 'Nunca ultrapasse R$ 250 mil por banco', detalhe: 'Some o valor aplicado + o rendimento futuro esperado — esse é o teto de cobertura do FGC por CPF e por instituição financeira, com limite global de R$ 1 milhão a cada 4 anos.' },
          { nome: 'Se o banco emissor quebrar', detalhe: 'O FGC devolve o valor aplicado e os juros acumulados até a data da intervenção — mas só até o limite de R$ 250 mil por instituição. Por isso a diversificação entre bancos é a verdadeira proteção, não a escolha de "um bom CDB".' },
        ],
      },
      {
        titulo: 'O que comparar entre bancos',
        itens: [
          { nome: 'Bancos grandes (Itaú, Bradesco, Banco do Brasil, BTG)', detalhe: 'Mais segurança percebida e boa liquidez diária, mas rentabilidade geralmente mais próxima de 100% do CDI.' },
          { nome: 'Bancos médios/digitais', detalhe: 'Costumam pagar mais que os grandes bancos de varejo pelo mesmo CDB (acima de 100–115% do CDI ou IPCA+ elevado), usando o FGC como proteção ao investidor.' },
          { nome: 'Corretoras de investimento', detalhe: 'Plataformas como as grandes corretoras independentes reúnem CDBs de várias emissoras para comparar taxas, prazos e indexadores num só lugar.' },
        ],
      },
      {
        titulo: 'Exemplos por categoria e emissor (ilustrativo — taxas mudam com frequência, não é recomendação de compra)',
        itens: [
          { nome: 'Pós-Fixados (Liquidez Diária) — 30%', detalhe: 'CDB Itaú (100% do CDI), CDB BTG Pactual (100% a 102% do CDI) e CDB Sofisa Direto (110% do CDI com liquidez) — 3 títulos. Os "bancões" garantem resgate no mesmo dia; bancos médios pagam um percentual levemente maior pela mesma liquidez.', cor: 'var(--sector-cdb-posfixado)' },
          { nome: 'Atrelados à Inflação (IPCA+) — 40%', detalhe: 'CDB Banco Daycoval (IPCA + 6,2% a.a.), Banco Pine (IPCA + 6,5% a.a.), Banco Fibra (IPCA + 6,7% a.a.) e Banco ABC Brasil (IPCA + 6,0% a.a.) — 4 títulos. Prazos geralmente entre 2 e 5 anos, garantindo ganho real acima da inflação do período.', cor: 'var(--sector-cdb-ipca)' },
          { nome: 'Pré-Fixados (Taxa Fixa) — 20%', detalhe: 'CDB Banco Master (13,2% a.a.) e Banco Pan (12,2% a.a.) — 2 títulos. Trava o rendimento do início ao fim do contrato — vantajoso quando a expectativa é de queda da Selic.', cor: 'var(--sector-cdb-prefixado)' },
          { nome: 'Oportunidade / High Yield — 10%', detalhe: 'CDB Banco Voiter (118% do CDI) — 1 título. Emitido por instituição de menor porte que paga mais para captar recursos — use com moderação e sempre dentro do limite de R$ 250 mil do FGC por banco.', cor: 'var(--sector-cdb-highyield)' },
        ],
      },
    ],
    atencao: 'CDB com liquidez diária tende a pagar menos que um CDB com carência — a diferença é o preço da flexibilidade. Os nomes, percentuais e taxas acima são exemplos ilustrativos para explicar a lógica de diversificação por indexador e emissor — não são uma recomendação de compra. Taxas de CDBs mudam com frequência e variam por corretora; confira sempre as condições atualizadas antes de decidir, e nunca ultrapasse R$ 250 mil por banco (capital + juros) para manter a cobertura total do FGC.',
    setores: [
      { label: 'Pós-Fixados (CDI) - Curto Prazo / Liquidez', pct: 30, cor: 'var(--sector-cdb-posfixado)', fundos: 3, unidade: 'cdb', funcao: 'Reserva de emergência e oportunidade. Rentabilidade colada na Selic, com resgate diário em grandes bancos (Itaú, Bradesco, Banco do Brasil, BTG).' },
      { label: 'Atrelados à Inflação (IPCA + Taxa)', pct: 40, cor: 'var(--sector-cdb-ipca)', fundos: 4, unidade: 'cdb', funcao: 'Proteção do poder de compra no médio/longo prazo, com ganho real acima da inflação. Prazos entre 2 e 5 anos, em bancos médios/consolidados.' },
      { label: 'Pré-Fixados (Taxa Fixa)', pct: 20, cor: 'var(--sector-cdb-prefixado)', fundos: 2, unidade: 'cdb', funcao: 'Aposta na queda dos juros — trava uma rentabilidade alta e fixa para quando a Selic começar a cair. Prazos de 1 a 3 anos.' },
      { label: 'Oportunidade / High Yield (Bancos Médios)', pct: 10, cor: 'var(--sector-cdb-highyield)', fundos: 1, unidade: 'cdb', funcao: 'Busca por rentabilidades acima de 115% do CDI ou IPCA+ elevado, emitidos por bancos de maior risco, usando o FGC como proteção.' },
    ],
    notaSetores:
      'Diversificar em CDBs significa distribuir os recursos entre diferentes emissores bancários, prazos de vencimento e indexadores (CDI, IPCA e taxas fixas), garantindo acesso rápido ao dinheiro para emergências, proteção real contra a inflação no longo prazo e rentabilidade elevada — tudo isso blindado pela garantia do FGC dentro dos limites de segurança por banco (R$ 250 mil por CPF e por instituição).',
}
