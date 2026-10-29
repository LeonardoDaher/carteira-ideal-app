import { Fragment, useState } from 'react'
import { SNAPSHOT_ACOES_DIVIDENDOS } from '../data/snapshotAcoesDividendos'
import { ROTULO_TIPO_PROVENTO, buscarSituacaoDividendos, contarExclusoesDividendos } from '../domain/acoesDividendos'
import type { ItemDividendos, SnapshotAcoesDividendos } from '../domain/acoesDividendos'
import { formatarPercentual, formatarReaisCompacto } from '../domain/acoesBaratas'
import { introAuditoria, notaAuditoriaDiaria } from '../domain/auditoriaDiaria'
import { formatarData } from '../domain/rendaFii'
import { LogoAtivo } from '../ui/LogoAtivo'

const AVISO_PADRAO =
  'Não é recomendação de investimento. Esta lista ordena as ações pelo dividend yield dos últimos 12 meses: os proventos em dinheiro por ação (dividendos e juros sobre capital próprio, brutos) divididos pelo preço de fechamento mais recente, com dados da B3. Dividend yield alto não quer dizer que a ação é boa nem que o pagamento vai se repetir. Converse com um profissional certificado antes de investir.'

function reais(valor: number, casas = 2) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: Math.max(casas, 2) })
}

/** Provento por ação costuma ter centavos quebrados (0,0317); quatro casas evitam arredondar para zero. */
const reaisPorAcao = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })

function negrito(texto: string) {
  return texto.split('**').map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : <Fragment key={i}>{parte}</Fragment>))
}

/** 0,2771 → "27,7%". */
export const formatarDy = (v: number | null | undefined) => formatarPercentual(v, 1)

/**
 * Caixa "Top 15 ações pagadoras de dividendos" (D122): as 15 ações com maior dividend yield nos últimos 12 meses entre as
 * empresas do cadastro do app, com os proventos da B3. A lista chega pronta do job (a tela mostra, não recalcula nem reordena).
 * O card "Ver mais" continua o ranking, da 16ª posição até onde o arquivo vai.
 */
export function Top15Dividendos({ snapshot }: { snapshot?: SnapshotAcoesDividendos }) {
  const s = snapshot ?? SNAPSHOT_ACOES_DIVIDENDOS
  const [busca, setBusca] = useState('')
  const [verMais, setVerMais] = useState(false)
  if (!s.publicado || s.ranking.length === 0) {
    return (
      <div className="card col" style={{ gap: 8 }} role="status" data-testid="top15-dividendos-validacao">
        <span style={{ fontWeight: 700 }}>Top 15 ações pagadoras de dividendos: em validação</span>
        <span className="muted small justify">
          Esta lista mostra as ações com maior dividend yield nos últimos 12 meses, com os proventos publicados pela B3. Ela aparece aqui assim que passar nas verificações automáticas e for aprovada.
          Enquanto isso, use o simulador.
        </span>
      </div>
    )
  }
  const lista = s.ranking.slice(0, s.tamanhoDaLista)
  const resto = s.ranking.slice(s.tamanhoDaLista)
  const situacoes = buscarSituacaoDividendos(s, busca)
  const motivos = contarExclusoesDividendos(s.exclusoes)

  return (
    <div className="col" style={{ gap: 14 }} data-testid="top15-dividendos">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>As {s.tamanhoDaLista} ações que mais pagaram dividendos</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          {negrito('A medida é o **dividend yield dos últimos 12 meses**: quanto a ação pagou em proventos em dinheiro (dividendos e juros sobre capital próprio, brutos), por ação, em relação ao preço de fechamento. **Yield alto não é promessa**: pode vir de um pagamento extraordinário, de um preço que caiu ou de um lucro que não volta.')}
        </div>
        <div className="tiny muted">
          Preços até {s.dataPrecos ? formatarData(s.dataPrecos) : '—'} · proventos com data com de {formatarData(s.parametros.janelaInicio)} a {s.dataPrecos ? formatarData(s.dataPrecos) : '—'} · metodologia v{s.versaoMetodologia} · {s.avaliadas} ações com proventos de {s.universo} do cadastro
        </div>
      </div>

      <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Ações pagadoras de dividendos">
        {lista.map((r) => (
          <Cartao key={r.ticker} item={r} alertaDy={s.parametros.alertaDyAcimaDe} />
        ))}
      </ol>

      {resto.length > 0 && (
        <div className="card col" style={{ gap: 10 }} data-testid="top15-dividendos-ver-mais">
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="small" style={{ fontWeight: 600 }}>
              {verMais
                ? `Continuação do ranking: posições ${s.tamanhoDaLista + 1} a ${s.tamanhoDaLista + resto.length}`
                : `Mais ${resto.length} ${resto.length === 1 ? 'ação' : 'ações'} no ranking, até a ${s.tamanhoDaLista + resto.length}ª posição`}
            </span>
            <button className="chip" aria-expanded={verMais} onClick={() => setVerMais((v) => !v)}>
              {verMais ? 'Mostrar menos' : 'Ver mais'}
            </button>
          </div>
          {verMais && (
            <>
              <span className="tiny muted justify">Mesma conta e mesma ordem. Toque numa ação para ver cada provento que entrou na soma.</span>
              <ol className="col" style={{ gap: 6, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Continuação do ranking de dividendos">
                {resto.map((r) => (
                  <LinhaCompacta key={r.ticker} item={r} />
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
        <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
          <li>
            <strong>Quem entra.</strong> As empresas do cadastro do app (um código por empresa, a classe mais negociada) que negociaram em média pelo menos {formatarReaisCompacto(s.parametros.liquidezMinimaDiariaReais)} por dia nos últimos {s.parametros.sessoesLiquidez} pregões e pagaram algum provento em dinheiro nos últimos {s.parametros.janelaDias} dias.
          </li>
          <li>
            <strong>Os proventos.</strong> Vêm da B3 (a aba de proventos em dinheiro de cada empresa): <strong>dividendos</strong>, <strong>juros sobre capital próprio</strong> (valor bruto, antes do imposto) e <strong>rendimentos</strong>, na classe da ação do código (ON, PN ou unit). Conta o provento cuja <strong>data com</strong> (último dia para ter direito) cai na janela; o dia do pagamento pode ser depois. Devolução de capital não conta.
          </li>
          <li>
            <strong>A conta.</strong> Dividend yield = soma dos proventos por ação ÷ preço de fechamento mais recente. Quando houve desdobramento ou grupamento depois do provento, o valor antigo é ajustado para a mesma base do preço de hoje.
          </li>
          <li>
            <strong>Pagamentos em parcelas.</strong> Quando a B3 publica duas linhas iguais (mesma data com e mesmo valor), são parcelas do mesmo provento, e cada uma entra na soma.
          </li>
          <li>
            <strong>Ordenação.</strong> Do maior para o menor dividend yield; em empate, ordem alfabética do código.
          </li>
          <li>
            <strong>O que este ranking não é.</strong> Não mede se o pagamento é recorrente, se cabe no caixa ou no lucro da empresa, nem se a ação está barata. Pagamento extraordinário e preço em queda inflam o yield. Para olhar preço contra os números da empresa, veja o Top 15 ações baratas; para o fôlego de caixa, a aba Fundamentalista.
          </li>
        </ol>
      </details>

      <details className="card" open={busca.length > 0 || undefined}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Por que uma ação não aparece, ou em que posição está?</summary>
        <div className="col small" style={{ gap: 8, marginTop: 8 }}>
          <input
            type="search"
            className="input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar ação no ranking de dividendos"
            placeholder="Código ou nome, ex.: PETR4"
          />
          {busca.trim().length >= 2 && situacoes.length === 0 && (
            <span className="muted justify">Nenhuma ação com esse código ou nome no cadastro do ranking. Ela pode estar fora do cadastro do app.</span>
          )}
          {situacoes.map((x) => (
            <div key={x.ticker} className="card-outline justify" data-testid={`situacao-div-${x.ticker}`}>
              <strong>{x.ticker}</strong> <span className="muted">({x.nome ?? '—'})</span>: {x.texto}
            </div>
          ))}
          <div className="muted tiny">{motivos.map((m) => `${m.total} ${m.rotulo.toLowerCase()}`).join(' · ')}</div>
        </div>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
        <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
          <span>
            {introAuditoria(s)} <code>{s.pastaAuditoria ?? 'auditoria/acoes-dividendos/…'}</code> com: os proventos de cada empresa como a B3 publicou (classe, tipo, valor por ação e data com), o preço de fechamento usado,
            os proventos que entraram na soma de cada ação, as ações excluídas com o motivo e o ranking completo.
          </span>
          {notaAuditoriaDiaria(s) && <span>{notaAuditoriaDiaria(s)}</span>}
          <span>Para refazer o cálculo, sem internet, e conferir se o resultado é o mesmo:</span>
          <code style={{ display: 'block', overflowX: 'auto', whiteSpace: 'pre', padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)' }}>
            node scripts/acoes-dividendos-verificar.mjs {s.pastaAuditoria ?? '…'}
          </code>
          <div className="col" style={{ gap: 0 }}>
            <Linha rotulo="Metodologia" valor={`v${s.versaoMetodologia}`} />
            <Linha rotulo="Impressão digital do resultado" valor={s.hashResultado ? `${s.hashResultado.slice(0, 16)}…` : '—'} />
            <Linha rotulo="Impressão digital dos insumos" valor={s.hashInsumos ? `${s.hashInsumos.slice(0, 16)}…` : '—'} />
            <Linha rotulo="Gerado em" valor={s.geradoEm ? formatarData(s.geradoEm) : '—'} />
          </div>
          <span className="tiny muted">A descrição completa está em docs/16-metodologia-acoes-dividendos.md.</span>
        </div>
      </details>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid="top15-dividendos-aviso">
        {s.aviso ?? AVISO_PADRAO}
      </div>
    </div>
  )
}

function Avisos({ item: r, alertaDy }: { item: ItemDividendos; alertaDy?: number }) {
  return (
    <>
      {alertaDy != null && r.dy >= alertaDy && (
        <div className="tiny muted justify" data-testid={`alerta-dy-${r.ticker}`}>
          Yield acima de {formatarPercentual(alertaDy, 0)}: confira se inclui provento extraordinário (veja a data de cada pagamento abaixo) antes de achar que se repete.
        </div>
      )}
      {r.historicoParcial && (
        <div className="tiny muted justify" data-testid={`parcial-${r.ticker}`}>
          A B3 não entregou o histórico completo desta empresa: a soma usa a lista de proventos do cadastro dela, que cobre os últimos meses e pode não alcançar o começo dos 12 meses.
        </div>
      )}
      {r.ajustesAplicados.length > 0 && (
        <div className="tiny muted justify" data-testid={`ajuste-${r.ticker}`}>
          Houve {r.ajustesAplicados.length > 1 ? 'desdobramentos' : 'desdobramento'} em {r.ajustesAplicados.map((a) => `${formatarData(a.data)} (${a.fator > 1 ? `${a.fator}:1` : `1:${Math.round(1 / a.fator)}`})`).join(', ')}: os proventos anteriores foram ajustados para a base do preço de hoje.
        </div>
      )}
    </>
  )
}

function Proventos({ item: r }: { item: ItemDividendos }) {
  return (
    <div className="col" style={{ gap: 0 }} data-testid={`proventos-${r.ticker}`}>
      {r.proventos.map((p, i) => (
        <div key={`${p.dataCom}-${p.tipo}-${i}`} className="tabela-bdr small" style={{ alignItems: 'baseline' }}>
          <span className="muted">
            {formatarData(p.dataCom)}
            <span className="tiny"> · {ROTULO_TIPO_PROVENTO[p.tipo] ?? p.tipo}</span>
          </span>
          <span style={{ fontWeight: 600 }}>{reaisPorAcao(p.valor)}</span>
        </div>
      ))}
      <div className="tabela-bdr small" style={{ alignItems: 'baseline' }}>
        <span className="muted">Total por ação</span>
        <span style={{ fontWeight: 700 }}>{reaisPorAcao(r.proventosPorAcao)}</span>
      </div>
      <div className="tiny muted" style={{ marginTop: 6 }}>
        {reaisPorAcao(r.proventosPorAcao)} ÷ {reais(r.cotacao)} (fechamento de {formatarData(r.dataCotacao)}) = {formatarDy(r.dy)}. Data com = último dia para ter direito ao provento.
      </div>
    </div>
  )
}

function Cartao({ item: r, alertaDy }: { item: ItemDividendos; alertaDy: number }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  return (
    <li className="card col" style={{ gap: 8 }} data-testid={`top15-dividendos-${r.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{r.posicao}. <LogoAtivo ticker={r.ticker} tamanho={24} inline />{r.ticker}</span>
          <span className="tiny muted">{r.nome ?? '—'}{r.setor ? ` · ${r.setor}` : ''}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{reais(r.cotacao)}</span>
          <span className="tiny muted">fech. {formatarData(r.dataCotacao)}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 110px' }}>
          <span className="tiny muted">Dividend yield, 12 meses</span>
          <span style={{ fontWeight: 700 }} data-testid={`dy-${r.ticker}`}>{formatarDy(r.dy)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 110px' }}>
          <span className="tiny muted">Proventos por ação</span>
          <span style={{ fontWeight: 700 }}>{reaisPorAcao(r.proventosPorAcao)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 100px' }}>
          <span className="tiny muted">Pagamentos</span>
          <span style={{ fontWeight: 700 }}>{r.pagamentos}</span>
        </div>
      </div>
      <div className="tiny muted">
        Dividendos {reaisPorAcao(r.dividendos)} · juros sobre capital próprio (bruto) {reaisPorAcao(r.jcp)}
        {r.rendimentos > 0 ? ` · rendimentos ${reaisPorAcao(r.rendimentos)}` : ''} · última data com {formatarData(r.ultimaDataCom)}
      </div>
      <Avisos item={r} alertaDy={alertaDy} />
      <details>
        <summary className="small" style={{ cursor: 'pointer' }}>Cada provento que entrou na soma</summary>
        <div style={{ marginTop: 6 }}>
          <Proventos item={r} />
        </div>
      </details>
    </li>
  )
}

function LinhaCompacta({ item: r }: { item: ItemDividendos }) {
  return (
    <li className="card-outline" data-testid={`top15-dividendos-${r.ticker}`}>
      <details>
        <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
          <div className="row-between" style={{ alignItems: 'center', gap: 10 }}>
            <div className="col" style={{ gap: 0, minWidth: 0 }}>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.posicao}. <LogoAtivo ticker={r.ticker} tamanho={24} inline />{r.ticker}</span>
              <span className="tiny muted">{r.nome ?? '—'}{r.setor ? ` · ${r.setor}` : ''}</span>
            </div>
            <div className="col" style={{ gap: 0, alignItems: 'flex-end', flexShrink: 0 }}>
              <span style={{ fontWeight: 700 }} data-testid={`dy-${r.ticker}`}>{formatarDy(r.dy)}</span>
              <span className="tiny muted">{reaisPorAcao(r.proventosPorAcao)} por ação · {reais(r.cotacao)}</span>
            </div>
          </div>
        </summary>
        <div className="col" style={{ gap: 6, marginTop: 8 }}>
          <Avisos item={r} />
          <Proventos item={r} />
        </div>
      </details>
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
