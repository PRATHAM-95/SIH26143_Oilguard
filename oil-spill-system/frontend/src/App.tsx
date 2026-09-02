import { Routes, Route } from 'react-router-dom'
import CommandCenter from './pages/CommandCenter'
import Simulation from './pages/Simulation'
import Investigation from './pages/Investigation'
import Backtracking from './pages/Backtracking'
import Attribution from './pages/Attribution'
import Report from './pages/Report'
import Layout from './components/Layout'

function App() {
  return (
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
  )
}

export default App
