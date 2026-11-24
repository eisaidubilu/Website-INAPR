/**
 * Sumber data anggota & arsip webinar. Kontrak lengkap: docs/KONTRAK-DATA.md.
 *
 * Urutan pemilihan sumber (dibaca saat build, lihat .env.example):
 *   a. VITE_API_BASE                                   → GET {base}/api/public/members | archives  ({ items: [...] })
 *   b. VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY      → REST Supabase langsung (hanya SELECT, anon key)
 *   c. selain itu                                      → data lokal (src/data/*.json)
 *
 * Aturan: hanya membaca (GET), hanya anon key, tidak pernah melempar error. Bila sumber jauh
 * gagal / timeout / respons tidak valid / kosong, jatuh ke data lokal.
 */
import {
  loadMembers,
  loadWebinars,
  type Member,
  type MembersData,
  type Webinar,
  type WebinarsData,
} from './index'

const TIMEOUT_MS = 4000
const MAX_MEMBERS = 2000
const MAX_ARCHIVES = 500
/** Batas ukuran badan respons (hanya bila server mengirim Content-Length). */
const MAX_BODY_BYTES = 2_000_000

type Source =
  | { kind: 'api'; base: string }
  | { kind: 'supabase'; origin: string; anonKey: string }

// ---------- Pemilihan sumber ----------

/** "/" atau "/x/" (relatif ke situs) atau URL http(s) → basis tanpa slash akhir; selain itu null. */
function parseApiBase(raw: string): string | null {
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw.replace(/\/+$/, '')
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

function parseOrigin(raw: string): string | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

function resolveSource(): Source | null {
  const env = import.meta.env
  const apiBase = env.VITE_API_BASE?.trim()
  if (apiBase) {
    const base = parseApiBase(apiBase)
    return base === null ? null : { kind: 'api', base }
  }
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (supabaseUrl && anonKey) {
    const origin = parseOrigin(supabaseUrl)
    return origin === null ? null : { kind: 'supabase', origin, anonKey }
  }
  return null
}

const SOURCE = resolveSource()

// Kolom eksplisit saja; jangan pakai select=* (mencegah kolom privat ikut terkirim).
const SUPABASE_MEMBERS =
  '/rest/v1/members?select=nama,institusi&status=eq.Active&tampil_di_publik=eq.true&order=nama.asc&limit=2000'
const SUPABASE_ARCHIVES =
  '/rest/v1/activity_archives?select=tanggal,waktu,penyaji,institusi,tema,youtube_url,materi_url&order=tanggal.desc&limit=500'

// ---------- Fetch ----------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function warn(message: string, error?: unknown) {
  if (import.meta.env.DEV) console.warn(`[data] ${message}, memakai data lokal.`, error ?? '')
}

/** GET → array mentah (belum divalidasi per item), atau null bila gagal. Tidak pernah melempar. */
async function fetchItems(resource: 'members' | 'archives', source: Source): Promise<unknown[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    let url: string
    if (source.kind === 'api') {
      url = `${source.base}/api/public/${resource}`
    } else {
      url = `${source.origin}${resource === 'members' ? SUPABASE_MEMBERS : SUPABASE_ARCHIVES}`
      headers.apikey = source.anonKey
      headers.Authorization = `Bearer ${source.anonKey}`
    }
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'omit',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const length = Number(response.headers.get('content-length'))
    if (length > MAX_BODY_BYTES) throw new Error('respons terlalu besar')

    // Pembacaan badan tetap berada di bawah timeout yang sama.
    const body: unknown = await response.json()
    // api: { items: [...] }; supabase: array polos.
    const items = source.kind === 'api' ? (isRecord(body) ? body.items : undefined) : body
    if (!Array.isArray(items)) throw new Error('bentuk respons tidak dikenali')
    return items
  } catch (error) {
    warn(`Sumber ${source.kind} (${resource}) gagal`, error)
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------- Type guard & pembersih field ----------

/** String dirapikan (spasi tunggal, dipangkas); non-string → "". Tanpa HTML: React yang meng-escape. */
function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** Hanya http(s); skema lain (javascript:, data:, …) ditolak. Mengembalikan "" bila tidak valid. */
function httpUrl(value: unknown): string {
  const raw = text(value, 2000)
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''
  } catch {
    return ''
  }
}

/** "2022-09-02" atau timestamp ISO → "2022-09-02"; tidak valid → "". */
function isoDate(value: unknown): string {
  const day = /^\d{4}-\d{2}-\d{2}(?=$|[T ])/.exec(text(value, 40))?.[0]
  if (!day) return ''
  const date = new Date(`${day}T00:00:00Z`)
  // Tolak tanggal yang tidak ada di kalender (mis. 2022-02-31).
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day) ? day : ''
}

/** "16:00:00" (kolom time) → "16.00" (gaya data lokal); teks bebas ("16.00–17.00") dibiarkan. */
function timeLabel(value: unknown): string {
  const raw = text(value, 40)
  const clock = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(raw)
  return clock ? `${clock[1].padStart(2, '0')}.${clock[2]}` : raw
}

// ---------- Mapper ----------

/** { nama, institusi } → Member. Field lain dibuang. */
function toMember(raw: unknown): Member | null {
  if (!isRecord(raw)) return null
  const name = text(raw.nama, 200)
  if (!name) return null
  return { name, institution: text(raw.institusi, 200) }
}

/** { tanggal, waktu, tema, penyaji, institusi, youtube_url, materi_url } → Webinar. Field lain dibuang. */
function toWebinar(raw: unknown): Webinar | null {
  if (!isRecord(raw)) return null
  const date = isoDate(raw.tanggal)
  const title = text(raw.tema, 300)
  if (!date || !title) return null
  const slides = httpUrl(raw.materi_url)
  return {
    date,
    time: timeLabel(raw.waktu),
    speaker: text(raw.penyaji, 200),
    institution: text(raw.institusi, 200),
    title,
    youtube: httpUrl(raw.youtube_url),
    slides: slides ? [slides] : [],
    papers: [],
  }
}

function mapAll<T>(items: unknown[], max: number, map: (raw: unknown) => T | null): T[] {
  const result: T[] = []
  for (const raw of items.slice(0, max)) {
    const item = map(raw)
    if (item) result.push(item)
  }
  return result
}

// ---------- API publik ----------

/** Satu kali ambil per sesi halaman; dibuang bila gagal total supaya bisa dicoba lagi. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }
}

/** Anggota publik (aktif & tampil di publik). Sumber jauh bila ada, kalau tidak/gagal: data lokal. */
export const getMembers = once<MembersData>(async () => {
  if (SOURCE) {
    const raw = await fetchItems('members', SOURCE)
    const members = raw ? mapAll(raw, MAX_MEMBERS, toMember) : []
    if (members.length) {
      return {
        source: SOURCE.kind,
        asOf: new Date().toISOString().slice(0, 10),
        officialTotal: members.length,
        members,
      }
    }
    if (raw) warn('Sumber anggota kosong/tidak valid')
  }
  return loadMembers()
})

/** Arsip webinar (terbaru dulu). Sumber jauh bila ada, kalau tidak/gagal: data lokal. */
export const getArchives = once<WebinarsData>(async () => {
  if (SOURCE) {
    const raw = await fetchItems('archives', SOURCE)
    const items = raw ? mapAll(raw, MAX_ARCHIVES, toWebinar) : []
    if (items.length) {
      // Komponen mengandaikan terbaru dulu; jangan bergantung pada urutan dari server.
      items.sort((a, b) => b.date.localeCompare(a.date))
      return { source: SOURCE.kind, items }
    }
    if (raw) warn('Sumber arsip kosong/tidak valid')
  }
  return loadWebinars()
})
