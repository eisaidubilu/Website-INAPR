import type { HtmlTagDescriptor, Plugin } from 'vite'

/**
 * JSON-LD Organization. HANYA fakta asli dari situs lama:
 * - name, legalName: inapr.org/logo.html (nama perkumpulan di bawah judul bahasa Inggris)
 * - foundingDate, address: rebuild/docs/KONTEN-LAMA.md
 * Jangan menambah yang lain tanpa sumber. legalName tetap dikonfirmasi ke pengurus.
 */
const ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Indonesian Association for Pattern Recognition',
  legalName: 'Perkumpulan Teknologi Pengenalan Pola Indonesia',
  alternateName: 'INAPR',
  foundingDate: '2017',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Jalan Melong Cijerah IV Nomor 14, RT.003/RW 003, Kecamatan Bandung Kulon',
    addressLocality: 'Kota Bandung',
    addressCountry: 'ID',
  },
}

/**
 * SEMENTARA, selama situs masih draf: true = jangan diindeks mesin pencari.
 * - robots.txt berisi "Disallow: /" dan tidak menyebut sitemap
 * - sitemap.xml tidak dibuat
 * - <meta name="robots" content="noindex, nofollow"> dipasang di index.html
 *
 * Saat situs final: ubah ke false DAN hapus header X-Robots-Tag di vercel.json,
 * lalu build/deploy ulang. Langkah lengkap: docs/DEPLOY-VERCEL.md bagian (e).
 */
export const DRAFT_NOINDEX: boolean = true

const OG_IMAGE = { path: 'og.png', width: '1200', height: '630' }
/** Font di atas lipatan: judul (Montserrat 300 untuk h1, 800 untuk aksen/logo) dan isi (Hind Siliguri 400). */
const PRELOAD_FONT = /(montserrat-latin-(300|800)|hind-siliguri-latin-400)-normal-[\w-]+\.woff2$/
/** Sumber chunk engine titik 3D (dimuat dinamis setelah load + idle oleh <PointField />). */
const ENGINE_SOURCE = /\/src\/pointfield\/engine\.ts$/

/**
 * URL situs dari VITE_SITE_URL, dinormalisasi ke "https://host/path/".
 * Kosong → null (tag kanonik/og:url/sitemap tidak dipasang). Tidak valid → build gagal.
 */
export function parseSiteUrl(raw: string | undefined): URL | null {
  const value = raw?.trim()
  if (!value) return null
  let url: URL | null = null
  try {
    url = new URL(value.endsWith('/') ? value : `${value}/`)
  } catch {
    url = null
  }
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    throw new Error(`VITE_SITE_URL tidak valid: "${value}" (contoh: https://inapr.org)`)
  }
  return url
}

/**
 * Meta SEO yang bergantung pada build/env:
 * - og:image + twitter:image (absolut bila VITE_SITE_URL ada), kanonik + og:url (hanya bila ada);
 *   base build (subfolder) digabungkan bila VITE_SITE_URL tidak memuat path
 * - JSON-LD Organization
 * - preload font judul + isi, dan prefetch chunk engine (hanya build, nama file ber-hash)
 * - robots.txt selalu; sitemap.xml hanya bila VITE_SITE_URL ada dan bukan draf
 * - meta robots noindex selama DRAFT_NOINDEX
 */
export function seo(siteUrl: string | undefined): Plugin {
  const configured = parseSiteUrl(siteUrl)
  let site = configured
  let base = '/'
  const absolute = (path: string) => (site ? new URL(path, site).href : `${base}${path}`)
  let ssr = false

  return {
    name: 'inapr-seo',
    configResolved(config) {
      base = config.base
      // Dihosting di subfolder (--base=/landing/ atau VITE_BASE) tetapi VITE_SITE_URL hanya domain
      // (tanpa path): gabungkan base, supaya kanonik/og:url/og:image/sitemap menunjuk ke alamat sebenarnya
      // (https://inapr.org → https://inapr.org/landing/). VITE_SITE_URL yang sudah memuat path dipakai apa adanya.
      site =
        configured && configured.pathname === '/' && base.startsWith('/') && base !== '/'
          ? new URL(base, configured)
          : configured
      ssr = Boolean(config.build.ssr)
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({ tag: 'meta', attrs, injectTo: 'head' })
        const image = absolute(OG_IMAGE.path)
        const tags: HtmlTagDescriptor[] = [
          meta({ property: 'og:image', content: image }),
          meta({ property: 'og:image:width', content: OG_IMAGE.width }),
          meta({ property: 'og:image:height', content: OG_IMAGE.height }),
          meta({ property: 'og:image:alt', content: 'INAPR · Indonesian Association for Pattern Recognition' }),
          meta({ name: 'twitter:image', content: image }),
        ]
        if (DRAFT_NOINDEX) tags.push(meta({ name: 'robots', content: 'noindex, nofollow' }))
        if (site) {
          tags.push({ tag: 'link', attrs: { rel: 'canonical', href: site.href }, injectTo: 'head' })
          tags.push(meta({ property: 'og:url', content: site.href }))
        }
        tags.push({
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: JSON.stringify(site ? { ...ORGANIZATION, url: site.href } : ORGANIZATION),
          injectTo: 'head',
        })
        for (const [file, output] of Object.entries(ctx.bundle ?? {})) {
          // Chunk engine (three.js, ±124 kB brotli) tidak dibutuhkan untuk render pertama, tetapi
          // pasti diminta setelah load + idle. Prefetch = prioritas terendah, mengisi cache lebih awal
          // dan memutus rantai HTML → JS utama → engine. crossorigin = mode yang sama dengan import().
          if (output.type === 'chunk' && output.isDynamicEntry && ENGINE_SOURCE.test(output.facadeModuleId ?? '')) {
            tags.push({
              tag: 'link',
              attrs: { rel: 'prefetch', as: 'script', href: `${base}${file}`, crossorigin: '' },
              injectTo: 'head',
            })
          }
          if (PRELOAD_FONT.test(file)) {
            tags.push({
              tag: 'link',
              attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `${base}${file}`, crossorigin: '' },
              injectTo: 'head',
            })
          }
        }
        return tags
      },
    },
    generateBundle() {
      if (ssr) return
      // Sitemap hanya diumumkan bila situs boleh diindeks (lihat DRAFT_NOINDEX).
      const sitemap = DRAFT_NOINDEX ? null : site
      const robots = DRAFT_NOINDEX
        ? ['# Draf: jangan diindeks. Dicabut lewat DRAFT_NOINDEX di config/seo-plugin.ts.', 'User-agent: *', 'Disallow: /']
        : ['User-agent: *', 'Allow: /']
      if (sitemap) robots.push('', `Sitemap: ${new URL('sitemap.xml', sitemap).href}`)
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.join('\n')}\n` })
      if (sitemap) {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${sitemap.href}</loc></url>\n</urlset>\n`,
        })
      }
    },
  }
}
