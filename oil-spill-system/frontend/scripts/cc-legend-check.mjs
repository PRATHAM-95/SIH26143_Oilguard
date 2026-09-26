/**
 * Legend / layer-catalogue agreement probe.
 *
 * The map legend used to be a hand-written list that had already drifted from the
 * layer catalogue: it labelled vessel *tracks* as "Shipping Lane" while the real
 * shipping-lane layer went unmentioned, and it drew rows for layers the map cannot
 * render. This probe fails if that drift comes back.
 *
 * It compares the two *rendered* surfaces - the floating legend and the layer
 * catalogue drawer - rather than importing the catalogue module, because the real
 * invariant is that the two things an operator sees agree. Both are driven by
 * MAP_LAYER_CATALOG, so any disagreement means one of them has grown a private
 * copy of the list.
 *
 * Checks:
 *   1. Every legend label exists in the catalogue; no invented rows.
 *   2. A legend row is lit only when the catalogue says the layer is available
 *      and on.
 *   3. Every available, on overlay has a lit legend row.
 *   4. Colours agree between the legend swatch and the catalogue swatch.
 *   5. Legend group order matches the catalogue's group order.
 */
import { chromium } from 'playwright'

const URL = 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })
const errs = []
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4000)

// Scrape the legend first: the catalogue drawer is pinned bottom-left and would
// sit on top of it.
const legend = await page.evaluate(() => {
  const state = (el) =>
    el.hasAttribute('data-on') ? 'on' : el.hasAttribute('data-nodata') ? 'nodata' : 'off'
  return {
    rows: [...document.querySelectorAll('.cc-legend-row')].map((el) => ({
      label: (el.textContent || '').trim(),
      state: state(el),
      title: el.getAttribute('title'),
      color: getComputedStyle(el).getPropertyValue('--cc-legend-color').trim().toLowerCase(),
    })),
    groups: [...document.querySelectorAll('.cc-legend-groupname')].map((el) =>
      (el.textContent || '').trim(),
    ),
  }
})

await page.click('.cc-layersbtn')
await page.waitForTimeout(500)

const catalogue = await page.evaluate(() => {
  const root = document.querySelector('[aria-label="Layer catalogue"]')
  if (!root) return null
  const hex = (rgb) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || '')
    if (!m) return (rgb || '').trim().toLowerCase()
    return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')
  }
  return {
    groups: [...root.parentElement.querySelectorAll('h4')].map((el) =>
      (el.textContent || '').trim(),
    ),
    rows: [...root.querySelectorAll('button')].map((btn) => {
      const all = [...btn.querySelectorAll('span')]
      // Pick by role, not index: the button nests a wrapper span around the
      // swatch and the label, so positional indexing is brittle.
      const swatch = btn.querySelector('span > span[style]')
      const label = btn.querySelector('.text-sm')
      const status = btn.querySelector('.font-mono')
      const note = all[all.length - 1]
      return {
        label: (label?.textContent || '').trim(),
        status: (status?.textContent || '').trim(),
        color: swatch ? hex(getComputedStyle(swatch).borderColor) : '',
        note: note && note !== label ? (note.textContent || '').trim() : '',
      }
    }),
  }
})

await page.click('.cc-layersbtn').catch(() => {})
await page.waitForTimeout(300)

const problems = []
if (!catalogue) {
  problems.push({ kind: 'no-catalogue' })
} else {
  const byLabel = new Map(catalogue.rows.map((r) => [r.label, r]))
  const legendByLabel = new Map(legend.rows.map((r) => [r.label, r]))

  // 1. No invented legend rows.
  for (const row of legend.rows) {
    if (!byLabel.has(row.label)) {
      problems.push({ kind: 'legend-row-not-in-catalogue', label: row.label })
    }
  }

  for (const row of legend.rows) {
    const entry = byLabel.get(row.label)
    if (!entry) continue
    const expected =
      entry.status === 'on' ? 'on' : entry.status === 'no data' ? 'nodata' : 'off'

    // 2. Lit only when the catalogue says available and on.
    if (row.state !== expected) {
      problems.push({
        kind: 'state-mismatch',
        label: row.label,
        legend: row.state,
        catalogue: entry.status,
      })
    }

    // 4. Colours agree.
    if (row.color && entry.color && row.color !== entry.color) {
      problems.push({
        kind: 'colour-mismatch',
        label: row.label,
        legend: row.color,
        catalogue: entry.color,
      })
    }
  }

  // 3. Every available, on overlay that is not the basemap is lit in the legend.
  for (const entry of catalogue.rows) {
    if (entry.status === 'on' && !legendByLabel.has(entry.label)) {
      problems.push({ kind: 'active-layer-missing-from-legend', label: entry.label })
    }
  }

  // 5. Group order matches.
  const legendSeq = legend.groups.join('|')
  const catalogueSeq = catalogue.groups.filter((g) => legend.groups.includes(g)).join('|')
  if (legendSeq !== catalogueSeq) {
    problems.push({ kind: 'group-order', legend: legendSeq, catalogue: catalogueSeq })
  }
}

const out = {
  ok: problems.length === 0 && errs.length === 0,
  rowCount: legend.rows.length,
  groups: legend.groups,
  lit: legend.rows.filter((r) => r.state === 'on').map((r) => r.label),
  dimmed: legend.rows.filter((r) => r.state === 'nodata').map((r) => r.label),
  problems,
  errors: errs,
}
console.log(JSON.stringify(out, null, 2))
await browser.close()
