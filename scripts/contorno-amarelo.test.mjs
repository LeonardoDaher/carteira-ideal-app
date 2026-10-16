// Contorno preto fino em texto amarelo no tema claro (D90): todo texto que usa --accent ou --warning como
// cor precisa estar na lista do contorno, senão volta a sumir sobre o fundo claro.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const css = fs.readFileSync(path.join(RAIZ, 'webapp-src/src/index.css'), 'utf8').replace(/\r\n/g, '\n')

const MARCA = '/* Tema claro: contorno preto fino em todo texto amarelo'
const inicio = css.indexOf('Tema claro: contorno preto fino')
const antes = css.slice(0, inicio)
const bloco = css.slice(inicio)

/** Letra amarela dentro de um selo escuro (--accent-text): o contraste já vem do fundo, sem contorno. */
const SOBRE_FUNDO_ESCURO = ['.quiz-option.selected .quiz-option-letter', '.quiz-option.selected .quiz-option-tag']

/** Regras (seletor + corpo) de uma folha, sem aninhamento de @media. */
function regras(texto) {
  const sem = texto.replace(/\/\*[\s\S]*?\*\//g, '')
  return [...sem.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ seletor: m[1].trim(), corpo: m[2] }))
}

test('o bloco do contorno existe e vem depois de todas as regras de cor', () => {
  assert.ok(inicio > 0, MARCA)
})

test('toda classe com texto amarelo está na lista do contorno', () => {
  const listadas = bloco.slice(bloco.indexOf(':is(') + 4, bloco.indexOf(') {')).split(',').map((s) => s.trim())
  const texto = regras(antes).filter((r) => /(^|[;\s])color:\s*var\(--(accent|warning)\)/.test(r.corpo))
  const faltando = []
  for (const r of texto) {
    for (const sel of r.seletor.split(',').map((s) => s.trim())) {
      // só o último componente do seletor importa (ex.: ".tab.active"); estados como :hover seguem o mesmo elemento
      const classes = sel.match(/(\.[A-Za-z0-9_-]+)+/g)
      const alvo = classes ? classes[classes.length - 1] : sel
      if (SOBRE_FUNDO_ESCURO.includes(sel)) continue
      if (!listadas.includes(alvo)) faltando.push(sel)
    }
  }
  assert.deepEqual(faltando, [], 'classes com texto amarelo sem contorno no tema claro')
})

test('estilos inline com --accent e --warning (nas duas posições) ganham o contorno', () => {
  for (const v of ['--accent', '--warning']) {
    assert.ok(bloco.includes(`[style^="color: var(${v})"]`), `${v} no início do style`)
    assert.ok(bloco.includes(`[style*="; color: var(${v})"]`), `${v} depois de outra propriedade`)
  }
})

test('o contorno é preto, fino e só vale no tema claro', () => {
  assert.match(bloco, /--contorno-amarelo:\s*#111/)
  assert.match(bloco, /-webkit-text-stroke:\s*1\.1px/)
  assert.match(bloco, /paint-order:\s*stroke fill/)
  for (const r of regras(bloco)) {
    if (/text-stroke|text-shadow|drop-shadow/.test(r.corpo)) {
      assert.match(r.seletor, /^:root\[data-theme='light'\]/, 'só no tema claro')
    }
  }
})
