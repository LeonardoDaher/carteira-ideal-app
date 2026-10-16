import { useId, useState } from 'react'
import { storage } from '../data/storage'
import { SNAPSHOT_ACOES_BARATAS } from '../data/snapshotAcoesBaratas'
import { CHAVE_CODIGO_TOP15, buscarTop15 } from '../domain/acessoTop15'
import type { RespostaTop15 } from '../domain/acessoTop15'
import {
  CONTAGEM_POR_ETAPA, SEM_FILTROS, buscarExclusao, descreverComponente, formatarMultiplo, formatarPercentual, formatarReaisCompacto, selecionarTop,
} from '../domain/acoesBaratas'
import type { ComposicaoLtm, FiltrosQualidade, ItemRanking, SnapshotAcoesBaratas } from '../domain/acoesBaratas'
import { introAuditoria, notaAuditoriaDiaria } from '../domain/auditoriaDiaria'
import { formatarData } from '../domain/rendaFii'
import { PortaoPorCodigo } from '../ui/PortaoPorCodigo'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Caixa "Top 15 mais baratas" da aba Simule Ações (D49). Triagem quantitativa: o ranking e a nota de
 * cada empresa vêm prontos do job (pasta de auditoria versionada); a tela só aplica os filtros de
 * qualidade opcionais, sem recalcular nota nem reordenar, e mostra de onde cada número veio.
 */
export function Top15Baratas({
  snapshot = SNAPSHOT_ACOES_BARATAS,
  carregar = buscarTop15,
  armazenamento = storage,
}: {
  snapshot?: SnapshotAcoesBaratas
  /** Pede a lista completa ao servidor com o código do mês. Injetável nos testes. */
  carregar?: (codigo: string) => Promise<RespostaTop15>
  armazenamento?: Pick<typeof storage, 'getItem' | 'setItem' | 'removeItem'>
}) {
  if (!snapshot.publicado) return <EmValidacao />
  // Acesso por código (D50): o arquivo do app traz só o cabeçalho; a lista vem do servidor.
  if (snapshot.acessoRestrito) return <PortaoDoCodigo cabecalho={snapshot} carregar={carregar} armazenamento={armazenamento} />
  if (snapshot.ranking.length === 0) return <EmValidacao />
  return <ListaTop15 snapshot={snapshot} />
}

function EmValidacao() {
  return (
    <div className="card col" style={{ gap: 8 }} role="status" data-testid="top15-validacao">
      <span style={{ fontWeight: 700 }}>Top 15 mais baratas: em validação</span>
      <span className="muted small justify">
        Esta triagem compara as empresas da bolsa pelo preço em relação ao que elas têm e geram (patrimônio, caixa e lucro operacional).
        A lista aparece aqui assim que a primeira atualização de dados for concluída e passar nas verificações automáticas. Enquanto isso, use o simulador.
      </span>
    </div>
  )
}

/**
 * Pede o código do mês (D50). O portão é o mesmo do Top 15 de FIIs (ui/PortaoPorCodigo), mas cada lista tem o seu código (D66): o código fica salvo
 * neste aparelho e, quando vence, o servidor o recusa e a tela volta a pedir.
 */
function PortaoDoCodigo({
  cabecalho, carregar, armazenamento,
}: {
  cabecalho: SnapshotAcoesBaratas
  carregar: (codigo: string) => Promise<RespostaTop15>
  armazenamento: Pick<typeof storage, 'getItem' | 'setItem' | 'removeItem'>
}) {
  return (
    <PortaoPorCodigo
      titulo="Top 15 mais baratas: acesso por código"
      oQueLibera="Com ele você vê as 15 ações, os filtros de qualidade e a memória de cálculo de cada uma."
      instagram={cabecalho.instagram}
      carregar={carregar}
      armazenamento={armazenamento}
      chaveArmazenamento={CHAVE_CODIGO_TOP15}
      idDeTeste="top15-codigo"
      renderizar={(completo, sair) => <ListaTop15 snapshot={completo} aoTrocarCodigo={sair} />}
    />
  )
}
function ListaTop15({ snapshot, aoTrocarCodigo }: { snapshot: SnapshotAcoesBaratas; aoTrocarCodigo?: () => void }) {
  const [filtros, setFiltros] = useState<FiltrosQualidade>(SEM_FILTROS)

  if (snapshot.ranking.length === 0) return <EmValidacao />

  const q = snapshot.qualidade
  const { lista, elegiveis, retiradosPorQualidade } = selecionarTop(snapshot.ranking, filtros, snapshot.tamanhoDaLista)
  const ligados = Object.values(filtros).filter(Boolean).length
  const alternar = (chave: keyof FiltrosQualidade) => setFiltros((f) => ({ ...f, [chave]: !f[chave] }))

  return (
    <div className="col" style={{ gap: 14 }} data-testid="top15">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>As {snapshot.tamanhoDaLista} ações mais baratas pelo indicador</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Triagem quantitativa: ordena as empresas pela média de três rendimentos (patrimônio ÷ valor de mercado, caixa operacional ÷ valor da
          empresa e lucro operacional ÷ valor da empresa). Quanto maior o rendimento, mais “barata” a empresa parece nos números.{' '}
          <strong>Barata nos números não quer dizer boa compra</strong>: a empresa pode estar barata por um motivo.
        </div>
        <div className="tiny muted">
          Preços de {snapshot.dataPrecos ? formatarData(snapshot.dataPrecos) : '—'} · metodologia v{snapshot.versaoMetodologia} · {snapshot.universo} empresas
          analisadas, {snapshot.ranking.length} no ranking
        </div>
      </div>

      <fieldset className="card col" style={{ gap: 8, border: 'none' }}>
        <legend style={{ fontWeight: 700, padding: 0 }}>Filtros de qualidade (opcionais)</legend>
        <span className="tiny muted justify">
          Retiram da lista as empresas que não passam, <em>depois</em> do ranking. Não mudam a nota de ninguém. Os limites fazem parte da metodologia.
        </span>
        <Filtro marcado={filtros.roic} aoAlternar={() => alternar('roic')} titulo={`ROIC de ${formatarPercentual(q.roicMinimo, 0)} ou mais`} detalhe={`Retorno sobre o capital investido: lucro operacional ajustado depois de ${formatarPercentual(q.aliquotaImpostoNopat, 0)} de imposto ÷ (patrimônio + dívida − caixa).`} />
        <Filtro marcado={filtros.dlEbitda} aoAlternar={() => alternar('dlEbitda')} titulo={`Dívida líquida até ${formatarMultiplo(q.dlEbitdaMaximo)} o EBITDA`} detalhe="Empresas com mais caixa do que dívida passam. Sem dado de depreciação, o filtro reprova por cautela." />
        <Filtro marcado={filtros.fco} aoAlternar={() => alternar('fco')} titulo="Caixa operacional positivo" detalhe="Geração de caixa das atividades operacionais positiva nos últimos 12 meses." />
        <Filtro marcado={filtros.cobertura} aoAlternar={() => alternar('cobertura')} titulo={`Cobertura de juros de ${formatarMultiplo(q.coberturaJurosMinima)} ou mais`} detalhe="EBIT ajustado ÷ despesas financeiras dos últimos 12 meses. Empresa sem despesa financeira passa; sem o dado, reprova por cautela." />
        <Filtro marcado={filtros.consistencia} aoAlternar={() => alternar('consistencia')} titulo={`Consistência: ${q.minimoComLucro} de ${q.exerciciosConsistencia} anos com lucro e caixa positivos`} detalhe={`Nos últimos ${q.exerciciosConsistencia} exercícios encerrados, lucro líquido e caixa operacional positivos em pelo menos ${q.minimoComLucro}. Empresa com menos de ${q.exerciciosConsistencia} exercícios divulgados reprova. Ajuda a separar lucro recorrente de pico de ciclo.`} />
        {ligados > 0 && (
          <span className="small" role="status">
            {retiradosPorQualidade === 0 ? 'Nenhuma empresa do ranking foi retirada.' : `${retiradosPorQualidade} ${retiradosPorQualidade === 1 ? 'empresa retirada' : 'empresas retiradas'}; ${elegiveis} ${elegiveis === 1 ? 'passa' : 'passam'} em todos os filtros ligados.`}
          </span>
        )}
      </fieldset>

      {lista.length === 0 ? (
        <div className="card-outline small justify" role="status">
          Nenhuma empresa do ranking passa em todos os filtros ligados. Desligue algum filtro para ver a lista.
        </div>
      ) : (
        <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label="Ações mais baratas pelo indicador">
          {lista.map((r, i) => (
            <CartaoRanking key={r.ticker} item={r} ordem={i + 1} comFiltro={ligados > 0} />
          ))}
        </ol>
      )}
      {lista.length > 0 && lista.length < snapshot.tamanhoDaLista && (
        <span className="tiny muted">Só {lista.length} {lista.length === 1 ? 'empresa passa' : 'empresas passam'} nos filtros ligados.</span>
      )}

      <ComoFunciona snapshot={snapshot} />
      <PorQueFicouDeFora snapshot={snapshot} />
      <Auditoria snapshot={snapshot} />
      {aoTrocarCodigo && (
        <button type="button" className="btn btn-outline" onClick={aoTrocarCodigo} style={{ alignSelf: 'flex-start' }}>
          Sair e trocar o código
        </button>
      )}

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note">
        <strong>Não é recomendação de investimento.</strong> Esta lista é uma triagem automática por fórmula, igual para todos, e não considera o seu
        perfil, seus objetivos nem o preço que faria sentido pagar. Números contábeis são do passado e podem conter ajustes e erros de divulgação; empresas
        “baratas” incluem as que estão no pico do ciclo ou em declínio (as chamadas armadilhas de valor). Rentabilidade passada não garante rentabilidade
        futura, e ações podem causar perda de parte ou de todo o dinheiro aplicado. Converse com um profissional certificado antes de investir.
      </div>
    </div>
  )
}

function Filtro({ marcado, aoAlternar, titulo, detalhe }: { marcado: boolean; aoAlternar: () => void; titulo: string; detalhe: string }) {
  const id = useId()
  return (
    <label htmlFor={id} className="row" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
      <input id={id} type="checkbox" checked={marcado} onChange={aoAlternar} style={{ marginTop: 3 }} />
      <span className="col" style={{ gap: 1 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{titulo}</span>
        <span className="tiny muted">{detalhe}</span>
      </span>
    </label>
  )
}

function CartaoRanking({ item: r, ordem, comFiltro }: { item: ItemRanking; ordem: number; comFiltro: boolean }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  const patrimonio = r.plSobreValorDeMercado * r.mktcap
  return (
    <li className="card col" style={{ gap: 10 }} data-testid={`top15-${r.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>
            {ordem}. {r.ticker}
            {comFiltro && r.posicao !== ordem && <span className="tiny muted" style={{ fontWeight: 400 }}> (#{r.posicao} no ranking geral)</span>}
          </span>
          <span className="tiny muted">{r.nome} · {r.setor}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700 }}>{reais(r.cotacao)}</span>
          <span className="tiny muted">fech. {formatarData(r.dataCotacao)}</span>
        </div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">PL ÷ valor de mercado</span>
          <span style={{ fontWeight: 700 }}>{formatarPercentual(r.plSobreValorDeMercado)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Caixa operacional ÷ EV</span>
          <span style={{ fontWeight: 700 }}>{formatarPercentual(r.fcoSobreEv)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">EBIT ajustado ÷ EV</span>
          <span style={{ fontWeight: 700 }}>{formatarPercentual(r.ebitAjustadoSobreEv)}</span>
        </div>
      </div>
      <div className="tiny muted">
        ROIC {formatarPercentual(r.roic)} · dívida líquida/EBITDA {r.caixaLiquido ? 'caixa líquido' : formatarMultiplo(r.dlEbitda)} · cobertura de juros{' '}
        {r.semDespesaFinanceira ? 'sem despesa financeira' : formatarMultiplo(r.coberturaJuros)} · lucro positivo em {r.exerciciosComLucro} de {r.exerciciosAnalisados} exercícios · nota {r.nota.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
      </div>

      {r.alertas?.includes('pvp_alto') && (
        <div className="tiny" role="note" data-testid={`alerta-pvp-${r.ticker}`} style={{ opacity: 0.9 }}>
          ⚠ P/VP acima de 10: se isso não for o esperado para esta empresa, a quantidade de ações lida na CVM pode estar errada. Confira antes de usar.
        </div>
      )}
      {r.alertas?.includes('giro_alto') && (
        <div className="tiny" role="note" data-testid={`alerta-giro-${r.ticker}`} style={{ opacity: 0.9 }}>
          ⚠ O volume negociado por dia passa de 5% do valor de mercado calculado ({formatarPercentual(r.giroDiario ?? null, 1)}): se isso não for o esperado, a quantidade de ações lida na CVM pode estar abaixo da real e o valor de mercado, subestimado. Confira antes de usar.
        </div>
      )}

      <details>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Memória de cálculo</summary>
        <div className="col" style={{ gap: 0, marginTop: 6 }}>
          <Linha rotulo="Valor de mercado" valor={formatarReaisCompacto(r.mktcap)} nota={r.metodoValorDeMercado === 'por_classe' ? 'ações de cada classe × preço da classe' : 'inclui classe sem negociação recente, avaliada pelo preço de outra classe'} />
          {r.acoesUsadas != null && (
            <Linha rotulo="Ações em circulação usadas" valor={`${(r.acoesUsadas / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`} nota={`quantidade do ${r.capitalDocumento ?? 'balanço'}${r.ajusteDesdobramentoCapital ? `, ajustada por desdobramento/grupamento posterior (${r.ajusteDesdobramentoCapital})` : ''}`} />
          )}
          {r.ajusteUnidadeCapital && (
            <Linha rotulo="Quantidade de ações" valor={`ajustada (${r.ajusteUnidadeCapital})`} nota="a CVM traz a quantidade em milhares; sem o ajuste, P/VP e giro diário ficariam impossíveis" />
          )}
          <Linha rotulo="Patrimônio líquido (controladores)" valor={formatarReaisCompacto(patrimonio)} />
          <Linha rotulo="EV (valor da empresa)" valor={formatarReaisCompacto(r.ev)} nota="valor de mercado + dívida líquida + minoritários" />
          <Linha rotulo="EBIT ajustado, 12 meses" valor={formatarReaisCompacto(r.ebitAjustado)} nota="sem equivalência patrimonial, baixas de ativos e outras receitas/despesas operacionais" />
          <Linha rotulo="Caixa operacional, 12 meses" valor={formatarReaisCompacto(r.fcoLtm)} />
          <Linha rotulo="Lucro líquido, 12 meses" valor={formatarReaisCompacto(r.lucroLtm)} />
          <Linha rotulo="Cobertura de juros" valor={r.semDespesaFinanceira ? 'sem despesa financeira' : formatarMultiplo(r.coberturaJuros)} nota="EBIT ajustado ÷ despesas financeiras, 12 meses" />
          <Linha rotulo="Exercícios com lucro" valor={`${r.exerciciosComLucro} de ${r.exerciciosAnalisados}`} nota="DFP dos últimos exercícios encerrados" />
          <Linha rotulo="Exercícios com caixa operacional positivo" valor={`${r.exerciciosComFco} de ${r.exerciciosAnalisados}`} />
          <Linha rotulo="P/VP" valor={r.pvp == null ? '—' : r.pvp.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} />
          <Linha rotulo="Volatilidade anual" valor={formatarPercentual(r.volatilidade)} />
          <Linha rotulo="Demonstração usada" valor={`${r.demonstracao.doc} de ${formatarData(r.demonstracao.dtRefer)}`} nota={r.demonstracao.dtReceb ? `recebida pela CVM em ${formatarData(r.demonstracao.dtReceb)}` : undefined} />
        </div>
        {r.composicaoLtm && <ComoChegamos item={r} />}
        {r.demonstracao.linkDoc && (
          <a className="tiny" href={r.demonstracao.linkDoc} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6 }}>
            Abrir o documento original na CVM ↗
          </a>
        )}
      </details>
    </li>
  )
}

/** Mostra de onde veio cada valor de 12 meses, para conferir contra a demonstração original. */
function ComoChegamos({ item: r }: { item: ItemRanking }) {
  const blocos: { titulo: string; c: ComposicaoLtm }[] = [
    { titulo: `Lucro líquido consolidado (conta ${r.composicaoLtm?.lucro.conta ?? '3.11'})`, c: r.composicaoLtm!.lucro },
    { titulo: 'Caixa operacional', c: r.composicaoLtm!.fco },
    { titulo: 'EBIT (antes dos ajustes)', c: r.composicaoLtm!.ebit },
  ]
  return (
    <div className="col" style={{ gap: 8, marginTop: 10 }} data-testid={`como-chegamos-${r.ticker}`}>
      <span className="small" style={{ fontWeight: 700 }}>Como chegamos aos 12 meses</span>
      {blocos.map(({ titulo, c }) => (
        <div key={titulo} className="col" style={{ gap: 0 }}>
          <span className="tiny" style={{ fontWeight: 600 }}>{titulo}</span>
          {c.componentes.map((k) => {
            const d = descreverComponente(k, formatarData)
            return (
              <div key={`${k.papel}-${k.ate}`} className="tabela-bdr tiny">
                <span className="muted">{d.sinal} {d.texto} ({k.doc})</span>
                <span style={{ fontWeight: 600 }}>{formatarReaisCompacto(k.valor)}</span>
              </div>
            )
          })}
          <div className="tabela-bdr tiny">
            <span className="muted">= últimos 12 meses</span>
            <span style={{ fontWeight: 700 }}>{formatarReaisCompacto(c.valor)}</span>
          </div>
        </div>
      ))}
      {r.composicaoLtm!.lucro.consolidado != null && r.composicaoLtm!.lucro.controladores != null && (
        <span className="tiny muted">
          Lucro de 12 meses: consolidado (3.11) {formatarReaisCompacto(r.composicaoLtm!.lucro.consolidado)} · dos controladores (3.11.01) {formatarReaisCompacto(r.composicaoLtm!.lucro.controladores)}
        </span>
      )}
      {((r.historicoDescartes?.length ?? 0) > 0 || r.historicoLacuna) && (
        <div className="col" style={{ gap: 0 }} data-testid={`nao-lidos-${r.ticker}`}>
          <span className="tiny" style={{ fontWeight: 600 }}>Exercícios que não puderam ser lidos</span>
          {r.historicoDescartes?.map((d) => (
            <div key={d.exercicio} className="tabela-bdr tiny">
              <span className="muted">{d.exercicio.slice(0, 4)}</span>
              <span style={{ fontWeight: 600 }}>{d.motivo}</span>
            </div>
          ))}
          {r.historicoLacuna && (
            <div className="tabela-bdr tiny">
              <span className="muted">Série de DFP interrompida</span>
              <span style={{ fontWeight: 600 }}>nenhum DFP consecutivo entre {formatarData(r.historicoLacuna.entre[0])} e {formatarData(r.historicoLacuna.entre[1])}</span>
            </div>
          )}
        </div>
      )}
      {r.historico && r.historico.length > 0 && (
        <div className="col" style={{ gap: 0 }}>
          <span className="tiny" style={{ fontWeight: 600 }}>Por exercício encerrado (lucro consolidado · caixa operacional)</span>
          {r.historico.map((h) => (
            <div key={h.exercicio} className="tabela-bdr tiny">
              <span className="col" style={{ gap: 0 }}>
                <span className="muted">{h.exercicio.slice(0, 4)}</span>
                {h.lucroControladores != null && h.lucroControladores !== h.lucro && (
                  <span className="muted">dos controladores (3.11.01): {formatarReaisCompacto(h.lucroControladores)}</span>
                )}
              </span>
              <span style={{ fontWeight: 600 }}>{formatarReaisCompacto(h.lucro)} · {formatarReaisCompacto(h.fco)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Linha({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="tabela-bdr small">
      <span className="col" style={{ gap: 0 }}>
        <span className="muted">{rotulo}</span>
        {nota && <span className="tiny muted">{nota}</span>}
      </span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  )
}

function ComoFunciona({ snapshot: s }: { snapshot: SnapshotAcoesBaratas }) {
  const p = s.parametros
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
      <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
        <li>
          <strong>Filtros iniciais.</strong> Saem bancos, seguradoras e a bolsa (o valor da empresa e o lucro operacional não medem esses negócios), empresas
          que negociam menos de {reais(p.liquidezMinimaDiariaReais).replace(',00', '')} por dia (média de {p.sessoesLiquidez} pregões), as que não tiveram lucro nos últimos 12 meses
          e as 10% mais voláteis da lista (volatilidade de {p.sessoesVolatilidade} pregões).
        </li>
        <li>
          <strong>Indicador composto.</strong> Três rendimentos: patrimônio líquido ÷ valor de mercado; caixa das atividades operacionais ÷ EV; EBIT
          ajustado ÷ EV. Cada empresa recebe, em cada um, uma posição de 0 a 1 entre as demais; a nota é a média das três posições.
        </li>
        <li>
          <strong>Ajustes.</strong> O EBIT tira equivalência patrimonial, baixas de ativos e outras receitas e despesas operacionais, para ficar só com o que
          o negócio gera. Como a nota usa posições, valores extremos não distorcem o resultado.
        </li>
        <li>
          <strong>Ordenação.</strong> Da maior nota para a menor. Em empate, ordem alfabética do código.
        </li>
        <li>
          <strong>Seleção.</strong> As {s.tamanhoDaLista} primeiras. Os números contábeis são dos últimos 12 meses (4 trimestres) divulgados à CVM;
          os preços são o último fechamento da B3.
        </li>
      </ol>
      <div className="tiny muted justify">
        Fonte dos números: demonstrações e composição do capital (DFP/ITR) dos dados abertos da CVM; preços e volumes do Boletim de Preços da B3. Cada
        execução guarda os dados usados e pode ser refeita por qualquer pessoa.
      </div>
    </details>
  )
}

function PorQueFicouDeFora({ snapshot: s }: { snapshot: SnapshotAcoesBaratas }) {
  const [termo, setTermo] = useState('')
  const achados = buscarExclusao(s.exclusoes, termo)
  const contagem = new Map<string, number>()
  for (const e of s.exclusoes) contagem.set(e.etapa, (contagem.get(e.etapa) ?? 0) + 1)
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Por que uma empresa ficou de fora?</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <input type="search" className="busca-fii" placeholder="Código ou nome, ex.: MGLU3" aria-label="Buscar empresa fora da triagem" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={termo} onChange={(e) => setTermo(e.target.value.slice(0, 40))} />
        {termo.trim().length >= 2 && achados.length === 0 && (
          <span className="small muted">Nenhuma empresa fora da triagem com esse código ou nome. Se ela está na lista de empresas do app, está no ranking; as demais não fazem parte do cadastro da triagem.</span>
        )}
        {achados.map((e) => (
          <div key={e.ticker} className="card-outline small justify">
            <strong>{e.ticker}</strong> <span className="muted">({e.nome})</span>: {e.motivo}
          </div>
        ))}
        <div className="col" style={{ gap: 0 }}>
          {[...contagem.entries()].map(([etapa, n]) => (
            <div key={etapa} className="tabela-bdr small">
              <span className="muted">{CONTAGEM_POR_ETAPA[etapa] ?? etapa}</span>
              <span style={{ fontWeight: 600 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

function Auditoria({ snapshot: s }: { snapshot: SnapshotAcoesBaratas }) {
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
      <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
        <span>
          {introAuditoria(s)} <code>{s.pastaAuditoria ?? 'auditoria/acoes-baratas/…'}</code> com: a origem de cada arquivo
          da CVM (endereço e impressão digital sha256), cada linha das demonstrações usada (conta, versão, período e link do documento), a memória de
          cálculo de cada empresa, a lista de empresas excluídas com o motivo e o ranking completo.
        </span>
        {notaAuditoriaDiaria(s) && <span>{notaAuditoriaDiaria(s)}</span>}
        <span>Para refazer o cálculo, sem internet, e conferir se o resultado é o mesmo:</span>
        <code style={{ display: 'block', overflowX: 'auto', whiteSpace: 'pre', padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)' }}>
          node scripts/acoes-baratas-verificar.mjs {s.pastaAuditoria ?? '…'}
        </code>
        <div className="col" style={{ gap: 0 }}>
          <Linha rotulo="Metodologia" valor={`v${s.versaoMetodologia}`} />
          <Linha rotulo="Impressão digital do resultado" valor={s.hashResultado ? `${s.hashResultado.slice(0, 16)}…` : '—'} />
          <Linha rotulo="Impressão digital dos insumos" valor={s.hashInsumos ? `${s.hashInsumos.slice(0, 16)}…` : '—'} />
          <Linha rotulo="Gerado em" valor={s.geradoEm ? formatarData(s.geradoEm) : '—'} />
        </div>
        <span className="tiny muted">A descrição completa de cada fórmula e de cada conta contábil está em docs/09-metodologia-acoes-baratas.md.</span>
      </div>
    </details>
  )
}
