/**
 * Alamat slide webinar. Hosting file PDF belum diputuskan, jadi alamat dasarnya
 * dibaca dari VITE_SLIDES_BASE_URL (lihat .env.example). Kosong / tidak valid
 * → tombol "Slide" tidak ditampilkan.
 */
function parseBase(value: string | undefined): URL | null {
  const raw = value?.trim()
  // Tanpa window (prerender): tombol Slide tidak dirender.
  if (!raw || typeof window === 'undefined') return null
  try {
    // Boleh absolut (https://…) atau relatif ke situs (/slides/).
    const url = new URL(raw.endsWith('/') ? raw : `${raw}/`, window.location.href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

const BASE = parseBase(import.meta.env.VITE_SLIDES_BASE_URL)

/** URL lengkap slide, atau null bila alamat dasar belum diisi. */
export function slideUrl(file: string): string | null {
  return BASE ? new URL(encodeURIComponent(file), BASE).href : null
}
