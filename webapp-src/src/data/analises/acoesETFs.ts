import type { AnaliseAtivo } from './types'

export const acoesETFs: AnaliseAtivo = {
    contexto:
      'Participação direta no capital de empresas listadas na B3, comprando a ação de uma companhia específica — a classe com maior potencial de retorno (e de oscilação) da carteira. Assim como nos FIIs, o principal risco a controlar aqui não é escolher "a ação certa", e sim não ficar refém de um único setor da economia.',
    criterios: [
      'Olhe pelo menos três ângulos antes de escolher uma ação: tamanho e liquidez (maiores do Ibovespa), geração de caixa e dividendos, e preço em relação ao patrimônio (P/VP) ou ao lucro (P/L).',
      'Dividend yield alto isolado não basta: confira se vem de lucro recorrente ou de um evento pontual (venda de ativo, por exemplo) — isso pode ser um "dividend trap".',
      'Use a mesma régua de diversificação aplicada aos FIIs: espalhe a carteira entre vários setores (financeiro, energia, saneamento, commodities, consumo, indústria, seguros) em vez de concentrar em um só ciclo econômico.',
      'Se preferir não escolher ações uma a uma, um ETF (ex.: IVVB11, WRLD11) entrega diversificação pronta — veja a análise de Fundos Internacionais/ETFs.',
    ],
    blocos: [
      {
        titulo: 'Exemplos por setor (Blue Chips e líderes de mercado — ilustrativo, não é indicação de compra)',
        itens: [
          { nome: 'Financeiro / Bancos', detalhe: 'ITUB4 (Itaú), BBAS3 (Banco do Brasil), SANB11 (Santander), BPAC11 (BTG Pactual) — os maiores e mais lucrativos bancos do país. ITUB4/BBAS3 são referências em rentabilidade (ROE) e proventos recorrentes; SANB11/BPAC11 têm forte presença em varejo e banco de investimentos.', cor: 'var(--sector-financeiro)' },
          { nome: 'Energia Elétrica', detalhe: 'ELET3 (Eletrobras), EGIE3 (Engie Brasil), TAEE11 (Taesa), ISAE4 (ISA Energia, antiga ISA CTEEP) — o setor de maior previsibilidade na B3. TAEE11/ISAE4 são transmissoras com receita fixa por contrato (RAP); EGIE3/ELET3 são gigantes de geração e comercialização de energia limpa.', cor: 'var(--sector-energia-eletrica)' },
          { nome: 'Saneamento & Serviços', detalhe: 'SBSP3 (Sabesp), CPLE6 (Copel), CSMG3 (Copasa) — monopólios operacionais com contratos essenciais. SBSP3 é a maior empresa de saneamento da América Latina; CPLE6/CSMG3 são concessões estaduais sólidas e pagadoras de dividendos.', cor: 'var(--sector-saneamento)' },
          { nome: 'Commodities / Básicos', detalhe: 'VALE3 (Vale), PETR4 (Petrobras), SUZB3 (Suzano) — exportadoras e líderes mundiais. VALE3 é a maior produtora global de minério de ferro de alta qualidade; PETR4 lidera petróleo e gás no pré-sal; SUZB3 é a maior produtora mundial de celulose de eucalipto.', cor: 'var(--sector-commodities)' },
          { nome: 'Consumo, Varejo & Saúde', detalhe: 'RADL3 (RaiaDrogasil), ABEV3 (Ambev) — demanda perene e escala incomparável. RADL3 é a maior rede de farmácias do Brasil, em expansão constante; ABEV3 lidera bebidas e cervejas na América Latina, com forte caixa livre.', cor: 'var(--sector-consumo-saude)' },
          { nome: 'Indústria & Bens de Capital', detalhe: 'WEGE3 (WEG), POMO4 (Marcopolo) — excelência operacional e presença global. WEGE3 é uma das empresas mais eficientes do mundo na fabricação de motores e soluções elétricas; POMO4 lidera o mercado de carrocerias de ônibus e mobilidade.', cor: 'var(--sector-industria)' },
          { nome: 'Seguros & Holdings', detalhe: 'BBSE3 (BB Seguridade), ITSA4 (Itaúsa) — proteção e geração contínua de caixa. BBSE3 é o braço de seguros e previdência atrelado ao agronegócio e varejo bancário; ITSA4 é uma holding diversificada com forte participação no Banco Itaú.', cor: 'var(--sector-seguros-holding)' },
        ],
      },
    ],
    atencao: 'Os nomes acima são exemplos para ilustrar os critérios de análise (tamanho, dividendos, valuation) — não é uma recomendação de compra. Cotações, P/VP e dividend yield mudam diariamente; confira dados atualizados antes de decidir.',
    setores: [
      { label: 'Financeiro / Bancos', pct: 20, cor: 'var(--sector-financeiro)', fundos: 4, unidade: 'acao', funcao: 'Os maiores e mais lucrativos bancos do país — referências em rentabilidade (ROE) e proventos recorrentes.' },
      { label: 'Energia Elétrica', pct: 20, cor: 'var(--sector-energia-eletrica)', fundos: 4, unidade: 'acao', funcao: 'O setor de maior previsibilidade na B3 — transmissoras com receita fixa por contrato e geradoras de energia limpa.' },
      { label: 'Saneamento & Serviços', pct: 15, cor: 'var(--sector-saneamento)', fundos: 3, unidade: 'acao', funcao: 'Monopólios operacionais com contratos essenciais — concessões estaduais sólidas e pagadoras de dividendos.' },
      { label: 'Commodities / Básicos', pct: 15, cor: 'var(--sector-commodities)', fundos: 3, unidade: 'acao', funcao: 'Exportadoras e líderes mundiais em minério, petróleo e celulose — dolarizadas e geradoras de caixa em ciclos de alta.' },
      { label: 'Consumo, Varejo & Saúde', pct: 10, cor: 'var(--sector-consumo-saude)', fundos: 2, unidade: 'acao', funcao: 'Demanda perene e escala incomparável — farmácias e bebidas com forte caixa livre.' },
      { label: 'Indústria & Bens de Capital', pct: 10, cor: 'var(--sector-industria)', fundos: 2, unidade: 'acao', funcao: 'Excelência operacional e presença global — motores, soluções elétricas e mobilidade.' },
      { label: 'Seguros & Holdings', pct: 10, cor: 'var(--sector-seguros-holding)', fundos: 2, unidade: 'acao', funcao: 'Proteção e geração contínua de caixa — seguros, previdência e participações societárias.' },
    ],
    notaSetores:
      'Diversificar em ações significa distribuir o patrimônio entre empresas e setores que reagem de formas diferentes à economia, o que reduz drasticamente o risco de grandes perdas por problemas específicos de uma única companhia, suaviza as oscilações da carteira em momentos de crise e garante proteção contínua e rendimentos mais estáveis no longo prazo.',
}
