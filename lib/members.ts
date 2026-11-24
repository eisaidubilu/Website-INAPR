import { supabase } from './supabase'
import { generateDynamicMemberId } from './id_generator'

// 1. Fungsi untuk mendaftarkan member baru langsung oleh admin (menggunakan generator dinamis)
export async function registerNewMember(formData: {
  nama: string
  email: string
  institusi: string
  tahun_daftar: number
}) {
  const generatedId = await generateDynamicMemberId(formData.tahun_daftar)

  const { data, error } = await supabase
    .from('members')
    .insert([
      {
        member_id: generatedId,
        nama: formData.nama,
        email: formData.email,
        institusi: formData.institusi,
        tahun_daftar: formData.tahun_daftar,
        status: 'Active',
        tampil_di_publik: true
      }
    ])
    .select()

  if (error) {
    console.error('Gagal mendaftarkan member baru:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

// 2. Fungsi untuk mengambil daftar anggota publik (Member List dinamis dengan pencarian nama/institusi)
export async function getPublicMemberList(searchQuery?: string) {
  let query = supabase
    .from('members')
    .select('id, member_id, nama, institusi, tahun_daftar')
    .eq('status', 'Active')
    .eq('tampil_di_publik', true)
    .order('nama', { ascending: true })

  if (searchQuery) {
    query = query.or(`nama.ilike.%${searchQuery}%,institusi.ilike.%${searchQuery}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Gagal mengambil data Member List:', error.message)
    return []
  }

  return data
}