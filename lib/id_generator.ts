import { supabase } from './supabase'

// Fungsi generator Member ID resmi berdasarkan number_settings (T25 - BR-21)
export async function generateDynamicMemberId(tahunDaftar: number): Promise<string> {
  // Ambil pola penomoran dari tabel number_settings untuk jenis 'member'
  const { data: setting, error: fetchError } = await supabase
    .from('number_settings')
    .select('*')
    .eq('jenis', 'member')
    .single()

  if (fetchError || !setting) {
    console.error('Pengaturan penomoran member tidak ditemukan:', fetchError?.message)
    return `INAPR-${tahunDaftar}-001` // Fallback standar
  }

  const nextCounter = setting.penghitung_terakhir + 1
  const paddedNumber = String(nextCounter).padStart(3, '0')

  // Pola di database, misal: "INAPR-[TAHUN]-[NOMOR]"
  const generatedId = setting.pola
    .replace('[TAHUN]', String(tahunDaftar))
    .replace('[NOMOR]', paddedNumber)

  // Update counter terakhir di database
  await supabase
    .from('number_settings')
    .update({ 
      penghitung_terakhir: nextCounter, 
      updated_at: new Date().toISOString() 
    })
    .eq('jenis', 'member')

  return generatedId
}