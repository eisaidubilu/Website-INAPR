'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Mengecek ke tabel admins berdasarkan email
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();

    setLoading(false);

    if (error || !data) {
      alert('Login Gagal: Email tidak ditemukan!');
      return;
    }

    // Pengecekan password (sementara plain text sesuai inputan database)
    if (data.kata_sandi_hash === password) {
      alert(`Login Berhasil! Selamat datang, ${data.nama}`);
      // Nanti bisa diarahkan ke halaman dashboard admin
    } else {
      alert('Login Gagal: Password salah!');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: 'sans-serif' }}>
      <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '30px', borderRadius: '12px', width: '350px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginBottom: '20px', textAlign: 'center', color: '#38bdf8' }}>Admin INAPR Login</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Email Pengurus</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
            placeholder="admin_inapr@mail.com"
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Kata Sandi</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff' }}
            placeholder="••••••••"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ width: '100%', padding: '10px', background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}