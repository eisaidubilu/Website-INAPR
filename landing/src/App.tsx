import { Fragment } from 'react'
import { Break } from '@/components/Break'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Footer } from '@/components/Footer'
import { Navbar } from '@/components/Navbar'
import { PointField } from '@/components/PointField'
import { SectionRail } from '@/components/SectionRail'
import { useAnchorRealign } from '@/hooks/useAnchorRealign'
import { usePointerFx } from '@/hooks/usePointerFx'
import { useReveal } from '@/hooks/useReveal'
import { useI18n } from '@/i18n/useI18n'
import { SECTIONS } from '@/sections'

export default function App() {
  const { t } = useI18n()
  useReveal()
  useAnchorRealign()
  usePointerFx()

  return (
    <>
      <a
        href="#main"
        className="sr-only rounded-md bg-accent px-4 py-2 font-heading text-accent-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
      >
        {t.common.skipToContent}
      </a>
      <Navbar />
      {/*
        Lapisan: latar cutting mat (background <main>) → canvas titik 3D
        (fixed, z-0) → konten (z-10). Tanpa WebGL hanya cutting mat yang tampil.
      */}
      <main id="main" tabIndex={-1} className="cutting-mat relative isolate outline-none">
        {/* Kegagalan WebGL/three.js tidak boleh menjatuhkan halaman. */}
        <ErrorBoundary>
          <PointField />
        </ErrorBoundary>
        <div className="relative z-10">
          {SECTIONS.map(({ id, Component }, i) => (
            <Fragment key={id}>
              <Component />
              {i < SECTIONS.length - 1 && <Break index={i} />}
            </Fragment>
          ))}
        </div>
      </main>
      {/* Setelah konten: urutan Tab tetap navbar → konten → rel → footer. */}
      <SectionRail />
      <Footer />
    </>
  )
}
