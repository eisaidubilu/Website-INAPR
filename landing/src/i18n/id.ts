import type { Dictionary } from './types'

const LOREM_SHORT = 'Lorem ipsum dolor sit amet consectetur.'
const LOREM_LONG =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'

/**
 * Kamus Bahasa Indonesia (default).
 * Fakta asli hanya dari rebuild/docs/KONTEN-LAMA.md. Sisanya lorem ipsum.
 */
export const id: Dictionary = {
  meta: {
    title: 'INAPR · Indonesian Association for Pattern Recognition',
    // Sama dengan meta description di index.html.
    description:
      'INAPR (Indonesian Association for Pattern Recognition) adalah komunitas nasional peneliti dan praktisi pengenalan pola, anggota resmi Indonesia pada International Association for Pattern Recognition (IAPR).',
  },
  banner: 'Draf layout: isi masih placeholder (lorem ipsum), belum final',
  common: {
    locale: 'id-ID',
    placeholder: 'placeholder',
    placeholderHint: 'Isi blok ini masih contoh, belum final.',
    linkPending: 'tautan belum tersedia',
    skipToContent: 'Lewati ke konten',
    loading: 'Memuat data…',
    loadError: 'Data gagal dimuat. Muat ulang halaman untuk mencoba lagi.',
    newTab: 'buka di tab baru',
    pagination: {
      prev: 'Sebelumnya',
      next: 'Berikutnya',
      page: (page, pages) => `Halaman ${page} dari ${pages}`,
    },
  },
  nav: {
    label: 'Navigasi utama',
    railLabel: 'Lompat ke bagian',
    home: 'INAPR, kembali ke atas',
    items: {
      tentang: 'Tentang',
      kegiatan: 'Kegiatan',
      bidang: 'Bidang riset',
      publikasi: 'Publikasi',
      anggota: 'Anggota',
      gabung: 'Keanggotaan',
      berita: 'Berita',
    },
    cta: 'Daftar Anggota',
    openMenu: 'Menu',
    closeMenu: 'Tutup',
    theme: { toDark: 'Ganti ke mode gelap', toLight: 'Ganti ke mode terang' },
    langLabel: 'Bahasa',
  },
  tentang: {
    eyebrow: 'Indonesian Association for Pattern Recognition',
    title: {
      lead: 'Komunitas nasional peneliti dan praktisi ',
      accent: 'pengenalan pola',
      trail: '.',
    },
    sub: 'Dibentuk tahun 2017 sebagai anggota resmi Indonesia pada International Association for Pattern Recognition (IAPR).',
    ctaPrimary: 'Jadi anggota',
    ctaSecondary: 'Lihat kegiatan',
    whatTitle: 'Apa itu pengenalan pola?',
    whatBody: 'Pengenalan pola adalah teknologi komputasi dengan aplikasi luas, antara lain:',
    applications: [
      'kecerdasan buatan',
      'robotika',
      'biometrik',
      'bioinformatika',
      'computer vision',
      'forensik',
      'pengenalan suara',
      'tulisan tangan',
      'big data',
    ],
    membershipNote:
      'Keanggotaan resmi di IAPR disetujui Governing Board IAPR pada 22 Agustus 2018 di ICPR 2018, Beijing, dan diumumkan di IAPR Newsletter Vol. 40 No. 4, Oktober 2018, hal. 8.',
    stats: [
      { value: '348', label: 'anggota aktif (per 19 April 2020)' },
      { value: '2017', label: 'tahun berdiri' },
      { value: '2018', label: 'disetujui sebagai anggota resmi IAPR' },
      { value: '000', label: 'institusi', placeholder: true },
    ],
  },
  kegiatan: {
    eyebrow: 'Kegiatan',
    title: { lead: 'Jejak ', accent: 'kegiatan', trail: ' 2018–2022' },
    source:
      'Sumber: arsip situs lama inapr.org. Kegiatan setelah September 2022 menunggu data dari pengurus.',
    featured: {
      date: { top: 'SEP 2018', main: '07' },
      tag: 'Konferensi',
      title: 'Konferensi pertama INAPR',
      meta: 'Jumat, 7 September 2018 · Universitas Bina Nusantara, Kampus Alam Sutera, Tangerang',
      keynoteLabel: 'Pembicara kunci',
      keynotes: [
        'Prof. Dr. Pitoyo Hartono (Chukyo University)',
        'Dr. Setiawan Hadi (Universitas Padjadjaran)',
        'Prof. Antoine Doucet (L3i, La Rochelle)',
      ],
    },
    items: [
      {
        date: { top: 'JUN 2018', main: '26–28' },
        tag: 'Internasional',
        title: 'Joint Working Group Prancis–Indonesia ke-10',
        meta: 'Poitiers, Prancis',
      },
      {
        date: { top: 'AGU 2018', main: '19–25' },
        tag: 'Internasional',
        title: 'ICPR 2018: INAPR disahkan sebagai anggota IAPR',
        meta: 'Beijing, Tiongkok · International Association for Pattern Recognition (IAPR)',
      },
      {
        date: { top: 'NOV 2019', main: '08' },
        tag: 'Kuliah tamu',
        title: 'Kuliah tamu Dr. Elly Matul Imah',
        meta: 'STIKI Malang',
      },
      {
        date: { top: 'DES 2019', main: '10' },
        tag: 'Kuliah tamu',
        title: 'Kuliah tamu tentang biometrik KTP-el',
        meta: 'Dr. Anto S. Nugroho dan Gembong S. Wibowanto (BPPT) · Undiksha, Singaraja',
      },
      {
        date: { top: 'SEP 2020', main: '28' },
        tag: 'Dukungan acara',
        title: 'Mendukung ICONETSI',
      },
      {
        date: null,
        tag: 'Keterlibatan',
        title: 'Indonesia Artificial Intelligence Summit (AIS 2020)',
      },
      {
        date: null,
        tag: 'Gugus tugas',
        title: 'Task Force Technology Research and Innovation (TFRIC19)',
        meta: 'Kecerdasan buatan untuk penanganan Covid-19',
      },
    ],
    webinar: {
      title: 'Webinar mingguan',
      summary: (count, range) => `${count} sesi tercatat, ${range}.`,
      searchLabel: 'Cari webinar',
      searchPlaceholder: 'Judul, pembicara, atau instansi',
      yearLabel: 'Saring menurut tahun',
      allYears: 'Semua tahun',
      watch: 'Tonton',
      slide: 'Slide',
      noVideo: 'Rekaman tidak tersedia',
      showMore: 'Tampilkan lebih banyak',
      showing: (shown, total) => `Menampilkan ${shown} dari ${total} sesi`,
      empty: 'Tidak ada webinar yang cocok dengan pencarian ini.',
    },
  },
  bidang: {
    eyebrow: 'Bidang riset',
    title: { lead: 'Yang digarap ', accent: 'anggota' },
    items: [1, 2, 3, 4, 5, 6].map((n) => ({
      name: `Bidang riset ${n}`,
      desc: LOREM_SHORT,
      counts: '00 anggota · 00 publikasi',
    })),
  },
  publikasi: {
    eyebrow: 'Publikasi',
    title: { lead: 'Publikasi ', accent: 'terbaru' },
    more: 'Semua publikasi',
    read: 'Baca',
    items: [1, 2, 3].map(() => ({
      year: '0000',
      title: 'Lorem ipsum dolor sit amet consectetur',
      authors: 'Nama Penulis, Nama Penulis · Institusi',
      tag: 'Lorem',
    })),
  },
  anggota: {
    eyebrow: 'Anggota',
    title: { lead: 'Direktori ', accent: 'anggota' },
    total: '348',
    totalLabel: 'anggota terdaftar',
    asOf: 'per 19 April 2020',
    intro:
      'Daftar nama dari arsip situs lama inapr.org, urut abjad. Sumber hanya mencatat nama, jadi institusi belum ditampilkan.',
    searchLabel: 'Cari nama anggota',
    searchPlaceholder: 'Ketik sebagian nama',
    caption: 'Daftar anggota INAPR per 19 April 2020, urut abjad',
    columns: { no: 'No.', name: 'Nama' },
    showing: (from, to, total) => `Menampilkan ${from}–${to} dari ${total} nama`,
    empty: (query) => `Tidak ada nama yang cocok dengan “${query}”.`,
    paginationLabel: 'Halaman daftar anggota',
  },
  gabung: {
    eyebrow: 'Keanggotaan',
    title: { lead: 'Cara ', accent: 'bergabung' },
    sub: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod.',
    steps: [
      { title: 'Langkah satu', desc: 'Lorem ipsum dolor sit amet.' },
      { title: 'Langkah dua', desc: 'Consectetur adipiscing elit.' },
      { title: 'Langkah tiga', desc: 'Sed do eiusmod tempor.' },
    ],
    cta: 'Buka formulir pendaftaran',
    benefitsTitle: 'Manfaat anggota',
    benefits: ['Lorem ipsum dolor sit amet', 'Consectetur adipiscing elit', 'Sed do eiusmod tempor'],
    feeLabel: 'Iuran tahunan',
    fee: 'Rp 000.000',
  },
  afiliasi: {
    eyebrow: 'Afiliasi',
    title: { lead: 'Bagian dari jaringan ', accent: 'IAPR' },
    sub: 'INAPR adalah anggota resmi Indonesia pada International Association for Pattern Recognition (IAPR), organisasi induk pengenalan pola tingkat dunia. Keanggotaan ini disahkan pada ICPR 2018 di Beijing.',
    logos: ['Logo IAPR', 'Mitra', 'Mitra'],
  },
  berita: {
    eyebrow: 'Berita',
    title: { lead: 'Berita ', accent: 'terbaru' },
    more: 'Semua berita',
    items: [1, 2, 3].map(() => ({
      date: 'DD BLN TAHUN',
      title: 'Judul berita lorem ipsum dolor sit',
      body: LOREM_LONG,
    })),
  },
  footer: {
    tagline: 'Indonesian Association for Pattern Recognition.',
    explore: 'Jelajah',
    organization: 'Organisasi',
    affiliation: 'Afiliasi internasional (IAPR)',
    contact: 'Kontak',
    addressLabel: 'Alamat',
    address: [
      'Jalan Melong Cijerah IV Nomor 14, RT.003/RW 003',
      'Kecamatan Bandung Kulon, Kota Bandung',
    ],
    email: 'email@lorem.ipsum',
    fine: 'Draf layout, isi sebagian masih placeholder.',
  },
}
