import { useMemo } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { AutoEnableLayers } from '@/components/investigation/Stepper'
import { useMapStore } from '@/store/mapStore'
import { GraticuleFrame } from './GraticuleFrame'
import { LayerDrawer } from '../LayerDrawer'

// Deck.gl layer hooks
import { useSimulationLayers } from '@/components/map/SimulationLayers'
import { useSarLayers } from '@/components/investigation/SarObservation'
import { useInvestigationMapLayers } from '@/components/map/InvestigationMap'
import { useSelectionRingLayers } from '@/components/workspace/selection'

export function MaritimeMapTheater() {
  const simLayers = useSimulationLayers()
  const sarLayers = useSarLayers()
  const invLayers = useInvestigationMapLayers()
  const ringLayers = useSelectionRingLayers()

  const layers = useMemo(
    () => [...simLayers, ...sarLayers, ...invLayers, ...ringLayers],
    [simLayers, sarLayers, invLayers, ringLayers]
  )

  return (
    <div className="relative w-full h-full maritime-map-stage" role="region" aria-label="Geospatial Intelligence Map">
      <GraticuleFrame />
      <LayerDrawer />
      
      <MapView
        layers={layers}
        onSelect={(selection) => useMapStore.getState().select(selection)}
      >
        <MapFurniture />
        <AutoEnableLayers />
      </MapView>
    </div>
  )
}
