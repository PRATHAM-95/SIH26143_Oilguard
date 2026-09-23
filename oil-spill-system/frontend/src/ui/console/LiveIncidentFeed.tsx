import { useIncidentFeedStore } from '@/store/incidentFeedStore'

/**
 * Live incident feed — real NASA EONET marine incidents in the area of
 * interest. Always honest: an empty real feed reads "no marine incidents
 * currently reported", and an unreachable feed shows an offline chip instead
 * of fabricating events.
 */
export function LiveIncidentFeed() {
  const status = useIncidentFeedStore((s) => s.status)
  const feed = useIncidentFeedStore((s) => s.feed)
  const fetchedAt = useIncidentFeedStore((s) => s.fetchedAt)
  const error = useIncidentFeedStore((s) => s.error)

  if (status === 'idle' || status === 'fetching') return null

  if (status === 'unavailable') {
    return (
      <div className="live-feed live-feed--offline cc-glass" role="status">
        <span className="live-feed-dot" aria-hidden="true" />
        <span>Live marine feed offline</span>
        {error ? <span className="live-feed-src">{error}</span> : null}
      </div>
    )
  }

  const events = feed?.events ?? []
  const stamp = fetchedAt
    ? new Date(fetchedAt).toUTCString().slice(17, 22) + 'Z'
    : null

  return (
    <div className="live-feed cc-glass" role="status">
      <div className="live-feed-head">
        <span className="live-feed-dot" aria-hidden="true" />
        <span className="live-feed-title">Live incident feed</span>
        <span className="live-feed-src">{feed?.source}</span>
      </div>
      {events.length === 0 ? (
        <div className="live-feed-empty">
          No marine incidents currently reported in the IO area of interest.
        </div>
      ) : (
        <ul className="live-feed-list">
          {events.slice(0, 3).map((ev) => {
            const url = ev.sources?.[0]?.url
            const title = ev.title
            return (
              <li key={ev.id ?? title}>
                <span className="live-feed-cat">{ev.categories?.[0] ?? 'event'}</span>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="live-feed-link">
                    {title}
                  </a>
                ) : (
                  <span className="live-feed-link">{title}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="live-feed-foot">
        {events.length} matching event{events.length === 1 ? '' : 's'}
        {stamp ? ` · ${stamp}` : ''} · NASA EONET
      </div>
    </div>
  )
}