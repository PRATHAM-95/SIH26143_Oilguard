import type { WsEvent } from './events'

export type WsConnectionStatus = 'connecting' | 'open' | 'closed' | 'error'

export type WsHandlers = {
  onEvent?: (event: WsEvent) => void
  onStatus?: (status: WsConnectionStatus) => void
}

const WS_BASE = (import.meta.env.VITE_WS_URL || 'ws://localhost:8082').replace(/\/$/, '')

/**
 * Lightweight WebSocket client abstraction.
 *
 * Wraps a browser WebSocket, tracks connection status, guards against
 * duplicate connects, and exposes subscribe/disconnect. Designed to be
 * pointed at Spring Boot's STOMP/SockJS broker later; for now it speaks
 * plain JSON frames so the frontend foundation is independent of the
 * transport until the backend WebSocket endpoints are implemented.
 */
export class SocketClient {
  readonly url: string
  private ws: WebSocket | null = null
  private handlers: WsHandlers = {}
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private manualClose = false

  constructor(topic: string) {
    this.url = `${WS_BASE}${topic}`
  }

  connect(handlers: WsHandlers): void {
    this.handlers = handlers
    this.manualClose = false
    this.open()
  }

  disconnect(): void {
    this.manualClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.notifyStatus('closed')
  }

  send(payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload))
    }
  }

  private open(): void {
    let socket: WebSocket
    try {
      socket = new WebSocket(this.url)
    } catch {
      this.notifyStatus('error')
      return
    }
    this.ws = socket
    this.notifyStatus('connecting')

    socket.onopen = () => {
      this.notifyStatus('open')
    }

    socket.onmessage = (msg: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(msg.data) as unknown
        this.handlers.onEvent?.(parsed as WsEvent)
      } catch {
        // non-JSON frame ignored
      }
    }

    socket.onclose = () => {
      this.notifyStatus('closed')
      if (!this.manualClose && this.reconnectTimer === null) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null
          this.open()
        }, 3000)
      }
    }

    socket.onerror = () => {
      this.notifyStatus('error')
    }
  }

  private notifyStatus(status: WsConnectionStatus): void {
    try {
      this.handlers.onStatus?.(status)
    } catch {
      // listener errors must not break the socket loop
    }
  }
}

export function wsUrl(topic: string): string {
  return `${WS_BASE}${topic}`
}