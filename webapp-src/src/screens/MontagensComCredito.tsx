import { useMemo, useState } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import { diasUteis, limitarAosProximosMeses, tipoVencimento } from '../domain/opcoes'
import type { EscolhaDeSeries, SnapshotOpcoes } from '../domain/opcoes'
import { MARGEM_MINIMA, calcularTopMontagens, vencimentoPadraoMontagem, vencimentosDeMontagem } from '../domain/montagensComCredito'
import type { DirecaoMontagem, LinhaMontagem } from '../domain/montagensComCredito'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'

const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/**
 * Aba de montagens com crédito: como o Top 15 prêmios, mas para a reversão de risco. Na alta, vende uma put e compra uma call; na
 * baixa, vende uma call e compra uma put. Só entram pares em que você recebe para montar e o ativo tem margem para andar nos dois
 * lados. Do maior retorno para o menor, um por ativo.
 */
export function MontagensComCredito({ snapshot, onSimular }: { snapshot: SnapshotOpcoes; onSimular: (e: EscolhaDeSeries) => void }) {
  const hoje = snapshot.dataPregao ?? new Date().toISOString().slice(0, 10)
  const ativos = useMemo(() => limitarAosProximosMeses(snapshot).ativos, [snapshot])
  const vencimentos = useMemo(() => vencimentosDeMontagem(ativos, hoje), [ativos, hoje])
  const [direcao, setDirecao] = useState<DirecaoMontagem>('alta')
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const vencimento = escolhido && vencimentos.includes(escolhido) ? escolhido : vencimentoPadraoMontagem(vencimentos, hoje)
  const r = Math.log(1 + jurosPadrao() / 100)
  const linhas = useMemo(() => (vencimento ? calcularTopMontagens(ativos, direcao, vencimento, hoje, r) : []), [ativos, direcao, vencimento, hoje, r])

  const simular = (l: LinhaMontagem) =>
    onSimular({
      ativo: l.ativo,
      series: [l.compra, l.venda],
      detalhes: { [l.compra.codigo]: { lado: 'compra', fator: 1 }, [l.venda.codigo]: { lado: 'venda', fator: 1 } },
    })

  return (
    <>
      <div className="col" style={{ gap: 4 }} data-testid="montagens-intro">
        <span style={{ fontWeight: 700, fontSize: 17 }}>Montagens em que você recebe</span>
        <span className="muted small justify">
          Risk Reversal (reversão de risco): você vende uma opção e compra outra do lado oposto, no mesmo vencimento, e ainda recebe a diferença. As duas ficam fora do dinheiro, então o ativo tem
          pelo menos {MARGEM_MINIMA}% de espaço para subir ou cair antes de qualquer uma delas valer algo. No <strong>Bullish Risk Reversal</strong> (alta), vende put e compra call; no <strong>Bearish Risk Reversal</strong> (baixa),
          vende call e compra put. O ranking é do maior retorno (crédito sobre o strike vendido) para o menor, um por ativo.
        </span>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Tendência">
        <button className={`chip ${direcao === 'alta' ? 'selected' : ''}`} aria-pressed={direcao === 'alta'} onClick={() => setDirecao('alta')}>Bullish Risk Reversal (alta): vende put, compra call</button>
        <button className={`chip ${direcao === 'baixa' ? 'selected' : ''}`} aria-pressed={direcao === 'baixa'} onClick={() => setDirecao('baixa')}>Bearish Risk Reversal (baixa): vende call, compra put</button>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Vencimento">
        {vencimentos.filter((v) => tipoVencimento(v) === 'mensal').map((v) => (
          <button key={v} className={`chip ${vencimento === v ? 'selected' : ''}`} aria-pressed={vencimento === v} onClick={() => setEscolhido(v)}>
            {formatarData(v)} ({diasUteis(v, hoje)} d.u.)
          </button>
        ))}
      </div>

      {linhas.length === 0 ? (
        <div className="card-outline small justify" role="status" data-testid="montagens-vazio">
          <strong>Nenhuma montagem encontrada.</strong>{' '}
          <span className="muted">Neste vencimento, nenhum ativo tem puts e calls líquidas com {MARGEM_MINIMA}% de margem para os dois lados e crédito para montar. Tente outro vencimento.</span>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }} data-testid="montagens-lista">
          {linhas.map((l, i) => (
            <div key={l.ativo.ticker} className="card col" style={{ gap: 8 }} data-testid={`montagem-${l.ativo.ticker}`}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>{i + 1}. {l.ativo.ticker} <span className="muted small">a {reais(l.ativo.cotacao)}</span></span>
                <span style={{ fontWeight: 700, color: 'var(--grafico-con)' }}>{num(l.retorno)}% <span className="tiny muted">(≈ {num(l.retornoMes)}% ao mês)</span></span>
              </div>
              <div className="col small" style={{ gap: 2 }}>
                <span>Vende <strong>{l.venda.codigo}</strong>, strike {num(l.venda.strike)} ({l.venda.tipo === 'put' ? '−' : '+'}{num(l.venda.tipo === 'put' ? l.margemQueda : l.margemAlta, 1)}%), a {num(l.venda.ultimo)}</span>
                <span>Compra <strong>{l.compra.codigo}</strong>, strike {num(l.compra.strike)} ({l.compra.tipo === 'put' ? '−' : '+'}{num(l.compra.tipo === 'put' ? l.margemQueda : l.margemAlta, 1)}%), a {num(l.compra.ultimo)}</span>
              </div>
              <div className="row tiny muted" style={{ gap: 12, flexWrap: 'wrap' }}>
                <span>Você recebe <strong>{reais(l.creditoLote)}</strong> por lote de {l.ativo.lote}</span>
                <span>Espaço: cai até −{num(l.margemQueda, 1)}% e sobe até +{num(l.margemAlta, 1)}%</span>
                {l.chanceVenda !== null && <span>Chance de a vendida ser exercida: {num(l.chanceVenda, 0)}%</span>}
                <span>Negócios {l.compra.negocios}/{l.venda.negocios}</span>
              </div>
              <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => simular(l)}>Simular esta montagem</button>
            </div>
          ))}
        </div>
      )}

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Receber para montar não é risco zero.</strong> A ponta vendida exige margem e, se o ativo passar do strike dela, você assume a obrigação (na put, comprar o ativo
        pelo strike; na call sem ter o ativo, a perda não tem limite). Os preços são os do último negócio de cada série e podem estar longe dos preços reais de compra e venda. Corretagem e imposto
        ficam de fora. Só entram séries com pelo menos 10 negócios no último pregão.
      </div>
    </>
  )
}
