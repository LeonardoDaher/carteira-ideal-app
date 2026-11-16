import { useEffect, useMemo, useRef, useState } from 'react'
import { storage } from '../data/storage'
import { registrarEvento } from '../data/analytics'
import { ativarPush, desativarPush, pushLigado, sincronizarPush } from '../data/pushPreco'
import { useArquivoDados } from '../data/useArquivoDados'
import { SNAPSHOT_ACOES_DIVIDENDOS } from '../data/snapshotAcoesDividendos'
import { buscarAcoes } from '../domain/acoes'
import type { AcaoBusca, GrupoAcoes } from '../domain/acoes'
import { ROTULO_RECOMENDACAO } from '../domain/analiseFundamentalista'
import type { SnapshotFundamentos } from '../domain/analiseFundamentalista'
import { TAXA_BAZIN_PADRAO, tickersParaAvisar } from '../domain/precoTeto'
import { aprovadasNos3Filtros, calcularItensPrecoTeto, textoDoAviso } from '../domain/precoTetoLote'
import type { PrecoTeto, StatusTeto } from '../domain/precoTeto'
import { baseDoBalanco } from '../domain/baseDoBalanco'
import { EstadoDoArquivo, SeloDaBase } from '../ui/BlocosDeAnalise'
import { CAMINHO_FUNDAMENTOS, premissasDoMercado } from './useAnaliseDaAcao'
import { LogoAtivo } from '../ui/LogoAtivo'

const CHAVE = 'carteira-ideal:preco-teto'
const TAXAS = [0.06, 0.08, 0.1, 0.12]
/** Aviso no celular com o app fechado (D127). Pausado por decisão do responsável: o código fica pronto, mas a opção não aparece. */
const AVISO_NO_CELULAR = false
const AVISO =
  'Não é recomendação de investimento. O preço teto é uma conta simples feita com dados do passado: dividendos que já foram pagos e lucro e patrimônio já publicados. Ele não prevê o futuro, e o aviso só indica que o preço entrou numa faixa que você mesmo definiu como aceitável. Converse com um profissional certificado antes de investir.'

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const ROTULO_STATUS: Record<StatusTeto, string> = {
  'abaixo-do-teto': 'Abaixo do teto',
  vetado: 'Abaixo, Graham não confirma',
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
  /** Aviso com o app fechado (push) ligado neste aparelho. */
  push: boolean
}

const PADRAO: Guardado = { acompanhadas: [], taxa: TAXA_BAZIN_PADRAO, avisados: [], avisos: false, push: false }

function lerGuardado(bruto: string | null): Guardado {
  if (!bruto) return PADRAO
  try {
    const o = JSON.parse(bruto) as Partial<Guardado>
    return {
      acompanhadas: Array.isArray(o.acompanhadas) ? o.acompanhadas.filter((t): t is string => typeof t === 'string').slice(0, 60) : [],
      taxa: typeof o.taxa === 'number' && o.taxa > 0 && o.taxa <= 0.3 ? o.taxa : TAXA_BAZIN_PADRAO,
      avisados: Array.isArray(o.avisados) ? o.avisados.filter((t): t is string => typeof t === 'string') : [],
      avisos: o.avisos === true,
      push: o.push === true,
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
  busca, precoDe, nomeDe, fundamentos, grupos = [],
}: {
  busca: AcaoBusca[]
  /** Setores da B3 do cadastro, agrupados (os mesmos da aba Simulador), para o filtro por setor. */
  grupos?: GrupoAcoes[]
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
  const [pushOn, setPushOn] = useState(false)
  const [pushOcupado, setPushOcupado] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)
  const [soAprovadas, setSoAprovadas] = useState(false)
  const listaRef = useRef<HTMLDivElement>(null)
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

  // Confere se este aparelho ainda tem a inscrição de aviso (o navegador pode tê-la descartado).
  useEffect(() => {
    if (!lido || !guardado.push) return
    let vivo = true
    void pushLigado().then((ligado) => {
      if (!vivo) return
      setPushOn(ligado)
      if (!ligado) atualizar({ push: false })
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lido])

  // Com o aviso ligado, a lista e a taxa acompanham o servidor (pequena espera para juntar vários cliques).
  useEffect(() => {
    if (!lido || !pushOn) return
    const espera = setTimeout(() => void sincronizarPush({ tickers: guardado.acompanhadas, taxa: guardado.taxa, avisados: guardado.avisados }), 800)
    return () => clearTimeout(espera)
  }, [lido, pushOn, guardado.acompanhadas, guardado.taxa, guardado.avisados])

  const alternarPush = async () => {
    setPushMsg(null)
    setPushOcupado(true)
    try {
      if (pushOn) {
        await desativarPush()
        setPushOn(false)
        atualizar({ push: false })
        return
      }
      const r = await ativarPush({ tickers: guardado.acompanhadas, taxa: guardado.taxa, avisados: guardado.avisados })
      if (r === 'ligado') {
        setPushOn(true)
        atualizar({ push: true })
        void registrarEvento('alerta_ativado')
        return
      }
      setPushMsg(
        r === 'negado' ? 'As notificações estão bloqueadas neste navegador. Libere nas configurações do site e tente de novo.'
        : r === 'precisa-instalar' ? 'No iPhone, instale o app primeiro: toque em Compartilhar, depois em Adicionar à Tela de Início, abra o app por lá e volte a esta aba.'
        : r === 'indisponivel' ? 'O aviso com o app fechado ainda não está disponível neste navegador ou neste momento.'
        : 'Não foi possível ligar agora. Tente de novo em alguns minutos.',
      )
    } finally {
      setPushOcupado(false)
    }
  }

  const atualizar = (mudanca: Partial<Guardado>) => {
    const novo = { ...guardadoRef.current, ...mudanca }
    setGuardado(novo)
    void storage.setItem(CHAVE, JSON.stringify(novo))
  }

  const itens = useMemo(() => {
    if (f.tipo !== 'pronto') return null
    return calcularItensPrecoTeto({ fundamentos: f.dados, precoDe, premissas: premissasDoMercado(), dyDe: (t) => SNAPSHOT_ACOES_DIVIDENDOS.dyPorTicker?.[t] ?? null, taxa: guardado.taxa })
  }, [f, precoDe, guardado.taxa])

  const acompanhados = useMemo(() => (itens ? guardado.acompanhadas.map((t) => ({ ticker: t, item: itens.get(t) ?? null })) : []), [itens, guardado.acompanhadas])
  // Aviso: quem acabou de entrar abaixo do teto entre as acompanhadas.
  useEffect(() => {
    if (!itens || !lido) return
    const atuais = acompanhados.map((a) => a.item).filter((i): i is PrecoTeto => i !== null)
    const r = tickersParaAvisar(atuais, guardadoRef.current.avisados)
    if (r.avisados.join() === guardadoRef.current.avisados.join() && r.avisar.length === 0) return
    setAvisosNaTela(r.avisar)
    if (guardadoRef.current.avisos && !guardadoRef.current.push && suportaNotificacao() && Notification.permission === 'granted') {
      for (const t of r.avisar) {
        const i = itens.get(t)
        try {
          new Notification(i ? textoDoAviso(i).titulo : `${t} abaixo do preço teto`, { body: i ? textoDoAviso(i).corpo : 'O preço entrou abaixo do teto.', tag: `preco-teto-${t}` })
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
          O preço teto é o máximo que você aceita pagar por uma ação. O gatilho é o método de <strong>Bazin</strong> (dividendo por ação ÷ retorno
          mínimo exigido) e o de <strong>Graham</strong> (lucro e patrimônio) confirma. Fica <strong>verde</strong> a ação com o preço abaixo desses tetos.
          A <strong>análise fundamentalista</strong> é outra pergunta (a empresa é boa? o valor justo é confiável?) e aparece ao lado, como um selo:
          ela não muda o verde, mas vale olhar as duas leituras.
        </div>
      </div>

      <CardAprovadas ativo={soAprovadas} aoAlternar={() => { setSoAprovadas((v) => !v); setTimeout(() => listaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }} />

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
              Esta notificação chega quando você abre o app.
            </span>
          </>
        )}
        {AVISO_NO_CELULAR && permissao !== 'unsupported' && (
          <div className="col" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 8 }} data-testid="aviso-push">
            <span style={{ fontWeight: 700, fontSize: 13 }}>Aviso no celular, com o app fechado</span>
            <button className="btn btn-secondary" disabled={pushOcupado} onClick={() => void alternarPush()}>
              {pushOcupado ? 'Aguarde…' : pushOn ? 'Desligar aviso no celular' : 'Ligar aviso no celular'}
            </button>
            {pushMsg && <span className="tiny" style={{ color: 'var(--warning)' }} role="status">{pushMsg}</span>}
            <span className="tiny muted justify">
              {pushOn
                ? 'Ligado. Quando uma ação que você acompanha entrar abaixo do teto, com a análise fundamentalista de acordo, o aviso chega no fim do dia, depois do fechamento. Para isso, o servidor guarda só o código das ações acompanhadas, a taxa escolhida e o endereço de entrega do aviso deste aparelho, e apaga tudo se você desligar ou ficar 90 dias sem abrir o app. No iPhone vale só com o app instalado na tela inicial.'
                : 'Ao ligar, o servidor passa a guardar só o código das ações que você acompanha, a taxa escolhida e o endereço de entrega do aviso deste aparelho, sem nome nem e-mail. Você pode desligar quando quiser. No iPhone, instale o app na tela inicial antes.'}
            </span>
          </div>
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

      <ListaTodas soAprovadas={soAprovadas} listaRef={listaRef} itens={itens} grupos={grupos} nomeDe={nomeDe} aoAcompanhar={(ticker) => adicionar(ticker)} acompanhadas={guardado.acompanhadas} />

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">{AVISO}</div>
    </div>
  )
}

const AMARELO = '#e8cb00'

/**
 * Card amarelo "Ações aprovadas nos 3 filtros": só o título. Ao tocar, a lista "Todas as ações" lá embaixo passa a mostrar apenas as
 * aprovadas (verdes, com a análise fundamentalista concordando); tocar de novo volta a lista completa.
 */
function CardAprovadas({ ativo, aoAlternar }: { ativo: boolean; aoAlternar: () => void }) {
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-pressed={ativo}
      data-testid="aprovadas-3-filtros"
      style={{
        width: '100%', padding: '18px 16px', borderRadius: 14, border: ativo ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer',
        background: AMARELO, color: '#14110a', fontWeight: 700, fontSize: 16, textAlign: 'center',
      }}
    >
      Ações aprovadas nos 3 filtros
    </button>
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
          <SeloDaBase base={item.baseBalanco ? baseDoBalanco(item.baseBalanco.dataBase) : null} id={item.ticker} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <Numero titulo="Preço" valor={reais(item.preco)} />
            <Numero titulo={`Teto Bazin${item.bazin.curto ? ' (hist. curto)' : ''}`} valor={item.bazin.teto !== null ? reais(item.bazin.teto) : 'não se aplica'} />
            <Numero titulo={`Teto Graham${item.grahamConfirma ? ' ✓' : ''}`} valor={item.graham.teto !== null ? reais(item.graham.teto) : 'não se aplica'} />
            <Numero titulo="Valor justo (fundamentalista)" valor={item.valorJustoBase !== null ? reais(item.valorJustoBase) : 'sem cálculo'} />
          </div>
          <Selo item={item} detalhe />
          <span className="small justify" style={{ lineHeight: 1.5 }}>{item.mensagem}</span>
          <FaltaCair item={item} />
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
              {item.bazin.tetoRecente !== null && item.bazin.teto !== null && Math.abs(item.bazin.tetoRecente - item.bazin.teto) > 0.005 && (
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

const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`

/**
 * Lista fininha de TODAS as ações do cadastro, em ordem alfabética, com o preço, o preço teto, a distância até ele e o selo da análise
 * fundamentalista. Só as que estão abaixo dos tetos de Bazin e Graham ficam em verde; as demais mostram o teto sem destaque. Tocar numa linha abre o cartão.
 */
function ListaTodas({ soAprovadas, listaRef, itens, grupos, nomeDe, aoAcompanhar, acompanhadas }: { soAprovadas: boolean; listaRef: React.RefObject<HTMLDivElement | null>; itens: Map<string, PrecoTeto>; grupos: GrupoAcoes[]; nomeDe: (t: string) => string | null; aoAcompanhar: (t: string) => void; acompanhadas: string[] }) {
  const [filtro, setFiltro] = useState('')
  // Setor escolhido: 'g:Grupo' (todo o grande setor da B3) ou 's:Setor' (um setor dentro dele); vazio = todos.
  const [setorEscolhido, setSetorEscolhido] = useState('')
  const [aberta, setAberta] = useState<string | null>(null)
  const doSetor = useMemo(() => {
    if (!setorEscolhido) return null
    const [tipo, nome] = [setorEscolhido.slice(0, 1), setorEscolhido.slice(2)]
    const conjunto = new Set<string>()
    for (const g of grupos) for (const s of g.setores) if ((tipo === 'g' && g.grupo === nome) || (tipo === 's' && s.setor === nome)) for (const e of s.empresas) conjunto.add(e.ticker)
    return conjunto
  }, [setorEscolhido, grupos])
  const aprovadas = useMemo(() => new Set(aprovadasNos3Filtros(itens.values()).map((i) => i.ticker)), [itens])
  const linhas = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return [...itens.values()]
      .filter((i) => !soAprovadas || aprovadas.has(i.ticker))
      .filter((i) => !doSetor || doSetor.has(i.ticker))
      .filter((i) => !q || i.ticker.toLowerCase().includes(q) || (nomeDe(i.ticker) ?? i.nome ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.ticker.localeCompare(b.ticker))
  }, [itens, filtro, nomeDe, doSetor, soAprovadas, aprovadas])
  const verdes = useMemo(() => [...itens.values()].filter((i) => i.status === 'abaixo-do-teto').length, [itens])
  return (
    <div className="col" style={{ gap: 8 }} data-testid="lista-todas" ref={listaRef}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>{soAprovadas ? 'Ações aprovadas nos 3 filtros' : doSetor ? 'Ações do setor' : 'Todas as ações'} ({soAprovadas || doSetor || filtro.trim() ? linhas.length : itens.size})</span>
      <span className="tiny muted justify">
        O preço teto de cada ação do app, em ordem alfabética. Em verde, as {verdes} abaixo dos tetos de Bazin e Graham. O símbolo à direita é a leitura da análise fundamentalista: ✔ concorda, • neutra, ⚠ alerta.
      </span>
      {grupos.length > 0 && (
        <select className="busca-fii" aria-label="Filtrar por setor" value={setorEscolhido} onChange={(e) => { setSetorEscolhido(e.target.value); setAberta(null) }}>
          <option value="">Todos os setores</option>
          {grupos.map((g) => (
            <optgroup key={g.grupo} label={g.grupo}>
              <option value={`g:${g.grupo}`}>Todo o setor: {g.grupo} ({g.empresas})</option>
              {g.setores.map((s) => (
                <option key={s.setor} value={`s:${s.setor}`}>{s.setor} ({s.empresas.length})</option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
      <input type="search" className="busca-fii" placeholder="Filtrar: código ou nome" aria-label="Filtrar a lista de todas as ações" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={filtro} onChange={(e) => setFiltro(e.target.value.slice(0, 40))} />
      <div className="row tiny muted" style={{ padding: '0 10px', gap: 8 }} aria-hidden="true">
        <span style={{ flex: '1 1 0' }}>Ação</span>
        <span style={{ width: 70, textAlign: 'right' }}>Preço</span>
        <span style={{ width: 70, textAlign: 'right' }}>Teto</span>
        <span style={{ width: 48, textAlign: 'right' }}>Dist.</span>
        <span style={{ width: 16 }} />
      </div>
      <ul className="col" style={{ gap: 2, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Todas as ações com preço teto">
        {linhas.map((i) => {
          const verde = i.status === 'abaixo-do-teto'
          const aberto = aberta === i.ticker
          return (
            <li key={i.ticker} data-testid={`linha-${i.ticker}`} data-status={i.status}>
              <button
                className="row"
                aria-expanded={aberto}
                onClick={() => setAberta(aberto ? null : i.ticker)}
                style={{
                  width: '100%', gap: 8, alignItems: 'center', textAlign: 'left', padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', color: 'inherit',
                  borderLeft: `3px solid ${verde ? 'var(--success)' : 'transparent'}`,
                  background: verde ? 'color-mix(in oklch, var(--success) 12%, var(--surface))' : 'var(--surface2)',
                }}
              >
                <span className="col" style={{ flex: '1 1 0', minWidth: 0, gap: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: verde ? 'var(--success)' : undefined }}><LogoAtivo ticker={i.ticker} tamanho={24} inline />{i.ticker}</span>
                  <span className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeDe(i.ticker) ?? i.nome}</span>
                </span>
                <span style={{ width: 70, textAlign: 'right', fontSize: 13 }}>{reais(i.preco)}</span>
                <span style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: verde ? 700 : 400 }}>{i.tetoGatilho !== null ? reais(i.tetoGatilho) : '—'}</span>
                <span className="tiny" style={{ width: 48, textAlign: 'right', color: verde ? 'var(--success)' : i.status === 'vetado' ? 'var(--warning)' : 'var(--text-muted)' }}>{i.distanciaPct !== null ? pct(i.distanciaPct) : '—'}</span>
                <Selo item={i} />
              </button>
              {aberto && <CartaoTeto ticker={i.ticker} nome={nomeDe(i.ticker)} item={i} aoAcompanhar={acompanhadas.includes(i.ticker) ? undefined : () => aoAcompanhar(i.ticker)} />}
            </li>
          )
        })}
      </ul>
      {linhas.length === 0 && <div className="card small muted">Nenhuma ação encontrada.</div>}
    </div>
  )
}

/** "Falta cair X%": distância até o preço em que a ação fica abaixo dos tetos de Bazin e de Graham. */
function FaltaCair({ item }: { item: PrecoTeto }) {
  if (!item.entrada) return null
  const { alvo, faltaCairPct, limitadoPor } = item.entrada
  return (
    <span className="small" style={{ fontWeight: 700 }} data-testid={`falta-cair-${item.ticker}`}>
      Falta cair {faltaCairPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% (até {reais(alvo)}) para ficar abaixo do teto
      <span className="tiny muted" style={{ fontWeight: 400 }}> · {limitadoPor === 'graham' ? 'trava: o teto de Graham' : 'trava: o teto de Bazin'}</span>
    </span>
  )
}

const SIMBOLO_SELO = { concorda: '✔', neutro: '•', alerta: '⚠' } as const
const COR_SELO = { concorda: 'var(--success)', neutro: 'var(--text-muted)', alerta: 'var(--warning)' } as const
const ROTULO_SELO = { concorda: 'Fundamentalista concorda', neutro: 'Fundamentalista: neutra', alerta: 'Fundamentalista: alerta' } as const

/** Selo da análise fundamentalista: só o símbolo na linha da lista; com `detalhe`, a leitura por extenso no cartão. */
function Selo({ item, detalhe = false }: { item: PrecoTeto; detalhe?: boolean }) {
  const { tipo, texto } = item.selo
  if (!detalhe) {
    return <span style={{ width: 16, textAlign: 'center', color: COR_SELO[tipo], fontSize: 12 }} title={texto} aria-label={`${ROTULO_SELO[tipo]}: ${ROTULO_RECOMENDACAO[item.recomendacaoFund]}`} data-testid={`selo-${item.ticker}`} data-selo={tipo}>{SIMBOLO_SELO[tipo]}</span>
  }
  return (
    <span className="small justify" style={{ color: COR_SELO[tipo], fontWeight: tipo === 'alerta' ? 700 : 400, lineHeight: 1.5 }} data-testid={`leitura-fund-${item.ticker}`} data-selo={tipo}>
      {SIMBOLO_SELO[tipo]} {texto}
    </span>
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
