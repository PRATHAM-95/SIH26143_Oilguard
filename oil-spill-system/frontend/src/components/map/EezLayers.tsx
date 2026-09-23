import { useMemo } from 'react'
import { LineLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useEezStore } from '@/store/eezStore'
import { useMapStore } from '@/store/mapStore'

const EEZ_COLOR: [number, number, number] = [92, 178, 214]

/** Deck layer for the live Marine Regions EEZ boundaries. */
export function useEezLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const lines = useEezStore((s) => s.lines)
  const show = useMapStore((s) => s.visibility.eez)

  return useMemo(() => {
    if (!show || lines.length === 0) return []
    return [
      new LineLayer({
        id: 'eez-boundaries',
        data: lines.map((path) => ({ path })),
        getPath: (d: { path: [number, number][] }) => d.path,
        getColor: EEZ_COLOR,
        getWidth: 1.1,
        widthMinPixels: 1,
        widthMaxPixels: 2.4,
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