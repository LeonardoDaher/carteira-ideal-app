import { useMemo, useState } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import {
  DIAS_UTEIS_ANO, analisar, analisarEstimado, curva, diasAtePrimeiroVencimento, temVariosVencimentos, custoDeMontagem, faixaDoGrafico, gregasDaPosicao, resultadoAntesDoVencimento,
  resultadoNoVencimento, volatilidadeImplicita,
} from '../domain/simulaOpcoes'
import type { Posicao } from '../domain/simulaOpcoes'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { GraficoPayoff } from '../ui/GraficoPayoff'
import { MarcaDaLinha } from '../ui/GraficoPorStrike'

const dinheiro = (v: number) => (v < 0 ? `−${reais(-v)}` : reais(v))

/**
 * Resultado de uma posição já montada: ganho e perda máximos, equilíbrio, gráfico no vencimento e antes dele, passagem do
 * tempo e gregas. Compartilhado pelas Séries da B3 (compra e venda de uma call ou put) e pela aba de estratégias montadas.
 */
export function PainelDaPosicao({ posicao: posicaoEntrada, precoAtivo, dias: diasEntrada, titulo, aviso, nota, sufixo = '' }: {
  posicao: Posicao
  precoAtivo: number
  /** Dias úteis até o vencimento. */
  dias: number
  titulo: string
  aviso?: string | null
  /** Texto extra sobre o custo (ex.: ações necessárias na venda coberta). */
  nota?: string
  /** Para mostrar dois painéis na mesma tela sem repetir ids e identificadores de teste. */
  sufixo?: string
}) {
  const [juros, setJuros] = useState(jurosPadrao)
  const [vol, setVol] = useState(35)
  const [diasPassados, setDiasPassados] = useState(0)

  const r = Math.log(1 + juros / 100)
  // Pernas com vencimentos diferentes: o resultado só é exato até o primeiro vencimento. Cada perna leva a volatilidade
  // implícita do próprio preço (assim, hoje, a posição vale o que custou) e o gráfico "no vencimento" passa a ser uma
  // estimativa na data do primeiro.
  const multi = temVariosVencimentos(posicaoEntrada)
  const dias = multi ? Math.max(diasAtePrimeiroVencimento(posicaoEntrada, diasEntrada), 1) : diasEntrada
  const posicao = useMemo<Posicao>(() => {
    if (!multi) return posicaoEntrada
    return {
      ...posicaoEntrada,
      pernas: posicaoEntrada.pernas.map((x) => {
        const impl = x.dias && x.dias > 0 ? volatilidadeImplicita({ tipo: x.tipo, s: precoAtivo, strike: x.strike, t: x.dias / DIAS_UTEIS_ANO, r }, x.premio) : null
        return { ...x, sigma: x.sigma ?? impl ?? vol / 100 }
      }),
    }
  }, [multi, posicaoEntrada, precoAtivo, r, vol])
  const mercado = useMemo(() => ({ dias: Math.max(dias, 0), r, sigma: vol / 100 }), [dias, r, vol])
  const passados = Math.min(diasPassados, mercado.dias)

  const volImplicita = useMemo(() => {
    const perna = posicao.pernas[0]
    const diasPerna = perna?.dias ?? dias
    if (!perna || diasPerna <= 0) return null
    const v = volatilidadeImplicita({ tipo: perna.tipo, s: precoAtivo, strike: perna.strike, t: diasPerna / DIAS_UTEIS_ANO, r }, perna.premio)
    return v ? Math.round(v * 1000) / 10 : null
  }, [posicao, dias, precoAtivo, r])

  const dados = useMemo(() => {
    const faixa = faixaDoGrafico(posicao, precoAtivo)
    const analise = multi ? analisarEstimado(posicao, precoAtivo, mercado) : analisar(posicao)
    const noVenc = multi
      ? curva((s) => resultadoAntesDoVencimento(posicao, s, mercado, mercado.dias), faixa.min, faixa.max)
      : curva((s) => resultadoNoVencimento(posicao, s), faixa.min, faixa.max)
    const antes = passados < mercado.dias && vol > 0 ? curva((s) => resultadoAntesDoVencimento(posicao, s, mercado, passados), faixa.min, faixa.max) : null
    const g = vol > 0 && mercado.dias - passados > 0 ? gregasDaPosicao(posicao, precoAtivo, mercado, passados) : null
    return {
      analise, noVenc, antes, g,
      custo: custoDeMontagem(posicao),
      hoje: antes ? resultadoAntesDoVencimento(posicao, precoAtivo, mercado, passados) : resultadoNoVencimento(posicao, precoAtivo),
    }
  }, [posicao, precoAtivo, mercado, passados, vol, multi])

  const rotuloCurva = passados === 0 ? 'Hoje' : `Daqui a ${passados} ${passados === 1 ? 'dia' : 'dias'}`
  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const
  const semLimite = (v: number | null) => (v === null ? 'Sem limite' : dinheiro(v))

  return (
    <>
      <div id={'resultado-opcoes' + sufixo} className="card col" style={{ gap: 14, scrollMarginTop: 12 }} aria-live="polite">
        <span style={{ fontWeight: 700 }}>{multi ? `${titulo} no primeiro vencimento (estimado)` : `${titulo} no vencimento`}</span>

        {multi && (
          <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note" data-testid={'aviso-estimativa' + sufixo}>
            <strong>Vencimentos diferentes: o resultado é uma estimativa.</strong>{' '}
            <span className="muted">
              O gráfico mostra a posição daqui a {mercado.dias} dias úteis, quando vence a perna mais curta (vale só o valor intrínseco). As
              pernas mais longas ainda terão valor de tempo, que o app estima pelo modelo de Black-Scholes, usando a volatilidade implícita
              do preço de cada perna. Se a volatilidade mudar, o resultado muda. Ganho e perda máximos são, por isso, estimados.
            </span>
          </div>
        )}

        {aviso && (
          <div className="card-outline small justify aviso-atraso" style={{ lineHeight: 1.5 }} role="note" data-testid={'aviso-risco' + sufixo}>
            <strong>Atenção.</strong> <span className="muted">{aviso}</span>
          </div>
        )}

        <div className="row" style={{ gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 120px' }}>
            <span className="tiny muted">Ganho máximo{multi ? ' (estimado)' : ''}</span>
            <span style={{ fontWeight: 700, fontSize: 16 }} data-testid={'ganho-maximo' + sufixo}>{semLimite(dados.analise.ganhoMaximo)}</span>
          </div>
          <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 120px' }}>
            <span className="tiny muted">Perda máxima{multi ? ' (estimada)' : ''}</span>
            <span style={{ fontWeight: 700, fontSize: 16 }} data-testid={'perda-maxima' + sufixo}>{semLimite(dados.analise.perdaMaxima)}</span>
          </div>
          <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 120px' }}>
            <span className="tiny muted">Ponto de equilíbrio</span>
            <span style={{ fontWeight: 700, fontSize: 16 }} data-testid={'equilibrio' + sufixo}>
              {dados.analise.equilibrios.length ? dados.analise.equilibrios.map((v) => reais(v)).join(' e ') : '—'}
            </span>
          </div>
        </div>

        <div className="tiny muted justify">
          {dados.custo >= 0 ? 'Crédito' : 'Débito'} ao montar as opções: <strong>{reais(Math.abs(dados.custo))}</strong>
          {dados.custo >= 0 ? ' (você recebe o prêmio).' : ' (você paga o prêmio).'}
          {nota ? ` ${nota}` : ''}
        </div>
        {posicao.realizado ? (
          <div className="tiny muted justify" data-testid={'realizado' + sufixo}>
            Resultado já realizado nas pernas encerradas: <strong>{dinheiro(posicao.realizado)}</strong>. Ele já está somado nos números e no gráfico.
          </div>
        ) : null}

        <div style={{ width: '100%', maxWidth: 560, marginInline: 'auto' }}>
          <GraficoPayoff
            curvas={[
              { rotulo: multi ? 'No 1º vencimento (estimado)' : 'No vencimento', pontos: dados.noVenc, principal: true },
              ...(dados.antes ? [{ rotulo: rotuloCurva, pontos: dados.antes }] : []),
            ]}
            precoAtivo={precoAtivo}
            equilibrios={dados.analise.equilibrios}
            descricao={`Lucro e prejuízo da ${titulo.toLowerCase()} por preço do ativo no vencimento. Ganho máximo ${semLimite(dados.analise.ganhoMaximo)}, perda máxima ${semLimite(dados.analise.perdaMaxima)}.`}
          />
        </div>
        <div className="row tiny muted" style={{ gap: 14, flexWrap: 'wrap' }}>
          <span><MarcaDaLinha cor="var(--grafico-selic)" />{multi ? 'No 1º vencimento (estimado)' : 'No vencimento'}</span>
          {dados.antes && <span><MarcaDaLinha cor="var(--grafico-ipca)" traco="7 3.5" />{rotuloCurva}</span>}
          <span>┆ Preço de hoje</span>
          <span>○ Equilíbrio</span>
        </div>

        {mercado.dias > 0 && vol > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <label htmlFor={'dias-passados' + sufixo} className="small" style={{ fontWeight: 600 }}>
              Passagem do tempo: daqui a {passados} {passados === 1 ? 'dia útil' : 'dias úteis'} (faltariam {mercado.dias - passados})
            </label>
            <input
              id={'dias-passados' + sufixo}
              type="range"
              min={0}
              max={mercado.dias}
              value={passados}
              onChange={(ev) => setDiasPassados(Number(ev.target.value))}
              style={{ width: '100%' }}
            />
            <span className="tiny muted justify">
              A linha tracejada mostra o resultado se o ativo estiver em cada preço nesse dia, ainda antes do vencimento.
              Com o ativo parado, quem comprou opção perde valor com o tempo; quem vendeu ganha.
            </span>
            {dados.antes && (
              <span className="small">Com o ativo em {reais(precoAtivo)}, o resultado nesse dia seria <strong>{dinheiro(dados.hoje)}</strong>.</span>
            )}
          </div>
        )}

        {dados.g && (
          <div className="col" style={{ gap: 0 }}>
            <span className="small" style={{ fontWeight: 600, marginBottom: 4 }}>Gregas da posição{passados > 0 ? ` (daqui a ${passados} dias úteis)` : ' (hoje)'}</span>
            <div className="tabela-bdr small"><span className="muted">Delta (variação por R$ 1 no ativo)</span><span style={{ fontWeight: 700 }} data-testid={'delta' + sufixo}>{dados.g.delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span></div>
            <div className="tabela-bdr small"><span className="muted">Gama (variação do delta por R$ 1)</span><span style={{ fontWeight: 700 }}>{dados.g.gama.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span></div>
            <div className="tabela-bdr small"><span className="muted">Teta (por dia útil que passa)</span><span style={{ fontWeight: 700 }}>{dinheiro(dados.g.teta)}</span></div>
            <div className="tabela-bdr small"><span className="muted">Vega (por +1 ponto de volatilidade)</span><span style={{ fontWeight: 700 }}>{dinheiro(dados.g.vega)}</span></div>
          </div>
        )}

        <details>
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Volatilidade e juros (curva do tempo e gregas)</summary>
          <div className="col" style={{ gap: 10, marginTop: 10 }}>
            {multi && <span className="tiny muted justify">Com vencimentos diferentes, cada perna usa a volatilidade implícita do próprio preço; este valor só entra se alguma perna não tiver implícita.</span>}
            <CampoNumero rotulo="Volatilidade do ativo" valor={vol} onMudar={setVol} sufixo="% a.a." casas={1} />
            {volImplicita !== null && (
              <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="tiny muted">Volatilidade implícita no preço da primeira série: <strong>{volImplicita.toLocaleString('pt-BR')}% a.a.</strong></span>
                <button className="chip" onClick={() => setVol(volImplicita)}>Usar essa</button>
              </div>
            )}
            <CampoNumero rotulo="Juro livre de risco" valor={juros} onMudar={setJuros} sufixo="% a.a." casas={2} dica="Parte da Selic meta atual; serve só para precificar antes do vencimento." />
          </div>
        </details>

        <span className="tiny muted justify">
          A curva antes do vencimento e as gregas usam o modelo de Black-Scholes (opção europeia, sem dividendos), uma
          aproximação: opções americanas podem ser exercidas antes do vencimento. No vencimento, o resultado é exato.
        </span>
      </div>
    </>
  )
}
