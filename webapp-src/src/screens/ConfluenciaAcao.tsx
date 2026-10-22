import type { DadosDaAnalise } from './useAnaliseDaAcao'
import { ROTULO_HORIZONTE } from '../domain/confluencia'
import type { Confluencia, Postura, SituacaoConfluencia } from '../domain/confluencia'
import type { Horizonte } from '../domain/analiseTecnica'
import { AvisoDaAnalise, BarraDeNota, EstadoDoArquivo, Linha, Modulo, Selo } from '../ui/BlocosDeAnalise'
import type { Tom } from '../ui/BlocosDeAnalise'
import { reais } from '../ui/formatoAnalise'

const tomDaPostura = (p: Postura): Tom => (p === 'favoravel' ? 'positivo' : p === 'desfavoravel' ? 'negativo' : 'neutro')
const rotuloDaPostura: Record<Postura, string> = { favoravel: 'Favorável', neutra: 'Neutra', desfavoravel: 'Desfavorável', indisponivel: 'Indisponível' }
const ROTULO_NO_GRAFICO: Record<Exclude<Postura, 'indisponivel'>, string> = { favoravel: 'favorável', neutra: 'neutro', desfavoravel: 'desfavorável' }
const ROTULO_NOS_FUNDAMENTOS: Record<Exclude<Postura, 'indisponivel'>, string> = { favoravel: 'favoráveis', neutra: 'neutros', desfavoravel: 'desfavoráveis' }

const tomDaSituacao = (s: SituacaoConfluencia): Tom =>
  s === 'confluencia-positiva' ? 'positivo' : s === 'confluencia-negativa' || s === 'fundamento-desfavoravel-grafico-neutro' || s === 'grafico-desfavoravel-fundamento-neutro' ? 'negativo' : 'neutro'

const POSTURAS: Exclude<Postura, 'indisponivel'>[] = ['favoravel', 'neutra', 'desfavoravel']
const SITUACAO_DA_CELULA: Record<string, SituacaoConfluencia> = {
  'favoravel|favoravel': 'confluencia-positiva',
  'favoravel|neutra': 'fundamento-favoravel-grafico-neutro',
  'favoravel|desfavoravel': 'fundamento-favoravel-grafico-contra',
  'neutra|favoravel': 'grafico-favoravel-fundamento-neutro',
  'neutra|neutra': 'sem-direcao',
  'neutra|desfavoravel': 'grafico-desfavoravel-fundamento-neutro',
  'desfavoravel|favoravel': 'grafico-favoravel-fundamento-contra',
  'desfavoravel|neutra': 'fundamento-desfavoravel-grafico-neutro',
  'desfavoravel|desfavoravel': 'confluencia-negativa',
}

/** Aba "Confluência": alinha a leitura técnica com a fundamentalista para o horizonte escolhido. */
export function ConfluenciaAcao({ dados, ticker, horizonte }: { dados: DadosDaAnalise; ticker: string; horizonte: Horizonte }) {
  const carregando = dados.series.tipo === 'carregando' || dados.fundamentos.tipo === 'carregando' || dados.series.tipo === 'ocioso' || dados.fundamentos.tipo === 'ocioso'
  if (dados.series.tipo === 'erro' || dados.fundamentos.tipo === 'erro') {
    return (
      <EstadoDoArquivo
        estado="erro"
        nome={dados.series.tipo === 'erro' ? 'as séries de preço' : 'os fundamentos da CVM'}
        aoTentarDeNovo={() => {
          if (dados.series.tipo === 'erro') dados.recarregarSeries()
          if (dados.fundamentos.tipo === 'erro') dados.recarregarFundamentos()
        }}
      />
    )
  }
  if (carregando && !dados.confluencia) return <EstadoDoArquivo estado="carregando" aoTentarDeNovo={() => {}} nome="as análises" />
  const c = dados.confluencia
  if (!c) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Confluência indisponível para {ticker}</span>
        <span className="muted small justify">{dados.semSerie ?? dados.semFundamentos}</span>
      </div>
    )
  }
  return (
    <div className="col" style={{ gap: 14 }} data-testid="confluencia">
      <ResumoConfluencia c={c} horizonte={horizonte} />

      <Modulo titulo="Quadro de confluência" subtitulo="fundamentos × gráfico" aberto>
        <Quadro c={c} />
        <span className="tiny muted justify">Linhas: leitura fundamentalista. Colunas: leitura técnica. A célula marcada é a situação atual. Cada análise continua valendo por si: abra as abas anteriores para ver os números.</span>
      </Modulo>

      <Modulo titulo="As duas leituras lado a lado" aberto>
        <div className="col" style={{ gap: 8 }}>
          <CartaoDeLeitura titulo="Fundamentalista (valor da empresa)" d={c.fundamentalista} />
          <CartaoDeLeitura titulo="Técnica (comportamento do preço)" d={c.tecnica} />
        </div>
        <div className="col" style={{ gap: 6 }}>
          <BarraDeNota rotulo="Pontuação combinada" valor={c.pontuacao.valor} detalhe={c.pontuacao.explicacao} />
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong className="small">Convicção:</strong>
            <Selo tom={c.conviccao === 'alta' ? 'positivo' : c.conviccao === 'media' ? 'neutro' : 'negativo'}>{c.conviccao === 'alta' ? 'Alta' : c.conviccao === 'media' ? 'Média' : 'Baixa'}</Selo>
          </div>
          <ul className="small muted col" style={{ gap: 3, paddingLeft: 18, margin: 0 }}>
            {c.conviccaoMotivos.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      </Modulo>

      <Modulo titulo="Preço de entrada × suporte técnico" subtitulo="onde fundamentos e gráfico se encontram" aberto>
        <span className="small justify">{c.preco.texto}</span>
        {(c.preco.precoEntradaFundamentalista !== null || c.preco.suporte) && (
          <div className="col" style={{ gap: 0 }}>
            {c.preco.precoEntradaFundamentalista !== null && <Linha rotulo="Preço de entrada pelos fundamentos" valor={reais(c.preco.precoEntradaFundamentalista)} />}
            {c.preco.suporte && <Linha rotulo="Suporte técnico mais próximo" valor={`${reais(c.preco.suporte.inferior)} a ${reais(c.preco.suporte.superior)}`} />}
            {c.preco.resistencia && <Linha rotulo="Resistência técnica mais próxima" valor={`${reais(c.preco.resistencia.inferior)} a ${reais(c.preco.resistencia.superior)}`} />}
          </div>
        )}
      </Modulo>

      <Modulo titulo="O que acompanhar" aberto>
        {c.condicoes.length === 0 ? (
          <span className="small muted">Sem condições específicas: acompanhe os próximos balanços e o gráfico.</span>
        ) : (
          <ul className="small col" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
            {c.condicoes.map((x) => <li key={x}>{x}</li>)}
          </ul>
        )}
      </Modulo>

      <Modulo titulo="Riscos de interpretação">
        <ul className="small muted col" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
          {c.riscosDeInterpretacao.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </Modulo>

      <AvisoDaAnalise>
        A confluência compara duas leituras que olham o passado e o presente; ela não prevê o preço nem elimina o risco de nenhuma delas. Fundamentos medem o valor ao longo de anos, o gráfico mede o preço em dias e semanas, e os dois podem divergir por muito tempo. É possível perder parte ou todo o dinheiro investido em ações.
      </AvisoDaAnalise>
    </div>
  )
}

function ResumoConfluencia({ c, horizonte }: { c: Confluencia; horizonte: Horizonte }) {
  return (
    <div className="card col" style={{ gap: 10 }} data-testid="resumo-confluencia">
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 20 }}>{c.ticker}</span>
          <span className="tiny muted">Horizonte: {ROTULO_HORIZONTE[horizonte].toLowerCase()} · fundamentos {Math.round(c.pontuacao.pesoFundamentalista * 100)}% × gráfico {Math.round(c.pontuacao.pesoTecnica * 100)}%</span>
        </div>
        <Selo tom={tomDaSituacao(c.situacao)}>{c.titulo}</Selo>
      </div>
      <p className="small justify" style={{ lineHeight: 1.5, margin: 0 }}>{c.leitura}</p>
    </div>
  )
}

function CartaoDeLeitura({ titulo, d }: { titulo: string; d: Confluencia['fundamentalista'] }) {
  return (
    <div className="card-outline col" style={{ gap: 4 }}>
      <div className="row-between" style={{ gap: 8 }}>
        <strong className="small">{titulo}</strong>
        <Selo tom={tomDaPostura(d.postura)}>{rotuloDaPostura[d.postura]}</Selo>
      </div>
      <span className="small">{d.rotulo}</span>
      <span className="tiny muted justify">{d.detalhe}</span>
    </div>
  )
}

function Quadro({ c }: { c: Confluencia }) {
  const ativa = c.situacao
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(3, 1fr)', gap: 4, fontSize: 12 }} role="table" aria-label="Quadro de confluência entre fundamentos e gráfico">
      <div role="row" style={{ display: 'contents' }}>
        <span role="columnheader" />
        {POSTURAS.map((p) => <span key={p} role="columnheader" className="muted" style={{ textAlign: 'center', padding: '4px 2px' }}>Gráfico {ROTULO_NO_GRAFICO[p]}</span>)}
      </div>
      {POSTURAS.map((f) => (
        <div key={f} role="row" style={{ display: 'contents' }}>
          <span role="rowheader" className="muted" style={{ padding: '8px 6px 8px 0', alignSelf: 'center' }}>Fundamentos {ROTULO_NOS_FUNDAMENTOS[f]}</span>
          {POSTURAS.map((t) => {
            const s = SITUACAO_DA_CELULA[`${f}|${t}`]
            const marcada = s === ativa
            const tom = tomDaSituacao(s)
            return (
              <span
                key={t}
                role="cell"
                aria-current={marcada ? 'true' : undefined}
                style={{
                  padding: '10px 4px',
                  borderRadius: 10,
                  textAlign: 'center',
                  fontWeight: marcada ? 700 : 400,
                  border: marcada ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: marcada ? `color-mix(in oklch, ${tom === 'positivo' ? 'var(--success)' : tom === 'negativo' ? 'var(--danger)' : 'var(--warning)'} 22%, transparent)` : 'transparent',
                }}
              >
                {marcada ? 'Você está aqui' : tom === 'positivo' ? '↑ alinhado' : tom === 'negativo' ? '↓ cautela' : '·'}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
