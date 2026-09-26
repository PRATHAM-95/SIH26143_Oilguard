import { useMemo } from 'react'
import { LineLayer, PolygonLayer, ScatterplotLayer, IconLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useSimulationStore } from '@/store/simulationStore'
import { useAttributionStore } from '@/store/featureStores'
import { useMapStore } from '@/store/mapStore'
import { VSCO } from '@/styles/vsco'
import { labelLayer, trailSegments } from '@/components/map/overlays'
import { SHIP_ICON_URL, getVesselRoleColor, computeHeadingVector } from '@/components/map/vesselSilhouette'

/**
 * Zoom at which the scored candidates are far enough apart to read as separate
 * ships.
 *
 * The candidates sit within the 60 km attribution radius of the slick. At the
 * default regional camera (zoom 3.6) that whole radius spans about 11 px, so
 * three hulls render as one mark and the most important objects on the map are
 * indistinguishable from each other. Roughly zoom 5.5 opens the radius past
 * 40 px, which clears a 22 px silhouette plus its candidate ring.
 *
 * Below that threshold the candidates collapse into a single counted badge (see
 * useCandidateClusterLayers) - the standard AIS declutter behaviour, and the only
 * way to honour both the mandated traffic density and the requirement that
 * candidates be identifiable at a glance.
 */
const CANDIDATE_CLUSTER_ZOOM = 5.5

/**
 * Geometry of the collapsed candidate group, or null when the candidates are
 * either close enough to read individually or not present.
 *
 * Shared by the vessel stack (which drops the individual candidate hulls while
 * they are collapsed) and the cluster badge itself, so the two can never
 * disagree about whether the group is collapsed.
 */
function useCandidateCluster() {
  const vessels = useSimulationStore((s) => s.vessels)
  const attributionVessels = useAttributionStore((s) => s.vessels)
  const zoom = useMapStore((s) => s.view.zoom)
  const showVessels = useMapStore((s) => s.visibility.vessels)

  return useMemo(() => {
    if (!showVessels || zoom >= CANDIDATE_CLUSTER_ZOOM) return null
    const mmsis = new Set(
      attributionVessels.map((c) => c.mmsi).filter(Boolean) as string[],
    )
    const group = vessels.filter((v) => mmsis.has(v.mmsi))
    if (group.length < 2) return null
    const lead = group.find((v) => v.mmsi === attributionVessels[0]?.mmsi) ?? group[0]
    return {
      group,
      lead,
      centre: [
        group.reduce((s, v) => s + v.position.lon, 0) / group.length,
        group.reduce((s, v) => s + v.position.lat, 0) / group.length,
      ] as [number, number],
    }
  }, [vessels, attributionVessels, zoom, showVessels])
}

/**
 * Counted badge that stands in for the candidate group at regional zoom.
 *
 * This is deliberately a separate hook rather than part of useSimulationLayers:
 * the theatre composes the vessel stack first, which puts the pickable slick
 * origin and attribution candidate markers on top of anything the vessel stack
 * draws. The badge occupies the same few pixels as those markers, so it has to
 * be appended last in the overall stack to be hoverable at all.
 */
export function useCandidateClusterLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const cluster = useCandidateCluster()

  return useMemo(() => {
    if (!cluster) return []
    const { group, lead, centre } = cluster
    const pickLead = { kind: 'vessel', id: lead.id, mmsi: lead.mmsi, name: lead.name }

    return [
      new ScatterplotLayer({
        id: 'simulation-candidate-cluster-halo',
        data: [{ coordinates: centre }],
        getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
        stroked: true,
        filled: true,
        getLineColor: [255, 176, 32, 220] as [number, number, number, number],
        getFillColor: [255, 138, 74, 46] as [number, number, number, number],
        getLineWidth: 1600,
        lineWidthMinPixels: 1.4,
        lineWidthMaxPixels: 2.6,
        getRadius: 11000,
        radiusMinPixels: 17,
        radiusMaxPixels: 24,
        pickable: false,
      }),
      new ScatterplotLayer({
        id: 'simulation-candidate-cluster-core',
        data: [{ coordinates: centre, pick: pickLead }],
        getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
        stroked: true,
        filled: true,
        getLineColor: [255, 206, 138, 235] as [number, number, number, number],
        getFillColor: [255, 122, 80, 225] as [number, number, number, number],
        getLineWidth: 1200,
        lineWidthMinPixels: 1.2,
        lineWidthMaxPixels: 2,
        getRadius: 5000,
        // Comfortably wider than the slick marker's 8 px floor, so where the two
        // overlap the badge is the one the operator is aiming at.
        radiusMinPixels: 10,
        radiusMaxPixels: 13,
        pickable: true,
      }),
      labelLayer(
        'simulation-candidate-cluster-label',
        [
          {
            // On the centroid exactly; labelLayer's own 6 px pixel offset lifts
            // the text clear of the badge. A geographic offset would shrink to
            // nothing as the camera zooms out.
            coordinates: centre,
            text: `${group.length} CANDIDATES`,
            color: [255, 190, 120] as [number, number, number],
          },
        ],
        { size: 10, baseline: 'bottom' },
      ),
    ]
  }, [cluster])
}

/**
 * Captain-mode simulation layers: live vessels, recorded vessel tracks,
 * the released-spill marker and (when available) the forward-drift output.
 * Every pickable object carries a `pick` payload so the workspace map can
 * drive the contextual rail.
 *
 * Visibility is gated by the map-store catalogue (vessels / vesselTrails /
 * slick / drift).
 */
export function useSimulationLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const vessels = useSimulationStore((s) => s.vessels)
  const trails = useSimulationStore((s) => s.trails)
  const spill = useSimulationStore((s) => s.spill)
  const drift = useSimulationStore((s) => s.drift)
  const selectedVesselId = useSimulationStore((s) => s.selectedVesselId)
  const attributionVessels = useAttributionStore((s) => s.vessels)
  const mapSelection = useMapStore((s) => s.selection)
  const hover = useMapStore((s) => s.hover)
  const showVessels = useMapStore((s) => s.visibility.vessels)
  const showTrails = useMapStore((s) => s.visibility.vesselTrails)
  const showSlick = useMapStore((s) => s.visibility.slick)
  const showDrift = useMapStore((s) => s.visibility.drift)
  const cluster = useCandidateCluster()

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []

    if (showTrails) {
      const normalSegments: { path: [number, number][] }[] = []
      const selectedSegments: { path: [number, number][] }[] = []
      for (const v of vessels) {
        const pts = trails[v.id]
        if (!pts || pts.length < 2) continue
        const isSel =
          (mapSelection?.kind === 'vessel' &&
            (mapSelection.id === v.id || mapSelection.mmsi === v.mmsi)) ||
          selectedVesselId === v.id
        if (isSel) {
          selectedSegments.push(...trailSegments(pts))
        } else {
          normalSegments.push(...trailSegments(pts))
        }
      }
      if (normalSegments.length > 0) {
        layers.push(
          new LineLayer({
            id: 'simulation-vessel-trails',
            data: normalSegments,
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: VSCO.evidence.trail as [number, number, number],
            getWidth: 1.4,
            widthMinPixels: 2.5,
            widthMaxPixels: 6,
            pickable: false,
          }),
        )
      }
      if (selectedSegments.length > 0) {
        layers.push(
          new LineLayer({
            id: 'simulation-vessel-trails-selected',
            data: selectedSegments,
            getPath: (d: { path: [number, number][] }) => d.path,
            getColor: [0, 87, 255, 230],
            getWidth: 2.4,
            widthMinPixels: 4,
            widthMaxPixels: 9,
            pickable: false,
          }),
        )
      }
    }

    if (showVessels) {
      // Attribution candidates come from the completed run, keyed by MMSI. The
      // run is the authority on who is suspect; deriving it here from distance
      // would duplicate the model and could disagree with the panel.
      const candidateMmsi = new Set(attributionVessels.map((c) => c.mmsi).filter(Boolean) as string[])
      // True while the group is collapsed behind the counted badge, in which case
      // the individual candidate hulls, headings and names stand down.
      const clusterCandidates = cluster !== null
      const topCandidateMmsi = attributionVessels[0]?.mmsi ?? null
      const hoveredVesselId =
        hover?.pick?.kind === 'vessel' ? hover.pick.id ?? null : null

      // Regional zoom: the candidates are inside one another on screen, so they
      // are represented by a single counted badge that stands in for the group
      // and selects its rank-1 member. Zooming past the threshold hands the
      // detail back to the individual hulls.
      const roleOf = (v: (typeof vessels)[number]) => {
        const isSel =
          (mapSelection?.kind === 'vessel' &&
            (mapSelection.id === v.id || mapSelection.mmsi === v.mmsi)) ||
          selectedVesselId === v.id
        if (isSel) return 'selected' as const
        if (candidateMmsi.has(v.mmsi)) return 'candidate' as const
        if (spill?.vesselId === v.id) return 'shipOfInterest' as const
        return 'normal' as const
      }

      const vesselIconData = vessels
        .map((v) => {
          const role = roleOf(v)
          // A clustered candidate is drawn by the badge, not as a hull.
          if (clusterCandidates && role === 'candidate') return null
          const isHov = hoveredVesselId === v.id
          return {
            coordinates: [v.position.lon, v.position.lat] as [number, number],
            heading: v.heading,
            color: getVesselRoleColor(role, isHov),
            pick: { kind: 'vessel', id: v.id, mmsi: v.mmsi, name: v.name },
            size: role === 'selected' ? 32 : isHov || role === 'candidate' ? 27 : 22,
          }
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)

      // Selection halo: porcelain ship inside a signal-blue ring, the one
      // combination that cannot be confused with a candidate.
      const selectedVessels = vessels.filter((v) => roleOf(v) === 'selected')
      if (selectedVessels.length > 0) {
        layers.push(
          new ScatterplotLayer({
            id: 'simulation-vessel-selected-halo',
            data: selectedVessels.map((v) => ({
              coordinates: [v.position.lon, v.position.lat] as [number, number],
            })),
            getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
            stroked: true,
            filled: false,
            getLineColor: VSCO.evidence.selectionRing as [number, number, number],
            getLineWidth: 2200,
            lineWidthMinPixels: 1.6,
            lineWidthMaxPixels: 3,
            radiusMinPixels: 20,
            radiusMaxPixels: 34,
            getRadius: 1900,
            pickable: false,
          }),
        )
      }

      // Candidate emphasis: an amber ring on every scored vessel, and a second
      // brighter pulse on the top candidate so rank 1 is identifiable without
      // opening a popup. Split into two layers because radiusMinPixels and
      // radiusMaxPixels are static layer props, not per-object accessors.
      const candidateVessels = vessels.filter(
        (v) => roleOf(v) === 'candidate' && !clusterCandidates,
      )
      const ringFor = (top: boolean) => ({
        id: top ? 'simulation-vessel-top-candidate-ring' : 'simulation-vessel-candidate-ring',
        data: candidateVessels
          .filter((v) => (v.mmsi === topCandidateMmsi) === top)
          .map((v) => ({ coordinates: [v.position.lon, v.position.lat] as [number, number] })),
        getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
        stroked: true,
        filled: false,
        getLineColor: (top ? [255, 176, 32, 235] : [255, 122, 80, 175]) as [
          number,
          number,
          number,
          number,
        ],
        getLineWidth: top ? 1900 : 1500,
        lineWidthMinPixels: top ? 1.6 : 1.2,
        lineWidthMaxPixels: top ? 3 : 2.4,
        getRadius: top ? 3400 : 2500,
        radiusMinPixels: top ? 26 : 20,
        radiusMaxPixels: top ? 44 : 32,
        pickable: false,
      })
      if (candidateVessels.length > 0) {
        layers.push(
          new ScatterplotLayer(ringFor(true)),
          new ScatterplotLayer(ringFor(false)),
        )
      }

      const headingVectorData = vessels
        .map((v) => {
          const role = roleOf(v)
          // Clustered candidates have no hull to point a heading from.
          if (clusterCandidates && role === 'candidate') return null
          const sog =
            typeof v.speed === 'number' && Number.isFinite(v.speed) ? v.speed : null
          const end = computeHeadingVector(v.position.lon, v.position.lat, v.heading, sog)
          const color = getVesselRoleColor(role, hoveredVesselId === v.id)
          return {
            path: [[v.position.lon, v.position.lat], end] as [
              [number, number],
              [number, number],
            ],
            color: [color[0], color[1], color[2], role === 'normal' ? 120 : 220] as [
              number,
              number,
              number,
              number,
            ],
          }
        })
        .filter((d): d is NonNullable<typeof d> => d !== null)

      layers.push(
        new LineLayer({
          id: 'simulation-vessel-headings',
          data: headingVectorData,
          getPath: (d: { path: [[number, number], [number, number]] }) => d.path,
          getColor: (d: { color: [number, number, number, number] }) => d.color,
          getWidth: 2,
          widthMinPixels: 1.5,
          widthMaxPixels: 3.5,
          pickable: false,
        }),
        new IconLayer({
          id: 'simulation-vessels',
          data: vesselIconData,
          getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
          getIcon: () => ({
            url: SHIP_ICON_URL,
            width: 32,
            height: 64,
            mask: true,
          }),
          getSize: (d: { size: number }) => d.size,
          sizeUnits: 'pixels',
          sizeMinPixels: 18,
          sizeMaxPixels: 42,
          getAngle: (d: { heading: number }) => (360 - d.heading) % 360,
          getColor: (d: { color: [number, number, number, number] }) => d.color,
          pickable: true,
        }),
        // Name only the ships that carry meaning: the candidates, the selection
        // and whatever the pointer is over. Labelling all ~20 hulls at regional
        // zoom produced an unreadable wall of text and made every name equally
        // loud, which is the opposite of the requested hierarchy.
        labelLayer(
          'simulation-vessel-labels',
          vessels
            .filter((v) => {
              const role = roleOf(v)
              if (role === 'candidate') return !clusterCandidates
              return role !== 'normal' || hoveredVesselId === v.id
            })
            .map((v) => ({
              coordinates: [v.position.lon, v.position.lat] as [number, number],
              text: v.name.length > 18 ? `${v.name.slice(0, 17)}â€¦` : v.name,
              color: (roleOf(v) === 'candidate'
                ? [255, 186, 128]
                : [154, 216, 247]) as [number, number, number],
            })),
          { size: 10.5 },
        ),
      )
    }

    if (showSlick && spill?.location) {
      layers.push(
        new ScatterplotLayer({
          id: 'simulation-spill',
          data: [
            {
              coordinates: [spill.location.lon, spill.location.lat] as [number, number],
              pick: { kind: 'spill', id: spill.spillEventId ?? null },
            },
          ],
          getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
          getRadius: 1400,
          radiusMinPixels: 8,
          radiusMaxPixels: 14,
          getFillColor: VSCO.evidence.slick as [number, number, number],
          pickable: true,
        }),
        labelLayer(
          'simulation-spill-label',
          [
            {
              coordinates: [spill.location.lon, spill.location.lat] as [number, number],
              text: 'OBSERVED SPILL',
              color: [225, 168, 118],
            },
          ],
          { size: 10 },
        ),
      )
    }

    if (showDrift) {
      if (drift.particles.length > 0) {
        layers.push(
          new ScatterplotLayer({
            id: 'drift-particles',
            data: drift.particles,
            getPosition: (d: { lon: number; lat: number }) => [d.lon, d.lat],
            getRadius: 1600,
            radiusMinPixels: 2,
            radiusMaxPixels: 8,
            getFillColor: VSCO.drift.particle as [number, number, number],
            pickable: false,
          }),
        )
      }
      if (drift.extent && drift.extent.length > 0) {
        layers.push(
          new PolygonLayer({
            id: 'drift-extent',
            data: [{ polygon: drift.extent }],
            getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
            getLineColor: VSCO.drift.extent as [number, number, number],
            getLineWidth: 2000,
            lineWidthMinPixels: 1.5,
            lineWidthMaxPixels: 4,
            stroked: true,
            filled: true,
            getFillColor: [...VSCO.drift.extentFill, 28] as [number, number, number, number],
            pickable: false,
          }),
          labelLayer(
            'drift-extent-label',
            [{ coordinates: drift.extent[Math.floor(drift.extent.length / 2)], text: 'FORWARD DRIFT' }],
            { size: 9 },
          ),
        )
      }
    }

    return layers
  }, [vessels, trails, spill, drift, showVessels, showTrails, showSlick, showDrift, selectedVesselId, mapSelection, attributionVessels, hover, cluster])
}
