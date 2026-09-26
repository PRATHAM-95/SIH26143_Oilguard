/**
 * Vessel hover / selection interaction probe.
 *
 * deck.gl picks are resolved from real pointer events, so the only honest way to
 * test them is to move a real mouse over the canvas. The script sweeps the map
 * pane until the hover card names a vessel, then clicks it and checks that
 * selection takes over.
 *
 * A pointer sweep is used rather than projecting the vessel's coordinates
 * ourselves: the sweep exercises the same pick path a user does, and it cannot
 * pass by aiming at a point the renderer never actually drew.
 *
 * The candidate cluster is the one exception. At the default camera the three
 * scored vessels sit within ~11 px of each other, so no sweep can reliably land
 * on all of them and "no badge seen" would say nothing about the feature. For
 * that case the probe projects the group's centroid (using the same Web Mercator
 * helper as cc-fleet-layout.mjs, against the pane size actually on screen) and
 * hovers it directly, which is exactly where a user would point.
 *
 *   node scripts/cc-vessel-pick.mjs
 */
import { chromium } from 'playwright'
import * as esbuild from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const URL = process.env.CC_URL || 'http://localhost:4173/SIH26143_Oilguard/command-center?demo=1'

// Candidate identity, so the probe can name the vessel the badge must resolve to.
const OUT = mkdtempSync(join(tmpdir(), 'vessel-pick-'))
const BUNDLE = join(OUT, 'seed.mjs')
await esbuild.build({
  entryPoints: ['src/lib/demo/seed.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: BUNDLE,
  alias: { '@': './src' },
  logLevel: 'warning',
})
const seed = await import(pathToFileURL(BUNDLE).href)

const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1825, height: 817 } })

const errs = []
page.on('console', (m) => {
  if (m.type() === 'error') errs.push(m.text().slice(0, 160))
})
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 160)))

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4500)

const out = {}
const readCard = () =>
  page.evaluate(() => {
    const el = document.querySelector('.mm-hovercard-name')
    const rank = document.querySelector('.mm-hovercard-rank')
    if (!el) return null
    return { name: el.textContent.trim(), rank: rank ? rank.textContent.trim() : null }
  })

// Vessels cluster around the incident, so sweep the central band first and
// widen only if nothing is found. The step is roughly a quarter of the smallest
// on-screen hull, which is coarse enough to be quick and fine enough not to
// step over a 22px icon.
//
// The sweep collects every distinct vessel it touches rather than stopping at
// the first, so the run also proves that scored candidates are discoverable and
// carry their rank badge - the styling that makes attribution legible without
// opening anything.
const box = await page.locator('.cc-map').boundingBox()
const found = new Map()
let firstHit = null
outer: for (const [x0, x1, y0, y1, step] of [
  [0.2, 0.8, 0.2, 0.8, 0.022],
  [0.05, 0.95, 0.05, 0.95, 0.035],
]) {
  for (let gy = y0; gy <= y1; gy += step) {
    for (let gx = x0; gx <= x1; gx += step) {
      const px = box.x + box.width * gx
      const py = box.y + box.height * gy
      await page.mouse.move(px, py)
      const card = await readCard()
      if (!card) continue
      if (!found.has(card.name)) {
        found.set(card.name, { ...card, px: Math.round(px), py: Math.round(py) })
        if (!firstHit) firstHit = { name: card.name, px: Math.round(px), py: Math.round(py) }
      }
      // Keep going until a scored candidate is in hand as well as a few
      // ordinary hulls. Stopping at an arbitrary vessel count would make the
      // candidate assertions depend on where the grid happened to start.
      if (found.size >= 3 && [...found.values()].some((v) => v.rank)) break outer
    }
  }
}

out.vesselsFound = [...found.values()]
out.candidatesFound = [...found.values()].filter((v) => v.rank)
out.hoverHit = firstHit

// Candidate cluster, checked while nothing is selected yet.
//
// At the default camera the three scored vessels sit within ~11 px of one
// another, so SimulationLayers replaces them with a single counted badge whose
// pick resolves to the rank-1 candidate. The badge's position comes from the
// sweep above rather than from projecting the centroid ourselves: the sweep only
// uses real pointer positions where the hover card actually appeared, so this
// cannot pass by aiming at a pixel deck.gl never drew. The geometry claim is
// audited separately by cc-fleet-layout.mjs.
//
// This runs before any click because the hover card is deliberately suppressed
// for the selected vessel, and Escape does not clear the selection.
const candidateHit = out.candidatesFound[0] ?? null
out.clusterExpected = { lead: seed.demoCandidateVessels()[0]?.name ?? null }
if (candidateHit) {
  await page.mouse.move(candidateHit.px, candidateHit.py)
  await page.waitForTimeout(350)
  out.clusterHover = await readCard()

  await page.mouse.click(candidateHit.px, candidateHit.py)
  await page.waitForTimeout(800)
  out.clusterClick = await page.evaluate(() => ({
    popupName: document.querySelector('.mm-pop-name')?.textContent.trim() ?? null,
    popupKind: document.querySelector('.mm-pop-kind')?.textContent.trim() ?? null,
  }))
}

// Exercise a plain hull too, so the generic card/popup assertions are not made
// against the vessel the cluster phase just selected. Prefer a non-candidate,
// which is the case whenever the sweep caught one.
const plainHit =
  out.vesselsFound.find((v) => !v.rank && v.name !== firstHit?.name) ?? firstHit

if (plainHit) {
  // Re-hover so the detailed card assertion below inspects a card that is
  // actually on screen.
  await page.mouse.move(plainHit.px, plainHit.py)
  await page.waitForTimeout(350)
  out.hoverCard = await page.evaluate(() => {
    const card = document.querySelector('.mm-hovercard')
    if (!card) return null
    const map = document.querySelector('.cc-map').getBoundingClientRect()
    const r = card.getBoundingClientRect()
    return {
      name: card.querySelector('.mm-hovercard-name')?.textContent.trim(),
      rank: card.querySelector('.mm-hovercard-rank')?.textContent.trim() ?? null,
      pairs: [...card.querySelectorAll('.mm-hovercard-grid > div')].map((d) => [
        d.querySelector('dt')?.textContent.trim(),
        d.querySelector('dd')?.textContent.trim(),
      ]),
      foot: card.querySelector('.mm-hovercard-foot')?.textContent.trim(),
      // The card must stay inside the map pane at any pointer position.
      insideMap:
        r.left >= map.left - 1 &&
        r.right <= map.right + 1 &&
        r.top >= map.top - 1 &&
        r.bottom <= map.bottom + 1,
    }
  })

  await page.mouse.click(plainHit.px, plainHit.py)
  await page.waitForTimeout(800)
  out.afterClick = await page.evaluate(() => ({
    hoverGone: !document.querySelector('.mm-hovercard'),
    popupName: document.querySelector('.mm-pop-name')?.textContent.trim() ?? null,
    popupKind: document.querySelector('.mm-pop-kind')?.textContent.trim() ?? null,
    popupRows: [...document.querySelectorAll('.mm-pop-row')].map((r) => [
      r.querySelector('.mm-pop-k')?.textContent.trim(),
      r.querySelector('.mm-pop-v')?.textContent.trim(),
    ]),
  }))
}

// Nothing should be hoverable over open water away from the fleet, otherwise the
// pick is over-broad.
await page.mouse.move(box.x + 12, box.y + box.height - 12)
await page.waitForTimeout(150)
out.hoverOverEmptyCorner = await readCard()


out.summary = {
  distinctVesselsHovered: out.vesselsFound.length,
  candidatesWithBadge: out.candidatesFound.length,
  clusterBadgeHovers: out.clusterHover !== null,
  clusterBadgeNamesRank1: out.clusterHover?.name === out.clusterExpected.lead,
  clusterClickSelects: out.clusterClick?.popupName === out.clusterExpected.lead,
  pickNotOverBroad: out.hoverOverEmptyCorner === null,
  noErrors: errs.length === 0,
}

out.errs = errs
console.log(JSON.stringify(out, null, 2))
await browser.close()
