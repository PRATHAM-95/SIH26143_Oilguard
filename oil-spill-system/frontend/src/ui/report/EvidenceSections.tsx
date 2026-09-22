import { useSarStore } from '@/store/sarStore'
import { useSimulationStore } from '@/store/simulationStore'
import { useEnvironmentStore } from '@/store/environmentStore'
import {
  ReportSection,
  ReportMetric,
  ReportMetricGrid,
  ReportEmpty,
  ReportProvenance,
  ReportNarrative,
  ReportTable,
} from './primitives'

/**
 * 03 — DETECTION
 * SAR observation evidence. Shows actual detection data from sarStore.
 */
export function DetectionSection({ reportData }: { reportData: Record<string, unknown> | null }) {
  const sarStatus = useSarStore((s) => s.status)
  const observationId = useSarStore((s) => s.observationId)
  const provenance = useSarStore((s) => s.provenance)
  const source = useSarStore((s) => s.source)
  const acquisitionTime = useSarStore((s) => s.acquisitionTime)
  const satellites = useSarStore((s) => s.satellites)
  const polarization = useSarStore((s) => s.polarization)
  const sceneId = useSarStore((s) => s.sceneId)
  const candidates = useSarStore((s) => s.candidates)
  const slickAreaKm2 = useSarStore((s) => s.slickAreaKm2)
  const confidence = useSarStore((s) => s.confidence)
  const detector = useSarStore((s) => s.detector)
  const detectorVersion = useSarStore((s) => s.detectorVersion)

  const detData = reportData?.['3_detection'] as Record<string, unknown> | undefined
  const detSummary = detData?.summary ? String(detData.summary) : null

  if (sarStatus === 'idle' && !observationId) {
    return (
      <ReportSection id="detection" number="03" title="SAR Detection">
        <ReportEmpty
          label="No SAR evidence acquired"
          hint="Detection stage has not been executed or no observation is available."
        />
      </ReportSection>
    )
  }

  return (
    <ReportSection id="detection" number="03" title="SAR Detection">
      {detSummary && (
        <ReportNarrative>
          <p>{detSummary}</p>
        </ReportNarrative>
      )}

      <ReportMetricGrid columns={3}>
        <ReportMetric label="Observation" value={observationId} mono />
        <ReportMetric label="Status" value={sarStatus} />
        <ReportMetric label="SAR Source" value={source ? String(source) : null} />
        <ReportMetric
          label="Provenance"
          value={provenance ? String(provenance) : null}
        />
        <ReportMetric
          label="Acquisition"
          value={acquisitionTime ? new Date(acquisitionTime).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : null}
          mono
        />
        <ReportMetric label="Satellites" value={satellites.length > 0 ? satellites.join(', ') : null} />
        <ReportMetric label="Polarization" value={polarization} />
        <ReportMetric label="Scene" value={sceneId} mono />
        <ReportMetric label="Detector" value={detector} />
        <ReportMetric label="Detector version" value={detectorVersion} mono />
        <ReportMetric label="Candidates" value={candidates.length} />
        <ReportMetric label="Total area" value={slickAreaKm2?.toFixed(2)} unit="km²" mono />
        <ReportMetric
          label="Confidence"
          value={confidence != null ? `${(confidence * 100).toFixed(0)}%` : null}
          mono
        />
      </ReportMetricGrid>

      {candidates.length > 0 && (
        <ReportTable
          columns={[
            { key: 'id', label: 'Candidate', mono: true },
            { key: 'classification', label: 'Classification' },
            { key: 'confidence', label: 'Confidence', align: 'right', mono: true },
            { key: 'area', label: 'Area (km²)', align: 'right', mono: true },
            { key: 'centroid', label: 'Centroid', mono: true },
          ]}
          rows={candidates.map((c) => ({
            id: c.id,
            classification: c.classification,
            confidence: `${(c.confidence * 100).toFixed(0)}%`,
            area: c.areaKm2.toFixed(3),
            centroid: `${c.centroid.lat.toFixed(4)}°, ${c.centroid.lon.toFixed(4)}°`,
          }))}
          caption={`SAR candidate slicks detected${provenance ? ` — Source: ${provenance}` : ''}`}
        />
      )}
    </ReportSection>
  )
}

/**
 * 04 — CHARACTERIZATION
 * Slick physical properties and morphology.
 */
export function CharacterizationSection({ reportData }: { reportData: Record<string, unknown> | null }) {
  const candidates = useSarStore((s) => s.candidates)
  const slickAreaKm2 = useSarStore((s) => s.slickAreaKm2)

  const primary = candidates.length > 0 ? candidates[0] : null
  const charData = reportData?.['4_characterization'] as Record<string, unknown> | null | undefined

  if (!primary && !charData) {
    return (
      <ReportSection id="characterization" number="04" title="Slick Characterization">
        <ReportEmpty
          label="No characterization data"
          hint="Characterization stage has not produced results."
        />
      </ReportSection>
    )
  }

  return (
    <ReportSection id="characterization" number="04" title="Slick Characterization">
      <ReportMetricGrid columns={3}>
        <ReportMetric label="Total slick area" value={slickAreaKm2?.toFixed(3)} unit="km²" mono />
        {primary && (
          <>
            <ReportMetric label="Length" value={primary.lengthKm?.toFixed(2)} unit="km" mono />
            <ReportMetric label="Width" value={primary.widthKm?.toFixed(2)} unit="km" mono />
            <ReportMetric label="Aspect ratio" value={primary.aspectRatio?.toFixed(2)} mono />
            <ReportMetric
              label="Contrast"
              value={primary.contrastDb != null ? `${primary.contrastDb.toFixed(1)} dB` : null}
              mono
            />
            <ReportMetric
              label="Incidence"
              value={primary.incidenceDeg != null ? `${primary.incidenceDeg.toFixed(1)}°` : null}
              mono
            />
          </>
        )}
      </ReportMetricGrid>

      {primary && primary.hints.length > 0 && (
        <div className="report-aside">
          <span className="report-aside__label">Look-alike indicators</span>
          <span className="report-aside__text">{primary.hints.join('; ')}</span>
        </div>
      )}

      {primary && primary.warnings.length > 0 && (
        <div className="report-aside report-aside--warn">
          <span className="report-aside__label">Warnings</span>
          <span className="report-aside__text">{primary.warnings.join('; ')}</span>
        </div>
      )}
    </ReportSection>
  )
}

/**
 * 05 — ENVIRONMENT
 * Environmental forcing conditions: wind and current data availability.
 */
export function EnvironmentSection({ reportData }: { reportData: Record<string, unknown> | null }) {
  const env = useEnvironmentStore()
  const drift = useSimulationStore((s) => s.drift)
  const envData = reportData?.['5_environment'] as Record<string, unknown> | null | undefined
  const envSummary = envData?.summary ? String(envData.summary) : null

  return (
    <ReportSection id="environment" number="05" title="Environmental Conditions">
      <ReportMetricGrid columns={2}>
        <ReportMetric label="Ocean current" value={env.current.status} />
        <ReportMetric label="Wind field" value={env.wind.status} />
      </ReportMetricGrid>

      <div className="report-env-details">
        <div className="report-env-source">
          <span className="report-env-source__label">Current</span>
          <span className="report-env-source__note">{env.current.note}</span>
        </div>
        <div className="report-env-source">
          <span className="report-env-source__label">Wind</span>
          <span className="report-env-source__note">{env.wind.note}</span>
        </div>
        {drift.environmentSource && (
          <div className="report-env-source">
            <span className="report-env-source__label">Drift forcing</span>
            <span className="report-env-source__note">
              <ReportProvenance value={drift.environmentSource} />
              {drift.environmentDataset && ` (${drift.environmentDataset})`}
            </span>
          </div>
        )}
      </div>

      <ReportNarrative>
        {envSummary ? (
          <p>{envSummary}</p>
        ) : (
          <p>
            Environmental forcing data conditions the accuracy of both forward drift and
            backtracking simulations. When live ocean current or wind field data is unavailable,
            the system operates on controlled or modelled substitutes. Provenance labels identify
            which forcing source was active during this investigation.
          </p>
        )}
      </ReportNarrative>
    </ReportSection>
  )
}
