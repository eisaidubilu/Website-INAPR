import { useI18n } from '@/i18n/useI18n'
import { cx } from '@/lib/ui'

interface PendingLinkProps {
  label: string
  className: string
}

/**
 * Tampil seperti tautan/tombol di prototipe, tapi belum punya tujuan.
 * Sengaja bukan <a href="#"> supaya tidak ada tautan mati yang bisa difokus.
 */
export function PendingLink({ label, className }: PendingLinkProps) {
  const { t } = useI18n()
  return (
    <span
      title={t.common.linkPending}
      // Belum bisa diklik → tidak ikut efek naik saat hover.
      className={cx(className, 'cursor-not-allowed border-dashed opacity-80 hover:translate-y-0!')}
    >
      {label}
      <span className="sr-only"> ({t.common.linkPending})</span>
    </span>
  )
}
