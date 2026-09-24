import { describe, it, expect, beforeEach } from 'vitest'
import { useUiStore } from '../store/uiStore'

describe('uiStore — M11 Phase 2 map-pane presentation flag', () => {
  beforeEach(() => {
    useUiStore.setState({ mapPaneOpen: false })
  })

  it('defaults the Command Center map pane to CLOSED so the theater unmounts on first render', () => {
    expect(useUiStore.getState().mapPaneOpen).toBe(false)
  })

  it('setMapPaneOpen assigns an explicit state', () => {
    useUiStore.getState().setMapPaneOpen(true)
    expect(useUiStore.getState().mapPaneOpen).toBe(true)

    useUiStore.getState().setMapPaneOpen(false)
    expect(useUiStore.getState().mapPaneOpen).toBe(false)
  })

  it('toggleMapPane flips the pane on each invocation', () => {
    expect(useUiStore.getState().mapPaneOpen).toBe(false)

    useUiStore.getState().toggleMapPane()
    expect(useUiStore.getState().mapPaneOpen).toBe(true)

    useUiStore.getState().toggleMapPane()
    expect(useUiStore.getState().mapPaneOpen).toBe(false)
  })

  it('does not leak map-pane state into pipeline/domain stores', () => {
    useUiStore.getState().toggleMapPane()
    expect(useUiStore.getState().activeModule).toBe('monitoring')
    expect(useUiStore.getState().analysisStatus).toBe('idle')
    expect(useUiStore.getState().panelCollapsed).toBe(false)
  })
})