import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        height: 48,
        backgroundColor: '#0D1B2A',
        borderBottom: '1px solid #1C6999',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
      }}>
        <strong style={{ color: '#1C6999' }}>SIH26143</strong>
        <span style={{ color: '#666' }}>|</span>
        <span style={{ fontSize: 14 }}>Oil Spill Detection System</span>
      </header>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </main>
    </div>
  )
}
