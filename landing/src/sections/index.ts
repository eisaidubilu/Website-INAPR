import type { ComponentType } from 'react'
import type { SectionId } from '@/i18n/types'
import { Afiliasi } from './Afiliasi'
import { Anggota } from './Anggota'
import { Berita } from './Berita'
import { Bidang } from './Bidang'
import { Gabung } from './Gabung'
import { Kegiatan } from './Kegiatan'
import { Publikasi } from './Publikasi'
import { Tentang } from './Tentang'

/** Urutan render. Harus sama dengan SECTION_IDS di src/lib/sections.ts. */
export const SECTIONS: readonly { id: SectionId; Component: ComponentType }[] = [
  { id: 'tentang', Component: Tentang },
  { id: 'kegiatan', Component: Kegiatan },
  { id: 'bidang', Component: Bidang },
  { id: 'publikasi', Component: Publikasi },
  { id: 'anggota', Component: Anggota },
  { id: 'gabung', Component: Gabung },
  { id: 'afiliasi', Component: Afiliasi },
  { id: 'berita', Component: Berita },
]
