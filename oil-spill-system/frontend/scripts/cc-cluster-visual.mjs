/**
 * Visual check for the candidate cluster badge.
 *
 * The interaction probe proves the badge is pickable; this proves it is actually
 * painted. A layer can be hoverable yet invisible (alpha too low, drawn under
 * the basemap, sized to nothing) and every DOM-level check would still pass, so
 * the badge's pixels are counted directly in the composited canvas.
 *
 * The expected ink is the badge's own fill, #FF7A50, which nothing else on the
 * map uses at that density: slick oranges are dimmer and spread over a much
 * larger area, and vessel hulls are drawn in slate/porcelain.
 *
 *   node scripts/cc-cluster-visual.mjs
 */
import { chromium } from 'playwright'
import * as esbuild from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { projector } from './lib/projection.mjs'

const URL = process.env.CC_URL || 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'

const OUT = mkdtempSync(join(tmpdir(), 'cluster-visual-'))
const BUNDLE = join(OUT, 'seed.mjs')
await esbuild.build({
  entryPoints: ['src/lib/demo/seed.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: BUNDLE,
  alias: { '@': './src' },
  logLevel: 'warning',
})
const seed = await import(pathToFileURL(BUNDLE).href)

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })
const errs = []
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(5000)

const box = await page.locator('.cc-map').boundingBox()
const project = projector(
  { longitude: 72, latitude: 7, zoom: 3.6 },
  { width: box.width, height: box.height },
)
const cands = seed
  .demoFleet()
  .filter((v) => seed.demoCandidateVessels().some((c) => c.mmsi === v.mmsi))
const centre = project(
  cands.reduce((s, v) => s + v.position.longitude, 0) / cands.length,
  cands.reduce((s, v) => s + v.position.latitude, 0) / cands.length,
)

/**
 * Count badge-coloured pixels in a square window around the expected centre.
 *
 * deck.gl shares MapLibre's WebGL canvas and does not preserve the drawing
 * buffer, so the composited page is screenshotted and the window is decoded from
 * that. Sampling the canvas directly would come back blank.
 */
const window_ = 34
const clip = {
  x: Math.round(box.x + centre.x - window_ / 2),
  y: Math.round(box.y + centre.y - window_ / 2),
  width: window_,
  height: window_,
}
const buf = await page.screenshot({ clip })
const count = await page.evaluate(
  async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data
    let hits = 0
    let best = 255 * 3
    for (let i = 0; i < data.length; i += 4) {
      const d =
        Math.abs(data[i] - 255) + Math.abs(data[i + 1] - 122) + Math.abs(data[i + 2] - 80)
      if (d < 90) hits++
      if (d < best) best = d
    }
    return { hits, best, total: data.length / 4 }
  },
  buf.toString('base64'),
)

const out = {
  expected: { candidates: cands.length, centrePx: { x: +centre.x.toFixed(1), y: +centre.y.toFixed(1) } },
  badgePixels: count,
  // A 10-13 px radius disc plus a 17-24 px ring should put well over a hundred
  // near-exact pixels in a 34 px window.
  badgeVisible: (count.hits ?? 0) > 100,
  errors: errs,
}
console.log(JSON.stringify(out, null, 2))
await browser.close()
