import { useState } from 'react'
import { estadoInicial, formatarVisor, pressionar, visor } from '../domain/hp12cEmulador'

type Tecla = {
  /** Id da tecla no motor; sem id, a tecla fica apagada (função que o emulador não tem). */
  id?: string
  rotulo: string
  f?: string
  g?: string
  cor?: 'f' | 'g'
  larga?: boolean
}

// Disposição da HP-12C: quatro linhas de dez teclas, com o ENTER ocupando duas linhas.
const TECLAS: Tecla[] = [
  { id: 'n', rotulo: 'n', g: '12×' },
  { id: 'i', rotulo: 'i', f: 'INT', g: '12÷' },
  { id: 'pv', rotulo: 'PV', f: 'NPV', g: 'CFo' },
  { id: 'pmt', rotulo: 'PMT', f: 'RND', g: 'CFj' },
  { id: 'fv', rotulo: 'FV', f: 'IRR', g: 'Nj' },
  { id: 'chs', rotulo: 'CHS' },
  { id: '7', rotulo: '7', g: 'BEG' },
  { id: '8', rotulo: '8', g: 'END' },
  { id: '9', rotulo: '9' },
  { id: '/', rotulo: '÷' },

  { id: 'pow', rotulo: 'yˣ', g: '√x' },
  { id: 'inv', rotulo: '1/x', g: 'eˣ' },
  { id: 'pctt', rotulo: '%T', g: 'LN' },
  { id: 'dpct', rotulo: 'Δ%', g: 'FRAC' },
  { id: 'pct', rotulo: '%', g: 'INTG' },
  { rotulo: 'EEX' },
  { id: '4', rotulo: '4' },
  { id: '5', rotulo: '5' },
  { id: '6', rotulo: '6' },
  { id: '*', rotulo: '×', g: 'x²' },

  { rotulo: 'R/S' },
  { rotulo: 'SST' },
  { id: 'rdown', rotulo: 'R↓' },
  { id: 'xy', rotulo: 'x≷y', f: 'FIN' },
  { id: 'clx', rotulo: 'CLX', f: 'REG' },
  { id: 'enter', rotulo: 'ENTER', larga: true },
  { id: '1', rotulo: '1' },
  { id: '2', rotulo: '2' },
  { id: '3', rotulo: '3', g: 'n!' },
  { id: '-', rotulo: '−' },

  { rotulo: 'ON' },
  { id: 'f', rotulo: 'f', cor: 'f' },
  { id: 'g', rotulo: 'g', cor: 'g' },
  { id: 'sto', rotulo: 'STO' },
  { id: 'rcl', rotulo: 'RCL' },
  { id: '0', rotulo: '0' },
  { id: '.', rotulo: '.' },
  { rotulo: 'Σ+' },
  { id: '+', rotulo: '+', g: 'LST x' },
]

const TECLADO_FISICO: Record<string, string> = { Enter: 'enter', '+': '+', '-': '-', '*': '*', '/': '/', ',': '.', '.': '.' }

/**
 * Teclado da HP-12C (réplica do comportamento, não o emulador da HP). A conta toda mora em `domain/hp12cEmulador`; aqui
 * ficam só o visor, o desenho das teclas e o teclado do computador (dígitos, + − * /, Enter, vírgula e Backspace).
 */
export function Hp12cEmulador() {
  const [estado, setEstado] = useState(estadoInicial)
  const [mostrarPilha, setMostrarPilha] = useState(false)

  const apertar = (id: string) => setEstado((e) => pressionar(e, id))

  function aoDigitar(ev: React.KeyboardEvent<HTMLDivElement>) {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return
    if ((ev.target as HTMLElement).tagName === 'BUTTON' && (ev.key === 'Enter' || ev.key === ' ')) return
    const tecla = /^\d$/.test(ev.key) ? ev.key : ev.key === 'Backspace' ? 'clx' : TECLADO_FISICO[ev.key]
    if (!tecla) return
    ev.preventDefault()
    apertar(tecla)
  }

  const [x, y, z, t] = estado.pilha
  const casas = estado.casas

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="hp12c-corpo" role="group" aria-label="Calculadora HP-12C" tabIndex={0} onKeyDown={aoDigitar}>
        <div className="hp12c-visor" aria-live="polite" aria-label="Visor">
          <div className="hp12c-anuncios" aria-hidden="true">
            <span className={estado.prefixo === 'f' ? 'on' : ''}>f</span>
            <span className={estado.prefixo === 'g' ? 'on' : ''}>g</span>
            <span className={estado.prefixo === 'sto' ? 'on' : ''}>STO</span>
            <span className={estado.prefixo === 'rcl' ? 'on' : ''}>RCL</span>
            <span className={estado.inicio ? 'on' : ''}>BEGIN</span>
          </div>
          <div className="hp12c-numero" data-testid="visor-hp">
            {visor(estado)}
          </div>
        </div>
        <div className="hp12c-teclas">
          {TECLAS.map((k, idx) => (
            <div key={idx} className={`hp12c-celula${k.larga ? ' larga' : ''}`}>
              <span className="hp12c-f">{k.f ?? ''}</span>
              <button
                type="button"
                className={`hp12c-tecla${k.cor ? ` ${k.cor}` : ''}`}
                disabled={!k.id}
                aria-label={k.rotulo}
                aria-pressed={k.id === 'f' || k.id === 'g' ? estado.prefixo === k.id : undefined}
                onClick={() => k.id && apertar(k.id)}
              >
                {k.rotulo}
              </button>
              <span className="hp12c-g">{k.g ?? ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline" onClick={() => setMostrarPilha((v) => !v)} aria-pressed={mostrarPilha}>
          {mostrarPilha ? 'Esconder pilha e registradores' : 'Ver pilha e registradores'}
        </button>
        <button type="button" className="btn btn-outline" onClick={() => setEstado(estadoInicial())}>
          Zerar calculadora
        </button>
      </div>

      {mostrarPilha ? (
        <div className="card-outline col small hp12c-estado" style={{ gap: 4 }}>
          <div className="hp-linha row-between"><span className="muted">T</span><span>{formatarVisor(t, casas)}</span></div>
          <div className="hp-linha row-between"><span className="muted">Z</span><span>{formatarVisor(z, casas)}</span></div>
          <div className="hp-linha row-between"><span className="muted">Y</span><span>{formatarVisor(y, casas)}</span></div>
          <div className="hp-linha row-between"><span className="muted">X</span><span>{formatarVisor(x, casas)}</span></div>
          <div className="hp-linha row-between"><span className="muted">LAST X</span><span>{formatarVisor(estado.ultimoX, casas)}</span></div>
          <hr style={{ border: 0, borderTop: '1px solid var(--stroke)', width: '100%' }} />
          {(['n', 'i', 'pv', 'pmt', 'fv'] as const).map((k) => (
            <div key={k} className="hp-linha row-between">
              <span className="muted">{k === 'n' || k === 'i' ? k : k.toUpperCase()}</span>
              <span>{formatarVisor(estado.fin[k], k === 'n' ? 0 : 4)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="tiny muted justify">
        Funciona em RPN: digite o primeiro número, ENTER, o segundo número e a operação (2 ENTER 3 + dá 5). Para financiar, digite n, i e PV (cada um
        seguido da própria tecla) e aperte PMT sem digitar nada para calcular. O que entra no caixa é positivo e o que sai é negativo (use CHS).
        Teclas f e g ativam as funções douradas e azuis; f e um dígito escolhem as casas decimais; f FIN zera os registradores financeiros e f REG zera tudo. Não há programação (R/S, SST), estatística, datas
        nem AMORT.
      </div>
    </div>
  )
}
