import { useEffect, useState } from 'react'

/**
 * Single shared UTC wall-clock hook.
 * Returns the current UTC time as an ISO-8601 string, updated every second.
 * Based strictly on new Date() – independent of any simulation event clock.
 *
 * Usage:
 *   const iso = useUtcClock()        // "2026-09-21T10:42:07.000Z"
 *   const hhmm = iso.slice(11, 16)   // "10:42"
 *   const hhmmss = iso.slice(11, 19) // "10:42:07"
 */
export function useUtcClock(): string {
  const [iso, setIso] = useState(() => new Date().toISOString())

  useEffect(() => {
    const tick = () => setIso(new Date().toISOString())
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  return iso
}
