import { useTheme } from '@/hooks/useTheme'
import { useI18n } from '@/i18n/useI18n'

/**
 * Tombol tema tunggal (bulat 44×44px). Klik: Terang ↔ Gelap dari tema yang sedang tampil,
 * lalu tersimpan sebagai pilihan eksplisit (src/hooks/useTheme.ts).
 *
 * Konvensi ikon: ikon = tema yang sedang AKTIF (matahari = Terang, bulan = Gelap).
 * Ikon mana yang terlihat dipilih CSS dari data-theme di <html> (global.css, .theme-icon),
 * yang sudah di-set script di index.html sebelum render. Jadi ikon benar sejak paint
 * pertama, juga pada HTML prerender, tanpa menunggu state React.
 *
 * Aksesibilitas: aria-label menyebut aksi ("Ganti ke mode gelap/terang"), aria-pressed =
 * true saat Gelap aktif, ikon aria-hidden.
 */
export function ThemeToggle() {
  const { t } = useI18n()
  const { resolved, toggle } = useTheme()
  const dark = resolved === 'dark'

  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={dark ? t.nav.theme.toLight : t.nav.theme.toDark}
      onClick={toggle}
      className="relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-line text-ink transition-[background-color,scale] duration-200 ease-out hover:bg-soft motion-safe:active:scale-[0.97]"
    >
      <SunIcon />
      <MoonIcon />
    </button>
  )
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      className="theme-icon theme-icon-sun absolute"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="theme-icon theme-icon-moon absolute"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  )
}
