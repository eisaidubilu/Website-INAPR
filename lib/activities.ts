import { supabase } from './supabase'

// Fungsi untuk mengambil semua data katalog kegiatan (Conferences, Webinar, Activities)
export async function getActivitiesCatalog() {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('tanggal', { ascending: true }) // Mengurutkan dari jadwal terdekat

  if (error) {
    console.error('Gagal mengambil data katalog kegiatan:', error.message)
    return []
  }

  return data
}

// Fungsi untuk memfilter kegiatan berdasarkan jenis (Conferences / Webinar / Activities)
export async function getActivitiesByType(jenisKegiatan: string) {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('jenis', jenisKegiatan)
    .order('tanggal', { ascending: true })

  if (error) {
    console.error(`Gagal mengambil data untuk jenis ${jenisKegiatan}:`, error.message)
    return []
  }

  return data
}