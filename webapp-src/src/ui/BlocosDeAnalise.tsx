import type { ReactNode } from 'react'
import type { BaseDoBalanco } from '../domain/baseDoBalanco'

/** Módulo recolhível de uma análise (cartão com título clicável). */
export function Modulo({ titulo, subtitulo, aberto = false, children, id }: { titulo: string; subtitulo?: ReactNode; aberto?: boolean; children: ReactNode; id?: string }) {
  return (
    <details className="card" open={aberto || undefined} id={id} style={{ scrollMarginTop: 12 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14.5, lineHeight: 1.35 }}>
        {titulo}
        {subtitulo && <span className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}> · {subtitulo}</span>}
      </summary>
      <div className="col" style={{ gap: 12, marginTop: 12 }}>
        {children}
      </div>
    </details>
  )
}

export type Tom = 'positivo' | 'neutro' | 'negativo'

const CLASSE_DO_TOM: Record<Tom, string> = { positivo: 'badge badge-alta', neutro: 'badge badge-media', negativo: 'badge badge-baixa' }

/** Selo colorido; o texto sempre diz o significado, a cor só reforça. */
export function Selo({ tom, children }: { tom: Tom; children: ReactNode }) {
  return <span className={CLASSE_DO_TOM[tom]}>{children}</span>
}

/**
 * Selo de data-base do balanço (D162): aparece no topo de TODO cartão de análise fundamentalista e de preço teto, igual para toda empresa.
 * Diz de qual balanço saem os números e, se já saiu um mais novo que o app ainda não incorporou, avisa.
 */
export function SeloDaBase({ base, id }: { base: BaseDoBalanco | null; id?: string }) {
  if (!base) return <div data-testid={id ? `base-balanco-${id}` : 'base-balanco'}><Selo tom="negativo">Base do balanço não informada</Selo></div>
  const tom: Tom = base.estado === 'aguardando-cvm' ? 'negativo' : base.estado === 'provisorio' ? 'neutro' : 'positivo'
  return (
    <div className="col" style={{ gap: 2 }} data-testid={id ? `base-balanco-${id}` : 'base-balanco'}>
      <div className="row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Selo tom={tom}>{base.texto}</Selo>
      </div>
      {base.pendencia && <span className="tiny" style={{ color: 'var(--warning)', fontWeight: 700 }}>⚠ {base.pendencia}</span>}
    </div>
  )
}

/** Linha rótulo/valor das tabelas de números. */
export function Linha({ rotulo, valor, cor }: { rotulo: ReactNode; valor: ReactNode; cor?: string }) {
  return (
    <div className="tabela-bdr small">
      <span className="muted">{rotulo}</span>
      <span style={{ fontWeight: 600, color: cor }}>{valor}</span>
    </div>
  )
}

/** Barra de 0 a 100 com valor, para notas e confiança. */
export function BarraDeNota({ rotulo, valor, peso, detalhe }: { rotulo: string; valor: number | null; peso?: number; detalhe?: string }) {
  const largura = valor === null ? 0 : Math.max(0, Math.min(100, valor))
  const cor = valor === null ? 'var(--border)' : valor >= 65 ? 'var(--success)' : valor >= 45 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div className="col" style={{ gap: 3 }}>
      <div className="row-between small" style={{ gap: 8 }}>
        <span>
          {rotulo}
          {peso !== undefined && <span className="muted"> · peso {Math.round(peso * 100)}%</span>}
        </span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{valor === null ? '—' : valor}</strong>
      </div>
      <div role="img" aria-label={`${rotulo}: ${valor === null ? 'sem nota' : `${valor} de 100`}`} style={{ height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${largura}%`, height: '100%', background: cor }} />
      </div>
      {detalhe && <span className="tiny muted">{detalhe}</span>}
    </div>
  )
}

/** Faixa de estado: carregando, erro com nova tentativa ou aviso. */
export function EstadoDoArquivo({ estado, aoTentarDeNovo, nome }: { estado: 'ocioso' | 'carregando' | 'erro'; aoTentarDeNovo: () => void; nome: string }) {
  if (estado === 'erro') {
    return (
      <div className="card col" style={{ gap: 8 }} role="alert">
        <span style={{ fontWeight: 700 }}>Não foi possível carregar {nome}.</span>
        <span className="muted small justify">Confira a conexão e tente de novo. Os dados são publicados junto do app depois de cada pregão.</span>
        <button className="btn btn-secondary" onClick={aoTentarDeNovo}>Tentar de novo</button>
      </div>
    )
  }
  return (
    <div className="card small muted" role="status" aria-live="polite">
      Carregando {nome}…
    </div>
  )
}

/** Aviso fixo das análises: leitura quantitativa e educacional, nunca recomendação. */
export function AvisoDaAnalise({ children }: { children?: ReactNode }) {
  return (
    <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
      <strong>Leitura educacional, não é recomendação de investimento.</strong>{' '}
      {children ?? 'Os números e as frases desta aba são calculados por regras públicas a partir de dados passados e atuais; nenhuma delas prevê o preço futuro nem garante resultado. É possível perder parte ou todo o dinheiro investido em ações. Converse com um profissional certificado antes de investir.'}
    </div>
  )
}
