import type { ReactNode } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { AutoEnableLayers } from '@/components/investigation/Stepper'
import { useMapStore } from '@/store/mapStore'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'

export function MaritimeMap({
  layers,
  children,
}: {
  layers: NonNullable<MapboxOverlayProps['layers']>
  children?: ReactNode
}) {
  return (
    <div className="maritime-map-stage" role="region" aria-label="Geospatial Intelligence Map">
      <MapView
        layers={layers}
        onSelect={(selection) => useMapStore.getState().select(selection)}
      >
        <MapFurniture />
        <AutoEnableLayers />
      </MapView>
      {children}
    </div>
  )
}
