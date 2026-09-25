/**
 * Geometry invariants for the controlled demo dataset.
 *
 * Runs against src/lib/demo/seed.ts directly (bundled with esbuild) instead of
 * scraping the browser, because the failure this guards against is invisible in
 * the UI: when DEMO_SPILL_LOCATION moves, absolutely positioned vessels do not
 * move with it, the map still shows 21 ships, and the only symptom is an
 * attribution run that scores nothing.
 *
 *   node scripts/demo-data-check.mjs
 */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const OUT = mkdtempSync(join(tmpdir(), 'demo-data-'))
const BUNDLE = join(OUT, 'seed.mjs')

// esbuild's JS API rather than a child process: spawning npx.cmd from Node on
// Windows fails with EINVAL, and esbuild ships with Vite so it is already here.
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

const failures = []
const check = (name, ok, detail) => {
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`)
  return ok
}

const toRad = (d) => (d * Math.PI) / 180
const distanceKm = (a, b) => {
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}

const origin = seed.DEMO_SPILL_LOCATION
const fleet = seed.demoFleet()

// 1. Fleet size stays derived, not hand-maintained.
check('fleet size matches DEMO_FLEET_SIZE', fleet.length === seed.DEMO_FLEET_SIZE)

// 2. The scenario origin is actually offshore: the narrative says a release
//    happened in open water, and a slick on a coastline reads as a bug.
const nearestCoastLandfall = distanceKm(origin, { lon: 72.62, lat: 15.0 })
check(
  'origin is offshore of the Konkan coast',
  distanceKm(origin, { lon: origin.lon, lat: 15.0 }) > 100,
  `origin sits ${Math.round(distanceKm(origin, { lon: origin.lon, lat: 15.0 }))} km south of 15N`,
)

// 3. Exactly DEMO_CANDIDATE_COUNT vessels are scorable, and every one of them
//    is genuinely inside the attribution radius.
const candidates = seed.demoCandidateVessels()
const candidateDistances = candidates.map((v) =>
  distanceKm({ lon: v.position.longitude, lat: v.position.latitude }, origin),
)
check(
  'scored candidate count',
  candidates.length === seed.DEMO_CANDIDATE_COUNT,
  `expected ${seed.DEMO_CANDIDATE_COUNT}, got ${candidates.length}`,
)
check(
  'every candidate is inside the attribution radius',
  candidateDistances.every((km) => km <= seed.DEMO_ATTRIBUTION_RADIUS_KM),
  candidateDistances.map((km) => `${km.toFixed(1)}km`).join(', '),
)

// 4. No candidate sits on top of the slick: a zero-distance "candidate" makes
//    the attribution run circular.
check(
  'no candidate is inside the slick itself',
  candidateDistances.every((km) => km > 12),
  candidateDistances.map((km) => `${km.toFixed(1)}km`).join(', '),
)

// 5. The radius is discriminating, not a blanket that sweeps in the whole
//    regional fleet. The next-nearest vessel must fall outside it.
const allDistances = fleet
  .map((v) => distanceKm({ lon: v.position.longitude, lat: v.position.latitude }, origin))
  .sort((a, b) => a - b)
check(
  'the 4th-nearest vessel is outside the attribution radius',
  allDistances[seed.DEMO_CANDIDATE_COUNT] > seed.DEMO_ATTRIBUTION_RADIUS_KM,
  `4th nearest is ${allDistances[seed.DEMO_CANDIDATE_COUNT]?.toFixed(1)}km`,
)

// 6. Candidates are ranked nearest-first, matching the scoring narrative.
const sorted = [...candidateDistances].sort((a, b) => a - b)
check(
  'candidates are ordered nearest-first',
  candidateDistances.every((km, i) => Math.abs(km - sorted[i]) < 1e-6),
)

// 7. The detected slick is centred on the scenario origin, so the SAR evidence
//    and the modelled drift cannot point at different incidents. The featured
//    detection is the highest-confidence OIL_CANDIDATE, matching the map.
const sar = seed.sarObservation()
const oil = (sar.candidates ?? []).filter((c) => c.classification === 'OIL_CANDIDATE')
const primary = oil.sort((a, b) => b.confidence - a.confidence)[0] ?? sar.candidates?.[0]
if (check('SAR observation has candidates', !!primary)) {
  // The wire DTO carries centroid as a [lon, lat] tuple; the sar store is what
  // lifts it into { lon, lat } for the layers.
  const [cLon, cLat] = primary.centroid
  const off = distanceKm({ lon: cLon, lat: cLat }, origin)
  check(
    'primary SAR detection is centred on the scenario origin',
    off < 12,
    `centroid is ${off.toFixed(1)}km from the origin`,
  )
}

// 8. Attribution reports the same candidate set the geometry implies.
const attribution = seed.attributionDto()
const ranked = attribution.rankedVessels ?? []
check(
  'attribution DTO ranks the derived candidate count',
  ranked.length === seed.DEMO_CANDIDATE_COUNT,
  `expected ${seed.DEMO_CANDIDATE_COUNT}, got ${ranked.length}`,
)
check(
  'attribution uses the shared radius',
  attribution.radiusKm === seed.DEMO_ATTRIBUTION_RADIUS_KM,
  `radiusKm=${attribution.radiusKm}`,
)

// 9. Synthetic provenance must survive any origin change. `source` is a human
//    label ("SYNTHETIC SENTINEL-1 (controlled demo)"); `sourceState` is the enum.
check('SAR source state is synthetic', sar.sourceState === 'SYNTHETIC', String(sar.sourceState))
check(
  'attribution source state is synthetic',
  attribution.sourceState === 'SYNTHETIC',
  String(attribution.sourceState),
)
check(
  'attribution AIS source is controlled',
  attribution.aisSource === 'CONTROLLED' || attribution.aisSource === 'SYNTHETIC',
  String(attribution.aisSource),
)

const report = {
  origin,
  fleetSize: fleet.length,
  attributionRadiusKm: seed.DEMO_ATTRIBUTION_RADIUS_KM,
  candidates: candidates.map((v, i) => ({
    name: v.name,
    km: +candidateDistances[i].toFixed(1),
    status: v.status,
    destination: v.destination,
  })),
  nextNearestKm: +(allDistances[seed.DEMO_CANDIDATE_COUNT] ?? 0).toFixed(1),
  sarCandidateCount: sar.candidates?.length ?? 0,
  sarPrimaryAreaKm2: primary?.area_km2 ?? null,
  attributionRanked: ranked.length,
  attributionConclusion: attribution.conclusion,
  offshoreKm: +nearestCoastLandfall.toFixed(1),
}

console.log(JSON.stringify({ ok: failures.length === 0, failures, report }, null, 2))
process.exit(failures.length === 0 ? 0 : 1)
