import type { Ref } from 'react'
import { useI18n } from '@/i18n/useI18n'

/** Pita status draf di paling atas. Jangan dihapus sampai konten final. */
export function Banner({ ref }: { ref?: Ref<HTMLParagraphElement> }) {
  const { t } = useI18n()
  return (
    <p
      ref={ref}
      className="bg-ink px-4 py-1.5 text-center font-body text-[0.72rem] leading-snug font-semibold tracking-[0.1em] text-bg uppercase"
    >
      {t.banner}
    </p>
  )
}
