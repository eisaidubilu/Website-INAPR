/**
 * Pemetaan scroll → keadaan jeda/bentuk. Tanpa alokasi per frame: hasil ditulis ke
 * objek `out`.
 *
 * Urutan scroll = urutan DOM dari [data-section] (section 1..8) dan [data-break] (jeda
 * pendek di antara section). Skalar T = indeks elemen + progres di dalamnya, diukur dari
 * titik tengah layar. Section selalu netral (tanpa bentuk); bentuk hanya ada di jeda.
 * Engine memberi rentang EFEKTIF (extendBreaks): jeda + lead/trail ke tepi section, jadi
 * "jeda" di sini mencakup tepi itu dan "section" hanya bagian netralnya.
 */
import type { PointFieldParams } from '@/config/pointfield'

type MapParams = Pick<PointFieldParams, 'phaseFormEnd' | 'phaseHoldEnd' | 'zoomEase' | 'yaw' | 'pitch'>

/** Satu elemen urutan scroll: section (indeks data-section) atau jeda (indeks data-break). */
export interface SeqItem {
  el: HTMLElement
  kind: 'section' | 'break'
  index: number
}

export interface FrameState {
  /** Posisi di urutan (indeks elemen aktif) dan progres di dalamnya (0..1). */
  item: number
  progress: number
  /** Arah pandang netral (yaw/pitch): berputar pelan di dalam section, tetap di jeda. */
  yaw: number
  pitch: number
  /** Indeks bentuk (= data-break 0..6) bila di jeda, -1 di section. */
  shape: number
  /** Intensitas bentuk dari scroll (0 = bintang + netral, 1 = bentuk utuh + zoom-in penuh). */
  intensity: number
  /** Progres fase tahan (0..1), untuk drift kamera. 0.5 di luar fase tahan. */
  hold: number
  /** Sedang di fase LEPAS + ZOOM OUT. */
  releasing: boolean
}

export function createFrameState(params: Pick<PointFieldParams, 'yaw' | 'pitch'>): FrameState {
  return { item: 0, progress: 0, yaw: params.yaw[0], pitch: params.pitch[0], shape: -1, intensity: 0, hold: 0.5, releasing: false }
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Easing fase masuk/lepas: campuran smoothstep dan linear. k = 0 smoothstep murni, k = 1 linear.
 * Tengah hampir linear (kemiringan 1 + 0,5·(1−k)) tapi ujung tetap melandai bila k < 1.
 */
export function easeZoom(t: number, k: number): number {
  const x = Math.min(1, Math.max(0, t))
  const smooth = x * x * (3 - 2 * x)
  return smooth + (x - smooth) * Math.min(1, Math.max(0, k))
}

/** Batas fase yang aman: [akhir bentuk-terbentuk, akhir tahan], keduanya di 0.05..0.95. */
export function phaseBounds(params: Pick<PointFieldParams, 'phaseFormEnd' | 'phaseHoldEnd'>): [number, number] {
  const form = Math.min(0.9, Math.max(0.05, params.phaseFormEnd))
  const hold = Math.min(0.95, Math.max(form + 0.01, params.phaseHoldEnd))
  return [form, hold]
}

type PhaseParams = Pick<PointFieldParams, 'phaseFormEnd' | 'phaseHoldEnd' | 'zoomEase'>
type DampParams = PhaseParams & Pick<PointFieldParams, 'scrollDampFactor' | 'dampWeightLow' | 'dampWeightHigh'>

/**
 * Intensitas jeda m (0..1) dari progres f atas rentang efektif (lead + jeda + trail):
 * ZOOM IN 0..form (eased), TAHAN form..hold (1), LEPAS hold..1 (eased). Dipakai computeFrame
 * dan profil peredam, jadi keduanya selalu sama.
 */
export function breakIntensity(f: number, params: PhaseParams): number {
  const [form, hold] = phaseBounds(params)
  const x = Math.min(1, Math.max(0, f))
  return x < form ? easeZoom(x / form, params.zoomEase) : x <= hold ? 1 : 1 - easeZoom((x - hold) / (1 - hold), params.zoomEase)
}

/** Bobot peredam w = smoothstep(dampWeightLow, dampWeightHigh, m): 0 sebelum bentuk solid, 1 saat bentuk terlihat. */
export function dampWeight(m: number, params: Pick<PointFieldParams, 'dampWeightLow' | 'dampWeightHigh'>): number {
  const low = Math.min(0.99, Math.max(0, params.dampWeightLow))
  const high = Math.min(1, Math.max(low + 0.01, params.dampWeightHigh))
  return smoothstep(low, high, m)
}

/** Faktor peredam pada progres f jeda: lerp(1, scrollDampFactor, w(m)). 1 di kedua ujung rentang. */
export function dampFactorAtProgress(f: number, params: DampParams): number {
  const inner = Math.min(1, Math.max(0.05, params.scrollDampFactor))
  return lerp(1, inner, dampWeight(breakIntensity(f, params), params))
}

/**
 * Faktor peredam di posisi tengah viewport `mid` (px dokumen), atas rentang EFEKTIF
 * (outTops/outHeights dari extendBreaks). Di luar rentang jeda: 1. Kontinu di batas rentang
 * (m = 0 di kedua ujung → w = 0 → faktor 1).
 */
export function dampFactorAt(
  mid: number,
  seq: readonly Pick<SeqItem, 'kind'>[],
  effTops: Float64Array,
  effHeights: Float64Array,
  params: DampParams,
): number {
  for (let i = 0; i < seq.length; i++) {
    if (seq[i].kind !== 'break') continue
    const start = effTops[i]
    if (mid >= start && mid < start + effHeights[i]) return dampFactorAtProgress((mid - start) / effHeights[i], params)
  }
  return 1
}

/**
 * "Setara berat total" (vh): jarak roda yang dibutuhkan untuk melewati satu rentang jeda sepanjang
 * spanVh = ∫ 1/faktor (aturan titik tengah). Tanpa peredam = spanVh.
 */
export function dampEquivalentVh(spanVh: number, params: DampParams, steps = 512): number {
  let sum = 0
  for (let i = 0; i < steps; i++) sum += 1 / dampFactorAtProgress((i + 0.5) / steps, params)
  return (spanVh * sum) / steps
}

/**
 * Rentang efektif urutan scroll (partisi tanpa celah/tumpang tindih), ditulis ke outTops/outHeights:
 * tiap jeda melebar `leadPx` ke akhir section sebelumnya dan `trailPx` ke awal section sesudahnya
 * (masing-masing paling banyak maxFraction × tinggi section itu); section menyusut sebanyak itu.
 * Dengan begitu progres jeda (dan fasenya) dihitung atas lead + jeda + trail, section tetap netral
 * di luar rentang itu, dan rotasi pandang section baru mulai setelah trail selesai. 0 = tanpa tepi.
 */
export function extendBreaks(
  seq: readonly Pick<SeqItem, 'kind'>[],
  tops: Float64Array,
  heights: Float64Array,
  leadPx: number,
  trailPx: number,
  maxFraction: number,
  outTops: Float64Array,
  outHeights: Float64Array,
): void {
  const n = seq.length
  const frac = Math.min(0.45, Math.max(0, maxFraction))
  const lead = Math.max(0, leadPx)
  const trail = Math.max(0, trailPx)
  // outHeights menampung posisi AKHIR tiap elemen dulu, lalu dikonversi ke tinggi di bawah.
  for (let i = 0; i < n; i++) {
    outTops[i] = tops[i]
    outHeights[i] = tops[i] + heights[i]
  }
  for (let i = 0; i < n; i++) {
    if (seq[i].kind !== 'break') continue
    if (i > 0 && seq[i - 1].kind === 'section') {
      outTops[i] = tops[i] - Math.min(lead, frac * heights[i - 1])
      outHeights[i - 1] = outTops[i]
    }
    if (i < n - 1 && seq[i + 1].kind === 'section') {
      outHeights[i] = tops[i] + heights[i] + Math.min(trail, frac * heights[i + 1])
      outTops[i + 1] = outHeights[i]
    }
  }
  for (let i = 0; i < n; i++) outHeights[i] = Math.max(1, outHeights[i] - outTops[i])
}

/**
 * Skalar scroll target: i + progres di elemen ke-i, diukur dari titik tengah layar.
 * `tops`/`heights` adalah posisi absolut (dokumen) tiap elemen urutan.
 */
export function scrollTarget(tops: Float64Array, heights: Float64Array, count: number): number {
  if (count === 0) return 0
  // Tinggi viewport stabil: clientHeight <html> (initial containing block) tidak ikut
  // berubah saat bar alamat mobile menyusut/muncul, berbeda dengan innerHeight.
  const viewport = document.documentElement.clientHeight || window.innerHeight
  const mid = window.scrollY + viewport / 2
  if (mid <= tops[0]) return 0
  for (let i = 0; i < count; i++) {
    if (mid < tops[i] + heights[i]) return i + Math.max(0, (mid - tops[i]) / heights[i])
  }
  return count - 0.001
}

/** Keadaan jeda/bentuk untuk skalar T yang sudah dihaluskan. */
export function computeFrame(T: number, seq: readonly SeqItem[], out: FrameState, params: MapParams): FrameState {
  const { yaw, pitch } = params
  const i = Math.max(0, Math.min(seq.length - 1, Math.floor(T)))
  const f = Math.min(1, Math.max(0, T - i))
  const item = seq[i]
  out.item = i
  out.progress = f
  out.hold = 0.5
  out.releasing = false

  if (!item || item.kind === 'section') {
    // Section: netral, hanya bintang. Arah pandang berputar pelan selama section dibaca,
    // dari yang berlaku di akhir section sebelumnya ke miliknya, jadi tidak ada lompatan
    // di perbatasan dan zoom out di jeda tidak ikut berputar (hanya membalik jalur zoom in).
    const k = item ? Math.min(item.index, yaw.length - 1) : 0
    const t = k === 0 ? 0 : smoothstep(0.05, 0.95, f)
    out.yaw = lerp(yaw[Math.max(0, k - 1)], yaw[k], t)
    out.pitch = lerp(pitch[Math.max(0, k - 1)], pitch[k], t)
    out.shape = -1
    out.intensity = 0
    return out
  }

  // Jeda g (antara section g dan g+1). ZOOM IN 0..form, TAHAN form..hold, LEPAS hold..1.
  // Arah pandang netral tetap milik section g sepanjang jeda: zoom in dan zoom out memakai
  // pose netral yang sama, jadi zoom out membalik jalur zoom in.
  const g = Math.min(item.index, yaw.length - 1)
  const [form, hold] = phaseBounds(params)
  out.yaw = yaw[g]
  out.pitch = pitch[g]
  out.shape = item.index
  out.intensity = breakIntensity(f, params)
  out.hold = Math.min(1, Math.max(0, (f - form) / (hold - form)))
  out.releasing = f > hold
  return out
}
