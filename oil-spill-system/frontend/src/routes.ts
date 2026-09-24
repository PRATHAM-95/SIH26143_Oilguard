/**
 * Route Paths contract (M0-M11).
 * Master route paths source used by App.tsx router builder and contract tests.
 * M11 approved change: the root '/' now hosts the cinematic Welcome; the
 * existing Command Center moved to '/command-center'. '/welcome' remains a
 * direct-access alias. All specialist routes are preserved.
 */
export const APP_ROUTE_PATHS = [
  '/command-center',
  '/simulation',
  '/investigation',
  '/backtracking',
  '/attribution',
  '/report',
] as const

export type AppRoutePath = (typeof APP_ROUTE_PATHS)[number]
