import { useMemo, useState } from 'react'
import { diasUteis, tipoVencimento, vencimentosDe } from '../domain/opcoes'
import type { AtivoComOpcoes, EscolhaDeSeries, SnapshotOpcoes } from '../domain/opcoes'
import {
  GRUPOS_DE_MODELOS, MODELOS, escadaDeStrikes, indiceDoMaisPerto, montarPosicaoDoModelo, seriesPadrao, validarModelo, vencimentosDoModelo,
} from '../domain/modelosDeEstrategia'
import type { Modelo, ModeloId, PernaMontada } from '../domain/modelosDeEstrategia'
import type { Lado, Perna, Posicao } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { ManejoDaEstrategia } from './ManejoDaEstrategia'
import { PainelDaPosicao } from './PainelDaPosicao'
import type { PernaDaEstrutura } from '../domain/rolagem'

const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const rotuloTipo = (t: 'call' | 'put') => (t === 'call' ? 'CALL' : 'PUT')
const AVISO_VENDA =
  'Há séries vendidas: a venda de opções sem cobertura pode ter perda muito maior que o prêmio recebido (na venda descoberta de call, sem limite), e a B3 exige margem de garantia.'

type ModoId = ModeloId | 'livre'

/** Uma série trazida de outra aba (Top 15, Tendência), que o usuário pode ajustar uma a uma. */
interface PernaLivre {
  codigo: string
  tipo: 'call' | 'put'
  strike: number
  vencimento: string
  premio: number
  lado: Lado
  quantidade: number
}

/**
 * Aba "Monte sua estratégia": escolhe o ativo, uma estrutura (travas, borboletas, condors, straddles, venda coberta, collar…)
 * e o vencimento; o app sugere uma série para cada perna a partir do preço do ativo, e cada perna pode ser trocada por outra
 * série real. O resultado (gráfico, ganho e perda máximos, gregas) aparece embaixo. Compra e venda de uma call ou put soltas
 * são montadas direto na aba Séries da B3.
 */
export function MonteSuaEstrategia({ snapshot, ativo, onEscolher, escolha, dataPregao }: {
  snapshot: SnapshotOpcoes
  ativo: AtivoComOpcoes | null
  onEscolher: (t: string) => void
  /** Séries trazidas de outra aba; `n` muda a cada envio para reiniciar a montagem. */
  escolha: (EscolhaDeSeries & { n: number }) | null
  dataPregao: string | null
}) {
  if (!ativo) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Os dados de opções ainda não foram carregados.</span>
        <span className="muted small justify">As séries são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.</span>
      </div>
    )
  }
  const daqui = escolha && escolha.ativo.ticker === ativo.ticker ? escolha : null
  return (
    <>
      <div className="col" style={{ gap: 4 }} data-testid="monte-estrategia">
        <span style={{ fontWeight: 700, fontSize: 17 }}>Monte sua estratégia</span>
        <span className="muted small justify">
          Escolha o ativo, a estrutura (travas, borboletas, condors, straddles, venda coberta…) e o vencimento. O app sugere uma série para cada perna,
          e você pode trocar por qualquer outra série real. Compra e venda de uma call ou put soltas ficam na aba Séries da B3.
        </span>
      </div>
      <EscolhaDeAtivo snapshot={snapshot} ativo={ativo} onEscolher={onEscolher} />
      <Montagem key={`${ativo.ticker}:${daqui?.n ?? 0}`} ativo={ativo} escolha={daqui} hoje={dataPregao ?? new Date().toISOString().slice(0, 10)} />
    </>
  )
}

interface Configuracao {
  modo: ModoId
  vencimento: string
  /** Código da série de cada perna do modelo. */
  codigos: (string | null)[]
  premios: number[]
}

/** Sem preferência, parte do primeiro vencimento mensal com pelo menos 10 dias úteis (o semanal a poucos dias paga pouco e muda rápido). */
function configurar(ativo: AtivoComOpcoes, modelo: Modelo, vencimentoPreferido: string | null, hoje: string): Configuracao {
  const todos = vencimentosDe(ativo.series)
  const validos = vencimentosDoModelo(ativo.series, modelo, todos)
  const vencimento = vencimentoPreferido && validos.includes(vencimentoPreferido) ? vencimentoPreferido : (validos.find((v) => tipoVencimento(v) === 'mensal' && diasUteis(v, hoje) >= 10) ?? validos[0] ?? todos[0] ?? '')
  const series = seriesPadrao(ativo.series, modelo, vencimento, ativo.cotacao)
  return { modo: modelo.id, vencimento, codigos: series.map((s) => s?.codigo ?? null), premios: series.map((s) => s?.ultimo ?? 0) }
}

function Montagem({ ativo, escolha, hoje }: { ativo: AtivoComOpcoes; escolha: EscolhaDeSeries | null; hoje: string }) {
  const lote = ativo.lote >= 100 ? ativo.lote : 100
  const [config, setConfig] = useState<Configuracao>(() => {
    const serie = escolha?.series[0]
    if (escolha?.coberta && serie) {
      return { modo: 'vendaCoberta', vencimento: serie.vencimento, codigos: [serie.codigo], premios: [serie.ultimo] }
    }
    if (escolha) return { modo: 'livre', vencimento: serie?.vencimento ?? '', codigos: [], premios: [] }
    return configurar(ativo, MODELOS[0], null, hoje)
  })
  const [livres, setLivres] = useState<PernaLivre[]>(() =>
    (escolha && !escolha.coberta ? escolha.series : []).map((s) => ({
      codigo: s.codigo, tipo: s.tipo, strike: s.strike, vencimento: s.vencimento, premio: s.ultimo,
      lado: escolha?.detalhes?.[s.codigo]?.lado ?? escolha?.lado ?? 'compra',
      quantidade: lote * (escolha?.detalhes?.[s.codigo]?.fator ?? 1),
    })),
  )
  const [quantidade, setQuantidade] = useState(lote)
  const [precoAtivo, setPrecoAtivo] = useState(ativo.cotacao)

  const modelo = config.modo === 'livre' ? null : (MODELOS.find((m) => m.id === config.modo) ?? MODELOS[0])
  const vencimentos = useMemo(() => vencimentosDe(ativo.series), [ativo])
  const vencimentosValidos = useMemo(() => (modelo ? vencimentosDoModelo(ativo.series, modelo, vencimentos) : vencimentos), [ativo, modelo, vencimentos])

  const escolherModelo = (m: Modelo) => setConfig(configurar(ativo, m, config.vencimento, hoje))
  const escolherVencimento = (v: string) => modelo && setConfig(configurar(ativo, modelo, v, hoje))
  const trocarSerie = (i: number, codigo: string) => {
    const serie = ativo.series.find((s) => s.codigo === codigo)
    setConfig((c) => ({
      ...c,
      codigos: c.codigos.map((x, j) => (j === i ? codigo : x)),
      premios: c.premios.map((x, j) => (j === i ? (serie?.ultimo ?? x) : x)),
    }))
  }
  // Cada perna pode ter o seu vencimento: ao trocar, fica o strike mais perto do que estava.
  const trocarVencimentoDaPerna = (i: number, vencimento: string) => {
    const pm = modelo?.pernas[i]
    const atual = ativo.series.find((x) => x.codigo === config.codigos[i])
    if (!pm) return
    const escada = escadaDeStrikes(ativo.series, pm.tipo, vencimento)
    if (escada.length === 0) return
    trocarSerie(i, escada[indiceDoMaisPerto(escada, atual?.strike ?? ativo.cotacao)].codigo)
  }
  const trocarPremio = (i: number, valor: number) => setConfig((c) => ({ ...c, premios: c.premios.map((x, j) => (j === i ? valor : x)) }))
  const mudarLivre = (i: number, parcial: Partial<PernaLivre>) => setLivres((l) => l.map((x, j) => (j === i ? { ...x, ...parcial } : x)))

  // Pernas do modelo com as séries escolhidas.
  const seriesEscolhidas = modelo ? config.codigos.map((c) => ativo.series.find((s) => s.codigo === c) ?? null) : []
  const erroModelo = (() => {
    if (!modelo) return null
    if (vencimentosValidos.length === 0) return 'Nenhum vencimento dos próximos 6 meses tem séries de call e put para este modelo.'
    const motivo = validarModelo(modelo, seriesEscolhidas)
    if (motivo) return motivo
    if (!(precoAtivo > 0)) return 'Informe o preço do ativo.'
    if (!(quantidade > 0)) return 'Informe a quantidade.'
    if (config.premios.some((p) => !(p >= 0))) return 'O preço de uma série não pode ser negativo.'
    return null
  })()
  const vencimentosLivres = [...new Set(livres.map((p) => p.vencimento))]
  const erroLivre = (() => {
    if (modelo) return null
    if (livres.length === 0) return 'Todas as séries foram removidas. Escolha um modelo acima para montar de novo.'
    if (livres.some((p) => !(p.quantidade > 0))) return 'Informe a quantidade de todas as séries.'
    if (!(precoAtivo > 0)) return 'Informe o preço do ativo.'
    return null
  })()
  const erro = erroModelo ?? erroLivre

  const posicao: Posicao | null = useMemo(() => {
    if (erro) return null
    if (modelo) {
      const pernas: PernaMontada[] = modelo.pernas.map((pm, i) => ({ serie: seriesEscolhidas[i]!, lado: pm.lado, fator: pm.fator, premio: config.premios[i], dias: Math.max(diasUteis(seriesEscolhidas[i]!.vencimento, hoje), 1) }))
      return montarPosicaoDoModelo(modelo, pernas, quantidade, precoAtivo)
    }
    const pernas: Perna[] = livres.map((x) => ({ tipo: x.tipo, lado: x.lado, strike: x.strike, premio: x.premio, quantidade: x.quantidade, dias: Math.max(diasUteis(x.vencimento, hoje), 1) }))
    return { pernas, acoes: 0, precoAcao: 0 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erro, modelo, config, livres, quantidade, precoAtivo, hoje])

  // Pernas montadas, com as séries, para o manejo (rolagem, desmontagem e cenários).
  const manejo: PernaDaEstrutura[] = posicao
    ? posicao.pernas.flatMap((perna, i) => {
        const codigo = modelo ? config.codigos[i] : livres[i]?.codigo
        const serie = ativo.series.find((x) => x.codigo === codigo)
        return serie ? [{ perna, serie }] : []
      })
    : []
  const vencimentoEmUso = modelo ? config.vencimento : (vencimentosLivres[0] ?? '')
  const dias = vencimentoEmUso ? Math.max(diasUteis(vencimentoEmUso, hoje), 1) : 21
  const aviso = modelo
    ? (modelo.aviso ?? null)
    : livres.some((x) => x.lado === 'venda') ? AVISO_VENDA : null
  const titulo = modelo ? modelo.titulo : 'Estratégia com as séries escolhidas'

  return (
    <>
      {escolha?.coberta && (
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
          Venda coberta com a série <strong>{escolha.series[0].codigo}</strong> de <strong>{escolha.ativo.ticker}</strong>, pelo último preço dela.
          Você precisa ter as ações; a série e o preço podem ser alterados.
        </div>
      )}
      {escolha && !escolha.coberta && (
        <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
          Séries escolhidas de <strong>{escolha.ativo.ticker}</strong> ({escolha.series.map((s) => s.codigo).join(', ')}), com o último preço de cada uma.
          Você pode trocar compra por venda, a quantidade e o preço de cada série.
        </div>
      )}

      <div className="col" style={{ gap: 10 }}>
        <span className="small" style={{ fontWeight: 600 }}>Escolha a estrutura</span>
        {escolha && !escolha.coberta && livres.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className={`chip ${!modelo ? 'selected' : ''}`} aria-pressed={!modelo} onClick={() => setConfig((c) => ({ ...c, modo: 'livre' }))}>
              Séries escolhidas ({livres.length})
            </button>
          </div>
        )}
        {GRUPOS_DE_MODELOS.map((grupo) => (
          <div key={grupo} className="col" style={{ gap: 4 }} role="group" aria-label={grupo}>
            <span className="tiny muted">{grupo}</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {MODELOS.filter((m) => m.grupo === grupo).map((m) => (
                <button key={m.id} className={`chip ${modelo?.id === m.id ? 'selected' : ''}`} aria-pressed={modelo?.id === m.id} onClick={() => escolherModelo(m)}>
                  {m.titulo}
                </button>
              ))}
            </div>
          </div>
        ))}
        <span className="small muted justify">
          {modelo ? modelo.descricao : 'Monte a posição série a série: cada uma pode ser comprada ou vendida.'}
        </span>
      </div>

      {modelo && (
        <div className="col" style={{ gap: 6 }} role="group" aria-label="Vencimento da estratégia">
          <span className="small" style={{ fontWeight: 600 }}>{modelo.pernas.some((x) => x.longa) ? 'Vencimento da perna curta (a longa vai para o seguinte)' : 'Vencimento (próximos 6 meses)'}</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {vencimentosValidos.map((v) => (
              <button key={v} className={`chip ${config.vencimento === v ? 'selected' : ''}`} aria-pressed={config.vencimento === v} onClick={() => escolherVencimento(v)}>
                {formatarData(v)} ({diasUteis(v, hoje)} d.u., {tipoVencimento(v)})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card col" style={{ gap: 12 }}>
        <span style={{ fontWeight: 700 }}>Pernas da estratégia</span>
        <CampoReais rotulo="Preço do ativo hoje" valor={precoAtivo} onMudar={setPrecoAtivo} />

        {modelo ? (
          <>
            {modelo.comAcoes && (
              <span className="tiny muted justify">Você precisa ter {quantidade.toLocaleString('pt-BR')} ações de {ativo.ticker}, compradas a {reais(precoAtivo)} (o preço acima).</span>
            )}
            {modelo.pernas.map((pm, i) => {
              const escada = escadaDeStrikes(ativo.series, pm.tipo, ativo.series.find((x) => x.codigo === config.codigos[i])?.vencimento ?? config.vencimento)
              const atual = config.codigos[i]
              const rotulo = `${pm.lado === 'compra' ? 'Compra' : 'Venda'}${pm.fator > 1 ? ` de ${pm.fator}x` : ''} de ${pm.tipo === 'call' ? 'call' : 'put'}`
              return (
                <div key={i} className="card-outline col" style={{ gap: 8 }} role="group" aria-label={`Perna ${i + 1}: ${rotulo}`}>
                  <span><strong>{rotulo}</strong> <span className="muted small">(perna {i + 1})</span></span>
                  <label className="col" style={{ gap: 4 }}>
                    <span className="small" style={{ fontWeight: 600 }}>Vencimento da perna {i + 1}</span>
                    <select value={ativo.series.find((x) => x.codigo === atual)?.vencimento ?? ''} onChange={(ev) => trocarVencimentoDaPerna(i, ev.target.value)} aria-label={'Vencimento da perna ' + (i + 1)}>
                      {vencimentos.filter((v) => escadaDeStrikes(ativo.series, pm.tipo, v).length > 0).map((v) => (
                        <option key={v} value={v}>{formatarData(v)} ({diasUteis(v, hoje)} d.u., {tipoVencimento(v)})</option>
                      ))}
                    </select>
                  </label>
                  <label className="col" style={{ gap: 4 }}>
                    <span className="small" style={{ fontWeight: 600 }}>Série da perna {i + 1}</span>
                    <select value={atual ?? ''} onChange={(ev) => trocarSerie(i, ev.target.value)} aria-label={`Série da perna ${i + 1}`}>
                      {escada.map((s) => (
                        <option key={s.codigo} value={s.codigo}>
                          {s.codigo}, strike {num(s.strike)}, último {num(s.ultimo)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 130px' }}>
                      <CampoReais rotulo={`Preço da perna ${i + 1}`} valor={config.premios[i] ?? 0} onMudar={(v) => trocarPremio(i, v)} />
                    </div>
                    <div className="col" style={{ flex: '1 1 130px', gap: 2, justifyContent: 'flex-end' }}>
                      <span className="tiny muted">Quantidade</span>
                      <span style={{ fontWeight: 600 }}>{(quantidade * pm.fator).toLocaleString('pt-BR')} opções</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <CampoNumero rotulo="Quantidade (lote)" valor={quantidade} onMudar={setQuantidade} sufixo="opções" casas={0} dica={`O lote padrão de ${ativo.ticker} na B3 é de ${lote}.`} />
          </>
        ) : (
          <div className="col" style={{ gap: 12 }}>
            {livres.map((p, i) => (
              <div key={p.codigo} className="card-outline col" style={{ gap: 8 }} role="group" aria-label={`Série ${p.codigo}`}>
                <div className="row-between" style={{ alignItems: 'center', gap: 8 }}>
                  <span>
                    <strong>{p.codigo}</strong> <span className="muted small">{rotuloTipo(p.tipo)}, strike {num(p.strike)}, vence {formatarData(p.vencimento)}</span>
                  </span>
                  <button className="chip" onClick={() => setLivres((l) => l.filter((_, j) => j !== i))} aria-label={`Remover ${p.codigo}`}>Remover</button>
                </div>
                <div className="row" style={{ gap: 6 }} role="group" aria-label={`Lado de ${p.codigo}`}>
                  {(['compra', 'venda'] as Lado[]).map((lado) => (
                    <button key={lado} className={`chip ${p.lado === lado ? 'selected' : ''}`} aria-pressed={p.lado === lado} onClick={() => mudarLivre(i, { lado })}>
                      {lado === 'compra' ? 'Comprar' : 'Vender'}
                    </button>
                  ))}
                </div>
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 130px' }}><CampoReais rotulo={`Preço de ${p.codigo}`} valor={p.premio} onMudar={(v) => mudarLivre(i, { premio: v })} /></div>
                  <div style={{ flex: '1 1 130px' }}><CampoNumero rotulo={`Quantidade de ${p.codigo}`} valor={p.quantidade} onMudar={(v) => mudarLivre(i, { quantidade: v })} sufixo="opções" casas={0} /></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {erro || !posicao ? (
        <div className="card-outline small justify" role="status">
          <strong>Falta preencher:</strong> <span className="muted">{erro}</span>
        </div>
      ) : (
        <>
        <PainelDaPosicao
          posicao={posicao}
          precoAtivo={precoAtivo}
          dias={dias}
          titulo={titulo}
          aviso={aviso}
          nota={modelo?.comAcoes ? `Precisa ter ${quantidade.toLocaleString('pt-BR')} ações do ativo, compradas a ${reais(precoAtivo)}.` : undefined}
        />
        <ManejoDaEstrategia
          key={manejo.map((x) => x.serie.codigo).join('|')}
          ativo={ativo}
          pernas={manejo}
          base={{ acoes: posicao.acoes, precoAcao: posicao.precoAcao }}
          precoAtivo={precoAtivo}
          hoje={hoje}
        />
        </>
      )}
    </>
  )
}
