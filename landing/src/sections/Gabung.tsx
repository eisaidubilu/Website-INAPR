import { PendingLink } from '@/components/PendingLink'
import { Placeholder } from '@/components/Placeholder'
import { Section, SectionHead } from '@/components/Section'
import { useI18n } from '@/i18n/useI18n'
import { buttonPrimary, card, cx, meta, subheading } from '@/lib/ui'

/** #gabung: cara bergabung + manfaat. Seluruhnya placeholder. */
export function Gabung() {
  const { t } = useI18n()
  const c = t.gabung

  return (
    <Section id="gabung">
      <div className="grid gap-12 md:grid-cols-2">
        <div>
          <SectionHead id="gabung" eyebrow={c.eyebrow} title={c.title} placeholder className="mb-3" />
          <p className={subheading}>{c.sub}</p>
          <ol className="m-0 mt-6 grid list-none gap-4 p-0">
            {c.steps.map((step, i) => (
              <li key={step.title} data-reveal className="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-3.5">
                <span
                  aria-hidden="true"
                  className="grid size-10 place-items-center rounded-full bg-accent font-heading font-medium text-accent-ink"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-[1.1rem] font-medium">{step.title}</h3>
                  <p className={meta}>{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-7">
            <PendingLink label={c.cta} className={buttonPrimary} />
          </div>
        </div>

        <div data-reveal className={cx(card, 'grid content-start gap-3 self-start p-6')}>
          <h3 className="flex flex-wrap items-center gap-2 text-[1.1rem] font-medium">
            {c.benefitsTitle} <Placeholder />
          </h3>
          <ul className="m-0 grid gap-2 pl-5">
            {c.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
          <p className="mt-1 flex justify-between gap-4 border-t border-line pt-3.5">
            <span>{c.feeLabel}</span>
            <b className="font-semibold">{c.fee}</b>
          </p>
        </div>
      </div>
    </Section>
  )
}
