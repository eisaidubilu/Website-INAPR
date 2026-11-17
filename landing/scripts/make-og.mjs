#!/usr/bin/env node
/**
 * Skrip sekali-jalan: membuat aset ikon dan gambar berbagi dari kode.
 *
 *   node scripts/make-og.mjs
 *
 * Hasil (ditimpa bila sudah ada):
 *   public/favicon.svg           motif titik, warna dari token
 *   public/apple-touch-icon.png  180x180
 *   public/og.png                1200x630 (Open Graph / Twitter)
 *
 * Warna dibaca dari src/styles/tokens.css (tema Terang). Font Montserrat diambil
 * dari @fontsource (.woff), dikonversi sementara ke TTF supaya bisa dibaca
 * fontconfig milik sharp. Butuh devDependency `sharp`.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')

// ---------------------------------------------------------------------------
// Token warna (blok :root pertama = tema Terang)
// ---------------------------------------------------------------------------
const css = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8')
const rootBlock = /:root\s*\{([\s\S]*?)\}/.exec(css)?.[1] ?? ''
const token = (name) => {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`).exec(rootBlock)?.[1]
  if (!value) throw new Error(`Token --${name} tidak ditemukan di tokens.css`)
  return value
}
const C = {
  bg: token('bg'),
  mat: token('mat'),
  ink: token('ink'),
  accent: token('accent'),
  muted: token('muted'),
  gridMinor: token('grid-minor'),
  gridMajor: token('grid-major'),
  dots: [token('titik-1'), token('titik-2'), token('titik-3')],
}

// ---------------------------------------------------------------------------
// Font: WOFF 1.0 → TTF (tabel zlib), untuk fontconfig
// ---------------------------------------------------------------------------
function woffToSfnt(buf) {
  if (buf.toString('ascii', 0, 4) !== 'wOFF') throw new Error('Bukan file WOFF')
  const count = buf.readUInt16BE(12)
  const header = Buffer.alloc(12 + 16 * count)
  const selector = Math.floor(Math.log2(count))
  const range = 2 ** selector * 16
  header.writeUInt32BE(buf.readUInt32BE(4), 0)
  header.writeUInt16BE(count, 4)
  header.writeUInt16BE(range, 6)
  header.writeUInt16BE(selector, 8)
  header.writeUInt16BE(count * 16 - range, 10)
  const parts = [header]
  let offset = header.length
  for (let i = 0; i < count; i++) {
    const entry = 44 + i * 20
    const at = buf.readUInt32BE(entry + 4)
    const compressed = buf.readUInt32BE(entry + 8)
    const length = buf.readUInt32BE(entry + 12)
    let data = buf.subarray(at, at + compressed)
    if (compressed < length) data = inflateSync(data)
    const record = 12 + i * 16
    header.writeUInt32BE(buf.readUInt32BE(entry), record)
    header.writeUInt32BE(buf.readUInt32BE(entry + 16), record + 4)
    header.writeUInt32BE(offset, record + 8)
    header.writeUInt32BE(length, record + 12)
    const pad = (4 - (data.length % 4)) % 4
    parts.push(data, Buffer.alloc(pad))
    offset += data.length + pad
  }
  return Buffer.concat(parts)
}

// fontconfig membaca FONTCONFIG_FILE dari environment proses saat mulai. Mengubah
// process.env setelah Node berjalan tidak selalu terbaca (Windows), jadi skrip ini
// menyiapkan font lalu menjalankan dirinya sendiri sebagai proses anak.
if (!process.env.INAPR_OG_RENDER) {
  const fontDir = mkdtempSync(join(tmpdir(), 'inapr-og-'))
  const slash = (path) => path.replaceAll('\\', '/')
  try {
    for (const weight of [300, 800]) {
      const woff = readFileSync(
        join(ROOT, 'node_modules', '@fontsource', 'montserrat', 'files', `montserrat-latin-${weight}-normal.woff`),
      )
      writeFileSync(join(fontDir, `montserrat-${weight}.ttf`), woffToSfnt(woff))
    }
    const fontsConf = join(fontDir, 'fonts.conf')
    writeFileSync(
      fontsConf,
      `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${slash(fontDir)}</dir><cachedir>${slash(join(fontDir, 'cache'))}</cachedir></fontconfig>`,
    )
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
      stdio: 'inherit',
      env: { ...process.env, INAPR_OG_RENDER: '1', FONTCONFIG_FILE: fontsConf },
    })
    process.exitCode = child.status ?? 1
  } finally {
    rmSync(fontDir, { recursive: true, force: true })
  }
} else {
  await render()
}

async function render() {
  const { default: sharp } = await import('sharp')
  writeFileSync(join(PUBLIC, 'favicon.svg'), `${iconSvg(32, 6)}\n`)
  await sharp(Buffer.from(iconSvg(180, 0))).png().toFile(join(PUBLIC, 'apple-touch-icon.png'))
  await sharp(Buffer.from(ogSvg()))
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toFile(join(PUBLIC, 'og.png'))
  console.log('Selesai: public/favicon.svg, public/apple-touch-icon.png, public/og.png')
}

// ---------------------------------------------------------------------------
// Favicon: kisi titik 4x4, diagonal disorot (pola yang "dikenali")
// ---------------------------------------------------------------------------
function iconSvg(size, radius) {
  const unit = size / 32
  const dots = []
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const hit = row === col
      const cx = (7.75 + col * 5.5) * unit
      const cy = (7.75 + row * 5.5) * unit
      dots.push(
        `<circle cx="${cx}" cy="${cy}" r="${(hit ? 2.3 : 1.5) * unit}" fill="${hit ? C.dots[2] : C.bg}"/>`,
      )
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${C.ink}"/>${dots.join('')}</svg>`
}

// ---------------------------------------------------------------------------
// OG image 1200x630: cutting mat + bola titik (seperti latar 3D) + teks
// ---------------------------------------------------------------------------
function ogSvg() {
  const W = 1200
  const H = 630
  const lines = []
  for (let x = 0; x <= W; x += 24) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${x % 120 ? C.gridMinor : C.gridMajor}" stroke-width="1"/>`)
  for (let y = 0; y <= H; y += 24) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${y % 120 ? C.gridMinor : C.gridMajor}" stroke-width="1"/>`)

  // Bola Fibonacci, diputar sedikit, diproyeksikan; palet sama dengan engine (i%7, i%3).
  const N = 900
  const cx = 960
  const cy = 315
  const R = 200
  const tiltY = 0.7
  const tiltX = 0.38
  const points = []
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N
    const r = Math.sqrt(1 - y * y)
    const phi = i * Math.PI * (3 - Math.sqrt(5))
    let x = Math.cos(phi) * r
    let z = Math.sin(phi) * r
    let yy = y
    ;[x, z] = [x * Math.cos(tiltY) + z * Math.sin(tiltY), -x * Math.sin(tiltY) + z * Math.cos(tiltY)]
    ;[yy, z] = [yy * Math.cos(tiltX) - z * Math.sin(tiltX), yy * Math.sin(tiltX) + z * Math.cos(tiltX)]
    const color = C.dots[i % 7 === 0 ? 1 : i % 3 === 0 ? 2 : 0]
    const size = 3 + (z + 1) * 2.2
    points.push({ z, svg: `<rect x="${(cx + x * R - size / 2).toFixed(1)}" y="${(cy - yy * R - size / 2).toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${color}" opacity="${(0.45 + (z + 1) * 0.27).toFixed(2)}"/>` })
  }
  points.sort((a, b) => a.z - b.z)

  const font = 'Montserrat'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.mat}"/>
  ${lines.join('')}
  ${points.map((p) => p.svg).join('')}
  <rect x="80" y="96" width="44" height="12" fill="${C.accent}"/><rect x="80" y="108" width="44" height="12" fill="${C.ink}"/>
  <text x="80" y="176" font-family="${font}" font-weight="800" font-size="18" letter-spacing="3" fill="${C.accent}">INDONESIAN ASSOCIATION FOR PATTERN RECOGNITION</text>
  <text x="72" y="330" font-family="${font}" font-weight="800" font-size="150" letter-spacing="2" fill="${C.ink}">INAPR</text>
  <text x="80" y="420" font-family="${font}" font-weight="300" font-size="36" fill="${C.ink}">Komunitas nasional peneliti dan</text>
  <text x="80" y="468" font-family="${font}" font-size="36" fill="${C.ink}"><tspan font-weight="300">praktisi</tspan><tspan dx="11" font-weight="800" fill="${C.accent}">pengenalan pola.</tspan></text>
</svg>`
}
