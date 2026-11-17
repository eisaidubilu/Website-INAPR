/** Helper animasi mikro. Semua animasi wajib mengecek ini lebih dulu. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
