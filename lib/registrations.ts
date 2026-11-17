import { supabase } from './supabase'
import { generateMemberId } from './members'

// 1. Fungsi untuk mengajukan pendaftaran anggota baru (Sisi Publik / Calon Anggota)
export async function submitRegistration(formData: {
  nama: string
  email: string
  institusi: string
  tahun_daftar: number
  bukti_bayar?: string
}) {
  // Langkah A: Masukkan data ke tabel members terlebih dahulu (status awal Pending atau Non-Active sampai diverifikasi)
  const generatedId = await generateMemberId(formData.tahun_daftar)

  const { data: memberData, error: memberError } = await supabase
    .from('members')
    .insert([
      {
        member_id: generatedId,
        nama: formData.nama,
        email: formData.email,
        institusi: formData.institusi,
        tahun_daftar: formData.tahun_daftar,
        status: 'Pending', // Menunggu verifikasi pengurus
        tampil_di_publik: false
      }
    ])
    .select()
    .single()

  if (memberError) {
    console.error('Gagal membuat data member untuk pendaftaran:', memberError.message)
    return { success: false, error: memberError.message }
  }

  // Langkah B: Catat ke tabel registrations (hubungkan dengan anggota_id)
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

  return { success: true, memberId: generatedId, data: regData }
}

// 2. Fungsi untuk proses verifikasi oleh pengurus/admin (Sisi Admin - BR-08)
export async function verifyRegistration(
  registrationId: string,
  pengurusId: string,
  action: 'Approved' | 'Rejected',
  alasanPenolakan?: string
) {
  // A. Ambil data registrasi untuk tahu ID anggotanya
  const { data: reg, error: fetchError } = await supabase
    .from('registrations')
    .select('anggota_id')
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

  // C. Jika Approved, aktifkan status member di tabel members dan izinkan tampil di publik
  if (action === 'Approved') {
    const { error: updateMemberError } = await supabase
      .from('members')
      .update({
        status: 'Active',
        tampil_di_publik: true
      })
      .eq('id', reg.anggota_id)

    if (updateMemberError) {
      return { success: false, error: updateMemberError.message }
    }
  }

  return { success: true, message: `Pendaftaran berhasil di-${action.toLowerCase()}` }
}