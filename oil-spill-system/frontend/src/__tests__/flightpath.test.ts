import { describe, it, expect } from 'vitest'
import { STAGE_SUBTITLES } from '../ui/console/FlightpathRail'
import { STAGE_ORDER } from '../store/investigationStore'
import type { InvestigationStageId } from '../types/domain'

describe('FlightpathRail', () => {
  it('should only use canonical STAGE_ORDER stage IDs as subtitle keys', () => {
    const canonicalKeys = new Set(STAGE_ORDER)
    const subtitleKeys = Object.keys(STAGE_SUBTITLES)
    
    for (const key of subtitleKeys) {
      expect(canonicalKeys.has(key as InvestigationStageId)).toBe(true)
    }
  })
})
