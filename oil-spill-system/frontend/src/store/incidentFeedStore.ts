import { create } from 'zustand'
import { environmentApi, type Bbox, type IncidentFeed } from '@/lib/api/environmentApi'

type IncidentFeedStatus = 'idle' | 'fetching' | 'available' | 'unavailable'

/**
 * Live marine incident feed — real NASA EONET events matched to oil-pollution
 * vocabulary across the area of interest. The chip/marker layer only activates
 * when the feed reports an actual matching event; an empty real feed shows
 * "no live marine incidents" rather than fabrication.
 */
type IncidentFeedState = {
  status: IncidentFeedStatus
  feed: IncidentFeed | null
  /** Epoch ms of the last successful fetch. */
  fetchedAt: number | null
  error: string | null
  bbox: Bbox | null
  refresh: (bbox: Bbox) => Promise<IncidentFeed | null>
}

export const useIncidentFeedStore = create<IncidentFeedState>((set) => ({
  status: 'idle',
  feed: null,
  fetchedAt: null,
  error: null,
  bbox: null,
  refresh: async (bbox) => {
    set({ status: 'fetching' })
    try {
      const feed = await environmentApi.incidents(bbox)
      set({
        status: feed.available ? 'available' : 'unavailable',
        feed,
        fetchedAt: Date.now(),
        bbox,
        error: feed.available ? null : feed.reason ?? 'Incident feed unavailable.',
      })
      return feed
    } catch (err) {
      set({
        status: 'unavailable',
        feed: null,
        fetchedAt: Date.now(),
        bbox,
        error: err instanceof Error ? err.message : 'Incident feed unreachable.',
      })
      return null
    }
  },
}))