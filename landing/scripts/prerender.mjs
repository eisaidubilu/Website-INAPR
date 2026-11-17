#!/usr/bin/env node
/**
 * Langkah terakhir `npm run build`: render <App /> ke HTML (bundel SSR di dist-ssr/)
 * dan masukkan ke <div id="root"> di dist/index.html. Lalu hapus dist-ssr/.
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SSR_DIR = join(ROOT, 'dist-ssr')
const INDEX = join(ROOT, 'dist', 'index.html')
const SLOT = '<div id="root"></div>'

try {
  const { render } = await import(pathToFileURL(join(SSR_DIR, 'entry-server.js')).href)
  const html = readFileSync(INDEX, 'utf8')
  if (!html.includes(SLOT)) throw new Error(`${SLOT} tidak ditemukan di dist/index.html`)
  const app = render()
  writeFileSync(INDEX, html.replace(SLOT, `<div id="root">${app}</div>`))
  console.log(`prerender: ${(Buffer.byteLength(app) / 1024).toFixed(1)} kB HTML dimasukkan ke dist/index.html`)
} finally {
  rmSync(SSR_DIR, { recursive: true, force: true })
}
