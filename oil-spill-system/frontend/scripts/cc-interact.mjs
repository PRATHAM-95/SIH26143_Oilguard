import { chromium } from 'playwright'

/**
 * Functional smoke check for the command-center chrome.
 * Verifies the compact toolbar actually drives the pre-existing LayerDrawer and
 * that the layer pills / basemap switch mutate real mapStore-backed UI.
 */

const URL =
  process.env.CC_URL || 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })

const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 160)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3500)

const out = {}

// 1. Layer drawer opens from the compact toolbar.
out.drawerBefore = await page.locator('#cc-layers-panel').count()
await page.locator('.cc-layersbtn').click()
await page.waitForTimeout(500)
out.drawerOpenAfterClick = await page.evaluate(() => {
  const el = document.querySelector('#cc-layers-panel')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    w: Math.round(r.width),
    h: Math.round(r.height),
    x: Math.round(r.x),
    y: Math.round(r.y),
    rows: el.querySelectorAll('button[aria-pressed]').length,
  }
})
out.drawerExpanded = await page.locator('.cc-layersbtn').getAttribute('aria-expanded')

// 1b. Drawer must not collide with the legend / compass / control cluster.
out.drawerCollisions = await page.evaluate(() => {
  const r = (s) => {
    const el = document.querySelector(s)
    return el ? el.getBoundingClientRect() : null
  }
  const hit = (a, b) =>
    a && b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
  const d = r('#cc-layers-panel')
  return {
    vsLegend: hit(d, r('.cc-legend')),
    vsControls: hit(d, r('.cc-mapctl')),
    vsCompass: hit(d, r('.north-arrow')),
    vsToolbar: hit(d, r('.cc-mtoolbar')),
  }
})

// 2. A layer pill toggles its own pressed state.
const pill = page.locator('.cc-mpill').nth(1)
out.pillLabel = (await pill.textContent())?.trim()
out.pillBefore = await pill.getAttribute('aria-pressed')
await pill.click()
await page.waitForTimeout(250)
out.pillAfter = await page.locator('.cc-mpill').nth(1).getAttribute('aria-pressed')

// 3. Basemap switch changes the active option.
out.baseBefore = await page.locator('.cc-baseopt[aria-pressed="true"]').textContent()
await page.locator('.cc-baseopt', { hasText: 'DARK' }).click()
await page.waitForTimeout(900)
out.baseAfter = await page.locator('.cc-baseopt[aria-pressed="true"]').textContent()

// 4. No-data pill refuses to present itself as live.
out.noDataInert = await page.evaluate(() => {
  const p = [...document.querySelectorAll('.cc-mpill[data-nodata]')].map((el) => ({
    label: el.textContent.trim(),
    cursor: getComputedStyle(el).cursor,
    pressed: el.getAttribute('aria-pressed'),
  }))
  return p
})

// 5. Module tab switch moves the active state.
out.activeTabBefore = await page.locator('.cc-nav-tab[aria-selected="true"]').textContent()
await page.locator('.cc-nav-tab').nth(3).click()
await page.waitForTimeout(200)
out.activeTabAfter = await page.locator('.cc-nav-tab[aria-selected="true"]').textContent()

// 6. Collapsing the analysis panel gives the map the width back.
const mapBefore = await page.evaluate(() => Math.round(document.querySelector('.cc-map').getBoundingClientRect().width))
await page.locator('.analysis-collapse').click()
await page.waitForTimeout(350)
const mapAfter = await page.evaluate(() => Math.round(document.querySelector('.cc-map').getBoundingClientRect().width))
out.mapWidth = { before: mapBefore, afterCollapse: mapAfter }

console.log(JSON.stringify({ ...out, errors: errors.slice(0, 8) }, null, 2))
await browser.close()
