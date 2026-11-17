# Deploy ke Vercel

Panduan langkah demi langkah untuk menaruh situs INAPR (folder `inapr-frontend`) di
[Vercel](https://vercel.com). Situs ini statis: Vercel menjalankan `npm run build` lalu
menyajikan folder `dist/`. Tidak ada server, database, atau rahasia.

> **Paket Hobby (gratis) Vercel ditujukan untuk penggunaan pribadi / non-komersial.**
> Bila pengurus INAPR menganggap situs organisasi ini termasuk penggunaan komersial,
> pakai paket berbayar (Pro) atau hosting lain. Putuskan ini sebelum memakai domain final.

## Apa saja yang sudah disiapkan

| File | Fungsi |
|---|---|
| `vercel.json` | Framework Vite, `npm run build`, output `dist`, header cache dan keamanan, header `noindex` selama draf. |
| `.vercelignore` | Mencegah `node_modules`, `dist`, dan file `.env*` lokal ikut terunggah lewat CLI. |
| `public/404.html` | Halaman 404 bertema. Vercel menampilkannya otomatis untuk alamat yang tidak ada. |
| `config/seo-plugin.ts` | Saklar `DRAFT_NOINDEX`: `robots.txt` berisi `Disallow: /`, meta robots `noindex`, tanpa sitemap. |
| `.env.example` | Daftar variabel env (`VITE_SITE_URL`, `VITE_SLIDES_BASE_URL`, `VITE_BASE`). |
| `package.json` | `engines.node`: `^20.19.0 \|\| >=22.12.0` (syarat Vite 8). |

Header di `vercel.json`:

- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`. Aman karena nama
  file di `assets/` mengandung hash; isi berubah = nama berubah.
- Semua rute: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Frame-Options: SAMEORIGIN` + `Content-Security-Policy: frame-ancestors 'self'` (situs
  tidak bisa dibingkai situs lain), `Permissions-Policy` yang mematikan kamera, mikrofon,
  lokasi, pembayaran, dan USB.
- Semua rute, **sementara**: `X-Robots-Tag: noindex, nofollow` (lihat bagian E).

Tidak ada rewrite SPA karena situs hanya satu halaman (`/`, navigasi pakai `#anchor`).
Alamat lain (mis. `/abc`) menampilkan `404.html` dengan status 404.

**Catatan `.htaccess`:** file `.htaccess` hanya dibaca server Apache. Vercel
mengabaikannya. Proyek ini tidak punya `.htaccess`; bila nanti ada (untuk hosting Apache),
biarkan saja, tidak mengganggu deploy Vercel. Pengaturan setara di Vercel ada di `vercel.json`.

---

## A. Uji lokal sebelum deploy

Butuh Node.js 20.19+ atau 22.12+ (cek dengan `node -v`).

1. Buka terminal di folder `inapr-frontend`.
2. `npm install` (sekali, atau setiap `package.json` berubah).
3. `npm run lint` harus selesai tanpa error.
4. `npm run build` harus selesai tanpa error. Baris terakhir berbunyi
   `prerender: ... kB HTML dimasukkan ke dist/index.html`.
5. `npm run preview`, lalu buka alamat yang dicetak (biasanya `http://localhost:4173`).
6. Cek cepat: halaman tampil, font benar, ganti tema dan bahasa jalan, latar titik 3D
   muncul setelah beberapa detik, console browser (F12) tanpa error merah.
7. Hentikan preview dengan `Ctrl+C`.

> `npm run preview` menampilkan halaman utama untuk alamat apa pun (mis. `/abc`), berbeda
> dari Vercel. Halaman 404 hanya bisa dicek setelah deploy (lihat bagian H), atau langsung
> di `http://localhost:4173/404.html`.

---

## B. Jalur 1: Vercel CLI (dari komputer sendiri)

Cocok untuk mencoba cepat tanpa GitHub.

1. Pasang CLI sekali saja: `npm i -g vercel`
2. Masuk: `vercel login`, lalu pilih cara login (mis. GitHub atau email) dan ikuti
   instruksi di browser. Token login disimpan oleh CLI di komputer Anda, bukan di proyek.
3. Di folder `inapr-frontend`, jalankan `vercel`. Jawaban untuk pertanyaan wizard:

   | Pertanyaan | Jawaban |
   |---|---|
   | Set up and deploy "…\inapr-frontend"? | `Y` |
   | Which scope should contain your project? | Pilih akun/tim Anda (atau tim INAPR bila sudah ada). |
   | Link to existing project? | `N` (pertama kali). Deploy berikutnya tidak ditanya lagi. |
   | What's your project's name? | mis. `inapr` atau `inapr-frontend` (huruf kecil, tanpa spasi). Ini menentukan URL `nama.vercel.app`. |
   | In which directory is your code located? | `./` (tekan Enter) |
   | Want to modify these settings? / Auto-detected Project Settings (Vite) | `N`. Pengaturan diambil dari `vercel.json`. |
   | Pertanyaan lain (mis. menghubungkan repo Git) | `N` / lewati. |

   Hasilnya **deployment preview** dengan URL sementara. Buka dan cek.
4. Bila sudah oke, terbitkan ke produksi: `vercel --prod`.
   URL produksi berbentuk `https://nama-proyek.vercel.app`.
5. CLI membuat folder `.vercel/` (berisi ID proyek). Folder ini aman disimpan lokal dan
   tidak di-commit (sudah ada di `.gitignore`).

> Deploy dari CLI mengunggah isi folder (kecuali yang ada di `.vercelignore`), lalu
> Vercel menjalankan `npm install` dan `npm run build` di servernya.

---

## C. Jalur 2: GitHub (deploy otomatis setiap push)

Cocok untuk jangka panjang: setiap push ke branch utama = deploy produksi baru.

1. Pemilik repo mem-push folder proyek ke GitHub (repo boleh privat). Pastikan
   `node_modules/`, `dist/`, dan `.env.local` tidak ikut (sudah diatur di `.gitignore`).
2. Masuk ke [vercel.com](https://vercel.com) dengan akun GitHub.
3. Klik **Add New… > Project**, lalu di bagian **Import Git Repository** pilih repo INAPR
   (beri izin Vercel ke repo itu bila diminta), klik **Import**.
4. Isi formulir **Configure Project**:
   - **Project Name**: mis. `inapr`.
   - **Framework Preset**: `Vite`.
   - **Root Directory**: folder yang berisi `package.json` proyek ini. Bila repo berisi
     folder `inapr-frontend` di dalamnya, pilih folder itu. Bila `package.json` ada di
     akar repo, biarkan `./`.
   - **Build and Output Settings**: Build Command `npm run build`, Output Directory `dist`,
     Install Command default (`npm install`). Nilai ini juga sudah ada di `vercel.json`.
   - **Environment Variables**: boleh diisi sekarang (lihat bagian D) atau nanti.
5. Klik **Deploy**. Tunggu sampai muncul layar selamat dan URL `nama.vercel.app`.
6. Selanjutnya setiap push ke branch produksi (biasanya `main`) otomatis dideploy.
   Push ke branch lain menghasilkan deployment preview.

> Deployment preview Vercel secara default dilindungi login Vercel (Deployment
> Protection) dan otomatis tidak diindeks. Deployment produksi terbuka untuk umum.

---

## D. Mengisi `VITE_SITE_URL` lalu redeploy

Variabel `VITE_*` **ditanam ke file hasil build**. Mengubahnya tidak berpengaruh sampai
build ulang, jadi setiap perubahan butuh redeploy.

1. Buka proyek di Vercel > **Settings > Environment Variables**.
2. Tambahkan:

   | Key | Value | Environment |
   |---|---|---|
   | `VITE_SITE_URL` | `https://nama-proyek.vercel.app` selama draf, nanti `https://inapr.org` (atau domain final). **Tanpa slash di akhir.** | Production (boleh juga Preview) |
   | `VITE_SLIDES_BASE_URL` | Kosongkan / jangan dibuat sampai hosting PDF slide diputuskan. | – |
   | `VITE_BASE` | **Jangan dibuat.** Vercel menyajikan situs di root domain (`/`). | – |

3. Klik **Save**.
4. Redeploy: tab **Deployments** > deployment teratas > menu **⋯** > **Redeploy**
   (atau jalankan `vercel --prod` lagi dari CLI, atau push commit baru).
5. Cek hasilnya: buka situs, lihat sumber halaman (`Ctrl+U`), pastikan ada
   `<link rel="canonical" href="https://…/">` dan `og:image` berisi URL lengkap.

Nilai `VITE_SITE_URL` yang tidak valid (mis. tanpa `https://`) membuat build gagal dengan
pesan jelas; perbaiki nilainya lalu redeploy.

---

## E. Mencabut `noindex` saat situs final

Selama draf, situs sengaja disembunyikan dari mesin pencari dengan **tiga lapis** yang
diatur di **dua tempat**. Cabut hanya setelah konten final disetujui pengurus.

1. Di `config/seo-plugin.ts`, ubah `export const DRAFT_NOINDEX: boolean = true` menjadi
   `false`. Efeknya: `robots.txt` menjadi `Allow: /` + baris `Sitemap:`, `sitemap.xml`
   dibuat (bila `VITE_SITE_URL` terisi), dan meta `noindex` hilang dari `index.html`.
2. Di `vercel.json`, hapus baris header berikut (perhatikan koma di baris sebelumnya
   agar JSON tetap valid):

   ```json
   { "key": "X-Robots-Tag", "value": "noindex, nofollow" }
   ```

3. Pastikan `VITE_SITE_URL` di Vercel berisi **domain final** (bagian D), karena sitemap
   dan URL kanonik dibuat dari nilai ini.
4. `npm run lint` dan `npm run build` lokal, cek `dist/robots.txt` sudah `Allow: /`.
5. Deploy (push ke GitHub atau `vercel --prod`).
6. Cek di produksi:
   - `https://domain/robots.txt` berisi `Allow: /` dan `Sitemap: https://domain/sitemap.xml`.
   - `https://domain/sitemap.xml` terbuka.
   - Header respons halaman utama tidak lagi berisi `X-Robots-Tag` (DevTools > Network >
     klik dokumen > Response Headers).
7. (Opsional) Daftarkan domain di Google Search Console dan kirim `sitemap.xml`.

---

## F. Menghubungkan domain kustom

1. Proyek di Vercel > **Settings > Domains** > **Add**. Ketik domain, mis. `inapr.org`,
   dan bila ditawari, tambahkan juga `www.inapr.org` (salah satunya dialihkan ke yang lain).
2. Vercel menampilkan record DNS yang harus dibuat. **Pakai nilai yang ditampilkan
   Vercel** (bisa berbeda per proyek). Bentuk umumnya:

   | Domain | Tipe | Name / Host | Value (contoh) |
   |---|---|---|---|
   | Domain utama (`inapr.org`) | `A` | `@` | `76.76.21.21` |
   | Subdomain (`www.inapr.org`) | `CNAME` | `www` | `cname.vercel-dns.com` |

3. Buat record tersebut di panel DNS tempat domain didaftarkan (registrar/pengelola DNS).
   Hapus record `A`/`CNAME` lama yang menunjuk ke hosting lama untuk nama yang sama.
   **Hati-hati:** jangan mengubah record `MX` (email) atau `TXT` yang sudah ada.
4. Tunggu propagasi DNS (beberapa menit sampai 48 jam). Status di Vercel berubah menjadi
   **Valid Configuration**.
5. SSL (HTTPS) dibuat dan diperpanjang **otomatis** oleh Vercel setelah DNS valid. Tidak
   perlu memasang sertifikat sendiri.
6. Perbarui `VITE_SITE_URL` ke domain baru (bagian D) lalu redeploy.

> Memindahkan domain `inapr.org` dari hosting lama berarti situs lama berhenti tampil di
> domain itu. Koordinasikan dengan pengurus dan pengelola domain dulu.

---

## G. Rollback ke deployment sebelumnya

Bila deploy baru bermasalah:

1. Proyek di Vercel > tab **Deployments**.
2. Cari deployment produksi terakhir yang masih benar.
3. Menu **⋯** > **Instant Rollback** (atau **Promote to Production**). Konfirmasi.
   Domain langsung menunjuk ke deployment itu tanpa build ulang.
4. Alternatif CLI: `vercel rollback` (deployment produksi sebelumnya) atau
   `vercel rollback <url-deployment>`.
5. Setelah rollback, deploy otomatis dari push berikutnya bisa tertahan sampai Anda
   mengembalikannya; ikuti petunjuk di dashboard (tombol **Undo Rollback** / promote).
6. Perbaiki masalahnya di kode, uji lokal (bagian A), lalu deploy lagi.

> Di paket Hobby, pilihan rollback bisa terbatas (mis. hanya ke deployment produksi
> sebelumnya). Lihat pilihan yang tersedia di dashboard.

---

## H. Checklist uji setelah deploy

Uji di URL produksi, di desktop dan di ponsel.

- [ ] Halaman utama termuat cepat; teks terbaca sebelum animasi muncul.
- [ ] Font benar (judul Montserrat, subjudul Lato, isi Hind Siliguri), tidak jatuh ke font sistem.
- [ ] Console browser (F12) tanpa error merah.
- [ ] **Tema**: Terang, Gelap, Sistem bisa dipilih; pilihan tetap setelah refresh.
- [ ] **Bahasa**: ID/EN bisa diganti; pilihan tetap setelah refresh.
- [ ] **Jeda 3D di mobile**: scroll seluruh halaman di ponsel; bentuk titik muncul di tiap
      jeda, gerak tidak patah-patah, tanpa teks di jeda. Dengan "kurangi gerakan"
      (reduce motion) aktif, latar diam.
- [ ] Menu navbar melompat ke section yang benar.
- [ ] **Tautan webinar**: daftar webinar termuat, pencarian/halaman berjalan, tautan
      membuka tujuan yang benar. Tombol "Slide" memang tersembunyi selama
      `VITE_SLIDES_BASE_URL` kosong.
- [ ] Daftar anggota termuat.
- [ ] **Favicon** tampil di tab browser; ikon di layar utama iOS (apple-touch-icon).
- [ ] **OG**: tempel URL di pratinjau tautan (mis. WhatsApp, atau
      [opengraph.xyz](https://www.opengraph.xyz)); judul, deskripsi, dan gambar muncul.
      Butuh `VITE_SITE_URL` terisi.
- [ ] `https://domain/abc` menampilkan halaman 404 bertema, tombol kembali berfungsi.
- [ ] `https://domain/robots.txt`: selama draf `Disallow: /`; setelah final `Allow: /`.
- [ ] Header respons (DevTools > Network > dokumen): ada `X-Content-Type-Options`,
      `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, dan selama draf
      `X-Robots-Tag: noindex, nofollow`. File di `/assets/` ber-`Cache-Control` `immutable`.

---

## Versi Node di Vercel

Vercel membaca `engines.node` di `package.json` (`^20.19.0 || >=22.12.0`). Karena
rentangnya terbuka ke atas, Vercel memakai versi Node LTS terbaru yang didukungnya dan
mungkin menampilkan peringatan "automatically upgrade". Itu wajar. Bila ingin versi tetap,
pilih **Node.js Version** di **Settings > Build and Deployment** (mis. 22.x atau 24.x).
