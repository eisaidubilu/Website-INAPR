import { EventCard } from '@/components/EventCard'
import { Section, SectionHead } from '@/components/Section'
import { WebinarList } from '@/components/WebinarList'
import { useI18n } from '@/i18n/useI18n'

/** #kegiatan: kegiatan 2018–2020 + webinar 2021–2022 dari situs lama (fakta asli). */
export function Kegiatan() {
  const { t } = useI18n()
  const c = t.kegiatan
  const { keynoteLabel, keynotes, ...featured } = c.featured

  return (
    <Section id="kegiatan">
      <SectionHead id="kegiatan" eyebrow={c.eyebrow} title={c.title} className="mb-3" />
      <p data-reveal className="mb-8 text-[0.92rem] text-muted">{c.source}</p>

      <EventCard event={featured} className="mb-5 md:grid-cols-[auto_minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="col-span-full border-t border-line pt-4 md:col-span-1 md:border-t-0 md:border-l md:pt-0 md:pl-5">
          <h4 className="font-body text-xs font-semibold tracking-[0.14em] text-muted uppercase">{keynoteLabel}</h4>
          <ul className="mt-2 grid gap-1 pl-5">
            {keynotes.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </EventCard>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {c.items.map((item) => (
          <EventCard key={item.title} event={item} />
        ))}
      </div>

      <WebinarList />
    </Section>
  )
}
