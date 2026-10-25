import type { ReactNode } from 'react'
import type { DadosDaAnalise } from './useAnaliseDaAcao'
import { ROTULO_CATEGORIA, ROTULO_RECOMENDACAO } from '../domain/analiseFundamentalista'
import type { AnaliseFundamentalista, CategoriaAnalise, ColunaHistorica, Indicador, Nota, Recomendacao, Risco } from '../domain/analiseFundamentalista'
import { MiniGrafico } from '../ui/MiniGrafico'
import { AvisoDaAnalise, BarraDeNota, EstadoDoArquivo, Linha, Modulo, Selo } from '../ui/BlocosDeAnalise'
import type { Tom } from '../ui/BlocosDeAnalise'
import { corDoSinal, dataLonga, formatarIndicador, fracaoEmPercentual, milReais, numero, percentual, reais } from '../ui/formatoAnalise'

const tomDaCategoria = (c: CategoriaAnalise): Tom => (c === 'atrativa' || c === 'atrativa-com-ressalvas' ? 'positivo' : c === 'neutra' ? 'neutro' : 'negativo')
const tomDaRecomendacao = (r: Recomendacao): Tom => (r === 'considerar-entrada' ? 'positivo' : r === 'manter-acompanhar' || r === 'aguardar-preco' ? 'neutro' : 'negativo')

/** Aba "Análise fundamentalista": indicadores da CVM, valor justo por cenário, notas, alertas e leitura final, tudo calculado por regra. */
export function AnaliseFundamentalistaAcao({ dados, ticker, nome }: { dados: DadosDaAnalise; ticker: string; nome: string | null }) {
  if (dados.fundamentos.tipo !== 'pronto') {
    return <EstadoDoArquivo estado={dados.fundamentos.tipo} aoTentarDeNovo={dados.recarregarFundamentos} nome="os fundamentos da CVM" />
  }
  const f = dados.fundamentalista
  if (!f) {
    return (
      <div className="card col" style={{ gap: 6 }} role="status">
        <span style={{ fontWeight: 700 }}>Análise fundamentalista indisponível para {ticker}</span>
        <span className="muted small justify">{dados.semFundamentos}</span>
      </div>
    )
  }
  return (
    <div className="col" style={{ gap: 14 }} data-testid="analise-fundamentalista">
      <ResumoFundamentalista f={f} nome={nome} />

      <Modulo titulo="Indicadores atuais" subtitulo={`12 meses até ${dataLonga(f.dados.ultimoTrimestre)}`} aberto>
        <div className="col" style={{ gap: 14 }}>
          <Grupo titulo="Rentabilidade e eficiência" indicadores={f.rentabilidade} />
          <Grupo titulo={f.financeira ? 'Capitalização' : 'Endividamento e geração de caixa'} indicadores={f.endividamentoECaixa} />
        </div>
        <span className="tiny muted justify">Toque em um indicador para ver a fórmula, a fonte, a interpretação e o histórico.</span>
      </Modulo>

      <Modulo titulo="Histórico de 5 exercícios e 12 meses" subtitulo={`${f.dados.exercicios} exercícios completos`}>
        <TabelaHistorica colunas={f.historico} financeira={f.financeira} />
        <span className="small muted justify">{f.crescimento.leitura}</span>
        <div className="col" style={{ gap: 0 }}>
          <Linha rotulo={`Crescimento composto da receita (${f.cagr.anos} anos)`} valor={f.cagr.receita === null ? '—' : fracaoEmPercentual(f.cagr.receita)} />
          <Linha rotulo="Crescimento composto do lucro" valor={f.cagr.lucro === null ? '— (base negativa)' : fracaoEmPercentual(f.cagr.lucro)} />
          <Linha rotulo="Crescimento composto do lucro por ação" valor={f.cagr.lpa === null ? '— (base negativa)' : fracaoEmPercentual(f.cagr.lpa)} />
        </div>
        <span className="tiny muted justify">Crescimento nominal, sem separar o efeito da inflação. Lucro é o reportado: itens não recorrentes podem distorcer qualquer ano.</span>
      </Modulo>

      <Modulo titulo="Valuation e comparação setorial">
        <div className="col" style={{ gap: 0 }}>
          {f.mercado.preco !== null && <Linha rotulo="Preço de fechamento" valor={reais(f.mercado.preco)} />}
          {f.mercado.valorMercado !== null && <Linha rotulo="Valor de mercado" valor={milReais(f.mercado.valorMercado)} />}
          {f.mercado.ev !== null && <Linha rotulo="Valor da empresa (EV)" valor={milReais(f.mercado.ev)} />}
          {f.mercado.acoes !== null && <Linha rotulo="Ações em circulação" valor={numero(f.mercado.acoes / 1e6, 1) + ' mi'} />}
        </div>
        <Grupo titulo="Múltiplos frente à mediana do setor" indicadores={f.multiplos} mostrarSetor />
        <span className="tiny muted justify">
          A referência é a mediana das outras empresas do mesmo setor no cadastro do app (precisa de ao menos 4 com o múltiplo). Empresas de modelos de negócio, contabilidade e endividamento diferentes não são plenamente comparáveis. Sem série de preços de 5 anos, não há comparação com o histórico da própria empresa.
        </span>
      </Modulo>

      <ValorJustoModulo f={f} />

      <Modulo titulo="Dividendos">
        <span className="small justify">{f.dividendos.leitura}</span>
        <Grupo titulo="" indicadores={f.dividendos.indicadores} />
      </Modulo>

      <Modulo titulo="Vantagem competitiva e crescimento" subtitulo="indícios financeiros">
        <div className="row-between" style={{ gap: 8 }}>
          <strong className="small">Vantagem competitiva</strong>
          <Selo tom={f.vantagem.classificacao === 'forte' ? 'positivo' : f.vantagem.classificacao === 'moderada' ? 'neutro' : 'negativo'}>
            {{ forte: 'Forte', moderada: 'Moderada', fraca: 'Fraca', 'nao-demonstrada': 'Não demonstrada' }[f.vantagem.classificacao]}
          </Selo>
        </div>
        <ul className="small col" style={{ gap: 3, paddingLeft: 18, margin: 0 }}>
          {f.vantagem.evidencias.map((e) => <li key={e}>{e}</li>)}
        </ul>
        <span className="tiny muted justify">{f.vantagem.limite}</span>
        <span className="small justify">{f.crescimento.leitura}</span>
        <span className="tiny muted justify">{f.crescimento.origem}</span>
      </Modulo>

      <Modulo titulo="Governança, gestão e riscos">
        <div className="col" style={{ gap: 8 }}>
          {f.governanca.itens.map((i) => (
            <div key={i.tema} className="col" style={{ gap: 2 }}>
              <strong className="small">{i.tema}</strong>
              <span className="small muted justify">{i.situacao}</span>
            </div>
          ))}
        </div>
        <div className="col" style={{ gap: 8 }}>
          <strong className="small">Principais riscos específicos</strong>
          {f.riscos.especificos.map((r) => <CartaoDeRisco key={r.titulo} r={r} />)}
          <strong className="small">Principais riscos externos (típicos do setor)</strong>
          {f.riscos.externos.map((r) => <CartaoDeRisco key={r.titulo} r={r} />)}
        </div>
      </Modulo>

      <Modulo titulo="Pontuação fundamentalista" subtitulo={`${f.pontuacao.total ?? '—'} de 100${f.pontuacao.parcial ? ' (parcial)' : ''}`} aberto>
        <div className="col" style={{ gap: 12 }}>
          <NotaDetalhada n={f.pontuacao.qualidade} />
          <NotaDetalhada n={f.pontuacao.valuation} />
          <NotaDetalhada n={f.pontuacao.risco} />
          <BarraDeNota rotulo="Nota consolidada" valor={f.pontuacao.total} detalhe={`Média ponderada: qualidade ${Math.round(f.pontuacao.pesos.qualidade * 100)}%, valuation ${Math.round(f.pontuacao.pesos.valuation * 100)}%, segurança ${Math.round(f.pontuacao.pesos.risco * 100)}% (pesos iniciais, não verdades universais).${f.pontuacao.parcial ? ' Uma das dimensões não pôde ser avaliada, então a nota é parcial.' : ''}`} />
        </div>
        <span className="tiny muted justify">Uma nota alta não neutraliza um alerta crítico: a categoria final considera os alertas, e dados ausentes ficam registrados em cada critério.</span>
      </Modulo>

      <Modulo titulo="Alertas" subtitulo={f.alertas.length ? `${f.alertas.length}` : 'nenhum'} aberto={f.alertas.some((a) => a.gravidade !== 'info')}>
        {f.alertas.length === 0 ? (
          <span className="small muted">Nenhum alerta disparado pelas regras.</span>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {f.alertas.map((a) => (
              <div key={a.id} className={`card-outline col${a.gravidade === 'critico' ? ' aviso-atraso' : ''}`} style={{ gap: 2, borderLeft: a.gravidade === 'critico' ? '4px solid var(--danger)' : undefined }} data-testid={`alerta-${a.id}`}>
                <div className="row-between" style={{ gap: 8 }}>
                  <strong className="small">{a.titulo}</strong>
                  <Selo tom={a.gravidade === 'critico' ? 'negativo' : a.gravidade === 'atencao' ? 'neutro' : 'positivo'}>{a.gravidade === 'critico' ? 'Crítico' : a.gravidade === 'atencao' ? 'Atenção' : 'Informação'}</Selo>
                </div>
                <span className="small muted justify">{a.detalhe}</span>
              </div>
            ))}
          </div>
        )}
      </Modulo>

      <Modulo titulo="Leitura final" aberto>
        <div className="row-between" style={{ gap: 8 }}>
          <Selo tom={tomDaCategoria(f.categoria)}>{ROTULO_CATEGORIA[f.categoria]}</Selo>
          <Selo tom={tomDaRecomendacao(f.recomendacao.categoria)}>{ROTULO_RECOMENDACAO[f.recomendacao.categoria]}</Selo>
        </div>
        <ul className="small col" style={{ gap: 3, paddingLeft: 18, margin: 0 }}>
          {f.recomendacao.justificativa.map((j) => <li key={j}>{j}</li>)}
        </ul>
        {f.recomendacao.reavaliar.length > 0 && (
          <div className="col" style={{ gap: 2 }}>
            <strong className="small">O que justificaria uma reavaliação</strong>
            <ul className="small col" style={{ gap: 3, paddingLeft: 18, margin: 0 }}>
              {f.recomendacao.reavaliar.map((j) => <li key={j}>{j}</li>)}
            </ul>
          </div>
        )}
        <span className="tiny muted justify">Esta leitura decorre das notas, dos alertas e do valor justo, nunca só de um número. “{ROTULO_RECOMENDACAO[f.recomendacao.categoria]}” é a classificação do modelo, não uma ordem de compra ou venda.</span>
      </Modulo>

      <Modulo titulo="Fontes, data de atualização e limitações">
        <div className="col" style={{ gap: 0 }}>
          <Linha rotulo="Fonte" valor="CVM, dados abertos (DFP e ITR)" />
          <Linha rotulo="Último exercício" valor={f.dados.ultimoExercicio ? dataLonga(f.dados.ultimoExercicio) : '—'} />
          <Linha rotulo="Último documento" valor={f.dados.documento} />
          <Linha rotulo="Fundamentos atualizados em" valor={f.dados.geradoEm ? dataLonga(f.dados.geradoEm.slice(0, 10)) : '—'} />
          <Linha rotulo="Preço de fechamento de" valor={f.dados.dataCorte ? dataLonga(f.dados.dataCorte) : '—'} />
        </div>
        <ul className="small muted col" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
          {f.dados.limitacoes.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <span className="tiny muted justify">Valores calculados pelo app a partir das demonstrações; confira sempre nos documentos originais da CVM antes de decidir.</span>
      </Modulo>

      <AvisoDaAnalise />
    </div>
  )
}

function ResumoFundamentalista({ f, nome }: { f: AnaliseFundamentalista; nome: string | null }) {
  const vj = f.valorJusto
  const base = vj.cenarios.find((c) => c.cenario === 'base')?.valorJusto ?? null
  return (
    <div className="card col" style={{ gap: 10 }} data-testid="resumo-fundamentalista">
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="col" style={{ gap: 2 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 20 }}>{f.ticker}</span>
          <span className="tiny muted">{nome ?? f.nome} · {f.setor}</span>
        </div>
        <div className="col" style={{ gap: 4, alignItems: 'flex-end' }}>
          <Selo tom={tomDaCategoria(f.categoria)}>{ROTULO_CATEGORIA[f.categoria]}</Selo>
          <span className="tiny muted">Nota {f.pontuacao.total ?? '—'}{f.pontuacao.parcial ? ' (parcial)' : ''}</span>
        </div>
      </div>
      <p className="small justify" style={{ lineHeight: 1.5, margin: 0 }}>{f.resumo}</p>
      <div className="row" style={{ gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <Caixa titulo="Preço" valor={f.mercado.preco === null ? '—' : reais(f.mercado.preco)} />
        <Caixa titulo="Valor justo (base)" valor={vj.aplicavel && base !== null ? reais(base) : '—'} sub={vj.faixa ? `faixa ${reais(vj.faixa.minimo)} a ${reais(vj.faixa.maximo)}` : 'dados insuficientes'} />
        <Caixa titulo="Margem de segurança" valor={vj.margemSegurancaPct === null ? '—' : `${numero(vj.margemSegurancaPct, 0)}%`} sub={vj.precoEntrada ? `entrada ≈ ${reais(vj.precoEntrada)}` : undefined} cor={corDoSinal(vj.margemSegurancaPct)} />
      </div>
      {f.alertas.some((a) => a.gravidade === 'critico') && (
        <div className="card-outline small aviso-atraso" role="note">
          <strong>Alerta crítico.</strong> <span className="muted">{f.alertas.filter((a) => a.gravidade === 'critico').map((a) => a.titulo).join('; ')}.</span>
        </div>
      )}
    </div>
  )
}

function Caixa({ titulo, valor, sub, cor }: { titulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <div className="col" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--surface2)', gap: 2, flex: '1 1 120px' }}>
      <span className="tiny muted">{titulo}</span>
      <span className="font-display" style={{ fontWeight: 700, fontSize: 17, color: cor }}>{valor}</span>
      {sub && <span className="tiny muted">{sub}</span>}
    </div>
  )
}

function Grupo({ titulo, indicadores, mostrarSetor = false }: { titulo: string; indicadores: Indicador[]; mostrarSetor?: boolean }) {
  return (
    <div className="col" style={{ gap: 0 }}>
      {titulo && <strong className="small" style={{ marginBottom: 4 }}>{titulo}</strong>}
      {indicadores.map((i) => <LinhaIndicador key={i.id} i={i} mostrarSetor={mostrarSetor} />)}
    </div>
  )
}

function LinhaIndicador({ i, mostrarSetor }: { i: Indicador; mostrarSetor: boolean }) {
  return (
    <details style={{ borderBottom: '1px solid var(--border)' }} data-testid={`indicador-${i.id}`}>
      <summary className="small" style={{ cursor: 'pointer', padding: '9px 0', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, listStyle: 'none' }}>
        <span>{i.nome}</span>
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {formatarIndicador(i)}
          {mostrarSetor && i.referenciaSetor != null && <span className="muted" style={{ fontWeight: 400 }}> · setor {formatarIndicador({ valor: i.referenciaSetor, formato: i.formato })}</span>}
        </span>
      </summary>
      <div className="col" style={{ gap: 6, padding: '0 0 10px' }}>
        <span className="small justify">{i.interpretacao}</span>
        {i.historico && i.historico.filter((v) => v !== null).length >= 2 && (
          <div className="col" style={{ gap: 2 }}>
            <MiniGrafico valores={i.historico} tipo={i.formato === 'pct' || i.formato === 'x' || i.formato === 'reais' ? 'linha' : 'barras'} rotulo={`Histórico de ${i.nome}`} casas={i.formato === 'pct' ? 3 : 2} altura={52} />
            <span className="tiny muted">{i.rotulosHistorico?.join(' · ')}</span>
          </div>
        )}
        {i.referenciaSetor != null && !mostrarSetor && <span className="tiny muted">Mediana do setor: {formatarIndicador({ valor: i.referenciaSetor, formato: i.formato })}</span>}
        <span className="tiny muted justify"><strong>Fórmula:</strong> {i.formula}</span>
        <span className="tiny muted"><strong>Fonte:</strong> {i.fonte} · <strong>Referência:</strong> {dataLonga(i.dataReferencia)}</span>
      </div>
    </details>
  )
}

function TabelaHistorica({ colunas, financeira }: { colunas: ColunaHistorica[]; financeira: boolean }) {
  const linhas: { rotulo: string; valor: (c: ColunaHistorica) => ReactNode; ocultar?: boolean }[] = [
    { rotulo: financeira ? 'Receita de intermediação' : 'Receita líquida', valor: (c) => (c.receita === null ? '—' : milReais(c.receita)) },
    { rotulo: 'Crescimento da receita', valor: (c) => (c.crescimentoReceita === null ? '—' : fracaoEmPercentual(c.crescimentoReceita, 1, true)) },
    { rotulo: 'Margem bruta', valor: (c) => (c.margemBruta === null ? '—' : fracaoEmPercentual(c.margemBruta)), ocultar: financeira },
    { rotulo: 'EBITDA', valor: (c) => (c.ebitda === null ? '—' : milReais(c.ebitda)), ocultar: financeira },
    { rotulo: 'Margem EBITDA', valor: (c) => (c.margemEbitda === null ? '—' : fracaoEmPercentual(c.margemEbitda)), ocultar: financeira },
    { rotulo: 'EBIT', valor: (c) => (c.ebit === null ? '—' : milReais(c.ebit)), ocultar: financeira },
    { rotulo: 'Margem EBIT', valor: (c) => (c.margemEbit === null ? '—' : fracaoEmPercentual(c.margemEbit)), ocultar: financeira },
    { rotulo: 'Lucro dos controladores', valor: (c) => (c.lucroLiquido === null ? '—' : <span style={{ color: corDoSinal(c.lucroLiquido) }}>{milReais(c.lucroLiquido)}</span>) },
    { rotulo: 'Margem líquida', valor: (c) => (c.margemLiquida === null ? '—' : fracaoEmPercentual(c.margemLiquida)) },
    { rotulo: 'Lucro por ação', valor: (c) => (c.lpa === null ? '—' : reais(c.lpa)) },
    { rotulo: 'Ações (milhões)', valor: (c) => (c.acoes === null ? '—' : numero(c.acoes / 1e6, 0)) },
    { rotulo: 'Caixa operacional', valor: (c) => (c.fco === null ? '—' : milReais(c.fco)), ocultar: financeira },
    { rotulo: 'CAPEX', valor: (c) => (c.capex === null ? '—' : milReais(c.capex)), ocultar: financeira },
    { rotulo: 'Fluxo de caixa livre', valor: (c) => (c.fcf === null ? '—' : <span style={{ color: corDoSinal(c.fcf) }}>{milReais(c.fcf)}</span>), ocultar: financeira },
    { rotulo: 'Dívida líquida', valor: (c) => (c.dividaLiquida === null ? '—' : milReais(c.dividaLiquida)), ocultar: financeira },
    { rotulo: 'Patrimônio líquido', valor: (c) => (c.patrimonioLiquido === null ? '—' : milReais(c.patrimonioLiquido)) },
    { rotulo: 'Proventos pagos', valor: (c) => (c.dividendosPagos === null ? '—' : milReais(c.dividendosPagos)) },
  ]
  return (
    <div style={{ overflowX: 'auto' }} tabIndex={0} role="region" aria-label="Tabela do histórico financeiro, role para o lado">
      <table className="small" style={{ borderCollapse: 'collapse', width: '100%', minWidth: 120 + colunas.length * 92, fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: 'left', padding: '6px 8px 6px 0', position: 'sticky', left: 0, background: 'var(--surface)' }}>R$</th>
            {colunas.map((c) => <th key={c.rotulo} scope="col" style={{ textAlign: 'right', padding: '6px 6px', whiteSpace: 'nowrap' }}>{c.rotulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.filter((l) => !l.ocultar).map((l) => (
            <tr key={l.rotulo} style={{ borderTop: '1px solid var(--border)' }}>
              <th scope="row" className="muted" style={{ textAlign: 'left', fontWeight: 400, padding: '6px 8px 6px 0', position: 'sticky', left: 0, background: 'var(--surface)', whiteSpace: 'nowrap' }}>{l.rotulo}</th>
              {colunas.map((c) => <td key={c.rotulo} style={{ textAlign: 'right', padding: '6px', whiteSpace: 'nowrap' }}>{l.valor(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ValorJustoModulo({ f }: { f: AnaliseFundamentalista }) {
  const vj = f.valorJusto
  return (
    <Modulo titulo="Valor justo e margem de segurança" subtitulo={vj.aplicavel ? `confiança ${vj.confianca === 'alta' ? 'alta' : vj.confianca === 'media' ? 'média' : 'baixa'}` : 'dados insuficientes'} aberto>
      {!vj.aplicavel && <span className="small justify">{vj.motivo}</span>}
      {vj.aplicavel && (
        <>
          <div className="col" style={{ gap: 8 }}>
            {vj.cenarios.map((c) => (
              <div key={c.cenario} className="card-outline col" style={{ gap: 4 }} data-testid={`cenario-valor-${c.cenario}`}>
                <div className="row-between" style={{ gap: 8 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{c.cenario}</strong>
                  <span style={{ fontWeight: 700 }}>{c.valorJusto === null ? '—' : reais(c.valorJusto)}{c.potencialPct !== null && <span style={{ color: corDoSinal(c.potencialPct), fontWeight: 600 }}> ({percentual(c.potencialPct, 0, true)})</span>}</span>
                </div>
                <span className="tiny muted justify">{c.premissas}</span>
                <ul className="tiny muted col" style={{ gap: 2, paddingLeft: 18, margin: 0 }}>
                  {c.metodos.map((m) => <li key={m.nome}><strong>{m.nome}:</strong> {m.valor === null ? '—' : reais(m.valor)}. {m.premissas}</li>)}
                </ul>
                <span className="tiny muted justify"><strong>O que invalidaria:</strong> {c.invalidacao}</span>
              </div>
            ))}
          </div>
          <div className="col" style={{ gap: 0 }}>
            <Linha rotulo="Margem de segurança (cenário base)" valor={vj.margemSegurancaPct === null ? '—' : percentual(vj.margemSegurancaPct, 0)} cor={corDoSinal(vj.margemSegurancaPct)} />
            <Linha rotulo="Potencial de valorização (cenário base)" valor={vj.potencialBasePct === null ? '—' : percentual(vj.potencialBasePct, 0, true)} cor={corDoSinal(vj.potencialBasePct)} />
            <Linha rotulo="Preço de entrada (margem de 25%)" valor={vj.precoEntrada === null ? '—' : reais(vj.precoEntrada)} />
          </div>
          {vj.confiancaMotivos.length > 0 && (
            <ul className="small muted col" style={{ gap: 3, paddingLeft: 18, margin: 0 }}>
              {vj.confiancaMotivos.map((m) => <li key={m}>{m}</li>)}
            </ul>
          )}
        </>
      )}
      <span className="tiny muted justify">
        Margem de segurança = 1 − preço ÷ valor justo; potencial = valor justo ÷ preço − 1: são conceitos diferentes (um preço 100% acima do valor justo equivale a um valor justo 50% abaixo do preço). Com Selic alta, o desconto de cerca de 15% ao ano derruba o valor justo, e o mercado muitas vezes desconta o caixa de grandes empresas a uma taxa menor. Aparecer entre as mais baratas no Top 15 de ações baratas quer dizer barata em relação às outras empresas, não abaixo do valor justo: são perguntas diferentes e podem dar respostas opostas. O custo do capital parte da Selic meta e o crescimento terminal, da inflação de longo prazo (Focus); o valor justo é muito sensível a essas premissas, por isso a faixa entre cenários importa mais que o número único. O modelo limita o crescimento explícito a 10% ao ano por 5 anos: empresas de crescimento muito alto tendem a aparecer caras nele, mesmo quando o mercado paga esse prêmio de propósito.
      </span>
    </Modulo>
  )
}

function NotaDetalhada({ n }: { n: Nota }) {
  return (
    <details>
      <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
        <BarraDeNota rotulo={n.nome} valor={n.nota} peso={n.peso} />
      </summary>
      <div className="col" style={{ gap: 6, marginTop: 8 }}>
        {n.criterios.map((c) => (
          <div key={c.nome} className="col" style={{ gap: 1 }}>
            <div className="row-between small" style={{ gap: 8 }}>
              <span>{c.nome} <span className="muted">· peso {c.peso}</span></span>
              <strong>{c.nota === null ? 'sem dado' : Math.round(c.nota)}</strong>
            </div>
            <span className="tiny muted">{c.detalhe}</span>
          </div>
        ))}
        {n.ausentes.length > 0 && <span className="tiny muted">Critérios sem dado (fora da média): {n.ausentes.join(', ')}.</span>}
      </div>
    </details>
  )
}

function CartaoDeRisco({ r }: { r: Risco }) {
  const prob = { baixa: 'Probabilidade baixa', media: 'Probabilidade média', alta: 'Probabilidade alta', 'nao-avaliada': 'Probabilidade não avaliada' }[r.probabilidade]
  return (
    <div className="card-outline col" style={{ gap: 3 }}>
      <div className="row-between" style={{ gap: 8 }}>
        <strong className="small">{r.titulo}</strong>
        <span className="tiny muted">{prob} · impacto {r.impacto === 'medio' ? 'médio' : r.impacto}</span>
      </div>
      <span className="small muted justify">{r.descricao}</span>
      <span className="tiny muted justify"><strong>Monitorar:</strong> {r.monitorar.replace(/\.$/, '')}. <strong>Mitigação:</strong> {r.mitigacao} <strong>Efeito no valor:</strong> {r.efeitoNoValor}</span>
    </div>
  )
}
