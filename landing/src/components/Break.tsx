import type { CSSProperties } from 'react'
import { BREAK_HEIGHT } from '@/config/pointfield'
import { BREAK_SHAPES } from '@/lib/sections'

interface BreakProps {
  /** 0..6, urutan jeda di antara section. */
  index: number
}

/** Tinggi jeda dari config (BREAK_HEIGHT), dibaca kelas tinggi di className di bawah. */
const heightVars = {
  '--break-h-mobile': BREAK_HEIGHT.mobile,
  '--break-h-desktop': BREAK_HEIGHT.desktop,
} as CSSProperties

/**
 * Jeda (celah) di antara section: hanya ruang scroll pendek, tanpa teks. Di sini engine
 * titik 3D melakukan zoom-in ke satu sisi layar, membentuk satu bentuk, lalu zoom-out.
 * Tinggi dari BREAK_HEIGHT (src/config/pointfield.ts); breakpoint md (768px) = batas
 * mobile/desktop.
 *
 * Kontrak dengan engine titik (src/pointfield/engine.ts):
 * - data-break={index} dan data-shape={nama bentuk}.
 * - Urutan scroll = urutan DOM dari [data-section] dan [data-break].
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
