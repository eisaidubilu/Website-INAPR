import type { ReactNode } from 'react'
import type { EventDate, EventItem } from '@/i18n/types'
import { card, cx, meta } from '@/lib/ui'
import { Tag } from './Tag'

export function DateBox({ date }: { date: EventDate }) {
  const long = date.main.length > 2
  return (
    <div className="min-w-16 self-start overflow-hidden rounded-lg border border-line bg-surface text-center">
      <span className="block bg-accent px-1.5 py-0.5 font-body text-[0.68rem] font-semibold tracking-[0.1em] text-accent-ink">
        {date.top}
      </span>
      <span
        className={cx(
          'block px-1.5 font-heading font-light',
          long ? 'text-xl leading-[2.6rem]' : 'text-[1.9rem] leading-[1.35]',
        )}
      >
        {date.main}
      </span>
    </div>
  )
}

interface EventCardProps {
  event: EventItem
  className?: string
  children?: ReactNode
}

/** Kartu kegiatan: kotak tanggal (bila ada), tag, judul, keterangan. */
export function EventCard({ event, className, children }: EventCardProps) {
  return (
    <article data-reveal className={cx(card, 'grid gap-4', event.date && 'grid-cols-[auto_minmax(0,1fr)]', className)}>
      {event.date && <DateBox date={event.date} />}
      <div className="min-w-0">
        <Tag>{event.tag}</Tag>
        <h3 className="mt-2 mb-1 text-[1.1rem] font-medium">{event.title}</h3>
        {event.meta && <p className={meta}>{event.meta}</p>}
      </div>
      {children}
    </article>
  )
}
