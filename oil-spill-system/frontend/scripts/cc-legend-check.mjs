/**
 * Legend / layer-drawer agreement probe.
 *
 * The map legend used to be a hand-written list that had already drifted from
 * the layer catalogue: it labelled vessel *tracks* as "Shipping Lane" while the
 * real shipping-lane layer went unmentioned, and it drew rows for layers the map
 * cannot render. This probe fails if that drift comes back.
 *
 * It compares the two *rendered* surfaces - the floating legend and the layer
 * drawer - rather than importing the catalogue module, because the real
 * invariant is that the two things an operator sees agree. Both are driven by
 * MAP_LAYER_CATALOG, so any disagreement means one of them has grown a private
 * copy of the list.
 *
 * Both surfaces were then cut down, deliberately, to stop the map giving three
 * different answers to "what can I turn on": the legend was thirteen rows in
 * four labelled groups, and the drawer offered all seventeen catalogue layers
 * including four that only ever render as a disabled explanation. The legend is
 * now the incident and the fleet; the drawer is the union of the legend and the
 * toolbar pills. Those are decisions about what to *show*, so they are pinned
 * here - a future layer added to the catalogue should be a deliberate edit to
 * this file, not a silent arrival in the drawer.
 *
 * Checks:
 *   1. Every legend label exists in the drawer; no invented rows.
 *   2. A legend row is lit only when the drawer says the layer is available and on.
 *   3. Colours agree between the legend swatch and the drawer swatch.
 *   4. The legend is exactly the incident and the fleet, in order.
 *   5. The drawer is exactly the eight operational layers.
 *   6. Drawer rows explain themselves in a tooltip, not a second line of text.
 *   7. Drawer groups follow the store's group order.
 *   8. No metric scale bar has crept back into the bottom-left corner.
 */
import { chromium } from 'playwright'

const URL = process.env.CC_URL || 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'

/** The legend's contract: the incident, the fleet, and what the fleet left. */
const LEGEND_ROWS = ['Potential oil slick', 'Vessels', 'Vessel tracks', 'Forward drift']

/**
 * The drawer's contract: the legend plus the four environment/boundary layers
 * the toolbar row already offers, so the two surfaces describe one set.
 */
const DRAWER_ROWS = [
  'Potential oil slick',
  'Satellite passes',
  'Vessels',
  'Vessel tracks',
  'Forward drift',
  'EEZ boundaries',
  'Ocean currents',
  'Wind field',
]

/** Group order as the store declares it. Drawer groups must follow this. */
const GROUP_ORDER = ['Observation', 'Simulation', 'Environment', 'Analysis']

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })
const errs = []
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4000)

const legend = await page.evaluate(() => {
  const state = (el) =>
    el.hasAttribute('data-on') ? 'on' : el.hasAttribute('data-nodata') ? 'nodata' : 'off'
  const section = document.querySelector('section.cc-legend')
  return {
    rows: [...document.querySelectorAll('.cc-legend-row')].map((el) => ({
      label: (el.textContent || '').trim(),
      state: state(el),
      title: el.getAttribute('title'),
      color: getComputedStyle(el).getPropertyValue('--cc-legend-color').trim().toLowerCase(),
    })),
    // A flat list reads better than four rows sorted into categories, so the
    // headings are gone from the markup. Recorded to catch them creeping back.
    groupHeadings: [...document.querySelectorAll('.cc-legend-groupname')].length,
    box: section ? { w: Math.round(section.getBoundingClientRect().width) } : null,
  }
})

// 8. The scale bar sat under the legend and was removed; it is easy to add back
// by accident from a MapLibre example.
const scaleBars = await page.evaluate(
  () => document.querySelectorAll('.maplibregl-ctrl-scale').length,
)

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
    groups: [...root.querySelectorAll('h4')].map((el) => (el.textContent || '').trim()),
    rows: [...root.querySelectorAll('button')].map((btn) => {
      // Pick by role, not index: the button nests a wrapper span around the
      // swatch and the label, so positional indexing is brittle.
      const swatch = btn.querySelector('span > span[style]')
      const label = btn.querySelector('.text-sm')
      const status = btn.querySelector('.font-mono')
      return {
        label: (label?.textContent || '').trim(),
        status: (status?.textContent || '').trim(),
        color: swatch ? hex(getComputedStyle(swatch).borderColor) : '',
        title: btn.getAttribute('title'),
        // 6: a note rendered as a sibling of the label doubles every row's height.
        noteLines: [...btn.querySelectorAll('span > span')].filter(
          (s) => s !== label && s !== status && s.textContent && s.textContent.trim().length > 2,
        ).length,
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
  const legendLabels = legend.rows.map((r) => r.label)

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

    // 2. Lit only when the drawer says available and on.
    if (row.state !== expected) {
      problems.push({
        kind: 'state-mismatch',
        label: row.label,
        legend: row.state,
        catalogue: entry.status,
      })
    }

    // 3. Colours agree.
    if (row.color && entry.color && row.color !== entry.color) {
      problems.push({
        kind: 'colour-mismatch',
        label: row.label,
        legend: row.color,
        catalogue: entry.color,
      })
    }
  }

  // 4. The legend is the incident and the fleet, in order - nothing more.
  if (legendLabels.join('|') !== LEGEND_ROWS.join('|')) {
    problems.push({ kind: 'legend-rows', want: LEGEND_ROWS.join('|'), got: legendLabels.join('|') })
  }
  if (legend.groupHeadings > 0) {
    problems.push({ kind: 'legend-group-headings', count: legend.groupHeadings })
  }

  // 5. The drawer is exactly the operational set.
  const drawerLabels = catalogue.rows.map((r) => r.label)
  if (drawerLabels.join('|') !== DRAWER_ROWS.join('|')) {
    problems.push({ kind: 'drawer-rows', want: DRAWER_ROWS.join('|'), got: drawerLabels.join('|') })
  }

  // 6. Rows explain themselves on hover, not by growing.
  for (const row of catalogue.rows) {
    if (!row.title || row.title.length < 4) {
      problems.push({ kind: 'drawer-row-no-title', label: row.label })
    }
    if (row.noteLines > 0) {
      problems.push({ kind: 'drawer-note-line', label: row.label, count: row.noteLines })
    }
  }

  // 7. Drawer groups follow the store's declared order, with none invented.
  const groupSeq = catalogue.groups.join('|')
  const expectedGroups = GROUP_ORDER.filter((g) => catalogue.groups.includes(g)).join('|')
  if (groupSeq !== expectedGroups) {
    problems.push({ kind: 'group-order', want: expectedGroups, got: groupSeq })
  }
}

if (scaleBars > 0) {
  problems.push({ kind: 'scale-bar-returned', count: scaleBars })
}

const out = {
  ok: problems.length === 0 && errs.length === 0,
  legendRows: legend.rows.length,
  legendOrder: legend.rows.map((r) => r.label),
  drawerRows: catalogue ? catalogue.rows.length : 0,
  drawerOrder: catalogue ? catalogue.rows.map((r) => r.label) : [],
  groups: catalogue ? catalogue.groups : [],
  scaleBars,
  lit: legend.rows.filter((r) => r.state === 'on').map((r) => r.label),
  dimmed: legend.rows.filter((r) => r.state === 'nodata').map((r) => r.label),
  problems,
  errors: errs,
}
console.log(JSON.stringify(out, null, 2))
await browser.close()
