import { useEffect, useState } from 'react'
import { SNAPSHOT_MERCADO } from '../data/snapshotMercado'
import type { SnapshotAcoes } from '../domain/acoes'
import type { SnapshotMercado } from '../domain/mercadoOficial'
import { dataCurta } from '../domain/mercadoOficial'

export interface ItemCotacao {
  rotulo: string
  valor: string
  /** Variação em %, quando existir. */
  variacao?: number | null
}

/** Formato devolvido por /api/cotacoes. */
interface CotacaoAoVivo {
  rotulo: string
  valor: number
  variacao: number | null
  tipo: 'indice' | 'moeda' | 'acao'
}

const QUANTIDADE_ACOES = 14
const INTERVALO_MS = 5 * 60_000

function brl(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

/** Plano B, sem internet ou sem a fonte: dólar PTAX e as ações de maior volume no último fechamento. */
export function itensDoFechamento(snapshot: SnapshotAcoes, mercado: SnapshotMercado = SNAPSHOT_MERCADO): ItemCotacao[] {
  const itens: ItemCotacao[] = []
  const dolar = mercado.indicadores.dolarPtax
  if (dolar) {
    const variacao = dolar.valorAnterior ? (dolar.valor / dolar.valorAnterior - 1) * 100 : null
    itens.push({ rotulo: `Dólar PTAX (${dataCurta(dolar.data)})`, valor: `R$ ${brl(dolar.valor, 4)}`, variacao })
  }
  const acoes = snapshot.setores
    .flatMap((s) => s.empresas)
    .sort((a, b) => b.volumeMedio - a.volumeMedio)
    .slice(0, QUANTIDADE_ACOES)
  for (const a of acoes) itens.push({ rotulo: a.ticker, valor: `R$ ${brl(a.cotacao)}` })
  return itens
}

export function itensAoVivo(cotacoes: CotacaoAoVivo[]): ItemCotacao[] {
  return cotacoes.map((c) => ({
    rotulo: c.rotulo,
    valor: c.tipo === 'indice' ? `${brl(c.valor, 0)} pts` : `R$ ${brl(c.valor, c.tipo === 'moeda' ? 4 : 2)}`,
    variacao: c.variacao,
  }))
}

function lerAoVivo(corpo: unknown): { itens: CotacaoAoVivo[]; atualizadoEm: string } | null {
  const c = corpo as { itens?: unknown; atualizadoEm?: unknown } | null
  if (!c || !Array.isArray(c.itens) || c.itens.length === 0 || typeof c.atualizadoEm !== 'string') return null
  const itens = (c.itens as CotacaoAoVivo[]).filter((i) => i && typeof i.rotulo === 'string' && typeof i.valor === 'number')
  return itens.length > 0 ? { itens, atualizadoEm: c.atualizadoEm } : null
}

/** Busca /api/cotacoes ao abrir e a cada 5 minutos; devolve null enquanto não houver dado ao vivo. */
function useCotacoesAoVivo() {
  const [dados, setDados] = useState<{ itens: CotacaoAoVivo[]; atualizadoEm: string } | null>(null)
  useEffect(() => {
    if (typeof fetch !== 'function') return
    let ativo = true
    const buscar = async () => {
      try {
        const r = await fetch('/api/cotacoes')
        if (!r.ok) return
        const lido = lerAoVivo(await r.json())
        if (ativo && lido) setDados(lido)
      } catch {
        // Sem rede ou sem a fonte: a faixa segue com o último fechamento.
      }
    }
    void buscar()
    const id = setInterval(buscar, INTERVALO_MS)
    return () => {
      ativo = false
      clearInterval(id)
    }
  }, [])
  return dados
}

/**
 * Faixa de cotações que rola da direita para a esquerda. Tenta cotações do dia (/api/cotacoes: Ibovespa,
 * dólar e ações, com atraso da fonte); se não houver, mostra o último fechamento e diz a data.
 * Pausa ao passar o mouse e respeita "reduzir movimento".
 */
export function FaixaCotacoes({ snapshot }: { snapshot: SnapshotAcoes }) {
  const aoVivo = useCotacoesAoVivo()
  const itens = aoVivo ? itensAoVivo(aoVivo.itens) : itensDoFechamento(snapshot)
  if (itens.length === 0) return null
  const lista = (oculto: boolean) => (
    <ul className="faixa-cotacoes-lista" aria-hidden={oculto || undefined}>
      {itens.map((i) => (
        <li key={i.rotulo}>
          <strong>{i.rotulo}</strong> <span>{i.valor}</span>
          {i.variacao != null && (
            <span className={i.variacao >= 0 ? 'faixa-alta' : 'faixa-baixa'}>
              {' '}
              {i.variacao >= 0 ? '▲' : '▼'} {brl(Math.abs(i.variacao))}%
            </span>
          )}
        </li>
      ))}
    </ul>
  )
  const hora = aoVivo ? new Date(aoVivo.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
  return (
    <div className="faixa-cotacoes" role="region" aria-label="Cotações">
      <div className="faixa-cotacoes-trilho">
        {lista(false)}
        {lista(true)}
      </div>
      <div className="tiny muted" style={{ marginTop: 4 }}>
        {aoVivo
          ? `Cotações do dia, atualizadas às ${hora}, podem ter atraso. Não são recomendação.`
          : snapshot.dataPregao
            ? `Ações: fechamento de ${dataCurta(snapshot.dataPregao)} (B3). Não é cotação em tempo real.`
            : ''}
      </div>
    </div>
  )
}
