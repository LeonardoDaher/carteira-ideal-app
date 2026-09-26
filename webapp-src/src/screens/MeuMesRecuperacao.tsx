import { useId, useState } from 'react'
import {
  dividasDoPlano,
  faseRecuperacao,
  lerReais,
  mesPorExtenso,
  metaMiniReserva,
  modoRecuperacaoAtivo,
  planoDoMes,
  recuperacaoDe,
  somarMeses,
  temDividaCara,
  valorDoPlano,
} from '../domain/orcamento'
import type { Orcamento } from '../domain/orcamento'
import {
  LIMIAR_JUROS_CARO,
  ORDEM_DOS_TIPOS,
  TIPOS_DE_DIVIDA,
  ehDividaCara,
  jurosAnualDeMensal,
  jurosDoMes,
  jurosMensalDeAnual,
  minimoNaoCobreJuros,
  primeiraVitoria,
  simularQuitacao,
  somaParcelasMinimas,
} from '../domain/recuperacao'
import type { Divida, MetodoQuitacao, Plano, TipoDivida } from '../domain/recuperacao'
import { reais } from '../domain/mercadoOficial'
import { CampoReais } from '../ui/CampoReais'
import { LINKS_OFICIAIS } from '../data/linksOficiais'

/**
 * Meu Mês (D21, Etapa 3): Modo Recuperação. Liga sozinho com dívida cara (cartão, cheque
 * especial, empréstimo pessoal, dívida em dólar ou juros a partir de 3% ao mês) ou por escolha
 * da pessoa. Conteúdo educativo: não indica banco, produto de crédito nem estratégia jurídica.
 */

const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const meses = (n: number) => `${n} ${n === 1 ? 'mês' : 'meses'}`

/** Mês (1 = este mês) do plano → "março de 2027". */
const mesDoPlano = (mesDeHoje: string, n: number) => mesPorExtenso(somarMeses(mesDeHoje, n - 1))

// ---------------------------------------------------------------- painel das fases

export function PainelRecuperacao({ orcamento, onDesligar }: { orcamento: Orcamento; onDesligar: () => void }) {
  const cara = temDividaCara(orcamento)
  const fase = faseRecuperacao(orcamento)
  const meta = metaMiniReserva(orcamento)
  const maiorJuros = Math.max(0, ...recuperacaoDe(orcamento).dividas.filter(ehDividaCara).map((d) => d.jurosMensal))
  const falta = Math.max(0, meta - orcamento.reserva)

  const passos: { titulo: string; texto: string; estado: 'feito' | 'atual' | 'proximo' }[] = [
    {
      titulo: `Mini-reserva de ${reais(meta)}`,
      texto:
        fase === 'mini-reserva'
          ? `Faltam ${reais(falta)}. Junte no pote Guardar, pagando as parcelas mínimas em dia: é ela que impede um imprevisto de virar dívida nova.`
          : 'Pronta. Use só em emergência de verdade e, se usar, volte a completar antes de tudo.',
      estado: fase === 'mini-reserva' ? 'atual' : 'feito',
    },
    {
      titulo: 'Quitar as dívidas caras',
      texto:
        maiorJuros > 0
          ? `O pote Quitar ocupa o lugar do Fazer Crescer. Nenhum investimento seguro rende os ${pct(maiorJuros)} ao mês que a sua dívida cobra: cada real que vai para ela "rende" esses juros.`
          : 'O pote Quitar ocupa o lugar do Fazer Crescer: pagar dívida cara é o melhor investimento que existe.',
      estado: fase === 'quitar' ? 'atual' : 'proximo',
    },
    {
      titulo: 'Completar a reserva e voltar a investir',
      texto: 'Sem dívida cara, o Modo Recuperação desliga sozinho e o Fazer Crescer volta. Antes de investir, complete a reserva de 3 meses de contas.',
      estado: 'proximo',
    },
  ]

  return (
    <div className="card col mm-recuperacao" style={{ gap: 12 }}>
      <div className="col" style={{ gap: 4 }}>
        <span style={{ fontWeight: 700 }}>Modo Recuperação ligado</span>
        <span className="muted small justify">
          {cara
            ? 'Você tem dívida cara. Até ela acabar, o seu mês segue estas regras, uma fase de cada vez.'
            : 'Você ligou o Modo Recuperação por conta própria. O seu mês segue estas regras, uma fase de cada vez.'}
        </span>
      </div>
      <ol className="mm-fases">
        {passos.map((p) => (
          <li key={p.titulo} className={`mm-fase mm-fase-${p.estado}`} aria-current={p.estado === 'atual' ? 'step' : undefined}>
            <span className="mm-fase-marca" aria-hidden="true">
              {p.estado === 'feito' ? '✓' : ''}
            </span>
            <span className="col" style={{ gap: 2, minWidth: 0 }}>
              <span className="small" style={{ fontWeight: 700 }}>
                {p.titulo}
                {p.estado === 'atual' && <span className="sr-only"> (fase atual)</span>}
              </span>
              <span className="tiny muted justify">{p.texto}</span>
            </span>
          </li>
        ))}
      </ol>
      {cara ? (
        <span className="tiny muted">Desliga sozinho quando a última dívida cara for quitada.</span>
      ) : (
        <button className="mm-link small" style={{ alignSelf: 'flex-start' }} onClick={onDesligar}>
          Desligar o Modo Recuperação
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- cadastro de dívidas

/** A taxa pode ser digitada ao mês ou ao ano (financiamentos costumam informar ao ano). Guardada sempre ao mês. */
type PeriodoJuros = 'mes' | 'ano'
type Rascunho = { nome: string; tipo: TipoDivida; saldo: number; juros: string; periodo: PeriodoJuros; minimo: number }
const RASCUNHO_VAZIO: Rascunho = { nome: '', tipo: 'cartao-rotativo', saldo: 0, juros: '14', periodo: 'mes', minimo: 0 }

const textoJuros = (v: number | null) => (v == null ? '' : v.toLocaleString('pt-BR', { maximumFractionDigits: 4 }))
/** Limites de sanidade: 100% ao mês, ou 1.000% ao ano. */
const lerJuros = (t: string, periodo: PeriodoJuros) => Math.min(periodo === 'ano' ? 1000 : 100, lerReais(t))
const jurosMensalDoRascunho = (r: Rascunho) =>
  r.periodo === 'ano' ? jurosMensalDeAnual(lerJuros(r.juros, 'ano')) : lerJuros(r.juros, 'mes')

function comoDivida(r: Rascunho): Omit<Divida, 'id' | 'saldoInicial'> {
  return { nome: r.nome.trim(), tipo: r.tipo, saldo: r.saldo, jurosMensal: jurosMensalDoRascunho(r), parcelaMinima: r.minimo }
}

export function MinhasDividas({
  orcamento,
  onAdicionar,
  onEditar,
  onRemover,
  onLigar,
}: {
  orcamento: Orcamento
  onAdicionar: (d: Omit<Divida, 'id' | 'saldoInicial'>) => void
  onEditar: (id: string, d: Omit<Divida, 'id' | 'saldoInicial'>) => void
  onRemover: (id: string) => void
  onLigar: () => void
}) {
  const { dividas } = recuperacaoDe(orcamento)
  const ativo = modoRecuperacaoAtivo(orcamento)
  const [aberto, setAberto] = useState(false)
  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [versaoForm, setVersaoForm] = useState(0)
  const idNome = useId()
  const idTipo = useId()
  const idJuros = useId()
  const idDicaJuros = useId()

  const valido = rascunho.nome.trim().length > 0 && rascunho.saldo > 0
  const previa = { ...comoDivida(rascunho), id: '', saldoInicial: rascunho.saldo }
  const referencia = TIPOS_DE_DIVIDA[rascunho.tipo].jurosReferencia
  // Mostra a taxa equivalente no outro período, por juros compostos (12% ao ano ≈ 0,95% ao mês, e não 1%).
  const jurosDigitado = lerJuros(rascunho.juros, rascunho.periodo)
  const conversaoJuros =
    jurosDigitado <= 0
      ? null
      : rascunho.periodo === 'ano'
        ? `${pct(jurosDigitado)} ao ano equivalem a ${pct(jurosMensalDeAnual(jurosDigitado))} ao mês.`
        : `${pct(jurosDigitado)} ao mês equivalem a ${pct(jurosAnualDeMensal(jurosDigitado))} ao ano.`
  const formVisivel = aberto || editandoId != null || dividas.length > 0

  const quitouAsCaras =
    !temDividaCara(orcamento) && dividas.some((d) => d.saldo <= 0 && (TIPOS_DE_DIVIDA[d.tipo].cara || d.jurosMensal >= LIMIAR_JUROS_CARO))

  function carregar(r: Rascunho, id: string | null) {
    setRascunho(r)
    setEditandoId(id)
    setVersaoForm((v) => v + 1)
  }

  function mudarTipo(tipo: TipoDivida) {
    // Troca a taxa só se a pessoa ainda não digitou a dela (campo vazio ou igual à referência).
    const anterior = textoJuros(TIPOS_DE_DIVIDA[rascunho.tipo].jurosReferencia)
    const trocar = rascunho.juros === '' || (rascunho.periodo === 'mes' && rascunho.juros === anterior)
    // A referência é sempre ao mês: ao usá-la, o campo volta para "ao mês".
    if (trocar) setRascunho({ ...rascunho, tipo, juros: textoJuros(TIPOS_DE_DIVIDA[tipo].jurosReferencia), periodo: 'mes' })
    else setRascunho({ ...rascunho, tipo })
  }

  function salvar() {
    if (!valido) return
    if (editandoId) onEditar(editandoId, comoDivida(rascunho))
    else onAdicionar(comoDivida(rascunho))
    carregar(RASCUNHO_VAZIO, null)
    setAberto(false)
  }

  return (
    <div className="card col" style={{ gap: 12 }}>
      <span className="mm-titulo-dividas">Minhas dívidas</span>

      {dividas.length === 0 && !aberto && (
        <>
          <span className="muted small justify">
            Tem dívida de cartão, cheque especial ou empréstimo? Cadastre aqui para ver um plano de quitação. Dívida cara liga o Modo
            Recuperação, com regras firmes até ela acabar.
          </span>
          <button className="btn btn-outline" onClick={() => setAberto(true)}>
            Cadastrar uma dívida
          </button>
          {!ativo && (
            <button className="mm-link small" style={{ alignSelf: 'flex-start' }} onClick={onLigar}>
              Ligar o Modo Recuperação sem cadastrar dívida
            </button>
          )}
        </>
      )}

      {quitouAsCaras && (
        <div className="small justify mm-situacao mm-celebra" role="status">
          Você quitou as dívidas caras! 🎉 O Modo Recuperação desligou e o pote Fazer Crescer voltou. Próximo passo: completar a reserva
          de 3 meses de contas antes de investir.
        </div>
      )}

      {dividas.length > 0 && (
        <ul className="mm-lista">
          {dividas.map((d) => {
            const abatido = Math.max(0, d.saldoInicial - d.saldo)
            const progresso = d.saldoInicial > 0 ? abatido / d.saldoInicial : 0
            return (
              <li key={d.id} className="col mm-divida" style={{ gap: 4 }}>
                <div className="row" style={{ gap: 12, alignItems: 'baseline' }}>
                  <span className="mm-item-nome grow" style={{ minWidth: 0 }}>
                    {d.nome} {ehDividaCara(d) && <span className="badge badge-baixa">Cara</span>}
                  </span>
                  <span className="mm-item-valor">{reais(d.saldo)}</span>
                  <button
                    className="mm-link small"
                    aria-label={`Editar ${d.nome}`}
                    onClick={() =>
                      carregar(
                        { nome: d.nome, tipo: d.tipo, saldo: d.saldo, juros: textoJuros(d.jurosMensal), periodo: 'mes', minimo: d.parcelaMinima },
                        d.id,
                      )
                    }
                  >
                    Editar
                  </button>
                </div>
                <span className="tiny muted">
                  {TIPOS_DE_DIVIDA[d.tipo].rotulo} · {pct(d.jurosMensal)} ao mês · mínima {reais(d.parcelaMinima)}
                </span>
                {d.saldo > 0 ? (
                  <>
                    <div className="mm-divida-progresso" aria-hidden="true">
                      <div style={{ width: `${progresso * 100}%` }} />
                    </div>
                    <span className="tiny muted">
                      {abatido > 0 ? `${reais(abatido)} já abatidos de ${reais(d.saldoInicial)}` : 'Atualize o saldo pelo extrato todo mês, em Editar.'}
                    </span>
                  </>
                ) : (
                  <span className="tiny" style={{ fontWeight: 600 }}>
                    Quitada 🎉
                  </span>
                )}
                {minimoNaoCobreJuros(d) && (
                  <span className="tiny mm-aviso-divida">
                    A mínima não cobre nem os juros do mês ({reais(jurosDoMes(d))}): pagando só ela, a dívida cresce.
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {formVisivel && (
        <div className="col mm-form" style={{ gap: 10 }}>
          <span className="small" style={{ fontWeight: 700 }}>
            {editandoId ? 'Atualizar dívida' : 'Adicionar dívida'}
          </span>

          <label htmlFor={idNome} className="col" style={{ gap: 4 }}>
            <span className="small" style={{ fontWeight: 600 }}>
              Nome da dívida
            </span>
            <input
              id={idNome}
              className="input-cotas"
              value={rascunho.nome}
              maxLength={40}
              placeholder="Como você chama esta dívida"
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
            />
          </label>

          <label htmlFor={idTipo} className="col" style={{ gap: 4 }}>
            <span className="small" style={{ fontWeight: 600 }}>
              Tipo
            </span>
            <select id={idTipo} className="input-cotas" value={rascunho.tipo} onChange={(e) => mudarTipo(e.target.value as TipoDivida)}>
              {ORDEM_DOS_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPOS_DE_DIVIDA[t].rotulo}
                </option>
              ))}
            </select>
          </label>

          <CampoReais
            key={`saldo-${versaoForm}`}
            rotulo="Quanto deve hoje"
            valor={rascunho.saldo}
            onMudar={(v) => setRascunho((r) => ({ ...r, saldo: v }))}
            dica="Está no extrato ou no app do credor como saldo devedor ou valor para quitação."
          />

          <div className="col" style={{ gap: 4 }}>
            <label htmlFor={idJuros} className="small" style={{ fontWeight: 600 }}>
              {rascunho.periodo === 'ano' ? 'Juros ao ano (%)' : 'Juros ao mês (%)'}
            </label>
            <div className="row" style={{ gap: 6 }} role="group" aria-label="A taxa informada é">
              {(['mes', 'ano'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip ${rascunho.periodo === p ? 'selected' : ''}`}
                  aria-pressed={rascunho.periodo === p}
                  onClick={() => setRascunho({ ...rascunho, periodo: p })}
                >
                  {p === 'mes' ? 'Ao mês' : 'Ao ano'}
                </button>
              ))}
            </div>
            <span className="mm-campo">
              <input
                id={idJuros}
                inputMode="decimal"
                autoComplete="off"
                className="input-cotas"
                value={rascunho.juros}
                placeholder="0"
                aria-describedby={idDicaJuros}
                onChange={(e) => setRascunho({ ...rascunho, juros: e.target.value })}
              />
              <span className="muted" aria-hidden="true">
                %
              </span>
            </span>
            {conversaoJuros && (
              <span className="small" role="status">
                {conversaoJuros}
              </span>
            )}
            <span id={idDicaJuros} className="tiny muted justify">
              Procure a taxa de juros ou o CET no contrato ou no app. Financiamento e consignado costumam informar a taxa ao ano;
              cartão e cheque especial, ao mês.
              {referencia != null && ` Se não achar, ${pct(referencia)} ao mês é uma referência aproximada para este tipo; troque pela sua taxa.`}
            </span>
          </div>

          <CampoReais
            key={`minimo-${versaoForm}`}
            rotulo="Parcela ou pagamento mínimo por mês"
            valor={rascunho.minimo}
            onMudar={(v) => setRascunho((r) => ({ ...r, minimo: v }))}
            dica="Esta parcela passa a sair daqui: não cadastre de novo em Minhas contas."
          />

          {minimoNaoCobreJuros(previa) && (
            <span className="small justify mm-alerta-parcela" role="note">
              Essa parcela não cobre nem os juros do mês ({reais(jurosDoMes(previa))}). A dívida cresce mesmo pagando em dia: ela precisa
              de dinheiro a mais do pote Quitar ou de uma renegociação.
            </span>
          )}

          <button className="btn btn-primary" disabled={!valido} onClick={salvar}>
            {editandoId ? 'Salvar alterações' : 'Adicionar dívida'}
          </button>
          {(editandoId || (aberto && dividas.length === 0)) && (
            <div className="row" style={{ gap: 8 }}>
              <button
                className="btn btn-outline"
                onClick={() => {
                  carregar(RASCUNHO_VAZIO, null)
                  setAberto(false)
                }}
              >
                Cancelar
              </button>
              {editandoId && (
                <button
                  className="btn btn-outline mm-perigo"
                  onClick={() => {
                    if (window.confirm(`Remover "${rascunho.nome}" e os pagamentos ticados dela?`)) {
                      onRemover(editandoId)
                      carregar(RASCUNHO_VAZIO, null)
                    }
                  }}
                >
                  Remover
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- plano de quitação

const NOME_METODO: Record<MetodoQuitacao, { nome: string; regra: string }> = {
  avalanche: { nome: 'Avalanche', regra: 'Juros mais altos primeiro' },
  'bola-de-neve': { nome: 'Bola de neve', regra: 'Menor dívida primeiro' },
}

function ResumoDoPlano({ plano, mesDeHoje, nomes }: { plano: Plano; mesDeHoje: string; nomes: Record<string, string> }) {
  const pv = primeiraVitoria(plano)
  if (plano.status !== 'ok') return <span className="small mm-negativo">Não termina com esse valor</span>
  return (
    <>
      <span className="small">
        Quitadas em <strong>{meses(plano.meses)}</strong>
      </span>
      <span className="tiny muted">até {mesDoPlano(mesDeHoje, plano.meses)}</span>
      <span className="small">Juros até lá: {reais(plano.jurosTotais)}</span>
      {pv && (
        <span className="tiny muted">
          1ª quitada: {nomes[pv.id]}, em {meses(pv.mes)}
        </span>
      )}
    </>
  )
}

export function PlanoDeQuitacao({
  orcamento,
  mesDeHoje,
  onQuitar,
  onMetodo,
}: {
  orcamento: Orcamento
  mesDeHoje: string
  onQuitar: (v: number) => void
  onMetodo: (m: MetodoQuitacao) => void
}) {
  const { dividas, metodo } = recuperacaoDe(orcamento)
  const abertas = dividasDoPlano(orcamento)
  if (abertas.length === 0) return null

  const ativo = modoRecuperacaoAtivo(orcamento)
  const quitar = orcamento.potes.quitar ?? 0
  const minimos = somaParcelasMinimas(abertas)
  const foraDoPlano = dividas.filter((d) => d.saldo > 0 && !abertas.includes(d))
  const nomes = Object.fromEntries(dividas.map((d) => [d.id, d.nome]))
  const planos: Record<MetodoQuitacao, Plano> = {
    avalanche: planoDoMes(orcamento, 'avalanche'),
    'bola-de-neve': planoDoMes(orcamento, 'bola-de-neve'),
  }
  const escolhido = planos[metodo]
  const comparar = ativo && abertas.length >= 2
  const soMinimo = ativo && quitar > 0 ? simularQuitacao(abertas, minimos, 'avalanche') : null

  let comparacao: string | null = null
  if (comparar && planos.avalanche.status === 'ok' && planos['bola-de-neve'].status === 'ok') {
    const economia = planos['bola-de-neve'].jurosTotais - planos.avalanche.jurosTotais
    const pvAv = primeiraVitoria(planos.avalanche)
    const pvBn = primeiraVitoria(planos['bola-de-neve'])
    const antes = pvAv && pvBn ? pvAv.mes - pvBn.mes : 0
    comparacao =
      economia >= 1
        ? `A avalanche economiza ${reais(economia)} em juros.${antes > 0 ? ` A bola de neve quita a primeira dívida ${meses(antes)} antes.` : ''} Escolha a que você vai conseguir seguir até o fim.`
        : 'Os dois caminhos custam praticamente o mesmo. A bola de neve costuma dar a primeira vitória mais cedo.'
  }

  return (
    <div className="card col" style={{ gap: 12 }}>
      <span style={{ fontWeight: 700 }}>Plano de quitação</span>

      {ativo ? (
        <CampoReais
          rotulo="🔴 Pote Quitar: quanto a mais por mês, além das mínimas"
          valor={quitar}
          onMudar={onQuitar}
          dica={
            faseRecuperacao(orcamento) === 'mini-reserva'
              ? 'Enquanto junta a mini-reserva, pode começar pequeno. Depois dela, tudo o que der vem para cá.'
              : 'Mini-reserva pronta: tudo o que der vem para cá. O que sobrar é o pote Gastar.'
          }
        />
      ) : (
        <span className="muted small justify">
          Só dívidas com juros baixos: o plano é pagar as parcelas em dia. Antecipar só vale depois da reserva de emergência completa.
        </span>
      )}

      <div className="row-between small">
        <span className="muted">{foraDoPlano.length > 0 ? 'Por mês para as dívidas caras' : 'Por mês para as dívidas'}</span>
        <span style={{ fontWeight: 700 }}>{reais(valorDoPlano(orcamento))}</span>
      </div>
      {ativo && (
        <span className="tiny muted">
          {reais(minimos)} de parcelas mínimas + {reais(Math.max(0, valorDoPlano(orcamento) - minimos))} do pote Quitar.
        </span>
      )}

      {comparar ? (
        <div className="mm-metodos" role="group" aria-label="Método de quitação">
          {(['avalanche', 'bola-de-neve'] as const).map((m) => (
            <button key={m} className={`mm-metodo ${m === metodo ? 'selected' : ''}`} aria-pressed={m === metodo} onClick={() => onMetodo(m)}>
              <span style={{ fontWeight: 700 }}>{NOME_METODO[m].nome}</span>
              <span className="tiny muted">{NOME_METODO[m].regra}</span>
              <ResumoDoPlano plano={planos[m]} mesDeHoje={mesDeHoje} nomes={nomes} />
            </button>
          ))}
        </div>
      ) : (
        <div className="col" style={{ gap: 2 }}>
          <ResumoDoPlano plano={escolhido} mesDeHoje={mesDeHoje} nomes={nomes} />
        </div>
      )}
      {comparacao && <span className="small justify">{comparacao}</span>}

      {escolhido.status === 'nao-termina' && (
        <div className="small justify mm-situacao mm-situacao-negativo" role="status">
          Com esse valor, os juros crescem mais rápido do que os pagamentos e as dívidas não terminam. Aumente o pote Quitar ou
          renegocie: veja o roteiro de negociação.
        </div>
      )}

      {escolhido.status === 'ok' && escolhido.ordem.length >= 2 && (
        <div className="col" style={{ gap: 4 }}>
          <span className="tiny muted" style={{ fontWeight: 600 }}>
            Ordem de ataque ({NOME_METODO[metodo].nome.toLowerCase()})
          </span>
          <ol className="mm-ordem small">
            {escolhido.ordem.map((id) => (
              <li key={id}>
                {nomes[id]}
                <span className="muted"> · quitada em {mesDoPlano(mesDeHoje, escolhido.quitacoes[id])}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {soMinimo && escolhido.status === 'ok' && (
        <span className="small justify">
          {soMinimo.status === 'ok'
            ? `Só com as parcelas mínimas, levaria ${meses(soMinimo.meses)} e ${reais(soMinimo.jurosTotais)} de juros.`
            : 'Só com as parcelas mínimas, as dívidas não terminariam.'}
        </span>
      )}

      {foraDoPlano.length > 0 && (
        <span className="small justify">
          {foraDoPlano.map((d) => d.nome).join(', ')} {foraDoPlano.length === 1 ? 'fica' : 'ficam'} fora do plano: juros baixos, só a
          parcela em dia. O pote Quitar vai todo para as dívidas caras.
        </span>
      )}

      <span className="tiny muted justify">
        Simulação com juros constantes, sem multas, IOF ou compras novas. Atualize o saldo de cada dívida pelo extrato todo mês, em
        Minhas dívidas.
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- pacto de não parcelar

export function PactoNaoParcelar({
  pactoDesde,
  parceladas,
  mesDeHoje,
  onPacto,
}: {
  pactoDesde: string | null
  parceladas: number
  mesDeHoje: string
  onPacto: (mes: string | null) => void
}) {
  if (!pactoDesde) {
    return (
      <div className="card-outline col small mm-pacto" style={{ gap: 8 }}>
        <span style={{ fontWeight: 700 }}>Pacto de não parcelar</span>
        <span className="justify">
          No Modo Recuperação, parcelar é fazer dívida nova com o salário dos próximos meses. A regra é simples: se não cabe à vista,
          não cabe no mês.
        </span>
        <button className="btn btn-outline" onClick={() => onPacto(mesDeHoje)}>
          Fazer o pacto
        </button>
      </div>
    )
  }
  return (
    <div className="card-outline col small mm-pacto mm-pacto-feito" style={{ gap: 6 }}>
      <span style={{ fontWeight: 700 }}>Pacto de não parcelar desde {mesPorExtenso(pactoDesde)}</span>
      <span className="justify">
        {parceladas === 0
          ? 'Nenhuma compra parcelada desde então. Continue assim.'
          : `${parceladas} ${parceladas === 1 ? 'compra parcelada' : 'compras parceladas'} desde o pacto. Recomece hoje: vale o próximo mês.`}
      </span>
      <button
        className="mm-link tiny muted"
        style={{ alignSelf: 'flex-start' }}
        onClick={() => {
          if (window.confirm('Desfazer o pacto de não parcelar? O parcelamento volta a ficar liberado sem aviso.')) onPacto(null)
        }}
      >
        Desfazer o pacto
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- roteiro de negociação

const LINKS = LINKS_OFICIAIS

function Externo({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="mm-externo">
      {children}
    </a>
  )
}

export function RoteiroNegociacao() {
  return (
    <details className="card-outline mm-roteiro">
      <summary style={{ fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Como negociar suas dívidas</summary>
      <ol className="col small" style={{ gap: 10, marginTop: 10, lineHeight: 1.5 }}>
        <li className="justify">
          <strong>Descubra tudo o que você deve.</strong> O <Externo href={LINKS.registrato}>Registrato</Externo>, do Banco Central, mostra
          de graça os empréstimos, financiamentos e cartões no seu CPF. Entre com a conta gov.br (nível prata ou ouro).
        </li>
        <li className="justify">
          <strong>Pare de alimentar a dívida.</strong> Não use o cartão ou o cheque especial que estão em dívida. Você pode pedir ao banco,
          a qualquer momento, para diminuir ou cancelar o limite do cheque especial.
        </li>
        <li className="justify">
          <strong>Negocie sabendo quanto cabe.</strong> Antes de falar com o credor, saiba o valor do seu pote Quitar. Peça a proposta por
          escrito, com o CET (Custo Efetivo Total) e o total a pagar, e compare com a dívida de hoje. Não aceite parcela que não cabe:
          acordo quebrado volta pior.
        </li>
        <li className="justify">
          <strong>Ofertas de acordo pela internet.</strong> O <Externo href={LINKS.serasa}>Serasa Limpa Nome</Externo> reúne propostas de
          muitos credores para dívidas em atraso. Confira se a oferta também aparece no canal oficial do credor e nunca pague boleto
          recebido por mensagem ou link de desconhecidos.
        </li>
        <li className="justify">
          <strong>Se o credor não resolver.</strong> Registre reclamação no <Externo href={LINKS.consumidor}>consumidor.gov.br</Externo>,
          serviço público em que a empresa tem prazo para responder.
        </li>
        <li className="justify">
          <strong>Quando as dívidas já não cabem no salário.</strong> A{' '}
          <Externo href={LINKS.lei14181}>Lei do Superendividamento (Lei 14.181/2021)</Externo> permite renegociar as dívidas de consumo
          todas juntas, num plano de até 5 anos que preserve um mínimo para você viver. Procure o Procon da sua cidade ou a Defensoria
          Pública, que atende de graça quem não pode pagar advogado. Financiamento imobiliário, crédito rural e dívidas com garantia
          ficam de fora.
        </li>
      </ol>
      <p className="tiny muted justify" style={{ marginTop: 10 }}>
        Conteúdo educativo. Não é assessoria jurídica e não indica banco nem produto de crédito.
      </p>
    </details>
  )
}
