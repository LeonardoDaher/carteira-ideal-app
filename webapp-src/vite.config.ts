/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
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
  },
})
