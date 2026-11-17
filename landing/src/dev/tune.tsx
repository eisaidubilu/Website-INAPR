/**
 * Titik masuk panel tuning (dev-only). Dimuat dinamis oleh <PointField /> hanya bila
 * `import.meta.env.DEV` dan URL berisi `?tune`; tidak ikut bundel produksi.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { PointFieldEngine } from '@/pointfield/engine'
import { TunePanel } from './TunePanel'
// Gaya panel sendiri (bukan Tailwind): ikut dimuat dinamis bersama modul ini saja.
import './tune.css'

/** Pasang panel di root React terpisah. Mengembalikan fungsi pembongkar. */
export function mountTunePanel(engine: PointFieldEngine): () => void {
  const host = document.createElement('div')
  host.id = 'inapr-tune'
  document.body.appendChild(host)
  const root = createRoot(host)
  root.render(
    <StrictMode>
      <TunePanel engine={engine} />
    </StrictMode>,
  )
  return () => {
    // Ditunda: pembongkaran dipanggil dari cleanup effect root utama.
    queueMicrotask(() => {
      root.unmount()
      host.remove()
    })
  }
}
