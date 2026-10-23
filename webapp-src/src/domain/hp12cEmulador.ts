/**
 * Emulador da HP-12C: motor puro (sem React) com a pilha RPN de quatro registradores (X, Y, Z, T), LAST X, memórias 0–9,
 * teclas de função f e g, os cinco registradores financeiros (n, i, PV, PMT, FV) e fluxo de caixa (CFo, CFj, Nj, NPV, IRR).
 * É uma réplica do comportamento da calculadora, não o emulador da HP: não há programação (R/S, SST, PRGM), estatística,
 * datas nem AMORT. As contas financeiras usam as mesmas fórmulas do resolvedor do app.
 */
import { fvZero, resolverPrazo, resolverTaxa, tir, vpl } from './matematicaFinanceira'

export type Fin = 'n' | 'i' | 'pv' | 'pmt' | 'fv'
export type Prefixo = 'f' | 'g' | 'sto' | 'rcl' | null

export type Estado = {
  /** [X, Y, Z, T] */
  pilha: [number, number, number, number]
  ultimoX: number
  /** Dígitos que a pessoa está digitando (com "." decimal); null quando o visor mostra o X calculado. */
  entrada: string | null
  /** Se o próximo número digitado empurra a pilha para cima (desligado depois de ENTER e CLX). */
  elevar: boolean
  fin: Record<Fin, number>
  inicio: boolean
  casas: number
  prefixo: Prefixo
  reg: number[]
  cf0: number
  cfs: { valor: number; qtd: number }[]
  erro: string | null
}

export function estadoInicial(): Estado {
  return {
    pilha: [0, 0, 0, 0],
    ultimoX: 0,
    entrada: null,
    elevar: true,
    fin: { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 },
    inicio: false,
    casas: 2,
    prefixo: null,
    reg: Array.from({ length: 10 }, () => 0),
    cf0: 0,
    cfs: [],
    erro: null,
  }
}

const FINANCEIRAS: Fin[] = ['n', 'i', 'pv', 'pmt', 'fv']
const ehFin = (t: string): t is Fin => (FINANCEIRAS as string[]).includes(t)
const ehDigito = (t: string) => t.length === 1 && t >= '0' && t <= '9'

function copiar(e: Estado): Estado {
  return { ...e, pilha: [...e.pilha], fin: { ...e.fin }, reg: [...e.reg], cfs: e.cfs.map((c) => ({ ...c })) }
}

function falhar(e: Estado, codigo: number): Estado {
  e.erro = `Error ${codigo}`
  e.entrada = null
  return e
}

/** Passa o número em digitação para X. */
function fechar(e: Estado) {
  if (e.entrada !== null) {
    const n = Number(e.entrada === '' || e.entrada === '-' || e.entrada === '.' ? '0' : e.entrada)
    e.pilha[0] = Number.isFinite(n) ? n : 0
    e.entrada = null
  }
}

/** Mantém X igual ao número em digitação, para a pilha mostrada refletir o que está no visor. */
function sincronizar(e: Estado) {
  if (e.entrada === null) return
  const n = Number(e.entrada === '' || e.entrada === '-' || e.entrada === '.' ? '0' : e.entrada)
  e.pilha[0] = Number.isFinite(n) ? n : 0
}

/** Empurra um valor novo para X, subindo a pilha (o T se perde). */
function empurrar(e: Estado, v: number) {
  e.pilha = [v, e.pilha[0], e.pilha[1], e.pilha[2]]
  e.elevar = true
}

/** Troca X por um resultado de operação com um operando. */
function unario(e: Estado, f: (x: number) => number, codigoErro = 0): Estado {
  fechar(e)
  const x = e.pilha[0]
  const r = f(x)
  if (!Number.isFinite(r)) return falhar(e, codigoErro)
  e.ultimoX = x
  e.pilha[0] = r
  e.elevar = true
  return e
}

/** Y op X: o resultado vai para X e a pilha desce (T se repete). */
function binario(e: Estado, f: (y: number, x: number) => number): Estado {
  fechar(e)
  const [x, y, z, t] = e.pilha
  const r = f(y, x)
  if (!Number.isFinite(r)) return falhar(e, 0)
  e.ultimoX = x
  e.pilha = [r, z, t, t]
  e.elevar = true
  return e
}

/** Percentuais deixam o Y como está e trocam só o X. */
function percentual(e: Estado, f: (y: number, x: number) => number): Estado {
  fechar(e)
  const [x, y] = e.pilha
  const r = f(y, x)
  if (!Number.isFinite(r)) return falhar(e, 0)
  e.ultimoX = x
  e.pilha[0] = r
  e.elevar = true
  return e
}

function fluxoExpandido(e: Estado): number[] {
  const fluxo = [e.cf0]
  for (const c of e.cfs) for (let k = 0; k < Math.max(1, Math.round(c.qtd)); k++) fluxo.push(c.valor)
  return fluxo
}

function calcularFinanceira(e: Estado, k: Fin): Estado {
  const { n, pv, pmt, fv } = e.fin
  const i = e.fin.i / 100
  let r: number | null
  if (k === 'n') {
    r = resolverPrazo(i, pv, pmt, fv, e.inicio)
    if (r !== null) r = Math.ceil(r - 1e-9)
  } else if (k === 'i') {
    const t = pv === 0 && pmt === 0 && fv === 0 ? null : resolverTaxa(n, pv, pmt, fv, e.inicio)
    r = t === null ? null : t * 100
  } else if (k === 'fv') {
    r = -fvZero(n, i, pv, pmt, 0, e.inicio) / Math.pow(1 + i, -n)
  } else if (k === 'pv') {
    r = -fvZero(n, i, 0, pmt, fv, e.inicio)
  } else {
    const unidade = fvZero(n, i, 0, 1, 0, e.inicio)
    r = unidade === 0 ? null : -fvZero(n, i, pv, 0, fv, e.inicio) / unidade
  }
  if (r === null || !Number.isFinite(r)) return falhar(e, 5)
  e.fin[k] = r
  empurrar(e, r)
  return e
}

function teclaFinanceira(e: Estado, k: Fin): Estado {
  if (e.entrada !== null) {
    fechar(e)
    e.fin[k] = e.pilha[0]
    e.elevar = true
    return e
  }
  return calcularFinanceira(e, k)
}

function digitar(e: Estado, t: string): Estado {
  if (e.entrada === null) {
    if (e.elevar) e.pilha = [0, e.pilha[0], e.pilha[1], e.pilha[2]]
    e.elevar = true
    e.entrada = t === '.' ? '0.' : t
    sincronizar(e)
    return e
  }
  const digitos = e.entrada.replace(/[-.]/g, '').length
  if (t === '.') {
    if (!e.entrada.includes('.')) e.entrada += '.'
    sincronizar(e)
    return e
  }
  if (digitos >= 10) return e
  e.entrada = e.entrada === '0' ? t : e.entrada === '-0' ? `-${t}` : e.entrada + t
  sincronizar(e)
  return e
}

function memoria(e: Estado, p: 'sto' | 'rcl', t: string): Estado {
  fechar(e)
  if (ehDigito(t)) {
    const d = Number(t)
    if (p === 'sto') e.reg[d] = e.pilha[0]
    else empurrar(e, e.reg[d])
  } else if (ehFin(t)) {
    if (p === 'sto') e.fin[t] = e.pilha[0]
    else empurrar(e, e.fin[t])
  }
  return e
}

function fatorial(x: number) {
  if (x < 0 || !Number.isInteger(x) || x > 69) return NaN
  let r = 1
  for (let k = 2; k <= x; k++) r *= k
  return r
}

function funcaoG(e: Estado, t: string): Estado {
  switch (t) {
    case 'pv':
      fechar(e)
      e.cf0 = e.pilha[0]
      e.cfs = []
      e.elevar = true
      return e
    case 'pmt':
      fechar(e)
      e.cfs.push({ valor: e.pilha[0], qtd: 1 })
      e.elevar = true
      return e
    case 'fv':
      fechar(e)
      if (e.cfs.length > 0) e.cfs[e.cfs.length - 1].qtd = e.pilha[0]
      e.elevar = true
      return e
    case 'n':
      fechar(e)
      e.fin.n = e.pilha[0] * 12
      e.pilha[0] = e.fin.n
      e.elevar = true
      return e
    case 'i':
      fechar(e)
      e.fin.i = e.pilha[0] / 12
      e.pilha[0] = e.fin.i
      e.elevar = true
      return e
    case '7':
      fechar(e)
      e.inicio = true
      return e
    case '8':
      fechar(e)
      e.inicio = false
      return e
    case 'pow':
      return unario(e, (x) => (x < 0 ? NaN : Math.sqrt(x)))
    case 'inv':
      return unario(e, (x) => Math.exp(x))
    case 'pctt':
      return unario(e, (x) => (x <= 0 ? NaN : Math.log(x)))
    case 'dpct':
      return unario(e, (x) => x - Math.trunc(x))
    case 'pct':
      return unario(e, (x) => Math.trunc(x))
    case '*':
      return unario(e, (x) => x * x)
    case '3':
      return unario(e, fatorial)
    case '+':
      fechar(e)
      empurrar(e, e.ultimoX)
      return e
    default:
      return e
  }
}

function funcaoF(e: Estado, t: string): Estado {
  if (ehDigito(t)) {
    fechar(e)
    e.casas = Number(t)
    return e
  }
  switch (t) {
    case 'i': {
      fechar(e)
      const v = (-e.fin.pv * e.fin.n * e.fin.i) / 36000
      empurrar(e, v)
      return e
    }
    case 'pv': {
      fechar(e)
      empurrar(e, vpl(e.fin.i / 100, fluxoExpandido(e)))
      return e
    }
    case 'pmt':
      return unario(e, (x) => Number(x.toFixed(e.casas)))
    case 'fv': {
      fechar(e)
      const r = tir(fluxoExpandido(e))
      if (r === null) return falhar(e, 3)
      empurrar(e, r * 100)
      return e
    }
    case 'xy':
      e.fin = { n: 0, i: 0, pv: 0, pmt: 0, fv: 0 }
      return e
    case 'clx': {
      const limpo = estadoInicial()
      limpo.casas = e.casas
      limpo.inicio = e.inicio
      return limpo
    }
    default:
      return e
  }
}

function teclaNormal(e: Estado, t: string): Estado {
  if (ehDigito(t) || t === '.') return digitar(e, t)
  if (ehFin(t)) return teclaFinanceira(e, t)
  switch (t) {
    case 'chs':
      if (e.entrada !== null) {
        e.entrada = e.entrada.startsWith('-') ? e.entrada.slice(1) : `-${e.entrada}`
        sincronizar(e)
        return e
      }
      e.pilha[0] = -e.pilha[0]
      return e
    case 'enter':
      fechar(e)
      e.pilha = [e.pilha[0], e.pilha[0], e.pilha[1], e.pilha[2]]
      e.elevar = false
      return e
    case '+':
      return binario(e, (y, x) => y + x)
    case '-':
      return binario(e, (y, x) => y - x)
    case '*':
      return binario(e, (y, x) => y * x)
    case '/':
      return binario(e, (y, x) => (x === 0 ? NaN : y / x))
    case 'pow':
      return binario(e, (y, x) => Math.pow(y, x))
    case 'inv':
      return unario(e, (x) => (x === 0 ? NaN : 1 / x))
    case 'pct':
      return percentual(e, (y, x) => (y * x) / 100)
    case 'dpct':
      return percentual(e, (y, x) => (y === 0 ? NaN : ((x - y) / y) * 100))
    case 'pctt':
      return percentual(e, (y, x) => (y === 0 ? NaN : (x / y) * 100))
    case 'xy': {
      fechar(e)
      const [x, y, z, w] = e.pilha
      e.pilha = [y, x, z, w]
      e.elevar = true
      return e
    }
    case 'rdown': {
      fechar(e)
      const [x, y, z, w] = e.pilha
      e.pilha = [y, z, w, x]
      e.elevar = true
      return e
    }
    case 'clx':
      e.entrada = null
      e.pilha[0] = 0
      e.elevar = false
      return e
    default:
      return e
  }
}

/** Aperta uma tecla. Teclas: dígitos, ".", chs, enter, + - * /, n i pv pmt fv, pow, inv, pct, dpct, pctt, xy, rdown, clx, f, g, sto, rcl. */
export function pressionar(antes: Estado, tecla: string): Estado {
  const e = copiar(antes)
  if (e.erro) {
    e.erro = null
    e.prefixo = null
    return e
  }
  if (tecla === 'f' || tecla === 'g') {
    e.prefixo = e.prefixo === tecla ? null : tecla
    return e
  }
  if (tecla === 'sto' || tecla === 'rcl') {
    e.prefixo = tecla
    return e
  }
  const p = e.prefixo
  e.prefixo = null
  if (p === 'sto' || p === 'rcl') return memoria(e, p, tecla)
  if (p === 'f') return funcaoF(e, tecla)
  if (p === 'g') return funcaoG(e, tecla)
  return teclaNormal(e, tecla)
}

/** Número como o visor mostra: casas fixas, separadores pt-BR e notação científica para valores enormes. */
export function formatarVisor(v: number, casas: number) {
  if (v !== 0 && (Math.abs(v) >= 1e10 || Math.abs(v) < 1e-9)) return v.toExponential(Math.min(casas, 6)).replace('.', ',')
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export function visor(e: Estado) {
  if (e.erro) return e.erro
  if (e.entrada !== null) return e.entrada.replace('.', ',')
  return formatarVisor(e.pilha[0], e.casas)
}
