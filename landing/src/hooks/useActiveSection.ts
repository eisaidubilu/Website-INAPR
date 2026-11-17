import { useEffect, useState } from 'react'

/**
 * Mengembalikan id section terakhir yang bagian atasnya sudah melewati
 * tengah layar. Saat berada di jeda (Break), section sebelumnya tetap aktif.
 * Dihitung ulang tiap scroll/resize (di-throttle dengan requestAnimationFrame),
 * jadi tetap benar walau scroll melompat jauh (mis. klik anchor).
 * `ids` harus stabil (konstanta modul), bukan array baru tiap render.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    let frame = 0

    const update = () => {
      frame = 0
      const middle = window.innerHeight / 2
      let current: string | null = elements[0]?.id ?? null
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= middle) current = el.id
        else break
      }
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [ids])

  return active
}
