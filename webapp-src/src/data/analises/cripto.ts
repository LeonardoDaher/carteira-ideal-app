import type { AnaliseAtivo } from './types'

export const cripto: AnaliseAtivo = {
    contexto:
      'Classe de ativos digitais (Bitcoin, Ethereum e outras criptomoedas) com volatilidade muito acima de ações ou FIIs. Assim como em Ações e BDRs, o principal risco a controlar aqui não é escolher "a moeda certa", e sim não concentrar tudo numa única forma de acesso — fundo, ETF, BDR ou compra direta têm liquidez, custódia e tributação diferentes.',
    criterios: [
      'Trate cripto como uma fatia pequena e satélite da carteira (referência: até 3% do total nos perfis Arrojados) — o objetivo é participar da assimetria de longo prazo sem comprometer o restante do patrimônio numa classe tão volátil.',
      'Use a mesma régua de diversificação aplicada às Ações, FIIs e BDRs: espalhe entre diferentes formas de acesso (gestão profissional, passiva via ETF, exposição via BDR e posse direta) em vez de concentrar tudo numa corretora ou num único ativo.',
      'Gestão profissional (fundos) e ETFs entregam rebalanceamento automático e dispensam a guarda das chaves privadas; a compra direta (spot) é a única que permite Autocustódia (cold wallet) — cada formato troca conveniência por controle.',
      'BDRs de empresas do ecossistema cripto (exchanges como C1OB34, mineradoras como MARA34, ou companhias com Bitcoin em tesouraria) somam o risco cambial e o risco do negócio da empresa ao risco do próprio criptoativo — não é exposição pura ao preço da moeda.',
      'Uma alocação de referência para 20 ativos é 5% por posição, combinando gestão profissional, produtos listados na B3 (ETFs e BDRs) e posse direta das moedas mais consolidadas do mercado.',
    ],
    blocos: [
      {
        titulo: 'Exemplos por pilar de acesso (ilustrativo — não é indicação de compra)',
        itens: [
          { nome: 'Fundos de Investimento Cripto — 30%', detalhe: 'Hashdex 100 e BTG BTC 100 (100% do patrimônio em Bitcoin); QR BTC 100 (fundo de Bitcoin da QR Asset Management, mesma gestora do ETF QBTC11); Hashdex 20 e BTG 20 (só 20% em cripto, 80% em renda fixa — exposição mais suave); Vitreo DeFi (fundo temático em finanças descentralizadas). Gestão profissional, rebalanceamento automático e opções de controle de risco via Renda Fixa.', cor: 'var(--sector-cripto-fundos)' },
          { nome: 'ETFs na B3 — 25%', detalhe: 'HASH11 (cesta diversificada de criptoativos, primeiro ETF cripto do mundo); QBTC11 (primeiro ETF de Bitcoin da América Latina); ETHE11 (100% Ethereum); DEFI11 (cesta de tokens de finanças descentralizadas); WEB311 (plataformas de contratos inteligentes, como Ethereum, Solana e Cardano). Negociação simples em bolsa via Home Broker, cobrindo índices de Bitcoin, Ethereum, DeFi e Web3.', cor: 'var(--sector-cripto-etf)' },
          { nome: 'BDRs da B3 — 25%', detalhe: 'IBIT39 (BDR do ETF de Bitcoin à vista da BlackRock, a maior gestora do mundo); M3TA34, C1OB34, MARA34 e BLOK34 (BDRs de empresas do ecossistema cripto — exchanges, mineradoras e companhias com Bitcoin em tesouraria). Dolarização, escala das maiores gestoras globais e empresas do ecossistema cripto.', cor: 'var(--sector-cripto-bdr)' },
          { nome: 'Compra Direta / Spot — 20%', detalhe: 'BTC (Bitcoin, referência de mercado e reserva de valor digital); ETH (Ethereum, maior rede de contratos inteligentes); SOL (Solana, blockchain de alta velocidade); LINK (Chainlink, rede de oráculos que conecta contratos inteligentes a dados do mundo real). Posse real do ativo e liberdade para transferência a uma Cold Wallet de autocustódia.', cor: 'var(--sector-cripto-spot)' },
        ],
      },
    ],
    atencao: 'Cripto pode oscilar dezenas de % em poucos dias e não tem garantia do FGC — trate como capital que você aceitaria perder. Corretoras/exchanges também têm risco de contraparte (histórico de calotes e falências no setor); prefira plataformas reguladas e, se optar por Autocustódia, entenda a responsabilidade de guardar sua própria chave privada antes de transferir para uma cold wallet.',
    setores: [
      { label: 'Fundos de Investimento Cripto', pct: 30, cor: 'var(--sector-cripto-fundos)', fundos: 6, unidade: 'fundo', funcao: 'Gestão profissional, rebalanceamento automático e opções de controle de risco via Renda Fixa.' },
      { label: 'ETFs na B3', pct: 25, cor: 'var(--sector-cripto-etf)', fundos: 5, unidade: 'etf', funcao: 'Negociação simples em bolsa via Home Broker, cobrindo índices de Bitcoin, Ethereum, DeFi e Web3.' },
      { label: 'BDRs da B3', pct: 25, cor: 'var(--sector-cripto-bdr)', fundos: 5, unidade: 'bdr', funcao: 'Dolarização, escala das maiores gestoras globais (BlackRock) e empresas do ecossistema cripto.' },
      { label: 'Compra Direta (Mercado Spot)', pct: 20, cor: 'var(--sector-cripto-spot)', fundos: 4, unidade: 'moeda', funcao: 'Posse real do ativo e liberdade para transferência a uma Cold Wallet de autocustódia.' },
    ],
    notaSetores:
      'Essa divisão em 4 pilares permite capturar liquidez e diversificação instantânea via ETFs e BDRs de grandes gestoras (como BlackRock e Hashdex), conveniência administrativa com a gestão profissional de fundos, e soberania financeira real ao manter parte do capital em ativos spot diretos (BTC, ETH), prontos para transferência a uma carteira de autocustódia.',
}
