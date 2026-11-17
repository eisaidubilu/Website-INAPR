import { Section, SectionHead } from '@/components/Section'
import { useI18n } from '@/i18n/useI18n'
import { meta } from '@/lib/ui'

/** #bidang: bidang riset. Seluruhnya placeholder. */
export function Bidang() {
  const { t } = useI18n()
  const c = t.bidang

  return (
    <Section id="bidang">
      <SectionHead id="bidang" eyebrow={c.eyebrow} title={c.title} placeholder />
      <ul data-reveal className="m-0 grid list-none gap-px overflow-hidden rounded-[10px] border border-line bg-line p-0 sm:grid-cols-2 lg:grid-cols-3">
        {c.items.map((item) => (
          <li key={item.name} className="grid content-start gap-2 bg-bg p-6">
            <h3 className="text-[1.1rem] font-medium">{item.name}</h3>
            <p className={meta}>{item.desc}</p>
            <p className="text-[0.85rem] text-muted">{item.counts}</p>
          </li>
        ))}
      </ul>
    </Section>
  )
}
