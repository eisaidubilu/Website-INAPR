import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

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

const container = document.getElementById('root')
if (!container) throw new Error('Elemen #root tidak ditemukan di index.html')

// Hasil build berisi HTML prerender (Bahasa Indonesia) di #root. createRoot (bukan hydrate)
// menggantinya dengan render klien, supaya bahasa/tema tersimpan langsung dipakai tanpa
// peringatan hydration mismatch.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
