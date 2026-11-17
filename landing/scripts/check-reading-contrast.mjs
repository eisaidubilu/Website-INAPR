/**
 * Pemeriksaan kontras teks vs titik pada keadaan MEMBACA (WCAG 2.x) + keterlihatan titik.
 *
 * Opasitas yang dipakai = opasitas EFEKTIF (src/config/pointfield.ts, lihat readStats()):
 *   tepi layar desktop (tanpa teks) : readIntensity
 *   tengah kolom konten (desktop)   : readIntensity × safeZoneFactor
 *   mobile / tanpa zona aman        : readIntensityMobile
 *   opasitas maksimum area teks     : max(tengah kolom, mobile)         <- dasar pemeriksaan (a)
 *   kasus ekstrem (informasi)       : opasitas area teks × peakOverMean (titik terdekat + paling cerah)
 *
 * Pemeriksaan:
 *  (a) WAJIB   ink di atas satu titik beropasitas maksimum area teks >= 4,5:1 (latar --mat dan --bg).
 *  (b) LAPORAN muted dan accent (teks sekunder/kecil) di kondisi yang sama; bila < 4,5:1 titik TIDAK
 *              diredam lagi: dilaporkan sebagai temuan + saran warna teks.
 *  (c) LAPORAN keterlihatan: kontras latar vs latar+titik pada opasitas efektif tepi (target >= 1,6:1).
 *  (d) WAJIB   warna baca tidak sama/dekat dengan --ink (CIELAB dE76 >= 25).
 *
 * Jalankan: node scripts/check-reading-contrast.mjs   (butuh Node >= 22.18 untuk memuat .ts;
 * kode keluar 1 bila (a) atau (d) gagal)
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const { POINTFIELD_DEFAULTS: P, readStats } = await import(new URL('../src/config/pointfield.ts', import.meta.url).href)
const tokens = readFileSync(`${root}src/styles/tokens.css`, 'utf8')

function block(selector) {
  const start = tokens.indexOf(selector)
  if (start < 0) throw new Error(`blok ${selector} tidak ditemukan`)
  const open = tokens.indexOf('{', start)
  let depth = 0
  for (let i = open; i < tokens.length; i++) {
    if (tokens[i] === '{') depth++
    else if (tokens[i] === '}' && --depth === 0) return tokens.slice(open, i)
  }
  throw new Error(`blok ${selector} tidak ditutup`)
}
const get = (css, name) => {
  const hex = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1]
  if (!hex) throw new Error(`token ${name} tidak ditemukan`)
  return hex.toLowerCase()
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const blend = (bg, dot, a) => bg.map((v, i) => v * (1 - a) + dot[i] * a)
function lab(c) {
  const [r, g, b] = c.map(lin)
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047)
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b)
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]))

const stats = readStats(P)
const edge = P.readIntensity
const center = P.readIntensity * P.safeZoneFactor
const mobile = P.readIntensityMobile
const textMax = Math.max(center, mobile)
const extreme = Math.min(1, textMax * stats.peakOverMean)
const fmt = (n) => n.toFixed(2)

console.log('Opasitas efektif (rata-rata titik):')
console.log(`  tepi layar ${fmt(edge)} | tengah kolom ${fmt(center)} | mobile ${fmt(mobile)} | puncak jeda ${fmt(stats.mean)}`)
console.log(`  maks. area teks ${fmt(textMax)} (dasar a) | kasus ekstrem satu titik ${fmt(extreme)} (x${fmt(stats.peakOverMean)}, informasi)\n`)

const MIN_INK = 4.5
const MIN_VISIBLE = 1.6
const MIN_DISTANCE = 25
let failed = false
const findings = []

for (const [name, selector] of [
  ['Terang', ':root {'],
  ['Gelap', ":root[data-theme='dark'] {"],
]) {
  const css = block(selector)
  const text = { ink: get(css, '--ink'), muted: get(css, '--muted'), accent: get(css, '--accent') }
  const bgs = [get(css, '--mat'), get(css, '--bg')].map(rgb)
  const dots = [1, 2, 3].map((i) => get(css, `--titik-baca-${i}`))
  console.log(`== Tema ${name} (ink ${text.ink}, muted ${text.muted}, accent ${text.accent}, latar --mat ${toHex(bgs[0])}) ==`)

  /** Kontras terburuk teks `hex` di atas latar+titik `dot` pada opasitas `a`. */
  const worst = (hex, dot, a) => Math.min(...bgs.map((bg) => ratio(rgb(hex), blend(bg, rgb(dot), a))))

  for (const [i, dot] of dots.entries()) {
    const inkA = worst(text.ink, dot, textMax)
    const inkX = worst(text.ink, dot, extreme)
    const mutedA = worst(text.muted, dot, textMax)
    const accentA = worst(text.accent, dot, textMax)
    const visible = Math.min(...bgs.map((bg) => ratio(bg, blend(bg, rgb(dot), edge))))
    const rawVisible = Math.min(...bgs.map((bg) => ratio(bg, rgb(dot))))
    const distInk = dE(rgb(dot), rgb(text.ink))
    const distBg = Math.min(...bgs.map((bg) => dE(rgb(dot), bg)))
    const bad = []
    if (inkA < MIN_INK) bad.push(`(a) ink ${fmt(inkA)} < ${MIN_INK}`)
    if (distInk < MIN_DISTANCE) bad.push(`(d) dekat ink dE ${distInk.toFixed(0)} < ${MIN_DISTANCE}`)
    if (bad.length) failed = true
    if (inkX < MIN_INK) findings.push(`${name} ${dot}: ink ${fmt(inkX)}:1 hanya pada satu titik paling dekat+cerah (opasitas ${fmt(extreme)}); titik biasa lolos`)
    if (mutedA < 4.5) findings.push(`${name} ${dot}: muted ${fmt(mutedA)}:1`)
    if (accentA < 4.5) findings.push(`${name} ${dot}: accent (teks kecil) ${fmt(accentA)}:1`)
    if (visible < MIN_VISIBLE) findings.push(`${name} ${dot}: keterlihatan titik ${fmt(visible)}:1 (< ${MIN_VISIBLE}) di opasitas tepi ${fmt(edge)}`)
    console.log(
      `  baca-${i + 1} ${dot}  (a) ink ${fmt(inkA)}${inkA < MIN_INK ? ' GAGAL' : ' ok'} [ekstrem ${fmt(inkX)}]` +
        `  (b) muted ${fmt(mutedA)} accent ${fmt(accentA)}` +
        `  (c) terlihat ${fmt(visible)}${visible < MIN_VISIBLE ? ' <1,6' : ''} [titik penuh vs latar ${fmt(rawVisible)}]` +
        `  (d) dE ink ${distInk.toFixed(0)} dE latar ${distBg.toFixed(0)}${bad.length ? '  <-- ' + bad.join('; ') : ''}`,
    )
  }

  // Saran (b): geser muted ke arah ink sampai >= 4,5:1 untuk semua warna baca pada textMax.
  const inkRgb = rgb(text.ink)
  const mutedRgb = rgb(text.muted)
  let suggestion = null
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const candidate = mutedRgb.map((v, i) => v + (inkRgb[i] - v) * t)
    if (dots.every((dot) => worst(toHex(candidate), dot, textMax) >= 4.5)) {
      suggestion = toHex(candidate)
      break
    }
  }
  const current = Math.min(...dots.map((dot) => worst(text.muted, dot, textMax)))
  console.log(
    `  muted terburuk ${fmt(current)}:1` +
      (current >= 4.5
        ? ' (lolos)'
        : suggestion
          ? ` -> saran: ${text.muted} -> ${suggestion} (ink=${text.ink}); muted lama TIDAK diubah`
          : ' -> tidak ada saran yang cukup tanpa menyamai ink'),
  )
  console.log()
}

if (findings.length) {
  console.log('TEMUAN (laporan, tidak menggagalkan skrip; titik tidak diredam lagi):')
  for (const finding of findings) console.log('  - ' + finding)
}
console.log(failed ? '\nADA YANG GAGAL (a/d)' : '\n(a) ink >= 4,5:1 dan (d) jarak ke ink >= 25: lolos.')
process.exit(failed ? 1 : 0)
