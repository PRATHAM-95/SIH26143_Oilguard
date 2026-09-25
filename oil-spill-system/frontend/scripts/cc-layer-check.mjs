import { chromium } from "playwright"
import { createHash } from "node:crypto"

/**
 * Differential render check for the operational map layers.
 *
 * deck.gl draws to a single WebGL canvas, so layer presence cannot be asserted
 * from the DOM. Instead each layer is toggled and the canvas is hashed: if the
 * pixels change, the layer is genuinely reaching the renderer.
 */
const URL = "http://localhost:4173/SIH26143_Oilguard/command-center?demo=1"

const browser = await chromium.launch({ channel: "chrome" })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })
const errs = []
page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)))
page.on("console", (m) => {
  if (m.type() === "error") errs.push(`console: ${m.text().slice(0, 160)}`)
})

await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 })
await page.waitForTimeout(7000)

const canvasHash = async () => {
  const el = await page.$("canvas")
  if (!el) return null
  // A WebGL canvas without preserveDrawingBuffer comes back blank from
  // toDataURL, so screenshot the composited element instead.
  return createHash("sha1").update(await el.screenshot()).digest("hex").slice(0, 12)
}

const pillState = () =>
  page.evaluate(() =>
    [...document.querySelectorAll(".cc-mpill")].map((e) => ({
      t: e.textContent.trim(),
      on: e.getAttribute("aria-pressed") === "true",
      nodata: e.hasAttribute("data-nodata"),
    })),
  )

const toggle = async (label) => {
  await page.evaluate((l) => {
    const b = [...document.querySelectorAll(".cc-mpill")].find((e) => e.textContent.includes(l))
    b?.click()
  }, label)
  await page.waitForTimeout(1200)
}

const before = { pills: await pillState(), hash: await canvasHash() }
const results = []
for (const label of ["Ocean Currents", "Wind Vectors", "Satellite Passes", "EEZ Boundaries"]) {
  const wasOn = before.pills.find((p) => p.t.includes(label))?.on
  await toggle(label)
  const changed = (await canvasHash()) !== before.hash
  results.push({ label, wasOn, changedRender: changed })
  await toggle(label) // restore
}
const after = await pillState()

console.log(JSON.stringify({ before: before.pills, layerDiffs: results, restored: after, errs: errs.slice(0, 6) }, null, 2))
await browser.close()
