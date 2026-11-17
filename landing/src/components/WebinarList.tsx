import { useEffect, useMemo, useRef, useState } from 'react'
import { loadWebinars, type Webinar } from '@/data'
import { useLazyData } from '@/hooks/useLazyData'
import { useI18n } from '@/i18n/useI18n'
import { fold, matchesAll, queryTerms } from '@/lib/search'
import { slideUrl } from '@/lib/slides'
import { buttonGhost, buttonPrimary, buttonSmall, card, cardLift, chip, cx, fieldLabel, meta } from '@/lib/ui'
import { DateBox } from './EventCard'
import { LoadNotice } from './LoadNotice'
import { SearchField } from './SearchField'

const STEP = 6
const ALL = 'all'

interface Entry extends Webinar {
  year: string
  key: string
}

/** Tanggal ISO dibaca sebagai UTC supaya tidak bergeser oleh zona waktu. */
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

/**
 * Daftar webinar (src/data/webinars.json, dimuat lazy): terbaru dulu,
 * pencarian + filter tahun, "tampilkan lebih banyak".
 */
export function WebinarList() {
  const { t } = useI18n()
  const c = t.kegiatan.webinar
  const locale = t.common.locale
  const state = useLazyData(loadWebinars)
  const [query, setQuery] = useState('')
  const [year, setYear] = useState(ALL)
  const [limit, setLimit] = useState(STEP)
  // Indeks item pertama yang baru tampil setelah "tampilkan lebih banyak" → diberi fokus.
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const focusRef = useRef<HTMLLIElement>(null)

  const entries = useMemo<Entry[]>(
    () =>
      state.status === 'ready'
        ? state.data.items.map((item) => ({
            ...item,
            year: item.date.slice(0, 4),
            key: fold(`${item.title} ${item.speaker} ${item.institution}`),
          }))
        : [],
    [state],
  )
  const years = useMemo(() => [...new Set(entries.map((entry) => entry.year))], [entries])

  const results = useMemo(() => {
    const terms = queryTerms(query)
    return entries.filter((entry) => (year === ALL || entry.year === year) && matchesAll(entry.key, terms))
  }, [entries, query, year])
  const shown = results.slice(0, limit)

  const formats = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }),
      monthYear: new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      full: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    }),
    [locale],
  )

  useEffect(() => {
    if (focusIndex !== null) focusRef.current?.focus()
  }, [focusIndex])

  const resetList = () => {
    setLimit(STEP)
    setFocusIndex(null)
  }

  const oldest = entries.at(-1)
  const range = oldest
    ? `${formats.monthYear.format(asDate(oldest.date))} – ${formats.monthYear.format(asDate(entries[0].date))}`
    : ''

  return (
    <div data-reveal className="mt-16">
      <h3 className="text-[clamp(1.3rem,2.2vw,1.6rem)] font-light tracking-[-0.01em]">{c.title}</h3>
      {range && <p className={cx(meta, 'mt-1')}>{c.summary(entries.length, range)}</p>}

      <div className="mt-5 mb-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <SearchField
          id="webinar-cari"
          label={c.searchLabel}
          placeholder={c.searchPlaceholder}
          value={query}
          onChange={(value) => {
            setQuery(value)
            resetList()
          }}
        />
        {years.length > 1 && (
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className={cx(fieldLabel, 'mb-1.5 p-0')}>{c.yearLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {[ALL, ...years].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={year === value}
                  onClick={() => {
                    setYear(value)
                    resetList()
                  }}
                  className={chip}
                >
                  {value === ALL ? c.allYears : value}
                </button>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <div className="min-h-64">
        {state.status !== 'ready' ? (
          <LoadNotice status={state.status} />
        ) : (
          <>
            <output className="mb-3 block text-[0.92rem] text-muted">
              {results.length ? c.showing(shown.length, results.length) : c.empty}
            </output>
            <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
              {shown.map((item, i) => {
                const date = asDate(item.date)
                // Efek naik hanya bila kartu punya tombol (Tonton / Slide).
                const actionable = item.youtube !== '' || item.slides.some((file) => slideUrl(file) !== null)
                return (
                  <li
                    key={`${item.date}-${item.speaker}`}
                    ref={i === focusIndex ? focusRef : undefined}
                    tabIndex={i === focusIndex ? -1 : undefined}
                    className={cx(card, actionable && cardLift, 'grid grid-cols-[auto_minmax(0,1fr)] gap-4 outline-offset-4')}
                  >
                    <div aria-hidden="true">
                      <DateBox
                        date={{
                          top: `${formats.month.format(date).replace('.', '').slice(0, 3)} ${item.year}`.toUpperCase(),
                          main: String(date.getUTCDate()).padStart(2, '0'),
                        }}
                      />
                    </div>
                    <div className="grid min-w-0 content-start gap-1.5">
                      <h4 className="text-[1.05rem] leading-snug font-medium break-words">{item.title}</h4>
                      <p className={meta}>
                        <time dateTime={item.date}>{formats.full.format(date)}</time> · {item.time}
                      </p>
                      <p className="text-[0.95rem] break-words">
                        {item.speaker}
                        {item.institution && <span className="text-muted"> · {item.institution}</span>}
                      </p>
                      <WebinarActions item={item} />
                    </div>
                  </li>
                )
              })}
            </ul>
            {results.length > shown.length && (
              <button
                type="button"
                className={cx(buttonGhost, 'mt-5 cursor-pointer')}
                onClick={() => {
                  setFocusIndex(limit)
                  setLimit((value) => value + STEP)
                }}
              >
                {c.showMore}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Tonton (YouTube) bila ada; Slide hanya bila ada file DAN VITE_SLIDES_BASE_URL terisi. */
function WebinarActions({ item }: { item: Webinar }) {
  const { t } = useI18n()
  const c = t.kegiatan.webinar
  const slides = item.slides
    .map((file) => slideUrl(file))
    .filter((url): url is string => url !== null)
  const external = t.common.newTab

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {item.youtube ? (
        <a href={item.youtube} target="_blank" rel="noopener noreferrer" className={cx(buttonPrimary, buttonSmall)}>
          {c.watch}
          <span className="sr-only">
            : {item.title} (YouTube, {external})
          </span>
        </a>
      ) : (
        <span className="text-[0.85rem] text-muted">{c.noVideo}</span>
      )}
      {slides.map((url, i) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cx(buttonGhost, buttonSmall)}
        >
          {slides.length > 1 ? `${c.slide} ${i + 1}` : c.slide}
          <span className="sr-only">
            : {item.title} (PDF, {external})
          </span>
        </a>
      ))}
    </div>
  )
}
