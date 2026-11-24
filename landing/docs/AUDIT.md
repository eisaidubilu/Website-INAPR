# Audit landing `inapr-frontend`: keringanan dan kelancaran

Tanggal ukur: 2026-11-24. Mode audit: tidak ada kode, konfigurasi, atau konten yang diubah. Satu-satunya berkas yang dibuat di repo adalah dokumen ini.

## 0. Metode dan batasan (baca dulu)

- **Build yang diukur**: salinan repo di folder temp (di luar repo) dengan `npm run build`. Hash berkas identik dengan `dist/` repo (`index-CPQp-nfa.js`, `engine-BupBikzv.js`), jadi hasilnya setara. `dist/` repo tidak disentuh.
- **Server ukur**: (a) `vite preview` (tanpa kompresi, `no-cache`) dan (b) server statis sementara dengan brotli + `Cache-Control` seperti `vercel.json`. Angka "brotli" mendekati Vercel; kompresi di Vercel sendiri tidak diverifikasi (belum ada deploy).
- **Mesin**: Intel Core Ultra 7 155H, GPU Intel Arc (D3D11), Chrome 157 headless, Windows 11. Throttling CPU hanya memperlambat thread utama; **GPU tidak diperlambat**, jadi tidak mewakili GPU HP kelas bawah.
- **Derau**: mesin ini berderau. Pada konfigurasi yang sama, persentase frame >25 ms bergeser antar-batch (baseline 13–18% di satu batch, 19–28% di batch lain). Perbandingan hanya dipercaya bila dijalankan berdampingan dan diulang (n=5).
- Perubahan sisi repo selain dokumen ini: `tsc -b` menulis cache `node_modules/.tmp/*.tsbuildinfo` (cache build, bukan sumber). Skrip ukur ada di folder temp dan tidak dimasukkan ke repo.

## 1. Ringkasan eksekutif

| Metrik | Hasil |
|---|---|
| Lighthouse mobile (4x CPU, simulasi 1,6 Mbps/150 ms), server brotli, n=4 | Performance **median 88,5** (86–97). FCP 0,77 s. TBT median **235 ms** (191–429). CLS 0. Speed Index 1,7 s. TTI 3,5 s |
| LCP | Simulasi Lighthouse **bimodal**: 0,8 / 1,4 / 3,4 / 3,5 s (median 2,4 s). LCP teramati di Chrome (tanpa simulasi): 254–352 ms |
| Lighthouse 6x CPU (n=3) | Performance 77–81, TBT 388–830 ms (median 580) |
| Aksesibilitas / Best practices / SEO | 100 / 100 / 63. SEO 63 hanya karena `is-crawlable` gagal: `noindex` draf (disengaja) |
| Transfer halaman pertama (brotli) | **349 KiB** total: HTML 8,7 + JS utama 78 + CSS 9 + 7 font 123 + chunk engine 124 + data 7. Jalur kritis (HTML+JS utama+CSS+2 font preload) ≈ 133 kB |
| Bundle awal (raw / gzip / brotli) | JS utama 280.097 / 85.593 / 74.098 B. CSS 43.614 / 9.041 / 8.015 B. Engine (three.js) 559.753 / 140.010 / 116.047 B, dimuat setelah `load` |
| Runtime mobile (390×844, DPR 3→canvas 1,5, 7.500 titik, CPU 4x, sentuhan nyata) | Idle 60 fps. Scroll **53,7–57,1 fps**, p95 frame **33 ms**, frame >25 ms: **5,1–11,7%**. Long task >50 ms saat scroll: 0 |
| Runtime laptop (1366×768, 20.000 titik, roda mouse, CPU 4x) | 54,8–57,5 fps, p95 16,9–33,3 ms, frame >25 ms 4,0–8,4% |
| Heap setelah 3 siklus scroll penuh (GC paksa) | Mobile 5,32→5,12 MB, desktop 5,20→5,24 MB. Node DOM tetap 1112, listener tetap 218. **Tidak ada kebocoran terdeteksi** |
| GPU per frame (timer query, Intel Arc) | Mobile 0,2–0,9 ms, laptop 0,4–0,8 ms, canvas 4K (1920×1080 @2) 1,8–3,3 ms |

**Tiga masalah terbesar**

1. **Frame terlewat saat scroll di CPU lambat** (F01). Mesin titik menambah ±10–12 poin persentase frame >25 ms (engine aktif 13–18% vs dimatikan 0,5–6%). Tidak ada penjaga kualitas adaptif yang menurunkan beban saat itu terjadi.
2. **Biaya GPU berlebih dari `antialias: true` (+ buffer depth tak terpakai)** (F02). Mematikannya menurunkan waktu GPU per frame 84% di canvas 4K (3,22→0,52 ms) dan 2–4x di konfigurasi mobile. Ini juga penentu utama di GPU lemah yang tidak bisa saya ukur.
3. **DOM hasil prerender dibuang saat React mengambil alih** (F04). `createRoot` menghapus `<main>` prerender dan membangunnya ulang (terukur di 1049 ms pada CPU 4x). Akibatnya LCP simulasi Lighthouse melompat ke 3,3–3,5 s di 5 dari 9 run, dan ada tugas thread utama 377–593 ms saat startup (F05).

## 2. Tabel temuan

Urut dari dampak terbesar ke pengguna. Usaha: S/M/L. "Risiko visual" = bisa mengubah tampilan/animasi yang sudah disetujui. Bukti bertanda **(dugaan)** bila tidak terukur langsung.

| ID | Area | Temuan | Bukti | Dampak ke user | Saran perbaikan | Usaha | Risiko visual | Prioritas |
|---|---|---|---|---|---|---|---|---|
| F01 | Runtime / engine | Frame terlewat saat scroll di CPU 4x. Engine adalah kontributor utama; akar penyebab belum terisolasi penuh | Mobile sentuhan nyata: slow 11,7% (511/4361 frame >25 ms), flick turun 5,1%, flick naik 7,8%, bolak-balik 10,7%; p95 33,3 ms. Ablasi n=5 berdampingan: baseline 13,2–17,8% (rata-rata 15,7) vs engine diblokir 0,5–6,4% (3,2). Batch lain: 25,7% vs 14,0%. Callback rAF engine rata-rata 0,98 ms (maks 23,8 ms) di 4x; `useActiveSection` ×2 0,59 ms. `drawArrays` dibuat no-op: tetap 15–17% terlewat, jadi bukan biaya gambar GPU di mesin ini | Scroll terasa patah di HP menengah/bawah | Penjaga kualitas adaptif (F09), kurangi kerja per frame (F07), batasi 60 fps (F08), matikan MSAA (F02). Perlu eksperimen ulang di HP nyata | M | Hanya di perangkat lambat (tradeoff) | **P0** |
| F02 | Engine / GPU | `antialias: true` (MSAA 4 sampel) dan buffer depth default padahal titik digambar `depthWrite:false` dengan tepi sudah lembut di shader | `engine.ts:256`; `shaders.ts:219` (`smoothstep`). Timer query: canvas 4K baseline 3,22/3,30 ms (baca/puncak) → antialias off 0,52/0,75 → +depth off 0,21/0,45. Mobile: 0,32/0,91 → 0,16/0,24 → 0,23/0,20. `getParameter(SAMPLES)` 4 → 0 | Beban GPU dan memori GPU turun besar, terutama laptop hi-DPI dan GPU lemah | `new WebGLRenderer({ canvas, antialias: false, depth: false, alpha: true, powerPreference: 'low-power' })`, lalu A/B visual | S | Sangat kecil (tepi titik sudah di-antialias shader); **verifikasi A/B visual** | **P0** |
| F03 | Ketahanan / engine | `webglcontextlost` mematikan 3D permanen. Tidak ada `preventDefault()` dan tidak ada `webglcontextrestored` | `engine.ts:1137-1141,1233`. Uji `WEBGL_lose_context.loseContext()`: canvas dihapus, host `hidden`, 0 draw/detik, tidak pulih sampai reload | Di HP, konteks sering hilang saat aplikasi di-background/memori tipis; setelah kembali hanya latar kotak-kotak | `preventDefault` saat lost, bangun ulang renderer/geometri saat restored (atau mount ulang `PointField`) | M | Tidak | P1 |
| F04 | Muat awal / React | `createRoot` membuang prerender dan membangun ulang seluruh DOM | `main.tsx:20-27`. MutationObserver: `<main>` dihapus dan dipasang lagi pada 1049 ms (CPU 4x). Lighthouse LCP simulasi 3,3–3,5 s di 5 dari 9 run vs 0,75–1,4 s di lainnya; LCP teramati 254–352 ms. Elemen LCP = `h1#tentang-title` | LCP dan jeda interaktif lebih buruk pada jaringan/CPU lambat; konten prerender praktis hanya berguna tanpa-JS dan crawler | `hydrateRoot` (mis. hanya bila bahasa tersimpan = `id`, selain itu `createRoot`). Wajib cek peringatan mismatch tema/bahasa | M | Tidak | **P0** |
| F05 | Muat awal / thread utama | Tugas panjang saat startup dan saat engine start | CPU 4x: tugas pertama 377/552/577 ms (eval modul + render React; reflow paksa 24–69 ms), lalu 3–4 tugas 70–190 ms. Engine start: `import.then` 78–97 ms + frame pertama 79–90 ms. TBT 191–429 ms (4x), 388–830 ms (6x) | Input tertunda ±0,2–0,6 s di awal pada HP menengah | Pecah inisialisasi engine (bangun geometri 7.500–20.000 titik per irisan idle), hindari reflow paksa awal, kurangi render sinkron 8 section lewat hidrasi (F04) | M | Tidak | P1 |
| F06 | Scroll desktop | Listener `wheel` non-pasif di `window` menahan scroll roda ke thread utama; di zona peredam scroll ditulis lewat `scrollBy` tiap frame | `wheeldamp.ts:271` (`{ passive: false }`). `DOMDebugger.getEventListeners`: `wheel` tanpa tanda pasif. Laptop 4x: wheelSlow p95 33,3 ms, 8,4% frame >25 ms, **144 style recalc/detik**, `getBoundingClientRect` 3,3% waktu CPU (355 ms/10,4 s). Panjang scroll tercapai 15.436 dari 18.047 px (efek peredam) | Roda/trackpad kurang mulus saat thread utama sibuk | Pasang listener `wheel` hanya saat tengah viewport berada di zona peredam (lepas di luar), jadi scroll di luar zona sepenuhnya dikerjakan compositor | M | Tidak (perilaku scroll di zona tetap sama; uji ulang rasa) | P1 |
| F07 | Scroll / hooks | 6 listener `scroll` dan sampai 4 rAF per frame scroll; `useActiveSection` dipasang dua kali dan membaca layout tiap frame | `Navbar.tsx:43,64`, `useActiveSection.ts:24,34` (dipakai di `Navbar.tsx:29` dan `SectionRail.tsx:14`), `engine.ts:1226`, `wheeldamp.ts:274`. Terukur (mobile 4x, 6000 px): rAF `useActiveSection` 648 panggilan/380 ms (rata-rata 0,59, maks 6,9 ms); setState `scrolled` 324 panggilan/106 ms; progress bar membaca `scrollHeight` tiap frame (`Navbar.tsx:56`). Layout tidak thrash: `LayoutCount` 11 per 20 dtk | ±1,8–5% waktu thread utama per frame scroll di 4x; memperbesar peluang frame terlewat | Satu penyimpan "section aktif" bersama, berbasis offset yang diukur sekali (engine `measure()` sudah punya `tops`) atau IntersectionObserver; gabung progress+shadow ke satu handler | S–M | Tidak | P1 |
| F08 | Pay-as-you-go / baterai | Render tanpa henti 60 draw/detik bahkan saat idle; di layar 120 Hz akan 120 (dugaan, tidak diuji) | Idle 5 dtk: 60,1–60,3 draw/dtk, rAF 1/frame (`engine.ts:1026-1032`). CPU sibuk 19,7% (mobile 4x), skrip ±33 ms/dtk di 1x. Sudah benar: berhenti saat tab tersembunyi (0 draw/dtk, lanjut 60/dtk saat kembali, scroll saat hidden tidak membangunkan) dan reduced motion (0 draw idle) | Baterai dan panas HP; kipas laptop | Batas 60 fps pada layar 120 Hz (risiko nol). Opsional 30 fps saat tanpa input >N detik (butuh keputusan, bagian 4) | S | Batas 60: tidak. 30 fps idle: kecil | P1 |
| F09 | Kualitas adaptif | Tidak ada penyesuaian otomatis bila frame lambat. Tingkat perangkat statis dan lemah mendeteksi iOS/iPad | Grep `adaptive/governor/frame time`: kosong. `engine.ts:221-230`: tier dari `hardwareConcurrency/deviceMemory` (iOS Safari tidak melaporkan → anggap 8 → "desktop" 20.000 titik di iPad ≥768 px). Jumlah titik `pointfield.ts:231-233` (20.000/11.000/7.500). Hanya dt dijepit 50 ms (`engine.ts:184`) | HP lemah tidak punya jalan turun; iPad bisa mendapat beban desktop | Governor: bila p95 frame >25 ms selama ±2 detik, turunkan DPR (1,5→1,25→1) lalu jumlah titik (mis. −30% hingga lantai), tidak pernah naik lagi dalam sesi | M | Ya, hanya di perangkat lambat | P1 |
| F10 | Muat / jaringan | Rantai 3 lompatan: HTML → JS utama → (setelah `load`+idle) engine; font tidak semuanya di-preload | Lighthouse `network-dependency-tree` gagal; engine diminta di 873–1155 ms (4x). 7 font woff2 = 124.140 B, hanya Montserrat 300/800 di-preload (`seo-plugin.ts:37`); Hind Siliguri (font isi) tidak. CLS 0,018 pada 1 dari 13 run (swap font) | Bentuk pertama muncul lambat di 3G; kemungkinan geser teks saat font isi tiba | `<link rel="prefetch">` untuk chunk engine (prioritas rendah); preload Hind 400; font fallback ber-`size-adjust` | S | Tidak | P1 |
| F11 | Ketahanan / React | Error render di luar `PointField` mengosongkan seluruh halaman | `ErrorBoundary` hanya membungkus `PointField` (`App.tsx:33-35`). Karena `createRoot` sudah membuang prerender, error React yang lolos meninggalkan halaman putih. Tidak ada `onUncaughtError` | Satu bug komponen = halaman kosong | Boundary tingkat akar dengan fallback sederhana, `onUncaughtError/onCaughtError` di `createRoot`/`hydrateRoot` | S | Tidak | P1 |
| F12 | Bundle / three.js | Chunk engine 560 kB raw, three.js sebagian besar; hanya satu `ShaderMaterial` + `Points` dipakai | `source-map-explorer`: three 373 kB terpetakan + 156 kB tak terpetakan (hampir pasti kode three), `src/pointfield` 25,9 kB. Lighthouse unused JS: engine 43,6% (55 kB), JS utama 40,9% (33 kB). Waktu parse+init di 4x ±180 ms (F05) | 124 kB brotli unduhan tambahan di jaringan lambat | Opsi L: renderer WebGL2 mini (shader GLSL yang sama dipertahankan). Tidak disarankan sekarang | L | Rendah bila shader sama (regresi tinggi) | P2 |
| F13 | CSS paint (dugaan) | Latar "cutting mat" (4 gradien) di `<main>` bertinggi ±18.800 px dan digeser per frame lewat `--mat-offset`; `text-shadow` ganda di semua `p/h1-4/li`; `backdrop-blur` di navbar di atas canvas yang bergerak | `global.css:19-32`, `engine.ts:811-823`, `global.css:275-279`, `Navbar.tsx:167` (`bg-bg/90 backdrop-blur-md`). Ablasi n=2: tanpa mat-bg 13,8–14,3% vs 18,2–19,4%; tanpa text-shadow 15,1–16,5%; tanpa backdrop 12,9–17,8%; tanpa tulis `--mat-offset` 12,9–13,1% (n=5 ulang: 12,2–25,8%, tak konklusif). `--mat-offset` menyumbang ±300 style recalc/20 dtk | Selisih ada tetapi di dalam derau; belum terbukti sebagai penyebab | Belum bertindak. Bila terbukti: parallax mat via `transform` pada lapisan sendiri; hilangkan blur navbar (latar sudah 90% opak) | M | Ya (halo teks dan parallax adalah tampilan yang disetujui) | P2 |
| F14 | Muat data | `members`/`webinars` dimuat saat mount, bukan saat section mendekat; kamus i18n id+en keduanya di JS utama | `useLazyData.ts`; Lighthouse: kedua chunk diminta di ±820–1040 ms (4x). `src/i18n` 13.962 B di JS utama | ±7 kB brotli lebih awal dari perlu (kecil) | Muat data saat section mendekati layar; kamus `en` dimuat saat dipilih (lazy) | S | Tidak | P2 |
| F15 | Embed / SEO | Dengan `--base=/landing/` semua aset benar, tetapi kanonik/OG tidak mengikuti base | Build `--base=/landing/`: semua `href/src/url()`/`import` berawalan `/landing/`; uji runtime di `/landing/`: canvas aktif, 0 respons ≥400. Namun `VITE_SITE_URL=https://inapr.org` + base → `canonical=https://inapr.org/`, `og:image=https://inapr.org/og.png` (`seo-plugin.ts:69,92-93`). `public/404.html` memakai `/favicon.svg` dan `/` absolut (khusus Vercel) | Kanonik salah bila lupa memasukkan path ke `VITE_SITE_URL` | Dokumentasikan: `VITE_SITE_URL=https://inapr.org/landing/`. Atau gabungkan `config.base` ke URL | S | Tidak | P2 |
| F16 | Konten sebelum rilis | Teks placeholder tampil di HTML prerender | `lorem` 14 kali di `id.ts`, 13 di `en.ts`; Publikasi/Berita di heading h3 | Bila `noindex` dicabut, placeholder terindeks | Ganti konten sebelum `DRAFT_NOINDEX=false` | S | Tidak | P2 |
| F17 | Kualitas kode | `engine.ts` 1350 baris (55 KB) memegang 10 tanggung jawab. Duplikasi kecil | `matches()` ada di `engine.ts:212`, `usePointerFx.ts:11`; `FRAME_MS` di engine dan wheeldamp. `pointermove` memanggil `matchMedia` tiap event (`usePointerFx.ts:68`) dan `closest()` 2x (`engine.ts:795`). Knip: 11 ekspor dan 7 tipe tak terpakai (kecil) | Pemeliharaan; sedikit alokasi per gerak mouse | Pecah aman: `colors.ts`, `pointer.ts` (pointer/drag/ripple), `navigation.ts` (anchor), `camera.ts`; tanpa mengubah logika. Cache `matchMedia` | M | Tidak | P2 |

### Temuan non-masalah (sudah diperiksa)

Lint (`oxlint`) bersih, `tsc -b` bersih, `npm audit` 0 kerentanan (prod dan dev), tidak ada dependensi tak terpakai (knip). Tidak ada `will-change` berlebihan, tidak ada gambar (tidak ada risiko LCP gambar/dimensi), tidak ada sisa kode "rem/gerbang" aktif (hanya komentar penjelas), tidak ada kode dev/tune di bundel produksi (0 kecocokan), tidak ada sourcemap produksi, `console.*` hanya dari pustaka (three, React).

## 3. Menang cepat (usaha kecil, risiko visual nol/praktis nol)

1. **F02** matikan `antialias` dan `depth` pada renderer (S). Risiko visual praktis nol; tetap lakukan A/B visual.
2. **F10** `<link rel="prefetch">` chunk engine, preload Hind Siliguri 400 (S).
3. **F11** boundary tingkat akar + `onUncaughtError` (S).
4. **F07** satukan `useActiveSection` menjadi satu pemanggilan, hapus pembacaan layout per frame (S–M).
5. **F08** batasi loop engine 60 fps pada layar 120 Hz (S). Animasi berbasis waktu, jadi kecepatan tidak berubah.
6. **F14** muat chunk data dan kamus `en` secara malas (S).
7. **F15** isi `VITE_SITE_URL` dengan path penuh saat disematkan di subfolder (S).

## 4. Butuh keputusan Anda

| # | Keputusan | Opsi | Rekomendasi |
|---|---|---|---|
| D1 | Jumlah titik (kini mobile 7.500, perangkat lemah 11.000, desktop 20.000) | (a) tetap; (b) turun statis; (c) governor otomatis (F09) | (c), lantai sekitar 4.000 titik di mobile. Di mesin ini 7.500 titik hanya 0,2–0,9 ms GPU, jadi tidak perlu dikurangi statis tanpa data HP nyata |
| D2 | Batas DPR canvas (mobile 1,5, desktop 2) | (a) tetap; (b) mobile 1,25; (c) governor menurunkan bertahap | (c). Uji DPR 1,0 saya tidak konklusif (21% vs 25,7% frame >25 ms di batch berdampingan, dalam derau) |
| D3 | Render saat idle | (a) 60 fps terus; (b) 30 fps bila tak ada scroll/pointer >3 detik; (c) jeda total | (a)+batas 60 fps di 120 Hz dulu. (b) bila baterai penting: bintang berputar sangat pelan (0,03 rad/detik), tetapi ini tetap perubahan halus pada gerak yang sudah disetujui |
| D4 | `hydrateRoot` menggantikan `createRoot` (F04) | (a) tetap; (b) hidrasi hanya untuk bahasa `id`+tema cocok | (b). Memperbaiki LCP/TBT; risiko berupa peringatan mismatch bila tema/bahasa tersimpan berbeda dari prerender |
| D5 | Efek CSS mahal (dugaan): blur navbar, halo teks, parallax mat | Pertahankan atau ganti implementasi | Pertahankan dulu. Ukur ulang di HP nyata sebelum menyentuh; blur navbar paling aman dihapus karena latar sudah 90% opak |
| D6 | Bobot font (Montserrat 300/500/800, Lato 400, Hind 400/500/600 = 124 kB) | Tetap / gabung 500+600 | Tetap. Menggabung bobot mengubah tipografi yang disetujui; hemat hanya ±15 kB |
| D7 | Ganti three.js dengan renderer mini | Tetap / L | Tetap. Hemat ±110 kB brotli, tetapi regresi tinggi |

## 5. Yang sudah bagus dan sebaiknya tidak diubah

- Three.js dimuat dinamis setelah `load` + idle; bundel awal tidak memuatnya. Satu draw call (7.500/20.000 titik terukur), semua gerak di GPU.
- Loop render tanpa alokasi: GC hanya 0,3% sampel profil; heap datar setelah 3 siklus. `dispose` geometri/material/renderer + `forceContextLoss` saat unmount benar (`engine.ts:1283-1287`).
- Jeda saat tab tersembunyi dan penanganan reduced motion (0 draw saat idle, peredam mati, render sesuai kebutuhan).
- Fallback: tanpa JS (5.177 karakter terbaca, menu tampil, tidak ada elemen `opacity:0`), tanpa WebGL (halaman utuh, 0 error konsol), renderer gagal (halaman utuh).
- Listener sentuh pasif; sentuhan tidak pernah diblokir. Tidak ada layout thrash (11 layout per 20 detik).
- `vercel.json`: `/assets/*` immutable satu tahun; header keamanan; `noindex` draf. Font self-hosted, subset latin, `font-display: swap`, 2 font judul di-preload.
- Aksesibilitas: Lighthouse 100; landmark `header/nav/main/footer`; skip link sebagai fokus Tab pertama; `lang` mengikuti bahasa; hierarki h1→h2→h3→h4 tidak melompat.
- Konsep animasi/snap yang sudah disetujui tidak disentuh oleh satu pun rekomendasi di atas, kecuali yang bertanda risiko visual.

## 6. Pengukuran yang tidak bisa dilakukan

| Pengukuran | Alasan |
|---|---|
| FPS/GPU di HP nyata (Mali/Adreno kelas bawah) | Tidak ada perangkat. Throttling CPU tidak memperlambat GPU, jadi biaya fill-rate dan MSAA di GPU lemah tidak terukur. Timer query hanya dari Intel Arc |
| Layar 120 Hz | Headless berjalan 60 Hz. Klaim 120 draw/detik adalah dugaan dari kode (`rAF` tanpa batas) |
| INP sebenarnya | Hanya TBT lab dan histori long task; tidak ada interaksi pengguna nyata |
| Safari/iOS dan Firefox | Hanya Chrome 157 |
| Jaringan sungguhan di profil runtime | Throttling jaringan hanya pada Lighthouse (simulasi) |
| Kompresi/cache di Vercel produksi | Belum ada deploy; dipakai server brotli lokal |
| Sumber pasti frame terlewat (F01) | Tidak dilakukan trace Chrome tingkat compositor/raster. Ablasi mempersempit ke engine di thread utama, bukan ke satu fungsi. Driver sentuh sintetis (CDP) ikut membebani thread utama |
| Kontras teks di atas titik (piksel nyata) | Hanya perhitungan `scripts/check-reading-contrast.mjs` (teoretis): teks `ink` lolos ≥4,5:1; `muted` 2,55:1 (Terang) dan 2,99:1 (Gelap) terhadap titik baca terburuk, dilaporkan skrip sendiri |
| A/B visual setelah `antialias:false` | Tidak diterapkan di repo (mode audit); posisi titik bergantung waktu sehingga selisih piksel tak deterministik |
| Pengukuran baterai/energi | Tidak ada alat |
| Hapus kode mati menyeluruh | Hanya knip (11 ekspor, 7 tipe tak terpakai; 2 "berkas tak terpakai" adalah entri prerender dan skrip manual) |
