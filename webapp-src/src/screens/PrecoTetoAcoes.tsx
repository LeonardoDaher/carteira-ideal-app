import { useEffect, useMemo, useRef, useState } from 'react'
import { storage } from '../data/storage'
import { useArquivoDados } from '../data/useArquivoDados'
import { SNAPSHOT_ACOES_DIVIDENDOS } from '../data/snapshotAcoesDividendos'
import { buscarAcoes } from '../domain/acoes'
import type { AcaoBusca } from '../domain/acoes'
import { analisarFundamentos, ROTULO_RECOMENDACAO } from '../domain/analiseFundamentalista'
import type { SnapshotFundamentos } from '../domain/analiseFundamentalista'
import { calcularPrecoTeto, TAXA_BAZIN_PADRAO, tickersParaAvisar } from '../domain/precoTeto'
import type { PrecoTeto, StatusTeto } from '../domain/precoTeto'
import { EstadoDoArquivo } from '../ui/BlocosDeAnalise'
import { CAMINHO_FUNDAMENTOS, premissasDoMercado } from './useAnaliseDaAcao'

const CHAVE = 'carteira-ideal:preco-teto'
const TAXAS = [0.06, 0.08, 0.1, 0.12]
const MAX_RADAR = 15
const AVISO =
  'Não é recomendação de investimento. O preço teto é uma conta simples feita com dados do passado: dividendos que já foram pagos e lucro e patrimônio já publicados. Ele não prevê o futuro, e o aviso só indica que o preço entrou numa faixa que você mesmo definiu como aceitável. Converse com um profissional certificado antes de investir.'

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const ROTULO_STATUS: Record<StatusTeto, string> = {
  'abaixo-do-teto': 'Abaixo do teto',
  vetado: 'Abaixo, mas sem aviso',
  perto: 'Perto do teto',
  aguardando: 'Acima do teto',
  'sem-teto': 'Sem teto',
}
const COR_STATUS: Record<StatusTeto, string> = {
  'abaixo-do-teto': 'var(--success)',
  vetado: 'var(--warning)',
  perto: 'var(--warning)',
  aguardando: 'var(--text-muted)',
  'sem-teto': 'var(--text-muted)',
}

interface Guardado {
  acompanhadas: string[]
  taxa: number
  avisados: string[]
  avisos: boolean
}

const PADRAO: Guardado = { acompanhadas: [], taxa: TAXA_BAZIN_PADRAO, avisados: [], avisos: false }

function lerGuardado(bruto: string | null): Guardado {
  if (!bruto) return PADRAO
  try {
    const o = JSON.parse(bruto) as Partial<Guardado>
    return {
      acompanhadas: Array.isArray(o.acompanhadas) ? o.acompanhadas.filter((t): t is string => typeof t === 'string').slice(0, 60) : [],
      taxa: typeof o.taxa === 'number' && o.taxa > 0 && o.taxa <= 0.3 ? o.taxa : TAXA_BAZIN_PADRAO,
      avisados: Array.isArray(o.avisados) ? o.avisados.filter((t): t is string => typeof t === 'string') : [],
      avisos: o.avisos === true,
    }
  } catch {
    return PADRAO
  }
}

const suportaNotificacao = () => typeof Notification !== 'undefined'

/**
 * Aba "Preço teto de compra" (D125). Para cada ação acompanhada mostra o teto de Bazin (gatilho) e o de Graham (confirmação) ao lado do
 * valor justo da análise fundamentalista. O verde só acende quando o preço está abaixo do teto E a análise fundamentalista não objeta,
 * para as duas abas nunca darem veredictos opostos. Fase 1: o aviso vale com o app aberto (notificação do navegador, se permitida).
 */
export function PrecoTetoAcoes({
  busca, precoDe, nomeDe, fundamentos,
}: {
  busca: AcaoBusca[]
  precoDe: (ticker: string) => number | null
  nomeDe: (ticker: string) => string | null
  /** Só nos testes. */
  fundamentos?: SnapshotFundamentos
}) {
  const [f, recarregar] = useArquivoDados<SnapshotFundamentos>(CAMINHO_FUNDAMENTOS, true, fundamentos)
  const [guardado, setGuardado] = useState<Guardado>(PADRAO)
  const [lido, setLido] = useState(false)
  const [termo, setTermo] = useState('')
  const [permissao, setPermissao] = useState<string>(suportaNotificacao() ? Notification.permission : 'unsupported')
  const [avisosNaTela, setAvisosNaTela] = useState<string[]>([])
  const guardadoRef = useRef(guardado)
  guardadoRef.current = guardado

  useEffect(() => {
    let vivo = true
    storage.getItem(CHAVE).then((b) => {
      if (!vivo) return
      setGuardado(lerGuardado(b))
      setLido(true)
    })
    return () => {
      vivo = false
    }
  }, [])

  const atualizar = (mudanca: Partial<Guardado>) => {
    const novo = { ...guardadoRef.current, ...mudanca }
    setGuardado(novo)
    void storage.setItem(CHAVE, JSON.stringify(novo))
  }

  const itens = useMemo(() => {
    if (f.tipo !== 'pronto') return null
    const premissas = premissasDoMercado()
    const todas = Object.values(f.dados.empresas)
    const mapa = new Map<string, PrecoTeto>()
    for (const empresa of todas) {
      const preco = precoDe(empresa.ticker)
      if (preco === null) continue
      const analise = analisarFundamentos({
        empresa, precoDe, todas, premissas, dyB3: SNAPSHOT_ACOES_DIVIDENDOS.dyPorTicker?.[empresa.ticker] ?? null,
      })
      if (!analise) continue
      mapa.set(empresa.ticker, calcularPrecoTeto({ empresa, analise, preco, dyB3: SNAPSHOT_ACOES_DIVIDENDOS.dyPorTicker?.[empresa.ticker] ?? null, taxaBazin: guardado.taxa }))
    }
    return mapa
  }, [f, precoDe, guardado.taxa])

  const acompanhados = useMemo(() => (itens ? guardado.acompanhadas.map((t) => ({ ticker: t, item: itens.get(t) ?? null })) : []), [itens, guardado.acompanhadas])
  const radar = useMemo(
    () => (itens ? [...itens.values()].filter((i) => i.status === 'abaixo-do-teto').sort((a, b) => (a.distanciaPct ?? 0) - (b.distanciaPct ?? 0)) : []),
    [itens],
  )

  // Aviso: quem acabou de entrar abaixo do teto entre as acompanhadas.
  useEffect(() => {
    if (!itens || !lido) return
    const atuais = acompanhados.map((a) => a.item).filter((i): i is PrecoTeto => i !== null)
    const r = tickersParaAvisar(atuais, guardadoRef.current.avisados)
    if (r.avisados.join() === guardadoRef.current.avisados.join() && r.avisar.length === 0) return
    setAvisosNaTela(r.avisar)
    if (guardadoRef.current.avisos && suportaNotificacao() && Notification.permission === 'granted') {
      for (const t of r.avisar) {
        const i = itens.get(t)
        try {
          new Notification(`${t} abaixo do preço teto`, { body: i ? `${i.mensagem}${i.ressalva ? ` Atenção: ${i.ressalva}.` : ''}` : 'O preço entrou abaixo do teto.', tag: `preco-teto-${t}` })
        } catch {
          // alguns navegadores móveis só aceitam notificação por service worker; o aviso na tela continua valendo
        }
      }
    }
    atualizar({ avisados: r.avisados })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, acompanhados, lido])

  const ativarAvisos = async () => {
    if (!suportaNotificacao()) return
    let p: string = Notification.permission
    if (p === 'default') p = await Notification.requestPermission()
    setPermissao(p)
    atualizar({ avisos: p === 'granted' })
  }

  const resultados = buscarAcoes(busca, termo).filter((b) => !guardado.acompanhadas.includes(b.ticker))
  const adicionar = (t: string) => {
    atualizar({ acompanhadas: [...guardado.acompanhadas, t].slice(0, 60) })
    setTermo('')
  }

  if (f.tipo === 'erro') return <EstadoDoArquivo estado="erro" nome="os fundamentos da CVM" aoTentarDeNovo={recarregar} />
  if (!itens) return <EstadoDoArquivo estado="carregando" nome="os fundamentos da CVM" aoTentarDeNovo={() => {}} />

  return (
    <div className="col" style={{ gap: 14 }} data-testid="preco-teto">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Preço teto de compra</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          O preço teto é o máximo que você aceita pagar por uma ação. Aqui o gatilho é o método de <strong>Bazin</strong> (dividendo médio ÷ retorno mínimo
          exigido) e o de <strong>Graham</strong> (lucro e patrimônio) confirma. O verde só acende se a <strong>análise fundamentalista</strong> também não
          objetar ao preço, para as duas abas não se contradizerem.
        </div>
      </div>

      <div className="card col" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Retorno mínimo em dividendos (Bazin)</span>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Retorno mínimo em dividendos">
          {TAXAS.map((t) => (
            <button key={t} className={`chip ${guardado.taxa === t ? 'selected' : ''}`} aria-pressed={guardado.taxa === t} onClick={() => atualizar({ taxa: t })}>
              {(t * 100).toLocaleString('pt-BR')}%{t === TAXA_BAZIN_PADRAO ? ' (clássico)' : ''}
            </button>
          ))}
        </div>
        <span className="tiny muted justify">Com a Selic alta, 6% deixa muita ação abaixo do teto. Suba a taxa para um teto mais exigente.</span>
      </div>

      <div className="card col" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Avisos</span>
        {permissao === 'unsupported' ? (
          <span className="tiny muted justify">Este navegador não permite notificações. O aviso aparece aqui na tela quando você abrir a aba.</span>
        ) : permissao === 'denied' ? (
          <span className="tiny muted justify">As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber o aviso; enquanto isso, ele aparece aqui na tela.</span>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={guardado.avisos ? () => atualizar({ avisos: false }) : ativarAvisos}>
              {guardado.avisos ? 'Desativar notificações' : 'Ativar notificações'}
            </button>
            <span className="tiny muted justify">
              Por enquanto o aviso chega quando você abre o app. O aviso com o app fechado, direto no celular, é a próxima etapa.
            </span>
          </>
        )}
      </div>

      {avisosNaTela.length > 0 && (
        <div className="card col" style={{ gap: 4, borderColor: 'var(--success)' }} role="status" data-testid="aviso-preco-teto">
          <span style={{ fontWeight: 700, color: 'var(--success)' }}>Entrou abaixo do preço teto: {avisosNaTela.join(', ')}</span>
        </div>
      )}

      <div className="col" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Ações que você acompanha</span>
        <input
          type="search"
          className="busca-fii"
          placeholder="Adicionar ação: código ou nome, ex.: BBAS3"
          aria-label="Adicionar ação ao radar de preço teto"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={termo}
          onChange={(e) => setTermo(e.target.value.slice(0, 40))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && resultados[0]) {
              e.preventDefault()
              adicionar(resultados[0].ticker)
            }
          }}
        />
        {termo.trim().length >= 2 && resultados.length > 0 && (
          <ul className="resultados-busca" aria-label="Ações encontradas">
            {resultados.map((b) => (
              <li key={b.ticker}>
                <button className="resultado-busca" onClick={() => adicionar(b.ticker)}>
                  <span style={{ fontWeight: 700 }}>{b.ticker}</span>
                  <span className="tiny muted resultado-nome">{b.nome ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {acompanhados.length === 0 ? (
          <div className="card small muted justify">Nenhuma ação acompanhada ainda. Busque um código acima para ver o teto e receber o aviso.</div>
        ) : (
          acompanhados.map(({ ticker, item }) => (
            <CartaoTeto key={ticker} ticker={ticker} nome={nomeDe(ticker)} item={item} aoRemover={() => atualizar({ acompanhadas: guardado.acompanhadas.filter((t) => t !== ticker), avisados: guardado.avisados.filter((t) => t !== ticker) })} />
          ))
        )}
      </div>

      <div className="col" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>Radar: hoje abaixo do preço teto</span>
        <span className="tiny muted justify">
          Ações do cadastro com preço abaixo do teto e sem objeção da análise fundamentalista, das mais folgadas para as menos ({radar.length} no total).
        </span>
        {radar.length === 0 ? (
          <div className="card small muted">Nenhuma ação passa nos dois testes com a taxa escolhida.</div>
        ) : (
          radar.slice(0, MAX_RADAR).map((i) => (
            <CartaoTeto key={i.ticker} ticker={i.ticker} nome={nomeDe(i.ticker)} item={i} aoAcompanhar={guardado.acompanhadas.includes(i.ticker) ? undefined : () => adicionar(i.ticker)} />
          ))
        )}
      </div>

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">{AVISO}</div>
    </div>
  )
}

function CartaoTeto({ ticker, nome, item, aoRemover, aoAcompanhar }: { ticker: string; nome: string | null; item: PrecoTeto | null; aoRemover?: () => void; aoAcompanhar?: () => void }) {
  const status: StatusTeto = item?.status ?? 'sem-teto'
  const verde = status === 'abaixo-do-teto'
  return (
    <div className="card col" style={{ gap: 8, borderColor: verde ? 'var(--success)' : undefined, background: verde ? 'color-mix(in oklch, var(--success) 10%, var(--surface))' : undefined }} data-testid={`teto-${ticker}`} data-status={status}>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div className="col" style={{ gap: 2 }}>
          <span style={{ fontWeight: 700 }}>{ticker}</span>
          <span className="tiny muted">{nome ?? item?.nome ?? ''}</span>
        </div>
        <span className="badge" style={{ color: COR_STATUS[status], background: `color-mix(in oklch, ${COR_STATUS[status]} 20%, transparent)` }}>
          {verde ? '● ' : ''}{ROTULO_STATUS[status]}
        </span>
      </div>
      {item?.ressalva && (
        <div className="small" style={{ color: 'var(--warning)', fontWeight: 700 }} data-testid={`ressalva-${ticker}`}>
          ⚠ Com ressalva: {item.ressalva}.
        </div>
      )}
      {item ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Numero titulo="Preço" valor={reais(item.preco)} />
            <Numero titulo={`Teto Bazin${item.bazin.curto ? ' (hist. curto)' : ''}`} valor={item.bazin.teto !== null ? reais(item.bazin.teto) : 'não se aplica'} />
            <Numero titulo={`Teto Graham${item.grahamConfirma ? ' ✓' : ''}`} valor={item.graham.teto !== null ? reais(item.graham.teto) : 'não se aplica'} />
            <Numero titulo="Valor justo (fundamentalista)" valor={item.valorJustoBase !== null ? reais(item.valorJustoBase) : 'sem cálculo'} />
          </div>
          <span className="tiny muted" data-testid={`leitura-fund-${ticker}`}>Leitura final da análise fundamentalista: <strong>{ROTULO_RECOMENDACAO[item.recomendacaoFund]}</strong></span>
          <span className="small justify" style={{ lineHeight: 1.5 }}>{item.mensagem}</span>
          {item.objecoes.length > 0 && (
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              {item.objecoes.map((o) => <li key={o}>{o}</li>)}
            </ul>
          )}
          <details>
            <summary className="tiny muted" style={{ cursor: 'pointer' }}>Como o teto foi calculado</summary>
            <div className="tiny muted justify" style={{ lineHeight: 1.5, marginTop: 6 }}>
              <div><strong>Bazin:</strong> {item.bazin.conta ?? item.bazin.observacao}</div>
              {item.bazin.conta && item.bazin.observacao && <div>{item.bazin.observacao}</div>}
              {item.bazin.porExercicio.length > 0 && (
                <div data-testid={`dividendos-${ticker}`}>
                  Dividendo por ação em cada exercício: {item.bazin.porExercicio.map((e) => `${e.ano}: ${reais(e.valor)}`).join(' · ')}.
                </div>
              )}
              {item.bazin.dy12m !== null && (
                <div>
                  Dividend yield dos últimos 12 meses (B3): {(item.bazin.dy12m * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ({reais(item.bazin.dy12m * item.preco)} por ação).
                </div>
              )}
              {item.bazin.tetoRecente !== null && (
                <div data-testid={`teto-recente-${ticker}`}>
                  Teto de Bazin com o dividendo dos últimos 12 meses no lugar da média: {reais(item.bazin.tetoRecente)}. Só informação: não muda o aviso.
                </div>
              )}
              {item.bazin.recenteMenor && (
                <div style={{ color: 'var(--warning)', fontWeight: 700 }}>
                  Os últimos 12 meses pagaram menos de 70% da média dos exercícios, então o teto pela média pode estar inflado por anos melhores.
                </div>
              )}
              <div style={{ marginTop: 4 }}><strong>Graham:</strong> {item.graham.conta ?? item.graham.observacao}</div>
              {item.graham.conta && item.graham.observacao && <div>{item.graham.observacao}</div>}
            </div>
          </details>
        </>
      ) : (
        <span className="small muted justify">Sem análise fundamentalista para este código (fora do cadastro de fundamentos), então não há preço teto.</span>
      )}
      <div className="row" style={{ gap: 8 }}>
        {aoAcompanhar && <button className="btn btn-secondary" onClick={aoAcompanhar}>Acompanhar</button>}
        {aoRemover && <button className="btn btn-secondary" onClick={aoRemover} aria-label={`Parar de acompanhar ${ticker}`}>Remover</button>}
      </div>
    </div>
  )
}

function Numero({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="col" style={{ gap: 2, padding: '8px 10px', borderRadius: 10, background: 'var(--surface2)' }}>
      <span className="tiny muted">{titulo}</span>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{valor}</span>
    </div>
  )
}
