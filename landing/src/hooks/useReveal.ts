import { useEffect } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

const STAGGER_MS = 45
const STAGGER_MAX = 6
/** Sedikit lebih lama dari durasi transisi di global.css (560ms + stagger). */
const SETTLE_MS = 900

/**
 * Reveal saat scroll: elemen ber-atribut `data-reveal` di bawah lipatan memudar dan naik
 * ±16px sekali saat masuk viewport. Elemen yang masuk bersamaan (mis. satu baris kartu)
 * diberi stagger 45ms.
 *
 * Aman tanpa JS: CSS hanya menyembunyikan elemen yang diberi `data-reveal-pending` oleh
 * hook ini. Elemen yang sudah terlihat saat halaman dibuka tidak dianimasikan (tidak ada
 * kedip dari HTML prerender), dan elemen yang dibuat ulang React tetap terlihat.
 * Dipanggil sekali di <App />.
 */
export function useReveal(): void {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    const root = document.documentElement
    const timers: number[] = []
    const pending = new Set<HTMLElement>()

    const observer = new IntersectionObserver(
      (entries) => {
        let batch = 0
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          observer.unobserve(el)
          pending.delete(el)
          el.style.setProperty('--reveal-delay', `${Math.min(batch, STAGGER_MAX) * STAGGER_MS}ms`)
          batch++
          el.setAttribute('data-reveal-active', '')
          el.removeAttribute('data-reveal-pending')
          timers.push(
            window.setTimeout(() => {
              el.removeAttribute('data-reveal-active')
              el.style.removeProperty('--reveal-delay')
            }, SETTLE_MS),
          )
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )

    const fold = window.innerHeight
    for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
      if (el.getBoundingClientRect().top < fold) continue
      el.setAttribute('data-reveal-pending', '')
      pending.add(el)
      observer.observe(el)
    }
    root.classList.add('reveal-armed')

    return () => {
      observer.disconnect()
      timers.forEach((timer) => window.clearTimeout(timer))
      for (const el of pending) el.removeAttribute('data-reveal-pending')
      root.classList.remove('reveal-armed')
    }
  }, [])
}
