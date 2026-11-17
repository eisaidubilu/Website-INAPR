import { useEffect, type RefObject } from 'react'

/**
 * Mengukur header sticky dan banner, lalu menulis CSS variable di <html>:
 * --banner-h (header sticky di top: -banner-h, jadi banner ikut tergulung)
 * --nav-h    (tinggi bar navigasi; dipakai scroll-padding-top)
 */
export function useHeaderMetrics(
  headerRef: RefObject<HTMLElement | null>,
  bannerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const header = headerRef.current
    const banner = bannerRef.current
    if (!header || !banner) return
    const root = document.documentElement

    const measure = () => {
      const bannerHeight = banner.offsetHeight
      root.style.setProperty('--banner-h', `${bannerHeight}px`)
      root.style.setProperty('--nav-h', `${header.offsetHeight - bannerHeight}px`)
    }
    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    observer.observe(banner)
    return () => observer.disconnect()
  }, [headerRef, bannerRef])
}
