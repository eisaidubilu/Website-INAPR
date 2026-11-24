import { StrictMode, startTransition } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RootFallback } from '@/components/RootFallback'

// Font self-hosted, subset latin, hanya bobot yang dipakai (font-display: swap dari @fontsource).
// Montserrat: judul, Lato: subjudul, Hind Siliguri: isi.
import '@fontsource/montserrat/latin-300.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-800.css'
import '@fontsource/lato/latin-400.css'
import '@fontsource/hind-siliguri/latin-400.css'
import '@fontsource/hind-siliguri/latin-500.css'
import '@fontsource/hind-siliguri/latin-600.css'
import '@/styles/global.css'

import App from './App'
import { initLang } from './i18n/useI18n'

const container = document.getElementById('root')
if (!container) throw new Error('Elemen #root tidak ditemukan di index.html')

// Hasil build berisi HTML prerender (Bahasa Indonesia) di #root.
//
// - Bahasa 'id' (atau belum ada pilihan) + ada HTML prerender: hydrateRoot. Render pertama React identik
//   dengan prerender (kamus id; tema, tahun footer, dan state klien lain lewat getServerSnapshot, lalu
//   disesuaikan SETELAH hidrasi), jadi DOM prerender dipakai ulang, bukan dibongkar dan dibangun ulang.
// - Selain itu (bahasa tersimpan en, dev server tanpa prerender): createRoot, yang mengganti isi #root dengan
//   render klien, supaya bahasa tersimpan langsung dipakai tanpa hydration mismatch. Render dibungkus
//   startTransition agar bisa dipecah (tidak satu tugas panjang).
//
// Ketahanan: HTML prerender disimpan dulu sebagai cadangan. Error render di mana pun tertangkap
// ErrorBoundary akar (menampilkan HTML itu lagi); error yang lolos dari semua boundary membuat
// React membongkar pohonnya, jadi di onUncaughtError cadangan dipulihkan langsung ke #root.
const staticHtml = container.innerHTML

/** Handler error React 19. Menggantikan log bawaan, jadi tetap dicetak ke console agar terbaca di DevTools. */
function report(kind: string, error: unknown, info: { componentStack?: string | null }): void {
  console.error(`[inapr] ${kind}`, error, info.componentStack ?? '')
}

let root: { unmount(): void } | undefined
const rootOptions = {
  onCaughtError: (error: unknown, info: { componentStack?: string | null }) => report('caught', error, info),
  onUncaughtError: (error: unknown, info: { componentStack?: string | null }) => {
    report('uncaught', error, info)
    // Tunda: pembongkaran pohon oleh React harus selesai dulu sebelum #root diisi ulang.
    window.setTimeout(() => {
      try {
        root?.unmount()
      } catch {
        // pohon sudah terbongkar
      }
      container.innerHTML = staticHtml
    }, 0)
  },
  // Termasuk hydration mismatch yang dipulihkan React (render ulang di klien): dicetak, bukan ditelan.
  onRecoverableError: (error: unknown, info: { componentStack?: string | null }) => report('recoverable', error, info),
}

const app = (
  <StrictMode>
    <ErrorBoundary fallback={<RootFallback html={staticHtml} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>
)

// Bahasa tersimpan (mis. EN, kamus dimuat malas) diterapkan dulu supaya render pertama sudah benar.
// initLang tidak melempar: gagal muat = tetap Indonesia.
void initLang().then((lang) => {
  if (lang === 'id' && staticHtml.trim() !== '') {
    // startTransition: hidrasi berjalan di lane transisi, jadi dipecah per ±5 ms (bisa diinterupsi) alih-alih
    // satu tugas panjang (lane hidrasi bawaan tidak diiris).
    startTransition(() => {
      root = hydrateRoot(container, app, rootOptions)
    })
  } else {
    const created = createRoot(container, rootOptions)
    root = created
    startTransition(() => created.render(app))
  }
})
