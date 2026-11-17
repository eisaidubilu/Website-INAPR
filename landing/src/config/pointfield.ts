/**
 * Parameter animasi titik 3D: SATU sumber kebenaran.
 *
 * Konsep: field bintang tebal yang terus berputar pelan (revolusi galaksi, dihitung di GPU).
 * Saat membaca section, kamera netral (zoom-out) dan semua titik berupa bintang. Di tiap
 * jeda (Break) di antara section:
 *   ZOOM IN → TAHAN → ZOOM OUT.
 * Zoom in = kamera maju sambil menyimpang menuju satu ARAH ZOOM (kiri/kanan/atas/bawah atau
 * sudut) dan titik fokusnya berpindah ke sana. Sebagian titik (shapeShare) menyatu menjadi
 * satu bentuk di titik fokus itu, jadi bentuk SELALU tampak di tengah layar pada puncak zoom.
 * Ditambah efek kedalaman (ukuran/opasitas menurut jarak, fade dekat kamera, pulsa FOV,
 * streak) dan interaksi pointer di canvas (parallax, medan dorong, riak, drag putar).
 *
 * Mengubah default: edit POINTFIELD_DEFAULTS di bawah. Untuk mencoba nilai secara
 * langsung, buka dev server dengan `?tune` (panel src/dev/tune.tsx), lalu "Salin nilai"
 * dan tempel ke sini.
 */

/** Arah zoom: ke mana kamera menyimpang saat zoom in. Kombinasi = sudut. */
export const ZOOM_DIRECTIONS = [
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const

export type ZoomDirection = (typeof ZOOM_DIRECTIONS)[number]

export interface PointFieldParams {
  /** Faktor lerp skalar scroll T per frame 60 fps (0..1). Besar = lebih responsif. */
  smoothing: number

  // ---- Titik ----
  /** Jumlah titik per jenis perangkat (lihat pickDevice() di engine.ts). Satu draw call. */
  countDesktop: number
  /** Perangkat lemah: ≤ 4 core CPU atau ≤ 4 GB RAM (bila browser melaporkannya). */
  countLowPower: number
  /** Layar kecil: lebar < 768px atau sisi terpendek < 600px. */
  countMobile: number
  /** Ukuran titik (satuan dunia, mengecil menurut jarak). Dibatasi MAX_POINT_PX. */
  pointSize: number
  pointOpacity: number
  /** Radius bola field (titik tersebar di volume tebal). */
  fieldRadius: number
  /**
   * Bias kerapatan ke pusat (0..1): 0 = merata di volume, 1 = padat di pusat. Pusat padat
   * berarti banyak lapisan titik dekat dan jauh di jalur kamera saat zoom in.
   */
  fieldCoreBias: number
  /** Proporsi titik yang menjadi titik bentuk (0..1). Sisanya tetap bintang. */
  shapeShare: number

  // ---- Revolusi bintang (GPU, tidak bergantung scroll; tetap jalan selama zoom) ----
  /** Kecepatan sudut dasar di tepi field (rad/detik). */
  revolutionSpeed: number
  /** Tambahan kecepatan di pusat: pusat = (1 + nilai) × dasar, tepi = dasar. */
  revolutionCoreBoost: number
  /** Variasi acak kecepatan per titik (±fraksi). */
  revolutionVariation: number
  /** Kemiringan bidang putar (radian) terhadap sumbu X dan Z. */
  revolutionTiltX: number
  revolutionTiltZ: number
  /** Gerak halus per titik: amplitudo (satuan dunia) dan kecepatan (rad/detik). */
  wobbleAmplitude: number
  wobbleSpeed: number

  // ---- Kamera & jalur zoom ----
  /** Jarak kamera dari pusat field saat netral (zoom-out, selama membaca section). */
  cameraFar: number
  /** Jarak kamera ke bentuk saat zoom in penuh. */
  cameraNear: number
  /** Jarak pusat bentuk (titik fokus) dari pusat field menuju arah zoom. */
  zoomReach: number
  /**
   * Kelengkungan jalur kamera (0..1): 0 = garis lurus netral → puncak; 1 = maju dulu lalu
   * menyimpang ke arah zoom. Jalur adalah kurva Bézier kuadratik.
   */
  pathCurve: number
  /** Drift kamera selama fase tahan (radian yaw total, dari -½ ke +½). */
  holdDrift: number

  // ---- Fase di dalam jeda (fraksi progres jeda) ----
  /** ZOOM IN + bentuk terbentuk: 0 → phaseFormEnd. TAHAN: phaseFormEnd → phaseHoldEnd. LEPAS + ZOOM OUT: phaseHoldEnd → 1. */
  phaseFormEnd: number
  phaseHoldEnd: number

  // ---- Bentuk ----
  /** Tinggi bentuk pada puncak zoom, fraksi tinggi viewport (±0.4–0.5 terbaca solid). */
  shapeSize: number
  /** Batas lebar bentuk, fraksi lebar viewport (layar potret). */
  shapeMaxWidth: number
  /** Rotasi lokal bentuk (rad/detik) dan kemiringan dasarnya (radian). */
  shapeSpin: number
  shapeTiltY: number
  shapeTiltX: number
  /** Morph per titik: w = smoothstep(clamp(m * morphSpeed - delay * delaySpread)). morphSpeed - delaySpread ≥ 1. */
  morphSpeed: number
  delaySpread: number

  // ---- Kesan kedalaman (shader) ----
  /** Kekuatan perbedaan ukuran dekat/jauh (0 = hanya perspektif). */
  depthSize: number
  /** Kekuatan perbedaan opasitas dekat/jauh (0 = sama). */
  depthOpacity: number
  /** Jarak (satuan dunia) tempat titik dianggap paling jauh untuk efek di atas. */
  depthRange: number
  /** Titik lebih dekat dari ini (satuan dunia) memudar, jadi tidak muncul/hilang tiba-tiba di bidang near. */
  nearFade: number
  /** Variasi acak ukuran dan kecerahan per titik (±fraksi, 0 = seragam). */
  sizeVariation: number
  brightnessVariation: number
  /** Pulsa FOV saat zoom (derajat; + saat zoom in, − saat zoom out; 0 = mati). */
  fovPulse: number
  /** Streak: perpanjangan sprite searah gerak titik di layar (0 = mati; ±per px per frame). */
  streakStrength: number

  // ---- Interaksi pointer (canvas; tanpa efek saat reduced motion) ----
  /** Parallax: kemiringan kamera maks. (radian) mengikuti posisi pointer, dan kehalusannya (0..1 per frame). */
  parallaxStrength: number
  parallaxSmoothing: number
  /** Medan dorong: radius (NDC; tinggi layar = 2) dan perpindahan maks. (NDC). */
  pushRadius: number
  pushStrength: number
  /** Pengali dorong/riak untuk titik bentuk (kecil = bentuk tidak rusak). */
  pushShapeFactor: number
  /** Riak klik/tap: kecepatan rambat (NDC/detik), kekuatan (NDC), lebar gelombang (NDC), redaman (1/detik). */
  rippleSpeed: number
  rippleStrength: number
  rippleWidth: number
  rippleDamping: number
  /**
   * Putar bentuk dengan drag mouse (klik tahan + geser di area kosong saat bentuk tampil):
   * kepekaan (radian per px) dan inersia setelah dilepas (kecepatan yang tersisa per frame 60 fps).
   */
  dragSensitivity: number
  dragInertia: number

  /** Parallax latar cutting mat: offset = -scrollY * faktor. 0 = mati. */
  matParallax: number

  // ---- Keterbacaan teks (shader; titik diredam saat membaca, penuh di puncak jeda) ----
  /**
   * Intensitas titik saat MEMBACA (di dalam section): opasitas titik dikali nilai ini. Menuju
   * puncak jeda naik ke 1 mengikuti intensitas jeda m: I = lerp(readIntensity, 1, smoothstep(m)).
   * Dicek WCAG lewat `node scripts/check-reading-contrast.mjs` (warna baca ada di tokens.css).
   */
  readIntensity: number
  /** Pengali ukuran titik saat membaca (1 di puncak jeda). */
  readSize: number
  /** Ukuran piksel CSS maksimum per titik saat membaca; melonggar ke MAX_POINT_PX di puncak jeda. */
  readMaxPx: number
  /**
   * Zona aman (desktop ≥ SAFE_ZONE.minWidth): pengali opasitas tambahan untuk titik yang
   * secara layar berada di dalam kolom konten (1 = mati). Melemah ke 1 menuju puncak jeda.
   */
  safeZoneFactor: number
  /**
   * Arah pandang netral di AKHIR tiap section (8 entri, indeks = data-section). Di dalam
   * section, arah berputar pelan dari nilai section sebelumnya ke nilai ini; di jeda
   * sesudahnya arah ini tetap, jadi tiap zoom in melihat bagian field yang berbeda.
   */
  yaw: readonly number[]
  pitch: readonly number[]
  /** Arah zoom per jeda (7 entri, indeks = data-break). Bentuk: kubus, bola, torus, piramid, silinder, oktahedron, heliks. */
  zoomDirections: readonly ZoomDirection[]
}

export const POINTFIELD_DEFAULTS: Readonly<PointFieldParams> = Object.freeze({
  smoothing: 0.18,
  countDesktop: 16000,
  countLowPower: 9000,
  countMobile: 6000,
  pointSize: 0.1,
  pointOpacity: 0.9,
  fieldRadius: 26,
  fieldCoreBias: 0.7,
  shapeShare: 0.55,
  revolutionSpeed: 0.03,
  revolutionCoreBoost: 0.8,
  revolutionVariation: 0.25,
  revolutionTiltX: 0.35,
  revolutionTiltZ: 0.15,
  wobbleAmplitude: 0.12,
  wobbleSpeed: 0.6,
  cameraFar: 16,
  cameraNear: 7,
  zoomReach: 10,
  pathCurve: 0.7,
  holdDrift: 0.04,
  phaseFormEnd: 0.35,
  phaseHoldEnd: 0.6,
  shapeSize: 0.45,
  shapeMaxWidth: 0.8,
  shapeSpin: 0.18,
  shapeTiltY: 0.7,
  shapeTiltX: 0.6,
  morphSpeed: 1.5,
  delaySpread: 0.3,
  depthSize: 1,
  depthOpacity: 0.5,
  depthRange: 36,
  nearFade: 1.6,
  sizeVariation: 0.45,
  brightnessVariation: 0.3,
  fovPulse: 12,
  streakStrength: 0.15,
  parallaxStrength: 0.06,
  parallaxSmoothing: 0.06,
  pushRadius: 0.32,
  pushStrength: 0.06,
  pushShapeFactor: 0.25,
  rippleSpeed: 1.4,
  rippleStrength: 0.05,
  rippleWidth: 0.12,
  rippleDamping: 1.6,
  dragSensitivity: 0.008,
  dragInertia: 0.93,
  matParallax: 0.1,
  readIntensity: 0.4,
  readSize: 0.75,
  readMaxPx: 4,
  safeZoneFactor: 0.6,
  yaw: Object.freeze([0.4, 1.3, 2.2, 3.1, 4.0, 4.9, 5.8, 6.7]),
  pitch: Object.freeze([0.12, -0.22, 0.28, -0.12, 0.2, -0.25, 0.1, -0.15]),
  zoomDirections: Object.freeze(['left', 'right', 'top', 'bottom', 'top-left', 'bottom-right', 'right'] as const),
})

/** Parameter yang mengubah posisi titik → geometri dibangun ulang bila berubah. */
export const GEOMETRY_KEYS = [
  'countDesktop',
  'countLowPower',
  'countMobile',
  'fieldRadius',
  'fieldCoreBias',
] as const satisfies readonly (keyof PointFieldParams)[]

// ---- Konstanta yang tidak di-tuning ----

/**
 * Tinggi satu jeda (Break). Mobile = di bawah breakpoint md Tailwind (768px).
 * svh di mobile: stabil saat bar alamat muncul/menyusut.
 */
export const BREAK_HEIGHT = { desktop: '70vh', mobile: '60svh' } as const

/** Seed acak geometri: posisi dan penugasan titik bentuk sama di setiap kunjungan. */
export const GEOMETRY_SEED = 20170101

/** Batas ukuran titik di layar (px CSS) supaya titik yang sangat dekat kamera tidak membesar tanpa batas. */
export const MAX_POINT_PX = 9

/**
 * Efek zoom: streak maksimum (kelipatan ukuran titik), kehalusan pulsa FOV (faktor per frame
 * 60 fps), dan kecepatan zoom acuan (perubahan intensitas per frame) untuk pulsa penuh.
 */
export const ZOOM_FX = { streakMax: 3, fovSmoothing: 0.12, fovSpeedRef: 0.04 } as const

/**
 * Setelah scroll berhenti selama idleMs, bentuk yang setengah jadi diselesaikan ke
 * keadaan terdekat (utuh atau lepas) dengan faktor per frame `rate`. `scrollRate` =
 * faktor saat scroll aktif (hampir langsung mengikuti T).
 */
export const SETTLE = { idleMs: 450, rate: 0.07, scrollRate: 0.35 } as const

/**
 * Pointer: efek memudar setelah idleMs tanpa gerak; `fade` = faktor per frame naik/turun;
 * `pushSmoothing` = kehalusan posisi medan dorong; maks. riak bersamaan; tap = sentuhan
 * yang bergerak < tapSlop px dan < tapMs; drag putar bentuk hanya bila intensitas bentuk
 * ≥ dragMinMorph.
 */
export const POINTER = {
  idleMs: 2000,
  fade: 0.08,
  pushSmoothing: 0.3,
  maxRipples: 3,
  tapSlop: 12,
  tapMs: 350,
  dragMinMorph: 0.35,
} as const

/** Batas devicePixelRatio. */
export const MAX_PIXEL_RATIO = { mobile: 1.5, desktop: 2 } as const

/** Field of view dasar: layar sempit pakai FOV lebih lebar. */
export const FOV = { narrow: 70, wide: 55, narrowBelow: 700 } as const

/** Token CSS warna titik penuh (puncak jeda) dan warna baca (saat membaca); lihat src/styles/tokens.css. */
export const COLOR_TOKENS = ['--titik-1', '--titik-2', '--titik-3'] as const
export const READ_COLOR_TOKENS = ['--titik-baca-1', '--titik-baca-2', '--titik-baca-3'] as const

/**
 * Zona aman: hanya dipakai bila lebar canvas ≥ minWidth (px); `feather` = setengah lebar tepi
 * lembut (px) di kiri/kanan kolom konten.
 */
export const SAFE_ZONE = { minWidth: 1024, feather: 56 } as const
