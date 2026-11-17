import { useI18n } from '@/i18n/useI18n'
import { cx } from '@/lib/ui'

interface PlaceholderProps {
  className?: string
}

/** Tanda kecil "placeholder" untuk blok lorem ipsum, supaya tidak dikira final. */
export function Placeholder({ className }: PlaceholderProps) {
  const { t } = useI18n()
  return (
    <span
      title={t.common.placeholderHint}
      className={cx(
        'inline-block rounded border border-dashed px-1.5 align-middle font-body text-[0.62rem] leading-[1.6] font-semibold tracking-[0.12em] whitespace-nowrap uppercase',
        className ?? 'border-muted text-muted',
      )}
    >
      {t.common.placeholder}
    </span>
  )
}
