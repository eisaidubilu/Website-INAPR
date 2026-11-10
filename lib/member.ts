import { supabase } from './supabase'

// Fungsi untuk mengambil daftar anggota publik (Member List dinamis dengan pencarian nama/institusi)
export async function getPublicMemberList(searchQuery?: string) {
  let query = supabase
    .from('members')
    .select('id, member_id, nama, institusi, tahun_daftar')
    .eq('status', 'Active')
    .eq('tampil_di_publik', true)
    .order('nama', { ascending: true })

  // Jika ada kata kunci pencarian dari user
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