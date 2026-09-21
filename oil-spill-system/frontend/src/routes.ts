/**
 * Protected Route Paths contract (M0-M9).
 * Master route paths source used by App.tsx router builder and contract tests.
 */
export const APP_ROUTE_PATHS = [
  '/',
  '/simulation',
  '/investigation',
  '/backtracking',
  '/attribution',
  '/report',
] as const

export type AppRoutePath = (typeof APP_ROUTE_PATHS)[number]
