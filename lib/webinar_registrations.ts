import { supabase } from './supabase'

// Fungsi untuk mendaftarkan peserta ke kegiatan / webinar
export async function registerForActivity(data: {
  kegiatan_id: string
  nama: string
  email: string
  institusi?: string
}) {
  const { data: participantData, error } = await supabase
    .from('activity_participants')
    .insert([
      {
        kegiatan_id: data.kegiatan_id,
        nama: data.nama,
        email: data.email,
        institusi: data.institusi || null,
        status_kehadiran: 'Terdaftar'
      }
    ])
    .select()

  if (error) {
    console.error('Gagal mendaftarkan peserta kegiatan:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, data: participantData }
}