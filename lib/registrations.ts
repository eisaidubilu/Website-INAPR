import { supabase } from './supabase'
import { generateDynamicMemberId } from './id_generator'

// 1. Fungsi untuk mengajukan pendaftaran anggota baru (Sisi Publik / Calon Anggota)
export async function submitRegistration(formData: {
  nama: string
  email: string
  institusi: string
  tahun_daftar: number
  bukti_bayar?: string
}) {
  // Langkah A: Masukkan data ke tabel members (member_id masih null karena belum disetujui)
  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .insert([
      {
        member_id: null,
        nama: formData.nama,
        email: formData.email,
        institusi: formData.institusi,
        tahun_daftar: formData.tahun_daftar,
        status: 'Pending',
        tampil_di_publik: false
      }
    ])
    .select()
    .single()

  if (memberError) {
    console.error('Gagal membuat data member untuk pendaftaran:', memberError.message)
    return { success: false, error: memberError.message }
  }

  // Langkah B: Catat ke tabel registrations
  const { data: regData, error: regError } = await supabase
    .from('registrations')
    .insert([
      {
        anggota_id: memberData.id,
        status: 'Pending',
        bukti_bayar: formData.bukti_bayar || null
      }
    ])
    .select()

  if (regError) {
    console.error('Gagal menyimpan record registrasi:', regError.message)
    return { success: false, error: regError.message }
  }

  return { success: true, data: regData }
}

// 2. Fungsi untuk proses verifikasi oleh pengurus/admin (Sisi Admin - BR-08)
export async function verifyRegistration(
  registrationId: string,
  pengurusId: string,
  action: 'Approved' | 'Rejected',
  alasanPenolakan?: string
) {
  // A. Ambil data registrasi beserta tahun_daftar dari tabel members
  const { data: reg, error: fetchError } = await supabase
    .from('registrations')
    .select('anggota_id, members(tahun_daftar)')
    .eq('id', registrationId)
    .single()

  if (fetchError || !reg) {
    return { success: false, error: 'Data registrasi tidak ditemukan' }
  }

  // B. Update status di tabel registrations
  const { error: updateRegError } = await supabase
    .from('registrations')
    .update({
      status: action,
      pengurus_id: pengurusId,
      alasan_penolakan: action === 'Rejected' ? alasanPenolakan : null
    })
    .eq('id', registrationId)

  if (updateRegError) {
    return { success: false, error: updateRegError.message }
  }

  // C. Jika Approved, generate Member ID resmi lalu aktifkan status member
  if (action === 'Approved') {
    const memberRelation = Array.isArray(reg.members) ? reg.members[0] : reg.members
    const tahunDaftar = memberRelation?.tahun_daftar || new Date().getFullYear()
    const officialMemberId = await generateDynamicMemberId(tahunDaftar)

    const { error: updateMemberError } = await supabase
      .from('members')
      .update({
        member_id: officialMemberId,
        status: 'Active',
        tampil_di_publik: true
      })
      .eq('id', reg.anggota_id)

    if (updateMemberError) {
      return { success: false, error: updateMemberError.message }
    }

    return {
      success: true,
      memberId: officialMemberId,
      message: `Pendaftaran disetujui dengan Member ID ${officialMemberId}`
    }
  }

  return { success: true, message: 'Pendaftaran berhasil ditolak' }
}