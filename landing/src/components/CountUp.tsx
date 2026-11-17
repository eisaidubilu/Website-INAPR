import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

interface CountUpProps {
  /** Nilai akhir, mis. "348" atau "2017". Selain bilangan bulat ditampilkan apa adanya. */
  value: string
  durationMs?: number
}

/**
 * Angka statistik yang menghitung naik sekali saat terlihat (±1,2 detik, ease-out).
 * Pembaca layar hanya membaca nilai akhir (teks sr-only); angka yang berjalan aria-hidden.
 * Tanpa JS / reduced motion / tanpa IntersectionObserver: langsung nilai akhir.
 */
export function CountUp({ value, durationMs = 1200 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)
  const target = /^\d+$/.test(value) ? Number(value) : null

  useEffect(() => {
    const el = ref.current
    if (target === null || !el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    let frame = 0
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / durationMs)
          const eased = 1 - (1 - progress) ** 3
          // Nilai akhir selalu persis string aslinya.
          setDisplay(progress < 1 ? String(Math.round(target * eased)) : value)
          if (progress < 1) frame = window.requestAnimationFrame(tick)
        }
        frame = window.requestAnimationFrame(tick)
      },
      { threshold: 0.6 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      setDisplay(value)
    }
  }, [target, value, durationMs])

  return (
    <>
      {/* Lebar tetap (ch + tabular-nums) supaya angka yang berjalan tidak menggeser layout. */}
      <span ref={ref} aria-hidden="true" className="inline-block tabular-nums" style={{ minWidth: `${value.length}ch` }}>
        {display}
      </span>
      <span className="sr-only">{value}</span>
    </>
  )
}
