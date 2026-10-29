import { Fragment } from 'react'
import { SNAPSHOT_IBOV_MAIORES_PESOS, SNAPSHOT_IFIX_MAIORES_PESOS } from '../data/snapshotTop15Mercado'
import { introAuditoria, notaAuditoriaDiaria } from '../domain/auditoriaDiaria'
import { formatarVolumeDiario } from '../domain/fiiBaratos'
import { formatarData } from '../domain/rendaFii'
import type { ItemIndice, SnapshotIndice } from '../domain/top15Mercado'
import { LogoAtivo } from '../ui/LogoAtivo'

export type ClasseIndice = 'ifix' | 'ibov'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** 8.764 → "8,76%" (a B3 publica três casas; a tela mostra duas, e o arquivo guarda as três). */
export function formatarPeso(v: number | null | undefined, casas = 2) {
  return v == null || !Number.isFinite(v) ? '—' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`
}

function negrito(texto: string) {
  return texto.split('**').map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : <Fragment key={i}>{parte}</Fragment>))
}

interface Textos {
  id: string
  indice: string
  singular: string
  plural: string
  tituloTop: (n: number) => string
  tituloValidacao: string
  descricaoValidacao: string
  topo: (data: string) => string
  naoMede: string
  avisoPadrao: string
  pastaPadrao: string
}

export const TEXTOS_INDICE: Record<ClasseIndice, Textos> = {
  ifix: {
    id: 'top15-ifix', indice: 'IFIX', singular: 'fundo', plural: 'fundos',
    tituloTop: (n) => `Os ${n} maiores pesos do IFIX`,
    tituloValidacao: 'Top 15 do IFIX: em validação',
    descricaoValidacao: 'Esta lista mostra os fundos imobiliários de maior peso no IFIX, o índice de fundos imobiliários da B3. Ela aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use o simulador.',
    topo: (d) => `Composição oficial do IFIX publicada pela B3 em ${d}. O **peso** é a participação de cada fundo no índice. **Peso grande quer dizer fundo grande e líquido dentro do índice, e não que ele seja melhor, mais barato ou mais seguro.**`,
    naoMede: 'Não mede rendimento, preço em relação ao patrimônio, vacância, inadimplência nem risco. Para isso, veja o Top 15 FIIs baratos e o informe mensal de cada fundo.',
    avisoPadrao: 'Não é recomendação de investimento. Esta lista é a composição oficial do IFIX, publicada pela B3, e o peso mostra tamanho e liquidez dentro do índice, e não qualidade, preço baixo ou segurança. Converse com um profissional certificado antes de investir.',
    pastaPadrao: 'auditoria/top15-ifix/…',
  },
  ibov: {
    id: 'top15-ibov', indice: 'Ibovespa', singular: 'ação', plural: 'ações',
    tituloTop: (n) => `Os ${n} maiores pesos do Ibovespa`,
    tituloValidacao: 'Top 15 do Ibovespa: em validação',
    descricaoValidacao: 'Esta lista mostra as ações de maior peso no Ibovespa, o principal índice da bolsa brasileira. Ela aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use o simulador.',
    topo: (d) => `Composição oficial do Ibovespa publicada pela B3 em ${d}. O **peso** é a participação de cada ação no índice. **Peso grande quer dizer empresa grande e líquida dentro do índice, e não que a ação seja melhor, mais barata ou mais segura.** Uma empresa pode aparecer com mais de um código (PETR3 e PETR4, por exemplo).`,
    naoMede: 'Não mede lucro, dívida, avaliação, dividendos nem perspectivas da empresa. Para um olhar de preço contra os números da empresa, veja o Top 15 ações baratas.',
    avisoPadrao: 'Não é recomendação de investimento. Esta lista é a composição oficial do Ibovespa, publicada pela B3, e o peso mostra tamanho e liquidez dentro do índice, e não qualidade, preço baixo ou segurança. Converse com um profissional certificado antes de investir.',
    pastaPadrao: 'auditoria/top15-ibov/…',
  },
}

const SNAPSHOT_PADRAO: Record<ClasseIndice, SnapshotIndice> = { ifix: SNAPSHOT_IFIX_MAIORES_PESOS, ibov: SNAPSHOT_IBOV_MAIORES_PESOS }

/**
 * Caixa "Top 15 do IFIX" / "Top 15 do Ibovespa" (D72): os 15 maiores pesos da carteira teórica oficial da B3. O peso é
 * o que a B3 publica; o job só ordena e soma. A tela mostra e diz de onde veio, sem reordenar nem opinar.
 */
export function Top15Indice({ classe, snapshot }: { classe: ClasseIndice; snapshot?: SnapshotIndice }) {
  const t = TEXTOS_INDICE[classe]
  const s = snapshot ?? SNAPSHOT_PADRAO[classe]
  if (!s.publicado || s.ranking.length === 0) {
    return (
      <div className="card col" style={{ gap: 8 }} role="status" data-testid={`${t.id}-validacao`}>
        <span style={{ fontWeight: 700 }}>{t.tituloValidacao}</span>
        <span className="muted small justify">{t.descricaoValidacao}</span>
      </div>
    )
  }
  const lista = s.ranking.slice(0, s.tamanhoDaLista)
  const maior = Math.max(...lista.map((r) => r.peso))

  return (
    <div className="col" style={{ gap: 14 }} data-testid={t.id}>
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>{t.tituloTop(s.tamanhoDaLista)}</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>{negrito(t.topo(formatarData(s.dataComposicao)))}</div>
        <div className="tiny muted">
          Carteira de {formatarData(s.dataComposicao)} · metodologia v{s.versaoMetodologia} · o índice tem {s.universo} ativos; estes {lista.length} somam{' '}
          <strong data-testid={`${t.id}-soma`}>{formatarPeso(s.somaPesosDaLista, 1)}</strong> dele
        </div>
      </div>

      <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label={`Maiores pesos do ${t.indice}`}>
        {lista.map((r) => (
          <Cartao key={r.ticker} t={t} item={r} maior={maior} />
        ))}
      </ol>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
        <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
          <li>
            <strong>De onde vem.</strong> A carteira teórica do {t.indice} que a B3 publica (a mesma da página do índice no site da B3), baixada na execução. O peso de cada {t.singular} é o que a B3 informa; o app e o job só ordenam e somam.
          </li>
          <li>
            <strong>Ordenação.</strong> Do maior para o menor peso; em empate, ordem alfabética do código. O peso acumulado é a soma do peso de quem vem antes.
          </li>
          <li>
            <strong>Cotação e volume.</strong> São informativos, do Boletim de Preços da B3 (último fechamento e mediana do volume diário dos últimos {s.parametros.janelaLiquidez} pregões), e não entram na ordem.
          </li>
          <li>
            <strong>Os pesos mudam.</strong> A B3 revisa a carteira a cada quadrimestre, e entre as revisões os pesos mudam todo dia com os preços. A tela mostra a carteira da data indicada.
          </li>
          <li>
            <strong>Trava de segurança.</strong> Se a carteira vier incompleta, com pesos que não somam 100% ou com mais de {s.parametros.idadeMaximaDias ?? 10} dias de idade, a lista não é atualizada.
          </li>
          <li>
            <strong>O que este ranking não é.</strong> {t.naoMede}
          </li>
        </ol>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
        <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
          <span>
            {introAuditoria(s)} <code>{s.pastaAuditoria ?? t.pastaPadrao}</code> com a carteira completa da B3 (todos os pesos), o endereço e a impressão digital (sha256) da resposta da B3, o resultado e
            o motivo de cada número.
          </span>
          {notaAuditoriaDiaria(s) && <span>{notaAuditoriaDiaria(s)}</span>}
          <span>Para refazer o cálculo, sem internet, e conferir se o resultado é o mesmo:</span>
          <code style={{ display: 'block', overflowX: 'auto', whiteSpace: 'pre', padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)' }}>
            node scripts/top15-mercado-verificar.mjs {s.pastaAuditoria ?? '…'}
          </code>
          <div className="col" style={{ gap: 0 }}>
            <Linha rotulo="Metodologia" valor={`v${s.versaoMetodologia}`} />
            <Linha rotulo="Impressão digital do resultado" valor={s.hashResultado ? `${s.hashResultado.slice(0, 16)}…` : '—'} />
            <Linha rotulo="Impressão digital dos insumos" valor={s.hashInsumos ? `${s.hashInsumos.slice(0, 16)}…` : '—'} />
            <Linha rotulo="Gerado em" valor={s.geradoEm ? formatarData(s.geradoEm) : '—'} />
          </div>
          <span className="tiny muted">A descrição completa está em docs/11-metodologia-top15-etfs-bdrs.md.</span>
        </div>
      </details>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid={`${t.id}-aviso`}>
        {s.aviso ?? t.avisoPadrao}
      </div>
    </div>
  )
}

function Cartao({ t, item: r, maior }: { t: Textos; item: ItemIndice; maior: number }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  const largura = maior > 0 ? Math.max(2, Math.round((r.peso / maior) * 100)) : 0
  return (
    <li className="card col" style={{ gap: 8 }} data-testid={`${t.id}-${r.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{r.posicao}. <LogoAtivo ticker={r.ticker} tamanho={24} inline />{r.ticker}</span>
          <span className="tiny muted">{r.nome}{r.setor ? ` · ${r.setor}` : ''}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.cotacao == null ? '—' : reais(r.cotacao)}</span>
          <span className="tiny muted">fech. {r.dataCotacao ? formatarData(r.dataCotacao) : '—'}</span>
        </div>
      </div>
      <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--surface2)' }}>
        <div style={{ width: `${largura}%`, height: '100%', borderRadius: 3, background: 'var(--accent, currentColor)', opacity: 0.7 }} />
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 100px' }}>
          <span className="tiny muted">Peso no índice</span>
          <span style={{ fontWeight: 700 }} data-testid={`peso-${r.ticker}`}>{formatarPeso(r.peso)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 100px' }}>
          <span className="tiny muted">Peso acumulado</span>
          <span style={{ fontWeight: 700 }}>{formatarPeso(r.pesoAcumulado)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 100px' }}>
          <span className="tiny muted">Volume por dia (mediana)</span>
          <span style={{ fontWeight: 700 }}>{r.volumeMediano == null ? '—' : formatarVolumeDiario(r.volumeMediano)}</span>
        </div>
      </div>
      <div className="tiny muted">
        Quantidade teórica na carteira: {r.quantidadeTeorica == null ? '—' : r.quantidadeTeorica.toLocaleString('pt-BR')}{r.tipo ? ` · tipo ${r.tipo}` : ''}.
      </div>
    </li>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="tabela-bdr small">
      <span className="muted">{rotulo}</span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  )
}
