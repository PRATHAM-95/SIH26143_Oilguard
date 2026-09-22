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
const M7_SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots/M7')

test.beforeAll(() => {
  fs.mkdirSync(M7_SCREENSHOT_DIR, { recursive: true })
})

for (const vp of VIEWPORTS) {
  test.describe(`M7 Evidence Stack — Viewport ${vp.label}`, () => {
    test(`verifies map-first default, toggles evidence stack, tests phases, and returns to map`, async ({ browser }) => {
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

      // 1. Navigate to /investigation
      await page.goto(`${BASE_URL}/investigation`, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(800)

      // 2. Verify Map-First default (Evidence stack is NOT auto-mounted)
      const stackHeader = page.locator('text=EXPLODED EVIDENCE STACK')
      await expect(stackHeader).not.toBeVisible()

      // Verify no horizontal overflow in initial map view
      let overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(overflow).toBe(false)

      // Screenshot initial map view
      await page.screenshot({
        path: path.join(M7_SCREENSHOT_DIR, `investigation-map-first-${vp.label}.png`),
      })

      // 3. Click the 3D EVIDENCE STACK toggle
      const openStackBtn = page.getByRole('button', { name: /3D EVIDENCE STACK/i }).first()
      await expect(openStackBtn).toBeVisible()
      await openStackBtn.click()

      // Wait for viewport to mount
      await page.waitForTimeout(1000)

      // 4. Verify Evidence Stack mounted
      await expect(page.locator('text=EXPLODED EVIDENCE STACK').first()).toBeVisible()

      // Verify no horizontal overflow in stack view
      overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(overflow).toBe(false)

      // Screenshot Exploded phase (default)
      await page.screenshot({
        path: path.join(M7_SCREENSHOT_DIR, `investigation-stack-exploded-${vp.label}.png`),
      })

      // 5. Test STACKED phase
      const stackedBtn = page.getByRole('button', { name: /^stacked$/i }).first()
      if (await stackedBtn.isVisible()) {
        await stackedBtn.click()
        await page.waitForTimeout(600)
        await page.screenshot({
          path: path.join(M7_SCREENSHOT_DIR, `investigation-stack-stacked-${vp.label}.png`),
        })
      }

      // 6. Test CONVERGED phase
      const convergedBtn = page.getByRole('button', { name: /^converged$/i }).first()
      if (await convergedBtn.isVisible()) {
        await convergedBtn.click()
        await page.waitForTimeout(600)
        await page.screenshot({
          path: path.join(M7_SCREENSHOT_DIR, `investigation-stack-converged-${vp.label}.png`),
        })
      }

      // 7. Test RETURN TO MAP
      const returnBtn = page.getByRole('button', { name: /RETURN TO MAP/i }).first()
      await expect(returnBtn).toBeVisible()
      await returnBtn.click()
      await page.waitForTimeout(600)

      // Verify map is restored
      await expect(stackHeader).not.toBeVisible()

      // Assert no fatal console errors
      expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)

      await context.close()
    })
  })
}

test('/welcome Scene 04 renders 9-layer evidence stack with illustrative provenance', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/welcome`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(800)

  // Scroll to Scene 04 (~68% of scroll range)
  await page.evaluate((ratio) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, maxScroll * ratio)
    window.dispatchEvent(new Event('scroll'))
  }, 0.68)
  await page.waitForTimeout(1000)

  // Verify Scene 04 narrative and illustrative label
  await expect(page.locator('text=Hydrodynamic Backtracking')).toBeVisible()
  await expect(page.locator('text=9-LAYER EVIDENCE STACK').first()).toBeVisible()
  await expect(page.locator('text=ILLUSTRATIVE · NOT LIVE DATA').first()).toBeVisible()

  // Take screenshot
  await page.screenshot({
    path: path.join(M7_SCREENSHOT_DIR, 'welcome-scene04-evidence-stack-1440x900.png'),
  })

  await context.close()
})

test('Reduced motion mode in investigation renders 2D architectural fallback', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}/investigation`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(800)

  // Open evidence stack
  const openStackBtn = page.getByRole('button', { name: /3D EVIDENCE STACK/i }).first()
  await openStackBtn.click()
  await page.waitForTimeout(800)

  // Verify 2D fallback is rendered
  await expect(page.locator('text=2D ARCHITECTURAL FALLBACK')).toBeVisible()
  await expect(page.locator('text=SATELLITE / SAR SCENE').first()).toBeVisible()
  await expect(page.locator('text=ATTRIBUTION MARKER').first()).toBeVisible()

  // Take screenshot
  await page.screenshot({
    path: path.join(M7_SCREENSHOT_DIR, 'investigation-reduced-motion-fallback-1440x900.png'),
  })

  // Return to map
  const returnBtn = page.getByRole('button', { name: /RETURN TO MAP/i }).first()
  await returnBtn.click()
  await page.waitForTimeout(500)
  await expect(page.locator('text=2D ARCHITECTURAL FALLBACK')).not.toBeVisible()

  await context.close()
})

test('WebGL failure renders 2D architectural fallback with 9 layers', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  // Disable WebGL via init script
  await page.addInitScript(() => {
    const origGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (typeof type === 'string' && type.includes('webgl')) {
        return null
      }
      return origGetContext.apply(this, [type, ...args] as [any, ...any[]])
    }
  })

  await page.goto(`${BASE_URL}/investigation`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(800)

  // Open evidence stack
  const openStackBtn = page.getByRole('button', { name: /3D EVIDENCE STACK/i }).first()
  await openStackBtn.click()
  await page.waitForTimeout(800)

  // Verify 2D fallback is active
  await expect(page.locator('text=2D ARCHITECTURAL FALLBACK')).toBeVisible()

  // Take screenshot
  await page.screenshot({
    path: path.join(M7_SCREENSHOT_DIR, 'investigation-webgl-disabled-fallback-1440x900.png'),
  })

  await context.close()
})
