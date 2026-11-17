/** Normalisasi untuk pencarian: huruf kecil, tanpa diakritik, spasi tunggal. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Pecah kueri jadi kata; cocok bila SEMUA kata ada di teks (urutan bebas). */
export function queryTerms(query: string): string[] {
  const folded = fold(query)
  return folded ? folded.split(' ') : []
}

export function matchesAll(haystack: string, terms: readonly string[]): boolean {
  return terms.every((term) => haystack.includes(term))
}
