/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * Publica os JSON de mercado de src/data/ como arquivos próprios em dados/<chave>.json (D137), em vez de embuti-los no index.html.
 * Os jobs diários continuam gravando em src/data/; o app baixa cada arquivo só quando a tela precisa (data/arquivosMercado.ts).
 * A lista de chaves vem do próprio código do app, e o build falha se um arquivo faltar. O JSON sai compactado (sem espaços).
 */
function dadosDeMercado(): Plugin {
  return {
    name: 'dados-de-mercado',
    generateBundle() {
      const fonte = readFileSync(fileURLToPath(new URL('./src/data/arquivosMercado.ts', import.meta.url)), 'utf8')
      const bloco = fonte.match(/CHAVES_DE_DADOS = \[([\s\S]*?)\] as const/)
      const chaves = bloco ? [...bloco[1].matchAll(/'([A-Za-z0-9]+)'/g)].map((m) => m[1]) : []
      if (!chaves.length) throw new Error('dados-de-mercado: não achei CHAVES_DE_DADOS em src/data/arquivosMercado.ts')
      for (const chave of chaves) {
        const origem = fileURLToPath(new URL(`./src/data/${chave}.json`, import.meta.url))
        this.emitFile({ type: 'asset', fileName: `dados/${chave}.json`, source: JSON.stringify(JSON.parse(readFileSync(origem, 'utf8'))) })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dadosDeMercado(), viteSingleFile()],
  // Logos ficam em public/logos (arquivos separados, baixados só quando a linha aparece). Só a lista de nomes entra no app: com
  // o app em um arquivo único, importar as imagens as embutiria em base64 e dobraria o tamanho da página (D133).
  define: { __LOGOS__: JSON.stringify(readdirSync(fileURLToPath(new URL('./public/logos', import.meta.url)))) },
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Os testes recebem os JSON de mercado do disco, como se já tivessem sido baixados (data/arquivosMercado.ts).
    setupFiles: ['./src/testes/prepararDados.ts'],
  },
})
