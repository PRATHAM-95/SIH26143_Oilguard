import { get } from '@/lib/http'
import type { ApiError } from '@/lib/http'

export type HealthInfo = {
  service: string
  version: string
  mongodb: 'UP' | 'DOWN' | string
  status: 'UP' | 'DOWN' | string
}

export type PythonPing = {
  ok: boolean
  pythonStatus: string
  pythonUrl: string
}

/**
 * Live backend endpoints (verified in Step 02):
 * - GET /api/health
 * - GET /api/environment/ping-python
 */
export const healthApi = {
  getHealth: async (signal?: AbortSignal): Promise<HealthInfo> =>
    get<HealthInfo>('/api/health', signal),

  getPythonPing: async (signal?: AbortSignal): Promise<PythonPing> =>
    get<PythonPing>('/api/environment/ping-python', signal),
}

export { ApiError }