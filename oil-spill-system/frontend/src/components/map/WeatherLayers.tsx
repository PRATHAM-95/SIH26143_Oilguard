import { useMemo } from 'react'
import { LineLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { MapboxOverlayProps } from '@deck.gl/mapbox'
import { useMapStore } from '@/store/mapStore'
import { useWeatherStore } from '@/store/weatherStore'
import { useIncidentFeedStore } from '@/store/incidentFeedStore'
import type { LiveWeatherRow } from '@/lib/api/environmentApi'
import { labelLayer } from '@/components/map/overlays'
import { circleRing } from '@/components/map/maritime/geo'

/**
 * Live environmental overlays (Phase 5 — Live-Network Augmentation).
 *
 * Both layers render exclusively real internet data:
 *   - weather  -> Open-Meteo wind vector + wave height/SST at the AOI centre.
 *   - incidents-> NASA EONET marine incidents currently open in the AOI.
 * No geometry here is invented: when the feed has no data the layer renders
 * nothing and the toolbar chip stays disabled.
 */

/** East/north wind components from a meteorological "from" direction. */
function windToUV(speedMs: number | null | undefined, directionDeg: number | null | undefined): [number, number] {
  if (speedMs == null || directionDeg == null) return [0, 0]
  const blow = ((directionDeg + 180) % 360) * (Math.PI / 180)
  return [speedMs * Math.sin(blow), speedMs * Math.cos(blow)]
}

/** First non-null value for the current hour's live reading (head of series). */
function headRow(row?: LiveWeatherRow): LiveWeatherRow | null {
  return row ?? null
}

function waveColor(height: number | null | undefined): [number, number, number, number] {
  if (height == null) return [122, 212, 255, 200]
  if (height < 1) return [88, 224, 185, 220]
  if (height < 1.75) return [255, 200, 90, 225]
  if (height < 2.5) return [255, 138, 99, 230]
  return [255, 96, 74, 240]
}

export function useWeatherLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const snapshot = useWeatherStore((s) => s.snapshot)
  const showWeather = useMapStore((s) => s.visibility.weather)

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []
    if (!showWeather || !snapshot?.available) return layers
    const { latitude: lat, longitude: lon } = snapshot
    const wind = headRow(snapshot.wind?.hourly?.[0])
    const waves = headRow(snapshot.waves?.hourly?.[0])
    if (!wind && !waves) return layers

    const [u, v] = windToUV(wind?.wind_speed_10m, wind?.wind_direction_10m)
    const speedMs = wind?.wind_speed_10m ?? 0
    const speedKt = speedMs * 1.94384
    const wave = waves?.wave_height ?? null
    const sst = waves?.sea_surface_temperature ?? null

    const center: [number, number] = [lon, lat]

    /* Locator ring + wave-height point — draws the eye to the reading. */
    layers.push(
      new PolygonLayer({
        id: 'weather-locator-ring',
        data: [{ polygon: circleRing(lon, lat, 18, 48) }],
        getPolygon: (d: { polygon: [number, number][] }) => d.polygon,
        stroked: true,
        filled: false,
        getLineColor: [122, 212, 255, 130] as [number, number, number, number],
        getLineWidth: 1.2,
        widthMinPixels: 1,
        widthMaxPixels: 2,
        pickable: false,
      }),
      new ScatterplotLayer({
        id: 'weather-point',
        data: [{ coordinates: center }],
        getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
        getRadius: 900,
        radiusMinPixels: 3,
        radiusMaxPixels: 6,
        getFillColor: waveColor(wave),
        pickable: false,
      }),
    )

    /* Wind vector — a shaft whose length/colour scale with speed, plus a
       small arrowhead fork at the tip. */
    if (speedMs > 0.2) {
      const degToR = Math.PI / 180
      const len = Math.min(1.1, Math.max(0.3, speedMs * 0.055))
      const tip: [number, number] = [lon + u * (len / speedMs), lat + v * (len / speedMs)]
      const ang = Math.atan2(u, v)
      const notch = len * 0.22
      const notches: [number, number][][] = [
        [tip, [tip[0] + notch * Math.sin(ang + 150 * degToR), tip[1] + notch * Math.cos(ang + 150 * degToR)]],
        [tip, [tip[0] + notch * Math.sin(ang - 150 * degToR), tip[1] + notch * Math.cos(ang - 150 * degToR)]],
      ]
      layers.push(
        new LineLayer({
          id: 'weather-wind-shaft',
          data: [{ path: [center, tip] }],
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: () =>
            [94, 226, 255, speedMs > 10 ? 255 : 220] as [number, number, number, number],
          getWidth: 2,
          widthMinPixels: 1.6,
          widthMaxPixels: 3.4,
          pickable: false,
        }),
        new LineLayer({
          id: 'weather-wind-head',
          data: notches.map((path) => ({ path })),
          getPath: (d: { path: [number, number][] }) => d.path,
          getColor: [160, 236, 255, 240] as [number, number, number, number],
          getWidth: 1.6,
          widthMinPixels: 1.4,
          widthMaxPixels: 2.6,
          pickable: false,
        }),
      )
    }

    /* Reading labels stacked east of the point. */
    const rows: { text: string; color?: [number, number, number]; offset: number }[] = []
    if (speedMs != null) {
      rows.push({
        text: `WIND ${speedMs.toFixed(1)} m/s ${speedKt.toFixed(0)} kt`,
        color: [122, 226, 255],
        offset: 0,
      })
    }
    if (wave != null) {
      rows.push({
        text: `WAVE ${wave.toFixed(2)} m${waves?.wave_period != null ? ` · ${waves.wave_period.toFixed(1)} s` : ''}`,
        color: [150, 232, 205],
        offset: 1,
      })
    }
    if (sst != null) {
      rows.push({
        text: `SST ${sst.toFixed(1)} °C`,
        color: [246, 214, 164],
        offset: 2,
      })
    }
    const gap = 0.32
    layers.push(
      labelLayer(
        'weather-readings',
        rows.map((r) => ({
          coordinates: [lon + 0.55, lat + (r.offset - rows.length / 2 + 0.5) * gap] as [number, number],
          text: r.text,
          color: r.color,
        })),
        { size: 10, anchor: 'start' },
      ),
      new TextLayer({
        id: 'weather-provenance',
        data: [{ coordinates: [lon + 0.55, lat + (rows.length / 2) * gap + 0.1] }],
        getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
        getText: () => 'LIVE · Open-Meteo',
        getSize: 9,
        getColor: [138, 163, 181] as [number, number, number],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'top',
        fontFamily: "'Cascadia Mono', Consolas, monospace",
        fontSizeRange: [7, 12],
        outlineWidth: 1.5,
        outlineColor: [4, 7, 11, 190],
        pickable: false,
      }),
    )

    return layers
  }, [snapshot, showWeather])
}

/** Map a real EONET event geometry to a [lon, lat] marker, if possible. */
function incidentPosition(geometry: unknown): [number, number] | null {
  if (!geometry || typeof geometry !== 'object') return null
  const g = geometry as { type?: string; coordinates?: unknown }
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const [lon, lat] = g.coordinates as [number, number]
    if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat]
  }
  return null
}

export function useIncidentFeedLayers(): NonNullable<MapboxOverlayProps['layers']> {
  const feed = useIncidentFeedStore((s) => s.feed)
  const showIncidents = useMapStore((s) => s.visibility.incidents)

  return useMemo(() => {
    const layers: NonNullable<MapboxOverlayProps['layers']> = []
    if (!showIncidents || !feed?.available) return layers

    const events = (feed.events ?? [])
      .map((ev) => ({ ev, pos: incidentPosition(ev.geometry) }))
      .filter((x): x is { ev: (typeof feed.events)[number]; pos: [number, number] } => x.pos != null)
    if (events.length === 0) return layers

    layers.push(
      new ScatterplotLayer({
        id: 'incident-markers',
        data: events.map(({ ev, pos }) => ({ coordinates: pos, title: ev.title })),
        getPosition: (d: { coordinates: [number, number] }) => d.coordinates,
        getRadius: 2600,
        radiusMinPixels: 5,
        radiusMaxPixels: 9,
        getFillColor: [255, 176, 32, 235] as [number, number, number, number],
        stroked: true,
        getLineColor: [255, 224, 150, 220] as [number, number, number, number],
        getLineWidth: 1,
        pickable: false,
      }),
      labelLayer(
        'incident-labels',
        events.map(({ ev, pos }) => ({
          coordinates: [pos[0], pos[1] + 0.18] as [number, number],
          text: ev.title.length > 42 ? `${ev.title.slice(0, 42)}…` : ev.title,
          color: [255, 206, 130],
        })),
        { size: 10 },
      ),
    )

    return layers
  }, [feed, showIncidents])
}