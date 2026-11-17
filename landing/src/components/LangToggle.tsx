import { flushSync } from 'react-dom'
import { useI18n } from '@/i18n/useI18n'
import type { Lang } from '@/i18n/types'
import { prefersReducedMotion } from '@/lib/motion'
import { SegmentedToggle } from './SegmentedToggle'

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'id', label: 'ID' },
  { value: 'en', label: 'EN' },
]

export function LangToggle() {
  const { t, lang, setLang } = useI18n()

  // Crossfade ringan (View Transitions API, ±200ms di global.css). Tanpa dukungan
  // browser atau saat reduced motion: langsung ganti, tanpa animasi.
  const change = (next: Lang) => {
    if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
      setLang(next)
      return
    }
    document.startViewTransition(() => flushSync(() => setLang(next)))
  }

  return <SegmentedToggle label={t.nav.langLabel} options={OPTIONS} value={lang} onChange={change} />
}
