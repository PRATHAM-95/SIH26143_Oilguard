/**
 * Selected-incident popup probe.
 *
 * Three things are being guarded here:
 *
 *   1. The incident card must come from a *real* deck.gl pick. The card used to
 *      be reachable only by clicking a vessel, so its SAR branch - the one an
 *      operator actually opens first - was never exercised.
 *
 *   2. It must be reachable the way an operator reaches it. The detector
 *      polygon is genuinely tiny at the default camera (about a pixel across
 *      while vessel glyphs are pinned to a 20px minimum), so aiming at the
 *      slick geometry is a scale problem, not a test. The observed-spill marker
 *      is the app's pickable 8px-radius point at the same coordinates and is
 *      what a user clicks first; the probe picks that.
 *
 *   3. The SAR thumbnail must be drawn from the detector geometry rather than
 *      being a text placeholder. It is checked by pixel: a canvas that rendered
 *      the detection has dark oil over lighter speckled sea, so the mean must sit
 *      below mid-grey while the spread stays wide and no pixel is chromatic. A
 *      flat "preview n/a" box, or an empty canvas, fails all of that.
 */
import { chromium } from 'playwright'
import * as esbuild from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { projector } from './lib/projection.mjs'

const URL = 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'

// The incident's real coordinates, straight from the seed the app itself runs on,
// so the probe aims at the marker the app actually drew.
const OUT = mkdtempSync(join(tmpdir(), 'incident-popup-'))
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

/** The oil candidate's real detector polygon and centroid. */
const oilCandidate = seed
  .sarObservation()
  .candidates.find((c) => c.classification === 'OIL_CANDIDATE')
if (!oilCandidate) {
  console.error('seed has no OIL_CANDIDATE; the probe would be aiming at nothing')
  process.exit(1)
}
/** The centroid is the incident marker's real coordinate. */
const MARKER = { lon: oilCandidate.centroid[0], lat: oilCandidate.centroid[1] }

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })
const errs = []
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4500)

const canvas = await page.locator('canvas.maplibregl-canvas').first().boundingBox()
const pane = { width: canvas.width, height: canvas.height }

/**
 * Map centre as the app reports it, from the coordinate readout.
 *
 * The readout deliberately follows the cursor while it is over the map and falls
 * back to the view centre when it is not, so the pointer has to be parked
 * off-canvas before asking where the map is centred.
 *
 * The probe never moves the camera: the default view already frames the
 * controlled scenario, and driving the camera here would only test the camera.
 */
async function readView() {
  await page.mouse.move(canvas.x - 60, canvas.y + canvas.height / 2)
  await page.waitForTimeout(200)
  const t = await page.locator('.coord-readout').first().innerText()
  const m = /([\d.]+)°([NS])\s*·\s*([\d.]+)°([EW])\s*·\s*z([\d.]+)/.exec(t)
  if (!m) return null
  return {
    latitude: (m[2] === 'S' ? -1 : 1) * Number(m[1]),
    longitude: (m[4] === 'W' ? -1 : 1) * Number(m[3]),
    zoom: Number(m[5]),
  }
}

const view = await readView()
const pick = { zoom: view?.zoom ?? null, onScreen: false, clear: null }

let popup = null
let thumb = null

if (view) {
  const project = projector(view, pane)
  const at = project(MARKER.lon, MARKER.lat)
  pick.onScreen = at.x > 0 && at.y > 0 && at.x < pane.width && at.y < pane.height

  /**
   * How far the aim is from anything that could take the pick.
   *
   * Reported rather than assumed: if this is small the probe is aiming at a
   * vessel hull and the absence of a popup says nothing about the popup.
   */
  const hulls = seed.demoFleet().map((v) => project(v.position.longitude, v.position.latitude))
  const nearestVessel = hulls.length
    ? Math.min(...hulls.map((h) => Math.hypot(h.x - at.x, h.y - at.y)))
    : null
  const topEl = await page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y)
      return el ? `${el.tagName.toLowerCase()}.${el.className || ''}`.slice(0, 60) : null
    },
    [canvas.x + at.x, canvas.y + at.y],
  )
  pick.clear = nearestVessel == null ? null : Math.round(nearestVessel)
  pick.topElement = topEl
  pick.slickSpanPx = Math.round(
    Math.max(
      ...(oilCandidate?.polygon ?? []).map(([lon, lat]) => {
        const p = project(lon, lat)
        return p.x
      }),
    ) -
      Math.min(
        ...(oilCandidate?.polygon ?? []).map(([lon, lat]) => {
          const p = project(lon, lat)
          return p.x
        }),
      ),
  )

  if (pick.onScreen) {
    const x = canvas.x + at.x
    const y = canvas.y + at.y

    // Hover first, then click the same point, so the pick travels the same path
    // a user's cursor takes.
    await page.mouse.move(x, y)
    await page.waitForTimeout(400)
    pick.hover = await page.evaluate(() => {
      const el = document.querySelector('[class*="hover"]')
      return (el?.textContent || '').trim().slice(0, 70) || null
    })
    await page.mouse.click(x, y)
    await page.waitForTimeout(900)

    popup = await page.evaluate(() => {
      const pop = document.querySelector('.mm-pop')
      if (!pop) return null
      const rows = [...pop.querySelectorAll('.mm-pop-row')].map((r) => {
        const k = r.querySelector('.mm-pop-k')?.textContent?.trim() ?? ''
        const v = r.querySelector('.mm-pop-v')?.textContent?.trim() ?? ''
        return k ? `${k}: ${v}` : ''
      })
      return {
        kind: pop.querySelector('.mm-pop-kind')?.textContent?.trim() ?? '',
        name: pop.querySelector('.mm-pop-name')?.textContent?.trim() ?? '',
        rows: rows.filter(Boolean),
        hasClose: Boolean(pop.querySelector('.mm-pop-close')),
        thumbIsCanvas: Boolean(pop.querySelector('.mm-sar-thumb--img canvas')),
        thumbIsTextPlaceholder: Boolean(
          pop.querySelector('.mm-sar-thumb')?.textContent?.includes('preview n/a'),
        ),
      }
    })

    thumb = await page.evaluate(() => {
      const c = document.querySelector('.mm-sar-thumb--img canvas')
      if (!c) return null
      const ctx = c.getContext('2d')
      const { data } = ctx.getImageData(0, 0, c.width, c.height)
      let sum = 0
      let min = 255
      let max = 0
      const n = c.width * c.height
      let colourful = 0
      for (let i = 0; i < n; i++) {
        const r = data[i * 4]
        const g = data[i * 4 + 1]
        const b = data[i * 4 + 2]
        sum += r
        if (r < min) min = r
        if (r > max) max = r
        // Grayscale check: a chromatic thumbnail would be a colour map, not SAR.
        if (Math.abs(r - g) > 8 || Math.abs(g - b) > 8) colourful++
      }
      return {
        mean: Math.round((sum / n) * 10) / 10,
        min,
        max,
        spread: max - min,
        colourfulPx: colourful,
        label: document.querySelector('.mm-sar-thumb--img')?.getAttribute('aria-label') ?? '',
      }
    })
  }
}

const checks = {
  incidentOnScreen: pick.onScreen,
  // The pick has to reach the canvas, or it hit an overlay and proved nothing.
  pickReachesMap: pick.onScreen && /canvas/.test(pick.topElement ?? ''),
  realPickReachesPopup: Boolean(popup),
  // A SAR card, not a vessel card: the whole point of this pass.
  showsSlick: Boolean(popup && /SAR|OBSERVED|SLICK/i.test(popup.kind + popup.name)),
  nameIsRealId: Boolean(popup && /^SLICK-/.test(popup.name)),
  hasClose: Boolean(popup?.hasClose),
  hasPositionRow: Boolean(popup?.rows.some((r) => r.startsWith('Position'))),
  // The incident card is reached from the spill marker, which has no candidate
  // of its own - the detection must still come through.
  showsDetectionMetrics: Boolean(
    popup && popup.rows.some((r) => r.startsWith('Area')) && popup.rows.some((r) => r.startsWith('Confidence')),
  ),
  thumbnailIsCanvas: Boolean(popup?.thumbIsCanvas),
  placeholderGone: Boolean(popup && !popup.thumbIsTextPlaceholder),
  // Oil is dark over speckled sea: mean below mid-grey, but real texture.
  thumbIsDark: Boolean(thumb && thumb.mean < 128),
  thumbHasTexture: Boolean(thumb && thumb.spread > 40),
  thumbIsGrayscale: Boolean(thumb && thumb.colourfulPx === 0),
  thumbDescribed: Boolean(thumb && /schematic/i.test(thumb.label)),
  noErrors: errs.length === 0,
}

const out = {
  ok: Object.values(checks).every(Boolean),
  marker: MARKER,
  pick,
  popup,
  thumb,
  checks,
  errors: errs,
}
console.log(JSON.stringify(out, null, 2))
await browser.close()
