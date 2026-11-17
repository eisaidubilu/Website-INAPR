import { useI18n } from '@/i18n/useI18n'

/** Pesan saat data lazy masih dimuat atau gagal dimuat. */
export function LoadNotice({ status }: { status: 'loading' | 'error' }) {
  const { t } = useI18n()
  return (
    <output className="js-only block text-[0.92rem] text-muted">
      {status === 'loading' ? t.common.loading : t.common.loadError}
    </output>
  )
}
