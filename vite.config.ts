import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envBase = process.env.VITE_BASE_PATH?.trim()
const normalizedBase = envBase
  ? envBase.endsWith('/')
    ? envBase
    : `${envBase}/`
  : '/'

export default defineConfig({
  base: normalizedBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['.nojekyll'],
      manifest: {
        name: 'Mobile SVG Editor',
        short_name: 'SVG Editor',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: normalizedBase,
        icons: []
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
