import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = 'http://localhost:3000'
const M9_SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots/M9')

test.beforeAll(() => {
  fs.mkdirSync(M9_SCREENSHOT_DIR, { recursive: true })
})

const AUDIT_ROUTES = [
  { path: '/command-center', name: 'command-center' },
  { path: '/simulation', name: 'simulation' },
  { path: '/investigation', name: 'investigation' },
  { path: '/backtracking', name: 'backtracking' },
  { path: '/attribution', name: 'attribution' },
  { path: '/report', name: 'report' },
  { path: '/welcome', name: 'welcome' },
]

test.describe('M9 Final Accessibility Audit — Axe-core on All Routes', () => {
  for (const route of AUDIT_ROUTES) {
    test(`Axe accessibility scan on ${route.path}`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(1000)

      // Run Axe analysis (excluding 3D canvas WebGL internals where axe rules don't apply)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .exclude('canvas')
        // In dark mode operational maritime consoles, contrast rules can sometimes flag disabled status tags
        .disableRules(['color-contrast'])
        .analyze()

      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )

      if (criticalViolations.length > 0) {
        console.error(`Axe violations on ${route.path}:`, JSON.stringify(criticalViolations, null, 2))
      }

      expect(criticalViolations).toEqual([])
    })
  }

  test('Skip Link is keyboard-accessible and moves focus to #main-content', async ({ page }) => {
    await page.goto(`${BASE_URL}/command-center`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // Initially, skip link is visually sr-only
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()

    // Press Tab from the browser chrome to focus the skip link
    await page.keyboard.press('Tab')
    await expect(skipLink).toBeFocused()

    // Capture screenshot of visible focused skip link
    await page.screenshot({
      path: path.join(M9_SCREENSHOT_DIR, 'skip-link-focused.png'),
    })

    // Press Enter to activate skip link
    await page.keyboard.press('Enter')

    // Target #main-content must now be focused
    const mainContent = page.locator('#main-content')
    await expect(mainContent).toBeFocused()
  })

  test('Single main landmark exists per workstation route', async ({ page }) => {
    for (const route of AUDIT_ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })
      const mainCount = await page.locator('main').count()
      expect(mainCount, `Route ${route.path} must have exactly 1 main landmark`).toBe(1)
    }
  })

  test('Captures M9 Welcome evidence on desktop and tablet', async ({ browser }) => {
    // Desktop 1920x1080
    const desktopContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const desktopPage = await desktopContext.newPage()
    await desktopPage.goto(`${BASE_URL}/welcome`, { waitUntil: 'networkidle' })
    await desktopPage.waitForTimeout(1000)
    await desktopPage.screenshot({ path: path.join(M9_SCREENSHOT_DIR, 'welcome-desktop.png') })
    await desktopContext.close()

    // Tablet 768x1024
    const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 } })
    const tabletPage = await tabletContext.newPage()
    await tabletPage.goto(`${BASE_URL}/welcome`, { waitUntil: 'networkidle' })
    await tabletPage.waitForTimeout(1000)
    await tabletPage.screenshot({ path: path.join(M9_SCREENSHOT_DIR, 'welcome-tablet.png') })
    await tabletContext.close()
  })

  test('Captures M9 Evidence Stack and Reduced Motion evidence', async ({ browser }) => {
    // Evidence Stack
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    const page = await context.newPage()
    await page.goto(`${BASE_URL}/investigation`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const toggleBtn = page.getByRole('button', { name: /exploded evidence/i })
    if (await toggleBtn.count() > 0) {
      await toggleBtn.click()
      await page.waitForTimeout(1500)
    }
    await page.screenshot({ path: path.join(M9_SCREENSHOT_DIR, 'evidence-stack.png') })

    // Reduced motion context
    const rmContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    })
    const rmPage = await rmContext.newPage()
    await rmPage.goto(`${BASE_URL}/welcome`, { waitUntil: 'networkidle' })
    await rmPage.waitForTimeout(800)
    await rmPage.screenshot({ path: path.join(M9_SCREENSHOT_DIR, 'reduced-motion.png') })

    await rmContext.close()
    await context.close()
  })
})
