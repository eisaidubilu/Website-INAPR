/** Variabel env proyek (lihat .env.example). */
import type { PointFieldEngine } from '@/pointfield/engine'

declare global {
  interface ImportMetaEnv {
    /** Alamat dasar folder slide PDF webinar. Kosong = tombol "Slide" disembunyikan. */
    readonly VITE_SLIDES_BASE_URL?: string
  }
  interface Window {
    /** Khusus dev server: engine titik aktif, untuk skrip pengujian. Tidak ada di produksi. */
    __inaprPointField?: PointFieldEngine
  }
}

export {}
