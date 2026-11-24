import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { seo } from './config/seo-plugin.ts'

/**
 * Base path situs dari VITE_BASE, dinormalisasi ke "/…/". Kosong = "/" (root domain).
 * Hanya untuk hosting di subfolder; di Vercel biarkan kosong.
 */
function parseBase(raw: string | undefined): string {
  const value = raw?.trim().replace(/^\/+|\/+$/g, '')
  return value ? `/${value}/` : '/'
}

// https://vite.dev/config/
export default defineConfig(({ mode, isSsrBuild }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    base: parseBase(env.VITE_BASE),
    // Sama untuk build klien dan SSR (prerender) dalam satu `npm run build`; dipakai Footer supaya hidrasi cocok.
    define: { __BUILD_YEAR__: JSON.stringify(new Date().getFullYear()) },
    plugins: [react(), tailwindcss(), seo(env.VITE_SITE_URL)],
    // Proxy dev HANYA untuk mode (a) (VITE_API_BASE terisi): /api → backend lokal. Tidak mempengaruhi build.
    server: env.VITE_API_BASE?.trim()
      ? {
          proxy: {
            '/api': { target: env.VITE_API_PROXY?.trim() || 'http://localhost:3000', changeOrigin: true },
          },
        }
      : undefined,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      // Build SSR hanya untuk prerender (scripts/prerender.mjs); public/ tidak perlu disalin.
      copyPublicDir: !isSsrBuild,
      // Chunk terbesar adalah three.js (±535 kB, ±134 kB gzip) untuk latar titik.
      // Chunk itu dimuat dinamis setelah halaman selesai dimuat, bukan bagian bundle awal.
      chunkSizeWarningLimit: 600,
    },
  }
})
