# Website-INAPR

# Redesain & Rebuild Website INAPR (Indonesian Association for Pattern Recognition)

Repositori resmi untuk pengembangan ulang (*rebuild*) website resmi **INAPR** (`inapr.org`) dari nol. Proyek ini bertujuan untuk menyediakan pusat informasi, komunikasi, dan manajemen keanggotaan yang modern bagi komunitas pengenalan pola di Indonesia.

## 📌 Latar Belakang Proyek
Website INAPR sebelumnya mengalami kendala teknis di mana pengurus kehilangan akses ke seluruh *repository*, database, dan sistem lama. Oleh karena itu, proyek ini dibangun kembali menggunakan arsitektur modern, aman, dan mudah dikelola secara mandiri oleh pengurus melalui panel admin.

---

## 👥 Tim Pengembang & Pembagian Peran
Proyek ini dikerjakan secara kolaboratif dengan pembagian peran yang jelas:
*   **Syifa Azzahra (Backend & Database):** Perancangan database, logika sistem, manajemen autentikasi/login, sistem penomoran otomatis (Member ID, sertifikat, invoice), serta integrasi pengiriman email otomatis.
*   **Sebastian Augustino Lie (Frontend & Desain):** Perancangan antarmuka pengguna (UI/UX), tata letak halaman publik (Beranda, Profil, Konferensi, Webinar, Member List), desain kartu anggota, templat sertifikat, dan responsivitas perangkat.
*   **Fitri Sahwalia (Admin, Data, & Dokumen):** Pengarsipan data lama, migrasi konten, perancangan alur panel admin, manajemen verifikasi data anggota/pembayaran, serta dokumentasi dan pelatihan pengurus.

---

## 🚀 Roadmap Pengembangan
Pengembangan website dibagi menjadi 6 fase utama:
1.  **Fase 0 (Persiapan):** Arsip web lama, penentuan *tech stack*, pembagian peran, dan inisialisasi repositori.
2.  **Fase 1 (Fondasi):** Perancangan database, sistem *login* pengurus, dan kerangka panel admin dasar.
3.  **Fase 2 (Halaman Publik & Migrasi):** Pembangunan halaman statis/dinamis (Beranda, Profil, Kontak, Kalender, Member List) dan migrasi data lama.
4.  **Fase 3 (Keanggotaan):** Pengembangan formulir pendaftaran anggota, unggah bukti bayar manual, form registrasi webinar, dan arsip kegiatan.
5.  **Fase 4 (Kartu & Sertifikat):** Otomasi pembuatan *Member ID*, kartu anggota digital, sertifikat kegiatan, nomor invoice, dan pengiriman email otomatis.
6.  **Fase 5 (Uji & Serah Terima):** Pengujian sistem secara menyeluruh (*UAT*), dokumentasi teknis, pelatihan pengurus, dan serah terima aset atas nama INAPR.

---

## 🛠️ Tech Stack (Usulan)
*   **Backend:** *Node.js*
*   **Frontend:** *Next.js*
*   **Database:** *PostgreSQL*
*   **Environment:** Git, GitHub, Staging Server.

---

## 🔒 Kebijakan & Tata Kelola Aset
Sesuai dengan ketentuan proyek (BR-19):
*   Seluruh aset utama (domain, hosting, *source code*, dan kredensial) wajib terdokumentasi dan dimiliki atas nama INAPR.
*   Minimal **2 orang pengurus/pengembang** wajib memegang akses penuh ke *repository* ini untuk mengantisipasi hilangnya akses di masa depan.
