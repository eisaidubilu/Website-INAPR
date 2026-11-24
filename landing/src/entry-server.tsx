import { renderToString } from 'react-dom/server'
import App from './App'

/**
 * Prerender saat build (lihat scripts/prerender.mjs): HTML statis Bahasa Indonesia
 * dimasukkan ke #root supaya halaman langsung terbaca sebelum JS jalan (dan tanpa JS).
 * Di browser, src/main.tsx menghidrasi HTML ini (bahasa tersimpan id) atau, bila bahasa tersimpan en,
 * merender ulang dengan createRoot. Isi harus tetap sama dengan render pertama klien (lihat getServerSnapshot
 * di useI18n/useTheme dan tahun footer: __BUILD_YEAR__), kalau tidak React melaporkan hydration mismatch.
 */
export function render(): string {
  return renderToString(<App />)
}
