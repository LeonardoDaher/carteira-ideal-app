import { useId, useMemo, useRef, useState } from 'react'
import { CATALOGO_ATIVOS } from '../data/catalogoAtivos'
import { classificarPosicoes } from '../domain/classesDaCarteira'
import { classificarAtivo } from '../domain/classificadorAtivo'
import type { ClasseCarteira } from '../domain/classificadorAtivo'
import { apurarImpostoRenda, categoriaIR } from '../domain/impostoRenda'
import { capitalAplicadoPorMes, composicaoDasLinhas, montarPainel, proventosDoMes, proventosMensais, proximosProventos, resumoDeProventos } from '../domain/painelCarteira'
import type { AppCtx } from '../state/useAppState'
import { useCarteiraReal } from '../state/useCarteiraReal'
import { AvisoEducacional } from '../ui/AvisoEducacional'
import { CartaoComparacao } from '../ui/painel/CartaoComparacao'
import { CartaoCarteira, CartaoComposicao, CartaoProventos, CartaoVazio } from '../ui/painel/CartoesPainel'
import { CartaoImpostoRenda } from '../ui/painel/CartaoImpostoRenda'
import { CartaoLancamentos } from '../ui/painel/CartaoLancamentos'
import type { FiltroTipo } from '../ui/painel/CartaoLancamentos'
import { CartaoPosicoes } from '../ui/painel/CartaoPosicoes'
import { ImportarArquivos } from '../ui/painel/ImportarArquivos'
import { EyeIcon, EyeOffIcon } from '../ui/Icon'
import { ValoresProvider } from '../ui/painel/valoresOcultos'
import { VoltarInicio } from '../ui/VoltarInicio'

const dois = (n: number) => String(n).padStart(2, '0')
const isoDe = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`

function baixarTexto(nome: string, texto: string, tipo: string) {
  const blob = typeof URL.createObjectURL === 'function' ? new Blob([texto], { type: tipo }) : null
  const a = document.createElement('a')
  a.href = blob ? URL.createObjectURL(blob) : `data:${tipo};charset=utf-8,${encodeURIComponent(texto)}`
  a.download = nome
  a.click()
  if (blob) setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function lerTextoDoArquivo(arquivo: File): Promise<string> {
  if (typeof arquivo.text === 'function') return arquivo.text()
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsText(arquivo)
  })
}

/**
 * Minha Carteira (D36): o painel de gestão da carteira REAL da pessoa. Ela importa os extratos da B3
 * (ou uma planilha própria), o app calcula o preço médio pelos lançamentos e mostra evolução,
 * proventos, composição e a conferência com a Posição. Tela avulsa, como o Meu Mês: abre por
 * `?tela=minhaCarteira`, não depende do questionário e guarda tudo só no aparelho.
 */
export function MinhaCarteira({ ctx, hoje, valoresVisiveis = false }: { ctx: AppCtx; hoje?: Date; /** Só para testes e demonstrações: abre com os valores à mostra. No app, abre sempre escondido (****). */ valoresVisiveis?: boolean }) {
  const agora = useRef(hoje ?? new Date()).current
  const hojeISO = isoDe(agora)
  const mesAtual = hojeISO.slice(0, 7)
  const idSeus = useId()
  const h = useCarteiraReal(hojeISO)
  const c = h.carteira
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [apagando, setApagando] = useState(false)
  const [filtroAtivo, setFiltroAtivo] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [pedidoNovo, setPedidoNovo] = useState(0)
  // Privacidade: os valores abrem escondidos (****) toda vez; só o olho os mostra, e a escolha não é gravada.
  const [oculto, setOculto] = useState(!valoresVisiveis)

  const painel = useMemo(
    () => montarPainel(c.lancamentos, c.posicao, c.dataPosicao, c.precosMedios, c.ativosManuais, c.ativosExcluidos),
    [c.lancamentos, c.posicao, c.dataPosicao, c.precosMedios, c.ativosManuais, c.ativosExcluidos],
  )
  // A classe de um ativo digitado à mão é a que a pessoa escolheu ao cadastrá-lo; vale mais que qualquer outra.
  const classesEfetivas = useMemo(
    () => ({ ...c.classes, ...Object.fromEntries(c.ativosManuais.map((m) => [m.ativo, m.classe])) }) as Record<string, ClasseCarteira>,
    [c.classes, c.ativosManuais],
  )
  const classificados = useMemo(() => classificarPosicoes(painel.linhas, CATALOGO_ATIVOS, classesEfetivas), [painel.linhas, classesEfetivas])
  const classeDe = (ativo: string): ClasseCarteira | null => classificados.find((x) => x.ativo === ativo)?.classe ?? null
  /** Escolher a classe de um ativo: nos digitados à mão muda o próprio cadastro; nos da B3, guarda a escolha. */
  function escolherClasse(ativo: string, classe: ClasseCarteira | null) {
    const manual = c.ativosManuais.find((m) => m.ativo === ativo)
    if (manual) {
      if (classe) {
        const { ativo: _chave, ...dados } = manual
        h.salvarAtivoManual({ ...dados, classe }, ativo)
      }
    } else h.definirClasse(ativo, classe)
  }
  const acoesDoPainel = {
    onPrecoMedio: h.definirPrecoMedio,
    onClasse: escolherClasse,
    onSalvarManual: h.salvarAtivoManual,
    onRemoverManual: h.removerAtivoManual,
    onExcluirAtivo: h.excluirAtivo,
    sugerirClasse: (nome: string): ClasseCarteira | null => {
      const r = classificarAtivo(nome, CATALOGO_ATIVOS)
      return r.classe && r.classe !== 'foraDaRegua' ? r.classe : null
    },
  }
  // Com a Posição, o gráfico mostra só o que a pessoa tem hoje; sem ela, todo o histórico.
  const atuais = useMemo(() => (painel.resumo.patrimonio !== null ? new Set(painel.ativosAtuais) : null), [painel])
  const serieCapital = useMemo(() => capitalAplicadoPorMes(c.lancamentos, mesAtual, 12, atuais), [c.lancamentos, mesAtual, atuais])
  const pontosProventos = useMemo(() => proventosMensais(c.lancamentos, c.eventosFuturos, hojeISO), [c.lancamentos, c.eventosFuturos, hojeISO])
  const resumoProventos = useMemo(() => resumoDeProventos(c.lancamentos, hojeISO), [c.lancamentos, hojeISO])
  const fatias = useMemo(() => composicaoDasLinhas(painel.linhas), [painel.linhas])
  const proximos = useMemo(() => proximosProventos(c.eventosFuturos, hojeISO), [c.eventosFuturos, hojeISO])
  const apuracaoIR = useMemo(
    () =>
      apurarImpostoRenda(c.lancamentos, (ativo) =>
        categoriaIR(ativo, classesEfetivas[ativo] ?? classificarAtivo(ativo, CATALOGO_ATIVOS).classe, CATALOGO_ATIVOS),
      ),
    [c.lancamentos, classesEfetivas],
  )
  const temDados = c.lancamentos.length > 0 || !!c.posicao || c.ativosManuais.length > 0

  /** "Lançamento direto": rola até a lista e abre o formulário de novo lançamento. */
  function abrirLancamento() {
    setPedidoNovo((n) => n + 1)
    document.getElementById('mc-lancamentos')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  /** De um ativo (conferência ou posições) para a lista de lançamentos, já filtrada por ele e só com compras e vendas, que é o que forma o preço médio. */
  function verLancamentosDe(ativo: string) {
    setFiltroAtivo(ativo)
    setFiltroTipo('negocios')
    document.getElementById('mc-lancamentos')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  return (
    <ValoresProvider oculto={oculto}>
    <div className="screen mc-tela">
      <VoltarInicio />
      <div className="mc-cabecalho">
        <div className="col" style={{ gap: 6 }}>
          <h1 style={{ fontSize: 21 }}>Meus Ativos</h1>
          <p className="mc-sub">Traga a sua carteira real para o app.</p>
        </div>
        <button
          type="button"
          className="mc-olho"
          aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}
          title={oculto ? 'Mostrar valores' : 'Ocultar valores'}
          onClick={() => setOculto((v) => !v)}
        >
          {oculto ? <EyeOffIcon size={22} /> : <EyeIcon size={22} />}
        </button>
      </div>
      {oculto && temDados && <p className="mc-nota">Valores ocultos (****). Toque no olho para ver.</p>}

      <ImportarArquivos onImportar={h.importarArquivos} onLancarDireto={abrirLancamento} />

      {h.hidratado && !temDados && (
        <>
          <p className="mc-chamada-vazia">Seus gráficos vão aparecer aqui</p>
          <div className="mc-grade">
            <CartaoVazio titulo="Carteira" rotulo="Seu patrimônio e a evolução" tipo="area" />
            <CartaoVazio titulo="Proventos" rotulo="O que você recebeu em 12 meses" tipo="barras" />
            <CartaoVazio titulo="Composição" rotulo="Como a sua carteira está dividida" tipo="composicao" />
          </div>
        </>
      )}

      {h.hidratado && temDados && (
        <div className="mc-grade">
          <CartaoCarteira painel={painel} serie={serieCapital} />
          <CartaoProventos
            pontos={pontosProventos}
            mesAtual={mesAtual}
            resumo={resumoProventos}
            itensDoMes={(mes) => proventosDoMes(c.lancamentos, c.eventosFuturos, mes, hojeISO)}
            proximos={proximos}
          />
          <div className="mc-largo">
            <CartaoComparacao
              resultado={ctx.resultado}
              pendente={!!ctx.resultadoPendente}
              erro={ctx.erroResultado}
              onTentarNovamente={ctx.tentarCalcularNovamente}
              onResponderQuestionario={ctx.iniciarQuestionario}
              painel={painel}
              classes={classesEfetivas}
              onEscolherClasse={escolherClasse}
            />
          </div>
          <CartaoComposicao fatias={fatias} />
        </div>
      )}

      {h.hidratado && (
        <CartaoPosicoes
          linhas={painel.linhas}
          dataPosicao={c.posicao ? c.dataPosicao : null}
          onDataPosicao={h.definirDataPosicao}
          classeDe={classeDe}
          classes={classesEfetivas}
          acoes={acoesDoPainel}
          onVerLancamentos={verLancamentosDe}
          excluidos={c.ativosExcluidos}
          onRestaurar={h.restaurarAtivo}
        />
      )}

      {h.hidratado && temDados && <CartaoImpostoRenda apuracao={apuracaoIR} />}

      {h.hidratado && (
        <CartaoLancamentos abrirNovo={pedidoNovo} lancamentos={c.lancamentos} hoje={hojeISO} onAdicionar={h.adicionar} onCorrigir={h.corrigir} onExcluir={h.excluir} filtro={filtroAtivo} onFiltro={setFiltroAtivo} filtroTipo={filtroTipo} onFiltroTipo={setFiltroTipo} />
      )}

      {h.hidratado && (
        <section className="mc-card" aria-labelledby={`${idSeus}-t`}>
          <h2 id={`${idSeus}-t`} className="mc-titulo">Seus dados</h2>
          <p className="mc-texto">
            Faça um backup antes de trocar de aparelho ou limpar o navegador.
          </p>
          <div className="mc-acoes">
            <button type="button" className="btn btn-secondary mc-btn" onClick={() => baixarTexto('minha-carteira-backup.json', h.exportarBackup(), 'application/json')}>
              Baixar backup
            </button>
            <label className="btn btn-secondary mc-btn mc-rotulo-botao">
              Restaurar backup
              <input
                type="file"
                accept=".json,application/json"
                className="mc-arquivo"
                onChange={async (e) => {
                  const arquivo = e.target.files?.[0]
                  if (!arquivo) return
                  const r = h.restaurarBackup(await lerTextoDoArquivo(arquivo))
                  setAviso(r.ok ? { tipo: 'ok', texto: 'Backup restaurado.' } : { tipo: 'erro', texto: r.erro ?? 'Não foi possível restaurar.' })
                  e.target.value = ''
                }}
              />
            </label>
            {apagando ? (
              <>
                <span className="mc-nota">Apagar todos os lançamentos e a Posição deste aparelho?</span>
                <button
                  type="button"
                  className="btn btn-secondary mc-btn mc-perigo"
                  onClick={() => {
                    h.limpar()
                    setApagando(false)
                    setAviso({ tipo: 'ok', texto: 'Dados apagados deste aparelho.' })
                  }}
                >
                  Sim, apagar tudo
                </button>
                <button type="button" className="btn btn-ghost mc-btn" onClick={() => setApagando(false)}>Cancelar</button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost mc-btn" onClick={() => setApagando(true)}>Apagar todos os dados</button>
            )}
          </div>
          {aviso && (
            <div className={aviso.tipo === 'ok' ? 'mc-ok' : 'mc-erro'} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
              {aviso.texto}
            </div>
          )}
        </section>
      )}

      <AvisoEducacional />
    </div>
    </ValoresProvider>
  )
}
