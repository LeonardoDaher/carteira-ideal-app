import { useEffect, useMemo, useRef, useState } from 'react'
import { jurosPadrao } from '../data/jurosOpcoes'
import { storage } from '../data/storage'
import { diasUteis, tipoVencimento, vencimentosDe } from '../domain/opcoes'
import type { AtivoComOpcoes, SnapshotOpcoes } from '../domain/opcoes'
import { escadaDeStrikes, indiceDoMaisPerto } from '../domain/modelosDeEstrategia'
import {
  identificarEstrutura, possibilidadesDeSaida, posicaoParaOMotor, resolverPosicao, situacaoDeHoje,
} from '../domain/posicaoReal'
import type { PernaCadastrada, Possibilidade, PosicaoCadastrada } from '../domain/posicaoReal'
import type { Lado } from '../domain/simulaOpcoes'
import { formatarData } from '../domain/rendaFii'
import { reais } from '../domain/mercadoOficial'
import { CampoNumero } from '../ui/CampoNumero'
import { CampoReais } from '../ui/CampoReais'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { ManejoDaEstrategia } from './ManejoDaEstrategia'
import { PainelDaPosicao } from './PainelDaPosicao'

/** Chave do aparelho onde ficam as posições cadastradas (uma por ativo). Nada disso sai do navegador. */
export const CHAVE_POSICOES_OPCOES = 'carteiraideal.opcoes.posicoes'

type Armazenamento = Pick<typeof storage, 'getItem' | 'setItem'>

const num = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const dinheiro = (v: number) => (v < 0 ? `−${reais(-v)}` : reais(v))
const corDe = (v: number) => (Math.abs(v) < 0.005 ? undefined : v > 0 ? 'var(--mc-pos)' : 'var(--danger)')
const vazia = (ticker: string): PosicaoCadastrada => ({ ticker, pernas: [], acoes: null, montadaEm: null, precoNaMontagem: null })

async function lerPosicoes(armazenamento: Armazenamento): Promise<Record<string, PosicaoCadastrada>> {
  try {
    const bruto = await armazenamento.getItem(CHAVE_POSICOES_OPCOES)
    const lido = bruto ? JSON.parse(bruto) : {}
    return lido && typeof lido === 'object' ? lido : {}
  } catch {
    return {}
  }
}

/**
 * Aba "Minha posição": a pessoa cadastra a estrutura que montou (séries, lado, quantidade, preço e, se houver, as ações) e o app
 * mostra como ela está hoje pelo último preço, que estrutura é, o gráfico e as saídas possíveis (manter, encerrar, fechar uma
 * perna, rolar, proteger), cada uma com o resultado e o novo risco. Os dados ficam só neste aparelho. Descritiva e educacional.
 */
export function MinhaPosicaoOpcoes({ snapshot, ativo, onEscolher, dataPregao, armazenamento = storage }: {
  snapshot: SnapshotOpcoes
  ativo: AtivoComOpcoes | null
  onEscolher: (t: string) => void
  dataPregao: string | null
  armazenamento?: Armazenamento
}) {
  if (!ativo) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Os dados de opções ainda não foram carregados.</span>
        <span className="muted small justify">As séries são atualizadas nos dias úteis, depois do fechamento da B3. Volte mais tarde.</span>
      </div>
    )
  }
  return (
    <>
      <div className="col" style={{ gap: 4 }} data-testid="posicao-intro">
        <span style={{ fontWeight: 700, fontSize: 17 }}>Minha posição de opções</span>
        <span className="muted small justify">
          Cadastre a estrutura que você montou: as séries, se comprou ou vendeu, a quantidade e o preço da operação (e as ações, se a estrutura as usa).
          O app reconhece a estrutura, mostra como ela está hoje pelo último preço de cada série, desenha o gráfico e lista as saídas possíveis se o
          mercado andar contra você, com o resultado e o novo risco de cada uma. Os dados ficam só neste aparelho.
        </span>
      </div>
      <EscolhaDeAtivo snapshot={snapshot} ativo={ativo} onEscolher={onEscolher} />
      <Posicao key={ativo.ticker} ativo={ativo} hoje={dataPregao ?? new Date().toISOString().slice(0, 10)} armazenamento={armazenamento} />
    </>
  )
}

function Posicao({ ativo, hoje, armazenamento }: { ativo: AtivoComOpcoes; hoje: string; armazenamento: Armazenamento }) {
  const lote = ativo.lote >= 100 ? ativo.lote : 100
  const [pos, setPos] = useState<PosicaoCadastrada>(() => vazia(ativo.ticker))
  const [carregada, setCarregada] = useState(false)
  const contador = useRef(0)
  const proximoId = () => `p${Date.now().toString(36)}${(contador.current++).toString(36)}`

  // Lê a posição guardada deste ativo e, depois disso, grava a cada mudança.
  useEffect(() => {
    let vivo = true
    lerPosicoes(armazenamento).then((mapa) => {
      if (!vivo) return
      if (mapa[ativo.ticker]) setPos({ ...vazia(ativo.ticker), ...mapa[ativo.ticker] })
      setCarregada(true)
    })
    return () => {
      vivo = false
    }
  }, [ativo.ticker, armazenamento])
  useEffect(() => {
    if (!carregada) return
    lerPosicoes(armazenamento).then((mapa) => {
      const temAlgo = pos.pernas.length > 0 || pos.acoes
      if (temAlgo) mapa[ativo.ticker] = pos
      else delete mapa[ativo.ticker]
      return armazenamento.setItem(CHAVE_POSICOES_OPCOES, JSON.stringify(mapa))
    })
  }, [pos, carregada, ativo.ticker, armazenamento])

  const r = Math.log(1 + jurosPadrao() / 100)
  const resolvida = useMemo(() => resolverPosicao(pos, ativo, hoje, r), [pos, ativo, hoje, r])
  const resolvidas = resolvida.resolvidas
  const estrutura = useMemo(() => identificarEstrutura(resolvidas, pos.acoes), [resolvidas, pos.acoes])
  const situacao = useMemo(() => (resolvidas.length || pos.acoes ? situacaoDeHoje(pos, resolvida, ativo, r) : null), [pos, resolvida, ativo, r, resolvidas.length])
  const saidas = useMemo(() => possibilidadesDeSaida(pos, resolvida, ativo, hoje, r), [pos, resolvida, ativo, hoje, r])
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const saidaEscolhida = saidas.find((s) => s.id === escolhida) ?? null
  const painelSaidaRef = useRef<HTMLDivElement>(null)

  const adicionarPerna = (p: Omit<PernaCadastrada, 'id'>) => setPos((x) => ({ ...x, pernas: [...x.pernas, { ...p, id: proximoId() }] }))
  const mudarPerna = (id: string, parcial: Partial<PernaCadastrada>) => setPos((x) => ({ ...x, pernas: x.pernas.map((p) => (p.id === id ? { ...p, ...parcial } : p)) }))
  const removerPerna = (id: string) => {
    setEscolhida(null)
    setPos((x) => ({ ...x, pernas: x.pernas.filter((p) => p.id !== id) }))
  }

  const posicaoMotor = resolvidas.length ? posicaoParaOMotor(resolvidas, pos.acoes) : null
  const diasPrimeiro = resolvidas.length ? Math.min(...resolvidas.map((x) => x.dias)) : 0
  const caixa = { padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)' } as const
  const desdeMontagem = (() => {
    if (!pos.montadaEm && !pos.precoNaMontagem) return null
    const partes: string[] = []
    if (pos.montadaEm) partes.push(`Montada em ${formatarData(pos.montadaEm)} (${Math.max(diasUteis(hoje, pos.montadaEm), 0)} dias úteis atrás)`)
    if (pos.precoNaMontagem && pos.precoNaMontagem > 0) {
      const v = ((ativo.cotacao - pos.precoNaMontagem) / pos.precoNaMontagem) * 100
      partes.push(`o ativo foi de ${reais(pos.precoNaMontagem)} para ${reais(ativo.cotacao)} (${v > 0 ? '+' : ''}${num(v, 1)}%)`)
    }
    return partes.join(': ')
  })()

  return (
    <>
      <FormularioDePerna ativo={ativo} lote={lote} hoje={hoje} onAdicionar={adicionarPerna} />

      <div className="card col" style={{ gap: 10 }} data-testid="posicao-cadastrada">
        <span style={{ fontWeight: 700 }}>Sua posição em {ativo.ticker}</span>
        {pos.pernas.length === 0 && !pos.acoes && <span className="small muted">Ainda não há nada cadastrado. Adicione as pernas acima.</span>}
        {pos.pernas.map((p) => {
          const serie = ativo.series.find((s) => s.codigo === p.codigo)
          return (
            <div key={p.id} className="card-outline col" style={{ gap: 8 }} role="group" aria-label={`Perna ${p.codigo}`}>
              <div className="row-between" style={{ alignItems: 'center', gap: 8 }}>
                <span>
                  <strong>{p.codigo}</strong>{' '}
                  <span className="muted small">
                    {p.lado === 'compra' ? 'comprada' : 'vendida'}
                    {serie ? `, ${serie.tipo === 'call' ? 'call' : 'put'}, strike ${num(serie.strike)}, vence ${formatarData(serie.vencimento)}` : ': não está mais na lista'}
                  </span>
                </span>
                <button className="chip" onClick={() => removerPerna(p.id)} aria-label={`Remover ${p.codigo}`}>Remover</button>
              </div>
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 130px' }}><CampoNumero rotulo={`Quantidade de ${p.codigo}`} valor={p.quantidade} onMudar={(v) => mudarPerna(p.id, { quantidade: v })} sufixo="opções" casas={0} /></div>
                <div style={{ flex: '1 1 130px' }}><CampoReais rotulo={`Preço da operação de ${p.codigo}`} valor={p.premio} onMudar={(v) => mudarPerna(p.id, { premio: v })} /></div>
              </div>
            </div>
          )
        })}
        {pos.acoes && (
          <div className="card-outline col" style={{ gap: 8 }} role="group" aria-label="Ações">
            <div className="row-between" style={{ alignItems: 'center', gap: 8 }}>
              <span><strong>Ações de {ativo.ticker}</strong> <span className="muted small">no preço médio informado</span></span>
              <button className="chip" onClick={() => setPos((x) => ({ ...x, acoes: null }))} aria-label="Remover ações">Remover</button>
            </div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 130px' }}><CampoNumero rotulo="Quantidade de ações" valor={pos.acoes.quantidade} onMudar={(v) => setPos((x) => ({ ...x, acoes: x.acoes ? { ...x.acoes, quantidade: v } : x.acoes }))} sufixo="ações" casas={0} /></div>
              <div style={{ flex: '1 1 130px' }}><CampoReais rotulo="Preço médio das ações" valor={pos.acoes.precoMedio} onMudar={(v) => setPos((x) => ({ ...x, acoes: x.acoes ? { ...x.acoes, precoMedio: v } : x.acoes }))} /></div>
            </div>
          </div>
        )}
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {!pos.acoes && (
            <button className="chip" onClick={() => setPos((x) => ({ ...x, acoes: { quantidade: lote, precoMedio: ativo.cotacao } }))}>+ Adicionar ações de {ativo.ticker}</button>
          )}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <label className="col" style={{ gap: 4, flex: '1 1 160px' }}>
            <span className="small" style={{ fontWeight: 600 }}>Montada em (opcional)</span>
            <input type="date" value={pos.montadaEm ?? ''} max={hoje} onChange={(ev) => setPos((x) => ({ ...x, montadaEm: ev.target.value || null }))} aria-label="Data da montagem" />
          </label>
          <div style={{ flex: '1 1 160px' }}>
            <CampoReais rotulo="Preço do ativo na montagem (opcional)" valor={pos.precoNaMontagem ?? 0} onMudar={(v) => setPos((x) => ({ ...x, precoNaMontagem: v > 0 ? v : null }))} />
          </div>
        </div>
        {resolvida.semSerie.length > 0 && (
          <div className="card-outline small justify aviso-atraso" role="note" data-testid="aviso-sem-serie">
            <strong>Fora da análise:</strong>{' '}
            <span className="muted">
              {resolvida.semSerie.map((p) => p.codigo).join(', ')} não está na lista de séries (venceu, não negociou nos últimos pregões ou está além dos 6 meses), então ficou de fora dos números.
            </span>
          </div>
        )}
        {pos.pernas.length > 0 && (
          <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => { setEscolhida(null); setPos(vazia(ativo.ticker)) }}>Limpar a posição</button>
        )}
      </div>

      {situacao && (
        <div className="card col" style={{ gap: 12 }} data-testid="posicao-hoje">
          <div className="col" style={{ gap: 2 }}>
            <span style={{ fontWeight: 700 }} data-testid="estrutura-identificada">{estrutura.titulo}</span>
            <span className="small muted justify">{estrutura.resumo}</span>
          </div>
          {desdeMontagem && <span className="small muted" data-testid="desde-montagem">{desdeMontagem}.</span>}

          <div className="row" style={{ gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 150px' }}>
              <span className="tiny muted">Resultado hoje (último preço)</span>
              <span style={{ fontWeight: 700, fontSize: 17, color: corDe(situacao.total) }} data-testid="resultado-hoje">{dinheiro(situacao.total)}</span>
              {pos.acoes && <span className="tiny muted">opções {dinheiro(situacao.resultadoOpcoes)} · ações {dinheiro(situacao.resultadoAcoes)}</span>}
            </div>
            <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 130px' }}>
              <span className="tiny muted">Ganho máximo{situacao.analise.estimado ? ' (estimado)' : ''}</span>
              <span style={{ fontWeight: 700, fontSize: 15 }} data-testid="posicao-ganho-max">{situacao.analise.ganhoMaximo === null ? 'Sem limite' : dinheiro(situacao.analise.ganhoMaximo)}</span>
            </div>
            <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 130px' }}>
              <span className="tiny muted">Perda máxima{situacao.analise.estimado ? ' (estimada)' : ''}</span>
              <span style={{ fontWeight: 700, fontSize: 15 }} data-testid="posicao-perda-max">{situacao.analise.perdaMaxima === null ? 'Sem limite' : dinheiro(situacao.analise.perdaMaxima)}</span>
            </div>
            {situacao.capturado !== null && (
              <div className="col" style={{ ...caixa, gap: 2, flex: '1 1 130px' }}>
                <span className="tiny muted">Do ganho máximo já capturado</span>
                <span style={{ fontWeight: 700, fontSize: 15 }} data-testid="posicao-capturado">{Math.round(situacao.capturado * 100)}%</span>
              </div>
            )}
          </div>

          {situacao.linhas.length > 0 && (
            <div style={{ overflowX: 'auto' }} className="card-outline">
              <table className="tabela-opcoes small" data-testid="tabela-posicao">
                <thead>
                  <tr>
                    <th scope="col">Série</th>
                    <th scope="col">Lado</th>
                    <th scope="col">Strike</th>
                    <th scope="col">Vence (d.u.)</th>
                    <th scope="col">Qtd</th>
                    <th scope="col">Operação</th>
                    <th scope="col">Último hoje</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">A/I/OTM</th>
                    <th scope="col" title="Distância do strike ao preço do ativo">Dist. (%)</th>
                    <th scope="col">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {situacao.linhas.map((l) => (
                    <tr key={l.codigo}>
                      <td style={{ fontWeight: 700 }}>{l.codigo}</td>
                      <td>{l.lado === 'compra' ? 'Compra' : 'Venda'}</td>
                      <td className="num">{num(l.strike)}</td>
                      <td>{formatarData(l.vencimento)} ({l.dias})</td>
                      <td className="num">{l.quantidade.toLocaleString('pt-BR')}</td>
                      <td className="num">{num(l.premio)}</td>
                      <td className="num">{num(l.ultimo)}</td>
                      <td className="num" style={{ color: corDe(l.resultado), fontWeight: 700 }}>{dinheiro(l.resultado)}</td>
                      <td>{l.situacao}</td>
                      <td className="num">{num(l.distancia, 1)}</td>
                      <td className="num">{num(l.delta, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {situacao.pontosDeAtencao.length > 0 && (
            <div className="col" style={{ gap: 4 }} data-testid="pontos-de-atencao">
              <span className="small" style={{ fontWeight: 600 }}>Pontos de atenção</span>
              <ul className="small muted justify" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                {situacao.pontosDeAtencao.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {posicaoMotor && posicaoMotor.pernas.length > 0 && (
        <PainelDaPosicao sufixo="-posicao" posicao={posicaoMotor} precoAtivo={ativo.cotacao} dias={diasPrimeiro} titulo={`Sua posição (${estrutura.titulo})`}
          nota="Resultado pelos preços que você informou; a curva tracejada usa os preços de mercado de hoje." />
      )}

      {saidas.length > 0 && (
        <div className="card col" style={{ gap: 10 }} data-testid="possibilidades">
          <span style={{ fontWeight: 700 }}>Possibilidades de saída</span>
          <span className="small muted justify">
            O que dá para fazer hoje, com o último preço de cada série, e como a posição ficaria. Não é recomendação nem ordem: o app não diz qual escolher, porque a
            melhor saída depende do que você pensa do ativo e de quanto aceita arriscar. O preço real de compra e venda na hora pode ser pior.
          </span>
          <div style={{ overflowX: 'auto' }} className="card-outline">
            <table className="tabela-opcoes small">
              <thead>
                <tr>
                  <th scope="col">Possibilidade</th>
                  <th scope="col" title="Dinheiro que entra (+) ou sai (−) hoje">Fluxo hoje</th>
                  <th scope="col" title="Lucro ou prejuízo que se realiza hoje">Realiza</th>
                  <th scope="col">Ganho máx. depois</th>
                  <th scope="col">Perda máx. depois</th>
                  <th scope="col"><span className="sr-only">Ver</span></th>
                </tr>
              </thead>
              <tbody>
                {saidas.map((s) => (
                  <tr key={s.id} data-testid="possibilidade" className={escolhida === s.id ? 'linha-marcada' : undefined}>
                    <td style={{ minWidth: 220 }}>
                      <div style={{ fontWeight: 700 }}>{s.titulo}</div>
                      <div className="tiny muted" style={{ lineHeight: 1.4 }}>{s.descricao}</div>
                      {s.notas.length > 0 && <div className="tiny" style={{ marginTop: 2 }}>{s.notas.join(' · ')}</div>}
                    </td>
                    <td className="num" style={{ color: corDe(s.fluxoHoje) }}>{dinheiro(s.fluxoHoje)}</td>
                    <td className="num" style={{ color: corDe(s.realizado) }}>{dinheiro(s.realizado)}</td>
                    <td className="num">{s.ganhoMaximo === null ? 'Sem limite' : dinheiro(s.ganhoMaximo)}{s.estimado ? '*' : ''}</td>
                    <td className="num">{s.perdaMaxima === null ? 'Sem limite' : dinheiro(s.perdaMaxima)}{s.estimado ? '*' : ''}</td>
                    <td>
                      <button
                        className="chip"
                        aria-pressed={escolhida === s.id}
                        aria-label={`Ver como fica: ${s.titulo}`}
                        onClick={() => {
                          const repetido = escolhida === s.id
                          setEscolhida(repetido ? null : s.id)
                          if (!repetido) setTimeout(() => painelSaidaRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0)
                        }}
                      >
                        Ver como fica
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {saidas.some((s) => s.estimado) && <span className="tiny muted justify">* Estimado: a posição tem vencimentos diferentes, e o resultado vale na data do primeiro vencimento (modelo de Black-Scholes).</span>}
        </div>
      )}

      {saidaEscolhida && (
        <div ref={painelSaidaRef} className="col" style={{ gap: 10, scrollMarginTop: 12 }} data-testid="como-fica">
          <ComoFica saida={saidaEscolhida} precoAtivo={ativo.cotacao} />
        </div>
      )}

      {resolvidas.length > 0 && (
        <details className="card col" style={{ gap: 12 }} data-testid="posicao-manejo">
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Simular cenários, desmontagem e rolagem com mais liberdade</summary>
          <div style={{ marginTop: 12 }}>
            <ManejoDaEstrategia
              key={resolvidas.map((x) => x.serie.codigo).join('|')}
              ativo={ativo}
              pernas={resolvidas.map((x) => ({ perna: x.perna, serie: x.serie }))}
              base={{ acoes: pos.acoes?.quantidade ?? 0, precoAcao: pos.acoes?.precoMedio ?? 0 }}
              precoAtivo={ativo.cotacao}
              hoje={hoje}
            />
          </div>
        </details>
      )}

      <div className="card-outline small justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Como ler.</strong> Os números usam o <strong>último preço negociado</strong> de cada série (que pode estar defasado) e o modelo de Black-Scholes onde é preciso estimar;
        o preço real de compra e venda na hora pode ser pior, e uma rolagem ou um encerramento real costuma sair com menos crédito do que o estimado. Ignoram corretagem,
        emolumentos e imposto de renda. As possibilidades descrevem caminhos e o que cada um muda; a decisão é sua.
      </div>
    </>
  )
}

function ComoFica({ saida, precoAtivo }: { saida: Possibilidade; precoAtivo: number }) {
  if (!saida.depois || (saida.depois.pernas.length === 0 && saida.depois.acoes === 0)) {
    return (
      <div className="card col" style={{ gap: 6 }}>
        <span style={{ fontWeight: 700 }}>{saida.titulo}</span>
        <span className="small muted justify">
          Depois disso não sobra nenhuma opção aberta. O resultado realizado é <strong>{dinheiro(saida.realizado)}</strong>
          {saida.fluxoHoje >= 0 ? ` e entram ${reais(saida.fluxoHoje)}` : ` e saem ${reais(-saida.fluxoHoje)}`} hoje.
        </span>
      </div>
    )
  }
  if (saida.depois.pernas.length === 0) {
    return (
      <div className="card col" style={{ gap: 6 }}>
        <span style={{ fontWeight: 700 }}>{saida.titulo}</span>
        <span className="small muted justify">Sobram só as ações. Resultado realizado nas opções: <strong>{dinheiro(saida.realizado)}</strong>.</span>
      </div>
    )
  }
  const dias = Math.max(Math.min(...saida.depois.pernas.map((x) => x.dias ?? 21)), 1)
  return (
    <PainelDaPosicao sufixo="-saida" posicao={saida.depois} precoAtivo={precoAtivo} dias={dias} titulo={`Como fica: ${saida.titulo}`}
      aviso={saida.notas.find((n) => n.startsWith('Débito')) ?? null} />
  )
}

function FormularioDePerna({ ativo, lote, hoje, onAdicionar }: { ativo: AtivoComOpcoes; lote: number; hoje: string; onAdicionar: (p: Omit<PernaCadastrada, 'id'>) => void }) {
  const vencimentos = useMemo(() => vencimentosDe(ativo.series), [ativo])
  const [tipo, setTipo] = useState<'call' | 'put'>('call')
  const [vencimento, setVencimento] = useState(() => vencimentos[0] ?? '')
  const [lado, setLado] = useState<Lado>('compra')
  const escada = useMemo(() => escadaDeStrikes(ativo.series, tipo, vencimento), [ativo, tipo, vencimento])
  const [codigo, setCodigo] = useState(() => '')
  const escolhida = escada.find((s) => s.codigo === codigo) ?? (escada.length ? escada[indiceDoMaisPerto(escada, ativo.cotacao)] : null)
  const [quantidade, setQuantidade] = useState(lote)
  const [premio, setPremio] = useState<number | null>(null)
  const preco = premio ?? escolhida?.ultimo ?? 0

  const trocarTipo = (t: 'call' | 'put') => { setTipo(t); setCodigo(''); setPremio(null) }
  const trocarVenc = (v: string) => { setVencimento(v); setCodigo(''); setPremio(null) }
  const trocarSerie = (c: string) => { setCodigo(c); setPremio(null) }
  const podeAdicionar = !!escolhida && quantidade > 0 && preco >= 0

  return (
    <div className="card col" style={{ gap: 12 }} role="group" aria-label="Adicionar perna">
      <span style={{ fontWeight: 700 }}>Adicionar uma perna</span>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Tipo da opção">
        {(['call', 'put'] as const).map((t) => (
          <button key={t} className={`chip ${tipo === t ? 'selected' : ''}`} aria-pressed={tipo === t} onClick={() => trocarTipo(t)}>{t === 'call' ? 'Call' : 'Put'}</button>
        ))}
      </div>
      <div className="row" style={{ gap: 6 }} role="group" aria-label="Lado da operação">
        {(['compra', 'venda'] as Lado[]).map((l) => {
          const cor = l === 'compra' ? 'var(--mc-pos)' : 'var(--danger)'
          return (
            <button
              key={l}
              className="chip"
              aria-pressed={lado === l}
              style={{ fontWeight: 700, ...(lado === l ? { background: cor, borderColor: cor, color: '#fff' } : { borderColor: cor, color: cor }) }}
              onClick={() => setLado(l)}
            >
              {l === 'compra' ? 'Comprei' : 'Vendi'}
            </button>
          )
        })}
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <label className="col" style={{ gap: 4, flex: '1 1 180px' }}>
          <span className="small" style={{ fontWeight: 600 }}>Vencimento</span>
          <select value={vencimento} onChange={(ev) => trocarVenc(ev.target.value)} aria-label="Vencimento da perna">
            {vencimentos.map((v) => <option key={v} value={v}>{formatarData(v)} ({diasUteis(v, hoje)} d.u., {tipoVencimento(v)})</option>)}
          </select>
        </label>
        <label className="col" style={{ gap: 4, flex: '1 1 220px' }}>
          <span className="small" style={{ fontWeight: 600 }}>Série</span>
          <select value={escolhida?.codigo ?? ''} onChange={(ev) => trocarSerie(ev.target.value)} aria-label="Série da perna">
            {escada.map((s) => <option key={s.codigo} value={s.codigo}>{s.codigo}, strike {num(s.strike)}, último {num(s.ultimo)}</option>)}
          </select>
        </label>
      </div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 130px' }}><CampoNumero rotulo="Quantidade" valor={quantidade} onMudar={setQuantidade} sufixo="opções" casas={0} dica={`O lote padrão de ${ativo.ticker} na B3 é de ${lote}.`} /></div>
        <div style={{ flex: '1 1 130px' }}><CampoReais rotulo={lado === 'compra' ? 'Preço que você pagou' : 'Preço que você recebeu'} valor={preco} onMudar={setPremio} /></div>
      </div>
      <button
        className="chip selected"
        style={{ alignSelf: 'flex-start' }}
        disabled={!podeAdicionar}
        onClick={() => escolhida && onAdicionar({ codigo: escolhida.codigo, lado, quantidade, premio: preco })}
      >
        + Adicionar esta perna
      </button>
    </div>
  )
}
