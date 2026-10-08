import { useState } from 'react'
import { SNAPSHOT_ETFS_MAIS_NEGOCIADOS } from '../data/snapshotTop15Mercado'
import { formatarVariacao } from '../domain/bdrs'
import { formatarVolumeDiario } from '../domain/fiiBaratos'
import { formatarData } from '../domain/rendaFii'
import { ROTULO_EXCLUSAO_ETF, buscarExclusaoMercado, contarExclusoesMercado } from '../domain/top15Mercado'
import type { ItemEtfTop, SnapshotEtfsMaisNegociados } from '../domain/top15Mercado'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const AVISO_PADRAO =
  'Não é recomendação de investimento. “Mais negociado” significa apenas maior volume financeiro diário (mediana dos últimos pregões): é liquidez, e não indica qualidade, custo baixo, ' +
  'bom momento de compra nem adequação ao seu perfil. Cada ETF tem taxa de administração, índice, risco e tributação próprios; leia o regulamento e a lâmina antes de investir. ' +
  'Os números vêm do Boletim de Preços da B3, são do passado e podem conter erros. Rentabilidade passada não garante rentabilidade futura. Converse com um profissional certificado antes de investir.'

/**
 * Caixa "Top 15 ETFs mais negociados" da aba Simule ETF (D70). Ranking aberto por volume financeiro: o resultado
 * e a posição de cada ETF vêm prontos do job (pasta de auditoria versionada); a tela só mostra, sem reordenar.
 * É liquidez, não qualidade: o texto diz isso no topo, no cartão e no aviso.
 */
export function Top15EtfsMaisNegociados({ snapshot = SNAPSHOT_ETFS_MAIS_NEGOCIADOS }: { snapshot?: SnapshotEtfsMaisNegociados }) {
  if (!snapshot.publicado || snapshot.geral.length === 0) return <EmValidacao />
  const categorias = Object.keys(snapshot.porCategoria)

  return (
    <div className="col" style={{ gap: 14 }} data-testid="top15-etfs">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Os {snapshot.tamanhoDaLista} ETFs mais negociados</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Ordem pelo <strong>volume financeiro diário</strong> (a mediana dos últimos {snapshot.parametros.janelaLiquidez} pregões, em reais). É uma medida de{' '}
          <strong>liquidez</strong>: quanto o ETF é comprado e vendido. <strong>Mais negociado não quer dizer melhor, mais barato nem mais seguro</strong>; a taxa de
          administração, o índice e o risco de cada ETF você confere no regulamento.
        </div>
        <div className="tiny muted">
          Pregões até {snapshot.ultimoPregao ? formatarData(snapshot.ultimoPregao) : '—'} · metodologia v{snapshot.versaoMetodologia} · {snapshot.universo} ETFs analisados, {snapshot.elegiveis} passaram nos filtros
        </div>
      </div>

      <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label="ETFs mais negociados">
        {snapshot.geral.slice(0, snapshot.tamanhoDaLista).map((e) => (
          <CartaoEtf key={e.ticker} item={e} ordem={e.posicaoGeral} janela={snapshot.parametros.janelaLiquidez} />
        ))}
      </ol>

      {categorias.length > 0 && (
        <details className="card" data-testid="top15-etfs-categorias">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Os mais negociados de cada categoria</summary>
          <div className="col" style={{ gap: 10, marginTop: 8 }}>
            {categorias.map((c) => (
              <div key={c} className="col" style={{ gap: 4 }}>
                <span className="small" style={{ fontWeight: 600 }}>{c}</span>
                <ol className="col" style={{ gap: 2, listStyle: 'none', padding: 0, margin: 0 }} aria-label={`ETFs mais negociados em ${c}`}>
                  {snapshot.porCategoria[c].map((e) => (
                    <li key={e.ticker} className="tabela-bdr small" data-testid={`categoria-${c}-${e.ticker}`}>
                      <span className="col" style={{ gap: 0 }}>
                        <span>{e.posicaoNaCategoria}. <strong>{e.ticker}</strong></span>
                        <span className="tiny muted">{e.nome}</span>
                      </span>
                      <span style={{ fontWeight: 600 }}>{formatarVolumeDiario(e.volumeMediano)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </details>
      )}

      <ComoFunciona snapshot={snapshot} />
      <PorQueFicouDeFora snapshot={snapshot} />
      <Auditoria snapshot={snapshot} />

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid="top15-etfs-aviso">
        {snapshot.aviso ?? AVISO_PADRAO}
      </div>
    </div>
  )
}

function EmValidacao() {
  return (
    <div className="card col" style={{ gap: 8 }} role="status" data-testid="top15-etfs-validacao">
      <span style={{ fontWeight: 700 }}>Top 15 ETFs mais negociados: em validação</span>
      <span className="muted small justify">
        Este ranking ordena os ETFs pelo volume financeiro negociado por dia. Ele aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use a lista e a busca de ETFs.
      </span>
    </div>
  )
}

function CartaoEtf({ item: e, ordem, janela }: { item: ItemEtfTop; ordem: number; janela: number }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  return (
    <li className="card col" style={{ gap: 8 }} data-testid={`top15-etfs-${e.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>{ordem}. {e.ticker}</span>
          <span className="tiny muted">{e.nome} · {e.categoria}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700 }}>{e.cotacao == null ? '—' : reais(e.cotacao)}</span>
          <span className="tiny muted">fech. {e.dataCotacao ? formatarData(e.dataCotacao) : '—'}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 120px' }}>
          <span className="tiny muted">Volume por dia (mediana)</span>
          <span style={{ fontWeight: 700 }}>{formatarVolumeDiario(e.volumeMediano)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Negociou em</span>
          <span style={{ fontWeight: 700 }}>{e.diasNegociados} de {janela} pregões</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Variação em 3 meses</span>
          <span style={{ fontWeight: 700 }}>{e.variacao3m == null ? '—' : formatarVariacao(e.variacao3m)}</span>
        </div>
      </div>
      <div className="tiny muted">
        Volume médio {formatarVolumeDiario(e.volumeMedio)} por dia · a posição vem da mediana, que não é puxada por um único dia de volume alto.
      </div>
    </li>
  )
}

function Linha({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="tabela-bdr small">
      <span className="col" style={{ gap: 0 }}>
        <span className="muted">{rotulo}</span>
        {nota && <span className="tiny muted">{nota}</span>}
      </span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  )
}

function ComoFunciona({ snapshot: s }: { snapshot: SnapshotEtfsMaisNegociados }) {
  const p = s.parametros
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
      <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
        <li>
          <strong>Volume por dia.</strong> Para cada ETF, o volume financeiro (em reais) de cada um dos últimos {p.janelaLiquidez} pregões, do Boletim de Preços da B3. Dia sem negócio conta zero.
          O valor usado é a <strong>mediana</strong> desses dias: metade dos dias teve volume maior, metade menor.
        </li>
        <li>
          <strong>Filtros.</strong> Entra quem tem mediana de pelo menos {formatarVolumeDiario(p.volumeMinimoDiario)} por dia, negociou em pelo menos {p.diasNegociadosMinimos} dos {p.janelaLiquidez} pregões e tem
          o último negócio há no máximo {p.pregoesMaxSemNegocio} pregões. Alguns produtos classificados como ETF, mas que não são fundos de índice comuns, ficam de fora por decisão registrada.
        </li>
        <li>
          <strong>Ordenação.</strong> Do maior para o menor volume mediano; em empate, vence quem negociou em mais dias e depois a ordem alfabética. Há também os {p.tamanhoPorCategoria} mais negociados de cada categoria.
        </li>
        <li>
          <strong>O que este ranking não é.</strong> Não mede taxa de administração, desempenho, risco, tamanho do patrimônio nem qualidade do índice. Esses dados não estão no Boletim da B3 e você encontra no regulamento e na lâmina de cada ETF.
        </li>
      </ol>
    </details>
  )
}

function PorQueFicouDeFora({ snapshot: s }: { snapshot: SnapshotEtfsMaisNegociados }) {
  const [termo, setTermo] = useState('')
  const achados = buscarExclusaoMercado(s.exclusoes, termo)
  const contagem = contarExclusoesMercado(s.exclusoes, ROTULO_EXCLUSAO_ETF)
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Por que um ETF ficou de fora?</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <input type="search" className="busca-fii" placeholder="Código ou nome, ex.: HASH11" aria-label="Buscar ETF fora do ranking" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={termo} onChange={(e) => setTermo(e.target.value.slice(0, 40))} />
        {termo.trim().length >= 2 && achados.length === 0 && (
          <span className="small muted">Nenhum ETF fora do ranking com esse código ou nome. Se ele está no app, passou nos filtros e só não ficou entre os primeiros.</span>
        )}
        {achados.map((e) => (
          <div key={e.ticker} className="card-outline small justify">
            <strong>{e.ticker}</strong> <span className="muted">({e.nome})</span>: {e.motivo}
          </div>
        ))}
        <div className="col" style={{ gap: 0 }}>
          {contagem.map((c) => (
            <div key={c.codigo} className="tabela-bdr small">
              <span className="muted">{c.rotulo}</span>
              <span style={{ fontWeight: 600 }}>{c.total}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

function Auditoria({ snapshot: s }: { snapshot: SnapshotEtfsMaisNegociados }) {
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
      <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
        <span>
          Toda execução grava, no repositório do projeto, a pasta <code>{s.pastaAuditoria ?? 'auditoria/top15-etfs/…'}</code> com os preços e volumes usados, o resultado, o volume de cada dia de cada ETF da lista e o
          motivo de cada exclusão.
        </span>
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
  )
}

