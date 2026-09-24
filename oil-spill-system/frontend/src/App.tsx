import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CommandCenter from './ui/pages/CommandCenterPage'
import Simulation from './ui/pages/SimulationPage'
import Investigation from './ui/pages/InvestigationPage'
import Backtracking from './ui/pages/BacktrackingPage'
import Attribution from './ui/pages/AttributionPage'
import Report from './ui/pages/ReportPage'
import WelcomeLoadingShell from './ui/welcome/WelcomeLoadingShell'
import { APP_ROUTE_PATHS, type AppRoutePath } from './routes'

const WelcomePage = lazy(() => import('./ui/pages/WelcomePage'))

const ROUTE_COMPONENTS: Record<AppRoutePath, React.ComponentType> = {
  '/command-center': CommandCenter,
  '/simulation': Simulation,
  '/investigation': Investigation,
  '/backtracking': Backtracking,
  '/attribution': Attribution,
  '/report': Report,
}

/**
 * M11: the cinematic welcome is the root experience. '/' and '/welcome' both
 * render the same shared WelcomePage module; the operational Command Center
 * lives at '/command-center'. No duplicate scene — one lazy module.
 */
const WelcomeElement = (
  <Suspense fallback={<WelcomeLoadingShell />}>
    <WelcomePage />
  </Suspense>
)

function App() {
  return (
    <Routes>
      {/* M6/M11: Standalone cinematic 3D welcome — root experience + alias */}
      <Route path="/" element={WelcomeElement} />
      <Route path="/welcome" element={WelcomeElement} />

      {/* Operational workstation routes within Layout shell */}
      <Route element={<Layout />}>
        {APP_ROUTE_PATHS.map((path) => {
          const Component = ROUTE_COMPONENTS[path]
          return <Route key={path} path={path} element={<Component />} />
        })}
      </Route>
    </Routes>
  )
}

export default App