import { useSyncExternalStore } from 'react'
import { storageGet, storageSet } from '@/lib/storage'
import { id } from './id'
import type { Dictionary, Lang } from './types'

/** Harus sama dengan script di index.html. */
const STORAGE_KEY = 'inapr-lang'

/**
 * Kamus Indonesia (default) selalu ada di bundel awal. Kamus Inggris dimuat malas (chunk terpisah)
 * saat bahasa EN dipilih atau tersimpan: lihat ensureLang() dan initLang().
 */
const dictionaries: Partial<Record<Lang, Dictionary>> = { id }
const loading: Partial<Record<Lang, Promise<boolean>>> = {}

/**
 * Pastikan kamus bahasa itu sudah dimuat. Resolve true bila siap, false bila gagal (jaringan).
 * Pemanggil mengganti bahasa HANYA setelah ini true, jadi teks lama tetap tampil sampai kamus
 * baru siap dan tidak ada kedip/teks kosong di antaranya.
 */
export function ensureLang(next: Lang): Promise<boolean> {
  if (dictionaries[next]) return Promise.resolve(true)
  loading[next] ??= import('./en')
    .then((module) => {
      dictionaries[next] = module.en
      return true
    })
    .catch(() => {
      delete loading[next] // boleh dicoba lagi
      return false
    })
  return loading[next]
}

/** Kamus bahasa aktif; id selalu ada, jadi tidak pernah undefined. */
const dictionaryOf = (value: Lang): Dictionary => dictionaries[value] ?? id

function readLang(): Lang {
  return storageGet(STORAGE_KEY) === 'en' ? 'en' : 'id'
}

const IS_BROWSER = typeof document !== 'undefined'

/**
 * Saat prerender (tanpa DOM) selalu Bahasa Indonesia. Di browser mulai dari id; bahasa tersimpan
 * diterapkan oleh initLang() sebelum render pertama (kamus Inggris dimuat dulu).
 */
let lang: Lang = 'id'
const listeners = new Set<() => void>()

/** <html lang>, judul dokumen, dan meta description ikut bahasa aktif. */
function applyDocument(next: Lang): void {
  const dict = dictionaryOf(next)
  document.documentElement.lang = next
  document.title = dict.meta.title
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', dict.meta.description)
}

/**
 * Dipanggil sekali di src/main.tsx SEBELUM render pertama: muat kamus bahasa tersimpan (bila bukan id)
 * lalu terapkan, supaya render pertama langsung memakai bahasa yang benar. Gagal muat → tetap id.
 * Mengembalikan bahasa yang berlaku (main.tsx: hydrasi hanya bila 'id', sama dengan HTML prerender).
 */
export async function initLang(): Promise<Lang> {
  const stored = IS_BROWSER ? readLang() : 'id'
  if (await ensureLang(stored)) lang = stored
  if (IS_BROWSER) applyDocument(lang)
  return lang
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Lang {
  return lang
}

function getServerSnapshot(): Lang {
  return 'id'
}

export function setLang(next: Lang): void {
  if (next === lang) return
  if (!dictionaries[next]) {
    // Kamus belum dimuat: ganti setelah siap (pemanggil yang peduli transisi memanggil ensureLang dulu).
    void ensureLang(next).then((ready) => {
      if (ready) setLang(next)
    })
    return
  }
  lang = next
  storageSet(STORAGE_KEY, next)
  applyDocument(next)
  listeners.forEach((listener) => listener())
}

/** Bahasa aktif + kamusnya. Pakai `t.nav.cta`, dst. (typed, tanpa string key). */
export function useI18n() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { lang: current, t: dictionaryOf(current), setLang }
}
