/**
 * Pixel-level probe for the command-center map.
 *
 * deck.gl draws into the same WebGL canvas as MapLibre, so nothing about the
 * rendered map can be asserted from the DOM: layers are invisible to queries
 * and `toDataURL` on the canvas comes back blank unless the drawing buffer is
 * preserved. This script therefore screenshots the composited page, hands the
 * PNG back *into* the browser to decode, and measures the result on a 2D
 * canvas. That gives objective colour/contrast numbers to grade the basemap
 * against, instead of eyeballing a screenshot.
 */
import { chromium } from 'playwright'

const URL = process.env.CC_URL || 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'
const W = Number(process.env.CC_W || 1825)
const H = Number(process.env.CC_H || 817)

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-gl=egl', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: W, height: H } })

const errors = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 200))
})
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message.slice(0, 200)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4500)

/** Bounding box of the map workspace, so samples never leave the canvas. */
const mapBox = await page.evaluate(() => {
  const el = document.querySelector('.cc-map')
  const r = el.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
})

const shot = (await page.screenshot({ clip: mapBox })).toString('base64')

const stats = await page.evaluate(async (b64) => {
  const img = new Image()
  img.src = `data:image/png;base64,${b64}`
  await img.decode()

  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)

  const region = (x0, y0, x1, y1) => {
    let n = 0
    let r = 0
    let g = 0
    let b = 0
    let lum = 0
    let sat = 0
    let maxLum = 0
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * width + x) * 4
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        r += R
        g += G
        b += B
        const l = 0.2126 * R + 0.7152 * G + 0.0722 * B
        lum += l
        const mx = Math.max(R, G, B)
        const mn = Math.min(R, G, B)
        sat += mx === 0 ? 0 : (mx - mn) / mx
        if (l > maxLum) maxLum = l
        n++
      }
    }
    return {
      n,
      meanR: +(r / n).toFixed(1),
      meanG: +(g / n).toFixed(1),
      meanB: +(b / n).toFixed(1),
      meanLum: +(lum / n).toFixed(1),
      meanSat: +(sat / n).toFixed(3),
      maxLum: +maxLum.toFixed(1),
    }
  }

  // Whole canvas, plus a grid so regional colour can be compared.
  const cols = 4
  const rows = 3
  const grid = []
  for (let ry = 0; ry < rows; ry++) {
    const row = []
    for (let rx = 0; rx < cols; rx++) {
      row.push(
        region(
          Math.floor((rx * width) / cols),
          Math.floor((ry * height) / rows),
          Math.floor(((rx + 1) * width) / cols),
          Math.floor(((ry + 1) * height) / rows),
        ),
      )
    }
    grid.push(row)
  }

  // Histogram over 16 luminance buckets shows whether highlights are crushed.
  const hist = new Array(16).fill(0)
  let total = 0
  for (let i = 0; i < data.length; i += 16) {
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    hist[Math.min(15, Math.floor(l / 16))]++
    total++
  }

  // deck.gl text lives only in the WebGL canvas, so the only way to prove a
  // label layer rendered is to look for its colour on screen. Counts are coarse
  // on purpose: glyph pixels are antialiased against a dark basemap, so this
  // matches the ink family rather than the exact token value.
  const countNear = (target, tol) => {
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - target[0]) <= tol &&
        Math.abs(data[i + 1] - target[1]) <= tol &&
        Math.abs(data[i + 2] - target[2]) <= tol
      ) {
        n++
      }
    }
    return n
  }

  return {
    size: { width, height },
    all: region(0, 0, width, height),
    grid,
    lumHistogram: hist.map((v) => +(v / total).toFixed(4)),
    // [124,176,212] water names, [206,214,222] land names.
    waterLabelPx: countNear([124, 176, 212], 46),
    landLabelPx: countNear([206, 214, 222], 40),
  }
}, shot)

console.log(JSON.stringify({ mapBox, stats, errors: errors.slice(0, 10) }, null, 2))
await browser.close()
