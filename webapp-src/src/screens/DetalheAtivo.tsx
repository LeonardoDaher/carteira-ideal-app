import { useMemo, useState } from 'react'
import { ATIVOS } from '../data/assets'
import { ANALISES } from '../data/recomendacoes'
import type { ItemRecomendado } from '../data/recomendacoes'
import { AlertTriangleIcon, BarChartIcon, BrainIcon, ChevronDownIcon, PinIcon, TargetIcon } from '../ui/Icon'
import { SectorPieChart } from '../ui/AllocBar'
import type { AppCtx } from '../state/useAppState'
import type { AtivoKey } from '../domain/types'
import { ATIVOS_COM_CENARIO, TESOURO_POR_ATIVO } from '../domain/mercadoOficial'
import { TaxasTesouroHoje } from '../ui/TaxasTesouroHoje'
import { CenarioJuros } from '../ui/CenarioJuros'

/** Pluraliza a unidade contada em `setores[].fundos` (fundo/fundos, ação/ações ou BDR/BDRs). */
function rotuloUnidade(unidade: 'fundo' | 'acao' | 'bdr' | 'cdb' | 'etf' | 'moeda' | 'titulo' | 'lci' | undefined, qtd: number): string {
  if (unidade === 'acao') return qtd === 1 ? 'ação' : 'ações'
  if (unidade === 'bdr') return qtd === 1 ? 'BDR' : 'BDRs'
  if (unidade === 'cdb') return qtd === 1 ? 'CDB' : 'CDBs'
  if (unidade === 'etf') return qtd === 1 ? 'ETF' : 'ETFs'
  if (unidade === 'moeda') return qtd === 1 ? 'moeda' : 'moedas'
  if (unidade === 'titulo') return qtd === 1 ? 'título' : 'títulos'
  if (unidade === 'lci') return qtd === 1 ? 'LCI/LCA' : 'LCIs/LCAs'
  return qtd === 1 ? 'fundo' : 'fundos'
}

export function DetalheAtivo({ ctx }: { ctx: AppCtx }) {
  const ativo = ctx.ativoSelecionado
  const resultado = ctx.resultado
  const analise = ativo ? ANALISES[ativo] : undefined

  const [setoresAbertos, setSetoresAbertos] = useState<Set<string>>(new Set())
  const [tipoSelecionado, setTipoSelecionado] = useState<AtivoKey | undefined>(
    () => analise?.composicaoPorTipo?.tipos[0]?.chave,
  )
  const [objetivoId, setObjetivoId] = useState<string | undefined>(
    () => analise?.objetivos?.[0]?.id ?? analise?.composicaoPorTipo?.tipos[0]?.objetivos?.[0]?.id,
  )

  // Ativo com seletor de objetivo direto (ex.: um ativo simples que ainda não foi
  // agregado em `composicaoPorTipo`).
  const objetivoAtivo = analise?.objetivos?.find((o) => o.id === objetivoId) ?? analise?.objetivos?.[0]

  // Tipo selecionado dentro do agregado "Tesouro Direto" (ex.: chip "IPCA+", "Prefixado"
  // ou "Selic"), e — quando esse tipo tiver mais de um objetivo de uso (ex.: IPCA+) — o
  // objetivo selecionado dentro dele, exatamente como aparecia quando cada tipo era um
  // ativo separado na carteira.
  const tipoAtivo = analise?.composicaoPorTipo?.tipos.find((t) => t.chave === tipoSelecionado) ?? analise?.composicaoPorTipo?.tipos[0]
  const objetivoDoTipo = tipoAtivo?.objetivos?.find((o) => o.id === objetivoId) ?? tipoAtivo?.objetivos?.[0]

  const setoresAtuais = objetivoAtivo?.setores ?? objetivoDoTipo?.setores ?? tipoAtivo?.setores ?? analise?.setores
  const blocosAtuais = objetivoAtivo?.blocos ?? objetivoDoTipo?.blocos ?? tipoAtivo?.blocos ?? analise?.blocos ?? []
  const notaSetoresAtual = objetivoAtivo?.notaSetores ?? objetivoDoTipo?.notaSetores ?? tipoAtivo?.notaSetores ?? analise?.notaSetores

  // Blocos "Exemplos por setor/segmento" trazem, em cada item, a mesma `cor` do
  // segmento correspondente em `setoresAtuais`. Usamos essa cor para casar cada
  // segmento com seu exemplo ilustrativo e exibi-lo só quando o segmento é tocado,
  // em vez de listar todos os exemplos sempre visíveis. Blocos sem essa cor em
  // todos os itens (ex.: "Onde acompanhar") continuam sendo exibidos normalmente.
  const exemplosPorCor = useMemo(() => {
    const mapa = new Map<string, ItemRecomendado>()
    for (const bloco of blocosAtuais) {
      if (bloco.itens.length > 0 && bloco.itens.every((item) => item.cor)) {
        for (const item of bloco.itens) mapa.set(item.cor as string, item)
      }
    }
    return mapa
  }, [blocosAtuais])

  if (!ativo || !resultado || !analise) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="muted small">Nenhum ativo selecionado.</div>
        <button className="btn btn-outline" onClick={ctx.voltarDoDetalhe}>Voltar</button>
      </div>
    )
  }

  const info = ATIVOS[ativo]
  // Dados oficiais (D15): no agregado "Tesouro Direto", as taxas acompanham o chip
  // escolhido (Selic, Prefixado ou IPCA+).
  const tesouroExibido = TESOURO_POR_ATIVO[tipoAtivo?.chave ?? ativo]
  const mostraCenario = ATIVOS_COM_CENARIO.includes(tipoAtivo?.chave ?? ativo)
  // Quando o ativo agrega outras classes na exibição (ex.: Tesouro Direto agrega
  // Selic + Prefixado + IPCA+), o "peso na carteira" mostrado aqui é a soma das
  // classes agregadas, não só o valor bruto da chave `ativo`.
  const pct = analise.composicaoPorTipo
    ? analise.composicaoPorTipo.tipos.reduce((soma, t) => soma + (resultado.carteira[t.chave] ?? 0), 0)
    : resultado.carteira[ativo] ?? 0

  const blocosRestantes = blocosAtuais.filter(
    (bloco) => !(bloco.itens.length > 0 && bloco.itens.every((item) => item.cor)),
  )

  function alternarSetor(label: string) {
    setSetoresAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(label)) novo.delete(label)
      else novo.add(label)
      return novo
    })
  }

  function abrirSetor(label: string) {
    setSetoresAbertos((atual) => new Set(atual).add(label))
  }

  function trocarObjetivo(id: string) {
    setObjetivoId(id)
    setSetoresAbertos(new Set())
  }

  function trocarTipo(chave: AtivoKey) {
    const novoTipo = analise?.composicaoPorTipo?.tipos.find((t) => t.chave === chave)
    setTipoSelecionado(chave)
    setObjetivoId(novoTipo?.objetivos?.[0]?.id)
    setSetoresAbertos(new Set())
  }

  return (
    <div className="screen">
      <button className="btn-ghost" style={{ alignSelf: 'flex-start', padding: 0, fontWeight: 600, fontSize: 13 }} onClick={ctx.voltarDoDetalhe}>
        ← Voltar
      </button>

      <div className="row" style={{ gap: 10, alignItems: 'center' }}>
        <div className="alloc-dot" style={{ background: info.cor, width: 14, height: 14 }} />
        <h1 style={{ fontSize: 20 }}>{info.label}</h1>
      </div>

      <div className="card col" style={{ gap: 4, alignItems: 'center', textAlign: 'center' }}>
        <span className="small muted">Peso na sua carteira</span>
        <span className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</span>
      </div>

      <div className="card-outline col" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13.5 }}><PinIcon size={15} /> Contexto</div>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>{analise.contexto}</div>
      </div>

      {analise.composicaoPorTipo ? (
        <div className="col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13.5 }}>
            <TargetIcon size={15} />
            {analise.composicaoPorTipo.titulo}
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {analise.composicaoPorTipo.tipos.map((t) => (
              <button
                key={t.chave}
                className={`chip ${t.chave === tipoAtivo?.chave ? 'selected' : ''}`}
                onClick={() => trocarTipo(t.chave)}
              >
                {t.label} - {resultado.carteira[t.chave] ?? 0}%
              </button>
            ))}
          </div>

          {tipoAtivo?.objetivos && (
            <div className="col" style={{ gap: 8, marginTop: 4 }}>
              <div className="small" style={{ fontWeight: 700 }}>
                {tipoAtivo.tituloObjetivos ?? `Qual é o seu objetivo com ${tipoAtivo.label}?`}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {tipoAtivo.objetivos.map((o) => (
                  <button
                    key={o.id}
                    className={`chip ${o.id === objetivoDoTipo?.id ? 'selected' : ''}`}
                    onClick={() => trocarObjetivo(o.id)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {objetivoDoTipo && (
                <div className="muted tiny justify" style={{ lineHeight: 1.5 }}>{objetivoDoTipo.resumo}</div>
              )}
            </div>
          )}
        </div>
      ) : analise.objetivos && (
        <div className="col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13.5 }}>
            <TargetIcon size={15} />
            {analise.tituloObjetivos ?? `Qual é o seu objetivo com ${info.label}?`}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {analise.objetivos.map((o) => (
              <button
                key={o.id}
                className={`chip ${o.id === objetivoAtivo?.id ? 'selected' : ''}`}
                onClick={() => trocarObjetivo(o.id)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {objetivoAtivo && (
            <div className="muted tiny justify" style={{ lineHeight: 1.5 }}>{objetivoAtivo.resumo}</div>
          )}
        </div>
      )}

      {setoresAtuais && (
        <div className="col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13.5 }}>
            <BarChartIcon size={15} />
            Carteira com {setoresAtuais.reduce((soma, s) => soma + (s.fundos ?? 0), 0)} ativos - Diversificação por segmento
          </div>
          <div className="card col" style={{ gap: 10 }}>
            <div style={{ padding: '4px 0' }}>
              <SectorPieChart
                setores={setoresAtuais}
                onSlicePress={(label) => {
                  const setor = setoresAtuais!.find((s) => s.label === label)
                  if (setor && exemplosPorCor.has(setor.cor)) abrirSetor(label)
                }}
              />
            </div>
          </div>

          <div className="col" style={{ gap: 8 }}>
            {setoresAtuais.map((s) => {
              const exemplo = exemplosPorCor.get(s.cor)
              const aberto = setoresAbertos.has(s.label)
              return (
                <div key={s.label} className="card-outline col" style={{ gap: 4, padding: 0, overflow: 'hidden' }}>
                  <button
                    className="setor-card-toggle"
                    onClick={() => exemplo && alternarSetor(s.label)}
                    style={{ cursor: exemplo ? 'pointer' : 'default' }}
                    disabled={!exemplo}
                    aria-expanded={exemplo ? aberto : undefined}
                  >
                    <div className="col" style={{ gap: 4, width: '100%' }}>
                      <div className="row-between">
                        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                          <div className="alloc-dot" style={{ background: s.cor }} />
                          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{s.label}</span>
                        </div>
                        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                          {s.fundos !== undefined && (
                            <span className="contagem-setor">
                              {s.fundos} {rotuloUnidade(s.unidade, s.fundos)}
                            </span>
                          )}
                          <span className="font-display" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{s.pct}%</span>
                          {exemplo && (
                            <ChevronDownIcon
                              size={15}
                              className="muted"
                              style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }}
                            />
                          )}
                        </div>
                      </div>
                      {s.funcao && <span className="muted tiny justify" style={{ lineHeight: 1.4 }}>{s.funcao}</span>}
                    </div>
                  </button>

                  {exemplo && aberto && (
                    <div className="col" style={{ gap: 4, padding: '0 14px 14px' }}>
                      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 6px' }} />
                      <span className="tiny" style={{ fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                        Exemplos
                      </span>
                      <span className="muted tiny justify" style={{ lineHeight: 1.5, display: 'block' }}>{exemplo.detalhe}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="tiny muted" style={{ textAlign: 'center' }}>
            Toque num segmento para ver exemplos ilustrativos • a proporção real muda com o tempo e depende dos ativos que você escolher.
          </div>

          {notaSetoresAtual && (
            <div className="card small row" style={{ gap: 8, alignItems: 'flex-start', background: 'color-mix(in oklch, var(--accent) 14%, var(--surface))', border: '1px solid var(--accent)', lineHeight: 1.5 }}>
              <TargetIcon size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent)' }} />
              <span className="justify" style={{ color: 'var(--text)', display: 'block' }}>{notaSetoresAtual}</span>
            </div>
          )}
        </div>
      )}

      {blocosRestantes.map((bloco) => (
        <div key={bloco.titulo} className="col" style={{ gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{bloco.titulo}</div>
          <div className="col" style={{ gap: 8 }}>
            {bloco.itens.map((item) => (
              <div key={item.nome} className="card-outline col" style={{ gap: 3 }}>
                <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                  {item.cor && <div className="alloc-dot" style={{ background: item.cor, flexShrink: 0 }} />}
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{item.nome}</span>
                </div>
                <span className="muted tiny justify" style={{ lineHeight: 1.4, display: 'block' }}>{item.detalhe}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Dados oficiais de mercado (D15): depois da carteira e dos exemplos, antes da análise */}
      {tesouroExibido && <TaxasTesouroHoje familia={tesouroExibido.familia} indexador={tesouroExibido.indexador} />}

      {mostraCenario && <CenarioJuros />}

      <div className="col" style={{ gap: 8 }}>
        <div className="row" style={{ gap: 6, fontWeight: 700, fontSize: 13.5 }}><BrainIcon size={15} /> Como um consultor CEA/CNPI analisa</div>
        <div className="card col" style={{ gap: 8 }}>
          {analise.criterios.map((criterio, i) => (
            <div key={i} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>{i + 1}.</span>
              <span className="small justify" style={{ lineHeight: 1.5, display: 'block' }}>{criterio}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card small row" style={{ gap: 8, alignItems: 'flex-start', background: 'color-mix(in oklch, var(--warning) 14%, var(--surface))', border: '1px solid var(--warning)', lineHeight: 1.5, color: 'var(--warning)' }}>
        <AlertTriangleIcon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span className="justify" style={{ color: 'var(--text)', display: 'block' }}>{analise.atencao}</span>
      </div>

      <div className="tiny muted justify" style={{ lineHeight: 1.5 }}>
        Conteúdo educativo com fins ilustrativos, sem caráter de recomendação de compra. Cotações,
        dividend yield e P/VP mudam diariamente — confira dados atualizados e, se precisar, consulte
        um profissional certificado (CEA/CFP) antes de decidir.
      </div>

      <button className="btn btn-outline" onClick={ctx.voltarDoDetalhe}>
        Voltar
      </button>
    </div>
  )
}
