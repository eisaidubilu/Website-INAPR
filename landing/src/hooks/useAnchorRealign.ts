import { useEffect } from 'react'

/** Lama maksimum menjaga satu navigasi anchor (scroll halus ±1 dtk), lalu dilepas. */
const WATCH_MS = 3000
/** Selisih posisi tujuan (px) yang dianggap bergeser. */
const MOVED_PX = 2

const documentTop = (el: Element) => el.getBoundingClientRect().top + window.scrollY

/**
 * Menjaga navigasi anchor (klik menu → scroll halus) tetap mendarat di tujuannya walau tata letak
 * bergeser di tengah jalan. Penyebab utama: daftar anggota/webinar dimuat malas saat mendekati layar
 * (useLazyData), jadi tingginya baru bertambah ketika scroll halus yang sudah dihitung melintasinya.
 * Bila tinggi <body> berubah dan tujuan bergeser, scroll diarahkan ulang ke tujuan yang sama
 * (scrollIntoView memakai scroll-padding/margin dan scroll-behavior yang sama dengan navigasi anchor).
 *
 * Hanya aktif sejak klik tautan #id sampai scrollend / WATCH_MS / input pengguna (roda, sentuh,
 * tombol): tidak pernah melawan pengguna. Tanpa pergeseran tata letak tidak melakukan apa-apa.
 */
export function useAnchorRealign(): void {
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    let target: HTMLElement | null = null
    let top = 0
    let timer = 0

    const stop = () => {
      target = null
      window.clearTimeout(timer)
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a[href^="#"]')
      const id = link?.getAttribute('href')?.slice(1)
      const dest = id ? document.getElementById(id) : null
      if (!dest) return stop()
      target = dest
      top = documentTop(dest)
      window.clearTimeout(timer)
      timer = window.setTimeout(stop, WATCH_MS)
    }

    const observer = new ResizeObserver(() => {
      if (!target) return
      const next = documentTop(target)
      if (Math.abs(next - top) < MOVED_PX) return
      top = next
      target.scrollIntoView({ block: 'start' })
    })
    observer.observe(document.body)

    const passive = { passive: true } as const
    document.addEventListener('click', onClick)
    window.addEventListener('scrollend', stop)
    window.addEventListener('wheel', stop, passive)
    window.addEventListener('touchstart', stop, passive)
    window.addEventListener('keydown', stop)
    return () => {
      stop()
      observer.disconnect()
      document.removeEventListener('click', onClick)
      window.removeEventListener('scrollend', stop)
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', stop)
    }
  }, [])
}
