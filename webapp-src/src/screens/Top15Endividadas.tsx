import { Fragment, useState } from 'react'
import { SNAPSHOT_ACOES_ENDIVIDADAS } from '../data/snapshotAcoesEndividadas'
import { buscarSituacao, contarExclusoesEndividadas } from '../domain/acoesEndividadas'
import type { ContaCalculo, ItemEndividada, SnapshotAcoesEndividadas } from '../domain/acoesEndividadas'
import { formatarMultiplo, formatarReaisCompacto } from '../domain/acoesBaratas'
import { introAuditoria, notaAuditoriaDiaria } from '../domain/auditoriaDiaria'
import { formatarData } from '../domain/rendaFii'

const AVISO_PADRAO =
  'Não é recomendação de investimento. Esta lista ordena as empresas pela razão entre a dívida líquida e o EBITDA dos últimos 12 meses, com dados das demonstrações publicadas na CVM. Dívida alta não quer dizer que a empresa está em risco, nem que a ação está barata ou cara. Converse com um profissional certificado antes de investir.'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function negrito(texto: string) {
  return texto.split('**').map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : <Fragment key={i}>{parte}</Fragment>))
}

/** 9,7035 → "9,7x"; razão grande demais ganha uma casa a menos para caber no cartão. */
export function formatarRazao(v: number | null | undefined) {
  return v == null || !Number.isFinite(v) ? '—' : formatarMultiplo(v, v >= 100 ? 0 : 1)
}

/**
 * Caixa "Top 15 empresas mais endividadas" (D94): as 15 empresas com maior dívida líquida ÷ EBITDA, no universo das ações
 * baratas, sem os filtros de lucro e de volatilidade. A lista chega pronta do job (a tela mostra, não recalcula nem reordena).
 */
export function Top15Endividadas({ snapshot }: { snapshot?: SnapshotAcoesEndividadas }) {
  const s = snapshot ?? SNAPSHOT_ACOES_ENDIVIDADAS
  const [busca, setBusca] = useState('')
  if (!s.publicado || s.ranking.length === 0) {
    return (
      <div className="card col" style={{ gap: 8 }} role="status" data-testid="top15-endividadas-validacao">
        <span style={{ fontWeight: 700 }}>Top 15 empresas mais endividadas: em validação</span>
        <span className="muted small justify">
          Esta lista mostra as empresas com maior dívida líquida em relação ao EBITDA (a geração de caixa operacional de 12 meses), com dados das demonstrações da CVM. Ela aparece aqui assim que passar nas verificações automáticas e for aprovada.
          Enquanto isso, use o simulador.
        </span>
      </div>
    )
  }
  const lista = s.ranking.slice(0, s.tamanhoDaLista)
  const situacoes = buscarSituacao(s, busca)
  const motivos = contarExclusoesEndividadas(s.exclusoes)

  return (
    <div className="col" style={{ gap: 14 }} data-testid="top15-endividadas">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>As {s.tamanhoDaLista} empresas mais endividadas</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          {negrito('A medida é a **dívida líquida ÷ EBITDA**: quantos anos de geração de caixa operacional, antes de impostos e juros, seriam necessários para pagar a dívida líquida. **Dívida alta não quer dizer empresa em risco**: setores de investimento pesado (energia, saneamento, concessões) convivem com dívida longa e barata.')}
        </div>
        <div className="tiny muted">
          Preços até {s.dataPrecos ? formatarData(s.dataPrecos) : '—'} · balanços publicados até {s.dataCorte ? formatarData(s.dataCorte) : '—'} · metodologia v{s.versaoMetodologia} · {s.avaliadas} empresas avaliadas de {s.universo} do cadastro
        </div>
      </div>

      <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Empresas mais endividadas">
        {lista.map((r) => (
          <Cartao key={r.ticker} item={r} />
        ))}
      </ol>

      {s.semEbitdaPositivo.length > 0 && (
        <div className="col" style={{ gap: 8 }} data-testid="top15-endividadas-sem-ebitda">
          <h3 style={{ fontSize: 15 }}>Dívida líquida com EBITDA zero ou negativo</h3>
          <div className="muted small justify" style={{ lineHeight: 1.5 }}>
            Estas empresas têm dívida líquida, mas o EBITDA de 12 meses é zero ou negativo: a razão não existe (não há "anos de caixa" para pagar a dívida) e elas ficam fora da ordem acima. Estão ordenadas pela dívida líquida.
          </div>
          <ul className="col" style={{ gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
            {s.semEbitdaPositivo.map((r) => (
              <li key={r.ticker} className="card-outline small col" style={{ gap: 2 }} data-testid={`sem-ebitda-${r.ticker}`}>
                <span><strong style={{ color: 'var(--accent)' }}>{r.ticker}</strong> <span className="muted">({r.nome ?? '—'})</span></span>
                <span>Dívida líquida {formatarReaisCompacto(r.dividaLiquida)} · EBITDA {formatarReaisCompacto(r.ebitda)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
        <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
          <li>
            <strong>Quem entra.</strong> As empresas do cadastro do app (um código por empresa). Ficam de fora os setores {s.parametros.setoresExcluidos.join(', ')}, porque a dívida é a matéria-prima do negócio deles, e quem negocia menos de {formatarReaisCompacto(s.parametros.liquidezMinimaDiariaReais)} por dia (média de {s.parametros.sessoesLiquidez} pregões, somando as classes de ação da empresa).
          </li>
          <li>
            <strong>Os números.</strong> Vêm da última demonstração da CVM (DFP ou ITR), com no máximo {s.parametros.idadeMaximaDemonstracaoDias} dias, na mesma leitura da triagem de ações baratas: <strong>dívida bruta</strong> = empréstimos e financiamentos de curto e longo prazo (contas 2.01.04 e 2.02.01); <strong>caixa</strong> = caixa e aplicações financeiras (1.01.01 e 1.01.02); <strong>dívida líquida</strong> = dívida bruta − caixa; <strong>EBITDA</strong> de 12 meses = EBIT ajustado + depreciação e amortização.
          </li>
          <li>
            <strong>Ordenação.</strong> Da maior para a menor dívida líquida ÷ EBITDA; em empate, ordem alfabética do código. Empresa com caixa maior que a dívida (dívida líquida zero ou negativa) não entra.
          </li>
          <li>
            <strong>Sem filtro de lucro nem de volatilidade.</strong> Ao contrário das ações baratas, aqui empresas com prejuízo ou muito voláteis ficam na lista: são justamente as que importam para quem olha endividamento. As verificações de integridade dos dados (balanço e DRE fecham, quantidade de ações plausível) continuam valendo.
          </li>
          <li>
            <strong>EBITDA zero ou negativo.</strong> Com dívida líquida e sem EBITDA positivo a razão não existe; a empresa aparece na lista à parte, fora da ordem.
          </li>
          <li>
            <strong>O que este ranking não é.</strong> Não mede prazo, custo, moeda nem garantias da dívida, nem a saúde do negócio. O EBITDA de 12 meses pode estar deprimido ou inflado por um evento pontual, e dívida de arrendamentos e fornecedores fica fora da conta. Para olhar preço contra os números da empresa, veja o Top 15 ações baratas.
          </li>
        </ol>
      </details>

      <details className="card" open={busca.length > 0 || undefined}>
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Por que uma empresa ficou de fora?</summary>
        <div className="col small" style={{ gap: 8, marginTop: 8 }}>
          <input
            type="search"
            className="input"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar empresa fora do ranking"
            placeholder="Código ou nome, ex.: AMER3"
          />
          {busca.trim().length >= 2 && situacoes.length === 0 && (
            <span className="muted justify">Nenhuma empresa fora do Top {s.tamanhoDaLista} com esse código ou nome. Se ela está no app, ela está entre as {s.tamanhoDaLista} acima.</span>
          )}
          {situacoes.map((x) => (
            <div key={`${x.tipo}-${x.ticker}`} className="card-outline justify" data-testid={`situacao-${x.ticker}`}>
              <strong>{x.ticker}</strong> <span className="muted">({x.nome ?? '—'})</span>: {x.texto}
            </div>
          ))}
          <div className="muted tiny">
            {motivos.map((m) => `${m.total} ${m.rotulo.toLowerCase()}`).join(' · ')}
          </div>
        </div>
      </details>

      <details className="card">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
        <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
          <span>
            {introAuditoria(s)} <code>{s.pastaAuditoria ?? 'auditoria/acoes-endividadas/…'}</code> com: de onde vieram os insumos (a auditoria das ações baratas), cada linha das demonstrações usada (conta, versão, período e link do documento), a memória de cálculo de cada empresa,
            as empresas excluídas com o motivo e o ranking completo.
          </span>
          {notaAuditoriaDiaria(s) && <span>{notaAuditoriaDiaria(s)}</span>}
          <span>Para refazer o cálculo, sem internet, e conferir se o resultado é o mesmo:</span>
          <code style={{ display: 'block', overflowX: 'auto', whiteSpace: 'pre', padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)' }}>
            node scripts/acoes-endividadas-verificar.mjs {s.pastaAuditoria ?? '…'}
          </code>
          <div className="col" style={{ gap: 0 }}>
            <Linha rotulo="Metodologia" valor={`v${s.versaoMetodologia}`} />
            <Linha rotulo="Impressão digital do resultado" valor={s.hashResultado ? `${s.hashResultado.slice(0, 16)}…` : '—'} />
            <Linha rotulo="Impressão digital dos insumos" valor={s.hashInsumos ? `${s.hashInsumos.slice(0, 16)}…` : '—'} />
            <Linha rotulo="Gerado em" valor={s.geradoEm ? formatarData(s.geradoEm) : '—'} />
          </div>
          <span className="tiny muted">A descrição completa está em docs/12-metodologia-acoes-endividadas.md.</span>
        </div>
      </details>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid="top15-endividadas-aviso">
        {s.aviso ?? AVISO_PADRAO}
      </div>
    </div>
  )
}

function Cartao({ item: r }: { item: ItemEndividada }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  return (
    <li className="card col" style={{ gap: 8 }} data-testid={`top15-endividadas-${r.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{r.posicao}. {r.ticker}</span>
          <span className="tiny muted">{r.nome ?? '—'}{r.setor ? ` · ${r.setor}` : ''}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.cotacao == null ? '—' : reais(r.cotacao)}</span>
          <span className="tiny muted">fech. {r.dataCotacao ? formatarData(r.dataCotacao) : '—'}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 110px' }}>
          <span className="tiny muted">Dívida líquida ÷ EBITDA</span>
          <span style={{ fontWeight: 700 }} data-testid={`razao-${r.ticker}`}>{formatarRazao(r.dlEbitda)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 100px' }}>
          <span className="tiny muted">Dívida líquida</span>
          <span style={{ fontWeight: 700 }}>{formatarReaisCompacto(r.dividaLiquida)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 100px' }}>
          <span className="tiny muted">EBITDA, 12 meses</span>
          <span style={{ fontWeight: 700 }}>{formatarReaisCompacto(r.ebitda)}</span>
        </div>
      </div>
      <div className="tiny muted">
        Dívida bruta {formatarReaisCompacto(r.dividaBruta)} · caixa {formatarReaisCompacto(r.caixa)} · cobertura de juros{' '}
        {r.semDespesaFinanceira ? 'sem despesa financeira' : formatarMultiplo(r.coberturaJuros)} · valor de mercado {formatarReaisCompacto(r.mktcap)}
      </div>
      <details>
        <summary className="small" style={{ cursor: 'pointer' }}>Como chegamos nesse número</summary>
        <div className="col" style={{ gap: 0, marginTop: 6 }} data-testid={`calculo-${r.ticker}`}>
          <Conta rotulo="Empréstimos e financiamentos, curto prazo" conta={r.calculo.dividaCurta} />
          <Conta rotulo="Empréstimos e financiamentos, longo prazo" conta={r.calculo.dividaLonga} />
          <LinhaCalculo rotulo="Dívida bruta" valor={formatarReaisCompacto(r.dividaBruta)} nota="curto prazo + longo prazo" />
          <Conta rotulo="Caixa e equivalentes de caixa" conta={r.calculo.caixaEEquivalentes} />
          <Conta rotulo="Aplicações financeiras" conta={r.calculo.aplicacoesFinanceiras} />
          <LinhaCalculo rotulo="Dívida líquida" valor={formatarReaisCompacto(r.dividaLiquida)} nota={r.calculo.dividaLiquida.formula} />
          <Conta rotulo="EBIT (resultado antes do financeiro e dos tributos), 12 meses" conta={r.calculo.ebit} />
          <LinhaCalculo rotulo="EBIT ajustado" valor={formatarReaisCompacto(r.ebitAjustado)} nota={r.calculo.ebitAjustado.formula} />
          <Conta rotulo="Depreciação e amortização (DVA), 12 meses" conta={r.calculo.depreciacaoEAmortizacao} />
          <LinhaCalculo rotulo="EBITDA, 12 meses" valor={formatarReaisCompacto(r.ebitda)} nota={r.calculo.ebitda.formula} />
          <LinhaCalculo rotulo="Dívida líquida ÷ EBITDA" valor={formatarRazao(r.dlEbitda)} nota={`${formatarReaisCompacto(r.dividaLiquida)} ÷ ${formatarReaisCompacto(r.ebitda)}`} />
          <div className="tiny muted" style={{ marginTop: 6 }}>
            Demonstração usada: {r.demonstracao.doc} de {formatarData(r.demonstracao.dtRefer)} ({r.demonstracao.consolidacao})
            {r.demonstracao.dtReceb ? `, recebida pela CVM em ${formatarData(r.demonstracao.dtReceb)}` : ''}.
          </div>
        </div>
      </details>
    </li>
  )
}

function Conta({ rotulo, conta }: { rotulo: string; conta: ContaCalculo | null }) {
  if (!conta) return null
  return <LinhaCalculo rotulo={rotulo} valor={formatarReaisCompacto(conta.valor)} nota={`conta CVM ${conta.cd}`} />
}

function LinhaCalculo({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="tabela-bdr small" style={{ alignItems: 'baseline' }}>
      <span className="muted">
        {rotulo}
        {nota && <span className="tiny"> · {nota}</span>}
      </span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
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
