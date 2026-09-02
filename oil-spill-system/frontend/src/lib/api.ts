const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8082'

export async function getHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/api/health`)
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`)
  }
  return res.json()
}

export async function getPythonPing(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/api/environment/ping-python`)
  if (!res.ok) {
    throw new Error(`Python ping failed: ${res.status}`)
  }
  return res.json()
}