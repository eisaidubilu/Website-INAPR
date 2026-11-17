import type { CSSProperties } from 'react'
import { BREAK_HEIGHT } from '@/config/pointfield'
import { BREAK_SHAPES } from '@/lib/sections'

interface BreakProps {
  /** 0..6, urutan jeda di antara section. */
  index: number
}

/** Tinggi jeda dari config (BREAK_HEIGHT), dibaca kelas tinggi di className di bawah. */
const heightVars = {
  '--break-h-mobile': `${BREAK_HEIGHT.mobile}svh`,
  '--break-h-desktop': `${BREAK_HEIGHT.desktop}vh`,
} as CSSProperties

/**
 * Jeda (celah) di antara section: hanya ruang scroll (±2 layar), tanpa teks. Di sini engine
 * titik 3D melakukan zoom-in ke satu sisi layar, membentuk satu bentuk, lalu zoom-out.
 * Tinggi dari BREAK_HEIGHT (src/config/pointfield.ts); breakpoint md (768px) = batas
 * mobile/desktop.
 *
 * Kontrak dengan engine titik (src/pointfield/engine.ts):
 * - data-break={index} dan data-shape={nama bentuk}.
 * - Urutan scroll = urutan DOM dari [data-section] dan [data-break].
 * - Sengaja tanpa titik scroll-snap dan tanpa gerbang (lihat komentar di global.css): snap
 *   tengah-jeda menjebak scroll roda mouse di pusat jeda, dan engine tidak pernah menggerakkan
 *   posisi scroll. Flick cepat boleh melewati jeda; animasinya hanya menempel ke scroll.
 * - Jeda tercakup snap area section di atasnya (scroll-margin-bottom = tinggi jeda, variabel
 *   --break-h-* di :root global.css; samakan dengan BREAK_HEIGHT): bukan titik snap, jadi scroll
 *   di jeda bebas dan section pendek tidak menjebak roda di awalnya.
 * - Supaya tidak mudah terlewat: animasi melebar ke tepi section (edgeLeadVh/edgeTrailVh) dan
 *   roda mouse/trackpad diredam di zona jeda (scrollDamping, src/pointfield/wheeldamp.ts). Peredam
 *   hanya memperkecil delta roda pengguna; tidak pernah menarik posisi scroll.
 */
export function Break({ index }: BreakProps) {
  return (
    <div
      data-break={index}
      data-shape={BREAK_SHAPES[index]}
      aria-hidden="true"
      style={heightVars}
      className="pointer-events-none relative h-[var(--break-h-mobile)] md:h-[var(--break-h-desktop)]"
    />
  )
}
