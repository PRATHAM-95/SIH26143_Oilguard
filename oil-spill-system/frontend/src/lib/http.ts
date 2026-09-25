const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8082').replace(/\/$/, '')

import { demoRoute } from '@/lib/demo/adapter'
import { isDemoMode } from '@/lib/demo/mode'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'GET', signal })
}

export async function post<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'POST', body, signal })
}

export async function del<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>(path, { method: 'DELETE', signal })
}

export async function request<T>(
  path: string,
  init: { method: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  // CONTROLLED DEMO mode short-circuits every REST call into the deterministic
  // demo adapter. No fetch() is issued, so no localhost/API/WebSocket traffic
  // ever leaves the browser while the demo is active.
  if (isDemoMode()) {
    return demoRoute(init.method, path, init.body) as T
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw e
    }
    throw new ApiError(0, `Request ${init.method} ${path} failed (network)`)
  }

  if (!res.ok) {
    throw new ApiError(res.status, `Request ${init.method} ${path} failed (${res.status})`)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

export function apiBase(): string {
  return API_URL
}