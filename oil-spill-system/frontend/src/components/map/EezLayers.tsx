import { useMemo } from 'react'
import { LineLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useEezStore } from '@/store/eezStore'
import { useMapStore } from '@/store/mapStore'
import { dashSegments } from '@/components/map/OperationalLayers'

const EEZ_COLOR: [number, number, number, number] = [104, 196, 226, 150]

/**
 * Deck layer for the live Marine Regions EEZ boundaries.
 *
 * Boundaries are legally delineated lines, so they read as a dashed cyan overlay
 * rather than a solid stroke: visible enough to give the ocean its jurisdiction
 * structure, never bright enough to compete with an incident.
 */
export function useEezLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const lines = useEezStore((s) => s.lines)
  const show = useMapStore((s) => s.visibility.eez)

  return useMemo(() => {
    if (!show || lines.length === 0) return []
    const dashes = lines.flatMap((path) => dashSegments(path, 95, 65))
    if (dashes.length === 0) return []
    return [
      new LineLayer({
        id: 'eez-boundaries',
        data: dashes.map((path) => ({ path })),
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: EEZ_COLOR,
        getWidth: 1.1,
        widthMinPixels: 1,
        widthMaxPixels: 2,
        pickable: false,
      }),
    ]
  }, [lines, show])
}

/** One-shot loader so the command centre always has the context layer. */
export function EezLoader() {
  const status = useEezStore((s) => s.status)
  useMemo(() => {
    if (status === 'idle') void useEezStore.getState().load()
  }, [status])
  return null
}
