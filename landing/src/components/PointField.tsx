import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useI18n } from '@/i18n/useI18n'
import type { PointFieldEngine } from '@/pointfield/engine'

/**
 * Jalankan `callback` setelah halaman selesai dimuat (event load) dan browser
 * sedang senggang. Mengembalikan fungsi pembatal.
 */
function afterLoadAndIdle(callback: () => void): () => void {
  let idle = 0
  let timer = 0
  const run = () => {
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(callback, { timeout: 2000 })
    } else {
      timer = window.setTimeout(callback, 200)
    }
  }
  if (document.readyState === 'complete') run()
  else window.addEventListener('load', run, { once: true })
  return () => {
    window.removeEventListener('load', run)
    if (idle) window.cancelIdleCallback(idle)
    window.clearTimeout(timer)
  }
}

/**
 * Latar titik 3D (WebGL), fixed di belakang konten dan di atas latar cutting mat.
 * three.js (chunk terpisah) baru diunduh setelah event load + saat browser senggang,
 * jadi halaman sudah terbaca sebelum canvas siap.
 * Tanpa WebGL / bila gagal: wadah disembunyikan, cutting mat tetap tampil.
 * Aman untuk StrictMode: setiap mount membuat canvas + renderer sendiri dan
 * membersihkannya penuh saat unmount.
 */
export function PointField() {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<PointFieldEngine | null>(null)
  const [failed, setFailed] = useState(false)
  const { resolved } = useTheme()
  const { lang } = useI18n()

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let engine: PointFieldEngine | null = null
    let disposeTune: (() => void) | null = null

    const cancelWait = afterLoadAndIdle(() => {
      import('@/pointfield/engine')
        .then(async ({ createPointField }) => {
          if (cancelled) return
          // createPointField bisa melempar (mis. WebGLRenderer gagal) → ditangkap .catch. Async: data titik
          // dibangun bertahap; bila komponen dilepas di tengah jalan, shouldAbort membatalkan tanpa sisa.
          const created = await createPointField(host, { onFail: () => setFailed(true), shouldAbort: () => cancelled })
          if (cancelled) {
            created?.destroy()
            return
          }
          engine = created
          engineRef.current = engine
          if (!engine) {
            setFailed(true)
            return
          }
          // Handle dev untuk pengujian/skrip (window.__inaprPointField.debug()). Dibuang di produksi.
          if (import.meta.env.DEV) window.__inaprPointField = engine
          // Panel tuning: HANYA dev server + ?tune. import.meta.env.DEV bernilai false saat
          // build produksi, jadi cabang ini (dan chunk src/dev/tune) dibuang dari bundel.
          if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('tune')) {
            const tuned = engine
            import('@/dev/tune').then(({ mountTunePanel }) => {
              if (!cancelled) disposeTune = mountTunePanel(tuned)
            })
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true)
        })
    })

    return () => {
      cancelled = true
      cancelWait()
      disposeTune?.()
      engine?.destroy()
      if (import.meta.env.DEV && window.__inaprPointField === engine) window.__inaprPointField = undefined
      engineRef.current = null
    }
  }, [])

  // Warna titik mengikuti token tema; geometri tidak dibangun ulang.
  useEffect(() => {
    engineRef.current?.refreshColors()
  }, [resolved])

  // Teks berganti bahasa → tinggi section berubah → ukur ulang.
  useEffect(() => {
    engineRef.current?.measure()
  }, [lang])

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      hidden={failed}
      className="pointer-events-none fixed inset-x-0 top-0 z-0 h-lvh"
    />
  )
}
