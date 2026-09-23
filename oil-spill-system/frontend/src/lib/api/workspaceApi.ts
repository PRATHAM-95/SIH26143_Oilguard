import { del, ApiError } from '@/lib/http'

export type ResetWorkspaceResult = {
  status: 'RESET' | 'PARTIAL' | 'ERROR'
  dropped: string[]
  skipped: string[]
  at: string
}

/**
 * DELETE /api/workspace — drop every persisted case collection so the command
 * centre returns to a genuinely clean slate. This is the honest
 * "start fresh, no previous incident" moment: all demo history, ground truth
 * reveals, SAR candidates and persistence keys are removed. If the backend is
 * unreachable the reset reports PARTIAL with an honest error — data is never
 * soft-erased or faked.
 */
export async function resetWorkspace(signal?: AbortSignal): Promise<ResetWorkspaceResult> {
  return del<ResetWorkspaceResult>('/api/workspace', signal)
}

export function isResetError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
