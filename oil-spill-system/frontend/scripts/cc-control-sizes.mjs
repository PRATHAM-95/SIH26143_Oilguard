/**
 * Measures the map furniture controls and checks they share one hit target.
 *
 * The spec asks for 40x40 map controls. CSS is a poor place to verify that: the
 * declared size, the padding box and the clickable area drift apart easily, and
 * several of these controls are composed from a wrapper plus an inner button.
 * So the boxes are read from the rendered page and compared.
 *
 * Anything below the target is reported as a violation, since a 28 px compass is
 * the classic hard-to-hit control on a map this dense.
 *
 *   node scripts/cc-control-sizes.mjs
 */
import { chromium } from 'playwright'

const URL = process.env.CC_URL || 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'
const TARGET = 40
const TOLERANCE = 1

/**
 * Square, icon-only controls that must all share one 40x40 hit target.
 *
 * Labelled pills and the scale bar are deliberately excluded: forcing a
 * "Vessels" pill or a distance scale to be square would be nonsense, so they are
 * checked against a minimum hit height instead.
 */
const SQUARE = [
  ['maplibre zoom / bearing', '.maplibregl-ctrl-group button'],
]

/** Not square by nature; only the hit height matters. */
const MIN_HEIGHT = [
  ['layer toolbar pills', '.cc-mtoolbar-pills button', 28],
  ['basemap group', '.cc-basegroup button', 28],
  ['region selector trigger', '.region-selector-trigger', 28],
  ['layer drawer toggle', '.cc-mtoolbar button[aria-expanded]', 28],
]

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })
const errs = []
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4500)

const readBoxes = (sel) =>
  page.evaluate((s) => {
    return [...document.querySelectorAll(s)]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => {
        const r = el.getBoundingClientRect()
        return {
          w: Math.round(r.width * 10) / 10,
          h: Math.round(r.height * 10) / 10,
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28),
        }
      })
  }, sel)

const measured = []
const violations = []
const missing = []

for (const [name, selector] of SQUARE) {
  const boxes = await readBoxes(selector)
  measured.push({ name, kind: 'square', target: `${TARGET}x${TARGET}`, boxes })
  if (boxes.length === 0) missing.push(name)
  for (const b of boxes) {
    if (Math.abs(b.w - TARGET) > TOLERANCE || Math.abs(b.h - TARGET) > TOLERANCE) {
      violations.push({ control: name, label: b.label, w: b.w, h: b.h, want: `${TARGET}x${TARGET}` })
    }
  }
}

for (const entry of MIN_HEIGHT) {
  const [name, selector, minH] = entry
  const boxes = await readBoxes(selector)
  measured.push({ name, kind: 'min-height', target: `h>=${minH}`, boxes })
  if (boxes.length === 0) missing.push(name)
  for (const b of boxes) {
    if (b.h < minH) {
      violations.push({ control: name, label: b.label, w: b.w, h: b.h, want: `h>=${minH}` })
    }
  }
}

// The coordinate readout and the compass rose are display furniture, not hit
// targets, but they must still be present and legible.
const furniture = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 40) }
  }
  return { coordReadout: pick('.coord-readout'), compass: pick('.north-arrow') }
})
if (!furniture.coordReadout) missing.push('coordinate readout')
if (!furniture.compass) missing.push('compass rose')

/**
 * Every control must actually be clickable.
 *
 * Correct sizes are not enough: the region selector was sized correctly and
 * still sat on top of zoom-in, so the button rendered at a perfect 40x40 and
 * could not be clicked. `elementFromPoint` is the honest test - it reports what
 * the browser would actually hand the click to at the control's own centre.
 */
const INTERACTIVE = [
  'maplibre zoom in',
  'maplibre zoom out',
  'maplibre compass',
  'region selector trigger',
  'layer toolbar pills',
  'basemap group',
  'layer drawer toggle',
]
const blocked = await page.evaluate((names) => {
  const sel = {
    'maplibre zoom in': 'button.maplibregl-ctrl-zoom-in',
    'maplibre zoom out': 'button.maplibregl-ctrl-zoom-out',
    'maplibre compass': 'button.maplibregl-ctrl-compass',
    'region selector trigger': '.region-selector-trigger',
    'layer toolbar pills': '.cc-mtoolbar-pills button',
    'basemap group': '.cc-basegroup button',
    'layer drawer toggle': '.cc-mtoolbar button[aria-expanded]',
  }
  const out = []
  for (const name of names) {
    for (const el of document.querySelectorAll(sel[name])) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      if (!hit || (hit !== el && !el.contains(hit))) {
        out.push({
          control: name,
          label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28),
          blockedBy: hit ? (hit.className || hit.tagName).toString().slice(0, 48) : 'nothing',
        })
      }
    }
  }
  return out
}, INTERACTIVE)
for (const b of blocked) violations.push({ control: `${b.control} (unreachable)`, ...b })

const out = {
  ok: violations.length === 0 && missing.length === 0,
  target: `${TARGET}x${TARGET}`,
  violations,
  missing,
  furniture,
  measured,
  errors: errs,
}
console.log(JSON.stringify(out, null, 2))
await browser.close()
