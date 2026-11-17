import { useSyncExternalStore } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { storageGet, storageSet } from '@/lib/storage'

export type Theme = 'light' | 'dark'

interface ThemeState {
  /** Tema yang sedang tampil. */
  resolved: Theme
  /** true = pengguna pernah menekan tombol tema (pilihan tersimpan); false = ikut sistem. */
  explicit: boolean
}

/** Harus sama dengan script anti-flash di index.html. */
const STORAGE_KEY = 'inapr-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function systemTheme(): Theme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

/** Pilihan eksplisit tersimpan. Nilai lain (termasuk 'system' dari versi lama) = ikut sistem. */
function readSaved(): Theme | null {
  const saved = storageGet(STORAGE_KEY)
  return saved === 'light' || saved === 'dark' ? saved : null
}

function initialState(): ThemeState {
  const saved = readSaved()
  return saved ? { resolved: saved, explicit: true } : { resolved: systemTheme(), explicit: false }
}

const IS_BROWSER = typeof document !== 'undefined'
/** Dipakai saat prerender (tanpa DOM). Ikon tombol tetap benar karena dipilih lewat CSS data-theme. */
const SERVER_STATE: ThemeState = { resolved: 'light', explicit: false }

/**
 * Sesi tanpa localStorage: pilihan tetap disimpan di memori (state.explicit), jadi tombol
 * berfungsi dan perubahan tema sistem diabaikan sampai halaman dimuat ulang.
 */
let state: ThemeState = IS_BROWSER ? initialState() : SERVER_STATE
const listeners = new Set<() => void>()

/** Terapkan tema ke <html> dan samakan warna bilah browser (meta theme-color) dengan --bg. */
function applyDocument(resolved: Theme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (!bg) return
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = bg
  })
}

// Sinkronkan ulang kalau script di index.html gagal jalan.
if (IS_BROWSER) applyDocument(state.resolved)

let transitionTimer = 0

/**
 * Transisi warna singkat (±200ms, lihat .theme-transition di global.css) saat tema
 * berganti. Kelas dipasang di frame yang sama dengan pergantian data-theme, lalu dilepas.
 */
function withColorTransition(change: () => void): void {
  const root = document.documentElement
  if (!prefersReducedMotion()) {
    root.classList.add('theme-transition')
    window.clearTimeout(transitionTimer)
    transitionTimer = window.setTimeout(() => root.classList.remove('theme-transition'), 260)
  }
  change()
}

function commit(next: ThemeState): void {
  const changed = next.resolved !== state.resolved
  state = next
  if (changed) withColorTransition(() => applyDocument(next.resolved))
  else applyDocument(next.resolved)
  listeners.forEach((listener) => listener())
}

/** Tema sistem berubah: ikut langsung, selama pengguna belum memilih sendiri. */
function onSystemChange(): void {
  if (!state.explicit) commit({ resolved: systemTheme(), explicit: false })
}

let media: MediaQueryList | null = null

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    try {
      media = window.matchMedia(DARK_QUERY)
      media.addEventListener('change', onSystemChange)
    } catch {
      media = null
    }
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      media?.removeEventListener('change', onSystemChange)
      media = null
    }
  }
}

function getSnapshot(): ThemeState {
  return state
}

function getServerSnapshot(): ThemeState {
  return SERVER_STATE
}

/** Tombol tema: ganti Terang ↔ Gelap dari tema yang sedang tampil, lalu simpan sebagai pilihan eksplisit. */
export function toggleTheme(): void {
  const next: Theme = state.resolved === 'dark' ? 'light' : 'dark'
  storageSet(STORAGE_KEY, next)
  commit({ resolved: next, explicit: true })
}

/** Tema yang sedang tampil (`resolved`) dan apakah itu pilihan pengguna (`explicit`). */
export function useTheme() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return { ...current, toggle: toggleTheme }
}
