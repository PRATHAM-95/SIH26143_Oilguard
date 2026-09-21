import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  useChallengeStore,
  runLiveChallenge,
  resetCaseState,
  phaseLabel,
} from '@/components/commandcenter/ChallengeRunner'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSarStore } from '@/store/sarStore'
import { useEnvironmentStore } from '@/store/environmentStore'
import { useAttributionStore } from '@/store/featureStores'
import { useUtcClock } from '@/hooks/useUtcClock'
import { LayerControlDrawer } from './LayerControlDrawer'
import type { MapLayerId } from '@/store/mapStore'

export function OperationalHUD({ availableLayers }: { availableLayers?: MapLayerId[] }) {
  const challengePhase = useChallengeStore((s) => s.phase)
  const challengeLabel = useChallengeStore((s) => s.label)
  const simulationId = useSimulationStore((s) => s.simulationId)
  const simStatus = useSimulationStore((s) => s.status)
  const invStatus = useInvestigationStore((s) => s.status)
  const sar = useSarStore((s) => s.provenance)
  const wind = useEnvironmentStore((s) => s.wind)
  const current = useEnvironmentStore((s) => s.current)
  const ais = useAttributionStore((s) => s.aisSource)

  // Wall-clock UTC – based on new Date(), not simulation event timestamps
  const utcIso = useUtcClock()
  const clockFormatted = utcIso.slice(11, 19) + 'Z'

  const running = challengePhase === 'preparing' || challengePhase === 'running'
  const isCompleted = invStatus === 'COMPLETED' || challengePhase === 'done'

  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!simulationId) return
    navigator.clipboard.writeText(simulationId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <header className="operational-hud" role="region" aria-label="Geospatial Mission HUD">
      {/* 1. Case Identifier & Beacon */}
      <div className="hud-case-cluster">
        <span
          className={`hud-pulse-dot ${challengeLabel === 'DEMO' ? 'hud-pulse-dot--demo' : 'hud-pulse-dot--live'}`}
          aria-hidden="true"
        />
        <div className="hud-case-text">
          <span className="hud-case-prefix">{challengeLabel ?? 'INCIDENT'}</span>
          {simulationId ? (
            <button
              type="button"
              className="hud-case-btn"
              onClick={handleCopy}
              title="Click to copy case reference"
            >
              <span>{simulationId.slice(0, 10)}…</span>
              <span className="hud-copy-glyph">{copied ? '✓' : '⧉'}</span>
            </button>
          ) : (
            <span className="hud-case-id">STANDBY</span>
          )}
        </div>
      </div>

      <div className="hud-divider" aria-hidden="true" />

      {/* 2. Operational Clock & Status */}
      <div className="hud-telemetry-cluster">
        <div className="hud-pill">
          <span className="hud-pill-kicker">STATUS</span>
          <span className="hud-pill-value">{simStatus ? simStatus.replace('_', ' ') : 'STANDBY'}</span>
        </div>

        <div className="hud-pill">
          <span className="hud-pill-kicker">UTC</span>
          <span className="hud-pill-value hud-pill-value--mono">{clockFormatted}</span>
        </div>
      </div>

      <div className="hud-divider" aria-hidden="true" />

      {/* 3. Sensor Provenance Indicators */}
      <div className="hud-sensor-stream" role="group" aria-label="Sensor Provenance">
        <span className="hud-sensor-chip" title={`SAR Radar: ${sar ?? 'Awaiting'}`}>
          <span className={`sensor-dot ${sar ? 'sensor-dot--ok' : 'sensor-dot--na'}`} />
          <span>SAR</span>
        </span>
        <span className="hud-sensor-chip" title={`Wind: ${wind.status}`}>
          <span className={`sensor-dot ${wind.status === 'available' ? 'sensor-dot--ok' : 'sensor-dot--na'}`} />
          <span>WIND</span>
        </span>
        <span className="hud-sensor-chip" title={`Currents: ${current.status}`}>
          <span className={`sensor-dot ${current.status === 'available' ? 'sensor-dot--ok' : 'sensor-dot--na'}`} />
          <span>CURR</span>
        </span>
        <span className="hud-sensor-chip" title={`AIS: ${ais ?? 'Awaiting'}`}>
          <span className={`sensor-dot ${ais ? 'sensor-dot--ok' : 'sensor-dot--na'}`} />
          <span>AIS</span>
        </span>
      </div>

      <div className="hud-divider" aria-hidden="true" />

      {/* 4. Tactical Primary Actions */}
      <div className="hud-actions-cluster">
        {challengePhase !== 'idle' ? (
          <span className="hud-phase-label">{phaseLabel(challengePhase)}</span>
        ) : null}

        <Button
          variant="primary"
          size="sm"
          disabled={running}
          onClick={() => void runLiveChallenge('LIVE')}
          title="Run complete live forensic attribution pipeline"
        >
          {running ? 'Executing…' : 'Start Live Challenge'}
        </Button>

        {isCompleted ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              resetCaseState()
              void runLiveChallenge('LIVE')
            }}
            title="Reset scenario and re-seed with fresh anomaly"
          >
            New Scenario
          </Button>
        ) : null}
      </div>

      <div className="hud-divider" aria-hidden="true" />

      {/* 5. GIS Layers Control */}
      <div className="hud-layers-cluster">
        <LayerControlDrawer available={availableLayers} />
      </div>
    </header>
  )
}
