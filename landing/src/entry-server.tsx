import { renderToString } from 'react-dom/server'
import App from './App'

/**
 * Prerender saat build (lihat scripts/prerender.mjs): HTML statis Bahasa Indonesia
 * dimasukkan ke #root supaya halaman langsung terbaca sebelum JS jalan (dan tanpa JS).
 * Di browser, src/main.tsx merender ulang dengan bahasa/tema pilihan pengguna.
 */
export function render(): string {
  return renderToString(<App />)
}
