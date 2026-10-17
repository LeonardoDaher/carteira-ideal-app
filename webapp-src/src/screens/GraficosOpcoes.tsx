import { useMemo, useState } from 'react'
import { dadosNegociosPorStrike, distanciaDoPreco, FAIXAS_DO_GRAFICO } from '../domain/graficoNegocios'
import type { Metrica, ModoTipos } from '../domain/graficoNegocios'
import { diasUteis, tipoVencimento, vencimentosDe } from '../domain/opcoes'
import type { AtivoComOpcoes, SnapshotOpcoes } from '../domain/opcoes'
import { formatarData } from '../domain/rendaFii'
import { EscolhaDeAtivo } from './EscolhaDeAtivo'
import { GraficoPorStrike } from '../ui/GraficoPorStrike'
import type { LinhaVisual } from '../ui/GraficoPorStrike'

// Uma cor por vencimento (meios-tons que se leem nos temas claro e escuro). Calls em traço cheio e puts tracejadas.
const CORES = ['#2563eb', '#ea580c', '#059669', '#9333ea', '#db2777', '#0891b2', '#ca8a04', '#4b5563']
const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const inteiro = (v: number) => Math.round(v).toLocaleString('pt-BR')
const compacto = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `${Math.round(v / 1e3).toLocaleString('pt-BR')} mil` : inteiro(v))
const strikeTexto = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const MODOS: { id: ModoTipos; titulo: string }[] = [
  { id: 'separados', titulo: 'Calls e puts separadas' },
  { id: 'soma', titulo: 'Calls e puts somadas' },
  { id: 'calls', titulo: 'Só calls' },
  { id: 'puts', titulo: 'Só puts' },
]

/**
 * Aba Gráficos. O primeiro gráfico mostra onde o mercado negociou no último pregão: negócios (ou volume financeiro) por strike,
 * para os vencimentos que a pessoa escolher dentro dos próximos 6 meses, com calls e puts, americanas e europeias.
 */
export function GraficosOpcoes({ snapshot, ativo, onEscolher }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes | null; onEscolher: (ticker: string) => void }) {
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
      <EscolhaDeAtivo snapshot={snapshot} ativo={ativo} onEscolher={onEscolher} />
      <NegociosPorStrike key={ativo.ticker} snapshot={snapshot} ativo={ativo} />
    </>
  )
}

function NegociosPorStrike({ snapshot, ativo }: { snapshot: SnapshotOpcoes; ativo: AtivoComOpcoes }) {
  const hoje = snapshot.dataPregao ?? new Date().toISOString().slice(0, 10)
  const vencimentos = useMemo(() => vencimentosDe(ativo.series), [ativo])
  const mensais = vencimentos.filter((v) => tipoVencimento(v) === 'mensal')
  const semanais = vencimentos.filter((v) => tipoVencimento(v) === 'semanal')
  const padrao = vencimentos.find((v) => tipoVencimento(v) === 'mensal' && diasUteis(v, hoje) >= 10) ?? vencimentos[0]

  const [escolhidos, setEscolhidos] = useState<string[]>(padrao ? [padrao] : [])
  const [modo, setModo] = useState<ModoTipos>('separados')
  const [metrica, setMetrica] = useState<Metrica>('negocios')
  const [faixa, setFaixa] = useState<number | null>(20)
  const [escala, setEscala] = useState<'real' | 'relativa'>('real')

  const alternar = (v: string) => setEscolhidos((e) => (e.includes(v) ? e.filter((x) => x !== v) : [...e, v].sort()))
  const dados = useMemo(
    () => dadosNegociosPorStrike(ativo, escolhidos, modo, metrica, snapshot.dataPregao, faixa),
    [ativo, escolhidos, modo, metrica, snapshot.dataPregao, faixa],
  )
  const formatar = metrica === 'negocios' ? inteiro : compacto
  const ordenados = [...escolhidos].sort()
  const nome = metrica === 'negocios' ? 'Negócios' : 'Volume financeiro (R$)'

  const linhasVisuais: LinhaVisual[] = dados.linhas.map((l) => ({
    id: l.id,
    rotulo: `${dataCurta(l.vencimento)}${l.tipo === 'call' ? ' calls' : l.tipo === 'put' ? ' puts' : ''}`,
    cor: CORES[ordenados.indexOf(l.vencimento) % CORES.length],
    tracejada: l.tipo === 'put',
    valores: escala === 'relativa' ? l.valores.map((v) => (l.picoValor > 0 ? (v / l.picoValor) * 100 : 0)) : l.valores,
    leitura: l.valores,
  }))
  const comPico = dados.linhas.filter((l) => l.picoStrike !== null)
  const maior = comPico.reduce<(typeof comPico)[number] | null>((m, l) => (m === null || l.picoValor > m.picoValor ? l : m), null)
  const descricao = maior
    ? `${nome} por strike de ${ativo.ticker}. O maior valor é de ${formatar(maior.picoValor)}, no strike ${strikeTexto(maior.picoStrike!)}.`
    : `${nome} por strike de ${ativo.ticker}: sem negócios no último pregão nos vencimentos escolhidos.`

  const linhasDaTabela = dados.strikes
    .map((k, i) => ({ k, i }))
    .filter(({ i }) => dados.linhas.some((l) => l.valores[i] > 0))

  return (
    <>
      <div className="card col" style={{ gap: 12 }} role="group" aria-label="Opções do gráfico">
        <span style={{ fontWeight: 700 }}>{nome} por strike</span>

        <fieldset className="col" style={{ gap: 8, border: 'none', padding: 0, margin: 0 }}>
          <legend className="small" style={{ fontWeight: 600, padding: 0, marginBottom: 6 }}>Vencimentos (próximos 6 meses)</legend>
          {([['mensal', 'Mensais (terceira sexta-feira)', mensais], ['semanal', 'Semanais', semanais]] as const).map(([grupo, titulo, lista]) =>
            lista.length > 0 && (
              <div key={grupo} className="col" style={{ gap: 6 }} role="group" aria-label={`Vencimentos ${grupo === 'mensal' ? 'mensais' : 'semanais'}`}>
                <span className="tiny muted">{titulo}</span>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {lista.map((v) => {
                    const marcado = escolhidos.includes(v)
                    return (
                      <label key={v} className={`chip ${marcado ? 'selected' : ''}`} style={{ cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <input type="checkbox" checked={marcado} onChange={() => alternar(v)} style={{ accentColor: 'currentColor' }} />
                        {formatarData(v)} ({diasUteis(v, hoje)} d.u.)
                      </label>
                    )
                  })}
                </div>
              </div>
            ),
          )}
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <button className="chip" onClick={() => setEscolhidos([...mensais])}>Só mensais</button>
            <button className="chip" onClick={() => setEscolhidos([...semanais])} disabled={semanais.length === 0}>Só semanais</button>
            <button className="chip" onClick={() => setEscolhidos([...vencimentos])}>Todos</button>
            <button className="chip" onClick={() => setEscolhidos([])}>Limpar</button>
          </div>
        </fieldset>

        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600 }}>Tipo de opção</span>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Tipo de opção do gráfico">
            {MODOS.map((m) => (
              <button key={m.id} className={`chip ${modo === m.id ? 'selected' : ''}`} aria-pressed={modo === m.id} onClick={() => setModo(m.id)}>
                {m.titulo}
              </button>
            ))}
          </div>
          <span className="tiny muted">Inclui séries americanas e europeias: o estilo não faz diferença para este gráfico.</span>
        </div>

        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>O que contar</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Medida do gráfico">
              {([['negocios', 'Negócios'], ['volume', 'Volume financeiro']] as [Metrica, string][]).map(([v, titulo]) => (
                <button key={v} className={`chip ${metrica === v ? 'selected' : ''}`} aria-pressed={metrica === v} onClick={() => setMetrica(v)}>
                  {titulo}
                </button>
              ))}
            </div>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Escala</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Escala do gráfico">
              {([['real', 'Valores reais'], ['relativa', 'Cada linha em % do pico']] as ['real' | 'relativa', string][]).map(([v, titulo]) => (
                <button key={v} className={`chip ${escala === v ? 'selected' : ''}`} aria-pressed={escala === v} onClick={() => setEscala(v)}>
                  {titulo}
                </button>
              ))}
            </div>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Strikes mostrados</span>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Faixa de strikes do gráfico">
              {FAIXAS_DO_GRAFICO.map((f) => (
                <button key={String(f)} className={`chip ${faixa === f ? 'selected' : ''}`} aria-pressed={faixa === f} onClick={() => setFaixa(f)}>
                  {f === null ? 'Todos' : `±${f}% do preço`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {escolhidos.length === 0 ? (
        <div className="card-outline small justify" role="status">
          <strong>Escolha pelo menos um vencimento</strong> <span className="muted">para ver o gráfico.</span>
        </div>
      ) : dados.strikes.length === 0 ? (
        <div className="card-outline small justify" role="status">
          <span className="muted">Nenhuma série nessa faixa de strikes. Amplie a faixa.</span>
        </div>
      ) : (
        <div className="card col" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap' }} aria-label="Legenda" role="group">
            {linhasVisuais.map((l) => (
              <span key={l.id} className="small" data-testid="legenda-linha">
                <span style={{ color: l.cor, fontWeight: 700 }} aria-hidden="true">{l.tracejada ? '┅┅' : '━━'}</span> {l.rotulo}
              </span>
            ))}
          </div>
          <div style={{ width: '100%', maxWidth: 760, marginInline: 'auto' }}>
            <GraficoPorStrike
              strikes={dados.strikes}
              linhas={linhasVisuais}
              precoAtivo={ativo.cotacao}
              formatarValor={escala === 'relativa' ? (v) => `${Math.round(v)}%` : formatar}
              formatarLeitura={formatar}
              descricao={descricao}
            />
          </div>
          {escala === 'relativa' && (
            <span className="tiny muted" data-testid="nota-escala">
              Eixo vertical em % do maior valor de cada linha: serve para comparar o formato entre vencimentos de tamanhos diferentes. Ao ler um strike, os valores são os reais.
            </span>
          )}

          <div className="col" style={{ gap: 4 }} data-testid="picos">
            {dados.linhas.map((l, i) => (
              <span key={l.id} className="small">
                <span style={{ color: linhasVisuais[i].cor, fontWeight: 700 }}>{linhasVisuais[i].rotulo || dataCurta(l.vencimento)}</span>{' '}
                {l.picoStrike === null ? (
                  <span className="muted">sem negócios no último pregão nesta faixa.</span>
                ) : (
                  <span className="muted">
                    pico no strike <strong>{strikeTexto(l.picoStrike)}</strong> ({distanciaDoPreco(l.picoStrike, ativo.cotacao) > 0 ? '+' : ''}
                    {distanciaDoPreco(l.picoStrike, ativo.cotacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do preço), com {formatar(l.picoValor)}; total de {formatar(l.total)}.
                  </span>
                )}
              </span>
            ))}
          </div>

          <details>
            <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Ver os números ({linhasDaTabela.length} strikes com negócios)</summary>
            <div style={{ overflowX: 'auto', marginTop: 8 }} className="card-outline">
              <table className="tabela-opcoes small">
                <thead>
                  <tr>
                    <th scope="col">Strike</th>
                    <th scope="col">% do preço</th>
                    {linhasVisuais.map((l) => <th key={l.id} scope="col">{l.rotulo}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {linhasDaTabela.map(({ k, i }) => (
                    <tr key={k} data-testid="linha-numeros">
                      <td className="num">{strikeTexto(k)}</td>
                      <td className="num">{distanciaDoPreco(k, ativo.cotacao).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                      {dados.linhas.map((l) => <td key={l.id} className="num">{l.valores[i] > 0 ? formatar(l.valores[i]) : '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Como ler.</strong> O gráfico mostra onde o mercado negociou no último pregão{snapshot.dataPregao ? ` (${formatarData(snapshot.dataPregao)})` : ''}, somando séries
        americanas e europeias. Os negócios costumam se concentrar perto do preço do ativo, com picos em strikes redondos; as calls tendem a negociar
        mais acima do preço e as puts, abaixo. Não é uma curva lisa nem simétrica. Séries que não negociaram no último pregão contam zero. Muito
        negócio num strike indica onde há liquidez, e não onde o preço vai.
      </div>
    </>
  )
}
