/**
 * Panel tuning latar titik 3D, KHUSUS dev server: buka http://localhost:5173/?tune
 *
 * Dipasang oleh ./tune.tsx, yang dimuat dinamis dari <PointField /> di balik
 * `import.meta.env.DEV`, jadi tidak ikut bundel produksi. Nilai disimpan sementara di localStorage ("inapr-tune") supaya tidak
 * hilang saat refresh; "Reset" menghapusnya. "Salin nilai" menyalin objek siap tempel
 * ke src/config/pointfield.ts (plus blok CSS untuk warna baca di src/styles/tokens.css).
 *
 * Di luar PointFieldParams: warna baca per tema (token --titik-baca-*, dipasang lewat
 * <style> sementara) dan saklar scroll-snap (style inline di <html>, hanya untuk menguji).
 */
import { useEffect, useId, useRef, useState } from 'react'
import {
  BREAK_HEIGHT,
  GEOMETRY_KEYS,
  POINTFIELD_DEFAULTS,
  readStats,
  ZOOM_DIRECTIONS,
  type PointFieldParams,
  type ZoomDirection,
} from '@/config/pointfield'
import { BREAK_SHAPES, SECTION_IDS } from '@/lib/sections'
import type { PointFieldDebug, PointFieldEngine } from '@/pointfield/engine'
import { dampEquivalentVh } from '@/pointfield/scrollmap'

const STORAGE_KEY = 'inapr-tune'
const REBUILD_DELAY = 300
const OVERRIDE_STYLE_ID = 'inapr-tune-read-colors'

type ThemeName = 'light' | 'dark'
type ReadColors = Record<ThemeName, string[]>
const THEMES: readonly ThemeName[] = ['light', 'dark']
const THEME_LABEL: Record<ThemeName, string> = { light: 'Terang', dark: 'Gelap' }
const READ_TOKENS = ['--titik-baca-1', '--titik-baca-2', '--titik-baca-3']
/** Cadangan bila tokens.css tidak bisa dibaca lewat CSSOM; cermin nilai di src/styles/tokens.css. */
const FALLBACK_READ_COLORS: ReadColors = {
  light: ['#a50104', '#fcba04', '#c86e00'],
  dark: ['#fcba04', '#d8be94', '#d83a3d'],
}
const HEX = /^#[0-9a-f]{6}$/i

type ScalarKey = Exclude<keyof PointFieldParams, 'yaw' | 'pitch' | 'zoomDirections' | 'scrollDamping'>
type AngleKey = 'yaw' | 'pitch'

interface Spec {
  key: ScalarKey
  label: string
  min: number
  max: number
  step: number
  /** Nilai efektif hasil hitung (yang terlihat), ditampilkan di bawah slider. */
  hint?: (params: PointFieldParams) => string
}

const pct = (value: number) => Math.round(value * 100) + '%'
const op = (value: number) => value.toFixed(2)

const GROUPS: { title: string; note?: string; specs: Spec[] }[] = [
  {
    title: 'Revolusi bintang',
    specs: [
      { key: 'revolutionSpeed', label: 'Kecepatan dasar (rad/s)', min: 0, max: 0.3, step: 0.005 },
      { key: 'revolutionCoreBoost', label: 'Tambahan di pusat', min: 0, max: 3, step: 0.05 },
      { key: 'revolutionVariation', label: 'Variasi acak (±)', min: 0, max: 1, step: 0.05 },
      { key: 'revolutionTiltX', label: 'Kemiringan bidang X (rad)', min: -1.57, max: 1.57, step: 0.01 },
      { key: 'revolutionTiltZ', label: 'Kemiringan bidang Z (rad)', min: -1.57, max: 1.57, step: 0.01 },
      { key: 'wobbleAmplitude', label: 'Gerak halus: amplitudo', min: 0, max: 0.6, step: 0.01 },
      { key: 'wobbleSpeed', label: 'Gerak halus: kecepatan', min: 0, max: 3, step: 0.05 },
    ],
  },
  {
    title: 'Kamera & scroll',
    specs: [
      {
        key: 'smoothing',
        label: 'Smoothing scroll (scrubbed; besar = menempel)',
        min: 0.05,
        max: 1,
        step: 0.01,
        hint: (p) => 'T sampai 95% posisi scroll dalam ≈ ' + (Math.log(0.05) / Math.log(1 - Math.min(0.999, p.smoothing)) / 60).toFixed(2) + ' s',
      },
      { key: 'cameraFar', label: 'Jarak kamera netral (zoom out)', min: 4, max: 40, step: 0.5 },
      { key: 'cameraNear', label: 'Jarak kamera ke bentuk (zoom in)', min: 2, max: 30, step: 0.5 },
      { key: 'zoomReach', label: 'Jarak fokus dari pusat (arah zoom)', min: 0, max: 20, step: 0.5 },
      { key: 'pathCurve', label: 'Kelengkungan jalur kamera', min: 0, max: 1, step: 0.05 },
      { key: 'holdDrift', label: 'Drift saat tahan (rad)', min: 0, max: 0.3, step: 0.005 },
      { key: 'matParallax', label: 'Parallax cutting mat', min: 0, max: 0.5, step: 0.01 },
    ],
  },
  {
    title: 'Scroll di jeda (anti-skip)',
    note: 'Tanpa gerbang dan tanpa snap di jeda: posisi scroll tidak pernah ditarik. Peredam hanya memperkecil delta roda/trackpad, dan hanya saat bentuk terlihat: faktor = lerp(1, faktor penuh, smoothstep(bobot mulai, bobot penuh, m)), m = intensitas jeda. Sentuhan, keyboard, dan drag scrollbar tetap native. Tepi 0 = mati.',
    specs: [
      {
        key: 'scrollDampFactor',
        label: 'Peredam: faktor saat bentuk terlihat penuh (× jarak roda)',
        min: 0.1,
        max: 1,
        step: 0.05,
        hint: (p) => 'satu notch 100px → ±' + Math.round(100 * p.scrollDampFactor) + 'px saat bentuk penuh',
      },
      {
        key: 'dampWeightLow',
        label: 'Peredam: mulai terasa pada intensitas m',
        min: 0,
        max: 0.99,
        step: 0.01,
        hint: (p) => 'm < ' + p.dampWeightLow.toFixed(2) + ' (lead, zoom in awal, zoom out akhir, trail) → scroll normal',
      },
      {
        key: 'dampWeightHigh',
        label: 'Peredam: penuh pada intensitas m',
        min: 0.01,
        max: 1,
        step: 0.01,
        hint: (p) =>
          'setara berat (tanpa batas 40%): desktop ≈ ' +
          Math.round(dampEquivalentVh(p.edgeLeadVh + BREAK_HEIGHT.desktop + p.edgeTrailVh, p)) +
          'vh · mobile ≈ ' +
          Math.round(dampEquivalentVh(p.edgeLeadVh + BREAK_HEIGHT.mobile + p.edgeTrailVh, p)) +
          'vh (tinggi jeda dari config; nilai panel di bawah)',
      },
      { key: 'edgeLeadVh', label: 'Tepi lead: zoom in mulai sebelum jeda (vh)', min: 0, max: 100, step: 5 },
      {
        key: 'edgeTrailVh',
        label: 'Tepi trail: zoom out selesai sesudah jeda (vh)',
        min: 0,
        max: 100,
        step: 5,
        hint: (p) => 'rentang animasi desktop ≈ ' + Math.round(p.edgeLeadVh + BREAK_HEIGHT.desktop + p.edgeTrailVh) + 'vh (tepi dibatasi 40% tinggi section)',
      },
    ],
  },
  {
    title: 'Fase di jeda',
    note: 'Fraksi progres atas rentang efektif (lead + jeda + trail): zoom in 0 → akhir bentuk, tahan → akhir tahan, lalu lepas + zoom out → 1.',
    specs: [
      { key: 'phaseFormEnd', label: 'Akhir zoom in / bentuk', min: 0.05, max: 0.9, step: 0.01 },
      {
        key: 'phaseHoldEnd',
        label: 'Akhir tahan',
        min: 0.06,
        max: 0.95,
        step: 0.01,
        hint: (p) =>
          'zoom in ' + pct(p.phaseFormEnd) + ' · tahan ' + pct(p.phaseHoldEnd - p.phaseFormEnd) + ' · lepas + zoom out ' + pct(1 - p.phaseHoldEnd) + ' dari rentang efektif',
      },
      {
        key: 'zoomEase',
        label: 'Easing zoom (0 = smoothstep, 1 = linear)',
        min: 0,
        max: 1,
        step: 0.05,
        hint: (p) => 'kemiringan di tengah ≈ ' + (1.5 - 0.5 * p.zoomEase).toFixed(2) + '× linear (1.00 = sebanding scroll)',
      },
    ],
  },
  {
    title: 'Bentuk',
    note: 'Bentuk selalu di tengah layar pada puncak zoom. Morph penuh butuh kecepatan − sebaran ≥ 1.',
    specs: [
      { key: 'shapeShare', label: 'Proporsi titik bentuk', min: 0.05, max: 1, step: 0.01 },
      { key: 'shapeSize', label: 'Tinggi bentuk (× tinggi viewport)', min: 0.1, max: 0.9, step: 0.01 },
      { key: 'shapeMaxWidth', label: 'Batas lebar bentuk (× lebar viewport)', min: 0.2, max: 1, step: 0.01 },
      { key: 'shapeSpin', label: 'Rotasi lokal (rad/s)', min: 0, max: 1.5, step: 0.01 },
      { key: 'shapeTiltY', label: 'Kemiringan Y (rad)', min: -3.14, max: 3.14, step: 0.01 },
      { key: 'shapeTiltX', label: 'Kemiringan X (rad)', min: -3.14, max: 3.14, step: 0.01 },
      { key: 'morphSpeed', label: 'Kecepatan morph', min: 0.5, max: 4, step: 0.05 },
      { key: 'delaySpread', label: 'Sebaran delay per titik', min: 0, max: 2, step: 0.05 },
    ],
  },
  {
    title: 'Kedalaman & efek zoom',
    note: 'Pulsa FOV dan streak: 0 = mati.',
    specs: [
      { key: 'depthSize', label: 'Ukuran dekat/jauh (kekuatan)', min: 0, max: 2, step: 0.05 },
      { key: 'depthOpacity', label: 'Opasitas dekat/jauh (kekuatan)', min: 0, max: 1, step: 0.05 },
      { key: 'depthRange', label: 'Jarak "paling jauh" (dunia)', min: 5, max: 80, step: 1 },
      { key: 'nearFade', label: 'Fade dekat kamera (dunia)', min: 0.2, max: 6, step: 0.1 },
      { key: 'sizeVariation', label: 'Variasi ukuran per titik (±)', min: 0, max: 0.9, step: 0.05 },
      { key: 'brightnessVariation', label: 'Variasi kecerahan per titik', min: 0, max: 0.9, step: 0.05 },
      { key: 'fovPulse', label: 'Pulsa FOV (derajat)', min: 0, max: 25, step: 0.5 },
      { key: 'streakStrength', label: 'Streak (per px/frame)', min: 0, max: 0.6, step: 0.01 },
    ],
  },
  {
    title: 'Pointer (canvas)',
    note: 'Satuan NDC: tinggi layar = 2. Tanpa efek saat reduced motion.',
    specs: [
      { key: 'parallaxStrength', label: 'Parallax: kemiringan maks. (rad)', min: 0, max: 0.2, step: 0.005 },
      { key: 'parallaxSmoothing', label: 'Parallax: kehalusan', min: 0.01, max: 0.5, step: 0.01 },
      { key: 'pushRadius', label: 'Dorong: radius', min: 0.02, max: 1, step: 0.01 },
      { key: 'pushStrength', label: 'Dorong: kekuatan', min: 0, max: 0.3, step: 0.005 },
      { key: 'pushShapeFactor', label: 'Dorong/riak pada bentuk (×)', min: 0, max: 1, step: 0.05 },
      { key: 'rippleSpeed', label: 'Riak: kecepatan', min: 0.1, max: 5, step: 0.05 },
      { key: 'rippleStrength', label: 'Riak: kekuatan', min: 0, max: 0.3, step: 0.005 },
      { key: 'rippleWidth', label: 'Riak: lebar gelombang', min: 0.02, max: 0.6, step: 0.01 },
      { key: 'rippleDamping', label: 'Riak: redaman (1/s)', min: 0.1, max: 6, step: 0.05 },
      { key: 'dragSensitivity', label: 'Drag putar: kepekaan (rad/px)', min: 0, max: 0.03, step: 0.001 },
      { key: 'dragInertia', label: 'Drag putar: inersia', min: 0, max: 0.99, step: 0.01 },
    ],
  },
  {
    title: 'Keterbacaan teks',
    note: 'Semua opasitas = OPASITAS EFEKTIF rata-rata titik setelah semua pengali (kedalaman, variasi, pointOpacity dinormalkan di shader). Menuju puncak jeda semuanya kembali penuh. Zona aman hanya desktop ≥ 1024px.',
    specs: [
      {
        key: 'readIntensity',
        label: 'Opasitas efektif: tepi / area tanpa teks',
        min: 0.05,
        max: 0.9,
        step: 0.01,
        hint: (p) => 'tepi ≈ ' + op(p.readIntensity) + ' · titik terbaik ≈ ' + op(Math.min(1, p.readIntensity * readStats(p).peakOverMean)) + ' · puncak jeda ≈ ' + op(readStats(p).mean),
      },
      {
        key: 'readIntensityMobile',
        label: 'Opasitas efektif: mobile (tanpa zona aman)',
        min: 0.05,
        max: 0.9,
        step: 0.01,
        hint: (p) => 'mobile ≈ ' + op(p.readIntensityMobile) + ' · titik terbaik ≈ ' + op(Math.min(1, p.readIntensityMobile * readStats(p).peakOverMean)),
      },
      {
        key: 'safeZoneFactor',
        label: 'Zona aman: pengali relatif thd tepi',
        min: 0.2,
        max: 1,
        step: 0.01,
        hint: (p) => 'tengah kolom ≈ ' + op(p.readIntensity * p.safeZoneFactor) + ' · tepi ≈ ' + op(p.readIntensity),
      },
      {
        key: 'readSize',
        label: 'Ukuran titik saat membaca (× normal)',
        min: 0.3,
        max: 1.5,
        step: 0.05,
        hint: (p) => 'ukuran ≈ ' + pct(p.readSize) + ' dari normal',
      },
      {
        key: 'readMaxPx',
        label: 'Batas ukuran titik dekat (px CSS)',
        min: 1,
        max: 12,
        step: 0.5,
        hint: (p) => 'batas ' + p.readMaxPx + ' px saat membaca → 9 px di puncak jeda',
      },
    ],
  },
  {
    title: 'Titik & field',
    note: 'Jumlah titik, radius, dan bias pusat → geometri dibangun ulang (jeda 300 ms).',
    specs: [
      { key: 'pointSize', label: 'Ukuran titik', min: 0.01, max: 0.3, step: 0.005 },
      { key: 'pointOpacity', label: 'Opasitas titik', min: 0.1, max: 1, step: 0.05 },
      { key: 'countDesktop', label: 'Jumlah (desktop)', min: 200, max: 40000, step: 500 },
      { key: 'countLowPower', label: 'Jumlah (perangkat lemah)', min: 200, max: 24000, step: 500 },
      { key: 'countMobile', label: 'Jumlah (mobile)', min: 200, max: 16000, step: 500 },
      { key: 'fieldRadius', label: 'Radius field (ketebalan volume)', min: 5, max: 80, step: 1 },
      { key: 'fieldCoreBias', label: 'Bias kerapatan ke pusat', min: 0, max: 1, step: 0.05 },
    ],
  },
]

/** Label arah zoom untuk dropdown. */
const DIRECTION_LABELS: Record<ZoomDirection, string> = {
  left: 'Kiri',
  right: 'Kanan',
  top: 'Atas',
  bottom: 'Bawah',
  'top-left': 'Kiri atas',
  'top-right': 'Kanan atas',
  'bottom-left': 'Kiri bawah',
  'bottom-right': 'Kanan bawah',
}

const isDirection = (value: unknown): value is ZoomDirection =>
  typeof value === 'string' && (ZOOM_DIRECTIONS as readonly string[]).includes(value)

const SCALAR_KEYS = GROUPS.flatMap((group) => group.specs.map((spec) => spec.key))

// ---------------------------------------------------------------------------
// Penyimpanan
// ---------------------------------------------------------------------------

function defaults(): PointFieldParams {
  return {
    ...POINTFIELD_DEFAULTS,
    yaw: [...POINTFIELD_DEFAULTS.yaw],
    pitch: [...POINTFIELD_DEFAULTS.pitch],
    zoomDirections: [...POINTFIELD_DEFAULTS.zoomDirections],
  }
}

/** Gabungkan nilai tersimpan dengan default; abaikan yang tidak valid. */
function sanitize(raw: unknown): PointFieldParams {
  const out = defaults()
  if (!raw || typeof raw !== 'object') return out
  const source = raw as Record<string, unknown>
  for (const key of SCALAR_KEYS) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  if (typeof source.scrollDamping === 'boolean') out.scrollDamping = source.scrollDamping
  for (const key of ['yaw', 'pitch'] as const) {
    const list = source[key]
    if (Array.isArray(list) && list.length === out[key].length && list.every((v) => typeof v === 'number' && Number.isFinite(v))) {
      out[key] = list as number[]
    }
  }
  const dirs = source.zoomDirections
  if (Array.isArray(dirs) && dirs.length === out.zoomDirections.length && dirs.every(isDirection)) out.zoomDirections = dirs
  return out
}

/** Warna baca dari tokens.css lewat CSSOM (lembar penimpa panel sendiri dilewati). */
function tokenReadColors(): ReadColors {
  const out: ReadColors = { light: [...FALLBACK_READ_COLORS.light], dark: [...FALLBACK_READ_COLORS.dark] }
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      if ((sheet.ownerNode as Element | null)?.id === OVERRIDE_STYLE_ID) continue
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue
        const selector = rule.selectorText.replace(/\s+/g, '')
        const theme: ThemeName | null =
          selector === ':root' ? 'light' : /^:root\[data-theme=["']?dark["']?\]$/.test(selector) ? 'dark' : null
        if (!theme) continue
        READ_TOKENS.forEach((token, i) => {
          const value = rule.style.getPropertyValue(token).trim().toLowerCase()
          if (HEX.test(value)) out[theme][i] = value
        })
      }
    }
  } catch {
    // pakai cadangan
  }
  return out
}

interface Extras {
  colors: ReadColors
  /** Scroll-snap aktif (default). Mati = style inline scroll-snap-type: none di <html>. */
  snap: boolean
  /** Tinggi jeda: desktop (vh) dan mobile (svh). Diterapkan langsung ke tiap [data-break]. */
  breakHeight: { desktop: number; mobile: number }
}

const BREAK_HEIGHT_RANGE = { min: 20, max: 300 }

function sanitizeExtras(raw: unknown, base: ReadColors): Extras {
  const extras: Extras = {
    colors: { light: [...base.light], dark: [...base.dark] },
    snap: true,
    breakHeight: { desktop: BREAK_HEIGHT.desktop, mobile: BREAK_HEIGHT.mobile },
  }
  if (!raw || typeof raw !== 'object') return extras
  const source = raw as Record<string, unknown>
  const colors = source.readColors as Record<string, unknown> | undefined
  for (const theme of THEMES) {
    const list = colors?.[theme]
    if (Array.isArray(list) && list.length === 3 && list.every((v) => typeof v === 'string' && HEX.test(v))) {
      extras.colors[theme] = list.map((v: string) => v.toLowerCase())
    }
  }
  if (source.snap === false) extras.snap = false
  const heights = source.breakHeight as Record<string, unknown> | undefined
  for (const key of ['desktop', 'mobile'] as const) {
    const value = heights?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      extras.breakHeight[key] = Math.min(BREAK_HEIGHT_RANGE.max, Math.max(BREAK_HEIGHT_RANGE.min, value))
    }
  }
  return extras
}

function loadSaved(base: ReadColors): { params: PointFieldParams; extras: Extras } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const json: unknown = JSON.parse(raw)
    return { params: sanitize(json), extras: sanitizeExtras(json, base) }
  } catch {
    return null
  }
}

function sameAsDefaults(params: PointFieldParams, extras: Extras, base: ReadColors): boolean {
  return (
    JSON.stringify(params) === JSON.stringify(defaults()) &&
    extras.snap &&
    extras.breakHeight.desktop === BREAK_HEIGHT.desktop &&
    extras.breakHeight.mobile === BREAK_HEIGHT.mobile &&
    JSON.stringify(extras.colors) === JSON.stringify(base)
  )
}

function persist(params: PointFieldParams, extras: Extras, base: ReadColors): void {
  try {
    if (sameAsDefaults(params, extras, base)) window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...params, readColors: extras.colors, snap: extras.snap, breakHeight: extras.breakHeight }))
  } catch {
    // Mode privat / storage diblokir: abaikan, nilai tetap berlaku sampai refresh.
  }
}

/** Pasang/lepas <style> yang menimpa token warna baca (hanya nilai yang berbeda dari tokens.css). */
function applyColorOverrides(colors: ReadColors, base: ReadColors): void {
  const block = (theme: ThemeName, selector: string) => {
    const decls = READ_TOKENS.map((token, i) => (colors[theme][i] !== base[theme][i] ? token + ':' + colors[theme][i] + ';' : '')).join('')
    return decls ? selector + '{' + decls + '}' : ''
  }
  const css = block('light', ':root') + block('dark', ":root[data-theme='dark']")
  let el = document.getElementById(OVERRIDE_STYLE_ID)
  if (!css) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('style')
    el.id = OVERRIDE_STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

/** Tinggi jeda langsung ke tiap [data-break] (inline style menimpa nilai dari Break.tsx). */
function applyBreakHeight(heights: Extras['breakHeight']): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-break]')) {
    el.style.setProperty('--break-h-desktop', heights.desktop + 'vh')
    el.style.setProperty('--break-h-mobile', heights.mobile + 'svh')
  }
  // Area snap section (scroll-margin-bottom di global.css) membaca variabel yang sama dari <html>.
  const root = document.documentElement.style
  root.setProperty('--break-h-desktop', heights.desktop + 'vh')
  root.setProperty('--break-h-mobile', heights.mobile + 'svh')
}

/** Saklar scroll-snap untuk pengujian: style inline mengalahkan aturan di global.css. */
function applySnap(on: boolean): void {
  if (on) document.documentElement.style.removeProperty('scroll-snap-type')
  else document.documentElement.style.setProperty('scroll-snap-type', 'none')
}

function clear(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // abaikan
  }
}

/** Bulatkan noise float (0.30000000000000004 → 0.3). */
const tidy = (value: number) => Number(value.toFixed(4))

/** Objek siap tempel ke src/config/pointfield.ts, plus warna baca (tokens.css) dan status snap. */
function toSource(params: PointFieldParams, extras: Extras): string {
  const lines = [`  scrollDamping: ${params.scrollDamping},`, ...SCALAR_KEYS.map((key) => `  ${key}: ${tidy(params[key])},`)]
  const list = (values: readonly number[]) => values.map(tidy).join(', ')
  const tokens = (theme: ThemeName) => READ_TOKENS.map((token, i) => '  ' + token + ': ' + extras.colors[theme][i] + ';')
  return [
    '// src/config/pointfield.ts',
    'export const POINTFIELD_DEFAULTS: Readonly<PointFieldParams> = Object.freeze({',
    ...lines,
    `  yaw: Object.freeze([${list(params.yaw)}]),`,
    `  pitch: Object.freeze([${list(params.pitch)}]),`,
    `  zoomDirections: Object.freeze([${params.zoomDirections.map((dir) => `'${dir}'`).join(', ')}] as const),`,
    '})',
    '',
    '/* src/styles/tokens.css: warna baca, tema Terang (:root) */',
    ...tokens('light'),
    "/* src/styles/tokens.css: warna baca, tema Gelap (:root[data-theme='dark']) */",
    ...tokens('dark'),
    '',
    '// src/config/pointfield.ts (konstanta; di config perlu reload halaman)',
    'export const BREAK_HEIGHT = { desktop: ' + tidy(extras.breakHeight.desktop) + ', mobile: ' + tidy(extras.breakHeight.mobile) + ' } as const',
    '',
    '// scroll-snap: ' + (extras.snap ? 'aktif' : 'MATI (hanya untuk pengujian; default di global.css tetap y proximity)'),
    '',
  ].join('\n')
}

function pickGeometry(params: PointFieldParams): Pick<PointFieldParams, (typeof GEOMETRY_KEYS)[number]> {
  const out = {} as Record<string, number>
  for (const key of GEOMETRY_KEYS) out[key] = params[key]
  return out as Pick<PointFieldParams, (typeof GEOMETRY_KEYS)[number]>
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function TunePanel({ engine }: { engine: PointFieldEngine }) {
  const uid = useId()
  // Nilai tokens.css dibaca sekali, sebelum lembar penimpa panel dipasang.
  const [base] = useState<ReadColors>(() => tokenReadColors())
  const [saved] = useState(() => loadSaved(base))
  const [params, setParams] = useState<PointFieldParams>(() => saved?.params ?? defaults())
  const [extras, setExtras] = useState<Extras>(() => saved?.extras ?? sanitizeExtras(null, base))
  const [open, setOpen] = useState(true)
  const [debug, setDebug] = useState<PointFieldDebug>(() => engine.debug())
  const [message, setMessage] = useState('')
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  const applied = useRef<PointFieldParams>(engine.getParams())
  const rebuildTimer = useRef(0)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  // Esc di dalam panel → ciutkan, fokus kembali ke tombol Ciutkan/Buka.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [])

  // Terapkan ke engine: parameter biasa langsung; parameter geometri dengan debounce.
  useEffect(() => {
    window.clearTimeout(rebuildTimer.current)
    const geometryChanged = GEOMETRY_KEYS.some((key) => params[key] !== applied.current[key])
    if (geometryChanged) {
      engine.setParams({ ...params, ...pickGeometry(applied.current) })
      rebuildTimer.current = window.setTimeout(() => {
        engine.setParams(params)
        applied.current = params
      }, REBUILD_DELAY)
    } else {
      engine.setParams(params)
      applied.current = params
    }
  }, [engine, params])

  // Warna baca per tema dan snap. Dibongkar saat panel ditutup (efek di bawah).
  useEffect(() => {
    applyColorOverrides(extras.colors, base)
    engine.refreshColors()
  }, [engine, extras.colors, base])

  useEffect(() => {
    applySnap(extras.snap)
  }, [extras.snap])

  // Tinggi jeda berubah → ukur ulang posisi jeda di engine.
  useEffect(() => {
    applyBreakHeight(extras.breakHeight)
    engine.measure()
  }, [engine, extras.breakHeight])

  useEffect(() => {
    persist(params, extras, base)
  }, [params, extras, base])

  useEffect(
    () => () => {
      window.clearTimeout(rebuildTimer.current)
      document.getElementById(OVERRIDE_STYLE_ID)?.remove()
      applySnap(true)
      applyBreakHeight({ desktop: BREAK_HEIGHT.desktop, mobile: BREAK_HEIGHT.mobile })
    },
    [],
  )

  // Indikator posisi.
  useEffect(() => {
    const timer = window.setInterval(() => setDebug(engine.debug()), 150)
    return () => window.clearInterval(timer)
  }, [engine])

  const setScalar = (key: ScalarKey, value: number) => {
    if (Number.isFinite(value)) setParams((current) => ({ ...current, [key]: value }))
  }
  const setAngle = (key: AngleKey, index: number, value: number) => {
    if (!Number.isFinite(value)) return
    setParams((current) => {
      const list = [...current[key]]
      list[index] = value
      return { ...current, [key]: list }
    })
  }

  const setDirection = (index: number, value: string) => {
    if (!isDirection(value)) return
    setParams((current) => {
      const zoomDirections = [...current.zoomDirections]
      zoomDirections[index] = value
      return { ...current, zoomDirections }
    })
  }

  const setReadColor = (theme: ThemeName, index: number, value: string) => {
    if (!HEX.test(value)) return
    setExtras((current) => {
      const list = [...current.colors[theme]]
      list[index] = value.toLowerCase()
      return { ...current, colors: { ...current.colors, [theme]: list } }
    })
  }

  const reset = () => {
    clear()
    setParams(defaults())
    setExtras(sanitizeExtras(null, base))
    setManualCopy(null)
    setMessage('Direset ke default.')
  }

  const copy = async () => {
    const text = toSource(params, extras)
    try {
      await navigator.clipboard.writeText(text)
      setManualCopy(null)
      setMessage('Nilai disalin. Tempel ke src/config/pointfield.ts.')
    } catch {
      setManualCopy(text)
      setMessage('Clipboard diblokir: salin manual dari kotak di bawah.')
    }
  }

  const bodyId = `${uid}-body`
  const position =
    debug.kind === 'break'
      ? `jeda ${debug.index + 1} (${BREAK_SHAPES[debug.index] ?? '?'}, zoom ${params.zoomDirections[debug.index] ?? '?'})`
      : debug.kind === 'section'
        ? `section ${debug.index + 1} (${SECTION_IDS[debug.index] ?? '?'})`
        : '–'

  return (
    <section ref={panelRef} aria-label="Panel tuning titik 3D (dev)" className="tp">
      <div className="tp-head">
        <h2 className="tp-title">
          Tuning titik 3D <small>dev</small>
        </h2>
        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="tp-btn"
        >
          {open ? 'Ciutkan' : 'Buka'}
        </button>
      </div>

      {/* Indikator posisi selalu terlihat, juga saat diciutkan. */}
      <p className="tp-status">
        <span className="tp-muted">Posisi:</span> elemen {debug.item} · {position}
        <br />
        <span className="tp-muted">T</span> {debug.T.toFixed(3)} → {debug.target.toFixed(3)} ·{' '}
        <span className="tp-muted">fase</span> {debug.phase} · <span className="tp-muted">m</span> {debug.morph.toFixed(2)} ·{' '}
        <span className="tp-muted">opasitas efektif</span> {debug.effective.toFixed(2)}
        {debug.safeZone.on && <span className="tp-muted"> · zona aman</span>}
        {' · '}
        <span className="tp-muted">bentuk</span> {debug.shape >= 0 ? BREAK_SHAPES[debug.shape] : '–'}
        {' · '}
        <span className="tp-muted">peredam</span>{' '}
        {debug.damp.enabled ? '×' + debug.damp.factor.toFixed(2) + (debug.damp.active ? ' jalan' : '') : debug.damp.navigating ? 'navigasi' : 'mati'}
        <br />
        <span className="tp-muted">N</span> {debug.count} ({debug.device}) · <span className="tp-muted">FOV</span> {debug.fov.toFixed(1)}°
        {' · '}
        <span className="tp-muted">pusat bentuk</span> {debug.shapeNdc[0].toFixed(2)}, {debug.shapeNdc[1].toFixed(2)}
        {' · '}
        <span className="tp-muted">pointer</span> {debug.pointer.toFixed(2)} · <span className="tp-muted">riak</span> {debug.ripples}
        {debug.dragging && <span className="tp-accent"> · drag</span>}
        {debug.reducedMotion && <span className="tp-accent"> · reduced motion: statis</span>}
      </p>

      <div id={bodyId} hidden={!open} className="tp-body">
        {GROUPS.map((group) => (
          <fieldset key={group.title} className="tp-group">
            <legend className="tp-legend">{group.title}</legend>
            {group.note && <p className="tp-note">{group.note}</p>}
            {group.specs.map((spec) => {
              const id = `${uid}-${spec.key}`
              const value = params[spec.key]
              return (
                <div key={spec.key} className="tp-row">
                  <label htmlFor={id}>{spec.label}</label>
                  <input
                    type="number"
                    aria-label={`${spec.label}, angka`}
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    value={tidy(value)}
                    onChange={(event) => setScalar(spec.key, event.target.valueAsNumber)}
                    className="tp-num"
                  />
                  <input
                    id={id}
                    type="range"
                    min={spec.min}
                    max={spec.max}
                    step={spec.step}
                    value={value}
                    onChange={(event) => setScalar(spec.key, event.target.valueAsNumber)}
                    className="tp-range"
                  />
                  {spec.hint && <span className="tp-hint">{spec.hint(params)}</span>}
                </div>
              )
            })}
          </fieldset>
        ))}

        <fieldset className="tp-group">
          <legend className="tp-legend">Tinggi jeda &amp; peredam roda</legend>
          <p className="tp-note">
            Tinggi diterapkan langsung (inline di tiap jeda) dan tersimpan di panel; nilai di config (BREAK_HEIGHT) baru berlaku
            setelah menempel dan reload halaman. Jeda sengaja tanpa titik snap dan tanpa gerbang.
          </p>
          <p className="tp-note">
            Setara berat total (∫ 1/faktor sepanjang lead + jeda + trail; target ±300–380vh): desktop ≈{' '}
            {Math.round(dampEquivalentVh(params.edgeLeadVh + extras.breakHeight.desktop + params.edgeTrailVh, params))}vh dari{' '}
            {Math.round(params.edgeLeadVh + extras.breakHeight.desktop + params.edgeTrailVh)}vh · mobile ≈{' '}
            {Math.round(dampEquivalentVh(params.edgeLeadVh + extras.breakHeight.mobile + params.edgeTrailVh, params))}vh dari{' '}
            {Math.round(params.edgeLeadVh + extras.breakHeight.mobile + params.edgeTrailVh)}vh. Terukur di layar ini (dengan batas 40%
            section): {debug.dampEquivVh.length ? Math.round(Math.min(...debug.dampEquivVh)) + '–' + Math.round(Math.max(...debug.dampEquivVh)) : '–'}vh
            {debug.kind === 'break' && debug.dampEquivVh[debug.index] !== undefined
              ? ' (jeda ini ' + Math.round(debug.dampEquivVh[debug.index]) + 'vh)'
              : ''}
            {params.scrollDamping ? '' : ' · peredam MATI: setara = rentang'}.
          </p>
          <div className="tp-row tp-colors">
            <label htmlFor={uid + '-damp'}>Peredam roda di zona jeda aktif</label>
            <input
              id={uid + '-damp'}
              type="checkbox"
              checked={params.scrollDamping}
              onChange={(event) => setParams((current) => ({ ...current, scrollDamping: event.target.checked }))}
            />
          </div>
          {(['desktop', 'mobile'] as const).map((key) => (
            <div key={key} className="tp-row">
              <label htmlFor={uid + '-bh-' + key}>{key === 'desktop' ? 'Desktop (vh, ≥ 768px)' : 'Mobile (svh, < 768px)'}</label>
              <input
                id={uid + '-bh-' + key}
                type="number"
                min={BREAK_HEIGHT_RANGE.min}
                max={BREAK_HEIGHT_RANGE.max}
                step={5}
                value={extras.breakHeight[key]}
                onChange={(event) => {
                  const value = event.target.valueAsNumber
                  if (Number.isFinite(value)) {
                    setExtras((current) => ({ ...current, breakHeight: { ...current.breakHeight, [key]: Math.min(BREAK_HEIGHT_RANGE.max, Math.max(BREAK_HEIGHT_RANGE.min, value)) } }))
                  }
                }}
                className="tp-num"
              />
            </div>
          ))}
        </fieldset>

        <fieldset className="tp-group">
          <legend className="tp-legend">Warna baca per tema &amp; snap</legend>
          <p className="tp-note">
            Token --titik-baca-1..3: warna jenuh (bukan pucat), dicampur ke warna penuh menuju puncak jeda. Jangan sama/dekat
            dengan warna teks atau latar; cek setelah menempel ke tokens.css: node scripts/check-reading-contrast.mjs
          </p>
          {THEMES.map((theme) => (
            <div key={theme} className="tp-row tp-colors">
              <span>{THEME_LABEL[theme]}</span>
              {extras.colors[theme].map((color, i) => (
                <input
                  key={READ_TOKENS[i]}
                  type="color"
                  value={color}
                  aria-label={'Warna baca ' + (i + 1) + ', tema ' + THEME_LABEL[theme] + ' (' + color + ')'}
                  title={color}
                  onChange={(event) => setReadColor(theme, i, event.target.value)}
                  className="tp-color"
                />
              ))}
            </div>
          ))}
          <div className="tp-row tp-colors">
            <label htmlFor={uid + '-snap'}>Scroll-snap (y proximity)</label>
            <input
              id={uid + '-snap'}
              type="checkbox"
              checked={extras.snap}
              onChange={(event) => setExtras((current) => ({ ...current, snap: event.target.checked }))}
            />
          </div>
        </fieldset>

        <table className="tp-table">
          <caption className="tp-caption">Per section: yaw / pitch netral (rad) + arah zoom di jeda sesudahnya</caption>
          <thead>
            <tr>
              <th scope="col">Section</th>
              <th scope="col">Arah zoom</th>
              <th scope="col">Yaw</th>
              <th scope="col">Pitch</th>
            </tr>
          </thead>
          <tbody>
            {params.yaw.map((yaw, i) => (
              <tr key={SECTION_IDS[i] ?? i} className={debug.kind !== null && debug.index === i ? 'is-current' : undefined}>
                <th scope="row">
                  {i + 1}. {SECTION_IDS[i]}
                </th>
                <td>
                  {i < params.zoomDirections.length ? (
                    <select
                      aria-label={`Arah zoom jeda ${i + 1} (${BREAK_SHAPES[i]}), sesudah section ${i + 1}`}
                      value={params.zoomDirections[i]}
                      onChange={(event) => setDirection(i, event.target.value)}
                      className="tp-select"
                    >
                      {ZOOM_DIRECTIONS.map((dir) => (
                        <option key={dir} value={dir}>
                          {DIRECTION_LABELS[dir]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="tp-muted">–</span>
                  )}
                </td>
                {(['yaw', 'pitch'] as const).map((key) => (
                  <td key={key}>
                    <input
                      type="number"
                      step={0.05}
                      aria-label={`${key === 'yaw' ? 'Yaw' : 'Pitch'} section ${i + 1} (${SECTION_IDS[i]})`}
                      value={tidy(key === 'yaw' ? yaw : params.pitch[i])}
                      onChange={(event) => setAngle(key, i, event.target.valueAsNumber)}
                      className="tp-num"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="tp-actions">
          <button type="button" onClick={copy} className="tp-btn">
            Salin nilai
          </button>
          <button type="button" onClick={reset} className="tp-btn">
            Reset
          </button>
        </div>
        <output className="tp-msg">{message}</output>
        {manualCopy && (
          <textarea
            readOnly
            aria-label="Nilai config untuk disalin manual"
            value={manualCopy}
            rows={8}
            onFocus={(event) => event.currentTarget.select()}
            className="tp-manual"
          />
        )}
      </div>
    </section>
  )
}
