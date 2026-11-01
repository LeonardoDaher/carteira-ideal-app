import { useMemo, useState } from 'react'
import type { DadosDaAnalise } from './useAnaliseDaAcao'
import { ROTULO_LEITURA, ROTULO_VIES, agregar, zonasDePreco } from '../domain/analiseTecnica'
import type { AnaliseTecnica, Barra, Horizonte, Leitura, Viés } from '../domain/analiseTecnica'
import type { EstadoHistoricoLongo } from '../data/useHistoricoLongo'
import { ROTULO_HORIZONTE } from '../domain/confluencia'
import { GraficoPrecoAcao } from '../ui/GraficoPrecoAcao'
import type { OpcoesDoGrafico } from '../ui/GraficoPrecoAcao'
import { AvisoDaAnalise, BarraDeNota, EstadoDoArquivo, Linha, Modulo, Selo } from '../ui/BlocosDeAnalise'
import type { Tom } from '../ui/BlocosDeAnalise'
import { dataLonga, numero, percentual, reais } from '../ui/formatoAnalise'
import { aberturaDaSemana, caixaDaBase, gapsAbertos, mediaDe200Semanas } from '../domain/niveisDoGrafico'

type Periodicidade = 'diario' | 'semanal' | 'mensal'
const PERIODICIDADES: { chave: Periodicidade; rotulo: string }[] = [{ chave: 'diario', rotulo: 'Diário' }, { chave: 'semanal', rotulo: 'Semanal' }, { chave: 'mensal', rotulo: 'Mensal' }]
/** Janelas do gráfico por periodicidade, em candles; a última (0) mostra todo o histórico guardado. */
const JANELAS: Record<Periodicidade, { n: number; rotulo: string }[]> = {
  diario: [{ n: 60, rotulo: '60 pregões' }, { n: 120, rotulo: '120 pregões' }, { n: 260, rotulo: '1 ano' }, { n: 520, rotulo: '2 anos' }, { n: 1300, rotulo: '5 anos' }, { n: 0, rotulo: 'Tudo' }],
  semanal: [{ n: 26, rotulo: '26 semanas' }, { n: 52, rotulo: '1 ano' }, { n: 104, rotulo: '2 anos' }, { n: 260, rotulo: '5 anos' }, { n: 0, rotulo: 'Tudo' }],
  mensal: [{ n: 12, rotulo: '1 ano' }, { n: 24, rotulo: '2 anos' }, { n: 60, rotulo: '5 anos' }, { n: 0, rotulo: 'Tudo' }],
}

export const tomDoVies = (v: Viés): Tom => (v === 'altista' || v === 'moderadamente-altista' ? 'positivo' : v === 'baixista' || v === 'moderadamente-baixista' ? 'negativo' : 'neutro')
const tomDaLeitura = (l: Leitura): Tom => (l === 'alta' ? 'positivo' : l === 'baixa' ? 'negativo' : 'neutro')

const textoDoFator = (f: number) => (f >= 1.5 ? `${numero(f, Number.isInteger(f) ? 0 : 2)}:1 desdobramento` : f > 1 ? `bonificação de ${numero((f - 1) * 100, 1)}%` : `1:${Math.round(1 / f)} grupamento`)

/** Diz de onde vêm os candles e o que foi ajustado: abertura real do COTAHIST ou aproximada, desdobramentos e grupamentos aplicados. */
function NotaDoHistorico({ barras, estado }: { barras: Barra[]; estado: EstadoHistoricoLongo }) {
  const comAbertura = barras.filter((b) => b.abe !== undefined)
  if (estado.tipo === 'carregando') return <span className="tiny muted" role="status">Carregando o histórico longo…</span>
  if (!comAbertura.length) {
    return (
      <span className="tiny muted justify">
        Histórico de 12 meses do Boletim de Preços da B3, que não traz o preço de abertura: o corpo do candle vai do fechamento anterior ao fechamento do dia, e martelo, engolfo, doji e gaps de abertura não podem ser lidos.
      </span>
    )
  }
  const ultimaReal = comAbertura[comAbertura.length - 1].data
  const ajustes = estado.tipo === 'pronto' ? estado.dados.ajustes : []
  return (
    <span className="tiny muted justify" data-testid="nota-historico-longo">
      Candles com abertura real do COTAHIST da B3, de {dataLonga(comAbertura[0].data)} a {dataLonga(ultimaReal)}
      {barras[barras.length - 1].data > ultimaReal ? '; depois disso a abertura é aproximada pelo fechamento anterior' : ''}.{' '}
      {ajustes.length
        ? `Preços ajustados a ${ajustes.length === 1 ? 'um evento' : `${ajustes.length} eventos`}: ${ajustes.map((a) => `${dataLonga(a.data)} (${textoDoFator(a.fator)}${a.origem === 'b3' ? ', registrado na B3' : ', confirmado pelo responsável'})`).join('; ')}.`
        : 'Nenhum desdobramento ou grupamento no período.'}
      {estado.tipo === 'pronto' && estado.dados.saltosRestantes.length
        ? ` Variação de mais de 40% em um só pregão sem desdobramento, grupamento ou bonificação registrado na B3 (${estado.dados.saltosRestantes.map((s) => dataLonga(s.data)).join(', ')}): é movimento real de preço, ou um evento que a B3 não lista.`
        : ''}
    </span>
  )
}

/** Explica em texto cada nível desenhado no gráfico (origem e valor), para quem não enxerga as cores ou quer a conta. */
function NotaDosNiveis({ n }: { n: { abertura: ReturnType<typeof aberturaDaSemana>; media200: ReturnType<typeof mediaDe200Semanas>; gaps: ReturnType<typeof gapsAbertos>; caixa: ReturnType<typeof caixaDaBase> } }) {
  const itens: string[] = []
  if (n.abertura) itens.push(`${n.abertura.rotulo}: ${reais(n.abertura.preco)}${n.abertura.real ? '' : ' (aproximada pelo fechamento anterior)'}`)
  if (n.media200) itens.push(`média de 200 semanas: ${reais(n.media200.preco)}`)
  for (const g of n.gaps) {
    itens.push(`gap de ${g.tipo} de ${dataLonga(g.data)} ainda aberto entre ${reais(g.inferior)} e ${reais(g.superior)} (${numero(g.preenchido * 100, 0)}% preenchido; meio do gap em ${reais(g.meio)})`)
  }
  if (n.caixa) {
    itens.push(`base de ${n.caixa.candles} candles, de ${dataLonga(n.caixa.inicio)} a ${dataLonga(n.caixa.fim)}, entre ${reais(n.caixa.fundo)} e ${reais(n.caixa.topo)}${n.caixa.rompeu ? `; o último candle fechou ${n.caixa.rompeu === 'acima' ? 'acima' : 'abaixo'} dela` : ''}`)
  }
  if (!itens.length) return <span className="tiny muted">Sem níveis extras no momento: nenhum gap aberto, nenhuma base lateral e histórico curto para a média de 200 semanas.</span>
  return (
    <ul className="tiny muted" style={{ margin: 0, paddingLeft: 16 }} data-testid="niveis-do-grafico">
      {itens.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  )
}

/** Aba "Análise técnica": leitura gráfica calculada por regra (tendência, médias, IFR, MACD, volume, zonas, padrões, risco, cenários e nota). */
export function AnaliseTecnicaAcao({ dados, ticker, nome, horizonte }: { dados: DadosDaAnalise; ticker: string; nome: string | null; horizonte: Horizonte }) {
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>('diario')
  const [janela, setJanela] = useState(120)
  const [opcoes, setOpcoes] = useState<OpcoesDoGrafico>({ mm21: true, mm80: true, mm200: false, zonas: true, volume: true, ifr: true, macd: true, estocastico: true, bollinger: true, ema9: true, niveis: true })
  const barrasDoGrafico = useMemo(() => {
    const b = dados.barrasDoGrafico ?? []
    return periodicidade === 'diario' ? b : agregar(b, periodicidade === 'semanal' ? 'semana' : 'mes')
  }, [dados.barrasDoGrafico, periodicidade])
  // Zonas do gráfico: com o histórico longo carregado, calculadas sobre ele (suportes e resistências de anos atrás, que a leitura de
  // 12 meses não enxerga); sem ele, as da leitura técnica. A nota e a hipótese operacional continuam usando as de 12 meses.
  const zonasDoGrafico = useMemo(
    () => (dados.tecnica && dados.barrasDoGrafico && dados.barrasDoGrafico !== dados.barras ? zonasDePreco(dados.barrasDoGrafico, dados.tecnica.volatilidade.atrPct) : (dados.tecnica?.zonas ?? [])),
    [dados.tecnica, dados.barrasDoGrafico, dados.barras],
  )
  // Níveis do gráfico: abertura da semana, média de 200 semanas, gaps ainda abertos e a caixa da base atual. Sempre sobre o diário.
  const niveisDoGrafico = useMemo(() => {
    const b = dados.barrasDoGrafico ?? []
    if (b.length < 30) return { niveis: [], gaps: [], caixa: null, abertura: null, media200: null }
    const abertura = aberturaDaSemana(b)
    const media200 = mediaDe200Semanas(b)
    const niveis = [
      ...(abertura ? [{ chave: abertura.chave, preco: abertura.preco, rotulo: abertura.rotulo }] : []),
      ...(media200 ? [{ chave: 'media-200-semanas', preco: media200.preco, rotulo: 'média de 200 semanas', cor: 'oklch(62% 0.27 328)' }] : []),
    ]
    return { niveis, gaps: gapsAbertos(b), caixa: caixaDaBase(b), abertura, media200 }
  }, [dados.barrasDoGrafico])
  // Só oferece janelas que cabem no histórico disponível; "Tudo" some quando a última janela já o cobre.
  const caben = JANELAS[periodicidade].filter((j) => j.n !== 0 && j.n < barrasDoGrafico.length * 1.1)
  const janelas = caben.length && caben[caben.length - 1].n >= barrasDoGrafico.length * 0.95 ? caben : [...caben, { n: 0, rotulo: 'Tudo' }]
  const janelaAtiva = janelas.some((j) => j.n === janela) ? janela : janelas[0].n
  function trocarPeriodicidade(p: Periodicidade) {
    setPeriodicidade(p)
    setJanela(p === 'diario' ? 120 : p === 'semanal' ? 26 : 0)
  }

  if (dados.series.tipo !== 'pronto') {
    return <EstadoDoArquivo estado={dados.series.tipo} aoTentarDeNovo={dados.recarregarSeries} nome="as séries de preço" />
  }
  const t = dados.tecnica
  if (!t || !dados.barras) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Análise técnica indisponível para {ticker}</span>
        <span className="muted small justify">{dados.semSerie}</span>
      </div>
    )
  }

  return (
    <div className="col" style={{ gap: 14 }} data-testid="analise-tecnica">
      <ResumoTecnico t={t} nome={nome} />

      <Modulo titulo="Gráfico de preço" subtitulo="candles, médias, zonas, volume, IFR, MACD e estocástico" aberto>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Periodicidade do gráfico">
          {PERIODICIDADES.map((p) => (
            <button key={p.chave} className={`chip ${periodicidade === p.chave ? 'selected' : ''}`} aria-pressed={periodicidade === p.chave} onClick={() => trocarPeriodicidade(p.chave)}>
              {p.rotulo}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Período do gráfico">
          {janelas.map((j) => (
            <button key={j.n} className={`chip ${janelaAtiva === j.n ? 'selected' : ''}`} aria-pressed={janelaAtiva === j.n} onClick={() => setJanela(j.n)}>
              {j.rotulo}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Indicadores do gráfico">
          {([['mm21', 'Média 21'], ['mm80', 'Média 80'], ['mm200', 'Média 200'], ['zonas', 'Suportes e resistências'], ['volume', 'Volume'], ['ifr', 'IFR'], ['macd', 'MACD'], ['estocastico', 'Estocástico'], ['bollinger', 'Bollinger'], ['ema9', 'Média 9'], ['niveis', 'Níveis e gaps']] as const).map(([chave, rotulo]) => (
            <button key={chave} className={`chip ${opcoes[chave] ? 'selected' : ''}`} aria-pressed={opcoes[chave]} onClick={() => setOpcoes({ ...opcoes, [chave]: !opcoes[chave] })}>
              {rotulo}
            </button>
          ))}
        </div>
        <GraficoPrecoAcao key={`${ticker}-${periodicidade}-${janelaAtiva}`} barras={barrasDoGrafico} zonas={zonasDoGrafico} niveis={niveisDoGrafico.niveis} gaps={niveisDoGrafico.gaps} caixa={niveisDoGrafico.caixa} nome={ticker} periodicidade={periodicidade} janela={janelaAtiva === 0 ? barrasDoGrafico.length : Math.min(janelaAtiva, barrasDoGrafico.length)} opcoes={opcoes} />
        <NotaDoHistorico barras={barrasDoGrafico} estado={dados.historicoLongo} />
        {opcoes.niveis && <NotaDosNiveis n={niveisDoGrafico} />}
        <span className="tiny muted justify">Todo o histórico de preços vem de arquivos da B3. O volume é financeiro (R$), não quantidade de ações. Dividendos não ajustam o preço.</span>
      </Modulo>

      <Modulo titulo="Tendência por período" subtitulo={`horizonte de ${ROTULO_HORIZONTE[horizonte].toLowerCase()}`} aberto>
        <div className="col" style={{ gap: 10 }}>
          {(['diario', 'semanal', 'mensal'] as const).map((p) => {
            const x = t.tendencia[p]
            return (
              <div key={p} className="card-outline col" style={{ gap: 4 }} data-testid={`tendencia-${p}`}>
                <div className="row-between" style={{ gap: 8 }}>
                  <strong>{p === 'diario' ? 'Diário' : p === 'semanal' ? 'Semanal' : 'Mensal'}</strong>
                  <Selo tom={tomDaLeitura(x.leitura)}>{ROTULO_LEITURA[x.leitura]}</Selo>
                </div>
                <span className="small muted justify">{x.explicacao}</span>
              </div>
            )
          })}
        </div>
        <div className="small justify" style={{ lineHeight: 1.5 }}>
          <strong>{t.multitemporal.situacao}</strong> <span className="muted">{t.multitemporal.explicacao}</span>
        </div>
      </Modulo>

      <Modulo titulo="Médias móveis">
        <div className="col" style={{ gap: 0 }}>
          {t.medias.map((m) => (
            <div key={m.nome} className="tabela-bdr small">
              <span className="muted">{m.valor === null && m.periodo === 200 ? 'Média simples de 200 (histórico insuficiente)' : m.tipo === 'SMA' ? `Média simples de ${m.periodo}` : `Média exponencial de ${m.periodo}`}</span>
              <span style={{ fontWeight: 600 }}>
                {m.valor === null ? '—' : reais(m.valor)}
                {m.distanciaPct !== null && <span className="muted" style={{ fontWeight: 400 }}> · preço {percentual(m.distanciaPct, 1, true)}{m.inclinacaoPct !== null ? ` · inclinação ${percentual(m.inclinacaoPct, 1, true)}` : ''}</span>}
              </span>
            </div>
          ))}
        </div>
        {t.cruzamentos.length > 0 ? (
          <ul className="small col" style={{ gap: 4, paddingLeft: 18, margin: 0 }} aria-label="Cruzamentos recentes">
            {t.cruzamentos.slice(0, 4).map((c) => (
              <li key={`${c.data}-${c.descricao}`}>
                {c.descricao} em {dataLonga(c.data)} ({c.pregoesAtras === 0 ? 'hoje' : `há ${c.pregoesAtras} pregões`}).
              </li>
            ))}
          </ul>
        ) : (
          <span className="small muted">Sem cruzamentos de médias recentes.</span>
        )}
        <span className="tiny muted justify">Um cruzamento isolado não é sinal definitivo de compra ou venda; vale junto da tendência e do volume.</span>
      </Modulo>

      <Momentum t={t} />

      <Modulo titulo="Volume e liquidez">
        <div className="col" style={{ gap: 0 }}>
          <Linha rotulo="Liquidez" valor={t.volume.liquidez === 'alta' ? 'Alta' : t.volume.liquidez === 'moderada' ? 'Moderada' : 'Baixa'} cor={t.volume.liquidez === 'baixa' ? 'var(--danger)' : undefined} />
          {t.volume.mediaFinanceira21 !== null && <Linha rotulo="Volume médio diário (21 pregões)" valor={`R$ ${numero(t.volume.mediaFinanceira21 / 1000, 1)} mi`} />}
          {t.volume.relativo !== null && <Linha rotulo="Último pregão sobre a média de 20" valor={`${numero(t.volume.relativo, 2)}×`} />}
          {t.volume.altaSobreQueda !== null && <Linha rotulo="Volume nas altas ÷ nas quedas (20 pregões)" valor={`${numero(t.volume.altaSobreQueda, 2)}×`} />}
          {t.volume.obvTendencia && <Linha rotulo="OBV financeiro" valor={t.volume.obvTendencia === 'sobe' ? 'Sobe' : t.volume.obvTendencia === 'cai' ? 'Cai' : 'Estável'} />}
        </div>
        <span className="small muted justify">{t.volume.leitura}</span>
      </Modulo>

      <Modulo titulo="Suportes e resistências" subtitulo="zonas de preço, não valores exatos">
        {t.zonas.length === 0 ? (
          <span className="small muted">Nenhuma zona com pelo menos dois toques foi identificada.</span>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {t.zonas.map((z) => (
              <div key={`${z.tipo}-${z.inferior}`} className="card-outline col" style={{ gap: 3 }} data-testid="zona">
                <div className="row-between" style={{ gap: 8 }}>
                  <strong>{z.tipo === 'suporte' ? 'Suporte' : 'Resistência'}: {reais(z.inferior)} a {reais(z.superior)}</strong>
                  <Selo tom={z.relevancia === 'alta' ? 'positivo' : z.relevancia === 'media' ? 'neutro' : 'negativo'}>{z.relevancia === 'alta' ? 'Relevância alta' : z.relevancia === 'media' ? 'Relevância média' : 'Relevância baixa'}</Selo>
                </div>
                <span className="small muted">{percentual(z.distanciaPct, 1, true)} do preço atual · {z.toques} toques · última reação em {dataLonga(z.ultimaReacao)}</span>
                <span className="tiny muted justify">Confirmação: {z.confirmacao} Invalidação: {z.invalidacao}</span>
              </div>
            ))}
          </div>
        )}
        {t.rompimentos.length > 0 && (
          <div className="col" style={{ gap: 6 }}>
            <strong className="small">Rompimentos recentes</strong>
            <ul className="small col" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
              {t.rompimentos.map((r) => (
                <li key={`${r.zona.tipo}-${r.zona.inferior}`}>
                  {r.descricao} <span className="muted">(zona de {reais(r.zona.inferior)} a {reais(r.zona.superior)}, {dataLonga(r.data)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {t.fibonacci && (
          <div className="col" style={{ gap: 4 }}>
            <strong className="small">Retração de Fibonacci (ferramenta complementar)</strong>
            <span className="tiny muted">Movimento de {t.fibonacci.direcao === 'alta' ? 'alta' : 'baixa'} de {reais(t.fibonacci.de)} a {reais(t.fibonacci.ate)} nos últimos 12 meses.</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {t.fibonacci.niveis.map((n) => (
                <span key={n.razao} className="badge badge-media">{numero(n.razao * 100, 1)}%: {reais(n.preco)}</span>
              ))}
            </div>
          </div>
        )}
      </Modulo>

      <Modulo titulo="Padrões gráficos" subtitulo="só o que as regras comprovam">
        {t.padroes.length === 0 ? (
          <span className="small muted justify">Nenhum padrão gráfico com evidência suficiente foi identificado. Bandeiras e flâmulas não são avaliadas nesta versão, e formações ambíguas não são classificadas como sinais.</span>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {t.padroes.map((p) => (
              <div key={`${p.nome}-${p.localizacao}`} className="card-outline col" style={{ gap: 4 }} data-testid="padrao">
                <div className="row-between" style={{ gap: 8 }}>
                  <strong>{p.nome}</strong>
                  <Selo tom={p.confirmacao === 'confirmado' ? (p.direcao === 'alta' ? 'positivo' : p.direcao === 'baixa' ? 'negativo' : 'neutro') : 'neutro'}>{p.confirmacao === 'confirmado' ? 'Confirmado' : 'Em formação'}</Selo>
                </div>
                <span className="tiny muted">{p.localizacao} · direção potencial: {p.direcao === 'alta' ? 'alta' : p.direcao === 'baixa' ? 'baixa' : 'indefinida'}</span>
                <ul className="small col" style={{ gap: 2, paddingLeft: 18, margin: 0 }}>
                  {p.criterios.map((c) => <li key={c}>{c}</li>)}
                </ul>
                <span className="small"><strong>Invalidação:</strong> {p.invalidacao}</span>
                {p.objetivo && <span className="small"><strong>Objetivo técnico:</strong> {p.objetivo}</span>}
                <span className="tiny muted justify">{p.limitacoes}</span>
              </div>
            ))}
          </div>
        )}
      </Modulo>

      <Modulo titulo="Volatilidade e gestão de risco">
        <div className="col" style={{ gap: 0 }}>
          {t.volatilidade.atr14 !== null && <Linha rotulo="ATR de 14 pregões" valor={`${reais(t.volatilidade.atr14)} (${percentual(t.volatilidade.atrPct ?? 0)})`} />}
          {t.volatilidade.tendenciaAtr && <Linha rotulo="Amplitude dos pregões" valor={t.volatilidade.tendenciaAtr === 'expansao' ? 'Em expansão' : t.volatilidade.tendenciaAtr === 'contracao' ? 'Em contração' : 'Estável'} />}
          <Linha rotulo="Gaps nos últimos 60 pregões" valor={t.volatilidade.gaps.length === 0 ? 'Nenhum' : String(t.volatilidade.gaps.length)} />
          {t.volatilidade.movimentoAbruptoPct !== null && <Linha rotulo="Maior variação diária recente" valor={percentual(t.volatilidade.movimentoAbruptoPct)} />}
        </div>
        <span className="small muted justify">{t.volatilidade.leitura}</span>

        <div className="card-outline col" style={{ gap: 6 }} data-testid="hipotese">
          <strong className="small">Hipótese operacional de compra (condicional)</strong>
          {t.hipotese ? (
            <>
              <Linha rotulo="Região potencial de entrada" valor={`${reais(t.hipotese.regiaoEntrada.inferior)} a ${reais(t.hipotese.regiaoEntrada.superior)}`} />
              <Linha rotulo="Stop técnico de referência" valor={reais(t.hipotese.stop)} />
              <Linha rotulo="Alvos potenciais" valor={t.hipotese.alvos.map((a) => reais(a)).join(' · ')} />
              <Linha rotulo="Retorno potencial ÷ risco" valor={t.hipotese.riscoRetorno === null ? '—' : `${numero(t.hipotese.riscoRetorno, 1)}×`} />
              <span className="tiny muted justify">Confirmação: {t.hipotese.confirmacao} Stop: {t.hipotese.metodoStop}</span>
              {t.hipotese.aviso && <span className="small" style={{ color: 'var(--warning)' }}>{t.hipotese.aviso}</span>}
            </>
          ) : (
            <span className="small muted justify">{t.motivoSemHipotese}</span>
          )}
          <span className="tiny muted justify">Referência técnica para estudo, não ordem de compra ou venda. O stop pode ser executado a um preço pior que o definido, especialmente em gaps.</span>
        </div>
      </Modulo>

      <Modulo titulo="Cenários condicionais" subtitulo="sem probabilidades numéricas">
        <div className="col" style={{ gap: 8 }}>
          {t.cenarios.map((c) => (
            <div key={c.nome} className="card-outline col" style={{ gap: 4 }} data-testid={`cenario-${c.nome}`}>
              <strong>Cenário {c.nome}</strong>
              <span className="small"><strong>Ativação:</strong> {c.ativacao}</span>
              {c.niveis.length > 0 && <span className="small"><strong>Níveis:</strong> {c.niveis.map((n) => reais(n)).join(' → ')}</span>}
              <span className="small"><strong>Invalidação:</strong> {c.invalidacao}</span>
              <span className="small"><strong>Confirmações:</strong> {c.confirmacoes.join('; ')}.</span>
              <span className="tiny muted justify">Risco de interpretação: {c.riscos}</span>
            </div>
          ))}
        </div>
      </Modulo>

      <Modulo titulo="Mercado e força relativa">
        {t.contexto ? (
          <>
            <span className="small justify">{t.contexto.leitura}</span>
            <div className="col" style={{ gap: 0 }}>
              <Linha rotulo={`Ação menos ${t.contexto.referencia} em 63 pregões`} valor={t.contexto.relativo63 === null ? '—' : `${numero(t.contexto.relativo63, 1)} p.p.`} />
              <Linha rotulo={`Ação menos ${t.contexto.referencia} em 126 pregões`} valor={t.contexto.relativo126 === null ? '—' : `${numero(t.contexto.relativo126, 1)} p.p.`} />
            </div>
          </>
        ) : (
          <span className="small muted justify">Dados insuficientes para conclusão: sem série de referência alinhada. A comparação com o setor também não é feita nesta versão.</span>
        )}
      </Modulo>

      <Modulo titulo="Pontuação técnica e confiança" aberto>
        <div className="col" style={{ gap: 10 }}>
          {t.pontuacao.componentes.map((c) => (
            <BarraDeNota key={c.nome} rotulo={c.nome} valor={c.nota} peso={c.peso} detalhe={c.porque} />
          ))}
          <BarraDeNota rotulo="Pontuação técnica" valor={t.pontuacao.total} detalhe={`${ROTULO_VIES[t.pontuacao.vies]}. Média ponderada: tendência 30%, momentum 20%, volume 20%, suportes e resistências 15%, risco 15% (pesos iniciais).`} />
          <BarraDeNota rotulo="Confiança da leitura" valor={t.confianca.valor} detalhe={t.confianca.motivos.join(' ') || 'Dados e indicadores consistentes.'} />
        </div>
        <span className="tiny muted justify">Confiança não é probabilidade de lucro: mede a qualidade dos dados, a concordância entre as evidências e a clareza do gráfico.</span>
      </Modulo>

      <Modulo titulo="Histórico dos sinais" subtitulo="o que já aconteceu, não o que vai acontecer">
        {t.sinais.length === 0 ? (
          <span className="small muted">Nenhum sinal recente.</span>
        ) : (
          <div className="col" style={{ gap: 0 }}>
            {t.sinais.map((s) => (
              <div key={`${s.data}-${s.sinal}`} className="tabela-bdr small">
                <span>
                  <span className="muted">{dataLonga(s.data)}</span> · {s.sinal}
                </span>
                <span style={{ color: s.retorno10 === null ? undefined : s.retorno10 >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{s.retorno10 === null ? 'em aberto' : `${percentual(s.retorno10, 1, true)} em 10 pregões`}</span>
              </div>
            ))}
          </div>
        )}
        <span className="tiny muted justify">O retorno depois de cada sinal é o que o preço fez nos 10 pregões seguintes. Poucos casos não formam estatística: não use como taxa de acerto.</span>
      </Modulo>

      <Modulo titulo="Fonte, data e qualidade dos dados">
        <div className="col" style={{ gap: 0 }}>
          <Linha rotulo="Fonte" valor="B3, Boletim de Preços (BVBG.086)" />
          <Linha rotulo="Última data" valor={dataLonga(t.qualidade.ultimaData)} />
          <Linha rotulo="Primeira data" valor={dataLonga(t.qualidade.primeiraData)} />
          <Linha rotulo="Pregões na série" valor={String(t.qualidade.pregoes)} />
          <Linha rotulo="Dias sem negócio" valor={String(t.qualidade.diasSemNegocio)} />
        </div>
        <ul className="small muted col" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
          {t.qualidade.avisos.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </Modulo>

      <AvisoDaAnalise />
    </div>
  )
}

function ResumoTecnico({ t, nome }: { t: AnaliseTecnica; nome: string | null }) {
  const c = t.conclusao
  return (
    <div className="card col" style={{ gap: 10 }} data-testid="resumo-tecnico">
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 20 }}>{t.ticker}</span>
          {nome && <span className="tiny muted">{nome}</span>}
          <span className="tiny muted">Preço de {dataLonga(t.dataReferencia)}: {reais(t.preco)}</span>
        </div>
        <div className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
          <Selo tom={c.semSinal ? 'neutro' : tomDoVies(c.vies)}>{c.semSinal ? 'Sem sinal consistente' : ROTULO_VIES[c.vies]}</Selo>
          <span className="tiny muted">Nota {t.pontuacao.total} · confiança {t.confianca.nivel === 'alta' ? 'alta' : t.confianca.nivel === 'media' ? 'média' : 'baixa'}</span>
        </div>
      </div>
      <p className="small justify" style={{ lineHeight: 1.5, margin: 0 }}>{c.resumo}</p>
      <div className="col" style={{ gap: 8 }}>
        {c.favoraveis.length > 0 && (
          <div className="col" style={{ gap: 2 }}>
            <strong className="small" style={{ color: 'var(--success)' }}>Indicadores favoráveis</strong>
            <ul className="small col" style={{ gap: 2, paddingLeft: 18, margin: 0 }}>{c.favoraveis.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        )}
        {c.desfavoraveis.length > 0 && (
          <div className="col" style={{ gap: 2 }}>
            <strong className="small" style={{ color: 'var(--danger)' }}>Indicadores desfavoráveis</strong>
            <ul className="small col" style={{ gap: 2, paddingLeft: 18, margin: 0 }}>{c.desfavoraveis.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
        )}
        <div className="col" style={{ gap: 2 }}>
          <strong className="small">O que monitorar</strong>
          <ul className="small col" style={{ gap: 2, paddingLeft: 18, margin: 0 }}>{c.monitorar.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      </div>
      {t.qualidade.saltosNaoConfirmados.length > 0 && (
        <div className="card-outline small aviso-atraso" role="note">
          <strong>Atenção ao gráfico.</strong> <span className="muted">Há salto de preço não confirmado como desdobramento ou grupamento: o histórico pode estar distorcido e a confiança da leitura cai.</span>
        </div>
      )}
    </div>
  )
}

/** Leitura em texto do IFR e do MACD; os desenhos ficam no gráfico de preço, abaixo do volume. */
function Momentum({ t }: { t: AnaliseTecnica }) {
  return (
    <Modulo titulo="IFR e MACD">
      <div className="col" style={{ gap: 6 }}>
        <strong className="small">IFR de 14 pregões</strong>
        <span className="small muted justify">{t.momentum.rsi.leitura}</span>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <strong className="small">MACD (12, 26, 9)</strong>
        <span className="small muted justify">{t.momentum.macd.leitura}</span>
      </div>
      <span className="tiny muted justify">IFR acima de 70 não é ordem de venda, nem abaixo de 30 é ordem de compra: em tendências fortes o indicador permanece nessas regiões por semanas.</span>
    </Modulo>
  )
}
