/**
 * Shader titik. Semua gerak dan tampilan per titik dihitung di GPU; CPU hanya mengubah
 * uniform. Satu draw call untuk seluruh titik.
 *
 * Bintang (revolusi galaksi, tetap jalan selama zoom):
 *   rn    = |position| / uFieldRadius                       (0 di pusat, 1 di tepi)
 *   speed = uRevSpeed * (1 + uRevCore * (1 - rn)) * (1 + uRevVar * aSpin)
 *   p     = rotasiY(uTime * speed) * position + gerak halus (sinus per titik, fase aPhase)
 *   star  = uRevTilt * p                                     (kemiringan bidang putar)
 *
 * Titik bentuk (aSelect < uShapeShare) berpindah ke bentuk di titik fokus zoom:
 *   target = uShapeCenter + uShapeRot * (aTarget * uShapeScale)
 *   w      = smoothstep(0, 1, clamp(uMorph * uMorphSpeed - aDelay * uDelaySpread, 0, 1))
 *   posisi = mix(star, target, w)
 *
 * Interaksi pointer (stateless, fungsi jarak di ruang layar; satuan NDC, tinggi layar = 2,
 * x dikoreksi rasio aspek): dorong menjauh dari kursor dan riak radial (maks. 3). Titik
 * bentuk memakai pengali uPushShape. Perpindahan NDC dikonversi ke ruang kamera (dikali
 * kedalaman), jadi besarnya di layar sama untuk titik dekat maupun jauh.
 *
 * Kesan kedalaman:
 *   depth   = -z kamera;  dn = smoothstep(0, 1, (depth - 1) / uDepthRange)
 *   ukuran  = perspektif (1/depth) × mix(besar, kecil, dn) × variasi acak aSeed, dibatasi uSizeMax
 *   opasitas= uOpacity × mix(1, redup, dn) × kecerahan acak × fade dekat bidang near
 *   Titik bentuk (w → 1) mengabaikan pelemahan jarak supaya bentuk terbaca solid.
 *
 * Keterbacaan teks: uPeak = smoothstep(intensitas jeda m).
 *   Saat membaca (uPeak = 0): opasitas × uReadGain (= opasitas efektif target / rata-rata
 *   opasitas puncak titik, jadi nilai di config ≈ hasil yang terlihat), dorong/riak pointer
 *   × uReadI, ukuran × uReadSize dan dibatasi uReadMax, warna = warna baca, dan titik di
 *   kolom konten (uSafeX, desktop saja) × uSafeFactor (relatif terhadap area tanpa teks)
 *   dengan tepi smoothstep. Di puncak jeda (uPeak = 1) semuanya kembali ke nilai penuh, jadi
 *   bentuk tidak berubah dari sebelumnya.
 *
 * Streak: kecepatan layar tiap titik = selisih proyeksi dengan matriks view-proyeksi frame
 * sebelumnya (uPrevViewProj). Sprite memanjang searah kecepatan itu (aliran radial saat
 * zoom, geser saat kamera menyimpang) sebanding panjang gerak; fragment shader menggambar
 * elips di dalam sprite persegi yang diperbesar sebesar `stretch`.
 */
export const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uFieldRadius;
uniform float uRevSpeed;
uniform float uRevCore;
uniform float uRevVar;
uniform mat3 uRevTilt;
uniform float uWobble;
uniform float uWobbleSpeed;
uniform float uShapeShare;
uniform vec3 uShapeCenter;
uniform mat3 uShapeRot;
uniform float uShapeScale;
uniform float uMorph;
uniform float uMorphSpeed;
uniform float uDelaySpread;
uniform float uSize;
uniform float uSizeMax;
uniform float uScale;
uniform float uOpacity;
uniform float uAspect;
uniform float uTanHalfFov;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uPushRadius;
uniform float uPushStrength;
uniform float uPushShape;
uniform vec4 uRipples[3];
uniform float uRippleSpeed;
uniform float uRippleStrength;
uniform float uRippleWidth;
uniform float uRippleDamping;
uniform float uDepthSize;
uniform float uDepthOpacity;
uniform float uDepthRange;
uniform float uNearFade;
uniform float uSizeVar;
uniform float uBrightVar;
uniform mat4 uPrevViewProj;
uniform vec2 uResolution;
uniform float uFrameScale;
uniform float uStreak;
uniform float uStreakMax;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uReadColor1;
uniform vec3 uReadColor2;
uniform vec3 uReadColor3;
uniform float uPeak;
uniform float uReadI;
uniform float uReadGain;
uniform float uReadSize;
uniform float uReadMax;
uniform vec2 uSafeX;
uniform float uSafeOn;
uniform float uSafeFactor;
uniform float uSafeFeather;

attribute vec3 aTarget;
attribute float aDelay;
attribute float aPalette;
attribute float aSelect;
attribute float aSpin;
attribute float aPhase;
attribute float aSeed;

varying vec3 vColor;
varying float vAlpha;
varying vec2 vDir;
varying float vStretch;

void main() {
  // Keterbacaan: skala dorong pointer (uReadI saat membaca, 1 di puncak) dan gain opasitas
  // (uReadGain saat membaca, 1 di puncak; gain sudah menormalkan kedalaman dan kecerahan).
  float readI = mix(uReadI, 1.0, uPeak);
  float readGain = mix(uReadGain, 1.0, uPeak);
  float rn = clamp(length(position) / uFieldRadius, 0.0, 1.0);
  float speed = uRevSpeed * (1.0 + uRevCore * (1.0 - rn)) * (1.0 + uRevVar * aSpin);
  float a = uTime * speed;
  float c = cos(a);
  float s = sin(a);
  vec3 p = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);
  float t = uTime * uWobbleSpeed;
  p += uWobble * vec3(sin(t + aPhase), sin(t * 0.83 + aPhase * 1.7), cos(t * 0.91 + aPhase * 2.3));
  vec3 star = uRevTilt * p;

  float isShape = step(aSelect, uShapeShare - 0.000001);
  float w = isShape * smoothstep(0.0, 1.0, clamp(uMorph * uMorphSpeed - aDelay * uDelaySpread, 0.0, 1.0));
  vec3 target = uShapeCenter + uShapeRot * (aTarget * uShapeScale);
  vec3 pos = mix(star, target, w);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 clip = projectionMatrix * mv;

  // Kecepatan layar (px per frame 60 fps) dari selisih proyeksi dengan frame sebelumnya.
  vec2 vel = vec2(0.0);
  vec4 prev = uPrevViewProj * vec4(pos, 1.0);
  if (clip.w > 0.0 && prev.w > 0.0) {
    vel = (clip.xy / clip.w - prev.xy / prev.w) * 0.5 * uResolution * uFrameScale;
  }
  float velLen = length(vel);
  float stretch = 1.0 + min(velLen * uStreak, uStreakMax);
  vDir = velLen > 0.0001 ? vel / velLen : vec2(1.0, 0.0);
  vStretch = stretch;

  if (clip.w > 0.0) {
    vec2 ndc = clip.xy / clip.w;
    vec2 aspect = vec2(uAspect, 1.0);
    vec2 offset = vec2(0.0);

    vec2 diff = (ndc - uPointer) * aspect;
    float d = length(diff);
    float near = 1.0 - smoothstep(0.0, uPushRadius, d);
    offset += diff / max(d, 0.0001) * (near * near) * uPushStrength * uPointerActive;

    for (int i = 0; i < 3; i++) {
      vec4 r = uRipples[i];
      float age = uTime - r.z;
      if (r.w > 0.0 && age >= 0.0) {
        vec2 rd = (ndc - r.xy) * aspect;
        float dist = length(rd);
        float x = (dist - age * uRippleSpeed) / uRippleWidth;
        offset += rd / max(dist, 0.0001) * exp(-x * x) * r.w * exp(-age * uRippleDamping) * uRippleStrength;
      }
    }

    offset *= mix(1.0, uPushShape, w) * readI;
    // NDC (dikoreksi aspek) → ruang kamera: Δ = offset * kedalaman * tan(fov/2).
    mv.xy += offset * (-mv.z) * uTanHalfFov;
    clip = projectionMatrix * mv;
  }

  // ---- Kedalaman: ukuran, opasitas, variasi, fade dekat kamera ----
  float depth = max(-mv.z, 0.001);
  float dn = smoothstep(0.0, 1.0, clamp((depth - 1.0) / max(uDepthRange, 1.0), 0.0, 1.0));
  dn *= 1.0 - w * 0.85; // titik bentuk tetap solid
  float sizeDepth = mix(1.0 + 0.5 * uDepthSize, 1.0 - 0.4 * uDepthSize, dn);
  float sizeVar = 1.0 + uSizeVar * (aSeed * 2.0 - 1.0);
  // Saat membaca: ukuran dikecilkan dan dibatasi (tanpa bercak besar di belakang paragraf).
  float sizeCap = mix(uReadMax, uSizeMax, uPeak);
  float size = min(uSize * (uScale / depth) * sizeDepth * sizeVar * mix(uReadSize, 1.0, uPeak), sizeCap);

  float alpha = uOpacity * readGain * mix(1.0, 1.0 - 0.75 * uDepthOpacity, dn);
  alpha *= 1.0 - uBrightVar * fract(aSeed * 91.7);
  alpha *= smoothstep(0.15, max(uNearFade, 0.2), depth);
  alpha /= 1.0 + 0.35 * (stretch - 1.0);

  // Zona aman: redam titik yang di layar berada di kolom konten (tepi lembut, hanya saat membaca).
  if (uSafeOn > 0.0 && clip.w > 0.0) {
    float sx = clip.x / clip.w;
    float zone = smoothstep(uSafeX.x - uSafeFeather, uSafeX.x + uSafeFeather, sx)
      * (1.0 - smoothstep(uSafeX.y - uSafeFeather, uSafeX.y + uSafeFeather, sx));
    alpha *= mix(1.0, uSafeFactor, zone * (1.0 - uPeak));
  }

  gl_Position = clip;
  // Sprite persegi dirasterisasi penuh: batasi ukuran akhir (streak ikut) demi fill-rate.
  gl_PointSize = min(size * stretch, sizeCap * 3.0);
  vAlpha = alpha;
  vec3 full = aPalette < 0.5 ? uColor1 : (aPalette < 1.5 ? uColor2 : uColor3);
  vec3 reading = aPalette < 0.5 ? uReadColor1 : (aPalette < 1.5 ? uReadColor2 : uReadColor3);
  vColor = mix(reading, full, uPeak);
}
`

export const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying vec2 vDir;
varying float vStretch;

void main() {
  // Koordinat sprite -1..1 (y ke atas, sama dengan NDC), lalu elips memanjang searah vDir.
  vec2 q = (gl_PointCoord - 0.5) * 2.0;
  q.y = -q.y;
  vec2 perp = vec2(-vDir.y, vDir.x);
  float r = length(vec2(dot(q, vDir), dot(q, perp) * vStretch));
  if (r > 1.0) discard;
  float soft = 1.0 - smoothstep(0.45, 1.0, r);
  gl_FragColor = vec4(vColor, vAlpha * soft);
  #include <colorspace_fragment>
}
`
