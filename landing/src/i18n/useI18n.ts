import { useSyncExternalStore } from 'react'
import { storageGet, storageSet } from '@/lib/storage'
import { en } from './en'
import { id } from './id'
import type { Dictionary, Lang } from './types'

/** Harus sama dengan script di index.html. */
const STORAGE_KEY = 'inapr-lang'

const dictionaries: Record<Lang, Dictionary> = { id, en }

function readLang(): Lang {
  return storageGet(STORAGE_KEY) === 'en' ? 'en' : 'id'
}

const IS_BROWSER = typeof document !== 'undefined'

/** Saat prerender (tanpa DOM) selalu Bahasa Indonesia. */
let lang: Lang = IS_BROWSER ? readLang() : 'id'
const listeners = new Set<() => void>()

/** <html lang>, judul dokumen, dan meta description ikut bahasa aktif. */
function applyDocument(next: Lang): void {
  const dict = dictionaries[next]
  document.documentElement.lang = next
  document.title = dict.meta.title
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', dict.meta.description)
}

if (IS_BROWSER) applyDocument(lang)

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
  lang = next
  storageSet(STORAGE_KEY, next)
  applyDocument(next)
  listeners.forEach((listener) => listener())
}

/** Bahasa aktif + kamusnya. Pakai `t.nav.cta`, dst. (typed, tanpa string key). */
export function useI18n() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { lang: current, t: dictionaries[current], setLang }
}
