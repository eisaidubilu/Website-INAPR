/** Kelas Tailwind yang dipakai berulang. Bukan library UI, hanya string. */

/**
 * Tombol: hover/focus naik 2px (translate) + ganti warna dari token, 150ms.
 * motion-safe: tanpa gerak bila prefers-reduced-motion. Outline fokus tetap dari global.css.
 */
const buttonBase =
  'inline-flex min-h-11 items-center justify-center rounded-md border-2 border-accent px-5 py-2 font-heading text-[0.95rem] font-medium no-underline transition-[color,background-color,border-color,translate] duration-150 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:focus-visible:-translate-y-0.5 active:translate-y-0'

/**
 * Tombol utama/CTA. Penanda micro interaction (src/hooks/usePointerFx.ts, global.css):
 * fx-magnetic = bergeser maks. 6px ke arah kursor; fx-ripple = riak dari titik klik.
 */
export const buttonPrimary = `${buttonBase} fx-magnetic fx-ripple bg-accent text-accent-ink hover:bg-transparent hover:text-accent`
export const buttonGhost = `${buttonBase} bg-transparent text-accent hover:bg-soft`
/** Tetap min-h-11 (44px) dari buttonBase; hanya padding dan huruf yang dikecilkan. */
export const buttonSmall = 'px-4 text-[0.85rem]'

/** Tombol pil pilih-satu (pakai aria-pressed). */
export const chip =
  'min-h-11 cursor-pointer rounded-full border border-line bg-bg px-3.5 font-heading text-[0.85rem] font-medium text-muted hover:text-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg'

/** Label kecil huruf kapital di atas field. */
export const fieldLabel = 'font-body text-xs font-semibold uppercase tracking-[0.14em] text-muted'

export const eyebrow =
  'font-body text-xs font-semibold uppercase tracking-[0.14em] text-accent'

export const subheading = 'font-sub text-[1.15rem] leading-[1.45] text-muted'

/** Kartu biasa (tidak bisa diklik): statis, tanpa efek hover. Hanya ikut reveal saat scroll. */
export const card = 'rounded-[10px] border border-line bg-surface p-5'

/**
 * Tambahan untuk kartu yang bisa diklik (berisi tautan/tombol, mis. kartu webinar dengan
 * "Tonton"): naik 2px saat hover atau saat fokus keyboard ada di dalamnya, 200ms.
 * JANGAN dipakai di kartu non-interaktif, supaya kartu tidak tampak bisa diklik.
 * fx-spotlight = sorotan radial halus mengikuti kursor (usePointerFx + global.css).
 */
export const cardLift =
  'fx-spotlight transition-[translate] duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:focus-within:-translate-y-0.5'

export const meta = 'text-[0.92rem] text-muted'

export const textLink =
  'border-b-2 border-current font-heading text-[0.95rem] font-medium text-accent no-underline'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
