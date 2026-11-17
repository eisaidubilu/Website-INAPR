import { useEffect } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/** Efek hover hanya untuk perangkat dengan hover dan pointer halus (mouse/trackpad). */
const FINE_POINTER = '(hover: hover) and (pointer: fine)'
/** Pergeseran maks. tombol magnetik (px). */
const MAGNET_MAX = 6
/** Durasi riak klik (ms), sama dengan animasi fx-ripple di global.css. */
const RIPPLE_MS = 600

function matches(query: string): boolean {
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

/**
 * Micro interaction berbasis pointer untuk seluruh halaman (dipasang sekali di <App />).
 * Kelas penanda ada di src/lib/ui.ts; tampilannya di src/styles/global.css.
 *
 * - .fx-spotlight (kartu interaktif): --mx/--my = posisi kursor di dalam kartu.
 * - .fx-magnetic (tombol utama/CTA): --mag-x/--mag-y = geser maks. 6px ke arah kursor.
 * - .fx-ripple (tombol utama): lingkaran memudar dari titik klik (keyboard: dari tengah).
 *
 * Listener pasif di document; posisi diterapkan sekali per requestAnimationFrame.
 * Hover (spotlight/magnet) hanya bila (hover: hover) and (pointer: fine); semua efek mati
 * saat prefers-reduced-motion. Hanya transform/opacity/variabel CSS, tanpa layout shift.
 */
export function usePointerFx(): void {
  useEffect(() => {
    let frame = 0
    let x = 0
    let y = 0
    let target: Element | null = null
    let magnet: HTMLElement | null = null

    const resetMagnet = () => {
      if (!magnet) return
      magnet.style.removeProperty('--mag-x')
      magnet.style.removeProperty('--mag-y')
      magnet = null
    }

    const apply = () => {
      frame = 0
      const spot = target?.closest<HTMLElement>('.fx-spotlight')
      if (spot) {
        const rect = spot.getBoundingClientRect()
        spot.style.setProperty('--mx', `${Math.round(x - rect.left)}px`)
        spot.style.setProperty('--my', `${Math.round(y - rect.top)}px`)
      }
      const next = target?.closest<HTMLElement>('a.fx-magnetic, button.fx-magnetic') ?? null
      if (next !== magnet) resetMagnet()
      if (next) {
        const rect = next.getBoundingClientRect()
        const dx = (x - (rect.left + rect.width / 2)) / (rect.width / 2)
        const dy = (y - (rect.top + rect.height / 2)) / (rect.height / 2)
        next.style.setProperty('--mag-x', `${(Math.max(-1, Math.min(1, dx)) * MAGNET_MAX).toFixed(1)}px`)
        next.style.setProperty('--mag-y', `${(Math.max(-1, Math.min(1, dy)) * MAGNET_MAX).toFixed(1)}px`)
        magnet = next
      }
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      if (!matches(FINE_POINTER) || prefersReducedMotion()) return
      x = event.clientX
      y = event.clientY
      target = event.target instanceof Element ? event.target : null
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    const onLeave = () => {
      target = null
      resetMagnet()
    }

    const onClick = (event: MouseEvent) => {
      if (prefersReducedMotion()) return
      const button = event.target instanceof Element ? event.target.closest<HTMLElement>('a.fx-ripple, button.fx-ripple') : null
      if (!button) return
      const rect = button.getBoundingClientRect()
      // detail 0 = diaktifkan dari keyboard (Enter/Spasi): riak dari tengah.
      const keyboard = event.detail === 0
      const px = keyboard ? rect.width / 2 : event.clientX - rect.left
      const py = keyboard ? rect.height / 2 : event.clientY - rect.top
      const wave = document.createElement('span')
      wave.className = 'fx-ripple-wave'
      wave.setAttribute('aria-hidden', 'true')
      wave.style.setProperty('--rx', `${px}px`)
      wave.style.setProperty('--ry', `${py}px`)
      wave.style.setProperty('--rs', String(Math.ceil((Math.hypot(rect.width, rect.height) * 2) / 8)))
      button.appendChild(wave)
      window.setTimeout(() => wave.remove(), RIPPLE_MS + 100)
    }

    document.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave, { passive: true })
    document.addEventListener('click', onClick, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      resetMagnet()
      document.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('click', onClick)
    }
  }, [])
}
