import { useState } from 'react'
import { SNAPSHOT_FUTUROS } from '../data/snapshotFuturos'
import {
  ROTULO_LEITURA, analisarSerie, cenariosDePreco, curvaDI, dataVencimentoDI, diasUteisAproximados, moedaDe, puDI, resultadoDI,
  resultadoPosicao, resumoCurva, rotuloVencimento, taxaDoPU,
} from '../domain/futuros'
import type { ContratoFuturo, Lado, ProdutoFuturo, SnapshotFuturos } from '../domain/futuros'
import { formatarData } from '../domain/rendaFii'
import { VoltarInicio } from '../ui/VoltarInicio'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { AbasDaTela } from '../ui/AbasDaTela'
import type { AbaDaTela } from '../ui/AbasDaTela'
import { CampoNumero } from '../ui/CampoNumero'
import { GraficoCurvaDI } from '../ui/GraficoCurvaDI'
import { GraficoFuturo } from '../ui/GraficoFuturo'
import { rolarParaPainel } from '../ui/rolarParaResultado'
import type { AppCtx } from '../state/useAppState'

const JANELAS = [60, 120, 252] as const

type AbaFuturos = 'simulador' | 'tendencia' | 'curva'

const numero = (v: number, casas = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const casasDoTick = (tick: number) => (tick >= 1 ? 0 : tick >= 0.1 ? 1 : tick >= 0.01 ? 2 : 3)

/** Grupos na ordem em que aparecem nos dados, cada um com os seus produtos. */
function agruparPorGrupo(produtos: ProdutoFuturo[]) {
  const grupos: { grupo: string; produtos: ProdutoFuturo[] }[] = []
  for (const p of produtos) {
    const existente = grupos.find((g) => g.grupo === p.grupo)
    if (existente) existente.produtos.push(p)
    else grupos.push({ grupo: p.grupo, produtos: [p] })
  }
  return grupos
}

/**
 * Simule Futuros: contratos futuros da B3 (índice, dólar, juros e agro, cheios e minis). Abas: o simulador de resultado
 * (lucro ou prejuízo de uma posição, sobre a margem que a pessoa informa), a Tendência, com a análise gráfica do contínuo
 * (candles, médias, suporte e resistência) e, só no DI1, a curva de juros. Estritamente descritivo (D19): sem previsão,
 * sem recomendação de operar.
 */
export function SimuleFuturos({
  snapshot = SNAPSHOT_FUTUROS,
}: {
  /** Recebido como as demais telas avulsas; esta tela só volta ao hub. */
  ctx: AppCtx
  /** Permite injetar dados nos testes. No app, usa o arquivo gerado pelo job diário. */
  snapshot?: SnapshotFuturos
}) {
  const [codigo, setCodigo] = useState(snapshot.produtos[0]?.codigo)
  const [aba, setAba] = useState<AbaFuturos>('simulador')
  const produto = snapshot.produtos.find((p) => p.codigo === codigo) ?? snapshot.produtos[0]
  const grupos = agruparPorGrupo(snapshot.produtos)
  const abas: AbaDaTela<AbaFuturos>[] = [
    { id: 'simulador', emoji: '🧮', titulo: 'Simulador', descricao: 'Resultado e margem da posição' },
    { id: 'tendencia', emoji: '📈', titulo: 'Tendência', descricao: 'Análise gráfica do contínuo' },
    ...(produto?.tipo === 'taxa' ? [{ id: 'curva' as const, emoji: '〰️', titulo: 'Curva de juros', descricao: 'Taxa por vencimento' }] : []),
  ]
  // A aba da curva só existe no DI1: ao trocar de contrato, quem estava nela volta ao simulador.
  const abaAtiva: AbaFuturos = aba === 'curva' && produto?.tipo !== 'taxa' ? 'simulador' : aba

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleAtivos" rotulo="← Simule Ativos" />

      <div className="col" style={{ gap: 4 }}>
        <h1 style={{ fontSize: 21 }}>Simule Futuros</h1>
        <div className="muted small justify">
          Contratos futuros da B3, cheios e minis: índice, dólar, juros (DI) e agro (boi gordo, milho e café). Simule o
          resultado de uma posição e acompanhe a tendência do contrato no gráfico. Dados oficiais da B3, de fim de dia.
        </div>
      </div>

      {!produto ? (
        <div className="card col" style={{ gap: 6 }} role="status">
          <span style={{ fontWeight: 700 }}>Os dados dos futuros ainda não foram carregados.</span>
          <span className="muted small justify">
            Os preços de ajuste são atualizados nos dias úteis, depois do fechamento da B3. Volte mais tarde.
          </span>
        </div>
      ) : (
        <>
          <div className="col" style={{ gap: 14 }}>
            {grupos.map((g) => (
              <div key={g.grupo} className="col" style={{ gap: 8 }}>
                <h2 className="titulo-setor font-display">{g.grupo}</h2>
                <div className="grade-tickers" role="group" aria-label={`Contratos do grupo ${g.grupo}`}>
                  {g.produtos.map((p) => (
                    <button key={p.codigo} className={`chip ${p.codigo === produto.codigo ? 'selected' : ''}`} aria-pressed={p.codigo === produto.codigo} onClick={() => {
                      setCodigo(p.codigo)
                      rolarParaPainel('painel-futuros-aba')
                    }}>
                      {p.apelido}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="small muted justify" style={{ lineHeight: 1.5 }}>
              <strong>{produto.nome}</strong> ({produto.codigo}). {produto.especificacao}
            </div>
          </div>

          <AbasDaTela
            rolarAoTrocar
            prefixo="futuros"
            rotulo="O que você quer ver"
            ativa={abaAtiva}
            aoMudar={setAba}
            abas={abas}
          >
            {abaAtiva === 'simulador' ? (
              <Simulador key={produto.codigo} produto={produto} dataPregao={snapshot.dataPregao} />
            ) : abaAtiva === 'tendencia' ? (
              <Tendencia key={produto.codigo} produto={produto} />
            ) : (
              <CurvaDeJuros key={produto.codigo} produto={produto} dataPregao={snapshot.dataPregao} />
            )}
          </AbasDaTela>
        </>
      )}

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Futuros alavancam o resultado, para cima e para baixo: o prejuízo pode passar da margem depositada.</strong> A
        simulação é bruta: não inclui corretagem, emolumentos, imposto de renda (15% sobre o ganho, 20% em day trade, pago pelo
        investidor) nem o custo de oportunidade da margem, e a margem exigida muda conforme a corretora e a volatilidade. O que
        está aqui descreve o passado e não indica compra ou venda.
        {snapshot.geradoEm ? ` Dados oficiais da B3 (Boletim de Preços), atualizados em ${formatarData(snapshot.geradoEm)}.` : ''}
      </div>

      <AvisoEducacional />
    </div>
  )
}

function Simulador({ produto, dataPregao }: { produto: ProdutoFuturo; dataPregao: string | null }) {
  const padrao = escolherContratoPadrao(produto)
  const [ticker, setTicker] = useState(padrao?.ticker)
  const contrato = produto.contratos.find((c) => c.ticker === ticker) ?? padrao

  if (!contrato) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Sem vencimentos disponíveis para {produto.apelido}.</span>
      </div>
    )
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="col" style={{ gap: 6 }}>
        <label htmlFor="futuros-vencimento" className="small" style={{ fontWeight: 600 }}>Vencimento</label>
        <select id="futuros-vencimento" className="input-cotas" value={contrato.ticker} onChange={(e) => setTicker(e.target.value)} style={{ padding: '10px 12px', fontSize: 16 }}>
          {produto.contratos.map((c) => (
            <option key={c.ticker} value={c.ticker}>
              {c.ticker} · {rotuloVencimento(c.vencimento)}{c.ticker === produto.vertice ? ' · mais líquido' : ''}
            </option>
          ))}
        </select>
      </div>

      {produto.tipo === 'taxa' ? (
        <SimuladorDI key={contrato.ticker} produto={produto} contrato={contrato} dataPregao={dataPregao} />
      ) : (
        <SimuladorPreco key={contrato.ticker} produto={produto} contrato={contrato} />
      )}

      <TabelaVencimentos produto={produto} />
    </div>
  )
}

/** Vencimento de maior posição em aberto; se não houver, o primeiro. */
function escolherContratoPadrao(produto: ProdutoFuturo): ContratoFuturo | undefined {
  return produto.contratos.find((c) => c.ticker === produto.vertice) ?? produto.contratos[0]
}

function EscolhaLado({ lado, aoMudar }: { lado: Lado; aoMudar: (l: Lado) => void }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <span className="small" style={{ fontWeight: 600 }}>Posição</span>
      <div className="grade-tickers" role="group" aria-label="Posição">
        <button className={`chip ${lado === 'compra' ? 'selected' : ''}`} aria-pressed={lado === 'compra'} onClick={() => aoMudar('compra')}>Comprado</button>
        <button className={`chip ${lado === 'venda' ? 'selected' : ''}`} aria-pressed={lado === 'venda'} onClick={() => aoMudar('venda')}>Vendido</button>
      </div>
    </div>
  )
}

function SimuladorPreco({ produto, contrato }: { produto: ProdutoFuturo; contrato: ContratoFuturo }) {
  const casas = Math.max(casasDoTick(produto.tick), produto.tipo === 'preco' ? 2 : 0)
  const [lado, setLado] = useState<Lado>('compra')
  const [contratos, setContratos] = useState(1)
  const [entrada, setEntrada] = useState(contrato.ajuste)
  const [saida, setSaida] = useState(contrato.ajuste)
  const [margem, setMargem] = useState(0)
  const unidade = produto.tipo === 'pontos' ? 'pts' : produto.moeda === 'USD' ? 'US$' : 'R$'
  const r = resultadoPosicao({ lado, contratos, entrada, saida, multiplicador: produto.multiplicador, margemPorContrato: margem })
  const cenarios = cenariosDePreco(entrada, [-3, -2, -1, 1, 2, 3], produto.tick)

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="small muted justify">
        Ajuste de {contrato.ticker} no último pregão: <strong>{numero(contrato.ajuste, casas)} {unidade}</strong>
        {contrato.ajusteAnterior !== null && ` (anterior ${numero(contrato.ajusteAnterior, casas)})`}.
        {contrato.posicaoAberta !== null && ` Posição em aberto: ${contrato.posicaoAberta.toLocaleString('pt-BR')} contratos.`}
      </div>
      <EscolhaLado lado={lado} aoMudar={setLado} />
      <div className="desk-split">
        <div className="desk-main col" style={{ gap: 12 }}>
          <CampoNumero rotulo="Preço de entrada" valor={entrada} onMudar={setEntrada} sufixo={unidade} casas={casas} />
          <CampoNumero rotulo="Preço de saída" valor={saida} onMudar={setSaida} sufixo={unidade} casas={casas} />
          <CampoNumero rotulo="Contratos" valor={contratos} onMudar={(v) => setContratos(Math.max(1, Math.round(v)))} casas={0} />
          <CampoNumero
            rotulo="Margem por contrato (opcional)"
            valor={margem}
            onMudar={setMargem}
            sufixo={produto.moeda === 'USD' ? 'US$' : 'R$'}
            dica="A B3 não publica a margem no boletim: pergunte à sua corretora e informe aqui para ver o resultado sobre a margem."
          />
        </div>
        <div className="desk-side col" style={{ gap: 12 }}>
          <div className="card col" style={{ gap: 6 }} role="status" aria-live="polite">
            <span className="small muted">Resultado bruto ({lado === 'compra' ? 'comprado' : 'vendido'}, {contratos} {contratos === 1 ? 'contrato' : 'contratos'})</span>
            <span className="font-display" style={{ fontSize: 26, fontWeight: 700, color: r.total >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {r.total > 0 ? '+' : ''}{moedaDe(produto, r.total)}
            </span>
            <span className="small muted">
              {r.porContrato > 0 ? '+' : ''}{numero(r.porContrato, casas)} {unidade} por contrato · preço {r.variacaoPct > 0 ? '+' : ''}{numero(r.variacaoPct)}%
            </span>
            {r.sobreMargemPct !== null ? (
              <span className="small">
                Sobre a margem de {moedaDe(produto, r.margemTotal)}: <strong>{r.sobreMargemPct > 0 ? '+' : ''}{numero(r.sobreMargemPct, 1)}%</strong>
              </span>
            ) : (
              <span className="small muted">Informe a margem para ver o resultado sobre ela.</span>
            )}
          </div>

          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>E se o preço variar?</span>
            <table className="small" style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr className="muted"><th align="left">Variação</th><th align="right">Saída</th><th align="right">Resultado</th></tr>
              </thead>
              <tbody>
                {cenarios.map((c) => {
                  const rc = resultadoPosicao({ lado, contratos, entrada, saida: c.preco, multiplicador: produto.multiplicador, margemPorContrato: margem })
                  return (
                    <tr key={c.pct} style={{ borderTop: '1px solid var(--border)' }}>
                      <td>{c.pct > 0 ? '+' : ''}{c.pct}%</td>
                      <td align="right">{numero(c.preco, casas)}</td>
                      <td align="right" style={{ color: rc.total >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {rc.total > 0 ? '+' : ''}{moedaDe(produto, rc.total)}
                        {rc.sobreMargemPct !== null && <span className="muted"> ({rc.sobreMargemPct > 0 ? '+' : ''}{numero(rc.sobreMargemPct, 0)}%)</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function SimuladorDI({ produto, contrato, dataPregao }: { produto: ProdutoFuturo; contrato: ContratoFuturo; dataPregao: string | null }) {
  const dias = dataPregao ? diasUteisAproximados(dataPregao, dataVencimentoDI(contrato.vencimento)) : 0
  const taxaAtual = contrato.ultimo ?? (dias > 0 ? taxaDoPU(contrato.ajuste, dias) : 0)
  const [lado, setLado] = useState<Lado>('compra')
  const [contratos, setContratos] = useState(1)
  const [taxaEntrada, setTaxaEntrada] = useState(Number(taxaAtual.toFixed(3)))
  const [taxaSaida, setTaxaSaida] = useState(Number(taxaAtual.toFixed(3)))
  const [diasNaPosicao, setDiasNaPosicao] = useState(Math.min(5, Math.max(dias - 1, 0)))
  const [margem, setMargem] = useState(0)

  if (dias < 2) {
    return <div className="card small muted" role="status">Este vencimento está perto demais para simular.</div>
  }
  const r = resultadoDI({ lado, contratos, taxaEntrada, taxaSaida, diasAteVencimento: dias, diasNaPosicao, margemPorContrato: margem })
  const cor = r.total >= 0 ? 'var(--success)' : 'var(--danger)'

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="small muted justify">
        {contrato.ticker} vence em {rotuloVencimento(contrato.vencimento)}, cerca de <strong>{dias} dias úteis</strong> (sem contar feriados). Taxa{' '}
        {contrato.ultimo !== null ? 'do último negócio' : 'implícita no ajuste'}: <strong>{numero(taxaAtual, 3)}% ao ano</strong>. PU de ajuste:{' '}
        {numero(contrato.ajuste)}.
      </div>
      <EscolhaLado lado={lado} aoMudar={setLado} />
      <div className="small muted justify" style={{ marginTop: -6 }}>
        Quem compra DI ganha se a taxa <strong>cai</strong>; quem vende ganha se a taxa <strong>sobe</strong>.
      </div>
      <div className="desk-split">
        <div className="desk-main col" style={{ gap: 12 }}>
          <CampoNumero rotulo="Taxa de entrada" valor={taxaEntrada} onMudar={setTaxaEntrada} sufixo="% a.a." casas={3} />
          <CampoNumero rotulo="Taxa de saída" valor={taxaSaida} onMudar={setTaxaSaida} sufixo="% a.a." casas={3} />
          <CampoNumero rotulo="Dias úteis na posição" valor={diasNaPosicao} onMudar={(v) => setDiasNaPosicao(Math.min(Math.round(v), dias - 1))} casas={0} dica={`Até ${dias - 1}.`} />
          <CampoNumero rotulo="Contratos" valor={contratos} onMudar={(v) => setContratos(Math.max(1, Math.round(v)))} casas={0} />
          <CampoNumero rotulo="Margem por contrato (opcional)" valor={margem} onMudar={setMargem} sufixo="R$" dica="Pergunte à sua corretora." />
        </div>
        <div className="desk-side col" style={{ gap: 12 }}>
          <div className="card col" style={{ gap: 6 }} role="status" aria-live="polite">
            <span className="small muted">Resultado bruto ({lado === 'compra' ? 'comprado' : 'vendido'}, {contratos} {contratos === 1 ? 'contrato' : 'contratos'})</span>
            <span className="font-display" style={{ fontSize: 26, fontWeight: 700, color: cor }}>
              {r.total > 0 ? '+' : ''}{moedaDe(produto, r.total)}
            </span>
            <span className="small muted">
              PU de {numero(r.puEntrada)} para {numero(r.puSaida)} · {r.porContrato > 0 ? '+' : ''}{numero(r.porContrato)} por contrato
            </span>
            {r.sobreMargemPct !== null ? (
              <span className="small">Sobre a margem de {moedaDe(produto, r.margemTotal)}: <strong>{r.sobreMargemPct > 0 ? '+' : ''}{numero(r.sobreMargemPct, 1)}%</strong></span>
            ) : (
              <span className="small muted">Informe a margem para ver o resultado sobre ela.</span>
            )}
          </div>
          <div className="small muted justify" style={{ lineHeight: 1.5 }}>
            Cada ponto-base (0,01) de variação na taxa muda o PU em cerca de{' '}
            {numero(Math.abs(puDI(taxaEntrada + 0.01, dias) - puDI(taxaEntrada, dias)))} reais por contrato. A conta é uma
            aproximação: a B3 acerta o ajuste todo dia, corrigido pelo CDI.
          </div>
        </div>
      </div>
    </div>
  )
}

function TabelaVencimentos({ produto }: { produto: ProdutoFuturo }) {
  const casas = produto.tipo === 'taxa' ? 2 : Math.max(casasDoTick(produto.tick), produto.tipo === 'preco' ? 2 : 0)
  return (
    <details className="card-outline">
      <summary className="small" style={{ fontWeight: 600, cursor: 'pointer' }}>Todos os vencimentos de {produto.apelido}</summary>
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table className="small" style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="muted">
              <th align="left">Contrato</th>
              <th align="right">{produto.tipo === 'taxa' ? 'PU de ajuste' : 'Ajuste'}</th>
              <th align="right">Dia</th>
              <th align="right">Em aberto</th>
            </tr>
          </thead>
          <tbody>
            {produto.contratos.map((c) => {
              const dif = c.ajusteAnterior !== null && c.ajusteAnterior > 0 ? (c.ajuste / c.ajusteAnterior - 1) * 100 : null
              return (
                <tr key={c.ticker} style={{ borderTop: '1px solid var(--border)' }}>
                  <td>{c.ticker} <span className="muted">{rotuloVencimento(c.vencimento)}</span></td>
                  <td align="right">{numero(c.ajuste, casas)}</td>
                  <td align="right" style={{ color: dif === null ? undefined : dif >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {dif === null ? '-' : `${dif > 0 ? '+' : ''}${numero(dif)}%`}
                  </td>
                  <td align="right">{c.posicaoAberta === null ? '-' : c.posicaoAberta.toLocaleString('pt-BR')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </details>
  )
}

/** Curva de juros do DI1: taxa de cada vencimento (do PU de ajuste do pregão) e taxa a termo entre vencimentos vizinhos. */
function CurvaDeJuros({ produto, dataPregao }: { produto: ProdutoFuturo; dataPregao: string | null }) {
  const curva = dataPregao ? curvaDI(produto.contratos, dataPregao) : []
  const resumo = resumoCurva(curva)

  if (curva.length < 3) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Vencimentos insuficientes para desenhar a curva.</span>
      </div>
    )
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="desk-split">
        <div className="desk-main col" style={{ gap: 10 }}>
          <span className="small" style={{ fontWeight: 600 }}>Curva do DI1 em {formatarData(dataPregao ?? '')}</span>
          <GraficoCurvaDI curva={curva} />
        </div>

        <div className="desk-side col" style={{ gap: 12 }}>
          {resumo && (
            <div className="card col" style={{ gap: 8 }}>
              <span className="small muted">Formato da curva</span>
              <span className="font-display" style={{ fontSize: 22, fontWeight: 700 }}>{resumo.formato[0].toUpperCase() + resumo.formato.slice(1)}</span>
              <span className="small" style={{ lineHeight: 1.5 }}>
                De {numero(resumo.curto.taxa, 3)}% em {rotuloVencimento(resumo.curto.vencimento)} para {numero(resumo.longo.taxa, 3)}% em{' '}
                {rotuloVencimento(resumo.longo.vencimento)}: {resumo.spread > 0 ? '+' : ''}{numero(resumo.spread)} ponto percentual entre o
                vencimento mais curto (a partir de 21 dias úteis) e o mais longo.
              </span>
            </div>
          )}
          <div className="small muted justify" style={{ lineHeight: 1.5 }}>
            A taxa de cada vencimento vem do preço de ajuste (PU) do pregão, o mesmo critério para todos, negociados ou não, por isso
            pode diferir em alguns centésimos do último negócio. A <strong>taxa a termo</strong> é a taxa que o mercado embute entre
            um vencimento e o anterior. A contagem de dias úteis considera os feriados nacionais, sem lei nova ou feriado extraordinário.
            É uma leitura do que o mercado precifica hoje, não uma previsão.
          </div>
        </div>
      </div>

      <details className="card-outline">
        <summary className="small" style={{ fontWeight: 600, cursor: 'pointer' }}>Taxa de cada vencimento</summary>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table className="small" style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="muted">
                <th align="left">Contrato</th>
                <th align="right">Dias úteis</th>
                <th align="right">Taxa</th>
                <th align="right">A termo</th>
                <th align="right">Último</th>
              </tr>
            </thead>
            <tbody>
              {curva.map((p) => (
                <tr key={p.ticker} style={{ borderTop: '1px solid var(--border)' }}>
                  <td>{p.ticker} <span className="muted">{rotuloVencimento(p.vencimento)}</span></td>
                  <td align="right">{p.diasUteis.toLocaleString('pt-BR')}</td>
                  <td align="right">{numero(p.taxa, 3)}%</td>
                  <td align="right">{p.taxaATermo === null ? '-' : `${numero(p.taxaATermo, 3)}%`}</td>
                  <td align="right">{p.taxaUltimo === null ? '-' : `${numero(p.taxaUltimo, 3)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

function Tendencia({ produto }: { produto: ProdutoFuturo }) {
  const [janela, setJanela] = useState<(typeof JANELAS)[number]>(120)
  const unidade = produto.tipo === 'taxa' ? 'taxa' : 'preco'
  const analise = analisarSerie(produto.serie, unidade)
  const casas = produto.tipo === 'taxa' ? 3 : Math.max(casasDoTick(produto.tick), produto.tipo === 'preco' ? 2 : 0)
  const corLeitura = analise?.leitura === 'alta' ? 'var(--success)' : analise?.leitura === 'baixa' ? 'var(--danger)' : 'var(--warning)'

  if (!analise) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Histórico ainda curto para {produto.apelido}.</span>
        <span className="muted small justify">
          São {produto.serie.length} candles; a leitura precisa de pelo menos 80. O histórico cresce um candle por pregão.
        </span>
      </div>
    )
  }

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="desk-split">
        <div className="desk-main col" style={{ gap: 10 }}>
          <div className="col" style={{ gap: 4 }}>
            <span className="small" style={{ fontWeight: 600 }}>
              {produto.apelido} · {produto.tipo === 'taxa' ? 'taxa do vencimento mais líquido' : 'contínuo, vencimento mais líquido'}
            </span>
            <div className="grade-tickers" role="group" aria-label="Período do gráfico">
              {JANELAS.map((j) => (
                <button key={j} className={`chip ${j === janela ? 'selected' : ''}`} aria-pressed={j === janela} onClick={() => setJanela(j)}>
                  {j} dias
                </button>
              ))}
            </div>
          </div>
          <GraficoFuturo candles={produto.serie} nome={produto.apelido} casas={casas} janela={janela} />
        </div>

        <div className="desk-side col" style={{ gap: 12 }}>
          <div className="card col" style={{ gap: 8 }}>
            <span className="small muted">Leitura do passado</span>
            <span className="font-display" style={{ fontSize: 24, fontWeight: 700, color: corLeitura }}>{ROTULO_LEITURA[analise.leitura]}</span>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              {analise.motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className="small muted justify" style={{ lineHeight: 1.5 }}>
            A leitura descreve o que o gráfico mostrou, não prevê o próximo movimento. Suporte e resistência são só a mínima e a máxima
            recentes: o preço pode romper qualquer um.
            {produto.tipo !== 'taxa' && ' O contínuo emenda os vencimentos e ajusta os antigos para não haver salto na troca; por isso os preços antigos podem diferir dos que foram negociados na época.'}
          </div>
        </div>
      </div>
    </div>
  )
}
