/**
 * Engine titik 3D.
 *
 * - Bintang berputar terus (revolusi galaksi) di GPU: per frame hanya uniform uTime yang
 *   berubah untuk gerak ini. Loop berjalan selama tab terlihat (kecuali reduced motion).
 * - Satu skalar scroll T yang dihaluskan memetakan urutan [data-section]/[data-break] ke
 *   intensitas bentuk I. Section selalu netral (I = 0, hanya bintang); di tiap jeda:
 *   ZOOM IN + bentuk terbentuk → TAHAN → LEPAS + ZOOM OUT. I menggerakkan morph titik
 *   bentuk DAN posisi kamera pada jalurnya, jadi keduanya selalu sinkron.
 * - ARAH ZOOM (kiri/kanan/atas/bawah/sudut) per jeda bukan posisi bentuk di layar, melainkan
 *   ke mana kamera menyimpang: titik fokus C = arah zoom × zoomReach dari pusat field.
 *   Kamera bergerak di kurva Bézier kuadratik dari pose netral (jarak cameraFar, melihat
 *   pusat field) ke pose puncak (jarak cameraNear dari C, melihat C), sementara titik
 *   pandangnya berpindah dari pusat ke C. Bentuk terbentuk di C, jadi pada puncak zoom ia
 *   selalu tepat di tengah layar, dan aliran titik di layar berlawanan arah zoom.
 * - Interaksi pointer (listener pasif di window; canvas tetap pointer-events: none):
 *   parallax kamera, medan dorong kursor, dan riak klik/tap. Dorong dan riak dihitung di
 *   GPU dari uniform posisi pointer dan slot riak (maks. 3), tanpa simulasi.
 * - Drag mouse di area kosong saat bentuk tampil memutar bentuk (trackball di sumbu layar,
 *   dengan inersia). Rotasi digabung ke uniform uShapeRot; tanpa alokasi per frame.
 * - Kesan kedalaman dan streak dihitung di shader. Engine hanya memberi matriks view-proyeksi
 *   frame sebelumnya (kecepatan layar tiap titik) dan pulsa FOV dari kecepatan zoom.
 * - Posisi bentuk tujuan (aTarget) di-upload ulang hanya saat ganti bentuk, dan hanya
 *   ketika bentuk lama sudah lepas penuh (I = 0).
 * - Keterbacaan teks: engine hanya mengirim uniform. uPeak = smoothstep(intensitas jeda m)
 *   (0 saat membaca, 1 di puncak jeda); shader menurunkan opasitas/ukuran/warna titik saat
 *   membaca. Zona aman = rect kolom konten (px layar → NDC x), diukur di measure() sehingga
 *   ikut diperbarui saat resize, font, dan bahasa; tidak dipakai di bawah SAFE_ZONE.minWidth.
 * - Tanpa alokasi per frame. Semua parameter dari src/config/pointfield.ts; setParams()
 *   menerapkannya langsung (dipakai panel tuning dev).
 *
 * Modul ini di-import secara dinamis oleh <PointField /> supaya three.js tidak
 * memperberat bundle awal.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Euler,
  Matrix3,
  Matrix4,
  PerspectiveCamera,
  Points,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
} from 'three'
import {
  COLOR_TOKENS,
  FOV,
  GEOMETRY_KEYS,
  MAX_PIXEL_RATIO,
  MAX_POINT_PX,
  POINTER,
  POINTFIELD_DEFAULTS,
  READ_COLOR_TOKENS,
  SAFE_ZONE,
  SETTLE,
  ZOOM_FX,
  type PointFieldParams,
  type ZoomDirection,
} from '@/config/pointfield'
import { buildPointData, SHAPE_BASE_RADIUS, type PointData } from './geometry'
import { computeFrame, createFrameState, lerp, phaseBounds, scrollTarget, type SeqItem } from './scrollmap'
import { fragmentShader, vertexShader } from './shaders'

export type DeviceKind = 'desktop' | 'lowPower' | 'mobile'

/** Posisi saat ini, untuk indikator di panel tuning. */
export interface PointFieldDebug {
  /** Skalar scroll yang dihaluskan dan targetnya. */
  T: number
  target: number
  /** Indeks elemen di urutan scroll + jenis dan indeks data-section/data-break-nya. */
  item: number
  kind: 'section' | 'break' | null
  index: number
  /** Fase di jeda aktif ('–' di section). */
  phase: 'masuk' | 'tahan' | 'lepas' | '–'
  /** Intensitas bentuk yang ditampilkan 0..1 (morph + zoom). */
  morph: number
  /** Bentuk yang sedang dimuat di aTarget (-1 = belum ada). */
  shape: number
  /** Pusat bentuk di layar (NDC -1..1, x ke kanan, y ke atas) dari kamera saat ini; ≈ (0, 0) pada puncak zoom. */
  shapeNdc: [number, number]
  count: number
  device: DeviceKind
  /** FOV kamera saat ini (derajat), termasuk pulsa zoom. */
  fov: number
  /** Keaktifan pointer 0..1 (parallax + medan dorong) dan jumlah riak aktif. */
  pointer: number
  ripples: number
  /** Sedang memutar bentuk dengan drag mouse. */
  dragging: boolean
  reducedMotion: boolean
  /** Naik setiap kali geometri dibangun (untuk memastikan ganti tema tidak membangun ulang). */
  geometryVersion: number
  /** Warna titik saat ini (hex), untuk memeriksa transisi tema. */
  colors: string[]
  /** Warna baca saat ini (hex). */
  readColors: string[]
  /** Intensitas keterbacaan saat ini: I = lerp(readIntensity, 1, uPeak). */
  readI: number
  /** Puncak jeda ter-ease (0 = membaca, 1 = puncak). */
  peak: number
  /** Zona aman: aktif/tidak dan rect kolom konten (px layar). */
  safeZone: { on: boolean; left: number; right: number }
}

export interface PointFieldEngine {
  /** Ukur ulang posisi section/jeda (mis. setelah ganti bahasa). */
  measure(): void
  /** Baca ulang warna titik dari CSS variables (setelah ganti tema). */
  refreshColors(): void
  /** Terapkan parameter baru. Geometri dibangun ulang bila parameter geometri berubah. */
  setParams(next: PointFieldParams): void
  getParams(): PointFieldParams
  /** Proyeksi titik dunia dengan kamera saat ini: [NDC x, NDC y, kedalaman] (untuk pengujian arah aliran). */
  project(x: number, y: number, z: number): [number, number, number]
  debug(): PointFieldDebug
  destroy(): void
}

interface PointFieldOptions {
  /** Dipanggil bila WebGL hilang di tengah jalan (context lost) atau render gagal. */
  onFail(): void
  params?: PointFieldParams
}

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
/** T dianggap sampai bila selisihnya di bawah ini (≈ <1px pada elemen setinggi layar). */
const SETTLE_EPSILON = 0.0005
/** Durasi frame acuan untuk smoothing (smoothing = faktor per frame 60 fps). */
const FRAME_MS = 1000 / 60
/** Batas dt per frame: setelah tab kembali / jank, waktu dan T tidak melonjak. */
const MAX_DT_MS = 50
/**
 * Bila T tertinggal lebih dari ini (dalam jumlah elemen) dari posisi scroll (mis. tombol
 * End, resize besar, lompatan instan), T langsung disamakan: tidak memutar melewati
 * banyak bentuk dalam sekejap.
 */
const JUMP_ELEMENTS = 1.5
/** Scroll dianggap selesai bila tidak ada event scroll selama ini (fallback scrollend). */
const SCROLL_IDLE_MS = 150
/** Batas aman mode navigasi (bila scroll tidak pernah dimulai/selesai). */
const NAV_MAX_MS = 2500
/** Durasi transisi warna titik saat tema berganti. */
const COLOR_FADE_MS = 200
/** Intensitas di bawah ini dianggap lepas (boleh ganti bentuk): morph ≈ 0, tak terlihat. */
const RELEASED = 0.03

/** Cek dukungan WebGL2 tanpa membiarkan three.js mencetak error ke console. */
function supportsWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

function matches(query: string): boolean {
  try {
    return window.matchMedia(query).matches
  } catch {
    return false
  }
}

/** Jenis perangkat (menentukan jumlah titik) dan batas pixel ratio. Ditentukan sekali. */
function pickDevice(): { device: DeviceKind; pixelRatioCap: number } {
  const small = window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 600
  const coarse = matches('(pointer: coarse)')
  const nav = navigator as Navigator & { deviceMemory?: number }
  const lowPower = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory ?? 8) <= 4
  return {
    device: small ? 'mobile' : lowPower ? 'lowPower' : 'desktop',
    pixelRatioCap: small || coarse ? MAX_PIXEL_RATIO.mobile : MAX_PIXEL_RATIO.desktop,
  }
}

function countFor(device: DeviceKind, params: PointFieldParams): number {
  const raw = device === 'mobile' ? params.countMobile : device === 'lowPower' ? params.countLowPower : params.countDesktop
  return Math.max(16, Math.round(raw))
}

/** Arah zoom di sumbu layar: x = -1 kiri / 1 kanan, y = 1 atas / -1 bawah. */
function zoomX(direction: ZoomDirection): number {
  return direction.endsWith('left') ? -1 : direction.endsWith('right') ? 1 : 0
}
function zoomY(direction: ZoomDirection): number {
  return direction.startsWith('top') ? 1 : direction.startsWith('bottom') ? -1 : 0
}

/** Mengembalikan null bila WebGL tidak tersedia atau renderer gagal dibuat. */
export function createPointField(host: HTMLElement, options: PointFieldOptions): PointFieldEngine | null {
  if (!supportsWebGL()) return null

  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  canvas.style.cssText = 'display:block;width:100%;height:100%'
  host.appendChild(canvas)

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    canvas.remove()
    return null
  }
  renderer.setClearColor(0x000000, 0)

  let params: PointFieldParams = options.params ?? POINTFIELD_DEFAULTS
  const { device, pixelRatioCap } = pickDevice()

  // ---- Data titik ----
  let count = 0
  let data: PointData
  let targetArray: Float32Array
  let targetAttribute: BufferAttribute
  let geometry: BufferGeometry
  /** Bentuk yang sedang dimuat di aTarget (-1 = belum ada). */
  let currentShape = -1

  let geometryVersion = 0
  function buildGeometry(): BufferGeometry {
    geometryVersion++
    count = countFor(device, params)
    data = buildPointData(count, params)
    const next = new BufferGeometry()
    next.setAttribute('position', new BufferAttribute(data.field, 3))
    const shape = Math.max(0, currentShape)
    targetArray = new Float32Array(data.shapes[shape])
    targetAttribute = new BufferAttribute(targetArray, 3)
    targetAttribute.setUsage(DynamicDrawUsage)
    next.setAttribute('aTarget', targetAttribute)
    next.setAttribute('aDelay', new BufferAttribute(data.delay, 1))
    next.setAttribute('aPalette', new BufferAttribute(data.palette, 1))
    next.setAttribute('aSelect', new BufferAttribute(data.select, 1))
    next.setAttribute('aSpin', new BufferAttribute(data.spin, 1))
    next.setAttribute('aPhase', new BufferAttribute(data.phase, 1))
    next.setAttribute('aSeed', new BufferAttribute(data.seed, 1))
    return next
  }
  geometry = buildGeometry()

  // 0..2 = warna penuh (COLOR_TOKENS), 3..5 = warna baca (READ_COLOR_TOKENS).
  const ALL_COLOR_TOKENS = [...COLOR_TOKENS, ...READ_COLOR_TOKENS] as const
  const makeColors = () => ALL_COLOR_TOKENS.map(() => new Color())
  const colors = makeColors()
  const uniforms = {
    uTime: { value: 0 },
    uFieldRadius: { value: params.fieldRadius },
    uRevSpeed: { value: params.revolutionSpeed },
    uRevCore: { value: params.revolutionCoreBoost },
    uRevVar: { value: params.revolutionVariation },
    uRevTilt: { value: new Matrix3() },
    uWobble: { value: params.wobbleAmplitude },
    uWobbleSpeed: { value: params.wobbleSpeed },
    uShapeShare: { value: params.shapeShare },
    uShapeCenter: { value: new Vector3() },
    uShapeRot: { value: new Matrix3() },
    uShapeScale: { value: 1 },
    uMorph: { value: 0 },
    uMorphSpeed: { value: params.morphSpeed },
    uDelaySpread: { value: params.delaySpread },
    uSize: { value: params.pointSize },
    uSizeMax: { value: MAX_POINT_PX },
    uScale: { value: 1 },
    uAspect: { value: 1 },
    uTanHalfFov: { value: Math.tan((FOV.wide * Math.PI) / 360) },
    uPointer: { value: new Vector2() },
    uPointerActive: { value: 0 },
    uPushRadius: { value: params.pushRadius },
    uPushStrength: { value: params.pushStrength },
    uPushShape: { value: params.pushShapeFactor },
    // w = amplitudo; 0 = slot kosong (Vector4 bawaan three.js ber-w 1, jadi diisi eksplisit).
    uRipples: { value: [new Vector4(0, 0, 0, 0), new Vector4(0, 0, 0, 0), new Vector4(0, 0, 0, 0)] },
    uRippleSpeed: { value: params.rippleSpeed },
    uRippleStrength: { value: params.rippleStrength },
    uRippleWidth: { value: params.rippleWidth },
    uRippleDamping: { value: params.rippleDamping },
    uDepthSize: { value: params.depthSize },
    uDepthOpacity: { value: params.depthOpacity },
    uDepthRange: { value: params.depthRange },
    uNearFade: { value: params.nearFade },
    uSizeVar: { value: params.sizeVariation },
    uBrightVar: { value: params.brightnessVariation },
    // View-proyeksi frame sebelumnya → kecepatan layar tiap titik (streak).
    uPrevViewProj: { value: new Matrix4() },
    uResolution: { value: new Vector2(1, 1) },
    uFrameScale: { value: 1 },
    uStreak: { value: params.streakStrength },
    uStreakMax: { value: ZOOM_FX.streakMax },
    uOpacity: { value: params.pointOpacity },
    uColor1: { value: colors[0] },
    uColor2: { value: colors[1] },
    uColor3: { value: colors[2] },
    uReadColor1: { value: colors[3] },
    uReadColor2: { value: colors[4] },
    uReadColor3: { value: colors[5] },
    uPeak: { value: 0 },
    uReadI: { value: params.readIntensity },
    uReadSize: { value: params.readSize },
    uReadMax: { value: params.readMaxPx },
    uSafeX: { value: new Vector2(0, 0) },
    uSafeOn: { value: 0 },
    uSafeFactor: { value: params.safeZoneFactor },
    uSafeFeather: { value: 0.1 },
  }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  const scene = new Scene()
  scene.add(points)
  const camera = new PerspectiveCamera(FOV.wide, 1, 0.1, 120)

  // Objek kerja (dipakai ulang, tanpa alokasi per frame).
  const worldUp = new Vector3(0, 1, 0)
  const vOrbit = new Vector3()
  const vForward = new Vector3()
  const vRight = new Vector3()
  const vUp = new Vector3()
  /** Arah zoom (dunia, satuan), titik fokus = pusat bentuk, dan titik-titik jalur kamera. */
  const vZoomDir = new Vector3()
  const vFocus = new Vector3()
  const vNeutral = new Vector3()
  const vPeak = new Vector3()
  const vControl = new Vector3()
  const vDelta = new Vector3()
  const vLat = new Vector3()
  const vLook = new Vector3()
  /** View-proyeksi frame sebelumnya (uniform uPrevViewProj). */
  const prevViewProj = uniforms.uPrevViewProj.value
  const euler = new Euler()
  const matrix = new Matrix4()
  const dragMatrix = new Matrix4()
  /** Rotasi hasil drag pengguna (di-reset saat ganti bentuk) + langkah rotasi per frame. */
  const dragRotation = new Quaternion()
  const dragStep = new Quaternion()
  const vScreenUp = new Vector3()
  const vScreenRight = new Vector3()

  // ---- Urutan scroll dari DOM ----
  const seq: SeqItem[] = Array.from(
    document.querySelectorAll<HTMLElement>('[data-section], [data-break]'),
    (el): SeqItem => {
      const isBreak = el.dataset.break !== undefined
      return { el, kind: isBreak ? 'break' : 'section', index: Number(isBreak ? el.dataset.break : el.dataset.section) }
    },
  )
  const tops = new Float64Array(seq.length)
  const heights = new Float64Array(seq.length)
  const mat = host.closest<HTMLElement>('main')

  const state = createFrameState(params)
  let reduce = matches(REDUCED_MOTION)
  let T = 0
  /** Detik animasi (revolusi, rotasi bentuk). Maju hanya saat loop jalan; dt dibatasi. */
  let time = 0
  /** Intensitas bentuk yang ditampilkan (morph + zoom), mengejar intensitas dari scroll. */
  let intensity = 0
  let anchorDirty = true
  /** FOV dasar (menurut lebar layar) dan tambahan pulsa zoom (derajat), dihaluskan. */
  let baseFov: number = FOV.wide
  let fovKick = 0
  /** Intensitas frame sebelumnya (kecepatan zoom). */
  let prevIntensity = 0
  /** true = frame ini tanpa streak (loop baru mulai, lompatan, resize). */
  let resetPrev = true
  let raf = 0
  let destroyed = false
  let contextLost = false
  /** Perlu render ulang walau tidak ada gerak (reduced motion: resize, tema, ganti bentuk). */
  let dirty = true
  let width = 0
  let height = 0
  let pixelRatio = 0
  let matOffset = Number.NaN
  /** Waktu frame sebelumnya; 0 = loop baru mulai (dt acuan dipakai). */
  let lastTime = 0
  /** Waktu event scroll terakhir (untuk menyelesaikan bentuk setengah jadi saat diam). */
  let lastScrollAt = 0
  /** Navigasi anchor jauh: T ditahan di elemen tujuan sampai scroll native selesai. */
  let navigating = false
  let navIdleTimer = 0
  let navMaxTimer = 0
  /** Indeks elemen tujuan navigasi (lihat onClick). */
  let navIndex = 0
  /** Transisi warna tema: dari → ke, mulai (ms) atau -1 bila tidak aktif. */
  const colorFrom = makeColors()
  const colorTo = makeColors()
  let colorStart = -1
  /** Posisi scroll terakhir yang diukur dengan tata letak lama (jangkar saat resize). */
  let lastTarget = -1
  let viewWidth = document.documentElement.clientWidth
  let viewHeight = document.documentElement.clientHeight

  // ---- Pointer (ditulis oleh listener, dibaca sekali per frame) ----
  /** Posisi pointer terakhir (NDC) dan posisi yang dihaluskan untuk dorong/parallax. */
  let pointerX = 0
  let pointerY = 0
  let pushX = 0
  let pushY = 0
  let parallaxX = 0
  let parallaxY = 0
  /** Keaktifan pointer 0..1 (memudar setelah POINTER.idleMs tanpa gerak). */
  let pointerActivity = 0
  let lastPointerAt = -Infinity
  let pointerInside = false
  let pointerTouch = false
  let touching = false
  let touchStartX = 0
  let touchStartY = 0
  let touchStartAt = 0
  let touchLastX = 0
  let touchLastY = 0
  let rippleSlot = 0
  // ---- Drag putar bentuk (mouse/pen) ----
  let dragging = false
  let dragLastX = 0
  let dragLastY = 0
  /** Pergeseran pointer (px) sejak frame terakhir, dan kecepatan sudut (rad per frame 60 fps). */
  let dragDeltaX = 0
  let dragDeltaY = 0
  let dragVelX = 0
  let dragVelY = 0
  /** Pointer terakhir berada di area kosong yang boleh di-drag; kelas kursor di <html>. */
  let hoverDraggable = false
  let cursorClass = ''

  /** Uniform yang hanya bergantung pada parameter (bukan per frame). */
  function applyParamUniforms(): void {
    uniforms.uFieldRadius.value = Math.max(0.001, params.fieldRadius)
    uniforms.uRevSpeed.value = params.revolutionSpeed
    uniforms.uRevCore.value = params.revolutionCoreBoost
    uniforms.uRevVar.value = params.revolutionVariation
    uniforms.uWobble.value = params.wobbleAmplitude
    uniforms.uWobbleSpeed.value = params.wobbleSpeed
    uniforms.uShapeShare.value = params.shapeShare
    uniforms.uMorphSpeed.value = params.morphSpeed
    uniforms.uDelaySpread.value = params.delaySpread
    uniforms.uOpacity.value = params.pointOpacity
    uniforms.uSize.value = params.pointSize * (pixelRatio || 1)
    uniforms.uPushRadius.value = Math.max(0.001, params.pushRadius)
    uniforms.uPushStrength.value = params.pushStrength
    uniforms.uPushShape.value = params.pushShapeFactor
    uniforms.uRippleSpeed.value = params.rippleSpeed
    uniforms.uRippleStrength.value = params.rippleStrength
    uniforms.uRippleWidth.value = Math.max(0.001, params.rippleWidth)
    uniforms.uRippleDamping.value = Math.max(0.01, params.rippleDamping)
    uniforms.uDepthSize.value = params.depthSize
    uniforms.uDepthOpacity.value = params.depthOpacity
    uniforms.uDepthRange.value = Math.max(1, params.depthRange)
    uniforms.uNearFade.value = Math.max(0.2, params.nearFade)
    uniforms.uSizeVar.value = params.sizeVariation
    uniforms.uBrightVar.value = params.brightnessVariation
    uniforms.uReadI.value = Math.min(1, Math.max(0, params.readIntensity))
    uniforms.uReadSize.value = Math.max(0, params.readSize)
    uniforms.uReadMax.value = Math.max(0.5, params.readMaxPx) * (pixelRatio || 1)
    uniforms.uSafeFactor.value = Math.min(1, Math.max(0, params.safeZoneFactor))
    euler.set(params.revolutionTiltX, 0, params.revolutionTiltZ, 'XYZ')
    uniforms.uRevTilt.value.setFromMatrix4(matrix.makeRotationFromEuler(euler))
  }
  applyParamUniforms()

  /** Baca warna token ke `out`. Bila token kosong, warna sebelumnya dipertahankan. */
  function readColors(out: readonly Color[] = colors): void {
    const style = getComputedStyle(document.documentElement)
    ALL_COLOR_TOKENS.forEach((token, i) => {
      const value = style.getPropertyValue(token).trim()
      if (value) out[i].setStyle(value)
    })
  }

  /** Ganti tema: warna titik memudar ±200ms (instan bila reduced motion). Geometri tetap. */
  function fadeColors(): void {
    if (reduce) {
      readColors()
      colorStart = -1
      return
    }
    for (let i = 0; i < colors.length; i++) colorFrom[i].copy(colors[i])
    readColors(colorTo)
    colorStart = performance.now()
  }

  /** Mengembalikan true bila transisi warna masih berjalan. */
  function stepColors(now: number): boolean {
    if (colorStart < 0) return false
    const p = Math.min(1, (now - colorStart) / COLOR_FADE_MS)
    const eased = 1 - (1 - p) ** 2
    for (let i = 0; i < colors.length; i++) colors[i].copy(colorFrom[i]).lerp(colorTo[i], eased)
    if (p >= 1) colorStart = -1
    return colorStart >= 0
  }

  /** Kolom konten (px layar, tanpa padding gutter): kotak isi Container section pertama. */
  let safeLeft = 0
  let safeRight = 0

  function measureSafeZone(): void {
    const container = seq.find((item) => item.kind === 'section')?.el.firstElementChild
    if (container instanceof HTMLElement) {
      const rect = container.getBoundingClientRect()
      const style = getComputedStyle(container)
      safeLeft = rect.left + (parseFloat(style.paddingLeft) || 0)
      safeRight = rect.right - (parseFloat(style.paddingRight) || 0)
    } else {
      safeLeft = 0
      safeRight = 0
    }
    applySafeZone()
  }

  /** Px layar → NDC x untuk shader. Mati di bawah SAFE_ZONE.minWidth (mobile) atau tanpa kolom. */
  function applySafeZone(): void {
    const w = width || host.clientWidth
    const on = w >= SAFE_ZONE.minWidth && safeRight > safeLeft
    uniforms.uSafeOn.value = on ? 1 : 0
    if (!w) return
    uniforms.uSafeX.value.set((safeLeft / w) * 2 - 1, (safeRight / w) * 2 - 1)
    uniforms.uSafeFeather.value = (SAFE_ZONE.feather / w) * 2
  }

  function measure(): void {
    const y = window.scrollY
    for (let i = 0; i < seq.length; i++) {
      const rect = seq[i].el.getBoundingClientRect()
      tops[i] = rect.top + y
      heights[i] = rect.height || 1
    }
    measureSafeZone()
    dirty = true
  }

  function resize(): boolean {
    const w = host.clientWidth || window.innerWidth
    const h = host.clientHeight || window.innerHeight
    const ratio = Math.min(window.devicePixelRatio || 1, pixelRatioCap)
    if (w === width && h === height && ratio === pixelRatio) return false
    width = w
    height = h
    pixelRatio = ratio
    renderer.setPixelRatio(ratio)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    baseFov = w < FOV.narrowBelow ? FOV.narrow : FOV.wide
    camera.fov = baseFov + fovKick
    camera.updateProjectionMatrix()
    uniforms.uResolution.value.set(w, h)
    resetPrev = true
    uniforms.uSize.value = params.pointSize * ratio
    uniforms.uSizeMax.value = MAX_POINT_PX * ratio
    uniforms.uReadMax.value = Math.max(0.5, params.readMaxPx) * ratio
    applySafeZone()
    uniforms.uScale.value = h * 0.5
    uniforms.uAspect.value = camera.aspect
    uniforms.uTanHalfFov.value = Math.tan((camera.fov * Math.PI) / 360)
    anchorDirty = true
    return true
  }

  /** Titik di orbit (yaw, pitch) pada jarak `distance` dari pusat field, ditulis ke `out`. */
  function orbitPoint(out: Vector3, yaw: number, pitch: number, distance: number): Vector3 {
    const cp = Math.cos(pitch)
    return out.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp).multiplyScalar(distance)
  }

  /**
   * Titik fokus zoom (pusat bentuk) dan arah zoom dunia untuk jeda `shape`, plus skala
   * bentuk. Arah zoom d = kombinasi sumbu layar kanan/atas pada pose netral section
   * sebelum jeda (yaw/pitch[shape]); fokus C = d × zoomReach dari pusat field. Skala:
   * tinggi bentuk pada jarak cameraNear = shapeSize × tinggi viewport (dibatasi
   * shapeMaxWidth × lebar), jadi bentuk menempati ±40–50% layar pada puncak zoom.
   * Reduced motion: kamera statis, bentuk di tengah layar pada jarak cameraNear di depannya.
   */
  function computeAnchor(shape: number): void {
    anchorDirty = false
    if (shape < 0 || width === 0) return
    const near = Math.max(1, params.cameraNear)
    if (reduce) {
      orbitPoint(vOrbit, params.yaw[0], params.pitch[0], 1)
      uniforms.uShapeCenter.value.copy(vOrbit).multiplyScalar(params.cameraFar - near)
    } else {
      const k = Math.min(shape, params.yaw.length - 1)
      const direction = params.zoomDirections[shape] ?? 'right'
      // Sumbu layar pada pose netral: kanan = maju × atas, atas = kanan × maju.
      orbitPoint(vOrbit, params.yaw[k], params.pitch[k], 1)
      vForward.copy(vOrbit).negate()
      vRight.crossVectors(vForward, worldUp).normalize()
      vUp.crossVectors(vRight, vForward)
      vZoomDir.copy(vRight).multiplyScalar(zoomX(direction)).addScaledVector(vUp, zoomY(direction))
      if (vZoomDir.lengthSq() > 0) vZoomDir.normalize()
      vFocus.copy(vZoomDir).multiplyScalar(params.zoomReach)
      uniforms.uShapeCenter.value.copy(vFocus)
    }
    const diameterPx = Math.min(params.shapeSize * height, params.shapeMaxWidth * width)
    const worldPerPx = (2 * near * Math.tan((baseFov * Math.PI) / 360)) / height
    uniforms.uShapeScale.value = (diameterPx * 0.5 * worldPerPx) / SHAPE_BASE_RADIUS
  }

  /**
   * Pose kamera untuk intensitas `e` (0 = netral, 1 = puncak zoom). Netral: orbit
   * (neutralYaw, neutralPitch) di jarak cameraFar, melihat pusat field. Puncak: orbit
   * (peakYaw, peakPitch) di jarak cameraNear dari titik fokus C, melihat C. Posisi di
   * antaranya = Bézier kuadratik netral → kontrol → puncak; titik pandang = e × C.
   * Titik kontrol memisahkan gerak sepanjang arah zoom (lateral) dari gerak maju:
   * pathCurve 0 = lurus, 1 = maju dulu lalu menyimpang ke arah zoom (jalur melengkung).
   */
  function placeCamera(neutralYaw: number, neutralPitch: number, e: number, peakYaw: number, peakPitch: number): void {
    orbitPoint(vNeutral, neutralYaw, neutralPitch, params.cameraFar)
    if (e <= 0.0005 || currentShape < 0) {
      camera.position.copy(vNeutral)
      vLook.set(0, 0, 0)
    } else {
      orbitPoint(vPeak, peakYaw, peakPitch, Math.max(1, params.cameraNear)).add(vFocus)
      vDelta.subVectors(vPeak, vNeutral)
      vLat.copy(vZoomDir).multiplyScalar(vZoomDir.dot(vDelta))
      vDelta.sub(vLat)
      const c = Math.min(1, Math.max(0, params.pathCurve))
      vControl
        .copy(vNeutral)
        .addScaledVector(vDelta, lerp(0.5, 0.8, c))
        .addScaledVector(vLat, lerp(0.5, 0.1, c))
      const u = 1 - e
      camera.position.set(0, 0, 0)
      camera.position.addScaledVector(vNeutral, u * u)
      camera.position.addScaledVector(vControl, 2 * u * e)
      camera.position.addScaledVector(vPeak, e * e)
      vLook.copy(vFocus).multiplyScalar(e)
    }
    camera.up.copy(worldUp)
    camera.lookAt(vLook)
  }

  /** Muat bentuk ke aTarget. Hanya dipanggil saat bentuk lama sudah lepas penuh. */
  function setShape(index: number): void {
    if (index === currentShape || !data.shapes[index]) return
    targetArray.set(data.shapes[index])
    targetAttribute.needsUpdate = true
    currentShape = index
    anchorDirty = true
    // Bentuk baru mulai dari orientasi dasarnya.
    dragRotation.identity()
    dragVelX = 0
    dragVelY = 0
  }

  /**
   * Rotasi lokal bentuk: kemiringan dasar + putaran pelan di sumbu vertikal bentuk, lalu
   * rotasi hasil drag pengguna (di sumbu layar) di atasnya.
   */
  function updateShapeRotation(): void {
    const spin = reduce ? 0 : time * params.shapeSpin
    euler.set(params.shapeTiltX, params.shapeTiltY + spin, 0, 'XYZ')
    matrix.makeRotationFromEuler(euler)
    if (!reduce) matrix.premultiply(dragMatrix.makeRotationFromQuaternion(dragRotation))
    uniforms.uShapeRot.value.setFromMatrix4(matrix)
  }

  /**
   * Drag putar: geser horizontal = putar di sumbu vertikal layar, geser vertikal = putar di
   * sumbu horizontal layar (trackball). Setelah dilepas, kecepatan meredam (dragInertia).
   */
  function stepDrag(step: number): void {
    let angleX: number
    let angleY: number
    if (dragging) {
      angleX = dragDeltaX * params.dragSensitivity
      angleY = dragDeltaY * params.dragSensitivity
      dragDeltaX = 0
      dragDeltaY = 0
      // Kecepatan per frame 60 fps (konsisten di 60/120 Hz) untuk inersia saat dilepas.
      dragVelX = angleX / Math.max(step, 0.25)
      dragVelY = angleY / Math.max(step, 0.25)
    } else {
      const keep = Math.min(0.999, Math.max(0, params.dragInertia)) ** step
      dragVelX *= keep
      dragVelY *= keep
      if (Math.abs(dragVelX) + Math.abs(dragVelY) < 0.00002) {
        dragVelX = 0
        dragVelY = 0
        return
      }
      angleX = dragVelX * step
      angleY = dragVelY * step
    }
    if (angleX === 0 && angleY === 0) return
    vScreenUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    vScreenRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
    dragRotation.premultiply(dragStep.setFromAxisAngle(vScreenUp, angleX))
    dragRotation.premultiply(dragStep.setFromAxisAngle(vScreenRight, angleY))
    dragRotation.normalize()
  }

  /** Area yang boleh memulai drag: latar kosong di dalam <main> (jeda), bukan isi section/kontrol. */
  function isDragSurface(target: EventTarget | null): boolean {
    if (!(target instanceof Element) || !target.closest('main')) return false
    return !target.closest(
      'a, button, input, select, textarea, label, summary, [contenteditable], [data-section]',
    )
  }

  function canDrag(): boolean {
    return !reduce && currentShape >= 0 && intensity >= POINTER.dragMinMorph
  }

  /** Kursor grab/grabbing di <html> (global.css), hanya diubah bila berbeda. */
  function updateCursor(): void {
    const next = dragging ? 'pf-grabbing' : hoverDraggable && canDrag() ? 'pf-grab' : ''
    if (next === cursorClass) return
    const root = document.documentElement
    if (cursorClass) root.classList.remove(cursorClass)
    if (next) root.classList.add(next)
    cursorClass = next
  }

  function updateMat(): void {
    if (!mat) return
    if (params.matParallax === 0) {
      if (!Number.isNaN(matOffset)) mat.style.removeProperty('--mat-offset')
      matOffset = Number.NaN
      return
    }
    const offset = Math.round(-window.scrollY * params.matParallax)
    if (offset !== matOffset) {
      mat.style.setProperty('--mat-offset', `${offset}px`)
      matOffset = offset
    }
  }

  /** Bentuk untuk mode gerak dikurangi: hanya di jeda (statis), section tanpa bentuk. */
  function reducedShape(): number {
    const item = seq[state.item]
    return item?.kind === 'break' ? item.index : -1
  }

  /** Posisi layar (px viewport) → NDC canvas. Canvas fixed di atas, selebar viewport. */
  function setPointer(clientX: number, clientY: number): void {
    const w = width || window.innerWidth
    const h = height || window.innerHeight
    pointerX = (clientX / w) * 2 - 1
    pointerY = 1 - (clientY / h) * 2
  }

  /** Riak baru di posisi pointer saat ini (slot bergilir, maks. POINTER.maxRipples). */
  function addRipple(): void {
    if (reduce) return
    const ripple = uniforms.uRipples.value[rippleSlot % POINTER.maxRipples]
    ripple.set(pointerX, pointerY, time, 1)
    rippleSlot = (rippleSlot + 1) % POINTER.maxRipples
    schedule()
  }

  /** Haluskan pointer per frame: keaktifan, posisi dorong, parallax; kosongkan riak yang selesai. */
  function stepPointer(now: number, step: number): void {
    const active = pointerTouch ? touching : pointerInside && now - lastPointerAt < POINTER.idleMs
    const fade = 1 - (1 - POINTER.fade) ** step
    pointerActivity += ((active ? 1 : 0) - pointerActivity) * fade
    if (pointerActivity < 0.001) {
      // Tidak aktif: posisi dorong langsung ikut pointer (tidak meluncur saat aktif lagi).
      pointerActivity = 0
      pushX = pointerX
      pushY = pointerY
    } else {
      const k = 1 - (1 - POINTER.pushSmoothing) ** step
      pushX += (pointerX - pushX) * k
      pushY += (pointerY - pushY) * k
    }
    // Parallax hanya untuk pointer mouse/pen (jari yang menggulir tidak memiringkan kamera).
    const strength = pointerTouch ? 0 : pointerActivity
    const kp = 1 - (1 - params.parallaxSmoothing) ** step
    parallaxX += (pointerX * strength - parallaxX) * kp
    parallaxY += (pointerY * strength - parallaxY) * kp
    uniforms.uPointer.value.set(pushX, pushY)
    uniforms.uPointerActive.value = pointerActivity
    const life = 6 / Math.max(0.01, params.rippleDamping)
    for (const ripple of uniforms.uRipples.value) {
      if (ripple.w > 0 && time - ripple.z > life) ripple.w = 0
    }
  }

  function activeRipples(): number {
    let n = 0
    for (const ripple of uniforms.uRipples.value) if (ripple.w > 0) n++
    return n
  }

  /** Mode gerak dikurangi: bintang dan bentuk statis, tanpa revolusi dan tanpa gerak kamera. */
  function applyMotionMode(): void {
    matOffset = Number.NaN
    // Reduced motion: tanpa interaksi pointer di canvas, termasuk drag putar.
    dragging = false
    dragVelX = 0
    dragVelY = 0
    updateCursor()
    if (reduce) mat?.style.removeProperty('--mat-offset')
    T = scrollTarget(tops, heights, seq.length)
    anchorDirty = true
    dirty = true
  }

  /** Error saat render (di luar React, jadi tak tertangkap error boundary) → berhenti, fallback. */
  function frame(now: number): void {
    raf = 0
    if (destroyed) return
    try {
      renderFrame(now)
    } catch {
      destroy()
      options.onFail()
    }
  }

  function renderFrame(now: number): void {
    if (resize()) dirty = true
    // dt dibatasi: loop yang baru mulai / tab yang baru kembali tidak membuat gerak melonjak.
    if (!lastTime) resetPrev = true
    const dt = lastTime ? Math.min(MAX_DT_MS, Math.max(0, now - lastTime)) : FRAME_MS
    lastTime = now
    const fading = stepColors(now)
    const target = scrollTarget(tops, heights, seq.length)
    lastTarget = target

    if (reduce) {
      // Statis: render hanya bila bentuk aktif berubah atau ada yang lain berubah.
      T = target
      computeFrame(T, seq, state, params)
      const shape = reducedShape()
      const show = shape >= 0 ? 1 : 0
      if (shape >= 0 && shape !== currentShape) setShape(shape)
      if (!dirty && !fading && !anchorDirty && show === intensity) {
        lastTime = 0
        return
      }
      intensity = show
      if (anchorDirty) computeAnchor(currentShape)
      dirty = false
      uniforms.uTime.value = 0
      uniforms.uPointerActive.value = 0
      for (const ripple of uniforms.uRipples.value) ripple.w = 0
      uniforms.uMorph.value = intensity
      uniforms.uPeak.value = intensity * intensity * (3 - 2 * intensity)
      uniforms.uStreak.value = 0
      updateShapeRotation()
      placeCamera(params.yaw[0], params.pitch[0], 0, 0, 0)
      renderer.render(scene, camera)
      if (fading) schedule()
      else lastTime = 0
      return
    }

    time += dt / 1000
    const step = dt / FRAME_MS
    // Selama navigasi anchor jauh, T ditahan di elemen tujuan (lihat onClick).
    if (!navigating) {
      if (Math.abs(target - T) > JUMP_ELEMENTS) {
        T = target
        resetPrev = true
      } else {
        // Smoothing per frame 60 fps, dikonversi ke dt nyata (konsisten di 30/60/120 Hz).
        T += (target - T) * (1 - (1 - params.smoothing) ** step)
        if (Math.abs(target - T) < SETTLE_EPSILON) T = target
      }
    }
    computeFrame(T, seq, state, params)

    // Intensitas tujuan. Bentuk lain masih tampil → lepas dulu sampai 0, baru ganti bentuk.
    // Scroll diam → bentuk setengah jadi diselesaikan: di fase lepas selalu ke lepas (kamera
    // sudah berbelok ke section berikut); di fase masuk ke keadaan terdekat (utuh / lepas).
    const idle = !navigating && T === target && now - lastScrollAt > SETTLE.idleMs
    let goal = 0
    if (state.shape >= 0 && state.shape === currentShape) {
      goal = idle ? (!state.releasing && state.intensity >= 0.5 ? 1 : 0) : state.intensity
    }
    // Menukar bentuk (bentuk lain masih termuat) selalu cepat; menyelesaikan scroll yang berhenti pelan.
    const swapping = state.shape >= 0 && state.shape !== currentShape
    const rate = idle && !swapping ? SETTLE.rate : SETTLE.scrollRate
    intensity += (goal - intensity) * (1 - (1 - rate) ** step)
    if (Math.abs(goal - intensity) < 0.0005) intensity = goal
    if (state.shape >= 0 && state.shape !== currentShape && intensity < RELEASED) {
      intensity = 0
      setShape(state.shape)
    }
    if (anchorDirty) computeAnchor(currentShape)

    // Kamera: zoom mengikuti intensitas; drift halus selama fase tahan; parallax pointer.
    stepPointer(now, step)
    stepDrag(step)
    updateCursor()
    // View-proyeksi frame yang baru dirender = "frame sebelumnya" untuk streak.
    prevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const e = intensity
    const drift = state.shape === currentShape ? params.holdDrift * (state.hold - 0.5) * e : 0
    const px = parallaxX * params.parallaxStrength
    const py = parallaxY * params.parallaxStrength
    const k = Math.min(Math.max(currentShape, 0), params.yaw.length - 1)
    // Pulsa FOV: melebar saat zoom in, menyempit saat zoom out, sebanding kecepatan zoom.
    const zoomSpeed = (e - prevIntensity) / Math.max(step, 0.25)
    prevIntensity = e
    const kick = Math.max(-1, Math.min(1, zoomSpeed / ZOOM_FX.fovSpeedRef)) * params.fovPulse
    fovKick += (kick - fovKick) * (1 - (1 - ZOOM_FX.fovSmoothing) ** step)
    camera.fov = baseFov + fovKick
    camera.updateProjectionMatrix()
    uniforms.uTanHalfFov.value = Math.tan((camera.fov * Math.PI) / 360)
    placeCamera(state.yaw + px, state.pitch + py, e, params.yaw[k] + drift + px, params.pitch[k] + py)
    if (resetPrev) {
      camera.updateMatrixWorld()
      prevViewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      resetPrev = false
    }
    uniforms.uStreak.value = params.streakStrength
    uniforms.uFrameScale.value = 1 / Math.max(step, 0.25)

    uniforms.uTime.value = time
    uniforms.uMorph.value = intensity
    uniforms.uPeak.value = intensity * intensity * (3 - 2 * intensity)
    updateShapeRotation()
    renderer.render(scene, camera)
    dirty = false
    updateMat()
    // Bintang selalu bergerak: loop jalan terus selama tab terlihat.
    schedule()
  }

  function schedule(): void {
    if (!raf && !destroyed && !document.hidden) raf = window.requestAnimationFrame(frame)
  }

  // ---- Navigasi anchor jauh (klik menu navbar, footer, dst.) ----

  /**
   * Akhiri mode navigasi. Kecuali dipaksa (batas waktu), hanya bila posisi scroll sudah
   * dekat elemen tujuan: scroll yang belum sampai tidak membuat T menyapu jeda di antaranya.
   */
  function endNavigation(force = false): void {
    if (!navigating) return
    if (force !== true && Math.abs(scrollTarget(tops, heights, seq.length) - navIndex) > 1.2) return
    navigating = false
    window.clearTimeout(navIdleTimer)
    window.clearTimeout(navMaxTimer)
    schedule() // lanjut smoothing normal dari elemen tujuan ke posisi akhir (jarak pendek)
  }

  function onScroll(): void {
    lastScrollAt = performance.now()
    if (navigating) {
      window.clearTimeout(navIdleTimer)
      navIdleTimer = window.setTimeout(endNavigation, SCROLL_IDLE_MS)
    }
    schedule()
  }

  /**
   * Klik tautan #id yang tujuannya lebih dari satu elemen jauhnya: T langsung pindah ke
   * awal section tujuan (netral, tanpa bentuk) dan ditahan di sana selama scroll native
   * yang halus berjalan, lalu kembali ke smoothing normal. Tanpa ini, T akan menyapu semua
   * jeda di antaranya dan bentuk berkedip bergantian.
   */
  function onClick(event: MouseEvent): void {
    if (reduce || event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element | null)?.closest?.('a[href^="#"]')
    const id = link?.getAttribute('href')?.slice(1)
    const dest = id ? document.getElementById(id) : null
    if (!dest) return
    const index = seq.findIndex((item) => item.el === dest || item.el.contains(dest))
    if (index < 0 || Math.abs(index - Math.floor(T)) <= 1) return
    navigating = true
    navIndex = index
    T = index
    resetPrev = true
    window.clearTimeout(navIdleTimer)
    window.clearTimeout(navMaxTimer)
    // Bila scroll tidak terjadi (sudah di tujuan) → selesai setelah jeda idle.
    navIdleTimer = window.setTimeout(endNavigation, SCROLL_IDLE_MS * 2)
    navMaxTimer = window.setTimeout(() => endNavigation(true), NAV_MAX_MS)
    schedule()
  }

  function remeasure(): void {
    measure()
    schedule()
  }

  /**
   * Resize / rotasi: tinggi section berubah, tetapi browser mempertahankan scrollY,
   * sehingga progres di dalam elemen bisa melompat (mis. jeda dari 30% ke 75%).
   * Kembalikan scroll ke progres relatif yang sama (elemen + fraksi) sebelum resize.
   * Hanya bila viewport tata letak berubah (lebar atau clientHeight), bukan saat bar
   * alamat mobile menyusut (yang hanya mengubah innerHeight).
   */
  function onResize(): void {
    const root = document.documentElement
    const changed = root.clientWidth !== viewWidth || root.clientHeight !== viewHeight
    viewWidth = root.clientWidth
    viewHeight = root.clientHeight
    measure()
    if (changed && !reduce && !navigating && seq.length > 0) {
      const anchor = lastTarget >= 0 ? lastTarget : T
      const i = Math.max(0, Math.min(seq.length - 1, Math.floor(anchor)))
      const mid = tops[i] + heights[i] * Math.min(1, anchor - i)
      const y = Math.max(0, Math.round(mid - viewHeight / 2))
      if (Math.abs(y - window.scrollY) > 1) window.scrollTo({ top: y, behavior: 'instant' })
    }
    anchorDirty = true
    schedule()
  }

  function setParams(next: PointFieldParams): void {
    if (destroyed) return
    const previous = params
    params = next
    const rebuild =
      GEOMETRY_KEYS.some((key) => next[key] !== previous[key]) || countFor(device, next) !== count
    if (rebuild) {
      const old = geometry
      geometry = buildGeometry()
      points.geometry = geometry
      old.dispose()
    }
    applyParamUniforms()
    // Paksa mat dihitung ulang dan posisi bentuk diukur ulang dengan parameter baru.
    matOffset = Number.NaN
    anchorDirty = true
    dirty = true
    schedule() // satu frame dirender walau tidak ada gerak (reduced motion)
  }

  // ---- Event ----
  const onVisibility = () => {
    lastTime = 0
    if (document.hidden) {
      window.cancelAnimationFrame(raf)
      raf = 0
    } else {
      schedule()
    }
  }
  const motionQuery = window.matchMedia(REDUCED_MOTION)
  const onMotionChange = () => {
    reduce = motionQuery.matches
    applyMotionMode()
    schedule()
  }
  const onContextLost = () => {
    contextLost = true
    destroy()
    options.onFail()
  }
  // Pointer: semua pasif, hanya mencatat posisi (frame membaca sekali per rAF).
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    pointerTouch = false
    pointerInside = true
    lastPointerAt = performance.now()
    setPointer(event.clientX, event.clientY)
    hoverDraggable = isDragSurface(event.target)
    if (dragging) {
      dragDeltaX += event.clientX - dragLastX
      dragDeltaY += event.clientY - dragLastY
      dragLastX = event.clientX
      dragLastY = event.clientY
    }
    if (!reduce) schedule()
  }
  // Tidak pasif: preventDefault hanya saat drag dimulai (mencegah seleksi teks), tidak
  // pernah untuk sentuhan, jadi scroll native tidak terhalang.
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || event.button !== 0) return
    pointerTouch = false
    setPointer(event.clientX, event.clientY)
    if (canDrag() && isDragSurface(event.target)) {
      event.preventDefault()
      dragging = true
      dragLastX = event.clientX
      dragLastY = event.clientY
      dragDeltaX = 0
      dragDeltaY = 0
      updateCursor()
      schedule()
      return
    }
    addRipple()
  }
  const onPointerUp = () => {
    if (!dragging) return
    dragging = false
    updateCursor()
  }
  const onPointerOut = (event: PointerEvent) => {
    // relatedTarget null = pointer keluar dari jendela.
    if (event.pointerType !== 'touch' && !event.relatedTarget) {
      pointerInside = false
      hoverDraggable = false
    }
  }
  // Sentuhan lewat touch events (tetap terkirim selama browser menggulir, berbeda dengan
  // pointer events yang dibatalkan): dorong selama jari menyentuh, riak saat tap.
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    pointerTouch = true
    touching = true
    touchStartX = touchLastX = touch.clientX
    touchStartY = touchLastY = touch.clientY
    touchStartAt = performance.now()
    setPointer(touch.clientX, touch.clientY)
    if (!reduce) schedule()
  }
  const onTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    touchLastX = touch.clientX
    touchLastY = touch.clientY
    setPointer(touch.clientX, touch.clientY)
  }
  const onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length > 0) return
    touching = false
    const moved = Math.hypot(touchLastX - touchStartX, touchLastY - touchStartY)
    if (event.type === 'touchend' && moved < POINTER.tapSlop && performance.now() - touchStartAt < POINTER.tapMs) {
      setPointer(touchLastX, touchLastY)
      addRipple()
    }
  }
  const passive = { passive: true } as const

  const resizeObserver = new ResizeObserver(remeasure)
  resizeObserver.observe(host)
  resizeObserver.observe(document.body)
  const content = seq[0]?.el.parentElement
  if (content) resizeObserver.observe(content)

  window.addEventListener('scroll', onScroll, { passive: true })
  const onScrollEnd = () => endNavigation()
  window.addEventListener('scrollend', onScrollEnd)
  document.addEventListener('click', onClick)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  motionQuery.addEventListener('change', onMotionChange)
  canvas.addEventListener('webglcontextlost', onContextLost)
  window.addEventListener('pointermove', onPointerMove, passive)
  window.addEventListener('pointerdown', onPointerDown, { passive: false })
  window.addEventListener('pointerup', onPointerUp, passive)
  window.addEventListener('pointercancel', onPointerUp, passive)
  window.addEventListener('blur', onPointerUp)
  window.addEventListener('pointerout', onPointerOut, passive)
  window.addEventListener('touchstart', onTouchStart, passive)
  window.addEventListener('touchmove', onTouchMove, passive)
  window.addEventListener('touchend', onTouchEnd, passive)
  window.addEventListener('touchcancel', onTouchEnd, passive)
  if ('fonts' in document) {
    document.fonts.ready.then(() => {
      if (!destroyed) remeasure()
    })
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    window.cancelAnimationFrame(raf)
    raf = 0
    resizeObserver.disconnect()
    window.clearTimeout(navIdleTimer)
    window.clearTimeout(navMaxTimer)
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('scrollend', onScrollEnd)
    document.removeEventListener('click', onClick)
    window.removeEventListener('resize', onResize)
    document.removeEventListener('visibilitychange', onVisibility)
    motionQuery.removeEventListener('change', onMotionChange)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    window.removeEventListener('blur', onPointerUp)
    window.removeEventListener('pointerout', onPointerOut)
    if (cursorClass) document.documentElement.classList.remove(cursorClass)
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchEnd)
    mat?.style.removeProperty('--mat-offset')
    geometry.dispose()
    material.dispose()
    renderer.dispose()
    if (!contextLost) renderer.forceContextLoss()
    canvas.remove()
  }

  // ---- Mulai ----
  readColors()
  measure()
  applyMotionMode()
  schedule()

  return {
    measure: remeasure,
    refreshColors() {
      fadeColors()
      dirty = true
      schedule()
    },
    setParams,
    getParams: () => params,
    project(x, y, z) {
      const v = new Vector3(x, y, z)
      const depth = -v.clone().applyMatrix4(camera.matrixWorldInverse).z
      v.project(camera)
      return [v.x, v.y, depth]
    },
    debug() {
      const item = seq[state.item]
      const [enter, release] = phaseBounds(params)
      const inShape = item?.kind === 'break'
      const f = state.progress
      return {
        T,
        target: scrollTarget(tops, heights, seq.length),
        item: state.item,
        kind: item?.kind ?? null,
        index: item?.index ?? -1,
        phase: !inShape || reduce ? '–' : f < enter ? 'masuk' : f <= release ? 'tahan' : 'lepas',
        morph: intensity,
        shape: currentShape,
        shapeNdc: ((v) => [v.x, v.y] as [number, number])(uniforms.uShapeCenter.value.clone().project(camera)),
        count,
        device,
        fov: camera.fov,
        pointer: pointerActivity,
        ripples: activeRipples(),
        dragging,
        reducedMotion: reduce,
        geometryVersion,
        colors: colors.slice(0, 3).map((color) => color.getHexString()),
        readColors: colors.slice(3).map((color) => color.getHexString()),
        readI: uniforms.uReadI.value + (1 - uniforms.uReadI.value) * uniforms.uPeak.value,
        peak: uniforms.uPeak.value,
        safeZone: { on: uniforms.uSafeOn.value > 0, left: safeLeft, right: safeRight },
      }
    },
    destroy,
  }
}
