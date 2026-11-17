/**
 * Peredam scroll roda di zona jeda (params.scrollDamping).
 *
 * Tujuan: saat bentuk jeda terlihat, roda mouse/trackpad terasa "berat", jadi satu flick tidak
 * melompati bentuknya; di bagian lain (lead, zoom in awal, zoom out akhir, trail, section) scroll
 * terasa normal dan TIDAK DIREDAM SAMA SEKALI. Posisi scroll TIDAK PERNAH ditarik ke mana pun:
 * peredam hanya memperkecil jarak yang ditempuh oleh delta roda yang dikirim pengguna.
 * Berhenti rapi di awal section ditangani scroll-snap CSS (global.css), bukan oleh modul ini.
 *
 * Cara kerja
 * - Satu listener `wheel` di window ({ passive: false }). Event diambil alih hanya bila peredam
 *   aktif (scrollDamping, bukan reduced motion, bukan navigasi anchor) DAN faktor di posisi target
 *   < 1 atau loop peredam masih berjalan (supaya event berikutnya dari flick yang sama tidak
 *   berganti-ganti antara native dan peredam). Faktor tepat 1 → scroll native utuh.
 * - Faktor = fungsi posisi tengah viewport (factorAt → scrollmap.dampFactorAt): lerp(1,
 *   scrollDampFactor, w), w = smoothstep(dampWeightLow, dampWeightHigh, m), m = intensitas jeda di
 *   posisi itu (rumus yang sama dengan animasi). Kontinu; 1 di kedua ujung rentang dan di luarnya.
 * - Delta dinormalkan (baris/halaman → px), lalu diintegrasikan per langkah kecil (DAMP.chunkPx)
 *   dengan faktor di tiap posisi, jadi flick besar yang masuk/keluar zona tetap halus.
 * - preventDefault, posisi target += delta teredam (dibatasi [0, maks scroll]); loop rAF
 *   mengejar target dengan lerp (DAMP.lerp per frame 60 fps) lewat scrollBy 'instant', berhenti
 *   saat selisih < DAMP.stopPx. Loop hanya berjalan setelah ada delta roda dari pengguna.
 * - scrollBy dipakai, bukan scrollTo(y): scrollTo programatik di-snap ke posisi snap TERDEKAT (juga
 *   ke belakang), sehingga peredam bisa terkunci; scrollBy adalah scroll berarah, jadi snap hanya
 *   bisa melompat SEARAH delta (sama seperti roda native). Bila snap melompati target, target ikut
 *   posisi aktual. Bila tulisan sama sekali tidak bergerak, roda di posisi itu dilepas ke native.
 *
 * Sinkronisasi (mencegah "macet" dan "naik lagi")
 * - Tiap frame: bila scrollY berbeda dari hasil tulisan terakhir (drag scrollbar, keyboard,
 *   sentuhan, navigasi, scroll anchoring, restorasi, snap), target disamakan ke scrollY dan loop
 *   berhenti tanpa menulis. Event roda berikutnya juga mulai dari scrollY aktual.
 * - Tombol scroll, sentuhan, pointerdown di scrollbar/root, dan klik tautan #anchor langsung
 *   menghentikan loop. Selama navigasi anchor (sampai scroll diam / scrollend / batas aman)
 *   semua event roda dilepas ke native.
 * - Diabaikan (native): ctrl/meta (zoom), shift atau gerak dominan horizontal, target di elemen
 *   yang bisa digulir sendiri (input, textarea, panel overflow), event tidak cancelable, error.
 *
 * Keterbatasan: hanya roda/trackpad. Di perangkat sentuh swipe cepat tidak bisa diredam (scroll
 * sentuh tidak lewat event wheel, dan menahannya akan terasa macet). Inersia trackpad tetap
 * berupa event wheel, jadi diredam konsisten. Sisa animasi smooth-scroll native yang sedang
 * berjalan saat masuk zona ikut terhenti (scrollBy 'instant' membatalkannya). Satu-satunya
 * penulis posisi adalah scrollBy di loop ini, dan hanya untuk menerapkan delta roda pengguna.
 */
import { DAMP } from '@/config/pointfield'

export interface DampDebug {
  /** Loop peredam sedang menggerakkan scroll. */
  active: boolean
  /** Peredam boleh bekerja sekarang (parameter, reduced motion, navigasi). */
  enabled: boolean
  navigating: boolean
  /** Posisi target (px dokumen) dan faktor di posisi target. */
  target: number
  factor: number
  /** Event roda yang diredam / dilepas ke native; jumlah scrollBy; sinkronisasi karena sumber lain. */
  handled: number
  passed: number
  writes: number
  syncs: number
}

export interface WheelDamper {
  /** Hentikan loop dan samakan target ke scrollY (mis. setelah resize). */
  release(): void
  debug(): DampDebug
  destroy(): void
}

interface WheelDamperOptions {
  /** Parameter dan reduced motion; false → semua event native. */
  enabled(): boolean
  /** Faktor redam (0..1] di posisi tengah viewport `mid` (px dokumen); 1 = tanpa redam. */
  factorAt(mid: number): number
}

const SCROLL_KEYS = new Set([' ', 'Spacebar', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'])
const FRAME_MS = 1000 / 60

function viewport(): number {
  return document.documentElement.clientHeight || window.innerHeight
}

function maxScroll(): number {
  const root = document.scrollingElement ?? document.documentElement
  return Math.max(0, root.scrollHeight - viewport())
}

/** Target event berada di elemen yang bisa digulir sendiri (atau kontrol isian) → biarkan native. */
function inOwnScroller(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.matches('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return true
    const style = getComputedStyle(el)
    if (/(auto|scroll|overlay)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) return true
    el = el.parentElement
  }
  return false
}

/** Delta vertikal dalam px (deltaMode 1 = baris, 2 = halaman). */
function normalizeDelta(event: WheelEvent): number {
  const unit = event.deltaMode === 1 ? DAMP.linePx : event.deltaMode === 2 ? viewport() * 0.9 : 1
  const limit = (DAMP.maxDeltaVh / 100) * viewport()
  return Math.max(-limit, Math.min(limit, event.deltaY * unit))
}

export function createWheelDamper(options: WheelDamperOptions): WheelDamper {
  let target = window.scrollY
  /** scrollY sesaat setelah tulisan terakhir peredam (-1 = belum/tidak sedang menulis). */
  let lastWritten = -1
  let raf = 0
  let lastFrame = 0
  /** Posisi tempat tulisan peredam tidak bisa maju; roda di posisi ini dilepas ke native. */
  let blockedAt = Number.NaN
  let navigating = false
  let navIdleTimer = 0
  let navMaxTimer = 0
  let handled = 0
  let passed = 0
  let writes = 0
  let syncs = 0

  const active = () => options.enabled() && !navigating

  /** Hentikan loop; target = posisi aktual. Tidak menulis scroll. */
  function release(): void {
    if (raf) window.cancelAnimationFrame(raf)
    raf = 0
    lastFrame = 0
    lastWritten = -1
    target = window.scrollY
  }

  /** Posisi diubah sumber lain sejak tulisan terakhir? */
  function changedElsewhere(y: number): boolean {
    return lastWritten >= 0 && Math.abs(y - lastWritten) > DAMP.externalPx
  }

  /** Target baru: integrasi faktor sepanjang delta (langkah kecil), dibatasi [0, maks]. */
  function advance(from: number, delta: number): number {
    const half = viewport() / 2
    const sign = Math.sign(delta)
    let left = Math.abs(delta)
    let pos = from
    while (left > 0) {
      const step = Math.min(left, DAMP.chunkPx)
      pos += sign * step * Math.min(1, Math.max(0.01, options.factorAt(pos + half)))
      left -= step
    }
    return Math.min(maxScroll(), Math.max(0, pos))
  }

  function frame(now: number): void {
    raf = 0
    try {
      const y = window.scrollY
      if (changedElsewhere(y)) {
        syncs++
        release()
        return
      }
      if (!active()) {
        release()
        return
      }
      const diff = target - y
      if (Math.abs(diff) < DAMP.stopPx) {
        lastFrame = 0
        lastWritten = -1
        return
      }
      const dt = lastFrame ? Math.min(50, Math.max(0, now - lastFrame)) : FRAME_MS
      lastFrame = now
      const k = 1 - (1 - DAMP.lerp) ** (dt / FRAME_MS)
      const step = Math.abs(diff) < DAMP.snapPx ? diff : diff * k
      window.scrollBy({ top: step, behavior: 'instant' })
      writes++
      const after = window.scrollY
      if (Math.abs(after - y) < 0.01) {
        // Tidak maju (batas dokumen / pembulatan / ditahan browser): selesai di posisi aktual. Bila
        // langkahnya nyata, roda di posisi ini dilepas ke native (tidak pernah terkunci).
        if (Math.abs(step) >= 1) blockedAt = after
        release()
        return
      }
      // Snap melompat searah gerak melewati target: target ikut posisi aktual (tidak ditarik balik).
      if ((after - target) * Math.sign(diff) > 0) {
        release()
        return
      }
      lastWritten = after
      raf = window.requestAnimationFrame(frame)
    } catch {
      release()
    }
  }

  function onWheel(event: WheelEvent): void {
    try {
      if (!active() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return pass()
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return pass()
      if (inOwnScroller(event.target)) return pass()
      const y = window.scrollY
      if (Math.abs(y - blockedAt) < 1) return pass()
      blockedAt = Number.NaN
      if (!raf || changedElsewhere(y)) {
        if (raf) syncs++
        target = y
      }
      // Di luar zona peredam dan tanpa loop berjalan: scroll native utuh.
      if (!raf && options.factorAt(target + viewport() / 2) >= 1) return pass(false)
      if (!event.cancelable) return pass()
      event.preventDefault()
      handled++
      target = advance(target, normalizeDelta(event))
      if (lastWritten < 0) lastWritten = y
      if (!raf) raf = window.requestAnimationFrame(frame)
    } catch {
      release()
    }
  }

  /** Event dilepas ke native; loop (bila ada) dihentikan supaya tidak berebut dengan native. */
  function pass(stop = true): void {
    passed++
    if (stop && raf) release()
  }

  function endNavigation(): void {
    navigating = false
    window.clearTimeout(navIdleTimer)
    window.clearTimeout(navMaxTimer)
    release()
  }

  /** Navigasi programatik (klik #anchor, skip link, hashchange): peredam lepas sampai scroll diam. */
  function startNavigation(): void {
    navigating = true
    release()
    window.clearTimeout(navIdleTimer)
    window.clearTimeout(navMaxTimer)
    navIdleTimer = window.setTimeout(endNavigation, DAMP.navStartMs)
    navMaxTimer = window.setTimeout(endNavigation, DAMP.navMaxMs)
  }

  const onClick = (event: MouseEvent) => {
    if ((event.target as Element | null)?.closest?.('a[href^="#"]')) startNavigation()
  }
  const onScroll = () => {
    // Tanpa loop: target selalu = posisi aktual (keyboard, drag scrollbar, sentuhan, navigasi, snap).
    if (!raf) target = window.scrollY
    if (!navigating) return
    window.clearTimeout(navIdleTimer)
    navIdleTimer = window.setTimeout(endNavigation, DAMP.navIdleMs)
  }
  const onScrollEnd = () => {
    if (navigating) endNavigation()
  }
  const onKey = (event: KeyboardEvent) => {
    if (raf && SCROLL_KEYS.has(event.key)) release()
  }
  const onTouch = () => {
    if (raf) release()
  }
  // Scrollbar halaman / area root: drag scrollbar mengambil alih.
  const onPointerDown = (event: PointerEvent) => {
    if (raf && (event.target === document.documentElement || event.pointerType === 'touch')) release()
  }

  const passive = { passive: true } as const
  window.addEventListener('wheel', onWheel, { passive: false })
  document.addEventListener('click', onClick, true)
  window.addEventListener('hashchange', startNavigation)
  window.addEventListener('scroll', onScroll, passive)
  window.addEventListener('scrollend', onScrollEnd)
  window.addEventListener('keydown', onKey, passive)
  window.addEventListener('touchstart', onTouch, passive)
  window.addEventListener('pointerdown', onPointerDown, passive)

  return {
    release,
    debug: () => ({
      active: raf !== 0,
      enabled: active(),
      navigating,
      target,
      factor: options.factorAt(target + viewport() / 2),
      handled,
      passed,
      writes,
      syncs,
    }),
    destroy() {
      release()
      window.clearTimeout(navIdleTimer)
      window.clearTimeout(navMaxTimer)
      window.removeEventListener('wheel', onWheel)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('hashchange', startNavigation)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scrollend', onScrollEnd)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('pointerdown', onPointerDown)
    },
  }
}
