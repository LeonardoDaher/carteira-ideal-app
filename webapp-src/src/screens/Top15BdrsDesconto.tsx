import { useState } from 'react'
import { storage } from '../data/storage'
import { SNAPSHOT_BDRS_DESCONTO } from '../data/snapshotTop15Mercado'
import { CHAVE_CODIGO_TOP15_BDRS, buscarTop15Bdrs } from '../domain/acessoTop15'
import type { RespostaTop15Bdrs } from '../domain/acessoTop15'
import { formatarPercentual } from '../domain/acoesBaratas'
import { introAuditoria, notaAuditoriaDiaria } from '../domain/auditoriaDiaria'
import { formatarVariacao } from '../domain/bdrs'
import { formatarVolumeDiario } from '../domain/fiiBaratos'
import { formatarData } from '../domain/rendaFii'
import { LogoAtivo } from '../ui/LogoAtivo'
import { ROTULO_ALERTA_BDR, ROTULO_EXCLUSAO_BDR, buscarExclusaoMercado, contarExclusoesMercado } from '../domain/top15Mercado'
import type { ItemBdrTop, SnapshotBdrsDesconto } from '../domain/top15Mercado'
import { PortaoPorCodigo } from '../ui/PortaoPorCodigo'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const AVISO_PADRAO =
  'Não é recomendação de investimento. “Maior desconto” significa só que o preço do BDR está abaixo do maior fechamento dos últimos 12 meses. Isso não é desconto de valor: o preço do BDR depende da ação lá fora ' +
  'e do câmbio, e uma queda grande costuma refletir um problema real da empresa ou do setor, não uma pechincha. A triagem não analisa balanço, dívida nem lucro das empresas estrangeiras. ' +
  'Os números vêm do Boletim de Preços da B3, são do passado e podem conter erros. Rentabilidade passada não garante rentabilidade futura e BDRs podem causar perda de parte ou de todo o dinheiro aplicado. ' +
  'Converse com um profissional certificado antes de investir.'

/**
 * Caixa "Top 15 BDRs com maior desconto" da aba Simule BDR (D70). Triagem por desconto de PREÇO contra a própria
 * máxima de 12 meses, com acesso por código do mês próprio dos BDRs. O resultado vem pronto do job (pasta de
 * auditoria versionada); a tela só mostra, sem reordenar, e repete em vários pontos que não é desconto de valor.
 */
export function Top15BdrsDesconto({
  snapshot = SNAPSHOT_BDRS_DESCONTO,
  carregar = buscarTop15Bdrs,
  armazenamento = storage,
}: {
  snapshot?: SnapshotBdrsDesconto
  /** Pede a lista completa ao servidor com o código do mês. Injetável nos testes. */
  carregar?: (codigo: string) => Promise<RespostaTop15Bdrs>
  armazenamento?: Pick<typeof storage, 'getItem' | 'setItem' | 'removeItem'>
}) {
  if (!snapshot.publicado) return <EmValidacao />
  if (snapshot.acessoRestrito) {
    return (
      <PortaoPorCodigo
        titulo="Top 15 BDRs com maior desconto: acesso por código"
        oQueLibera="Com ele você vê os 15 BDRs mais abaixo da máxima de 12 meses, a conta de cada desconto e os BDRs em conferência."
        instagram={snapshot.instagram}
        carregar={carregar}
        armazenamento={armazenamento}
        chaveArmazenamento={CHAVE_CODIGO_TOP15_BDRS}
        idDeTeste="top15-bdrs-codigo"
        renderizar={(completo, sair) => <ListaBdrs snapshot={completo} aoTrocarCodigo={sair} />}
      />
    )
  }
  if (snapshot.ranking.length === 0) return <EmValidacao />
  return <ListaBdrs snapshot={snapshot} />
}

function EmValidacao() {
  return (
    <div className="card col" style={{ gap: 8 }} role="status" data-testid="top15-bdrs-validacao">
      <span style={{ fontWeight: 700 }}>Top 15 BDRs com maior desconto: em validação</span>
      <span className="muted small justify">
        Esta triagem lista os BDRs cujo preço está mais abaixo do maior fechamento dos últimos 12 meses. Ela aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use a lista e a busca de BDRs.
      </span>
    </div>
  )
}

function ListaBdrs({ snapshot, aoTrocarCodigo }: { snapshot: SnapshotBdrsDesconto; aoTrocarCodigo?: () => void }) {
  if (snapshot.ranking.length === 0) return <EmValidacao />
  const p = snapshot.parametros
  return (
    <div className="col" style={{ gap: 14 }} data-testid="top15-bdrs">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Os {snapshot.tamanhoDaLista} BDRs com maior desconto de preço</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Ordem pelo quanto o preço atual está <strong>abaixo do maior fechamento dos últimos {p.janelaMaxima} pregões</strong> (cerca de 12 meses), só entre BDRs líquidos. É
          <strong> desconto de preço, não de valor</strong>: o BDR acompanha a ação lá fora e o dólar, e a triagem não analisa balanço nenhum. <strong>Uma queda grande costuma ter motivo</strong>
          {' '}(problema da empresa, do setor ou do câmbio) e não é, por si só, oportunidade.
        </div>
        <div className="tiny muted">
          Pregões até {snapshot.ultimoPregao ? formatarData(snapshot.ultimoPregao) : '—'} · metodologia v{snapshot.versaoMetodologia} · {snapshot.universo} BDRs de ação analisados, {snapshot.elegiveis} passaram nos filtros
        </div>
      </div>

      <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label="BDRs com maior desconto de preço">
        {snapshot.ranking.slice(0, snapshot.tamanhoDaLista).map((b, i) => (
          <CartaoBdr key={b.ticker} item={b} ordem={b.posicao ?? i + 1} janelaMaxima={p.janelaMaxima} />
        ))}
      </ol>

      <EmConferencia snapshot={snapshot} />
      <ComoFunciona snapshot={snapshot} />
      <PorQueFicouDeFora snapshot={snapshot} />
      <Auditoria snapshot={snapshot} />
      {aoTrocarCodigo && (
        <button type="button" className="btn btn-outline" onClick={aoTrocarCodigo} style={{ alignSelf: 'flex-start' }}>
          Sair e trocar o código
        </button>
      )}

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid="top15-bdrs-aviso">
        {snapshot.aviso ?? AVISO_PADRAO}
      </div>
    </div>
  )
}

function CartaoBdr({ item: b, ordem, janelaMaxima }: { item: ItemBdrTop; ordem: number; janelaMaxima: number }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  return (
    <li className="card col" style={{ gap: 8 }} data-testid={`top15-bdrs-${b.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{ordem}. <LogoAtivo ticker={b.ticker} tamanho={24} inline />{b.ticker}</span>
          <span className="tiny muted">{b.nome ?? '—'}{b.setor ? ` · ${b.setor}` : ''}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{reais(b.cotacao)}</span>
          <span className="tiny muted">fech. {formatarData(b.dataCotacao)}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 110px' }}>
          <span className="tiny muted">Abaixo da máxima de 12 meses</span>
          <span style={{ fontWeight: 700 }} data-testid={`desconto-${b.ticker}`}>{formatarPercentual(b.desconto)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 110px' }}>
          <span className="tiny muted">Maior fechamento</span>
          <span style={{ fontWeight: 700 }}>{reais(b.maximaFechamento12m)}</span>
          <span className="tiny muted">{b.dataMaxima ? formatarData(b.dataMaxima) : '—'}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Variação em 3 meses</span>
          <span style={{ fontWeight: 700 }}>{b.variacao3m == null ? '—' : formatarVariacao(b.variacao3m)}</span>
        </div>
      </div>
      <div className="tiny muted">
        Negocia {formatarVolumeDiario(b.volumeMediano)} por dia (mediana) · desconto = 1 − {reais(b.cotacao)} ÷ {reais(b.maximaFechamento12m)}, em {janelaMaxima} pregões.
        {b.variacao3m != null && b.variacao3m > 0 ? ' O preço já subiu nos últimos 3 meses: o desconto vem de uma máxima antiga.' : ''}
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

function EmConferencia({ snapshot: s }: { snapshot: SnapshotBdrsDesconto }) {
  if (s.aConferir.length === 0) return null
  return (
    <details className="card" data-testid="top15-bdrs-conferencia">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>BDRs em conferência ({s.aConferir.length})</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <span className="small muted justify" style={{ lineHeight: 1.5 }}>
          Estes BDRs <strong>não entram no ranking</strong> porque o desconto pode estar distorcido (salto de preço que parece desdobramento ou grupamento ainda não confirmado) ou é grande demais para ser aceito
          sem conferência. Voltam ao ranking quando o evento é confirmado nos avisos da B3.
        </span>
        {s.aConferir.map((b) => (
          <div key={b.ticker} className="card-outline small col" style={{ gap: 4 }} data-testid={`conferencia-${b.ticker}`}>
            <span><strong>{b.ticker}</strong> <span className="muted">({b.nome ?? '—'})</span></span>
            <span className="tiny muted">{formatarPercentual(b.desconto)} abaixo do maior fechamento ({reais(b.maximaFechamento12m)}) · preço atual {reais(b.cotacao)}</span>
            <ul className="tiny" style={{ margin: 0, paddingLeft: 18 }}>
              {(b.alertas ?? []).map((a) => (
                <li key={a}><strong>{ROTULO_ALERTA_BDR[a]?.titulo ?? a}.</strong> {ROTULO_ALERTA_BDR[a]?.texto}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  )
}

function ComoFunciona({ snapshot: s }: { snapshot: SnapshotBdrsDesconto }) {
  const p = s.parametros
  const pct = (v: number, c = 0) => formatarPercentual(v, c)
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
      <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
        <li>
          <strong>Quais BDRs.</strong> Só BDRs de ações (códigos terminados em 31 a 35). BDRs de ETF (final 39) e empresas de origem ou operação brasileira listadas no exterior ficam de fora.
        </li>
        <li>
          <strong>Filtros.</strong> Volume mediano de pelo menos {formatarVolumeDiario(p.volumeMinimoDiario)} por dia, negócios em pelo menos {p.diasNegociadosMinimos} dos últimos {p.janelaLiquidez} pregões, último negócio há no máximo {p.pregoesMaxSemNegocio} pregões
          e pelo menos {p.pregoesMinimosHistorico} pregões de histórico, para existir uma máxima de 12 meses de verdade.
        </li>
        <li>
          <strong>Desconto.</strong> 1 − (último fechamento ÷ maior fechamento dos últimos {p.janelaMaxima} pregões). Desdobramentos e grupamentos confirmados são aplicados antes; sem isso, um desdobramento pareceria uma queda enorme.
        </li>
        <li>
          <strong>Conferência.</strong> Sai do ranking, para conferência, o BDR com salto de preço de {pct(1 - p.saltoQueda)} para baixo ou {pct(p.saltoAlta - 1)} para cima entre dois fechamentos seguidos (possível desdobramento não confirmado) ou com desconto acima de {pct(p.descontoParaConferir)}.
        </li>
        <li>
          <strong>Ordenação.</strong> Do maior para o menor desconto; em empate, o de maior volume.
        </li>
        <li>
          <strong>O que este ranking não é.</strong> Não olha lucro, dívida, avaliação nem perspectivas da empresa, e o preço em reais mistura o movimento da ação e o do dólar. Para uma análise de valor seria preciso trazer os balanços das empresas estrangeiras, o que esta versão não faz.
        </li>
      </ol>
    </details>
  )
}

function PorQueFicouDeFora({ snapshot: s }: { snapshot: SnapshotBdrsDesconto }) {
  const [termo, setTermo] = useState('')
  const achados = buscarExclusaoMercado(s.exclusoes, termo)
  const contagem = contarExclusoesMercado(s.exclusoes, ROTULO_EXCLUSAO_BDR)
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Por que um BDR ficou de fora?</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <input type="search" className="busca-fii" placeholder="Código ou nome, ex.: AAPL34" aria-label="Buscar BDR fora da triagem" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={termo} onChange={(e) => setTermo(e.target.value.slice(0, 40))} />
        {termo.trim().length >= 2 && achados.length === 0 && (
          <span className="small muted">Nenhum BDR fora do ranking com esse código ou nome. Se ele está no app, está no ranking ou em conferência; os demais não fazem parte da triagem (por exemplo, BDRs de ETF).</span>
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

function Auditoria({ snapshot: s }: { snapshot: SnapshotBdrsDesconto }) {
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
      <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
        <span>
          {introAuditoria(s)} <code>{s.pastaAuditoria ?? 'auditoria/top15-bdrs/…'}</code> com os preços e volumes usados, os desdobramentos aplicados, o resultado, a conta de cada desconto e o motivo
          de cada exclusão.
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
  )
}
