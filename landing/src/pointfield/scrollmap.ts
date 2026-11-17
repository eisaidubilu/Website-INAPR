/**
 * Pemetaan scroll → keadaan jeda/bentuk. Tanpa alokasi per frame: hasil ditulis ke
 * objek `out`.
 *
 * Urutan scroll = urutan DOM dari [data-section] (section 1..8) dan [data-break] (jeda
 * pendek di antara section). Skalar T = indeks elemen + progres di dalamnya, diukur dari
 * titik tengah layar. Section selalu netral (tanpa bentuk); bentuk hanya ada di jeda.
 */
import type { PointFieldParams } from '@/config/pointfield'

type MapParams = Pick<PointFieldParams, 'phaseFormEnd' | 'phaseHoldEnd' | 'yaw' | 'pitch'>

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

/** Batas fase yang aman: [akhir bentuk-terbentuk, akhir tahan], keduanya di 0.05..0.95. */
export function phaseBounds(params: Pick<PointFieldParams, 'phaseFormEnd' | 'phaseHoldEnd'>): [number, number] {
  const form = Math.min(0.9, Math.max(0.05, params.phaseFormEnd))
  const hold = Math.min(0.95, Math.max(form + 0.01, params.phaseHoldEnd))
  return [form, hold]
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
  out.intensity = f < form ? smoothstep(0, form, f) : f <= hold ? 1 : 1 - smoothstep(hold, 1, f)
  out.hold = Math.min(1, Math.max(0, (f - form) / (hold - form)))
  out.releasing = f > hold
  return out
}
