import { PendingLink } from '@/components/PendingLink'
import { Section, SectionHead } from '@/components/Section'
import { Tag } from '@/components/Tag'
import { useI18n } from '@/i18n/useI18n'
import { meta, textLink } from '@/lib/ui'

/** #publikasi: publikasi terbaru. Seluruhnya placeholder. */
export function Publikasi() {
  const { t } = useI18n()
  const c = t.publikasi

  return (
    <Section id="publikasi">
      <SectionHead
        id="publikasi"
        eyebrow={c.eyebrow}
        title={c.title}
        placeholder
        action={<PendingLink label={c.more} className={textLink} />}
      />
      <ul className="m-0 list-none border-t border-line p-0">
        {c.items.map((item, i) => (
          <li
            key={i}
            data-reveal
            className="grid items-baseline gap-x-5 gap-y-1 border-b border-line py-4 md:grid-cols-[5rem_minmax(0,1fr)_auto]"
          >
            <span className="font-heading text-2xl font-light text-muted">{item.year}</span>
            <div>
              <h3 className="mb-1 text-[1.1rem] font-medium">{item.title}</h3>
              <p className={meta}>
                {item.authors} · <Tag>{item.tag}</Tag>
              </p>
            </div>
            <PendingLink
              label={`${c.read} →`}
              className="justify-self-start font-heading text-[0.85rem] font-medium whitespace-nowrap text-accent"
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}
