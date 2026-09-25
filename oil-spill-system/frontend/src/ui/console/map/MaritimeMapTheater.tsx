import { useMemo } from 'react'
import MapView, { MapFurniture } from '@/components/map/MapView'
import { AutoEnableLayers } from '@/components/investigation/Stepper'
import { useMapStore, type MapLayerId } from '@/store/mapStore'
import { useUiStore } from '@/store/uiStore'
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
import {
  useEnvironmentFieldLayers,
  useSatellitePassLayers,
  useShippingLaneLayers,
} from '@/components/map/OperationalLayers'
import { MapLayerToolbar } from '@/components/map/maritime/MapLayerToolbar'
import { MapSelectionPopup } from '@/components/map/maritime/MapSelectionPopup'
import { NorthArrow } from '@/components/map/maritime/NorthArrow'
import { RegionSelector } from '@/components/map/maritime/RegionSelector'
import { HistoricalReferenceGallery } from '@/components/intel/HistoricalReferenceGallery'
import { useWeatherStore } from '@/store/weatherStore'
import { useIncidentFeedStore } from '@/store/incidentFeedStore'
import { useEezStore } from '@/store/eezStore'
import { isDemoMode } from '@/lib/demo/mode'
import '@/styles/maritime-overlays.css'

export function MaritimeMapTheater({ showToolbar = true }: { showToolbar?: boolean } = {}) {
  const simLayers = useSimulationLayers()
  const sarLayers = useSarLayers()
  const invLayers = useInvestigationMapLayers()
  const btLayers = useBacktrackingLayers()
  const attLayers = useAttributionLayers()
  const ringLayers = useSelectionRingLayers()
  const eezLayers = useEezLayers()
  const weatherLayers = useWeatherLayers()
  const incidentLayers = useIncidentFeedLayers()
  const laneLayers = useShippingLaneLayers()
  const passLayers = useSatellitePassLayers()
  const fieldLayers = useEnvironmentFieldLayers()

  const eezStatus = useEezStore((s) => s.status)
  const weatherStatus = useWeatherStore((s) => s.status)
  const incidentStatus = useIncidentFeedStore((s) => s.status)

  // The drawer is driven by the shared uiStore so the compact map toolbar in
  // the command-center shell can open it without duplicating state.
  const layersOpen = useUiStore((s) => s.layersOpen)
  const toggleLayers = useUiStore((s) => s.toggleLayers)
  const setLayersOpen = useUiStore((s) => s.setLayersOpen)

  const layers = useMemo(
    () => [
      ...simLayers,
      ...sarLayers,
      ...invLayers,
      ...btLayers,
      ...attLayers,
      ...ringLayers,
      ...fieldLayers,
      ...laneLayers,
      ...passLayers,
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
      fieldLayers,
      laneLayers,
      passLayers,
      eezLayers,
      weatherLayers,
      incidentLayers,
    ]
  )

  // Catalogue rows light up only for layers where real data exists. The
  // observation/simulation layers always render (app-owned stores); the
  // environment layers are gated on the live feed status so they stay honest.
  // The lane, pass and vector-field layers are synthetic demo context, so they
  // are offered only while the controlled demo is active.
  const available = useMemo<Set<MapLayerId>>(() => {
    const s = new Set<MapLayerId>(['sarSlicks', 'vessels'])
    if (eezStatus === 'available') s.add('eez')
    if (weatherStatus === 'available') s.add('weather')
    if (incidentStatus === 'available') s.add('incidents')
    if (isDemoMode()) {
      s.add('sarFootprint')
      s.add('shippingLanes')
      s.add('currents')
      s.add('wind')
    }
    return s
  }, [eezStatus, weatherStatus, incidentStatus])

  return (
    <div className="relative w-full h-full maritime-map-stage" role="region" aria-label="Geospatial Intelligence Map">
      <GraticuleFrame />
      <LayerDrawer
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        available={available}
        className="cc-layerdrawer"
      />
      <EezLoader />
      {showToolbar ? (
        <MapLayerToolbar
          available={available}
          layersOpen={layersOpen}
          onLayersToggle={toggleLayers}
        />
      ) : null}
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

