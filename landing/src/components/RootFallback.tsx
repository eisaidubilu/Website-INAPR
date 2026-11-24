/**
 * Cadangan terakhir bila React gagal di tingkat akar (lihat src/main.tsx): menampilkan lagi
 * HTML prerender yang sudah ada di #root saat halaman dimuat (konten statis, Bahasa Indonesia),
 * ditambah satu catatan dan tombol muat ulang. Tanpa hook/konteks/i18n, supaya tidak ikut gagal.
 * `html` selalu berasal dari build kita sendiri (scripts/prerender.mjs), bukan dari input pengguna.
 * Kosong (dev server tanpa prerender) → hanya catatan.
 */
export function RootFallback({ html }: { html: string }) {
  return (
    <>
      <div role="alert" className="sticky top-0 z-[100] border-b border-line bg-soft px-4 py-3 text-center text-[0.92rem] text-ink">
        Halaman interaktif gagal dimuat, menampilkan versi statis.{' '}
        <span lang="en">The interactive page failed to load; showing the static version.</span>{' '}
        <button type="button" className="cursor-pointer underline" onClick={() => window.location.reload()}>
          Muat ulang / Reload
        </button>
      </div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </>
  )
}
