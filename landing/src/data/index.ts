/**
 * Bentuk data di src/data/*.json. File JSON dihasilkan oleh
 * scripts/build-data.mjs dari arsip situs lama; jangan diedit tangan.
 */

export interface Member {
  name: string
}

export interface MembersData {
  source: string
  /** Tanggal data (ISO), mis. "2020-04-19". */
  asOf: string
  /** Angka resmi di situs lama. Bisa berbeda dari members.length (lihat README). */
  officialTotal: number
  /** Urut abjad (gelar di depan diabaikan). */
  members: Member[]
}

export interface Webinar {
  /** ISO, mis. "2022-09-02". */
  date: string
  time: string
  speaker: string
  institution: string
  title: string
  /** URL YouTube baku, atau "" bila tidak ada. */
  youtube: string
  /** Nama file PDF (tanpa folder). Kosong bila tidak ada. */
  slides: string[]
  /** Tautan paper terkait (belum ditampilkan di UI). */
  papers: string[]
}

export interface WebinarsData {
  source: string
  /** Terbaru dulu. */
  items: Webinar[]
}

/** Data di-import dinamis (chunk terpisah) supaya tidak masuk bundel awal. */
export const loadMembers = (): Promise<MembersData> =>
  import('./members.json').then((module) => module.default as MembersData)

export const loadWebinars = (): Promise<WebinarsData> =>
  import('./webinars.json').then((module) => module.default as WebinarsData)
