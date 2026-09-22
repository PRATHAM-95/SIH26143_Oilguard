import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = 'http://localhost:3000'
const M5_SHOT_DIR = path.resolve(__dirname, '../../../docs/frontend-rebuild/screenshots/M5')

const REPORT_SECTIONS = [
  { id: 'dossier-hero', number: '01', title: 'Incident Dossier' },
  { id: 'executive-finding', number: '02', title: 'Executive Finding' },
  { id: 'detection', number: '03', title: 'SAR Detection' },
  { id: 'characterization', number: '04', title: 'Slick Characterization' },
  { id: 'environment', number: '05', title: 'Environmental Conditions' },
  { id: 'forward-drift', number: '06', title: 'Forward Drift Simulation' },
  { id: 'backtracking', number: '07', title: 'Backtracking — Source Estimation' },
  { id: 'ais-traffic', number: '08', title: 'AIS Vessel Traffic' },
  { id: 'attribution', number: '09', title: 'Multi-Factor Attribution' },
  { id: 'conclusion', number: '10', title: 'Conclusion' },
  { id: 'provenance', number: '11', title: 'Evidence & Provenance' },
  { id: 'limitations', number: '12', title: 'Limitations & Uncertainty' },
  { id: 'technical-appendix', number: '13', title: 'Technical Appendix' },
]

test.beforeAll(() => {
  fs.mkdirSync(path.join(M5_SHOT_DIR, 'report'), { recursive: true })
  fs.mkdirSync(path.join(M5_SHOT_DIR, 'print'), { recursive: true })
  fs.mkdirSync(path.join(M5_SHOT_DIR, 'export'), { recursive: true })
})

test.describe('M5 — Publication-Grade Maritime Forensic Dossier', () => {
  test('01. Screen Viewport QA across resolutions (1920, 1440, 1280, 768)', async ({ browser }) => {
    const viewports = [
      { label: '1920x1080', width: 1920, height: 1080 },
      { label: '1440x900', width: 1440, height: 900 },
      { label: '1280x800', width: 1280, height: 800 },
      { label: '768x1024', width: 768, height: 1024 },
    ]

    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
      const page = await context.newPage()

      const consoleErrors: string[] = []
      page.on('pageerror', (err) => consoleErrors.push(err.message))
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const t = msg.text()
          if (!t.includes('Failed to load resource') && !t.includes('chrome-extension')) {
            consoleErrors.push(t)
          }
        }
      })

      await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(600)

      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth + 2)
      expect(overflow, `[${vp.label}] Horizontal overflow detected on /report`).toBe(false)
      expect(consoleErrors, `[${vp.label}] Console errors on /report`).toHaveLength(0)

      // Capture screenshot
      const shotPath = path.join(M5_SHOT_DIR, 'report', `report_${vp.label}.png`)
      await page.screenshot({ path: shotPath, fullPage: false })

      // At desktop widths (>= 1024), verify SectionNav is visible; at <= 768 verify it is hidden
      const navVisible = await page.locator('.report-nav').isVisible()
      if (vp.width >= 1024) {
        expect(navVisible, `[${vp.label}] SectionNav should be visible on desktop`).toBe(true)
      } else {
        expect(navVisible, `[${vp.label}] SectionNav should be hidden on narrow viewport`).toBe(false)
      }

      await context.close()
    }
  })

  test('02. Verify All 13 Report Sections & Analytical Figures', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(600)

    // Check every section exists
    for (const s of REPORT_SECTIONS) {
      const sectionEl = page.locator(`#${s.id}`)
      await expect(sectionEl, `Section #${s.id} (${s.number} ${s.title}) should exist`).toBeAttached()
    }

    // Capture specific figure & section closeups
    const heroShot = path.join(M5_SHOT_DIR, 'report', '01_dossier_hero.png')
    await page.locator('#dossier-hero').screenshot({ path: heroShot })

    const findingShot = path.join(M5_SHOT_DIR, 'report', '02_executive_finding.png')
    await page.locator('#executive-finding').screenshot({ path: findingShot })

    const detectionShot = path.join(M5_SHOT_DIR, 'report', '03_detection.png')
    await page.locator('#detection').screenshot({ path: detectionShot })

    const driftShot = path.join(M5_SHOT_DIR, 'report', '06_forward_drift.png')
    await page.locator('#forward-drift').screenshot({ path: driftShot })

    const backtrackingShot = path.join(M5_SHOT_DIR, 'report', '07_backtracking.png')
    await page.locator('#backtracking').screenshot({ path: backtrackingShot })

    const aisShot = path.join(M5_SHOT_DIR, 'report', '08_ais_traffic.png')
    await page.locator('#ais-traffic').screenshot({ path: aisShot })

    const attrShot = path.join(M5_SHOT_DIR, 'report', '09_attribution.png')
    await page.locator('#attribution').screenshot({ path: attrShot })

    const conclusionShot = path.join(M5_SHOT_DIR, 'report', '10_conclusion.png')
    await page.locator('#conclusion').screenshot({ path: conclusionShot })

    const appendixShot = path.join(M5_SHOT_DIR, 'report', '13_technical_appendix.png')
    await page.locator('#technical-appendix').screenshot({ path: appendixShot })
  })

  test('03. Section Navigation Interactive Jump Test', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(600)

    // Click Attribution nav link
    const attrLink = page.locator('.report-nav a[href="#attribution"]')
    await expect(attrLink).toBeVisible()
    await attrLink.click()
    await page.waitForTimeout(500)

    // Verify attribution section is scrolled near viewport top
    const attrY = await page.locator('#attribution').evaluate((el) => el.getBoundingClientRect().top)
    expect(Math.abs(attrY), 'Attribution section should be near top after nav click').toBeLessThan(250)

    // Click Appendix nav link
    const appendixLink = page.locator('.report-nav a[href="#technical-appendix"]')
    await appendixLink.click()
    await page.waitForTimeout(500)

    const appendixY = await page.locator('#technical-appendix').evaluate((el) => el.getBoundingClientRect().top)
    expect(Math.abs(appendixY), 'Appendix section should be near top after nav click').toBeLessThan(350)
  })

  test('04. Genuine Print Media Simulation & Document Composition QA', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 1600 })
    await page.addInitScript(() => {
      sessionStorage.setItem('sih-oilspill.active-simulation', '6ab1af2cce377a4d97c36ee9')
    })
    await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(1000)

    // Emulate print media
    await page.emulateMedia({ media: 'print' })
    await page.waitForTimeout(500)

    // 1. Verify app chrome is completely hidden
    const navVisible = await page.locator('.report-nav').isVisible()
    expect(navVisible, 'SectionNav must be hidden in print').toBe(false)

    const spineVisible = await page.locator('aside[aria-label="Operational Spine"]').isVisible()
    expect(spineVisible, 'Operational spine must be hidden in print').toBe(false)

    const screenOnlyVisible = await page.locator('.screen-only').isVisible().catch(() => false)
    expect(screenOnlyVisible, 'Interactive map / screen-only elements must be hidden in print').toBe(false)

    // 2. Verify print paper styles
    const bodyBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
    expect(bodyBg, 'Body background in print should be white / paper').toMatch(/rgb\(255,\s*255,\s*255\)/)

    const docTextColor = await page.evaluate(() => {
      const title = document.querySelector('.report-hero__title')
      return title ? window.getComputedStyle(title).color : ''
    })
    expect(docTextColor, 'Text color in print should be dark').toMatch(/rgb\(17,\s*17,\s*17\)/)

    // 3. Verify static analytical figures remain visible in print
    const massBalanceVisible = await page.locator('.mass-balance-figure').first().isVisible().catch(() => false)
    const analyticalPlateVisible = await page.locator('.analytical-plate').first().isVisible().catch(() => false)
    expect(massBalanceVisible || analyticalPlateVisible, 'Static analytical plates must remain visible in print').toBe(true)

    // 4. Capture print preview screenshots
    await page.screenshot({
      path: path.join(M5_SHOT_DIR, 'print', 'print_page_1.png'),
      fullPage: false,
    })

    await page.screenshot({
      path: path.join(M5_SHOT_DIR, 'print', 'print_full_document.png'),
      fullPage: true,
    })

    // 5. Test PDF export capability
    const pdfPath = path.join(M5_SHOT_DIR, 'export', 'oilguard_forensic_dossier.pdf')
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      printBackground: true,
    })
    expect(fs.existsSync(pdfPath), 'PDF export file should be created').toBe(true)
    const stats = fs.statSync(pdfPath)
    expect(stats.size, 'Exported PDF should have positive file size').toBeGreaterThan(1000)
  })

  test('05. Empty State & Truthful Fallback QA', async ({ page }) => {
    // Navigate with a clean session to verify empty / no-case state
    await page.addInitScript(() => {
      sessionStorage.clear()
    })
    await page.goto(`${BASE_URL}/report`, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(600)

    // Verify truthful empty state displays
    const emptyIndicators = await page.locator('.report-empty, .report-hero__lead--pending, .report-finding__badge--pending').count()
    expect(emptyIndicators, 'Empty / pending states must be truthfully indicated').toBeGreaterThan(0)

    // Capture empty report screenshot
    await page.screenshot({
      path: path.join(M5_SHOT_DIR, 'report', 'report_empty_state.png'),
      fullPage: false,
    })
  })
})
