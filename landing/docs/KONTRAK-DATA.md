# Kontrak data landing ↔ backend

Landing menampilkan dua daftar yang bisa berasal dari backend: **anggota** (#anggota) dan **arsip webinar** (#kegiatan).
Kode: `src/data/api.ts` (`getMembers()`, `getArchives()`). Landing **hanya membaca** (GET) dan **hanya memakai anon key**.

## Pemilihan sumber

Dibaca saat **build** (variabel `VITE_*` ditanam ke JavaScript; ubah → build ulang / redeploy). Urutan prioritas:

| Mode | Syarat | Yang dipanggil |
| --- | --- | --- |
| **a. Backend eksplisit** | `VITE_API_BASE` terisi | `GET {VITE_API_BASE}/api/public/members` dan `/api/public/archives` |
| **a′. Same-origin** | `VITE_API_BASE` kosong **dan** build produksi (di dev: hanya bila `VITE_API_PROXY` terisi) | `GET /api/public/members` dan `GET /api/public/archives` (path **absolut**) |
| **b. Supabase langsung** | tidak ada (a)/(a′), `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` terisi | REST PostgREST (di bawah) |
| **c. Lokal** | selain itu | `src/data/members.json`, `src/data/webinars.json` (perilaku sebelumnya) |

`VITE_API_BASE` boleh `https://api.inapr.org` atau `/` (satu origin / lewat proxy dev). Nilai tidak valid (bukan http(s) atau `/…`) dianggap tidak ada → mode lokal;
bila `VITE_API_BASE` terisi tetapi tidak valid, mode (a′) dan (b) **tidak** dicoba.

**Akibat urutan ini:** pada build produksi tanpa `VITE_API_BASE`, mode (a′) selalu terpilih, jadi mode (b) (Supabase) praktis hanya terjangkau di dev server
(tanpa `VITE_API_PROXY`). Untuk memakai Supabase di produksi, tidak ada jalur otomatis; jika (a′) gagal, landing jatuh ke data **lokal**, bukan ke Supabase.

### Mode (a′): same-origin & embed ke app Next

Landing di-embed ke app Next dengan `npm run build:embed` (`vite build --base=/landing/`, plus prerender) dan dilayani di `/` lewat rewrite.
Seluruh asset memakai awalan `/landing/`, tetapi **panggilan API tidak**: landing memanggil `/api/public/members` dan `/api/public/archives` (tanpa `/landing`),
yang harus dijawab route handler milik app Next yang sama (satu origin, tanpa CORS).

* Path API dibuat absolut dengan sengaja; jangan diubah menjadi relatif terhadap `import.meta.env.BASE_URL`.
* Request tanpa cookie (`credentials: 'omit'`).
* Bila route belum ada / mengembalikan 404 / 5xx / HTML (mis. fallback SPA, `200 text/html`) / timeout, landing diam-diam memakai data lokal.
  Peramban tetap mencatat `Failed to load resource … 404` di konsol DevTools untuk 404; itu perilaku bawaan peramban, bukan galat di UI.
* Dev: `VITE_API_PROXY=http://localhost:3000 npm run dev` mem-proxy `/api` ke app Next lokal dan mengaktifkan mode ini.

### Mode (a)/(a′): bentuk respons

`200 application/json`, objek dengan satu kunci `items` berisi array. Nama field di `items` **sama dengan kolom Supabase**.
Backend bertugas hanya mengirim anggota `status = Active` dan `tampil_di_publik = true`; landing tidak menyaring ulang.
Field tambahan diabaikan (dibuang) oleh landing, tetapi **jangan dikirim** (lihat bagian data sensitif).

**`GET /api/public/members`**

```json
{
  "items": [
    { "nama": "Dr. Contoh Satu", "institusi": "Institut Teknologi Contoh" },
    { "nama": "Contoh Dua, M.Kom.", "institusi": "Universitas Contoh" },
    { "nama": "Contoh Tiga", "institusi": "" }
  ]
}
```

| Field | Tipe | Wajib | Batas / aturan |
| --- | --- | --- | --- |
| `items` | array | ya | **maks. 2000** item diproses; sisanya dibuang |
| `items[].nama` | string | ya | maks. 200 karakter; kosong/bukan string → item dibuang |
| `items[].institusi` | string | tidak | maks. 200 karakter; bukan string → `""` |

**`GET /api/public/archives`**

```json
{
  "items": [
    {
      "tanggal": "2025-11-20",
      "waktu": "16:00:00",
      "penyaji": "Dr. Contoh Satu",
      "institusi": "Institut Teknologi Contoh",
      "tema": "Pengenalan Pola untuk Citra Medis",
      "youtube_url": "https://www.youtube.com/watch?v=XXXXXXXXXXX",
      "materi_url": "https://example.org/slides/2025-11-20.pdf"
    },
    {
      "tanggal": "2025-10-02",
      "waktu": "16.00–17.00",
      "penyaji": "Contoh Dua",
      "institusi": "Universitas Contoh",
      "tema": "Topik Tanpa Video dan Slide",
      "youtube_url": null,
      "materi_url": null
    }
  ]
}
```

| Field | Tipe | Wajib | Batas / aturan |
| --- | --- | --- | --- |
| `items` | array | ya | **maks. 500** item diproses; landing mengurutkan ulang (tanggal terbaru dulu) |
| `items[].tanggal` | string | ya | `YYYY-MM-DD` (timestamp ISO dipotong ke tanggalnya); tanggal tidak ada di kalender / tidak valid → item dibuang |
| `items[].waktu` | string \| null | tidak | `HH:MM:SS` → `HH.MM`; teks bebas dipakai apa adanya (maks. 40 karakter) |
| `items[].tema` | string | ya | maks. 300 karakter; kosong → item dibuang |
| `items[].penyaji` | string \| null | tidak | maks. 200 karakter |
| `items[].institusi` | string \| null | tidak | maks. 200 karakter |
| `items[].youtube_url` | string \| null | tidak | **hanya URL `http(s)`** (maks. 2000 karakter); selain itu (`javascript:`, `data:`, relatif, …) → dianggap kosong |
| `items[].materi_url` | string \| null | tidak | **hanya URL `http(s)`** penuh, maks. 2000 karakter; selain itu → tanpa slide |

Seluruh string dirapikan (spasi ganda → satu, dipangkas) dan dirender sebagai teks (bukan HTML).

### Header respons yang disarankan

Data publik berubah jarang dan tidak personal, jadi boleh di-cache di CDN:

```
Content-Type: application/json; charset=utf-8
Cache-Control: public, s-maxage=300, stale-while-revalidate=3600
```

CDN menyimpan 5 menit dan boleh menyajikan salinan basi hingga 1 jam sambil menyegarkan di latar. Jangan menambahkan `Set-Cookie`; landing tidak mengirim/menerima cookie.
Opsional: `X-Content-Type-Options: nosniff`. Ukuran badan sebaiknya < 2 MB (landing menolak bila `Content-Length` lebih besar).

### Data sensitif: TIDAK boleh ada di endpoint publik

Endpoint `/api/public/*` terbuka untuk siapa saja dan di-cache CDN. **Dilarang** mengirim: nomor keanggotaan, alamat email, nomor telepon/WhatsApp, alamat rumah,
status/riwayat iuran, catatan internal, ID internal yang bisa dipakai menebak data lain, atau kolom privat lain. Landing membuang field tak dikenal, tetapi itu
bukan perlindungan: **data yang sudah terkirim ke peramban sudah bocor** (terlihat di tab Network). Backend wajib memilih kolom secara eksplisit (jangan `select *` / serialisasi
penuh objek DB) dan hanya mengirim anggota `status = Active` dengan `tampil_di_publik = true`.

### Mode (b): permintaan Supabase

Header: `apikey: <anon key>`, `Authorization: Bearer <anon key>`. Kolom ditulis eksplisit (tidak ada `select=*`).

```
GET {VITE_SUPABASE_URL}/rest/v1/members
    ?select=nama,institusi&status=eq.Active&tampil_di_publik=eq.true&order=nama.asc&limit=2000

GET {VITE_SUPABASE_URL}/rest/v1/activity_archives
    ?select=tanggal,waktu,penyaji,institusi,tema,youtube_url,materi_url&order=tanggal.desc&limit=500
```

Respons berupa array JSON polos. Keamanan bertumpu pada **RLS**: role `anon` hanya boleh `SELECT` pada kedua tabel itu
(idealnya hanya baris & kolom di atas, mis. lewat view). Service-role key tidak boleh ada di landing.

## Pemetaan field

**Anggota** → `Member`

| Sumber | Landing | Catatan |
| --- | --- | --- |
| `nama` | `name` | wajib; kosong → item dibuang. Maks. 200 karakter |
| `institusi` | `institution` | opsional; belum ditampilkan di UI |

Maks. 2000 item. Urutan dipakai apa adanya (Supabase: `nama.asc`). Pencarian & pagination tetap di sisi klien.

**Arsip webinar** → `Webinar`

| Sumber | Landing | Catatan |
| --- | --- | --- |
| `tanggal` | `date` | wajib; `YYYY-MM-DD` (timestamp ISO dipotong ke tanggalnya); tidak valid → item dibuang |
| `waktu` | `time` | `16:00:00` → `16.00`; teks bebas (`16.00–17.00`) dipakai apa adanya; kosong → tidak ditampilkan |
| `tema` | `title` | wajib; kosong → item dibuang. Maks. 300 karakter |
| `penyaji` | `speaker` | maks. 200 karakter |
| `institusi` | `institution` | maks. 200 karakter |
| `youtube_url` | `youtube` | hanya `http(s)`; selain itu / kosong → `""` (tombol "Tonton" diganti "tanpa video") |
| `materi_url` | `slides` | satu URL `http(s)` → `[url]`; kosong/tidak valid → `[]`. URL penuh dipakai apa adanya, **tidak** diawali `VITE_SLIDES_BASE_URL` |
| — | `papers` | selalu `[]` (belum ditampilkan) |

Maks. 500 item; diurutkan ulang di klien (tanggal terbaru dulu). Semua field lain dari respons dibuang.

## Perilaku saat gagal

Timeout **4 detik** per permintaan (termasuk membaca badan). Landing memakai **data lokal** bila: sumber tidak diatur, jaringan/CORS gagal,
timeout, status bukan 2xx, respons lebih dari 2 MB (bila `Content-Length` ada), bentuk respons tidak sesuai, atau tidak ada item valid.
Tidak ada error yang dilempar ke UI; `LoadNotice` ("Memuat…") tampil selama menunggu dan pesan galat hanya muncul bila data lokal pun gagal dimuat.
Di dev server, alasan fallback dicetak sebagai `console.warn("[data] …")`.

Catatan: sumber jauh yang menjawab sukses menggantikan seluruh data lokal. Angka besar "348 · per 19 April 2020" di #anggota adalah teks statis
(`src/i18n`), **tidak** mengikuti jumlah data dari backend.

## Server & CORS

* Mode (a)/(a′), dev: `npm run dev` mem-proxy `/api` ke `VITE_API_PROXY` (default `http://localhost:3000`) bila `VITE_API_BASE` **atau** `VITE_API_PROXY` terisi.
  Pakai `VITE_API_PROXY=…` (same-origin) atau `VITE_API_BASE=/` agar browser memanggil same-origin. Di produksi, backend harus mengizinkan origin situs (CORS) atau berada di origin yang sama
  (mode a′ selalu same-origin, jadi tidak butuh CORS).
* Mode (b): Supabase sudah mengirim header CORS. Tidak ada proxy.
* Landing tidak mengirim cookie (`credentials: 'omit'`).

## Menyusul

* **Kegiatan mendatang (`activities`)** dan **berita**: belum disambungkan. Kartu kegiatan (`kegiatan.featured`/`kegiatan.items`) dan berita (`berita.items`) masih konten statis di `src/i18n`;
  endpoint `/api/public/activities` dan `/api/public/news` serta tabelnya akan ditambahkan di sini setelah kontraknya ditetapkan.
* Foto/ikon anggota, filter institusi, dan `papers` sengaja belum ada di UI.
