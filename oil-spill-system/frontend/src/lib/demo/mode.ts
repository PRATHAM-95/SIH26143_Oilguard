/**
 * Controlled demo mode activation (M11 Phase 6).
 *
 * Activation is resolved once at module (boot) time. A URL query parameter has
 * precedence over the build flag so a hosted build with VITE_DEMO_MODE=1 can
 * always be defeated cleanly:
 *
 *   ?demo=1  -> demo ON
 *   ?demo=0  -> demo OFF
 *   no query -> VITE_DEMO_MODE
 *
 * While demo mode is active every REST request is answered by the deterministic
 * demo adapter and no live WebSocket is opened — the frontend makes zero
 * localhost/API/WebSocket network calls.
 */
import { demoClock } from '@/lib/demo/seed'

export function resolveDemoMode(envFlag: boolean, search: string): boolean {
  const query = new URLSearchParams(search)
  const q = query.get('demo')
  if (q === '1' || q === 'true') return true
  if (q === '0' || q === 'false') return false
  return envFlag
}

function envDemoFlag(): boolean {
  const v = import.meta.env.VITE_DEMO_MODE
  return v === '1' || v === 'true'
}

function bootSearch(): string {
  if (typeof window === 'undefined') return ''
  return window.location.search
}

/** Whether the app is running in controlled demo mode (immutable per boot). */
export const DEMO_ENABLED: boolean = resolveDemoMode(envDemoFlag(), bootSearch())

/** Exact workstation status label shown while demo mode is active. */
export const DEMO_MODE_LABEL = 'CONTROLLED DEMO · SIMULATED DATA'

export function isDemoMode(): boolean {
  return DEMO_ENABLED
}

/**
 * Epoch milliseconds of "now" in the frame the rest of the UI is using.
 *
 * A demo session runs on a fixed synthetic epoch rather than wall-clock time -
 * every timestamp it produces (activity feed, SAR acquisition, AIS last-seen)
 * is expressed in that frame. Anything that computes a *duration* therefore has
 * to measure against the same clock: subtracting a demo timestamp from
 * Date.now() made a vessel whose fix was four minutes old report "seen 117 d
 * ago", which is both absurd and self-contradicting next to an "Underway" AIS
 * status.
 */
export function referenceNowMs(): number {
  if (!DEMO_ENABLED) return Date.now()
  // Read live rather than captured at boot: the session clock advances with the
  // scenario. Guarded because a malformed stored session yields a NaN epoch.
  const t = Date.parse(demoClock())
  return Number.isFinite(t) ? t : Date.now()
}