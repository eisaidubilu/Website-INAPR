import { useI18n } from '@/i18n/useI18n'
import { buttonGhost, buttonSmall, cx } from '@/lib/ui'

interface PaginationProps {
  label: string
  /** 0-based. */
  page: number
  pages: number
  onChange: (page: number) => void
}

const navButton = cx(
  buttonGhost,
  buttonSmall,
  'cursor-pointer disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:hover:bg-transparent',
)

/** Sebelumnya / Halaman x dari y / Berikutnya. */
export function Pagination({ label, page, pages, onChange }: PaginationProps) {
  const { t } = useI18n()
  const p = t.common.pagination
  if (pages <= 1) return null

  return (
    <nav aria-label={label} className="mt-4 flex items-center justify-between gap-3">
      <button type="button" className={navButton} disabled={page === 0} onClick={() => onChange(page - 1)}>
<span aria-hidden="true">←</span> {p.prev}
      </button>
      <span className="text-[0.92rem] text-muted tabular-nums">{p.page(page + 1, pages)}</span>
      <button
        type="button"
        className={navButton}
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
      >
        {p.next} <span aria-hidden="true">→</span>
      </button>
    </nav>
  )
}
