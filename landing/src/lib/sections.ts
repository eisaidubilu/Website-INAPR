import type { SectionId } from '@/i18n/types'

/** Urutan section di halaman. Indeks ini juga dipakai di atribut data-section. */
export const SECTION_IDS = [
  'tentang',
  'kegiatan',
  'bidang',
  'publikasi',
  'anggota',
  'gabung',
  'afiliasi',
  'berita',
] as const satisfies readonly SectionId[]

/** Section yang punya menu di navbar (afiliasi tidak). */
export type NavId = Exclude<SectionId, 'afiliasi'>

export const NAV_IDS: readonly NavId[] = [
  'tentang',
  'kegiatan',
  'bidang',
  'publikasi',
  'anggota',
  'gabung',
  'berita',
]

/** Bentuk titik per jeda (Break). Indeks = data-break. Urutan = src/pointfield/geometry.ts. */
export const BREAK_SHAPES = [
  'cube',
  'sphere',
  'torus',
  'pyramid',
  'cylinder',
  'octahedron',
  'helix',
] as const

export type BreakShape = (typeof BREAK_SHAPES)[number]
