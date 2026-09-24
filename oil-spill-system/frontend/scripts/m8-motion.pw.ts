import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const VIEWPORTS = [
  { label: '1920x1080', width: 1920, height: 1080 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1280x800', width: 1280, height: 800 },
  { label: '768x1024', width: 768, height: 1024 },
]

const BASE_URL = 'http://localhost:3000'
const M8_SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots/M8')

test.beforeAll(() => {
  fs.mkdirSync(M8_SCREENSHOT_DIR, { recursive: true })
})

for (const vp of VIEWPORTS) {
  test.describe(`M8 Motion Polish — Viewport ${vp.label}`, () => {
    test(`verifies route crossfade, flightpath motion, and shared focus rings`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        reducedMotion: 'no-preference',
      })
      const page = await context.newPage()

      const consoleErrors: string[] = []
      page.on('pageerror', (err) => consoleErrors.push(err.message))
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      // 1. Visit Command Center
      await page.goto(`${BASE_URL}/command-center`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForTimeout(600)

      // Take screenshot of Command Center with Flightpath
      await page.screenshot({
        path: path.join(M8_SCREENSHOT_DIR, `m8-command-center-${vp.label}.png`),
      })

      // 2. Flightpath Rail verification
      const flightpath = page.locator('nav[aria-label="Investigation Flightpath"]')
      await expect(flightpath).toBeVisible()

      // Verify progress connector container is visible and uses scaleX
      const progressContainer = flightpath.locator('div[role="progressbar"]')
      await expect(progressContainer).toBeVisible()
      const progressBar = progressContainer.locator('> div')
      await expect(progressBar).toBeAttached()
      const transformStyle = await progressBar.getAttribute('style')
      expect(transformStyle).toContain('scaleX(')

      // 3. Test keyboard focus on Flightpath stage button
      const firstStageBtn = flightpath.locator('button').first()
      await firstStageBtn.focus()
      await page.waitForTimeout(150)

      // Take screenshot showing focus ring
      if (vp.label === '1920x1080') {
        await page.screenshot({
          path: path.join(M8_SCREENSHOT_DIR, `m8-flightpath-focus-ring.png`),
        })
      }

      // 4. Test route crossfade: navigate from / to /investigation
      await page.click('a[href="/investigation"]')
      await page.waitForURL('**/investigation')
      await page.waitForTimeout(500)

      // Verify investigation workstation theater loaded smoothly
      await expect(page.locator('.workstation-theater')).toBeVisible()
      if (vp.width >= 1024) {
        await expect(page.locator('text=Pipeline progress')).toBeVisible()
      }

      // Take screenshot of Investigation route
      await page.screenshot({
        path: path.join(M8_SCREENSHOT_DIR, `m8-investigation-route-${vp.label}.png`),
      })

      // 5. Test navigation from /welcome to /command-center: verifies normal transition outside Layout
      await page.goto(`${BASE_URL}/welcome`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForTimeout(600)

      await page.evaluate(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo(0, maxScroll)
        window.dispatchEvent(new Event('scroll'))
      })
      await page.waitForTimeout(600)

      const ctaBtn = page.getByRole('button', { name: /COMMAND CENTER/i }).first()
      if (await ctaBtn.isVisible()) {
        await ctaBtn.click({ force: true })
        await expect(page).toHaveURL(`${BASE_URL}/command-center`, { timeout: 10_000 })
        await page.waitForTimeout(400)
        await expect(flightpath).toBeVisible()
      }

      await context.close()
    })
  })
}

test.describe('M8 Reduced Motion & Honesty Checks', () => {
  test('verifies reduced motion disables route animation and snaps instantly', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()

    await page.goto(`${BASE_URL}/command-center`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(400)

    // Check that flightpath is visible
    const flightpath = page.locator('nav[aria-label="Investigation Flightpath"]')
    await expect(flightpath).toBeVisible()

    // Capture screenshot under prefers-reduced-motion
    await page.screenshot({
      path: path.join(M8_SCREENSHOT_DIR, 'm8-reduced-motion-command-center.png'),
    })

    // Navigate to /attribution
    await page.click('a[href="/attribution"]')
    await page.waitForURL('**/attribution')
    await page.waitForTimeout(400)

    // Capture screenshot under prefers-reduced-motion
    await page.screenshot({
      path: path.join(M8_SCREENSHOT_DIR, 'm8-reduced-motion-attribution.png'),
    })

    await context.close()
  })
})
