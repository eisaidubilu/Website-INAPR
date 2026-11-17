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
  /**
   * Faktor lerp skalar scroll T per frame 60 fps (0..1). Animasi MENEMPEL ke scroll (scrubbed):
   * tanpa jam sendiri, T hanya mengikuti posisi scroll dengan smoothing ringan. ~0,28 = hampir
   * langsung (T sampai di posisi scroll dalam ±0,2 detik).
   */
  smoothing: number

  // ---- Scroll di jeda (lihat src/pointfield/wheeldamp.ts dan extendBreaks() di scrollmap.ts) ----
  /**
   * Peredam roda mouse/trackpad di jeda: satu flick tidak melompati bentuk. Berat HANYA saat
   * bentuk terlihat (lihat dampWeightLow/High); di lead, zoom in awal, zoom out akhir, trail dan
   * di luar jeda scroll normal. Hanya event wheel (bukan sentuhan, keyboard, drag scrollbar); mati
   * saat reduced motion dan selama navigasi anchor. Di perangkat sentuh swipe cepat TIDAK bisa diredam.
   */
  scrollDamping: boolean
  /**
   * Pengali jarak scroll roda saat bentuk terlihat penuh (1 = tanpa redam). Profil:
   * faktor = lerp(1, scrollDampFactor, w), w = smoothstep(dampWeightLow, dampWeightHigh, m),
   * m = intensitas jeda di posisi itu (sama dengan animasi). Di luar rentang jeda: 1.
   */
  scrollDampFactor: number
  /** Intensitas m tempat peredam mulai terasa (w = 0 di bawahnya: scroll normal). */
  dampWeightLow: number
  /** Intensitas m tempat peredam penuh (w = 1 di atasnya: faktor = scrollDampFactor). */
  dampWeightHigh: number
  /**
   * Animasi jeda melebar ke section di sekitarnya (vh): zoom in mulai edgeLeadVh sebelum jeda
   * (akhir section sebelumnya), zoom out selesai edgeTrailVh sesudah jeda (awal section berikut).
   * Progres fase dihitung atas lead + jeda + trail. Tiap tepi dibatasi EDGE.maxSectionFraction
   * tinggi section-nya. 0 = mati.
   */
  edgeLeadVh: number
  edgeTrailVh: number

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

  // ---- Fase di dalam jeda (fraksi progres atas rentang lead + jeda + trail) ----
  /**
   * ZOOM IN + bentuk terbentuk: 0 → phaseFormEnd. TAHAN: phaseFormEnd → phaseHoldEnd. LEPAS +
   * ZOOM OUT: phaseHoldEnd → 1. Desktop default: 40 + 180 + 40 vh → zoom in ±112vh, tahan ±36vh,
   * zoom out ±112vh.
   */
  phaseFormEnd: number
  phaseHoldEnd: number
  /**
   * Easing intensitas zoom/bentuk di fase masuk dan lepas (0..1): 0 = smoothstep (pelan di
   * ujung, cepat di tengah), 1 = linear murni (gerak sebanding scroll). ~0,6 = tengahnya hampir
   * linear, ujungnya masih halus, jadi terasa mengikuti jari/roda.
   */
  zoomEase: number

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

  // ---- Keterbacaan teks (shader; titik lebih tenang saat membaca, penuh di puncak jeda) ----
  /*
   * Semua opasitas di bawah adalah OPASITAS EFEKTIF: rata-rata opasitas puncak per titik yang
   * terlihat setelah SEMUA pengali (pointOpacity, kedalaman, variasi kecerahan). Shader
   * menormalkan faktor kedalaman dan kecerahan dengan rata-rata teoretisnya (lihat
   * readStats()), jadi nilai yang diketik mendekati hasil yang terlihat. Titik tunggal bisa
   * sampai ±1,5× rata-rata (titik dekat dan cerah). Menuju puncak jeda semuanya naik ke
   * perilaku penuh: gain = lerp(gain_baca, 1, smoothstep(m)).
   */
  /** Opasitas efektif rata-rata di area TANPA teks (tepi layar desktop). Target ≈ 0,55. */
  readIntensity: number
  /**
   * Opasitas efektif rata-rata di layar tanpa zona aman (lebar < SAFE_ZONE.minWidth: mobile dan
   * tablet sempit), tempat teks memenuhi lebar. Target ≈ 0,40.
   */
  readIntensityMobile: number
  /**
   * Zona aman (desktop ≥ SAFE_ZONE.minWidth): pengali RELATIF terhadap area tanpa teks untuk
   * titik yang di layar berada di kolom konten. Tengah kolom = readIntensity × safeZoneFactor
   * (0,55 × 0,68 ≈ 0,37). 1 = mati. Melemah ke 1 menuju puncak jeda.
   */
  safeZoneFactor: number
  /** Pengali ukuran titik saat membaca (1 = ukuran normal; 1 di puncak jeda). */
  readSize: number
  /** Ukuran piksel CSS maksimum per titik saat membaca; melonggar ke MAX_POINT_PX di puncak jeda. */
  readMaxPx: number
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
  smoothing: 0.28,
  scrollDamping: true,
  scrollDampFactor: 0.5,
  dampWeightLow: 0.55,
  dampWeightHigh: 0.9,
  edgeLeadVh: 40,
  edgeTrailVh: 40,
  countDesktop: 20000,
  countLowPower: 11000,
  countMobile: 7500,
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
  cameraNear: 6.5,
  zoomReach: 11,
  pathCurve: 0.7,
  holdDrift: 0.04,
  phaseFormEnd: 0.43,
  phaseHoldEnd: 0.57,
  zoomEase: 0.6,
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
  readIntensity: 0.55,
  readIntensityMobile: 0.4,
  safeZoneFactor: 0.68,
  readSize: 0.9,
  readMaxPx: 6,
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
 * Tinggi satu jeda (Break): desktop dalam vh, mobile dalam svh (di bawah breakpoint md Tailwind,
 * 768px; svh stabil saat bar alamat muncul/menyusut). Tanpa teks; canvas fixed, jadi jeda yang
 * tinggi terasa "berat": animasi menempel ke scroll sepanjang jeda. Ditambah tepi lead/trail
 * (edgeLeadVh/edgeTrailVh) dan peredam roda (scrollDamping) supaya scroll cepat tidak melompatinya.
 * Ubah juga --break-h-desktop / --break-h-mobile di :root (src/styles/global.css): area snap
 * section (scroll-margin-bottom) harus selebar jeda di bawahnya.
 * Setara berat roda dengan default (dampEquivalentVh): desktop 40 + 180 + 40 = 260vh → ±358vh,
 * mobile 40 + 140 + 40 = 220vh → ±303vh (tanpa batas EDGE di section pendek).
 */
export const BREAK_HEIGHT = { desktop: 180, mobile: 140 } as const

/**
 * Tepi animasi jeda (edgeLeadVh/edgeTrailVh): tiap tepi paling banyak maxSectionFraction tinggi
 * section yang dimasukinya, jadi section pendek tetap punya bagian netral (≥ 1 − 2 × 0,4 = 20%).
 */
export const EDGE = { maxSectionFraction: 0.4 } as const

/**
 * Peredam roda (src/pointfield/wheeldamp.ts):
 * - lerp: faktor kejar scrollY → posisi target per frame 60 fps (dikonversi ke dt nyata).
 * - snapPx: selisih di bawah ini ditulis langsung ke target; stopPx: loop berhenti.
 * - externalPx: scrollY berbeda lebih dari ini dari tulisan terakhir = diubah sumber lain → sinkron.
 * - linePx: deltaMode baris → piksel; chunkPx: langkah integrasi faktor sepanjang satu delta.
 * - maxDeltaVh: batas satu event (vh) supaya delta aneh tidak melompat jauh.
 * - navIdleMs/navMaxMs: peredam mati selama navigasi anchor, sampai scroll diam/scrollend
 *   (atau batas aman).
 */
export const DAMP = {
  lerp: 0.2,
  snapPx: 2,
  stopPx: 0.5,
  externalPx: 1.5,
  linePx: 40,
  chunkPx: 8,
  maxDeltaVh: 150,
  navIdleMs: 150,
  navStartMs: 400,
  navMaxMs: 2500,
} as const

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
 * faktor saat scroll aktif (hampir langsung mengikuti T). Hanya mengubah intensitas
 * animasi; posisi scroll tidak pernah digerakkan.
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

/**
 * Rata-rata dn (0 = dekat, 1 = jauh) atas titik yang terlihat pada pose netral (cameraFar 16,
 * radius field 26, depthRange 36, bias pusat 0,7), hasil simulasi Monte Carlo desktop dan mobile
 * (0,651 dan 0,668). Dipakai untuk menormalkan faktor kedalaman opasitas; bila cameraFar,
 * depthRange atau sebaran field diubah banyak, angka ini sedikit meleset (selisih beberapa persen).
 */
export const DEPTH_MEAN_DN = 0.66

/**
 * Statistik opasitas titik untuk normalisasi keterbacaan. Opasitas puncak per titik di shader
 * = pointOpacity × faktorKedalaman × faktorKecerahan; faktorKedalaman = 1 − 0,75·depthOpacity·dn,
 * faktorKecerahan = 1 − brightnessVariation·U(0,1).
 *  - mean: rata-rata opasitas puncak (pembagi gain baca: gain = opasitasEfektif / mean).
 *  - max : opasitas puncak terbesar satu titik (titik terdekat dan paling cerah) = pointOpacity.
 *  - peakOverMean: seberapa jauh titik terbaik di atas rata-rata (untuk pemeriksaan kontras).
 */
export function readStats(
  p: Pick<PointFieldParams, 'pointOpacity' | 'depthOpacity' | 'brightnessVariation'>,
): { mean: number; max: number; peakOverMean: number } {
  const depthMean = 1 - 0.75 * p.depthOpacity * DEPTH_MEAN_DN
  const brightMean = 1 - 0.5 * p.brightnessVariation
  const mean = Math.max(0.001, p.pointOpacity * depthMean * brightMean)
  return { mean, max: p.pointOpacity, peakOverMean: p.pointOpacity / mean }
}

/** Token CSS warna titik penuh (puncak jeda) dan warna baca (saat membaca); lihat src/styles/tokens.css. */
export const COLOR_TOKENS = ['--titik-1', '--titik-2', '--titik-3'] as const
export const READ_COLOR_TOKENS = ['--titik-baca-1', '--titik-baca-2', '--titik-baca-3'] as const

/**
 * Zona aman: hanya dipakai bila lebar canvas ≥ minWidth (px); `feather` = setengah lebar tepi
 * lembut (px) di kiri/kanan kolom konten.
 */
export const SAFE_ZONE = { minWidth: 1024, feather: 56 } as const
