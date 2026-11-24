import { useEffect, useSyncExternalStore, type RefObject } from 'react'
import { SECTION_IDS } from '@/lib/sections'

/**
 * Satu sumber bersama untuk semua yang bergantung pada posisi scroll halaman:
 * section aktif (Navbar + SectionRail), bayangan navbar, dan bilah progres.
 *
 * Satu listener scroll pasif, satu rAF per frame, dan TANPA pembacaan layout per frame:
 * posisi section (offset dokumen), tinggi viewport, dan scroll maksimum diukur sekali, lalu
 * diukur ulang hanya saat ukuran berubah (resize, ukuran <body> berubah: data lazy, font, ganti
 * bahasa). Per frame hanya `scrollY` yang dibaca. Dipasang saat subscriber pertama muncul,
 * dilepas saat yang terakhir pergi.
 *
 * Aturannya sama dengan versi lama:
 * - aktif = section terakhir yang bagian atasnya sudah di atas tengah layar (default: yang pertama);
 *   saat di jeda (Break) section sebelumnya tetap aktif;
 * - progres = scrollY / (scrollHeight − innerHeight), dijepit 0..1;
 * - bayangan = scrollY > SCROLL_SHADOW_AFTER.
 */

/** Jarak gulir (px) sebelum bayangan navbar muncul. */
const SCROLL_SHADOW_AFTER = 8

type Listener = () => void

let active: string | null = null
let scrolled = false
const stateListeners = new Set<Listener>()
const progressListeners = new Set<(progress: number) => void>()

let running = false
let frame = 0
let observer: ResizeObserver | undefined
/** Offset atas tiap section dari awal dokumen (px), searah SECTION_IDS. */
let tops: { id: string; top: number }[] = []
let viewport = 0
let maxScroll = 0
let progress = 0

function measure(): void {
  viewport = window.innerHeight
  maxScroll = document.documentElement.scrollHeight - viewport
  const y = window.scrollY
  tops = []
  for (const id of SECTION_IDS) {
    const el = document.getElementById(id)
    if (el) tops.push({ id, top: el.getBoundingClientRect().top + y })
  }
}

function update(): void {
  frame = 0
  const y = window.scrollY
  const middle = viewport / 2
  let current: string | null = tops[0]?.id ?? null
  for (const section of tops) {
    if (section.top - y <= middle) current = section.id
    else break
  }
  const isScrolled = y > SCROLL_SHADOW_AFTER
  if (current !== active || isScrolled !== scrolled) {
    active = current
    scrolled = isScrolled
    stateListeners.forEach((listener) => listener())
  }
  const next = maxScroll > 0 ? Math.min(1, Math.max(0, y / maxScroll)) : 0
  if (next !== progress) {
    progress = next
    progressListeners.forEach((listener) => listener(next))
  }
}

function schedule(): void {
  if (!frame) frame = window.requestAnimationFrame(update)
}

function remeasure(): void {
  measure()
  schedule()
}

function start(): void {
  running = true
  measure()
  update()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', remeasure, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(remeasure)
    observer.observe(document.body)
  }
  void document.fonts?.ready.then(() => {
    if (running) remeasure()
  })
}

function stop(): void {
  running = false
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', remeasure)
  observer?.disconnect()
  observer = undefined
  if (frame) window.cancelAnimationFrame(frame)
  frame = 0
}

function register<T>(set: Set<T>, listener: T): () => void {
  set.add(listener)
  if (!running) start()
  return () => {
    set.delete(listener)
    if (running && stateListeners.size === 0 && progressListeners.size === 0) stop()
  }
}

const subscribeState = (listener: Listener) => register(stateListeners, listener)
const getActive = () => active
const getScrolled = () => scrolled
const getServerState = () => null
const getServerScrolled = () => false

/** Id section yang sedang dibaca (null sebelum diukur / saat prerender). Satu sumber untuk semua pemakai. */
export function useActiveSection(): string | null {
  return useSyncExternalStore(subscribeState, getActive, getServerState)
}

/** True setelah halaman digulir lebih dari SCROLL_SHADOW_AFTER. */
export function useScrolled(): boolean {
  return useSyncExternalStore(subscribeState, getScrolled, getServerScrolled)
}

/**
 * Bilah progres: scaleX(posisi gulir 0..1) ditulis langsung ke elemen, tanpa render ulang React.
 * Nilai awal ditulis saat dipasang.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const write = (value: number) => {
      const bar = ref.current
      if (bar) bar.style.transform = `scaleX(${value.toFixed(4)})`
    }
    const unregister = register(progressListeners, write)
    write(progress)
    return unregister
  }, [ref])
}
