/**
 * Akses localStorage yang aman. Di mode privat, iframe sandbox, atau saat
 * storage diblokir, akses bisa melempar error; halaman harus tetap jalan.
 */
export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Abaikan: preferensi hanya tidak tersimpan.
  }
}
