import { useEffect, useMemo, useRef, useState } from 'react'
import { interpretar } from '../domain/hp12cInterpretador'
import { GRUPOS, PROBLEMAS, bancoDeQuestoes, ehErro, problemaPorId, valoresIniciais } from '../domain/matematicaFinanceira'
import type { Campo, GrupoId } from '../domain/matematicaFinanceira'
import { Hp12cEmulador } from '../ui/Hp12cEmulador'
import { VoltarInicio } from '../ui/VoltarInicio'
import type { AppCtx } from '../state/useAppState'

type ReconhecimentoDeVoz = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function criarReconhecimento(): ReconhecimentoDeVoz | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => ReconhecimentoDeVoz; webkitSpeechRecognition?: new () => ReconhecimentoDeVoz }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

function CampoDoProblema({ campo, valor, onChange }: { campo: Campo; valor: string; onChange: (v: string) => void }) {
  const id = `hp-${campo.id}`
  return (
    <div className="col" style={{ gap: 4 }}>
      <label htmlFor={id} className="small" style={{ fontWeight: 600 }}>
        {campo.rotulo}
      </label>
      {campo.tipo === 'escolha' ? (
        <select id={id} className="input-cotas" value={valor} onChange={(e) => onChange(e.target.value)}>
          {campo.opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className="input-cotas"
          type="text"
          inputMode={campo.tipo === 'lista' ? 'text' : 'decimal'}
          autoComplete="off"
          value={valor}
          placeholder={campo.vazio ? 'Vazio = o que descobrir' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {campo.ajuda ? <span className="tiny muted">{campo.ajuda}</span> : null}
    </div>
  )
}

/**
 * Sua HP12C: o hub Simule Bens abre esta tela. A pessoa fala ou escreve um problema de matemática financeira, o app
 * descobre o tema (juros, taxas, desconto, rendas, investimentos ou amortização), preenche os campos e resolve mostrando a
 * fórmula. Abaixo há um banco de questões prontas e, acima delas, o seletor de tema para montar a conta na mão.
 * Tela avulsa: não depende do questionário. Conta matemática, sem indicar produto.
 */
export function SuaHp12c({ ctx }: { ctx: AppCtx }) {
  void ctx
  const [aba, setAba] = useState<'resolver' | 'calculadora'>('resolver')
  const [texto, setTexto] = useState('')
  const [problemaId, setProblemaId] = useState<string | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [avisos, setAvisos] = useState<string[]>([])
  const [naoEntendi, setNaoEntendi] = useState(false)
  const [ouvindo, setOuvindo] = useState(false)
  const [erroVoz, setErroVoz] = useState('')
  const [grupo, setGrupo] = useState<GrupoId | 'todos'>('todos')
  const voz = useRef<ReconhecimentoDeVoz | null>(null)
  const topoRef = useRef<HTMLDivElement>(null)
  const vozDisponivel = useMemo(() => criarReconhecimento() !== null, [])

  useEffect(() => () => voz.current?.stop(), [])

  const problema = problemaId ? problemaPorId(problemaId) : undefined
  const resultado = useMemo(() => (problema ? problema.resolver(valores) : null), [problema, valores])
  const banco = useMemo(() => bancoDeQuestoes(), [])
  const questoes = grupo === 'todos' ? banco : banco.filter((q) => q.problema.grupo === grupo)

  function escolherTema(id: string) {
    const p = problemaPorId(id)
    if (!p) return
    setProblemaId(id)
    setValores(valoresIniciais(p))
    setAvisos([])
    setNaoEntendi(false)
  }

  function resolverTexto(t: string) {
    const r = interpretar(t)
    if (!r) {
      setNaoEntendi(true)
      return
    }
    setNaoEntendi(false)
    setProblemaId(r.problemaId)
    setValores(r.valores)
    setAvisos(r.avisos)
  }

  function carregarQuestao(q: ReturnType<typeof bancoDeQuestoes>[number]) {
    setTexto(q.enunciado)
    setProblemaId(q.problema.id)
    setValores({ ...valoresIniciais(q.problema), ...q.valores })
    setAvisos([])
    setNaoEntendi(false)
    topoRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }

  function alternarVoz() {
    if (ouvindo) {
      voz.current?.stop()
      return
    }
    const r = criarReconhecimento()
    if (!r) return
    r.lang = 'pt-BR'
    r.interimResults = false
    r.continuous = false
    r.onresult = (e) => {
      const falado = Array.from(e.results)
        .map((alt) => alt[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (falado) {
        setTexto(falado)
        resolverTexto(falado)
      }
    }
    r.onerror = (e) => {
      setErroVoz(e.error === 'not-allowed' ? 'O microfone está bloqueado. Libere o acesso no navegador ou digite o problema.' : 'Não consegui ouvir. Tente de novo ou digite o problema.')
    }
    r.onend = () => setOuvindo(false)
    voz.current = r
    setErroVoz('')
    setOuvindo(true)
    try {
      r.start()
    } catch {
      setOuvindo(false)
    }
  }

  return (
    <div className="screen">
      <VoltarInicio href="./?tela=simuleBens" rotulo="← Simule Bens" />

      <div className="col" style={{ gap: 4 }} ref={topoRef}>
        <h1 style={{ fontSize: 21 }}>Sua HP12C</h1>
        <div className="muted small justify">
          Conte o problema de matemática financeira falando ou escrevendo, ou escolha uma questão pronta. O app descobre o tema, preenche os
          campos e resolve mostrando a fórmula. É uma conta matemática: não indica banco nem produto.
        </div>
      </div>

      <div className="row" style={{ gap: 6 }} role="tablist" aria-label="Modo">
        <button type="button" role="tab" aria-selected={aba === 'resolver'} className={`chip${aba === 'resolver' ? ' selected' : ''}`} onClick={() => setAba('resolver')}>
          Resolver problema
        </button>
        <button type="button" role="tab" aria-selected={aba === 'calculadora'} className={`chip${aba === 'calculadora' ? ' selected' : ''}`} onClick={() => setAba('calculadora')}>
          Calculadora HP-12C (RPN)
        </button>
      </div>

      {aba === 'calculadora' ? (
        <Hp12cEmulador />
      ) : (
        <>
      <div className="card col" style={{ gap: 10 }}>
        <label htmlFor="hp-problema" style={{ fontWeight: 700, fontSize: 14.5 }}>
          Qual é o seu problema?
        </label>
        <textarea
          id="hp-problema"
          className="input-cotas"
          rows={3}
          value={texto}
          placeholder="Ex.: Qual o montante de 10 mil reais a 2% ao mês, juros compostos, por 8 meses?"
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {vozDisponivel ? (
            <button type="button" className="btn btn-outline" onClick={alternarVoz} aria-pressed={ouvindo}>
              {ouvindo ? '⏹ Parar de ouvir' : '🎤 Falar o problema'}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" disabled={texto.trim() === ''} onClick={() => resolverTexto(texto)}>
            Resolver
          </button>
        </div>
        {!vozDisponivel ? <span className="tiny muted">Este navegador não tem reconhecimento de voz. Digite o problema ou use o teclado de voz do celular.</span> : null}
        {ouvindo ? <span className="small" role="status">Ouvindo… fale o problema com os valores, as taxas e os prazos.</span> : null}
        {erroVoz ? <span className="small" role="alert">{erroVoz}</span> : null}
        {naoEntendi ? (
          <span className="small" role="alert">
            Não identifiquei o tema. Inclua valores, taxa e prazo (ex.: “5 mil a 1,5% ao mês por 10 meses”) ou escolha o tema abaixo.
          </span>
        ) : null}
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <div className="col" style={{ gap: 4 }}>
          <label htmlFor="hp-tema" style={{ fontWeight: 700, fontSize: 14.5 }}>
            Tema da conta
          </label>
          <select id="hp-tema" className="input-cotas" value={problemaId ?? ''} onChange={(e) => escolherTema(e.target.value)}>
            <option value="" disabled>
              Escolha um tema…
            </option>
            {GRUPOS.map((g) => (
              <optgroup key={g.id} label={g.titulo}>
                {PROBLEMAS.filter((p) => p.grupo === g.id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {problema ? (
          <>
            <div className="muted small justify">{problema.resumo}</div>
            {avisos.map((a) => (
              <div key={a} className="small justify hp-aviso">
                {a}
              </div>
            ))}
            <div className="hp-grade">
              {problema.campos.map((c) => (
                <CampoDoProblema key={c.id} campo={c} valor={valores[c.id] ?? ''} onChange={(v) => setValores((atual) => ({ ...atual, [c.id]: v }))} />
              ))}
            </div>

            {resultado && !ehErro(resultado) ? (
              <div className="col hp-resultado" style={{ gap: 8 }} aria-live="polite">
                <div className="col" style={{ gap: 4 }}>
                  {resultado.linhas.map((l) => (
                    <div key={l.rotulo} className="row-between small hp-linha">
                      <span className={l.destaque ? '' : 'muted'}>{l.rotulo}</span>
                      <span style={{ fontWeight: l.destaque ? 800 : 600, fontSize: l.destaque ? 16 : undefined, textAlign: 'right' }}>{l.valor}</span>
                    </div>
                  ))}
                </div>
                {resultado.tabela ? (
                  <div className="hp-tabela-rolagem">
                    <table className="hp-tabela">
                      <thead>
                        <tr>
                          {resultado.tabela.cabecalho.map((h) => (
                            <th key={h}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.tabela.linhas.map((linha) => (
                          <tr key={linha[0]}>
                            {linha.map((c, k) => (
                              <td key={k}>{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <details className="small">
                  <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Como foi calculado</summary>
                  <div className="col" style={{ gap: 4, marginTop: 6 }}>
                    {resultado.passos.map((p) => (
                      <span key={p} className="tiny muted justify">
                        {p}
                      </span>
                    ))}
                  </div>
                </details>
              </div>
            ) : resultado ? (
              <div className="small muted justify" role="status">
                {resultado.erro}
              </div>
            ) : null}
          </>
        ) : (
          <div className="muted small">Escolha um tema, ou descreva o problema acima, ou toque numa questão do banco.</div>
        )}
      </div>

      <div className="col" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 16 }}>Banco de questões</h2>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Filtrar questões por assunto">
          <button type="button" className={`chip${grupo === 'todos' ? ' selected' : ''}`} aria-pressed={grupo === 'todos'} onClick={() => setGrupo('todos')}>
            Todas
          </button>
          {GRUPOS.map((g) => (
            <button key={g.id} type="button" className={`chip${grupo === g.id ? ' selected' : ''}`} aria-pressed={grupo === g.id} onClick={() => setGrupo(g.id)}>
              {g.titulo}
            </button>
          ))}
        </div>
        <div className="col" style={{ gap: 8 }}>
          {questoes.map((q) => (
            <button key={q.id} type="button" className="card-outline hp-questao" onClick={() => carregarQuestao(q)}>
              <span className="tiny muted">{q.problema.titulo}</span>
              <span className="small">{q.enunciado}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tiny muted justify">
        Convenções das aulas: mês comercial de 30 dias, ano de 12 meses, taxas em %. Na HP12C, o que entra no caixa é positivo e o que sai é negativo; a
        parcela de um financiamento aparece com sinal contrário ao do valor financiado.
      </div>
        </>
      )}
    </div>
  )
}
