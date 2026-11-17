import { supabase } from './supabase'

// 1. Fungsi untuk membuat/generate ID anggota otomatis dengan template
export async function generateMemberId(tahunDaftar: number): Promise<string> {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('tahun_daftar', tahunDaftar)

  if (error) {
    console.error('Gagal menghitung total member untuk ID:', error.message)
    return `INAPR-${tahunDaftar}-001`
  }

  const nextNumber = (count || 0) + 1
  const paddedNumber = String(nextNumber).padStart(3, '0')

  return `INAPR-${tahunDaftar}-${paddedNumber}`
}

// 2. Fungsi untuk mendaftarkan member baru dengan ID otomatis
export async function registerNewMember(formData: {
  nama: string
  email: string
  institusi: string
  tahun_daftar: number
}) {
  const generatedId = await generateMemberId(formData.tahun_daftar)

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

// 3. Fungsi untuk mengambil daftar anggota publik (Member List dinamis dengan pencarian nama/institusi)
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