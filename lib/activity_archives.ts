import { supabase } from './supabase'

// 1. Mengambil seluruh daftar arsip kegiatan / webinar lama INAPR
export async function getActivityArchives() {
  const { data, error } = await supabase
    .from('activity_archives')
    .select('*')
    .order('tanggal', { ascending: false })

  if (error) {
    console.error('Gagal mengambil data arsip kegiatan:', error.message)
    return []
  }

  return data
}

// 2. Menambahkan arsip kegiatan baru (Sisi Admin)
export async function createActivityArchive(archiveData: {
  tanggal: string
  waktu: string
  penyaji: string
  institusi: string
  tema: string
  youtube_url?: string
  materi_url?: string
}) {
  const { data, error } = await supabase
    .from('activity_archives')
    .insert([archiveData])
    .select()

  if (error) {
    console.error('Gagal menambah arsip kegiatan:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}