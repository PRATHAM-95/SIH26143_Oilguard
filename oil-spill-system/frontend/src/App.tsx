import type React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import CommandCenter from './pages/CommandCenter'
import Simulation from './pages/Simulation'
import Investigation from './pages/Investigation'
import Backtracking from './pages/Backtracking'
import Attribution from './pages/Attribution'
import Report from './pages/Report'
import { APP_ROUTE_PATHS, type AppRoutePath } from './routes'

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