import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// Manifest colors follow the light theme's single source of truth.
const themeCss = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8')
const lightTokens = themeCss.match(/:root\s*\{([^}]+)\}/)?.[1] ?? ''
function themeToken(name: string) {
  const value = lightTokens.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim()
  if (!value) throw new Error(`Missing theme token: ${name}`)
  return value
}

export default defineConfig({
  server: {
    // Bind IPv4 loopback so http://127.0.0.1:5173 works on Windows.
    // localhost and 127.0.0.1 are different origins (separate IndexedDB).
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: { ignored: ['**/.repo-tools/**', '**/artifacts/**'] },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '个人工作台',
        short_name: '工作台',
        description: 'Local-first workspace for plans, notes, ideas and files',
        theme_color: themeToken('accent'),
        background_color: themeToken('bg'),
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2,png,gif,mp3}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
