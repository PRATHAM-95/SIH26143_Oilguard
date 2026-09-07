const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8082').replace(/\/$/, '')

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

export async function request<T>(
  path: string,
  init: { method: string; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method,
    headers: {
      Accept: 'application/json',
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
  })

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