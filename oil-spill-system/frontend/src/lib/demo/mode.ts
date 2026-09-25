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