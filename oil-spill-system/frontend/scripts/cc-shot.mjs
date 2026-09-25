import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = 'C:/Users/yoges/AppData/Local/Temp/opencode/cc'
fs.mkdirSync(OUT, { recursive: true })

const URL = process.env.CC_URL || 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'
const W = Number(process.env.CC_W || 1825)
const H = Number(process.env.CC_H || 817)
const TAG = process.env.CC_TAG || 'current'

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-gl=egl', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: W, height: H } })

const errors = []
const failed = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200))
})
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 200)))
page.on('response', (r) => {
  if (r.status() >= 400 && new URL(r.url()).origin === new URL(URL).origin) {
    failed.push(`${r.status()} ${r.url().slice(-70)}`)
  }
})

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4500)

const metrics = await page.evaluate(() => {
  const box = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  const texts = (sel) => [...document.querySelectorAll(sel)].map((t) => t.textContent.trim())
  const vis = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const s = getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden'
  }
  return {
    header: box('.cc-header'),
    brand: box('.cc-brand'),
    capsulesBox: box('.cc-header-capsules'),
    user: box('.cc-user'),
    rail: box('.cc-rail'),
    nav: box('.cc-nav'),
    navContext: box('.cc-nav-context'),
    alert: box('.cc-alert'),
    cta: box('.cc-cta'),
    map: box('.cc-map'),
    analysis: box('.cc-analysis'),
    footer: box('.cc-footer'),
    aoi: box('.cc-aoi'),
    mtoolbar: box('.cc-mtoolbar'),
    pillsBox: box('.cc-mtoolbar-pills'),
    layersBtn: box('.cc-layersbtn'),
    legend: box('.cc-legend'),
    controls: box('.cc-mapctl'),
    compass: box('.north-arrow'),
    maplibreCanvas: !!document.querySelector('.maplibregl-canvas'),
    coordReadoutVisible: vis('.coord-readout'),
    railCount: document.querySelectorAll('.cc-rail').length,
    spineCount: document.querySelectorAll('[aria-label="Operational Navigation Spine"]').length,
    pillCount: document.querySelectorAll('.cc-mpill').length,
    pills: texts('.cc-mpill'),
    pillStates: [...document.querySelectorAll('.cc-mpill')].map((p) => p.getAttribute('aria-pressed')),
    noDataPills: document.querySelectorAll('.cc-mpill[data-nodata]').length,
    tabs: texts('.analysis-tab'),
    capsules: texts('.cc-capsule'),
    demoChip: texts('.cc-demochip'),
    railItems: texts('.cc-rail-label'),
    analysisCards: texts('.analysis-card-title'),
    activeAnalysisCard: texts('.analysis-card--active .analysis-card-title'),
    activityRows: document.querySelectorAll('.activity-item').length,
    seedNote: vis('.activity-seednote'),
    footerLinks: texts('.cc-footer-link'),
    footerText: document.querySelector('.cc-footer')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 160),
    startBtn: box('.cc-analysis .btn--primary.btn--lg.btn--block'),
    docScrollW: document.documentElement.scrollWidth,
    docScrollH: document.documentElement.scrollHeight,
    innerW: window.innerWidth,
    innerH: window.innerHeight,
  }
})

await page.screenshot({ path: `${OUT}/${TAG}.png` })

console.log(JSON.stringify({ metrics, errors: errors.slice(0, 12), failed: failed.slice(0, 12) }, null, 2))
await browser.close()
