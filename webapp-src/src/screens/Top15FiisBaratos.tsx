import { useState } from 'react'
import { storage } from '../data/storage'
import { SNAPSHOT_FII_BARATOS } from '../data/snapshotFiiBaratos'
import { buscarTop15Fiis } from '../domain/acessoTop15'
import type { RespostaTop15Fiis } from '../domain/acessoTop15'
import { buscarExclusao, formatarPercentual, formatarReaisCompacto } from '../domain/acoesBaratas'
import { GRUPOS_FII, ROTULO_ALERTA, contarExclusoes, formatarPvp, formatarVolumeDiario, validadeDaConferencia } from '../domain/fiiBaratos'
import type { GrupoFii, ItemFii, SnapshotFiiBaratos } from '../domain/fiiBaratos'
import { formatarData } from '../domain/rendaFii'
import { PortaoPorCodigo } from '../ui/PortaoPorCodigo'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "2026-08" → "08/2026". */
function formatarCompetencia(c: string | null) {
  const m = c ? /^(\d{4})-(\d{2})$/.exec(c) : null
  return m ? `${m[2]}/${m[1]}` : '—'
}

const AVISO_PADRAO =
  'Não é recomendação de investimento. Esta lista é uma triagem automática por fórmula, igual para todos, e não considera o seu perfil, seus objetivos nem o preço que faria sentido pagar. ' +
  'Os números são do passado, podem conter erros e defasagem, e o rendimento por cota é uma estimativa. Fundos “baratos” incluem os que têm problemas reais: desconto grande no P/VP ' +
  'costuma ser risco que o mercado já está cobrando. Rentabilidade passada não garante rentabilidade futura e fundos imobiliários podem causar perda de parte ou de todo o dinheiro aplicado. ' +
  'Converse com um profissional certificado antes de investir.'

/**
 * Caixa "Top 15 FIIs baratos" da aba Simule FII (D65). Triagem quantitativa em dois grupos, Tijolo e Papel: o
 * ranking e a nota de cada fundo vêm prontos do job (pasta de auditoria versionada); a tela só mostra, sem
 * recalcular nota nem reordenar, e diz de onde cada número veio.
 */
export function Top15FiisBaratos({
  snapshot = SNAPSHOT_FII_BARATOS,
  carregar = buscarTop15Fiis,
  armazenamento = storage,
}: {
  snapshot?: SnapshotFiiBaratos
  /** Pede a lista completa ao servidor com o código do mês. Injetável nos testes. */
  carregar?: (codigo: string) => Promise<RespostaTop15Fiis>
  armazenamento?: Pick<typeof storage, 'getItem' | 'setItem' | 'removeItem'>
}) {
  if (!snapshot.publicado) return <EmValidacao />
  // Acesso por código (D50): o arquivo do app traz só o cabeçalho; a lista vem do servidor.
  if (snapshot.acessoRestrito) {
    return (
      <PortaoPorCodigo
        titulo="Top 15 FIIs baratos: acesso por código"
        oQueLibera="Com ele você vê os 15 fundos de tijolo e os 15 de papel, a memória de cálculo de cada um e os fundos em conferência."
        instagram={snapshot.instagram}
        carregar={carregar}
        armazenamento={armazenamento}
        idDeTeste="top15-fiis-codigo"
        renderizar={(completo, sair) => <ListaFiis snapshot={completo} aoTrocarCodigo={sair} />}
      />
    )
  }
  if (snapshot.tijolo.length === 0 && snapshot.papel.length === 0) return <EmValidacao />
  return <ListaFiis snapshot={snapshot} />
}

function EmValidacao() {
  return (
    <div className="card col" style={{ gap: 8 }} role="status" data-testid="top15-fiis-validacao">
      <span style={{ fontWeight: 700 }}>Top 15 FIIs baratos: em validação</span>
      <span className="muted small justify">
        Esta triagem compara os fundos imobiliários, separados em tijolo e papel, pelo preço da cota em relação ao patrimônio e pelo rendimento dos últimos 12 meses.
        A lista aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use o simulador.
      </span>
    </div>
  )
}

function ListaFiis({ snapshot, aoTrocarCodigo }: { snapshot: SnapshotFiiBaratos; aoTrocarCodigo?: () => void }) {
  const [grupo, setGrupo] = useState<GrupoFii>('tijolo')
  if (snapshot.tijolo.length === 0 && snapshot.papel.length === 0) return <EmValidacao />

  const lista = (grupo === 'tijolo' ? snapshot.tijolo : snapshot.papel).slice(0, snapshot.tamanhoDaLista)
  const info = GRUPOS_FII.find((g) => g.id === grupo)!

  return (
    <div className="col" style={{ gap: 14 }} data-testid="top15-fiis">
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>Os {snapshot.tamanhoDaLista} FIIs mais baratos de cada tipo</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>
          Triagem quantitativa: ordena os fundos do mesmo tipo pela média de duas posições, o preço da cota em relação ao patrimônio (P/VP, quanto menor,
          mais barato) e o rendimento dos últimos 12 meses (quanto maior, melhor). <strong>Barato nos números não quer dizer boa compra</strong>: o fundo
          pode estar barato por um motivo, como vacância, inadimplência ou corte de rendimento.
        </div>
        <div className="tiny muted">
          Cotações até {snapshot.ultimoPregaoDiario ? formatarData(snapshot.ultimoPregaoDiario) : '—'} · informe da CVM de {formatarCompetencia(snapshot.competenciaReferencia)} · metodologia
          v{snapshot.versaoMetodologia} · {snapshot.universo} fundos analisados, {snapshot.contagens.tijolo} de tijolo e {snapshot.contagens.papel} de papel no ranking
        </div>
      </div>

      <div role="tablist" aria-label="Tipo de fundo" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {GRUPOS_FII.map((g) => (
          <button
            key={g.id}
            role="tab"
            id={`aba-fii-${g.id}`}
            aria-selected={grupo === g.id}
            aria-controls="painel-fii"
            className={`vehicle-card ${grupo === g.id ? 'selected' : ''}`}
            onClick={() => setGrupo(g.id)}
          >
            <span style={{ fontSize: 14 }}>{g.titulo}</span>
            <span style={{ fontSize: 11.5, fontWeight: 400, opacity: 0.85 }}>{snapshot.contagens[g.id]} no ranking</span>
          </button>
        ))}
      </div>

      <div id="painel-fii" role="tabpanel" aria-labelledby={`aba-fii-${grupo}`} className="col" style={{ gap: 10 }}>
        <span className="tiny muted justify">{info.descricao}.</span>
        {lista.length === 0 ? (
          <div className="card-outline small justify" role="status">Nenhum fundo de {info.titulo.toLowerCase()} passou nos filtros desta execução.</div>
        ) : (
          <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label={`FIIs de ${info.titulo.toLowerCase()} mais baratos pelo indicador`}>
            {lista.map((f, i) => (
              <CartaoFii key={f.ticker} item={f} ordem={i + 1} snapshot={snapshot} />
            ))}
          </ol>
        )}
      </div>

      <EmConferencia snapshot={snapshot} />
      <ComoFunciona snapshot={snapshot} />
      <PorQueFicouDeFora snapshot={snapshot} />
      <Auditoria snapshot={snapshot} />
      {aoTrocarCodigo && (
        <button type="button" className="btn btn-outline" onClick={aoTrocarCodigo} style={{ alignSelf: 'flex-start' }}>
          Sair e trocar o código
        </button>
      )}

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid="top15-fiis-aviso">
        {snapshot.aviso ?? AVISO_PADRAO}
      </div>
    </div>
  )
}

function CartaoFii({ item: f, ordem, snapshot }: { item: ItemFii; ordem: number; snapshot: SnapshotFiiBaratos }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  const validade = f.conferido ? validadeDaConferencia(f.conferido.em, snapshot.parametros.conferenciaValidadeDias) : null
  return (
    <li className="card col" style={{ gap: 10 }} data-testid={`top15-fiis-${f.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18 }}>
            {ordem}. {f.ticker}
          </span>
          <span className="tiny muted">{f.nome ?? '—'}{f.setorDeclarado ? ` · ${f.setorDeclarado}` : ''}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700 }}>{f.cotacao == null ? '—' : reais(f.cotacao)}</span>
          <span className="tiny muted">fech. {f.dataCotacao ? formatarData(f.dataCotacao) : '—'}</span>
        </div>
      </div>

      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">P/VP</span>
          <span style={{ fontWeight: 700 }}>{formatarPvp(f.pvp)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Rendimento, 12 meses</span>
          <span style={{ fontWeight: 700 }}>{formatarPercentual(f.dy12)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Rendimento recente</span>
          <span style={{ fontWeight: 700 }}>{formatarPercentual(f.dyRecente)}</span>
        </div>
      </div>
      <div className="tiny muted">
        Patrimônio {formatarReaisCompacto(f.patrimonio)} · rentabilidade patrimonial em 12 meses {formatarPercentual(f.rentabPatrimonial12m)} · negocia {formatarVolumeDiario(f.volumeLiquidez)} por dia ·
        nota {f.nota == null ? '—' : f.nota.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
      </div>

      {f.conferido && (
        <div className="tiny" role="note" data-testid={`conferido-${f.ticker}`} style={{ opacity: 0.9 }}>
          ✓ Dado conferido em {formatarData(f.conferido.em)}{validade ? ` (vale até ${formatarData(validade)})` : ''} numa fonte pública: {f.conferido.fonte}.{' '}
          {f.conferido.nota ?? ''} A conferência verifica os números, não a qualidade do fundo.
        </div>
      )}

      <details>
        <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Memória de cálculo</summary>
        <div className="col" style={{ gap: 0, marginTop: 6 }}>
          <Linha rotulo="Cotação" valor={f.cotacao == null ? '—' : reais(f.cotacao)} nota={`${f.fonteCotacao ?? 'fonte desconhecida'}${f.dataCotacao ? `, ${formatarData(f.dataCotacao)}` : ''}`} />
          <Linha rotulo="Valor patrimonial por cota" valor={f.vp == null ? '—' : reais(f.vp)} nota={`Informe Mensal da CVM de ${formatarCompetencia(snapshot.competenciaReferencia)}: patrimônio líquido ÷ cotas emitidas`} />
          <Linha rotulo="P/VP" valor={formatarPvp(f.pvp)} nota="cotação ÷ valor patrimonial por cota" />
          <Linha rotulo="Rendimento por cota, 12 meses" valor={f.rendimento12m == null ? '—' : reais(f.rendimento12m)} nota={`estimado: rendimento do mês (informe) × valor patrimonial, ${f.mesesComDados} meses com dado`} />
          <Linha rotulo="Rendimento de 12 meses sobre a cotação" valor={formatarPercentual(f.dy12)} />
          <Linha rotulo="Rendimento recente (anualizado)" valor={formatarPercentual(f.dyRecente)} nota="mediana dos 3 últimos meses × 12 ÷ cotação" />
          <Linha rotulo="Rendimento recente ÷ 12 meses" valor={f.razaoRendimentoRecente == null ? '—' : f.razaoRendimentoRecente.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} nota="abaixo de 0,75 o fundo vai para a conferência" />
          <Linha rotulo="Rentabilidade patrimonial, 12 meses" valor={formatarPercentual(f.rentabPatrimonial12m)} nota="variação do valor patrimonial sem as distribuições" />
          <Linha rotulo="Patrimônio líquido" valor={formatarReaisCompacto(f.patrimonio)} />
          <Linha rotulo="Cotistas" valor={f.cotistas == null ? '—' : f.cotistas.toLocaleString('pt-BR')} />
          <Linha rotulo="Passivo sobre o ativo" valor={formatarPercentual(f.alavancagem, 0)} nota="aproximação: passivo total − rendimentos a distribuir − taxas a pagar" />
          {f.fatias && (
            <Linha rotulo="O que o fundo tem no ativo" valor={`imóveis ${formatarPercentual(f.fatias.imoveis, 0)} · recebíveis ${formatarPercentual(f.fatias.recebiveis, 0)} · cotas ${formatarPercentual(f.fatias.cotas, 0)}`} nota="é por isso que ele está em tijolo ou em papel, e não pelo segmento declarado" />
          )}
          <Linha rotulo="Liquidez" valor={formatarVolumeDiario(f.volumeLiquidez)} nota={`${f.fonteLiquidez === 'mediana' ? 'mediana' : 'média'} do volume diário dos últimos ${snapshot.parametros.pregoesPrecoDiario} pregões`} />
        </div>
      </details>
    </li>
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

function EmConferencia({ snapshot: s }: { snapshot: SnapshotFiiBaratos }) {
  if (s.aConferir.length === 0) return null
  return (
    <details className="card" data-testid="top15-fiis-conferencia">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Fundos em conferência ({s.aConferir.length})</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <span className="small muted justify" style={{ lineHeight: 1.5 }}>
          Estes fundos <strong>não entram no ranking</strong> porque algum número dá sinal de que o dado merece conferência (cota fora de base, rendimento que não se repete, rendimento cortado). Eles voltam ao ranking quando alguém confirma o dado numa fonte pública.
        </span>
        {s.aConferir.map((f) => (
          <div key={f.ticker} className="card-outline small col" style={{ gap: 4 }} data-testid={`conferencia-${f.ticker}`}>
            <span><strong>{f.ticker}</strong> <span className="muted">({f.nome ?? '—'}, {f.grupo === 'papel' ? 'papel' : 'tijolo'})</span></span>
            <span className="tiny muted">P/VP {formatarPvp(f.pvp)} · rendimento de 12 meses {formatarPercentual(f.dy12)} · rendimento recente {formatarPercentual(f.dyRecente)}</span>
            <ul className="tiny" style={{ margin: 0, paddingLeft: 18 }}>
              {f.alertas.map((a) => (
                <li key={a}><strong>{ROTULO_ALERTA[a]?.titulo ?? a}.</strong> {ROTULO_ALERTA[a]?.texto}</li>
              ))}
            </ul>
            {f.conferenciaVencida && <span className="tiny muted">A conferência anterior (de {formatarData(f.conferenciaVencida)}) venceu.</span>}
          </div>
        ))}
      </div>
    </details>
  )
}

function ComoFunciona({ snapshot: s }: { snapshot: SnapshotFiiBaratos }) {
  const { tijolo: t, papel: p } = s.parametros.filtros
  const a = s.parametros.alertas
  const pct = (v: number, c = 0) => formatarPercentual(v, c)
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
      <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
        <li>
          <strong>Tijolo ou papel pelo que o fundo tem.</strong> Pela composição do ativo no informe da CVM, e não pelo segmento declarado: com {pct(s.parametros.classificacao.fatiaMinimaDoTipo)} ou mais em imóveis o
          fundo é de tijolo; com {pct(s.parametros.classificacao.fatiaMinimaDoTipo)} ou mais em recebíveis (CRI, LCI e semelhantes), de papel. Fundos de fundos e fundos mistos ficam de fora.
        </li>
        <li>
          <strong>Filtros de cada grupo.</strong> Volume mediano por dia de {formatarVolumeDiario(t.volumeMinimoDiario)} ou mais, patrimônio de {formatarReaisCompacto(t.patrimonioMinimo)} (tijolo) ou {formatarReaisCompacto(p.patrimonioMinimo)} (papel) ou mais,
          pelo menos {t.cotistasMinimos.toLocaleString('pt-BR')} cotistas, passivo de até {pct(t.alavancagemMaxima)} do ativo e rentabilidade patrimonial em 12 meses de {pct(t.rentabPatrimonial12mMinima)} (tijolo) ou {pct(p.rentabPatrimonial12mMinima)} (papel) ou mais.
          No papel, P/VP de {formatarPvp(p.pvpMinimo)} ou mais (desconto grande em fundo de crédito costuma ser perda já precificada) e rendimento de 12 meses de até {pct(p.dy12Maximo ?? 0)}.
        </li>
        <li>
          <strong>Fundos em conferência.</strong> Saem do ranking antes da ordenação os fundos com P/VP abaixo de {formatarPvp(a.pvpMuitoBaixo)}, rendimento de 12 meses acima de {pct(a.dy12Alto)}, rendimento recente
          abaixo de {pct(a.rendimentoRecenteMinimoSobre12m)} do de 12 meses, rendimento com pico (média acima de {pct(a.picoDeRendimentoMaximo)} da mediana) ou salto de preço de mais de {pct(a.saltoDePrecoDiario)} em um dia. Voltam quando o dado é conferido numa fonte pública
          {s.parametros.conferenciaValidadeDias ? `; a conferência vale ${s.parametros.conferenciaValidadeDias} dias` : ''}.
        </li>
        <li>
          <strong>Ordenação.</strong> Dentro de cada grupo, cada fundo recebe uma posição de 0 a 1 em P/VP (menor é melhor) e outra em rendimento de 12 meses (maior é melhor); a nota é a média das duas. Da maior nota para a menor; em empate, vence o menor P/VP.
        </li>
        <li>
          <strong>De onde vêm os números.</strong> O Informe Mensal de FII da CVM (valor patrimonial, rendimento, ativo e passivo) e o Boletim de Preços da B3 (cotação e volume dos últimos {s.parametros.pregoesPrecoDiario} pregões). O
          rendimento por cota é <strong>estimado</strong> (rendimento do mês do informe × valor patrimonial).
        </li>
      </ol>
    </details>
  )
}

function PorQueFicouDeFora({ snapshot: s }: { snapshot: SnapshotFiiBaratos }) {
  const [termo, setTermo] = useState('')
  const achados = buscarExclusao(s.exclusoes, termo)
  const contagem = contarExclusoes(s.exclusoes)
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Por que um fundo ficou de fora?</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <input type="search" className="busca-fii" placeholder="Código ou nome, ex.: HGLG11" aria-label="Buscar fundo fora da triagem" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={termo} onChange={(e) => setTermo(e.target.value.slice(0, 40))} />
        {termo.trim().length >= 2 && achados.length === 0 && (
          <span className="small muted">Nenhum fundo fora do ranking com esse código ou nome. Se ele está no app, está no ranking ou em conferência; os demais não fazem parte do cadastro da triagem.</span>
        )}
        {achados.map((e) => (
          <div key={e.ticker} className="card-outline small justify">
            <strong>{e.ticker}</strong> <span className="muted">({e.nome})</span>: {e.motivo}
          </div>
        ))}
        <div className="col" style={{ gap: 0 }}>
          {contagem.map((c) => (
            <div key={c.codigo} className="tabela-bdr small">
              <span className="muted">{c.rotulo}</span>
              <span style={{ fontWeight: 600 }}>{c.total}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

function Auditoria({ snapshot: s }: { snapshot: SnapshotFiiBaratos }) {
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
      <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
        <span>
          Toda execução grava, no repositório do projeto, a pasta <code>{s.pastaAuditoria ?? 'auditoria/fii-baratos/…'}</code> com: a origem de cada arquivo (endereço e impressão digital sha256), cada linha
          do informe da CVM e cada cotação usada, a memória de cálculo de cada fundo, a lista de fundos excluídos com o motivo e os rankings completos.
        </span>
        <span>Para refazer o cálculo, sem internet, e conferir se o resultado é o mesmo:</span>
        <code style={{ display: 'block', overflowX: 'auto', whiteSpace: 'pre', padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)' }}>
          node scripts/fii-baratos-verificar.mjs {s.pastaAuditoria ?? '…'}
        </code>
        <div className="col" style={{ gap: 0 }}>
          <Linha rotulo="Metodologia" valor={`v${s.versaoMetodologia}`} />
          <Linha rotulo="Impressão digital do resultado" valor={s.hashResultado ? `${s.hashResultado.slice(0, 16)}…` : '—'} />
          <Linha rotulo="Impressão digital dos insumos" valor={s.hashInsumos ? `${s.hashInsumos.slice(0, 16)}…` : '—'} />
          <Linha rotulo="Gerado em" valor={s.geradoEm ? formatarData(s.geradoEm) : '—'} />
        </div>
        <span className="tiny muted">A descrição completa de cada fórmula está em docs/10-metodologia-fii-baratos.md.</span>
      </div>
    </details>
  )
}
