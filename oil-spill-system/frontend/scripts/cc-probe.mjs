import { chromium } from "playwright"
const b = await chromium.launch({ channel: "chrome" })
const p = await b.newPage({ viewport: { width: 1825, height: 817 } })
const errs = []
p.on("pageerror", e => errs.push(e.message.slice(0,140)))
await p.goto("http://localhost:4173/SIH26143_Oilguard/command-center?demo=1", { waitUntil: "networkidle", timeout: 60000 })
await p.waitForTimeout(6000)
const s = await p.evaluate(() => ({
  aoiFoot: document.querySelector(".cc-aoi-foot-item")?.textContent.trim(),
  popup: !!document.querySelector(".map-selection-popup"),
  popupHead: document.querySelector(".map-selection-popup")?.textContent.replace(/\s+/g," ").trim().slice(0,170),
  popupImg: !!document.querySelector(".map-selection-popup img"),
  legend: [...document.querySelectorAll(".cc-legend-row")].map(e => ({ t: e.textContent.trim(), on: e.hasAttribute("data-on") })),
  pills: [...document.querySelectorAll(".cc-mpill")].map(e => ({ t: e.textContent.trim(), p: e.getAttribute("aria-pressed") })),
  activity: [...document.querySelectorAll(".activity-item")].map(e => e.textContent.replace(/\s+/g," ").trim().slice(0,60)),
  analysisActive: document.querySelector(".analysis-card--active .analysis-card-title")?.textContent,
  drawerRows: null,
}))
s.drawerRows = await p.evaluate(() => {
  document.querySelector(".cc-layersbtn")?.click()
  return null
})
await p.waitForTimeout(600)
s.drawerRows = await p.evaluate(() => {
  const d = document.querySelector("#cc-layers-panel")
  return d ? { total: d.querySelectorAll("button[aria-pressed], button:disabled").length } : null
})
console.log(JSON.stringify({ ...s, errs }, null, 2))
await b.close()
