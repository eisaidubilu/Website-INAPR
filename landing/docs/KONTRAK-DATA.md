# Kontrak data landing ↔ backend

Landing menampilkan dua daftar yang bisa berasal dari backend: **anggota** (#anggota) dan **arsip webinar** (#kegiatan).
Kode: `src/data/api.ts` (`getMembers()`, `getArchives()`). Landing **hanya membaca** (GET) dan **hanya memakai anon key**.

## Pemilihan sumber

Dibaca saat **build** (variabel `VITE_*` ditanam ke JavaScript; ubah → build ulang / redeploy). Urutan:

| Mode | Syarat | Yang dipanggil |
| --- | --- | --- |
| **a. Backend INAPR** | `VITE_API_BASE` terisi | `GET {VITE_API_BASE}/api/public/members` dan `/api/public/archives` |
| **b. Supabase langsung** | `VITE_API_BASE` kosong, `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` terisi | REST PostgREST (di bawah) |
| **c. Lokal** | selain itu | `src/data/members.json`, `src/data/webinars.json` (perilaku sebelumnya) |

`VITE_API_BASE` boleh `https://api.inapr.org` atau `/` (satu origin / lewat proxy dev). Nilai tidak valid (bukan http(s) atau `/…`) dianggap tidak ada → mode lokal;
bila `VITE_API_BASE` terisi tetapi tidak valid, mode (b) **tidak** dicoba.

### Mode (a): bentuk respons

```json
{ "items": [ { "nama": "…", "institusi": "…" } ] }
```

Nama field di `items` **sama dengan kolom Supabase** pada tabel di bawah (`nama`, `institusi`, `tanggal`, …). Backend bertugas hanya mengirim
anggota `status = Active` dan `tampil_di_publik = true`; landing tidak menyaring ulang. Field tambahan diabaikan (dibuang).

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

* Mode (a), dev: `npm run dev` mem-proxy `/api` ke `VITE_API_PROXY` (default `http://localhost:3000`) **hanya** bila `VITE_API_BASE` terisi.
  Pakai `VITE_API_BASE=/` agar browser memanggil same-origin. Di produksi, backend harus mengizinkan origin situs (CORS) atau berada di origin yang sama.
* Mode (b): Supabase sudah mengirim header CORS. Tidak ada proxy.
* Landing tidak mengirim cookie (`credentials: 'omit'`).

## Menyusul

* **Kegiatan mendatang (`activities`)** dan **berita**: belum disambungkan. Kartu kegiatan (`kegiatan.featured`/`kegiatan.items`) dan berita (`berita.items`) masih konten statis di `src/i18n`;
  endpoint `/api/public/activities` dan `/api/public/news` serta tabelnya akan ditambahkan di sini setelah kontraknya ditetapkan.
* Foto/ikon anggota, filter institusi, dan `papers` sengaja belum ada di UI.
