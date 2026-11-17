import { supabase } from './supabase'

// 1. Fungsi untuk mendapatkan / generate nomor invoice otomatis berdasarkan number_settings (FR-013, BR-24)
export async function generateInvoiceNumber(): Promise<string> {
  // Ambil data pengaturan penomoran untuk invoice
  const { data: setting, error: fetchError } = await supabase
    .from('number_settings')
    .select('*')
    .eq('jenis', 'invoice')
    .single()

  if (fetchError || !setting) {
    console.error('Pengaturan penomoran invoice tidak ditemukan:', fetchError?.message)
    return `INV-${new Date().getFullYear()}-001` // Fallback
  }

  const nextCounter = setting.penghitung_terakhir + 1
  const paddedNumber = String(nextCounter).padStart(3, '0')
  const tahun = new Date().getFullYear()
  
  // Format pola: misal pola di DB adalah "INV-[TAHUN]-[NOMOR]"
  const generatedInvoiceNo = setting.pola
    .replace('[TAHUN]', String(tahun))
    .replace('[NOMOR]', paddedNumber)

  // Update penghitung terakhir ke database
  await supabase
    .from('number_settings')
    .update({ penghitung_terakhir: nextCounter, updated_at: new Date().toISOString() })
    .eq('jenis', 'invoice')

  return generatedInvoiceNo
}

// 2. Fungsi untuk membuat tagihan / invoice baru
export async function createInvoice(data: {
  anggota_id?: string
  peserta_id?: string
  jumlah: number
}) {
  const nomorInvoice = await generateInvoiceNumber()

  const { data: invoiceData, error } = await supabase
    .from('invoices')
    .insert([
      {
        nomor_invoice: nomorInvoice,
        anggota_id: data.anggota_id || null,
        peserta_id: data.peserta_id || null,
        jumlah: data.jumlah,
        status: 'Pending'
      }
    ])
    .select()

  if (error) {
    console.error('Gagal membuat invoice:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, nomorInvoice, data: invoiceData }
}

// 3. Fungsi untuk memperbarui status pembayaran / konfirmasi bukti bayar
export async function updateInvoiceStatus(
  invoiceId: string, 
  status: 'Paid' | 'Failed' | 'Pending'
) {
  const { data, error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', invoiceId)
    .select()

  if (error) {
    console.error('Gagal memperbarui status invoice:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}