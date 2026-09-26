import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

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
      // The custom property the pill styles itself with. It must be the
      // catalogue colour of the layer the pill toggles, not a colour copied
      // alongside it: that is how the "Oil Spills" pill came to carry
      // sarSlicks' orange while toggling the unrelated `slick` marker, and how
      // it ended up reading as on with nothing drawn on the map.
      color: getComputedStyle(e).getPropertyValue("--pill-color").trim(),
    })),
  )

/**
 * Every pill must be styled with the catalogue colour of a real layer.
 *
 * Read from the seed's own catalogue so a rename or a recolour is caught here
 * rather than showing up as a pill that no longer matches the legend swatch.
 */
const catalogColours = await (async () => {
  const OUT = mkdtempSync(join(tmpdir(), "layer-check-"))
  const BUNDLE = join(OUT, "store.mjs")
  await esbuild.build({
    entryPoints: ["src/store/mapStore.ts"],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: BUNDLE,
    alias: { "@": "./src" },
    logLevel: "warning",
  })
  const mod = await import(pathToFileURL(BUNDLE).href)
  return Object.values(mod.MAP_LAYER_CATALOG)
    .map((e) => (e.color ? e.color.toLowerCase() : null))
    .filter(Boolean)
})()

const pillColours = (await pillState()).map((p) => p.color.toLowerCase())
const unknownPillColours = pillColours.filter((c) => !catalogColours.includes(c))

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

console.log(
  JSON.stringify(
    {
      before: before.pills,
      layerDiffs: results,
      restored: after,
      pillColourDrift: unknownPillColours,
      ok: errs.length === 0 && unknownPillColours.length === 0,
      errs: errs.slice(0, 6),
    },
    null,
    2,
  ),
)
await browser.close()
