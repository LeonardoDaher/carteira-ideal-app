import { Fragment, useState } from 'react'
import { SNAPSHOT_ACOES_MAIS_NEGOCIADAS, SNAPSHOT_BDRS_MAIS_NEGOCIADOS, SNAPSHOT_ETFS_MAIS_NEGOCIADOS, SNAPSHOT_FIIS_MAIS_NEGOCIADOS } from '../data/snapshotTop15Mercado'
import { introAuditoria, notaAuditoriaDiaria } from '../domain/auditoriaDiaria'
import { formatarVariacao } from '../domain/bdrs'
import { formatarVolumeDiario } from '../domain/fiiBaratos'
import { formatarData } from '../domain/rendaFii'
import { ROTULO_EXCLUSAO_BDR, ROTULO_EXCLUSAO_ETF, buscarExclusaoMercado, contarExclusoesMercado } from '../domain/top15Mercado'
import type { ItemEtfTop, SnapshotMaisNegociados } from '../domain/top15Mercado'
import { LogoAtivo } from '../ui/LogoAtivo'

function reais(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "texto **em negrito** texto" → React, sem HTML solto. */
function negrito(texto: string) {
  return texto.split('**').map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : <Fragment key={i}>{parte}</Fragment>))
}

export type ClasseMaisNegociados = 'etfs' | 'fiis' | 'acoes' | 'bdrs'

/**
 * Tudo o que muda de uma classe para outra (D71). O cálculo é o mesmo (mediana do volume diário); a tela só troca
 * os nomes e as ressalvas: o que "mais negociado" NÃO mede em cada classe.
 */
interface Textos {
  /** Prefixo dos data-testid. */
  id: string
  singular: string
  plural: string
  /** "um ETF", "uma ação". */
  umaSingular: string
  /** "Nenhum ETF", "Nenhuma ação". */
  nenhum: string
  /** "ele", "ela". */
  ele: string
  analisados: string
  categoria: string
  exemplo: string
  tituloTop: (n: number) => string
  tituloValidacao: string
  descricaoValidacao: string
  topo: (janela: number) => string
  filtroExtra: string
  naoMede: string
  avisoPadrao: string
  pastaPadrao: string
  rotulosExclusao: Record<string, string>
}

const AVISO_ETF =
  'Não é recomendação de investimento. “Mais negociado” significa apenas maior volume financeiro diário (mediana dos últimos pregões): é liquidez, e não indica qualidade, custo baixo, ' +
  'bom momento de compra nem adequação ao seu perfil. Cada ETF tem taxa de administração, índice, risco e tributação próprios; leia o regulamento e a lâmina antes de investir. ' +
  'Os números vêm do Boletim de Preços da B3, são do passado e podem conter erros. Rentabilidade passada não garante rentabilidade futura. Converse com um profissional certificado antes de investir.'
const aviso = (o: string) =>
  `Não é recomendação de investimento. “Mais negociad${o}” significa apenas maior volume financeiro diário (mediana dos últimos pregões): é liquidez, e não indica qualidade, preço baixo, bom momento de compra nem adequação ao seu perfil. ` +
  'Os números vêm do Boletim de Preços da B3, são do passado e podem conter erros. Rentabilidade passada não garante rentabilidade futura. Converse com um profissional certificado antes de investir.'

export const TEXTOS: Record<ClasseMaisNegociados, Textos> = {
  etfs: {
    id: 'top15-etfs', singular: 'ETF', plural: 'ETFs', umaSingular: 'um ETF', nenhum: 'Nenhum ETF', ele: 'ele', analisados: 'ETFs analisados', categoria: 'categoria', exemplo: 'HASH11',
    tituloTop: (n) => `Os ${n} ETFs mais negociados`,
    tituloValidacao: 'Top 15 ETFs mais negociados: em validação',
    descricaoValidacao: 'Este ranking ordena os ETFs pelo volume financeiro negociado por dia. Ele aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use a lista e a busca de ETFs.',
    topo: (j) => `Ordem pelo **volume financeiro diário** (a mediana dos últimos ${j} pregões, em reais). É uma medida de **liquidez**: quanto o ETF é comprado e vendido. **Mais negociado não quer dizer melhor, mais barato nem mais seguro**; a taxa de administração, o índice e o risco de cada ETF você confere no regulamento.`,
    filtroExtra: 'Alguns produtos classificados como ETF, mas que não são fundos de índice comuns, ficam de fora por decisão registrada.',
    naoMede: 'Não mede taxa de administração, desempenho, risco, tamanho do patrimônio nem qualidade do índice. Esses dados não estão no Boletim da B3 e você encontra no regulamento e na lâmina de cada ETF.',
    avisoPadrao: AVISO_ETF, pastaPadrao: 'auditoria/top15-etfs/…', rotulosExclusao: ROTULO_EXCLUSAO_ETF,
  },
  fiis: {
    id: 'top15-fiis-negociados', singular: 'FII', plural: 'FIIs', umaSingular: 'um FII', nenhum: 'Nenhum FII', ele: 'ele', analisados: 'FIIs analisados', categoria: 'segmento', exemplo: 'HGLG11',
    tituloTop: (n) => `Os ${n} FIIs mais negociados`,
    tituloValidacao: 'Top 15 FIIs mais negociados: em validação',
    descricaoValidacao: 'Este ranking ordena os fundos imobiliários pelo volume financeiro negociado por dia. Ele aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use o simulador.',
    topo: (j) => `Ordem pelo **volume financeiro diário** (a mediana dos últimos ${j} pregões, em reais). É uma medida de **liquidez**: quanto o fundo é comprado e vendido. **Mais negociado não quer dizer melhor, mais barato nem mais seguro**; o preço em relação ao patrimônio, o rendimento e o risco de cada fundo são outra conversa (veja o Top 15 mais baratos).`,
    filtroExtra: '',
    naoMede: 'Não mede P/VP, rendimento, vacância, inadimplência, endividamento, qualidade dos imóveis ou dos créditos nem risco. Para esses números, use o Top 15 FIIs mais baratos e o informe mensal de cada fundo.',
    avisoPadrao: aviso('o'), pastaPadrao: 'auditoria/top15-fiis/…', rotulosExclusao: ROTULO_EXCLUSAO_ETF,
  },
  acoes: {
    id: 'top15-acoes-negociadas', singular: 'ação', plural: 'ações', umaSingular: 'uma ação', nenhum: 'Nenhuma ação', ele: 'ela', analisados: 'ações analisadas', categoria: 'setor', exemplo: 'MGLU3',
    tituloTop: (n) => `As ${n} ações mais negociadas`,
    tituloValidacao: 'Top 15 ações mais negociadas: em validação',
    descricaoValidacao: 'Este ranking ordena as ações pelo volume financeiro negociado por dia. Ele aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use o simulador.',
    topo: (j) => `Ordem pelo **volume financeiro diário** (a mediana dos últimos ${j} pregões, em reais). É uma medida de **liquidez**: quanto a ação é comprada e vendida. **Mais negociada não quer dizer melhor, mais barata nem mais segura**; uma ação muito negociada pode estar cara, em queda ou em dificuldade. Cada código conta separadamente (PETR3 e PETR4, por exemplo).`,
    filtroExtra: '',
    naoMede: 'Não mede lucro, dívida, avaliação, dividendos nem perspectivas da empresa. Para um olhar de preço contra os números da empresa, veja o Top 15 ações baratas.',
    avisoPadrao: aviso('a'), pastaPadrao: 'auditoria/top15-acoes/…', rotulosExclusao: ROTULO_EXCLUSAO_ETF,
  },
  bdrs: {
    id: 'top15-bdrs-negociados', singular: 'BDR', plural: 'BDRs', umaSingular: 'um BDR', nenhum: 'Nenhum BDR', ele: 'ele', analisados: 'BDRs analisados', categoria: 'setor', exemplo: 'AAPL34',
    tituloTop: (n) => `Os ${n} BDRs mais negociados`,
    tituloValidacao: 'Top 15 BDRs mais negociados: em validação',
    descricaoValidacao: 'Este ranking ordena os BDRs pelo volume financeiro negociado por dia. Ele aparece aqui assim que passar nas verificações automáticas. Enquanto isso, use o simulador.',
    topo: (j) => `Ordem pelo **volume financeiro diário** (a mediana dos últimos ${j} pregões, em reais). É uma medida de **liquidez**: quanto o BDR é comprado e vendido. **Mais negociado não quer dizer melhor, mais barato nem mais seguro**; o preço do BDR acompanha a ação lá fora e o dólar. BDRs de ETF aparecem na categoria própria.`,
    filtroExtra: 'Ficam de fora os BDRs de empresas de origem ou operação brasileira, por decisão registrada.',
    naoMede: 'Não mede lucro, dívida, avaliação nem perspectivas da empresa estrangeira, e o preço em reais mistura a ação e o dólar. Para ver quanto o preço está abaixo da máxima de 12 meses, veja o Top 15 maior desconto.',
    avisoPadrao: aviso('o'), pastaPadrao: 'auditoria/top15-bdrs-negociados/…', rotulosExclusao: ROTULO_EXCLUSAO_BDR,
  },
}

const SNAPSHOT_PADRAO: Record<ClasseMaisNegociados, SnapshotMaisNegociados> = {
  etfs: SNAPSHOT_ETFS_MAIS_NEGOCIADOS,
  fiis: SNAPSHOT_FIIS_MAIS_NEGOCIADOS,
  acoes: SNAPSHOT_ACOES_MAIS_NEGOCIADAS,
  bdrs: SNAPSHOT_BDRS_MAIS_NEGOCIADOS,
}

/**
 * Caixa "Top 15 mais negociados" das telas Simule ETF, Simule FII, Simule Ações e Simule BDR (D70 e D71). Ranking
 * ABERTO (sem código) por volume financeiro: o resultado e a posição de cada ativo vêm prontos do job (pasta de
 * auditoria versionada); a tela só mostra, sem reordenar. É liquidez, não qualidade: o texto diz isso no topo, no
 * cartão e no aviso.
 */
export function Top15MaisNegociados({ classe, snapshot }: { classe: ClasseMaisNegociados; snapshot?: SnapshotMaisNegociados }) {
  const t = TEXTOS[classe]
  const s = snapshot ?? SNAPSHOT_PADRAO[classe]
  if (!s.publicado || s.geral.length === 0) return <EmValidacao t={t} />
  const categorias = Object.keys(s.porCategoria)
  const rotuloVariacao = s.parametros.janela3Meses === 63 ? 'Variação em 3 meses' : `Variação em ${s.parametros.janela3Meses} pregões`

  return (
    <div className="col" style={{ gap: 14 }} data-testid={t.id}>
      <div className="col" style={{ gap: 6 }}>
        <h2 style={{ fontSize: 17 }}>{t.tituloTop(s.tamanhoDaLista)}</h2>
        <div className="muted small justify" style={{ lineHeight: 1.5 }}>{negrito(t.topo(s.parametros.janelaLiquidez))}</div>
        <div className="tiny muted">
          Pregões até {s.ultimoPregao ? formatarData(s.ultimoPregao) : '—'} · metodologia v{s.versaoMetodologia} · {s.universo} {t.analisados}, {s.elegiveis} passaram nos filtros
        </div>
      </div>

      <ol className="col" style={{ gap: 10, listStyle: 'none', padding: 0, margin: 0 }} aria-label={`${t.plural} mais negociados`}>
        {s.geral.slice(0, s.tamanhoDaLista).map((e) => (
          <Cartao key={e.ticker} t={t} item={e} ordem={e.posicaoGeral} janela={s.parametros.janelaLiquidez} rotuloVariacao={rotuloVariacao} />
        ))}
      </ol>

      {categorias.length > 0 && (
        <details className="card" data-testid={`${t.id}-categorias`}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Os mais negociados de cada {t.categoria}</summary>
          <div className="col" style={{ gap: 10, marginTop: 8 }}>
            {categorias.map((c) => (
              <div key={c} className="col" style={{ gap: 4 }}>
                <span className="small" style={{ fontWeight: 600 }}>{c}</span>
                <ol className="col" style={{ gap: 2, listStyle: 'none', padding: 0, margin: 0 }} aria-label={`${t.plural} mais negociados em ${c}`}>
                  {s.porCategoria[c].map((e) => (
                    <li key={e.ticker} className="tabela-bdr small" data-testid={`categoria-${c}-${e.ticker}`}>
                      <span className="col" style={{ gap: 0 }}>
                        <span>{e.posicaoNaCategoria}. <strong>{e.ticker}</strong></span>
                        <span className="tiny muted">{e.nome}</span>
                      </span>
                      <span style={{ fontWeight: 600 }}>{formatarVolumeDiario(e.volumeMediano)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </details>
      )}

      <ComoFunciona t={t} s={s} />
      <PorQueFicouDeFora t={t} s={s} />
      <Auditoria t={t} s={s} />

      <div className="card-outline small muted justify" style={{ lineHeight: 1.5 }} role="note" data-testid={`${t.id}-aviso`}>
        {s.aviso ?? t.avisoPadrao}
      </div>
    </div>
  )
}

function EmValidacao({ t }: { t: Textos }) {
  return (
    <div className="card col" style={{ gap: 8 }} role="status" data-testid={`${t.id}-validacao`}>
      <span style={{ fontWeight: 700 }}>{t.tituloValidacao}</span>
      <span className="muted small justify">{t.descricaoValidacao}</span>
    </div>
  )
}

function Cartao({ t, item: e, ordem, janela, rotuloVariacao }: { t: Textos; item: ItemEtfTop; ordem: number; janela: number; rotuloVariacao: string }) {
  const caixa = { padding: '6px 8px', borderRadius: 10, background: 'var(--surface2)' } as const
  return (
    <li className="card col" style={{ gap: 8 }} data-testid={`${t.id}-${e.ticker}`}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col" style={{ gap: 1, minWidth: 0 }}>
          <span className="font-display" style={{ fontWeight: 700, fontSize: 18, color: 'var(--accent)' }}>{ordem}. <LogoAtivo ticker={e.ticker} tamanho={24} inline semSelo />{e.ticker}</span>
          <span className="tiny muted">{e.nome} · {e.categoria}</span>
        </div>
        <div className="col" style={{ gap: 1, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.cotacao == null ? '—' : reais(e.cotacao)}</span>
          <span className="tiny muted">fech. {e.dataCotacao ? formatarData(e.dataCotacao) : '—'}</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        <div className="col" style={{ ...caixa, flex: '1 1 120px' }}>
          <span className="tiny muted">Volume por dia (mediana)</span>
          <span style={{ fontWeight: 700 }}>{formatarVolumeDiario(e.volumeMediano)}</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">Negociou em</span>
          <span style={{ fontWeight: 700 }}>{e.diasNegociados} de {janela} pregões</span>
        </div>
        <div className="col" style={{ ...caixa, flex: '1 1 90px' }}>
          <span className="tiny muted">{rotuloVariacao}</span>
          <span style={{ fontWeight: 700 }}>{e.variacao3m == null ? '—' : formatarVariacao(e.variacao3m)}</span>
        </div>
      </div>
      <div className="tiny muted">
        Volume médio {formatarVolumeDiario(e.volumeMedio)} por dia · a posição vem da mediana, que não é puxada por um único dia de volume alto.
      </div>
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

function ComoFunciona({ t, s }: { t: Textos; s: SnapshotMaisNegociados }) {
  const p = s.parametros
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Como a lista é feita</summary>
      <ol className="small justify col" style={{ gap: 8, lineHeight: 1.5, paddingLeft: 18, marginTop: 8 }}>
        <li>
          <strong>Volume por dia.</strong> Para cada {t.singular}, o volume financeiro (em reais) de cada um dos últimos {p.janelaLiquidez} pregões, do Boletim de Preços da B3. Dia sem negócio conta zero.
          O valor usado é a <strong>mediana</strong> desses dias: metade dos dias teve volume maior, metade menor.
        </li>
        <li>
          <strong>Filtros.</strong> Entra quem tem mediana de pelo menos {formatarVolumeDiario(p.volumeMinimoDiario)} por dia, negociou em pelo menos {p.diasNegociadosMinimos} dos {p.janelaLiquidez} pregões e tem
          o último negócio há no máximo {p.pregoesMaxSemNegocio} pregões. {t.filtroExtra}
        </li>
        <li>
          <strong>Ordenação.</strong> Do maior para o menor volume mediano; em empate, vence quem negociou em mais dias e depois a ordem alfabética. Há também os {p.tamanhoPorCategoria} mais negociados de cada {t.categoria}.
        </li>
        <li>
          <strong>O que este ranking não é.</strong> {t.naoMede}
        </li>
      </ol>
    </details>
  )
}

function PorQueFicouDeFora({ t, s }: { t: Textos; s: SnapshotMaisNegociados }) {
  const [termo, setTermo] = useState('')
  const achados = buscarExclusaoMercado(s.exclusoes, termo)
  const contagem = contarExclusoesMercado(s.exclusoes, t.rotulosExclusao)
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Por que {t.umaSingular} ficou de fora?</summary>
      <div className="col" style={{ gap: 8, marginTop: 8 }}>
        <input type="search" className="busca-fii" placeholder={`Código ou nome, ex.: ${t.exemplo}`} aria-label={`Buscar ${t.singular} fora do ranking`} autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={termo} onChange={(e) => setTermo(e.target.value.slice(0, 40))} />
        {termo.trim().length >= 2 && achados.length === 0 && (
          <span className="small muted">{t.nenhum} fora do ranking com esse código ou nome. Se {t.ele} está no app, passou nos filtros e só não ficou entre os primeiros.</span>
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

function Auditoria({ t, s }: { t: Textos; s: SnapshotMaisNegociados }) {
  return (
    <details className="card">
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Auditoria e verificação</summary>
      <div className="col small justify" style={{ gap: 8, lineHeight: 1.5, marginTop: 8 }}>
        <span>
          {introAuditoria(s)} <code>{s.pastaAuditoria ?? t.pastaPadrao}</code> com os preços e volumes usados, o resultado, o volume de cada dia de cada {t.singular} da lista e o
          motivo de cada exclusão.
        </span>
        {notaAuditoriaDiaria(s) && <span>{notaAuditoriaDiaria(s)}</span>}
        <span>Para refazer o cálculo, sem internet, e conferir se o resultado é o mesmo:</span>
        <code style={{ display: 'block', overflowX: 'auto', whiteSpace: 'pre', padding: '6px 8px', borderRadius: 8, background: 'var(--surface2)' }}>
          node scripts/top15-mercado-verificar.mjs {s.pastaAuditoria ?? '…'}
        </code>
        <div className="col" style={{ gap: 0 }}>
          <Linha rotulo="Metodologia" valor={`v${s.versaoMetodologia}`} />
          <Linha rotulo="Impressão digital do resultado" valor={s.hashResultado ? `${s.hashResultado.slice(0, 16)}…` : '—'} />
          <Linha rotulo="Impressão digital dos insumos" valor={s.hashInsumos ? `${s.hashInsumos.slice(0, 16)}…` : '—'} />
          <Linha rotulo="Gerado em" valor={s.geradoEm ? formatarData(s.geradoEm) : '—'} />
        </div>
        <span className="tiny muted">A descrição completa está em docs/11-metodologia-top15-etfs-bdrs.md.</span>
      </div>
    </details>
  )
}
