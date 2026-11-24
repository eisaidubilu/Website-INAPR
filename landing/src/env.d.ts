/** Variabel env proyek (lihat .env.example). */
import type { PointFieldEngine } from '@/pointfield/engine'

declare global {
  interface ImportMetaEnv {
    /** Alamat dasar folder slide PDF webinar. Kosong = tombol "Slide" disembunyikan. */
    readonly VITE_SLIDES_BASE_URL?: string
    /** Mode (a): alamat backend INAPR ("https://api…" atau "/" untuk same-origin/proxy). Lihat docs/KONTRAK-DATA.md. */
    readonly VITE_API_BASE?: string
    /** Mode (b): URL proyek Supabase. Hanya dipakai bersama VITE_SUPABASE_ANON_KEY. */
    readonly VITE_SUPABASE_URL?: string
    /** Mode (b): anon key (publik; keamanan ada di RLS). JANGAN pernah isi service-role key. */
    readonly VITE_SUPABASE_ANON_KEY?: string
  }
  /** Tahun saat build (vite.config.ts `define`): tahun di footer saat hidrasi = tahun HTML prerender. */
  const __BUILD_YEAR__: number
  interface Window {
    /** Khusus dev server: engine titik aktif, untuk skrip pengujian. Tidak ada di produksi. */
    __inaprPointField?: PointFieldEngine
  }
}

export {}
