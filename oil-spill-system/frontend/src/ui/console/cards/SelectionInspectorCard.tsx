import { useMapStore } from '@/store/mapStore'
import { ContextualPanel } from '@/components/workspace/ContextualPanel'
import { CloseIcon } from '@/components/ui/Icon'

export function SelectionInspectorCard() {
  const selection = useMapStore((s) => s.selection)
  const clearSelection = useMapStore((s) => s.clearSelection)

  if (!selection) return null

  return (
    <div className="ctx-card ctx-card--selection" role="region" aria-label="Map Feature Inspector">
      <div className="ctx-card-header">
        <div className="ctx-card-title-group">
          <span className="ctx-dot ctx-dot--live" aria-hidden="true" />
          <h3 className="ctx-card-title">GEOSPATIAL FEATURE TELEMETRY</h3>
        </div>
        <button
          type="button"
          className="ctx-close-btn"
          onClick={() => clearSelection()}
          aria-label="Close feature inspector"
          title="Deselect feature"
        >
          <CloseIcon size={12} />
        </button>
      </div>

      <div className="ctx-card-body">
        <ContextualPanel />
      </div>
    </div>
  )
}
