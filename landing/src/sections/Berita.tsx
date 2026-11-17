import { PendingLink } from '@/components/PendingLink'
import { Section, SectionHead } from '@/components/Section'
import { useI18n } from '@/i18n/useI18n'
import { card, cx, meta, textLink } from '@/lib/ui'

/** #berita: berita terbaru. Seluruhnya placeholder. */
export function Berita() {
  const { t } = useI18n()
  const c = t.berita

  return (
    <Section id="berita">
      <SectionHead
        id="berita"
        eyebrow={c.eyebrow}
        title={c.title}
        placeholder
        action={<PendingLink label={c.more} className={textLink} />}
      />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {c.items.map((item, i) => (
          <article key={i} data-reveal className={cx(card, 'grid content-start gap-3')}>
            <p className={meta}>{item.date}</p>
            <h3 className="text-[1.1rem] font-medium">{item.title}</h3>
            <p className={meta}>{item.body}</p>
          </article>
        ))}
      </div>
    </Section>
  )
}
