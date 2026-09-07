import { useEffect } from 'react'
import { healthApi } from '@/lib/api'
import { useConnectionStore } from '@/store/connectionStore'

/**
 * Polls the live backend health endpoint and propagates status into the
 * connection store. Runs once per mount of the app shell.
 */
export function useHealthProbe(): void {
  const setConnection = useConnectionStore((s) => s.setConnection)
  const markApiChecked = useConnectionStore((s) => s.markApiChecked)

  useEffect(() => {
    const check = async () => {
      try {
        const info = await healthApi.getHealth()
        setConnection('api', 'online')
        setConnection('mongo', info.mongodb === 'UP' ? 'online' : 'offline')
        const py = await healthApi.getPythonPing()
        setConnection('python', py.ok ? 'online' : 'offline')
      } catch {
        setConnection('api', 'offline')
        setConnection('mongo', 'unknown')
        setConnection('python', 'unknown')
      } finally {
        markApiChecked()
      }
    }

    void check()
    const id = setInterval(() => void check(), 15000)
    return () => clearInterval(id)
  }, [setConnection, markApiChecked])
}