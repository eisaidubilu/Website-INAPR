import { useEffect, useState, type RefObject } from 'react'

export type LazyData<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T }

/** Mulai memuat saat elemen sudah sedekat ini dari layar (±1 layar di bawah/atas). */
const NEAR_VIEWPORT = '600px 0px'

/**
 * Memuat data lewat `load` saat komponen dipasang, atau — bila `target` diberikan — saat elemen itu
 * mendekati layar (IntersectionObserver, margin ±600px). Tanpa IntersectionObserver: langsung dimuat.
 * Selama menunggu status tetap 'loading' (LoadNotice). `load` harus stabil (level modul).
 */
export function useLazyData<T>(load: () => Promise<T>, target?: RefObject<Element | null>): LazyData<T> {
  const [state, setState] = useState<LazyData<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let observer: IntersectionObserver | undefined

    const run = () => {
      load().then(
        (data) => {
          if (!cancelled) setState({ status: 'ready', data })
        },
        () => {
          if (!cancelled) setState({ status: 'error' })
        },
      )
    }

    const element = target?.current
    if (element && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return
          observer?.disconnect()
          run()
        },
        { rootMargin: NEAR_VIEWPORT },
      )
      observer.observe(element)
    } else {
      run()
    }

    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [load, target])

  return state
}
