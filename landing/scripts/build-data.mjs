#!/usr/bin/env node
/**
 * Skrip sekali-jalan: ekstrak data anggota dan webinar dari arsip situs lama
 * (read-only) ke src/data/*.json. Tidak ikut dibundel.
 *
 *   node scripts/build-data.mjs [folder-inapr.org]
 *
 * Default sumber: ../inapr.org (relatif terhadap folder proyek).
 * Hanya Node bawaan, tanpa dependensi. Laporan pembersihan dicetak ke console.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(process.argv[2] ?? join(ROOT, '..', 'inapr.org'))
const OUT = join(ROOT, 'src', 'data')

/** Angka resmi di situs lama. */
const OFFICIAL_TOTAL = 348
const AS_OF = '2020-04-19'

const read1252 = (path) => new TextDecoder('windows-1252').decode(readFileSync(path))

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }
function cellText(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/g, (_, e) => ENTITIES[e])
    .replace(/[\s ]+/g, ' ')
    .trim()
}

/** Ambil semua <td> per baris. Tahan HTML rusak: dipecah di setiap "<tr". */
function tableRows(html) {
  return html
    .split(/<tr\b/i)
    .slice(1)
    .map((chunk) => [...chunk.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]))
}

/** Semua href di potongan HTML (dengan atau tanpa tanda kutip). */
function hrefs(html) {
  return [...html.matchAll(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((m) =>
    (m[1] ?? m[2] ?? m[3]).trim(),
  )
}

const report = []
const note = (msg) => report.push(msg)

// ---------------------------------------------------------------------------
// Anggota
// ---------------------------------------------------------------------------

/** Kapitalisasi kata yang diawali huruf kecil, hanya di bagian nama (sebelum koma gelar). */
function normalizeName(raw) {
  let name = raw.replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()
  const comma = name.indexOf(',')
  const person = comma === -1 ? name : name.slice(0, comma)
  const degrees = comma === -1 ? '' : name.slice(comma)
  const fixed = person.replace(/(^|[\s.])([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase())
  name = fixed + degrees.replace(/\bpH\.D\./g, 'Ph.D.')
  return name
}

/** Kunci pembanding: nama tanpa gelar depan/belakang, huruf kecil, tanpa tanda baca. */
function baseKey(name) {
  return name
    .split(',')[0]
    .replace(/^((Prof|Dr|Dra|Drs|Ir|Eng|rer\.nat)\.?\s*)+/gi, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/** Kunci urut: tanpa gelar di depan. */
function sortKey(name) {
  return name.replace(/^((Prof|Dr|Dra|Drs|Ir)\.?\s*(Eng\.|rer\.nat\.)?\s*)+/i, '')
}

function buildMembers() {
  const html = read1252(join(SOURCE, 'memberlist_files', 'sheet001.htm'))
  const rows = tableRows(html)
    .map((cells) => cells.map(cellText))
    // Baris data: kolom kedua berisi nomor urut. Kolom: [kosong, No., Name, Membership No.]
    .filter((cells) => /^\d+$/.test(cells[1] ?? ''))
    .map((cells) => ({ no: Number(cells[1]), name: cells[2] ?? '', memberNo: cells[3] ?? '' }))

  note(`Anggota: ${rows.length} baris data di sumber (No. ${rows[0]?.no}–${rows.at(-1)?.no}).`)
  note(`Anggota: kolom sumber = No., Name, Membership No. Disimpan: Name saja.`)

  const empty = rows.filter((r) => !r.name)
  if (empty.length) note(`Anggota: ${empty.length} baris nama kosong dibuang (No. ${empty.map((r) => r.no).join(', ')}).`)

  const kept = []
  const byKey = new Map()
  for (const row of rows.filter((r) => r.name)) {
    const name = normalizeName(row.name)
    if (name !== row.name.replace(/\s+/g, ' ').trim()) note(`Anggota #${row.no}: "${row.name}" → "${name}"`)
    const key = baseKey(name)
    const prev = byKey.get(key)
    // Duplikat pasti: nama dasar sama DAN nomor anggota sama.
    if (prev && row.memberNo && prev.memberNo === row.memberNo) {
      note(`Anggota #${row.no} "${name}" dibuang: duplikat #${prev.no} (No. anggota ${row.memberNo}).`)
      continue
    }
    if (prev) note(`Anggota #${row.no} "${name}": nama sama dengan #${prev.no}, TETAP disimpan (tidak ada bukti orang yang sama).`)
    const entry = { no: row.no, memberNo: row.memberNo, name }
    if (!prev) byKey.set(key, entry)
    kept.push(entry)
  }

  const collator = new Intl.Collator('id', { sensitivity: 'base' })
  kept.sort((a, b) => collator.compare(sortKey(a.name), sortKey(b.name)))

  if (kept.length !== OFFICIAL_TOTAL) {
    note(`Anggota: hasil hitung ${kept.length} ≠ angka resmi ${OFFICIAL_TOTAL}.`)
  }

  return {
    source: 'inapr.org/memberlist.html (sheet "web")',
    asOf: AS_OF,
    officialTotal: OFFICIAL_TOTAL,
    // Hanya nama. Nomor anggota sengaja tidak disimpan (lihat README).
    members: kept.map((m) => ({ name: m.name })),
  }
}

// ---------------------------------------------------------------------------
// Webinar
// ---------------------------------------------------------------------------

function isoDate(text) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text.trim())
  if (!m) throw new Error(`Tanggal tidak dikenal: "${text}"`)
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** URL YouTube → bentuk baku https://www.youtube.com/watch?v=ID (tanpa list/index/t). */
function youtubeUrl(url) {
  try {
    const u = new URL(url)
    const id = u.hostname === 'youtu.be' ? u.pathname.slice(1) : u.searchParams.get('v')
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : ''
  } catch {
    return ''
  }
}

function buildWebinars() {
  const html = read1252(join(SOURCE, 'webinar.html'))
  const rows = tableRows(html).filter((cells) => cells.length === 7)
  const seenSlides = new Map()

  const items = rows.map((cells) => {
    const [dateH, timeH, speakerH, instH, titleH, ytH, matH] = cells
    const date = isoDate(cellText(dateH))
    const ytRaw = hrefs(ytH)[0] ?? ''
    const youtube = ytRaw ? youtubeUrl(ytRaw) : ''
    if (ytRaw && !youtube) note(`Webinar ${date}: URL YouTube tidak dikenali "${ytRaw}".`)

    const links = hrefs(matH)
    const slides = links
      .filter((h) => /\.pdf$/i.test(h) && /^(https?:\/\/(www\.)?inapr\.org\/)?[\w.-]+\.pdf$/i.test(h))
      .map((h) => h.split('/').pop())
    const papers = links.filter((h) => !slides.some((s) => h.endsWith(s)))

    const item = {
      date,
      time: cellText(timeH).replace(/\s*-\s*/, '–'),
      speaker: cellText(speakerH),
      institution: cellText(instH).replace(/^Univ\. /, 'Universitas '),
      title: cellText(titleH),
      youtube,
      slides,
      papers,
    }

    const missing = []
    if (!item.youtube) missing.push('YouTube')
    if (!item.slides.length) missing.push('slide PDF')
    if (missing.length) note(`Webinar ${date} (${item.speaker}): tanpa ${missing.join(' dan ')}.`)
    for (const s of slides) {
      if (seenSlides.has(s)) note(`Webinar ${date}: file ${s} juga dipakai sesi ${seenSlides.get(s)}.`)
      else seenSlides.set(s, date)
    }
    return item
  })

  items.sort((a, b) => b.date.localeCompare(a.date))
  note(`Webinar: ${items.length} sesi, ${items.at(-1)?.date} s.d. ${items[0]?.date}.`)
  return { source: 'inapr.org/webinar.html', items }
}

// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true })
const write = (file, data) => {
  const text = JSON.stringify(data, null, 1) + '\n'
  writeFileSync(join(OUT, file), text)
  note(`${file}: ${(Buffer.byteLength(text) / 1024).toFixed(1)} kB`)
}
write('members.json', buildMembers())
write('webinars.json', buildWebinars())
console.log(report.join('\n'))
