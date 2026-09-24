import { useMemo, useState } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { AutoEnableLayers } from '@/components/investigation/Stepper'
import { useMapStore, type MapLayerId } from '@/store/mapStore'
import { GraticuleFrame } from './GraticuleFrame'
import { LayerDrawer } from '../LayerDrawer'

// Deck.gl layer hooks
import { useSimulationLayers } from '@/components/map/SimulationLayers'
import { useSarLayers } from '@/components/investigation/SarObservation'
import { useInvestigationMapLayers } from '@/components/map/InvestigationMap'
import { useBacktrackingLayers } from '@/components/backtracking/BacktrackingMap'
import { useAttributionLayers } from '@/components/attribution/AttributionMap'
import { useSelectionRingLayers } from '@/components/workspace/selection'

// Maritime overlay chrome (integrated contributor layer — M10)
import { useEezLayers, EezLoader } from '@/components/map/EezLayers'
import { useWeatherLayers, useIncidentFeedLayers } from '@/components/map/WeatherLayers'
import { MapLayerToolbar } from '@/components/map/maritime/MapLayerToolbar'
import { MapSelectionPopup } from '@/components/map/maritime/MapSelectionPopup'
import { NorthArrow } from '@/components/map/maritime/NorthArrow'
import { RegionSelector } from '@/components/map/maritime/RegionSelector'
import { HistoricalReferenceGallery } from '@/components/intel/HistoricalReferenceGallery'
import { useWeatherStore } from '@/store/weatherStore'
import { useIncidentFeedStore } from '@/store/incidentFeedStore'
import { useEezStore } from '@/store/eezStore'
import '@/styles/maritime-overlays.css'

export function MaritimeMapTheater() {
  const simLayers = useSimulationLayers()
  const sarLayers = useSarLayers()
  const invLayers = useInvestigationMapLayers()
  const btLayers = useBacktrackingLayers()
  const attLayers = useAttributionLayers()
  const ringLayers = useSelectionRingLayers()
  const eezLayers = useEezLayers()
  const weatherLayers = useWeatherLayers()
  const incidentLayers = useIncidentFeedLayers()

  const eezStatus = useEezStore((s) => s.status)
  const weatherStatus = useWeatherStore((s) => s.status)
  const incidentStatus = useIncidentFeedStore((s) => s.status)

  const [layersOpen, setLayersOpen] = useState(false)
  const toggleLayers = () => setLayersOpen((o) => !o)

  const layers = useMemo(
    () => [
      ...simLayers,
      ...sarLayers,
      ...invLayers,
      ...btLayers,
      ...attLayers,
      ...ringLayers,
      ...eezLayers,
      ...weatherLayers,
      ...incidentLayers,
    ],
    [
      simLayers,
      sarLayers,
      invLayers,
      btLayers,
      attLayers,
      ringLayers,
      eezLayers,
      weatherLayers,
      incidentLayers,
    ]
  )

  // Catalogue rows light up only for layers where real data exists. The
  // observation/simulation layers always render (app-owned stores); the
  // environment layers are gated on the live feed status so they stay honest.
  const available = useMemo<Set<MapLayerId>>(() => {
    const s = new Set<MapLayerId>(['sarSlicks', 'vessels', 'sarFootprint'])
    if (eezStatus === 'available') s.add('eez')
    if (weatherStatus === 'available') s.add('weather')
    if (incidentStatus === 'available') s.add('incidents')
    return s
  }, [eezStatus, weatherStatus, incidentStatus])

  return (
    <div className="relative w-full h-full maritime-map-stage" role="region" aria-label="Geospatial Intelligence Map">
      <GraticuleFrame />
      <LayerDrawer
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        available={available}
      />
      <EezLoader />
      <MapLayerToolbar
        available={available}
        layersOpen={layersOpen}
        onLayersToggle={toggleLayers}
      />
      <NorthArrow />
      <RegionSelector />
      <HistoricalReferenceGallery />

      <MapView
        layers={layers}
        onSelect={(selection) => useMapStore.getState().select(selection)}
      >
        <MapFurniture />
        <AutoEnableLayers />
        <MapSelectionPopup />
      </MapView>
    </div>
  )
}

