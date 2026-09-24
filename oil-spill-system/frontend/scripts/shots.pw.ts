/**
 * shots.spec.ts  – Multi-viewport screenshot harness
 *
 * Captures every route at four standard resolutions, then asserts:
 *   1. No horizontal overflow (scrollWidth <= clientWidth)
 *   2. No console.error during load
 *   3. Map attribution fits its container (scrollWidth <= clientWidth + 2px tolerance)
 *   4. Attribution element is not covered by an overlapping panel
 *
 * Run:  npm run shots
 * Output screenshots: docs/frontend-rebuild/screenshots/<viewport>/<route>.png
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROUTES = ['/command-center', '/simulation', '/investigation', '/backtracking', '/attribution', '/report']

const VIEWPORTS = [
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1280x800', width: 1280, height: 800 },
  { label: '768x1024', width: 768, height: 1024 },
]

const BASE_URL = 'http://localhost:3000'
const SHOT_DIR = process.env.SHOT_DIR 
  ? path.resolve(__dirname, '../../../', process.env.SHOT_DIR)
  : path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots')

/** Route slug for use in filenames. */
function routeSlug(route: string): string {
  return route === '/' ? 'command-center' : route.replace(/^\//, '').replace(/\//g, '-')
}

/** Collect console errors logged during page load. */
function collectErrors(page: Page): string[] {
  const consoleErrors: string[] = []
  page.on('pageerror', (err) => consoleErrors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
    else console.log(`[PAGE CONSOLE] ${msg.text()}`)
  })
  return consoleErrors
}

// Ensure screenshot directories exist before tests run
test.beforeAll(() => {
  for (const vp of VIEWPORTS) {
    fs.mkdirSync(path.join(SHOT_DIR, vp.label), { recursive: true })
  }
})

for (const vp of VIEWPORTS) {
  test.describe(`Viewport ${vp.label}`, () => {
    for (const route of ROUTES) {
      test(`${route} — no overflow, no errors, attribution readable`, async ({ browser }) => {
        const context: BrowserContext = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        })
        const page = await context.newPage()
        const consoleErrors = collectErrors(page)

        await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        if (route !== '/report') {
          await page.waitForSelector('.maplibregl-canvas', { state: 'attached', timeout: 30_000 })
          await page.waitForSelector('.maplibregl-ctrl-attrib', { state: 'attached', timeout: 30_000 })
          // Let the map attribution settle into its final layout position before
          // asserting coverage; the check must measure the landed UI, not a mid-load frame.
          await page
            .waitForFunction(
              () => {
                const el = document.querySelector('.maplibregl-ctrl-attrib') as HTMLElement | null
                if (!el) return false
                const rect = el.getBoundingClientRect()
                const cx = Math.round(rect.left + rect.width / 2)
                const cy = Math.round(rect.top + rect.height / 2)
                const topEl = document.elementFromPoint(cx, cy)
                return topEl ? el.contains(topEl) : false
              },
              undefined,
              { timeout: 20_000, polling: 250 },
            )
            .catch(() => {
              // Not settling here is fine: the iron assertion below reports the definitive result.
            })
        }
        await page.waitForTimeout(600)

        // Capture screenshot
        const shotPath = path.join(SHOT_DIR, vp.label, `${routeSlug(route)}.png`)
        await page.screenshot({ path: shotPath, fullPage: false })

        if (route === '/backtracking') {
          const m4Dir = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots/M4/backtracking')
          fs.mkdirSync(m4Dir, { recursive: true })
          await page.screenshot({ path: path.join(m4Dir, `${vp.label}.png`), fullPage: false })
        }
        if (route === '/attribution') {
          const m4Dir = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots/M4/attribution')
          fs.mkdirSync(m4Dir, { recursive: true })
          await page.screenshot({ path: path.join(m4Dir, `${vp.label}.png`), fullPage: false })
        }

        // ── Assertion 1: No horizontal overflow ──────────────────────────────
        const overflow = await page.evaluate(() => {
          return document.body.scrollWidth > document.body.clientWidth + 2
        })
        expect(overflow, `[${vp.label}] ${route}: horizontal overflow detected`).toBe(false)

        // ── Assertion 2: No console errors ───────────────────────────────────
        // Filter out known benign map-tile 4xx that appear in dev mode
        const realErrors = consoleErrors.filter(
          (e) =>
            !e.includes('Failed to load resource') &&
            !e.includes('ERR_BLOCKED_BY_RESPONSE') &&
            !e.includes('chrome-extension'),
        )
        expect(realErrors, `[${vp.label}] ${route}: console errors`).toHaveLength(0)

        // ── Assertion 3 & 4: Attribution (map pages only) ────────────────────
        const isMapRoute = route !== '/report'
        if (isMapRoute) {
          // Wait for MapLibre attribution to mount
          const mapLocator = page.locator('.maplibregl-map')
          await mapLocator.waitFor({ state: 'attached', timeout: 30_000 }).catch(() => {})
          await page.waitForTimeout(500)

          const attrResult = await page.evaluate(() => {
            // MapLibre renders the attribution inside .maplibregl-ctrl-attrib
            const el = document.querySelector('.maplibregl-ctrl-attrib') as HTMLElement | null
            if (!el) return { found: false, clipped: false, covered: false }

            const rect = el.getBoundingClientRect()
            // Assertion 3: content not clipped (scrollWidth should equal or be < clientWidth)
            const clipped = el.scrollWidth > el.clientWidth + 2

            // Assertion 4: the element at the centre of the attribution rect should be
            // the attribution element itself (or a child of it), not an overlay panel
            const cx = Math.round(rect.left + rect.width / 2)
            const cy = Math.round(rect.top + rect.height / 2)
            const topEl = document.elementFromPoint(cx, cy)
            const covered = topEl ? !el.contains(topEl) : false

            return { found: true, clipped, covered }
          })

          expect(
            attrResult.found,
            `[${vp.label}] ${route}: attribution element not found`,
          ).toBe(true)

          expect(
            attrResult.clipped,
            `[${vp.label}] ${route}: attribution text is clipped`,
          ).toBe(false)

          expect(
            attrResult.covered,
            `[${vp.label}] ${route}: attribution element is covered by another element`,
          ).toBe(false)
        }

        await context.close()
      })
    }
  })
}
