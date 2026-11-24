import { useMemo, useRef, useState } from 'react'
import { LoadNotice } from '@/components/LoadNotice'
import { Pagination } from '@/components/Pagination'
import { SearchField } from '@/components/SearchField'
import { Section, SectionHead } from '@/components/Section'
import { getMembers } from '@/data/api'
import { useLazyData } from '@/hooks/useLazyData'
import { useI18n } from '@/i18n/useI18n'
import { fold, matchesAll, queryTerms } from '@/lib/search'

const PAGE_SIZE = 10

interface Entry {
  /** Nomor urut di daftar lengkap (1-based), tetap sama saat dicari. */
  n: number
  name: string
  key: string
}

/**
 * #anggota: direktori anggota dari arsip situs lama (src/data/members.json, dimuat lazy).
 * Sumber hanya memuat nama, jadi tidak ada filter institusi.
 */
export function Anggota() {
  const { t } = useI18n()
  const c = t.anggota
  const listRef = useRef<HTMLDivElement>(null)
  // Data dimuat saat daftar mendekati layar, bukan saat halaman dibuka.
  const state = useLazyData(getMembers, listRef)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const entries = useMemo<Entry[]>(
    () =>
      state.status === 'ready'
        ? state.data.members.map((member, i) => ({ n: i + 1, name: member.name, key: fold(member.name) }))
        : [],
    [state],
  )

  const results = useMemo(() => {
    const terms = queryTerms(query)
    return terms.length ? entries.filter((entry) => matchesAll(entry.key, terms)) : entries
  }, [entries, query])

  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const start = current * PAGE_SIZE
  const visible = results.slice(start, start + PAGE_SIZE)

  const onSearch = (value: string) => {
    setQuery(value)
    setPage(0)
  }

  // Ganti halaman dari tombol di bawah: bawa awal daftar kembali ke layar.
  const onPage = (next: number) => {
    setPage(next)
    const el = listRef.current
    if (!el) return
    const offset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
    if (el.getBoundingClientRect().top < offset) el.scrollIntoView({ block: 'start' })
  }

  return (
    <Section id="anggota">
      <SectionHead id="anggota" eyebrow={c.eyebrow} title={c.title} className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-12">
        <div data-reveal className="grid content-start gap-5">
          <p className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-heading text-[clamp(2.6rem,6vw,3.6rem)] leading-none font-light tabular-nums">
              {c.total}
            </span>
            <span className="leading-snug text-muted">
              {c.totalLabel}
              <br />
              {c.asOf}
            </span>
          </p>
          <p className="text-muted">{c.intro}</p>
          <SearchField
            id="anggota-cari"
            label={c.searchLabel}
            placeholder={c.searchPlaceholder}
            value={query}
            onChange={onSearch}
          />
        </div>

        <div data-reveal ref={listRef} className="min-h-80 min-w-0">
          {state.status !== 'ready' ? (
            <LoadNotice status={state.status} />
          ) : (
            <>
              <output className="mb-3 block text-[0.92rem] text-muted">
                {results.length
                  ? c.showing(start + 1, start + visible.length, results.length)
                  : c.empty(query.trim())}
              </output>

              {visible.length > 0 && (
                <>
                  {/* Mobile: kartu. */}
                  <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 md:hidden">
                    {visible.map((entry) => (
                      <li
                        key={entry.n}
                        className="flex items-baseline gap-3 rounded-lg border border-line bg-surface px-4 py-3"
                      >
                        <span className="w-8 shrink-0 text-[0.85rem] text-muted tabular-nums">{entry.n}</span>
                        <span className="min-w-0 break-words">{entry.name}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Desktop: tabel. */}
                  <div className="overflow-hidden rounded-[10px] border border-line max-md:hidden">
                    <table className="w-full border-collapse bg-surface text-left">
                      <caption className="sr-only">{c.caption}</caption>
                      <thead>
                        <tr className="bg-soft">
                          <Th className="w-20">{c.columns.no}</Th>
                          <Th>{c.columns.name}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((entry) => (
                          <tr key={entry.n} className="border-t border-line">
                            <td className="px-4 py-2.5 text-muted tabular-nums">{entry.n}</td>
                            <td className="px-4 py-2.5">{entry.name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <Pagination label={c.paginationLabel} page={current} pages={pages} onChange={onPage} />
            </>
          )}
        </div>
      </div>
    </Section>
  )
}

function Th({ children, className }: { children: string; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 font-body text-[0.72rem] font-semibold tracking-[0.1em] text-muted uppercase ${className ?? ''}`}
    >
      {children}
    </th>
  )
}
