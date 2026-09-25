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

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const APP_BASE_PATH = process.env.PLAYWRIGHT_BASE_PATH ?? '/SIH26143_Oilguard'
const M6_SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots/M6')

test.beforeAll(() => {
  fs.mkdirSync(M6_SCREENSHOT_DIR, { recursive: true })
})

for (const vp of VIEWPORTS) {
  test.describe(`M6 Welcome — Viewport ${vp.label}`, () => {
    test(`renders 3D welcome, scrolls through story arc, and verifies CTA`, async ({ browser }) => {
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

      // 1. Navigate to /welcome
      await page.goto(`${BASE_URL}${APP_BASE_PATH}/welcome`, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(1000)

      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(overflow).toBe(false)

      // Verify canvas exists
      const canvas = page.locator('canvas')
      await expect(canvas).toBeAttached()

      // Scene 01: Ocean screenshot (0% scroll)
      await page.screenshot({
        path: path.join(M6_SCREENSHOT_DIR, `welcome-${vp.label}-01-ocean.png`),
      })

      // Scene 02: Scroll to Vessel (~25% of scrollable range)
      await page.evaluate((ratio) => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo(0, maxScroll * ratio)
        window.dispatchEvent(new Event('scroll'))
      }, 0.25)
      await page.waitForTimeout(700)
      await page.screenshot({
        path: path.join(M6_SCREENSHOT_DIR, `welcome-${vp.label}-02-vessel.png`),
      })

      // Scene 03: Scroll to Spill (~50% of scrollable range)
      await page.evaluate((ratio) => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo(0, maxScroll * ratio)
        window.dispatchEvent(new Event('scroll'))
      }, 0.50)
      await page.waitForTimeout(700)
      await page.screenshot({
        path: path.join(M6_SCREENSHOT_DIR, `welcome-${vp.label}-03-spill.png`),
      })

      // Scene 04: Scroll to Reconstruction (~75% of scrollable range)
      await page.evaluate((ratio) => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo(0, maxScroll * ratio)
        window.dispatchEvent(new Event('scroll'))
      }, 0.75)
      await page.waitForTimeout(700)
      await page.screenshot({
        path: path.join(M6_SCREENSHOT_DIR, `welcome-${vp.label}-04-reconstruction.png`),
      })

      // Scene 05: Scroll to Enter (~100% of scrollable range)
      await page.evaluate((ratio) => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo(0, maxScroll * ratio)
        window.dispatchEvent(new Event('scroll'))
      }, 1.0)
      await page.waitForTimeout(700)
      await page.screenshot({
        path: path.join(M6_SCREENSHOT_DIR, `welcome-${vp.label}-05-enter.png`),
      })

      // Verify primary CTA button click navigates to '/command-center'
      const ctaBtn = page.getByRole('button', { name: /COMMAND CENTER/i }).first()
      await expect(ctaBtn).toBeVisible()
      await ctaBtn.click({ force: true })

      // Client-side SPA navigation assertion (M11: Command Center at /command-center)
      await expect(page).toHaveURL(`${BASE_URL}${APP_BASE_PATH}/command-center`, { timeout: 10_000 })

      // Assert no fatal console errors
      expect(consoleErrors.filter((e) => !e.includes('favicon'))).toHaveLength(0)

      await context.close()
    })
  })
}

test('Base entry route loads a scrollable welcome scene', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}${APP_BASE_PATH}/`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  })
  await expect(page).toHaveURL(`${BASE_URL}${APP_BASE_PATH}/welcome`)
  await expect(page.locator('canvas')).toBeAttached()

  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  )
  expect(maxScroll).toBeGreaterThan(0)

  await page.mouse.move(720, 450)
  await page.mouse.wheel(0, 1_600)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(page.locator('[aria-current=step]')).toContainText(/0[2-5]/)

  await context.close()
})

test('Reduced motion mode renders static accessible view with working CTA', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}${APP_BASE_PATH}/welcome`, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(1000)

  // Take screenshot of reduced motion state
  await page.screenshot({
    path: path.join(M6_SCREENSHOT_DIR, `welcome-reduced-motion-1440x900.png`),
  })

  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  )
  expect(maxScroll).toBeGreaterThan(0)
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * 0.7))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(page.locator('[aria-current=step]')).toContainText(/0[2-5]/)

  // CTA button should be immediately accessible
  const ctaBtn = page.getByRole('button', { name: /COMMAND CENTER/i }).first()
  await expect(ctaBtn).toBeVisible()
  await ctaBtn.click({ force: true })
  await expect(page).toHaveURL(`${BASE_URL}${APP_BASE_PATH}/command-center`, { timeout: 10_000 })

  await context.close()
})

test('Scroll progress rail is visible and tracks scroll position', async ({ browser }) => {
  for (const vp of [
    { label: '1440x900', width: 1440, height: 900 },
    { label: '390x844', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage()

    await page.goto(`${BASE_URL}${APP_BASE_PATH}/welcome`, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    })

    const rail = page.locator('[data-welcome-rail]')
    const thumb = page.locator('[data-welcome-rail-thumb]')
    const percent = page.locator('[data-welcome-rail-percent]')

    await expect(rail).toBeVisible()
    await expect(thumb).toBeVisible()
    await expect(percent).toHaveText('0%')

    const before = await thumb.boundingBox()
    expect(before).not.toBeNull()

    await page.mouse.move(vp.width / 2, vp.height / 2)
    await page.mouse.wheel(0, 1_600)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

    // The sliding bar must actually move and report a non-zero position.
    await expect(percent).not.toHaveText('0%')
    const after = await thumb.boundingBox()
    expect(after).not.toBeNull()
    expect(after!.y).toBeGreaterThan(before!.y)

    // Exactly one chapter tick is active, and it advanced past the first.
    const activeTicks = page.locator('[data-welcome-rail-tick][data-active]')
    await expect(activeTicks).toHaveCount(1)
    await expect(activeTicks).toHaveAttribute('aria-label', /chapter 0[2-5]/)

    await context.close()
  }
})

test('Chapter tick jumps to the matching scroll position', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await page.goto(`${BASE_URL}${APP_BASE_PATH}/welcome`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  })

  await page.locator('[data-welcome-rail-tick]').nth(4).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(page.locator('[data-welcome-rail-tick][data-active]')).toHaveAttribute(
    'aria-label',
    /chapter 05/
  )

  await context.close()
})

test('WebGL disabled keeps the full scrollable welcome experience', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()

  // Simulate WebGL failure (hardware acceleration off, blocklisted driver, VM)
  await page.addInitScript(() => {
    const origGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (typeof type === 'string' && type.includes('webgl')) {
        return null
      }
      return origGetContext.apply(this, [type, ...args] as [any, ...any[]])
    }
  })

  await page.goto(`${BASE_URL}${APP_BASE_PATH}/welcome`, {
    waitUntil: 'networkidle',
    timeout: 30_000,
  })
  await page.waitForTimeout(800)

  // The 2D schematic scene replaces the WebGL canvas...
  await expect(page.locator('[data-welcome-scene="2d"]')).toBeAttached()
  await expect(page.locator('canvas')).toHaveCount(0)

  // ...but the scroll track, progress rail and chapter narrative all survive.
  const maxScroll = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight
  )
  expect(maxScroll).toBeGreaterThan(0)
  await expect(page.locator('[data-welcome-rail]')).toBeVisible()

  await page.screenshot({
    path: path.join(M6_SCREENSHOT_DIR, 'welcome-2d-schematic-1440x900.png'),
  })

  await page.mouse.move(720, 450)
  await page.mouse.wheel(0, 1_600)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(page.locator('[aria-current=step]')).toContainText(/0[2-5]/)
  await expect(page.locator('[data-welcome-rail-percent]')).not.toHaveText('0%')

  // CTA still navigates to the command center
  const ctaBtn = page.getByRole('button', { name: /COMMAND CENTER/i }).first()
  await expect(ctaBtn).toBeVisible()
  await ctaBtn.click({ force: true })
  await expect(page).toHaveURL(`${BASE_URL}${APP_BASE_PATH}/command-center`, { timeout: 10_000 })

  await context.close()
})

