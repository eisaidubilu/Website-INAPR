import type { ReactNode } from 'react'
import type { SectionId, Title } from '@/i18n/types'
import { SECTION_IDS } from '@/lib/sections'
import { cx, eyebrow as eyebrowClass } from '@/lib/ui'
import { AccentTitle } from './AccentTitle'
import { Container } from './Container'
import { Placeholder } from './Placeholder'

interface SectionProps {
  id: SectionId
  children: ReactNode
  className?: string
}

/**
 * Satu section halaman. Atribut data-section (indeks 0..7) dipakai engine
 * scroll di tahap 2; angka besar di belakang (data-section-number) disiapkan
 * untuk parallax.
 */
export function Section({ id, children, className }: SectionProps) {
  const index = SECTION_IDS.indexOf(id)
  return (
    <section
      id={id}
      data-section={index}
      aria-labelledby={`${id}-title`}
      className={cx('relative py-14 md:py-24', className)}
    >
      <Container className="relative">
        <span
          aria-hidden="true"
          data-section-number=""
          className="pointer-events-none absolute -top-2 right-4 font-heading text-[5.5rem] leading-none font-extrabold text-transparent select-none [-webkit-text-stroke:1px_var(--grid-major)] md:-top-4 md:right-6 md:text-[clamp(7rem,14vw,11rem)]"
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="relative">{children}</div>
      </Container>
    </section>
  )
}

interface SectionHeadProps {
  id: SectionId
  eyebrow: string
  title: Title
  /** Tampilkan tanda "placeholder" bila isi section masih lorem ipsum. */
  placeholder?: boolean
  action?: ReactNode
  /** Mengganti margin bawah bawaan (mb-8). */
  className?: string
}

/** Eyebrow + judul h2 (+ aksi opsional di kanan). */
export function SectionHead({ id, eyebrow, title, placeholder, action, className }: SectionHeadProps) {
  return (
    <div data-reveal className={cx('flex flex-wrap items-end justify-between gap-4', className ?? 'mb-8')}>
      <div>
        <p className="flex flex-wrap items-center gap-2">
          <span className={eyebrowClass}>{eyebrow}</span>
          {placeholder && <Placeholder />}
        </p>
        <h2
          id={`${id}-title`}
          className="mt-1.5 text-[clamp(1.6rem,2.8vw,2.2rem)] font-light tracking-[-0.02em]"
        >
          <AccentTitle title={title} />
        </h2>
      </div>
      {action}
    </div>
  )
}
