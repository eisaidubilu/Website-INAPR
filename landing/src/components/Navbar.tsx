import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useHeaderMetrics } from '@/hooks/useHeaderMetrics'
import { useI18n } from '@/i18n/useI18n'
import { NAV_IDS, SECTION_IDS } from '@/lib/sections'
import { buttonPrimary, buttonSmall, cx } from '@/lib/ui'
import { Banner } from './Banner'
import { Container } from './Container'
import { LangToggle } from './LangToggle'
import { ThemeToggle } from './ThemeToggle'

const PANEL_ID = 'site-menu'
const DESKTOP_QUERY = '(min-width: 768px)'
/** Jarak gulir (px) sebelum bayangan navbar muncul. */
const SCROLL_SHADOW_AFTER = 8

/**
 * Header sticky: banner draf (ikut tergulung) + bar navigasi.
 * < 768px: menu, toggle, dan CTA masuk panel burger.
 * 768–1279px: dua baris (logo/toggle/CTA, lalu menu).
 * ≥ 1280px: satu baris.
 */
export function Navbar() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const bannerRef = useRef<HTMLParagraphElement>(null)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const active = useActiveSection(SECTION_IDS)

  useHeaderMetrics(headerRef, bannerRef)

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) burgerRef.current?.focus({ preventScroll: true })
  }, [])

  // Bayangan di bawah navbar muncul setelah halaman digulir sedikit.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_SHADOW_AFTER)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Bilah progres scroll (2px, accent) di tepi bawah navbar: scaleX = posisi gulir halaman.
  // Diperbarui sekali per frame dari listener pasif; hanya transform, tanpa render ulang React.
  const progressRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const bar = progressRef.current
      if (!bar) return
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      bar.style.transform = `scaleX(${progress.toFixed(4)})`
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    const observer = new ResizeObserver(schedule)
    observer.observe(document.body)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
    }
  }, [])

  // Indikator menu aktif (≥ 768px): satu garis yang bergeser (transform) ke item aktif.
  const listRef = useRef<HTMLUListElement>(null)
  const barRef = useRef<HTMLLIElement>(null)
  const barPlaced = useRef(false)
  useEffect(() => {
    const list = listRef.current
    const bar = barRef.current
    if (!list || !bar) return
    const place = () => {
      const link = active ? list.querySelector<HTMLElement>(`a[href="#${active}"]`) : null
      if (!link || link.offsetWidth === 0 || getComputedStyle(bar).display === 'none') {
        bar.style.opacity = '0'
        barPlaced.current = false
        return
      }
      // Penempatan pertama tanpa animasi (tidak meluncur dari kiri).
      const instant = !barPlaced.current
      if (instant) bar.style.transition = 'none'
      bar.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop + link.offsetHeight - 2}px) scaleX(${link.offsetWidth})`
      bar.style.opacity = '1'
      if (instant) {
        void bar.offsetWidth
        bar.style.transition = ''
        barPlaced.current = true
      }
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(list)
    let alive = true
    document.fonts?.ready.then(() => {
      if (alive) place()
    })
    return () => {
      alive = false
      observer.disconnect()
    }
  }, [active, t])

  // Saat panel terbuka: Esc menutup (fokus kembali ke burger), klik di luar menutup.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) close(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, close])

  // Panel tidak relevan di desktop; reset saat layar melebar.
  useEffect(() => {
    let media: MediaQueryList
    try {
      media = window.matchMedia(DESKTOP_QUERY)
    } catch {
      return
    }
    const onChange = () => {
      if (media.matches) setOpen(false)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  // Tab keluar dari header saat panel terbuka: tutup panel.
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget
    if (open && next instanceof Node && !event.currentTarget.contains(next)) setOpen(false)
  }

  // Memilih menu di panel mobile: tutup panel, fokus kembali ke burger.
  const onLinkClick = () => {
    if (open) close(true)
  }

  return (
    <header
      ref={headerRef}
      onBlur={onBlur}
      className="sticky top-[calc(var(--banner-h,0px)*-1)] z-50"
    >
      <Banner ref={bannerRef} />
      <nav
        aria-label={t.nav.label}
        className="relative border-b border-line bg-bg/90 backdrop-blur-md"
      >
        <span
          aria-hidden="true"
          className={cx(
            'pointer-events-none absolute inset-x-0 top-full h-3 bg-linear-to-b from-ink/12 to-transparent transition-opacity duration-200 ease-out',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
        <span
          ref={progressRef}
          aria-hidden="true"
          style={{ transform: 'scaleX(0)' }}
          className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 origin-left bg-accent"
        />
        <Container wide className="flex min-h-16 flex-wrap items-center gap-x-3 md:py-2 xl:py-0">
          <a
            href="#tentang"
            aria-label={t.nav.home}
            className="order-1 mr-auto flex min-h-11 items-center gap-2.5 rounded font-heading text-[1.05rem] font-extrabold tracking-[0.04em] text-ink no-underline md:mr-0"
          >
            <span aria-hidden="true" className="h-3.5 w-6 rounded-xs bg-[linear-gradient(var(--accent)_50%,var(--ink)_50%)]" />
            INAPR
          </a>

          <button
            ref={burgerRef}
            type="button"
            aria-expanded={open}
            aria-controls={PANEL_ID}
            onClick={() => setOpen((value) => !value)}
            className="js-only order-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-line px-3 font-body text-sm font-semibold text-ink md:hidden"
          >
            <BurgerIcon open={open} />
            {open ? t.nav.closeMenu : t.nav.openMenu}
          </button>

          <div
            id={PANEL_ID}
            className={cx(
              open ? 'flex' : 'hidden',
              'absolute inset-x-0 top-full max-h-[calc(100dvh-var(--nav-h,4rem))] flex-col gap-5 overflow-y-auto border-b border-line bg-bg px-4 pt-2 pb-6 shadow-lg shadow-ink/10 md:contents',
            )}
          >
            <ul
              ref={listRef}
              className="m-0 flex list-none flex-col p-0 md:relative md:order-4 md:-mx-3 md:basis-full md:flex-row md:flex-wrap xl:order-2 xl:mx-auto xl:basis-auto"
            >
              {NAV_IDS.map((id) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    aria-current={active === id ? 'location' : undefined}
                    onClick={onLinkClick}
                    className="flex min-h-11 items-center rounded-md px-3 py-3 font-heading text-base font-medium whitespace-nowrap text-muted no-underline hover:bg-soft hover:text-ink aria-[current=location]:text-ink max-md:aria-[current=location]:bg-soft max-md:aria-[current=location]:shadow-[inset_0_-2px_0_var(--accent)] md:py-2 md:text-[0.9rem] xl:px-2"
                  >
                    {t.nav.items[id]}
                  </a>
                </li>
              ))}
              {/* Garis indikator aktif (desktop). Lebar 1px di-scaleX ke lebar item. */}
              <li
                ref={barRef}
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 h-0.5 w-px origin-left bg-accent opacity-0 transition-[transform,opacity] duration-200 ease-out max-md:hidden"
              />
            </ul>

            <div className="js-only flex flex-wrap items-center gap-2 md:order-2 md:ml-auto xl:order-3 xl:ml-0">
              <ThemeToggle />
              <LangToggle />
            </div>

            <a
              href="#gabung"
              onClick={onLinkClick}
              className={cx(buttonPrimary, buttonSmall, 'w-full md:order-3 md:w-auto xl:order-4')}
            >
              {t.nav.cta}
            </a>
          </div>
        </Container>
      </nav>
    </header>
  )
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (
        <path d="M4 4l10 10M14 4L4 14" />
      ) : (
        <path d="M2 4.5h14M2 9h14M2 13.5h14" />
      )}
    </svg>
  )
}
