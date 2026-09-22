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
  '/': CommandCenter,
  '/simulation': Simulation,
  '/investigation': Investigation,
  '/backtracking': Backtracking,
  '/attribution': Attribution,
  '/report': Report,
}

function App() {
  return (
    <Routes>
      {/* M6: Standalone cinematic 3D welcome route outside operational shell */}
      <Route
        path="/welcome"
        element={
          <Suspense fallback={<WelcomeLoadingShell />}>
            <WelcomePage />
          </Suspense>
        }
      />

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