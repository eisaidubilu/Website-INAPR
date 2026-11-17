import { Section, SectionHead } from '@/components/Section'
import { useI18n } from '@/i18n/useI18n'
import { subheading } from '@/lib/ui'

/**
 * #afiliasi: INAPR sebagai anggota International Association for Pattern Recognition (IAPR)
 * + mitra. Teks pengantar fakta asli; logo masih placeholder.
 */
export function Afiliasi() {
  const { t } = useI18n()
  const c = t.afiliasi

  return (
    <Section id="afiliasi">
      <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <SectionHead id="afiliasi" eyebrow={c.eyebrow} title={c.title} placeholder className="mb-3" />
          <p data-reveal className={subheading}>{c.sub}</p>
        </div>
        <ul className="m-0 grid list-none grid-cols-3 gap-3 p-0">
          {c.logos.map((logo, i) => (
            <li
              key={`${logo}-${i}`}
              data-reveal
              className="grid aspect-[3/2] place-items-center rounded-lg border border-dashed border-grid-major bg-surface/60 p-1 text-center font-body text-[0.7rem] font-semibold tracking-[0.1em] text-muted uppercase"
            >
              {logo}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
