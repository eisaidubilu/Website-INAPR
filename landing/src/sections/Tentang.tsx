import { AccentTitle } from '@/components/AccentTitle'
import { CountUp } from '@/components/CountUp'
import { Placeholder } from '@/components/Placeholder'
import { Section } from '@/components/Section'
import { useI18n } from '@/i18n/useI18n'
import { buttonGhost, buttonPrimary, card, cx, eyebrow, subheading } from '@/lib/ui'

/** #tentang: hero. Semua isi di sini fakta asli, kecuali jumlah institusi. */
export function Tentang() {
  const { t } = useI18n()
  const c = t.tentang

  return (
    <Section id="tentang" className="md:flex md:min-h-[calc(100svh-var(--nav-h,4rem))] md:flex-col md:justify-center">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:items-end">
        <div data-reveal className="max-w-[46rem]">
          <p className={eyebrow}>{c.eyebrow}</p>
          <h1
            id="tentang-title"
            className="mt-3 mb-4 text-[clamp(2rem,4.2vw,3.4rem)] font-light tracking-[-0.025em]"
          >
            <AccentTitle title={c.title} />
          </h1>
          <p className={subheading}>{c.sub}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#gabung" className={buttonPrimary}>
              {c.ctaPrimary}
            </a>
            <a href="#kegiatan" className={buttonGhost}>
              {c.ctaSecondary}
            </a>
          </div>
        </div>

        <div data-reveal className={cx(card, 'grid gap-3')}>
          <h2 className="text-[1.1rem] font-medium">{c.whatTitle}</h2>
          <p>{c.whatBody}</p>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {c.applications.map((app) => (
              <li key={app} className="rounded-full border border-line px-2.5 py-0.5 text-[0.88rem]">
                {app}
              </li>
            ))}
          </ul>
          <p className="text-[0.88rem] text-muted">{c.membershipNote}</p>
        </div>
      </div>

      <dl data-reveal className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line lg:grid-cols-4">
        {c.stats.map((stat) => (
          <div key={stat.label} className="flex flex-col bg-surface px-4 py-5">
            <dt className="text-[0.95rem] text-muted">
              {stat.label} {stat.placeholder && <Placeholder />}
            </dt>
            <dd
              className={cx(
                'order-first m-0 font-heading text-[2.1rem] leading-none font-light md:text-[2.6rem]',
                stat.placeholder && 'text-muted',
              )}
            >
              {stat.placeholder ? stat.value : <CountUp value={stat.value} />}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
