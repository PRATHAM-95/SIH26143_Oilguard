/**
 * Screen-space legibility of the demo fleet at the default camera.
 *
 * The three attribution candidates are placed 34/47/55 km from the slick. At the
 * mandated default camera (72E, 7N, zoom 3.6) that entire radius is only a few
 * pixels across, so the ships that matter most may well be drawn on top of each
 * other. This projects the real seed geometry through Web Mercator and reports
 * the pixel separations, because "the candidates are near the slick" and "the
 * candidates are visible" are very different claims.
 *
 *   node scripts/cc-fleet-layout.mjs
 */
import * as esbuild from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { projector } from './lib/projection.mjs'

const OUT = mkdtempSync(join(tmpdir(), 'fleet-'))
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

const VIEW = { longitude: 72, latitude: 7, zoom: 3.6 }
// Matches the command-centre map pane at the validated desktop viewport.
const PANE = { width: 1250, height: 659 }

const project = projector(VIEW, PANE)

const fleet = seed.demoFleet()
const candidates = seed.demoCandidateVessels()
const origin = seed.DEMO_SPILL_LOCATION

const placed = fleet.map((v) => {
  // demoFleet() returns VesselDto, whose position is {longitude, latitude};
  // the store's IntegratedVessel uses {lon, lat}. Map the DTO field names.
  const p = project(v.position.longitude, v.position.latitude)
  return {
    name: v.name,
    x: +p.x.toFixed(1),
    y: +p.y.toFixed(1),
    inPane: p.x >= 0 && p.x <= PANE.width && p.y >= 0 && p.y <= PANE.height,
    candidate: candidates.some((c) => c.mmsi === v.mmsi),
  }
})

// Minimum pairwise distance between the scored candidates, in screen pixels.
const candPts = placed.filter((p) => p.candidate)
let minCandSep = Infinity
let closestPair = null
for (let i = 0; i < candPts.length; i++) {
  for (let j = i + 1; j < candPts.length; j++) {
    const d = Math.hypot(candPts[i].x - candPts[j].x, candPts[i].y - candPts[j].y)
    if (d < minCandSep) {
      minCandSep = d
      closestPair = [candPts[i].name, candPts[j].name]
    }
  }
}

const slickPt = project(origin.lon, origin.lat)
// Any pair of vessels closer than this will read as one blob.
const ICON_PX = 22
const CLUTTER_PX = ICON_PX * 2

let overlappingPairs = 0
for (let i = 0; i < placed.length; i++) {
  for (let j = i + 1; j < placed.length; j++) {
    if (Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y) < CLUTTER_PX) {
      overlappingPairs++
    }
  }
}

const findings = []
if (candPts.length > 0 && minCandSep < ICON_PX) {
  findings.push({
    issue: `candidates ${closestPair?.join(' / ')} are only ${minCandSep.toFixed(1)}px apart at the default camera - closer than a single ${ICON_PX}px hull, so they render as one mark`,
    mitigatedBy:
      'SimulationLayers collapses the candidate group into a counted "N CANDIDATES" badge below zoom 5.5 (CANDIDATE_CLUSTER_ZOOM) and restores individual hulls above it',
  })
}
if (overlappingPairs > 0) {
  findings.push({
    issue: `${overlappingPairs} vessel pair(s) fall within ${CLUTTER_PX}px of each other at the default camera`,
    mitigatedBy:
      'expected - ~20 ships over 9 real corridors is inherently dense; lane offsets and heading vectors keep overlapping hulls distinguishable, and hover resolves the exact vessel',
  })
}
const offscreen = placed.filter((p) => !p.inPane).map((p) => p.name)
if (offscreen.length) {
  findings.push({
    issue: `${offscreen.length} vessel(s) fall outside the default pane: ${offscreen.join(', ')}`,
    mitigatedBy:
      'accepted - the default camera is a regional view of the incident area; panning reveals the remaining traffic',
  })
}

console.log(
  JSON.stringify(
    {
      ok: findings.length === 0,
      findings,
      metrics: {
        iconPx: ICON_PX,
        candidateCount: candPts.length,
        minCandidateSeparationPx: +minCandSep.toFixed(1),
        closestPair,
        overlappingPairs,
        fleetInPane: placed.filter((p) => p.inPane).length,
        fleetTotal: placed.length,
        slickAtPx: { x: +slickPt.x.toFixed(1), y: +slickPt.y.toFixed(1) },
      },
      candidatePositions: candPts,
    },
    null,
    2,
  ),
)
