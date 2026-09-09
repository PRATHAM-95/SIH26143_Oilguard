import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

const CommandCenter = lazy(() => import('./pages/CommandCenter'))
const Simulation = lazy(() => import('./pages/Simulation'))
const Investigation = lazy(() => import('./pages/Investigation'))
const Backtracking = lazy(() => import('./pages/Backtracking'))
const Attribution = lazy(() => import('./pages/Attribution'))
const Report = lazy(() => import('./pages/Report'))

function App() {
  return (
    <Suspense fallback={<div className="app-loading" style={{ padding: '3rem', textAlign: 'center' }}>Loading…</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/investigation" element={<Investigation />} />
          <Route path="/backtracking" element={<Backtracking />} />
          <Route path="/attribution" element={<Attribution />} />
          <Route path="/report" element={<Report />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
