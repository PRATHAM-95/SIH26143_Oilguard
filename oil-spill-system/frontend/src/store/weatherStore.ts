import { create } from 'zustand'
import { environmentApi, type LiveWeatherSnapshot } from '@/lib/api/environmentApi'

type LiveWeatherStatus = 'idle' | 'fetching' | 'available' | 'unavailable'

/**
 * Live weather state — real Open-Meteo wind/wave snapshot for the area of
 * interest. Fetched against `/api/environment/live-weather` on a slow poll;
 * only an `available:true` payload ever drives the map layer, so the
 * "Live Weather" chip lights up exclusively on real data.
 */
type LiveWeatherState = {
  status: LiveWeatherStatus
  snapshot: LiveWeatherSnapshot | null
  /** Epoch ms of the last successful fetch. */
  fetchedAt: number | null
  error: string | null
  lat: number | null
  lon: number | null
  refresh: (lat: number, lon: number) => Promise<LiveWeatherSnapshot | null>
}

export const useWeatherStore = create<LiveWeatherState>((set) => ({
  status: 'idle',
  snapshot: null,
  fetchedAt: null,
  error: null,
  lat: null,
  lon: null,
  refresh: async (lat, lon) => {
    set({ status: 'fetching' })
    try {
      const snapshot = await environmentApi.liveWeather(lat, lon)
      set({
        status: snapshot.available ? 'available' : 'unavailable',
        snapshot,
        fetchedAt: Date.now(),
        lat,
        lon,
        error: snapshot.available ? null : snapshot.reason ?? 'Live weather feed unavailable.',
      })
      return snapshot
    } catch (err) {
      set({
        status: 'unavailable',
        snapshot: null,
        fetchedAt: Date.now(),
        lat,
        lon,
        error: err instanceof Error ? err.message : 'Live weather feed unreachable.',
      })
      return null
    }
  },
}))