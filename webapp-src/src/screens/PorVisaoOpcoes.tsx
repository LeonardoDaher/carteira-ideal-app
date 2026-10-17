import { useMemo, useState } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import {
  ESTRUTURAS, ESTRUTURAS_DA_VISAO, NEGOCIOS_MINIMOS_IDEIAS, descreverPernas, escolhaDaCandidata, melhoresCandidatas,
} from '../domain/estrategiasPorVisao'
import type { Candidata, CriterioIdeia } from '../domain/estrategiasPorVisao'
import { diasUteis, tipoVencimento, vencimentosDe } from '../domain/opcoes'
import type { AtivoComOpcoes, EscolhaDeSeries, SnapshotOpcoes } from '../domain/opcoes'
import { ROTULO_VISAO, lerTendencia, volImplicitaPertoDoDinheiro } from '../domain/tendencia'
import type { Visao } from '../domain/tendencia'
import { reais } from '../domain/mercadoOficial'
import { formatarData } from '../domain/rendaFii'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'

const VISOES: Visao[] = ['alta', 'baixa', 'lateral', 'oscilacao']
const CRITERIOS: { id: CriterioIdeia; titulo: string }[] = [
  { id: 'chance', titulo: 'Maior chance de lucro' },
  { id: 'retorno', titulo: 'Maior retorno no cenário' },
  { id: 'risco', titulo: 'Menor risco' },
]
const num = (v: number, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const dinheiro = (v: number) => (v < 0 ? `−${reais(-v)}` : reais(v))

/**
 * Aba "Por visão de mercado": a pessoa escolhe o ativo, o app lê a tendência (do passado) e sugere uma visão; para a visão
 * escolhida, monta as estruturas que combinam com ela com as séries reais do último pregão e mostra as candidatas de cada
 * uma, com custo, ganho, perda, equilíbrio e chance de lucro. Descritivo: não é recomendação de operação.
 */
export function PorVisaoOpcoes({
  snapshot, ativo, onEscolher, onSimular,
}: {
  snapshot: SnapshotOpcoes
  ativo: AtivoComOpcoes | null
  onEscolher: (ticker: string) => void
  onSimular: (e: EscolhaDeSeries) => void
}) {
  if (!ativo) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Os dados de opções ainda não foram carregados.</span>
        <span className="muted small justify">As séries são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.</span>
      </div>
    )
  }
  // `key`: ao trocar de ativo, a visão volta a ser a que a tendência dele sugere.
  return (
    <>
      <EscolhaDeAtivo snapshot={snapshot} ativo={ativo} onEscolher={onEscolher} />
      <PainelPorVisao key={ativo.ticker} snapshot={snapshot} ativo={ativo} onSimular={onSimular} />
    </>
  )
}

function PainelPorVisao({ snapshot, ativo, onSimular }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes; onSimular: (e: EscolhaDeSeries) => void }) {
  const hoje = snapshot.dataPregao ?? new Date().toISOString().slice(0, 10)
  const juros = jurosPadrao()
  const leitura = useMemo(() => (ativo.tendencia ? lerTendencia(ativo.tendencia) : null), [ativo])
  const [visao, setVisao] = useState<Visao>(leitura?.leitura ?? 'lateral')
  const [criterio, setCriterio] = useState<CriterioIdeia>('chance')

  const vencimentos = useMemo(() => vencimentosDe(ativo.series).filter((v) => diasUteis(v, hoje) >= 3), [ativo, hoje])
  const padrao = vencimentos.find((v) => tipoVencimento(v) === 'mensal' && diasUteis(v, hoje) >= 10) ?? vencimentos[0] ?? ''
  const [escolhido, setEscolhido] = useState(padrao)
  const vencimento = vencimentos.includes(escolhido) ? escolhido : padrao

  const volAtm = useMemo(() => (vencimento ? volImplicitaPertoDoDinheiro(ativo, vencimento, hoje, juros) : null), [ativo, vencimento, hoje, juros])
  const grupos = useMemo(
    () =>
      vencimento
        ? ESTRUTURAS_DA_VISAO[visao].map((id) => ({
            info: ESTRUTURAS[id],
            candidatas: melhoresCandidatas(ativo, id, visao, { vencimento, hoje, jurosAnual: juros }, criterio, 3),
          }))
        : [],
    [ativo, visao, vencimento, hoje, juros, criterio],
  )
  const movimento = grupos.flatMap((g) => g.candidatas)[0]?.movimentoDoCenario

  const t = ativo.tendencia
  const comparacao =
    t && volAtm !== null
      ? volAtm > t.volRealizada21 * 1.15
        ? 'As opções estão caras em relação ao que o ativo vem oscilando (favorece mais quem vende prêmio).'
        : volAtm < t.volRealizada21 * 0.85
          ? 'As opções estão baratas em relação ao que o ativo vem oscilando (favorece mais quem compra).'
          : 'As opções estão em linha com o que o ativo vem oscilando.'
      : null

  return (
    <>
      <div className="card-outline small justify" style={{ lineHeight: 1.5 }}>
        <strong>Como ler.</strong>{' '}
        <span className="muted">
          As combinações abaixo são calculadas automaticamente com as séries que negociaram no último pregão. No modelo de
          preços, nenhuma estrutura tem vantagem esperada: o que muda de uma para outra é o perfil (quanto se arrisca, quanto se
          pode ganhar e com que chance). Por isso o app não elege uma “melhor”: ordena pelo critério que você escolher e mostra os
          três números. A leitura de tendência vem do passado e não prevê nada.
        </span>
      </div>

      <div className="card col" style={{ gap: 8 }} data-testid="leitura-ativo">
        <span style={{ fontWeight: 700 }}>
          {leitura ? `Leitura de ${ativo.ticker}: tendência de ${ROTULO_VISAO[leitura.leitura].toLowerCase()}` : `Leitura de ${ativo.ticker}`}
        </span>
        {leitura ? (
          <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
            {leitura.motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <span className="small muted justify">Sem histórico suficiente para ler a tendência deste ativo. Escolha a visão abaixo por conta própria.</span>
        )}
        {t && (
          <span className="small" data-testid="vol-ativo">
            Volatilidade realizada (21 pregões): <strong>{num(t.volRealizada21)}%</strong>
            {volAtm !== null ? <> · implícita das opções perto do preço: <strong>{num(volAtm)}%</strong></> : null}
            {comparacao && <span className="muted"> {comparacao}</span>}
          </span>
        )}
      </div>

      <div className="card col" style={{ gap: 12 }} role="group" aria-label="Visão, vencimento e critério">
        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>Sua visão para o ativo</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Visão de mercado">
            {VISOES.map((v) => (
              <button key={v} className={`chip ${visao === v ? 'selected' : ''}`} aria-pressed={visao === v} onClick={() => setVisao(v)}>
                {ROTULO_VISAO[v]}
              </button>
            ))}
          </div>
          {leitura && leitura.leitura !== visao && (
            <span className="tiny muted">A tendência lida é de {ROTULO_VISAO[leitura.leitura].toLowerCase()}, mas você escolheu {ROTULO_VISAO[visao].toLowerCase()}.</span>
          )}
        </div>

        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>Vencimento</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Vencimento das estruturas">
            {vencimentos.map((v) => (
              <button key={v} className={`chip ${vencimento === v ? 'selected' : ''}`} aria-pressed={vencimento === v} onClick={() => setEscolhido(v)}>
                {formatarData(v)} ({diasUteis(v, hoje)} d.u., {tipoVencimento(v)})
              </button>
            ))}
          </div>
        </div>

        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>Ordenar as candidatas por</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Critério de ordem">
            {CRITERIOS.map((c) => (
              <button key={c.id} className={`chip ${criterio === c.id ? 'selected' : ''}`} aria-pressed={criterio === c.id} onClick={() => setCriterio(c.id)}>
                {c.titulo}
              </button>
            ))}
          </div>
          <span className="tiny muted">
            Maior chance de lucro costuma trazer ganho pequeno; maior retorno no cenário costuma trazer chance menor. Olhe os dois.
          </span>
        </div>
      </div>

      {!vencimento && (
        <div className="card-outline small justify" role="status">
          <span className="muted">Este ativo não tem vencimento com pelo menos 3 dias úteis e séries negociadas.</span>
        </div>
      )}

      {grupos.map(({ info, candidatas }) => (
        <div key={info.id} className="card col" style={{ gap: 8 }} data-testid={`estrutura-${info.id}`}>
          <div className="col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{info.titulo}</span>
            <span className="tiny muted">{info.perfil.join(' · ')}</span>
            <span className="small muted justify">{info.descricao}</span>
          </div>
          {candidatas.length === 0 ? (
            <span className="small muted" role="status">
              Nenhuma combinação com séries negociadas no último pregão (pelo menos {NEGOCIOS_MINIMOS_IDEIAS} negócios cada) neste vencimento.
            </span>
          ) : (
            <div style={{ overflowX: 'auto' }} className="card-outline">
              <table className="tabela-opcoes small">
                <thead>
                  <tr>
                    <th scope="col">Séries</th>
                    <th scope="col">Ao montar</th>
                    <th scope="col">Ganho máx.</th>
                    <th scope="col">Perda máx.</th>
                    <th scope="col" title="Preços do ativo em que o resultado no vencimento é zero">Equilíbrio</th>
                    <th scope="col" title="Chance de terminar no lucro, pelo modelo">Chance de lucro</th>
                    <th scope="col" title="Resultado no cenário da visão dividido pela perda máxima">Retorno no cenário</th>
                    <th scope="col">Neg. mín.</th>
                    <th scope="col"><span className="sr-only">Simular</span></th>
                  </tr>
                </thead>
                <tbody>
                  {candidatas.map((c, i) => (
                    <LinhaCandidata key={`${info.id}-${i}`} c={c} onSimular={() => onSimular(escolhaDaCandidata(ativo, c))} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {grupos.length > 0 && (
        <details className="card-outline small justify" style={{ lineHeight: 1.5 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Como as candidatas são montadas e medidas</summary>
          <div className="col" style={{ gap: 6, marginTop: 8 }}>
            <span className="muted">
              <strong>Séries.</strong> Só as do vencimento escolhido que negociaram no último pregão, com pelo menos {NEGOCIOS_MINIMOS_IDEIAS} negócios
              cada, e strikes perto do preço (cada estrutura tem a sua janela). O preço de cada perna é o do último negócio, e não o de
              compra e venda: o resultado real pode ser pior. Combinações incoerentes (débito acima da largura da trava, por
              exemplo) saem. Estruturas de risco ilimitado não entram.
            </span>
            <span className="muted">
              <strong>Chance de lucro.</strong> Modelo de Black-Scholes, neutro ao risco, com a volatilidade implícita média das séries
              usadas: soma a probabilidade dos preços finais em que o resultado é positivo. Compara candidatas entre si; não prevê o que vai acontecer.
            </span>
            <span className="muted">
              <strong>Retorno no cenário.</strong>{' '}
              {visao === 'lateral'
                ? 'Resultado se o ativo terminar parado no preço de hoje, dividido pela perda máxima.'
                : visao === 'oscilacao'
                  ? `Resultado se o ativo se mover um desvio-padrão do prazo${movimento ? ` (cerca de ${num(movimento)}%)` : ''} para o lado mais favorável, dividido pela perda máxima.`
                  : `Resultado se o ativo andar um desvio-padrão do prazo${movimento ? ` (cerca de ${num(movimento)}%)` : ''} ${visao === 'alta' ? 'para cima' : 'para baixo'}, dividido pela perda máxima.`}
            </span>
            <span className="muted">
              <strong>Sem “melhor”.</strong> Estruturas de débito precisam do movimento; as de crédito ganham com o tempo, mas têm teto. Ganhar
              com frequência e ganhar muito quando acerta são perfis diferentes. Corretagem, emolumentos, IR e margem de garantia ficam de
              fora, e dividendos também.
            </span>
          </div>
        </details>
      )}
    </>
  )
}

function LinhaCandidata({ c, onSimular }: { c: Candidata; onSimular: () => void }) {
  return (
    <tr data-testid="candidata">
      <td style={{ whiteSpace: 'normal', minWidth: 190 }}>{descreverPernas(c)}</td>
      <td className="num">{c.credito >= 0 ? 'Crédito' : 'Débito'} {reais(Math.abs(c.credito))}</td>
      <td className="num">{c.ganhoMaximo === null ? 'Sem teto' : dinheiro(c.ganhoMaximo)}</td>
      <td className="num">{dinheiro(c.perdaMaxima)}</td>
      <td className="num">{c.equilibrios.map((e) => num(e, 2)).join(' e ') || '—'}</td>
      <td className="num" style={{ fontWeight: 700 }}>{num(c.chanceDeLucro)}%</td>
      <td className="num">{num(c.retornoNoCenario, 0)}%</td>
      <td className="num">{c.negociosMinimos.toLocaleString('pt-BR')}</td>
      <td>
        <button className="chip" onClick={onSimular} aria-label={`Simular ${descreverPernas(c)}`}>Simular</button>
      </td>
    </tr>
  )
}
