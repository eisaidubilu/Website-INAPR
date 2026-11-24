/**
 * Generator data titik: field bola volume tebal + 7 bentuk (urutan = jeda 1..7).
 * Rumus bentuk dari prototipe (landing-prototype.html). Bentuk disimpan dalam koordinat
 * LOKAL (belum diskalakan/dimiringkan); skala, kemiringan, rotasi, dan posisi (titik fokus
 * zoom) dihitung di engine/shader dari uniform, jadi mengubahnya tidak membangun ulang geometri.
 *
 * Semua acak memakai PRNG seeded (GEOMETRY_SEED): posisi dan pilihan titik bentuk
 * sama di setiap kunjungan dan konsisten antar frame.
 * Dijalankan saat engine dibuat dan saat parameter geometri berubah (panel tuning).
 */
import { GEOMETRY_SEED, type PointFieldParams } from '@/config/pointfield'

type GeometryParams = Pick<PointFieldParams, 'fieldRadius' | 'fieldCoreBias'>

/** Jumlah bentuk = jumlah jeda (1..7). */
export const SHAPE_COUNT = 7

/** Radius nominal bentuk lokal (dipakai untuk menskalakan bentuk ke ukuran layar). */
export const SHAPE_BASE_RADIUS = 1.6

const TAU = Math.PI * 2
const HELIX_SPAN = 12.566 // 4π, dua putaran
/** Condong cincin torus (radian, sumbu X lokal) agar lubangnya terbuka ke penonton. */
const TORUS_LEAN = 0.55

type Vec3 = [number, number, number]

/** mulberry32: PRNG kecil dan cepat, cukup untuk sebaran visual. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface PointData {
  /** Posisi bintang diam (atribut position); revolusi dihitung di shader. */
  field: Float32Array
  /** Delay morph per titik di [0, 1]. */
  delay: Float32Array
  /** Indeks warna per titik: 0 = titik-1, 1 = titik-2, 2 = titik-3. */
  palette: Float32Array
  /** Penentu titik bentuk di [0, 1): titik bentuk bila select < shapeShare. */
  select: Float32Array
  /** Variasi acak kecepatan revolusi per titik di [-1, 1]. */
  spin: Float32Array
  /** Fase gerak halus per titik di [0, 2π). */
  phase: Float32Array
  /** Seed acak per titik di [0, 1): variasi ukuran dan kecerahan di shader. */
  seed: Float32Array
  /** Posisi lokal tiap bentuk. */
  shapes: Float32Array[]
}

/**
 * Pembangun data titik yang bisa diisi bertahap: `fill(from, to)` mengisi titik [from, to) dan HARUS dipanggil
 * berurutan tanpa celah (PRNG seeded dikonsumsi per titik, jadi urutan = hasil). Dipakai oleh buildPointData
 * (sekali jalan) dan buildPointDataAsync (diiris supaya tidak jadi satu tugas panjang): hasil keduanya identik.
 */
function createBuilder(n: number, params: GeometryParams): { data: PointData; fill(from: number, to: number): void } {
  const random = seeded(GEOMETRY_SEED)
  const rnd = (a: number, b: number) => a + random() * (b - a)
  /** Titik acak seragam di segitiga ABC. */
  const tri = (out: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 => {
    const r1 = Math.sqrt(random())
    const r2 = random()
    for (let i = 0; i < 3; i++) out[i] = (1 - r1) * a[i] + r1 * (1 - r2) * b[i] + r1 * r2 * c[i]
    return out
  }

  const { fieldRadius, fieldCoreBias } = params
  // Eksponen radius: 1/3 = volume merata; lebih besar = lebih padat di pusat (banyak lapisan
  // titik dekat dan jauh di jalur kamera saat zoom in).
  const radiusExponent = 1 / 3 + 0.25 * Math.min(1, Math.max(0, fieldCoreBias))
  const field = new Float32Array(n * 3)
  const delay = new Float32Array(n)
  const palette = new Float32Array(n)
  const select = new Float32Array(n)
  const spin = new Float32Array(n)
  const phase = new Float32Array(n)
  const seed = new Float32Array(n)
  const shapes = Array.from({ length: SHAPE_COUNT }, () => new Float32Array(n * 3))
  const [cube, sphere, torus, pyramid, cylinder, octahedron, helix] = shapes

  const golden = Math.PI * (3 - Math.sqrt(5))
  const apex: Vec3 = [0, 1.5, 0]
  const base: Vec3[] = [
    [-1.25, -1.1, -1.25],
    [1.25, -1.1, -1.25],
    [1.25, -1.1, 1.25],
    [-1.25, -1.1, 1.25],
  ]
  const tmp: Vec3 = [0, 0, 0]

  function fill(from: number, to: number): void {
    for (let i = from; i < to; i++) {
      const k = i * 3

      // Field: bola volume radius fieldRadius, kerapatan condong ke pusat (radiusExponent).
      const fr = fieldRadius * random() ** radiusExponent
      const fu = random() * 2 - 1
      const fphi = random() * TAU
      const fsq = Math.sqrt(1 - fu * fu)
      field[k] = fr * fsq * Math.cos(fphi)
      field[k + 1] = fr * fu
      field[k + 2] = fr * fsq * Math.sin(fphi)
      delay[i] = random()
      select[i] = random()
      spin[i] = random() * 2 - 1
      phase[i] = random() * TAU
      seed[i] = random()
      // Pola warna prototipe: tiap ke-7 titik-2, tiap ke-3 titik-3, sisanya titik-1.
      palette[i] = i % 7 === 0 ? 1 : i % 3 === 0 ? 2 : 0

      // 0 Kubus: titik di salah satu dari 6 sisi.
      const face = Math.floor(random() * 6)
      const u = rnd(-1, 1)
      const v = rnd(-1, 1)
      const c: Vec3 =
        face === 0 ? [1, u, v]
        : face === 1 ? [-1, u, v]
        : face === 2 ? [u, 1, v]
        : face === 3 ? [u, -1, v]
        : face === 4 ? [u, v, 1]
        : [u, v, -1]
      cube[k] = c[0] * 1.15
      cube[k + 1] = c[1] * 1.15
      cube[k + 2] = c[2] * 1.15

      // 1 Bola: spiral Fibonacci (merata di permukaan).
      const y = 1 - (i / Math.max(1, n - 1)) * 2
      const ring = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = golden * i
      sphere[k] = Math.cos(theta) * ring * 1.4
      sphere[k + 1] = y * 1.4
      sphere[k + 2] = Math.sin(theta) * ring * 1.4

      // 2 Torus.
      const ta = rnd(0, TAU)
      const tb = rnd(0, TAU)
      const R = 1.05
      const rr = 0.48
      // Cincin simetris terhadap putaran bentuk, jadi dicondongkan di data lokalnya
      // (TORUS_LEAN) supaya lubangnya terbuka dan terbaca sebagai cincin, bukan kapsul.
      const tx = (R + rr * Math.cos(tb)) * Math.cos(ta)
      const ty = rr * Math.sin(tb)
      const tz = (R + rr * Math.cos(tb)) * Math.sin(ta)
      torus[k] = tx
      torus[k + 1] = ty * Math.cos(TORUS_LEAN) - tz * Math.sin(TORUS_LEAN)
      torus[k + 2] = ty * Math.sin(TORUS_LEAN) + tz * Math.cos(TORUS_LEAN)

      // 3 Piramid: 22% di alas, sisanya di 4 sisi segitiga.
      const q = random()
      if (q < 0.22) {
        pyramid[k] = rnd(-1.25, 1.25)
        pyramid[k + 1] = -1.1
        pyramid[k + 2] = rnd(-1.25, 1.25)
      } else {
        const side = Math.floor(((q - 0.22) / 0.78) * 4) % 4
        tri(tmp, apex, base[side], base[(side + 1) % 4])
        pyramid[k] = tmp[0]
        pyramid[k + 1] = tmp[1]
        pyramid[k + 2] = tmp[2]
      }

      // 4 Silinder: 78% selimut, sisanya dua tutup.
      const ang = rnd(0, TAU)
      if (random() < 0.78) {
        cylinder[k] = Math.cos(ang) * 0.95
        cylinder[k + 1] = rnd(-1.25, 1.25)
        cylinder[k + 2] = Math.sin(ang) * 0.95
      } else {
        const rd = Math.sqrt(random()) * 0.95
        const cap = random() < 0.5 ? -1.25 : 1.25
        cylinder[k] = Math.cos(ang) * rd
        cylinder[k + 1] = cap
        cylinder[k + 2] = Math.sin(ang) * rd
      }

      // 5 Oktahedron: salah satu dari 8 sisi segitiga.
      const sx = random() < 0.5 ? -1 : 1
      const sy = random() < 0.5 ? -1 : 1
      const sz = random() < 0.5 ? -1 : 1
      tri(tmp, [sx * 1.7, 0, 0], [0, sy * 1.7, 0], [0, 0, sz * 1.7])
      octahedron[k] = tmp[0]
      octahedron[k + 1] = tmp[1]
      octahedron[k + 2] = tmp[2]

      // 6 Heliks ganda: 82% di dua untai, sisanya di "anak tangga".
      if (random() < 0.82) {
        const t = rnd(0, HELIX_SPAN)
        const strand = i % 2 ? Math.PI : 0
        helix[k] = Math.cos(t + strand) * 0.8
        helix[k + 1] = (t / HELIX_SPAN - 0.5) * 3.2
        helix[k + 2] = Math.sin(t + strand) * 0.8
      } else {
        const t = rnd(0, HELIX_SPAN)
        const m = rnd(0, 1)
        const x1 = Math.cos(t) * 0.8
        const z1 = Math.sin(t) * 0.8
        helix[k] = x1 + -2 * x1 * m
        helix[k + 1] = (t / HELIX_SPAN - 0.5) * 3.2
        helix[k + 2] = z1 + -2 * z1 * m
      }
    }

  }

  return { data: { field, delay, palette, select, spin, phase, seed, shapes }, fill }
}

export function buildPointData(n: number, params: GeometryParams): PointData {
  const builder = createBuilder(n, params)
  builder.fill(0, n)
  return builder.data
}

export interface AsyncBuildOptions {
  /** Titik per irisan sebelum memberi giliran ke thread utama. */
  chunk?: number
  /** Beri giliran ke thread utama (input, render) di antara irisan. */
  yieldToMain: () => Promise<void>
  /** true = berhenti (komponen dilepas); hasilnya null. */
  shouldAbort?: () => boolean
}

/** Titik per irisan bawaan: ±1,5 ms di 1x, ±6 ms di CPU 4x (terukur), jauh di bawah ambang tugas panjang (50 ms). */
const DEFAULT_CHUNK = 2500

/**
 * Sama dengan buildPointData, tetapi diiris: tiap `chunk` titik memberi giliran ke thread utama. Hasil
 * (semua buffer) identik byte demi byte dengan buildPointData karena urutan konsumsi PRNG tidak berubah.
 */
export async function buildPointDataAsync(
  n: number,
  params: GeometryParams,
  options: AsyncBuildOptions,
): Promise<PointData | null> {
  const builder = createBuilder(n, params)
  const chunk = Math.max(1, options.chunk ?? DEFAULT_CHUNK)
  for (let from = 0; from < n; from += chunk) {
    if (options.shouldAbort?.()) return null
    builder.fill(from, Math.min(n, from + chunk))
    if (from + chunk < n) await options.yieldToMain()
  }
  return options.shouldAbort?.() ? null : builder.data
}
