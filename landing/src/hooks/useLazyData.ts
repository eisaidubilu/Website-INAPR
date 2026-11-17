import { useEffect, useState } from 'react'

export type LazyData<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: T }

/**
 * Memuat data lewat dynamic import saat komponen dipasang.
 * `load` harus stabil (didefinisikan di level modul).
 */
export function useLazyData<T>(load: () => Promise<T>): LazyData<T> {
  const [state, setState] = useState<LazyData<T>>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data })
      },
      () => {
        if (!cancelled) setState({ status: 'error' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [load])

  return state
}
