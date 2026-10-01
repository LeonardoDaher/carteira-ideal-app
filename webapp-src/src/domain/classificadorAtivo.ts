// Minha Carteira (D36): deduz a classe de ativo (uma das 11 da régua) a partir do que a
// pessoa digitou — ticker ("MXRF11") ou nome ("Tesouro IPCA+ 2035", "CDB Banco X").
//
// Regra de ouro: o classificador SUGERE, a pessoa CONFIRMA. Só 'alta' dispensa confirmação;
// 'media' e 'baixa' pedem um toque de confirmação na tela. Nunca escolhe em silêncio uma
// classe duvidosa, porque uma classe errada distorce todo o comparativo com a referência.
//
// Módulo puro (sem rede, sem React). Os catálogos (FIIs, ETFs, BDRs) vêm de fora, dos
// mesmos JSONs que já alimentam as abas Simule FII/ETF/BDR.
import type { AtivoKey } from './types'
import { PADRAO_TICKER } from './lancamentos'
import { normalizarBusca } from './rendaFii'

/** 'foraDaRegua' = ativo que existe na carteira da pessoa mas não tem classe na régua de 11
 * (CDB sem liquidez diária, CRI/CRA, debênture, previdência, fundos). */
export type ClasseCarteira = AtivoKey | 'foraDaRegua'

export type Confianca = 'alta' | 'media' | 'baixa'

export interface Classificacao {
  /** null = não foi possível deduzir; a pessoa escolhe na lista. */
  classe: ClasseCarteira | null
  confianca: Confianca
  /** Frase curta para mostrar na confirmação ("Terminação 11 está na lista de FIIs"). */
  motivo: string
  /** Outras classes plausíveis, para o seletor mostrar primeiro. */
  alternativas: ClasseCarteira[]
}

export interface CatalogoAtivos {
  fiis: ReadonlySet<string>
  etfs: ReadonlyMap<string, { nome: string; categoria: string }>
  bdrs: ReadonlyMap<string, { tipo: 'acao' | 'etf' }>
}

export interface FontesCatalogo {
  fiis?: { ticker: string }[]
  etfs?: { ticker: string; nome: string; categoria: string }[]
  bdrs?: { ticker: string; tipo?: string }[]
  bdrsEtfs?: { ticker: string }[]
}

/** Monta o catálogo a partir dos JSONs: `rendimentosFii.json` (fundos + indisponiveis),
 * `etfs.json` (etfs + busca) e `bdrs.json` (acoes + busca; etfs vão em `bdrsEtfs`). */
export function montarCatalogo(f: FontesCatalogo): CatalogoAtivos {
  const fiis = new Set((f.fiis ?? []).map((x) => x.ticker.toUpperCase()))
  const etfs = new Map<string, { nome: string; categoria: string }>()
  for (const e of f.etfs ?? []) etfs.set(e.ticker.toUpperCase(), { nome: e.nome, categoria: e.categoria })
  const bdrs = new Map<string, { tipo: 'acao' | 'etf' }>()
  for (const b of f.bdrs ?? []) bdrs.set(b.ticker.toUpperCase(), { tipo: b.tipo === 'etf' ? 'etf' : 'acao' })
  for (const b of f.bdrsEtfs ?? []) bdrs.set(b.ticker.toUpperCase(), { tipo: 'etf' })
  return { fiis, etfs, bdrs }
}

export const CATALOGO_VAZIO: CatalogoAtivos = { fiis: new Set(), etfs: new Map(), bdrs: new Map() }

/** Quem precisa de um toque de confirmação na tela. */
export function precisaConfirmar(c: Classificacao): boolean {
  return c.classe === null || c.confianca !== 'alta'
}

const NADA: Classificacao = {
  classe: null,
  confianca: 'baixa',
  motivo: 'Não reconhecemos este ativo. Escolha a classe na lista.',
  alternativas: [],
}

function r(classe: ClasseCarteira | null, confianca: Confianca, motivo: string, alternativas: ClasseCarteira[] = []): Classificacao {
  return { classe, confianca, motivo, alternativas }
}

function classificarTesouro(t: string): Classificacao | null {
  const ehTesouro = /\bTESOURO\b/.test(t) || /\b(LFT|LTN|NTN-?B|NTN-?F)\b/.test(t) || /\b(RENDA|EDUCA)\s?\+/.test(t)
  if (!ehTesouro) return null
  if (/\b(RENDA|EDUCA)\s?\+/.test(t)) {
    return r('tesouroIPCA', 'media', 'Tesouro Renda+/Educa+ é indexado ao IPCA; a régua o trata como Tesouro IPCA+.', ['tesouroIPCA', 'foraDaRegua'])
  }
  if (/\bSELIC\b|\bLFT\b/.test(t)) return r('tesouroSelic', 'alta', 'Título público pós-fixado pela Selic.')
  if (/\bIPCA\b|NTN-?B/.test(t)) return r('tesouroIPCA', 'alta', 'Título público indexado ao IPCA.')
  if (/PREFIXADO|\bLTN\b|NTN-?F/.test(t)) return r('tesouroPrefixado', 'alta', 'Título público de taxa prefixada.')
  return r(null, 'baixa', 'É um título do Tesouro, mas não deu para saber qual. Escolha o tipo.', [
    'tesouroSelic',
    'tesouroIPCA',
    'tesouroPrefixado',
  ])
}

function classificarRendaFixaPrivada(t: string): Classificacao | null {
  if (/\b(LCI|LCA)\b/.test(t)) return r('lciLca', 'alta', 'Letra de crédito imobiliário/agro.')
  if (/\bCDB\b/.test(t)) {
    if (/LIQUIDEZ\s+DIARIA|LIQ\.?\s+DIARIA|RESGATE\s+DIARIO|D\+0/.test(t)) {
      return r('cdbLiquidez', 'alta', 'CDB com liquidez diária.')
    }
    return r(
      'foraDaRegua',
      'media',
      'A referência só prevê CDB com liquidez diária. Se este tem resgate a qualquer momento, troque para "CDB com liquidez diária".',
      ['cdbLiquidez', 'foraDaRegua'],
    )
  }
  if (/\b(CRI|CRA|DEBENTURES?|COE|PGBL|VGBL|PREVIDENCIA|MULTIMERCADO|CREDITO PRIVADO)\b/.test(t)) {
    return r('foraDaRegua', 'alta', 'Esse tipo de ativo não tem classe na régua; fica como "Fora da régua".')
  }
  return null
}

function classificarCategoriaEtf(nome: string, categoria: string): Classificacao {
  const n = normalizarBusca(nome)
  switch (categoria) {
    case 'Bolsa exterior':
      return r('fundosInternacionais', 'alta', 'ETF de bolsa fora do Brasil.')
    case 'Bolsa brasileira':
      return r('acoesETFs', 'media', 'ETF de ações brasileiras: entra na classe Ações.', ['acoesETFs'])
    case 'Cripto':
      return r('cripto', 'alta', 'ETF de criptoativos.')
    case 'Ouro, dólar e commodities':
      if (/\bOURO\b|GOLD/.test(n)) return r('ouro', 'alta', 'ETF de ouro.')
      return r('foraDaRegua', 'media', 'ETF de dólar ou commodities (não é ouro): sem classe na régua.', ['ouro', 'foraDaRegua'])
    case 'Renda fixa':
      return r('foraDaRegua', 'media', 'ETF de renda fixa: sem classe equivalente na régua.', ['foraDaRegua'])
    default:
      return r(null, 'baixa', 'ETF de categoria mista. Escolha a classe que melhor descreve.', [
        'acoesETFs',
        'fundosInternacionais',
        'foraDaRegua',
      ])
  }
}

function classificarTicker(ticker: string, cat: CatalogoAtivos): Classificacao | null {
  const etf = cat.etfs.get(ticker)
  if (etf) return classificarCategoriaEtf(etf.nome, etf.categoria)
  const bdr = cat.bdrs.get(ticker)
  if (bdr) {
    if (bdr.tipo === 'etf') {
      return r('fundosInternacionais', 'media', 'BDR de ETF: é um ETF de bolsa estrangeira, então entra em Fundos Internacionais.', ['fundosInternacionais', 'bdrs'])
    }
    return r('bdrs', 'alta', 'BDR: recibo de ação estrangeira.')
  }
  if (cat.fiis.has(ticker)) return r('fiis', 'alta', 'Está na lista de fundos imobiliários.')

  const m = ticker.match(/^[A-Z][A-Z0-9]{3}(\d{1,2})$/)
  if (!m) return null
  const sufixo = Number(m[1])
  if (sufixo >= 3 && sufixo <= 8) return r('acoesETFs', 'alta', 'Terminação de ação (3 a 8).')
  if (sufixo >= 32 && sufixo <= 35) return r('bdrs', 'alta', 'Terminação de BDR (32 a 35).')
  if (sufixo === 39) {
    return r('fundosInternacionais', 'media', 'Terminação 39 é BDR de ETF: entra em Fundos Internacionais.', ['fundosInternacionais', 'bdrs'])
  }
  if (sufixo === 11) {
    return r(null, 'baixa', 'Terminação 11 pode ser FII, ETF ou unit de ações, e não está nas nossas listas. Escolha a classe.', [
      'fiis',
      'acoesETFs',
      'fundosInternacionais',
      'ouro',
      'cripto',
    ])
  }
  return null
}

/** Deduz a classe de uma entrada livre (ticker ou nome). */
export function classificarAtivo(entrada: string, catalogo: CatalogoAtivos = CATALOGO_VAZIO): Classificacao {
  const t = normalizarBusca(entrada)
  if (!t) return NADA

  // 1) Tesouro e renda fixa privada: o nome decide (não têm ticker de bolsa).
  const porNome = classificarTesouro(t) ?? classificarRendaFixaPrivada(t)
  if (porNome) return porNome

  // 2) Ticker de bolsa em qualquer ponto do texto ("BBSE3 - BB Seguridade"); aceita o
  // mercado fracionário (PETR4F).
  const achado = t.match(new RegExp(`\\b(${PADRAO_TICKER})F?\\b`))
  let doTicker: Classificacao | null = null
  if (achado) {
    doTicker = classificarTicker(achado[1], catalogo)
    if (doTicker && doTicker.classe !== null) return doTicker
  }

  // 3) Palavras-chave de ouro e cripto (sem ticker).
  if (/BITCOIN|\bBTC\b|ETHEREUM|\bETH\b|CRIPTO/.test(t)) return r('cripto', 'alta', 'Criptoativo.')
  if (/\bOURO\b|\bGOLD\b/.test(t)) return r('ouro', 'media', 'Ouro: confirme se é ETF/fundo de ouro.', ['ouro', 'foraDaRegua'])

  return doTicker ?? NADA
}
