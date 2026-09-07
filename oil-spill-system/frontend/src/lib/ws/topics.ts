/**
 * Topic registry mapping domain events to backend WebSocket topics.
 * Topics follow SYSTEM_SPEC §15.3 paths.
 */
export const WsTopics = {
  simulation: (id: string) => `/ws/simulation/${id}`,
  investigation: (id: string) => `/ws/investigation/${id}`,
} as const