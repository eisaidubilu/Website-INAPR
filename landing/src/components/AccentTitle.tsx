import type { Title } from '@/i18n/types'

/** Merender judul dengan satu bagian tebal berwarna aksen. */
export function AccentTitle({ title }: { title: Title }) {
  return (
    <>
      {title.lead}
      <b className="font-extrabold text-accent">{title.accent}</b>
      {title.trail}
    </>
  )
}
