import { useEffect, useState } from 'react'
import { Panel, KeyValue, EmptyState } from '@/components/ui/Panel'
import { ProvenancePill, Disclaimer } from '@/components/ui/primitives'
import { StatusChip } from '@/components/Status'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore, STAGE_LABEL } from '@/store/investigationStore'
import { investigationApi, type InvestigationReport } from '@/lib/api/investigationApi'

const SECTION_LABEL: Record<string, string> = {
  '1_summary': 'Incident Summary',
  '2_context': 'Context',
  '3_detection': 'Detection',
  '4_characterization': 'Slick Characterization',
  '5_environment': 'Environmental Conditions',
  '6_forward_drift': 'Forward Drift',
  '7_backtracking': 'Source Estimation',
  '8_source_area': 'Source Area',
  '9_ais': 'AIS Analysis',
  '10_attribution': 'Vessel Attribution',
  '11_conclusion': 'Conclusion',
  '12_limitations': 'Limitations & Provenance',
}

const SECTION_ORDER = Object.keys(SECTION_LABEL)

const EMPHASIS_SECTIONS = ['11_conclusion', '12_limitations']

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function Value({ value }: { value: unknown }): React.ReactNode {
  if (value == null) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return (
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {value.map((v, i) => (
          <li key={i}>{isRecord(v) ? <Nested record={v} /> : String(v)}</li>
        ))}
      </ul>
    )
  }
  if (isRecord(value)) return <Nested record={value} />
  return '—'
}

function Nested({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(record)
  if (entries.length === 0) return '—'
  return (
    <ul style={{ margin: 0, paddingLeft: 16 }}>
      {entries.map(([k, v]) => (
        <li key={k}>
          <span className="text-faint">{k}: </span>
          <Value value={v} />
        </li>
      ))}
    </ul>
  )
}

function ReportSection({ id, title, record }: { id: string; title: string; record: unknown }) {
  const emphatic = EMPHASIS_SECTIONS.includes(id)
  return (
    <div
      id={`report-section-${id}`}
      className={emphatic ? 'report-section report-section--wide' : 'report-section'}
    >
      <Panel title={title}>
        <div className="stack">
          {isRecord(record) && Object.keys(record).length > 0 ? (
            <Value value={record} />
          ) : (
            <EmptyState label="Not available" />
          )}
        </div>
      </Panel>
    </div>
  )
}

/** Sticky section navigation — jump chips for the twelve report sections. */
function SectionNav() {
  return (
    <nav className="report-nav" aria-label="Report sections">
      {SECTION_ORDER.map((key) => (
        <a key={key} className="report-nav-chip" href={`#report-section-${key}`}>
          {key.split('_')[1].replace(/_/g, ' ')}
        </a>
      ))}
    </nav>
  )
}

function VerdictCard() {
  const conclusion = useInvestigationStore((s) => s.conclusion)
  const status = useInvestigationStore((s) => s.status)

  const ctx =
    conclusion?.status === 'candidate'
      ? { cls: 'verdict-card--warn', title: 'Candidate identified' }
      : status === 'COMPLETED'
        ? { cls: 'verdict-card--ok', title: 'Inconclusive' }
        : { cls: 'verdict-card--danger', title: 'Investigation not complete' }

  return (
    <div className={`verdict-card ${ctx.cls}`}>
      <span className="verdict-card-title">{ctx.title}</span>
      {conclusion?.candidate && typeof conclusion.candidate === 'object' ? (
        <span className="verdict-card-lead">
          {String(
            (conclusion.candidate as Record<string, unknown>).name ??
              (conclusion.candidate as Record<string, unknown>).mmsi ??
              '—',
          )}
        </span>
      ) : null}
      {conclusion?.topScore != null ? (
        <span className="text-dim">
          Top score {(conclusion.topScore * 100).toFixed(1)}% · margin{' '}
          {conclusion.margin != null ? `${(conclusion.margin * 100).toFixed(1)}%` : '—'}
        </span>
      ) : null}
      {conclusion?.reason ? (
        <span className="text-faint" style={{ fontSize: '10.5px', lineHeight: 1.4 }}>
          {conclusion.reason}
        </span>
      ) : null}
    </div>
  )
}

function DossierHeader({ investigationId }: { investigationId: string | null }) {
  const status = useInvestigationStore((s) => s.status)
  const params = useInvestigationStore((s) => s.params)
  return (
    <div className="dossier-hero">
      <div className="dossier-hero-main">
        <span className="eyebrow">Incident Dossier</span>
        <h1 className="dossier-hero-title">Marine Oil Spill <span>Forensic Report</span></h1>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <StatusChip tone={status === 'COMPLETED' ? 'ok' : status ? 'warn' : 'idle'} label={status ?? 'Not started'}>
            {status ?? 'Not started'}
          </StatusChip>
          {investigationId ? <span className="mono text-faint">{investigationId}</span> : null}
          {params?.seed ? <span className="mono text-faint">seed {params.seed}</span> : null}
        </div>
      </div>
      <div className="dossier-hero-note">
        <span className="text-dim">SD 26-0143 · Indian Ocean maritime lane</span>
        <span className="text-faint">Report aggregated from the recorded investigation state. Every figure carries provenance — controlled/demo data is always labelled.</span>
      </div>
    </div>
  )
}

function ProvenancePanel() {
  const provenance = useInvestigationStore((s) => s.provenance)
  const evidence = useInvestigationStore((s) => s.evidence)
  const params = useInvestigationStore((s) => s.params)

  return (
    <Panel title="Report Provenance">
      <div className="stack">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="field-label">Aggregation</span>
          <ProvenancePill value={provenance?.aggregation ?? null} />
        </div>
        {provenance?.perStage ? (
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(provenance.perStage).map(([stageId, p]) => (
              <ProvenancePill
                key={stageId}
                value={typeof p === 'string' ? p : null}
                label={STAGE_LABEL[stageId] ?? stageId}
              />
            ))}
          </div>
        ) : (
          <div className="text-faint" style={{ fontSize: '10.5px' }}>
            Per-stage provenance is recorded after the pipeline completes.
          </div>
        )}
        <KeyValue label="Evidence chain" value={`${evidence.length} links`} />
        <KeyValue label="Seed" value={params?.seed ?? '—'} />
        <div className="text-faint" style={{ fontSize: '10.5px', lineHeight: 1.4 }}>
          Provenance labels every value in this report. Demo/controlled sources are always
          marked and never presented as operational observations.
        </div>
      </div>
    </Panel>
  )
}

function GroundTruth() {
  const revealed = useInvestigationStore((s) => s.reveal.revealed)
  const lastReveal = useInvestigationStore((s) => s.lastReveal)

  if (!revealed) {
    return (
      <Panel title="Ground Truth">
        <EmptyState
          label="Sealed"
          hint="Ground truth is compared only by POST /api/investigation/{id}/reveal on a completed investigation."
        />
      </Panel>
    )
  }

  return (
    <Panel title="Ground Truth — Reveal Metrics">
      <div className="stack">
        <KeyValue label="Position error" value={`${lastReveal?.positionError_km?.toFixed(2) ?? '—'} km`} />
        <KeyValue
          label="Time error"
          value={lastReveal?.timeError_min != null ? `${lastReveal.timeError_min.toFixed(0)} min` : '—'}
        />
        <KeyValue label="Attribution correct" value={lastReveal?.attributionCorrect ? 'yes' : 'no'} />
        <KeyValue label="Score margin" value={lastReveal?.scoreMargin?.toFixed(3) ?? '—'} />
      </div>
    </Panel>
  )
}

export default function Report() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const [report, setReport] = useState<InvestigationReport | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!simulationId) {
      setReport(null)
      setLoadedId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await investigationApi.list({ simulationId })
        const latest = list[list.length - 1]
        if (!latest) {
          setReport(null)
          setLoadedId(null)
          return
        }
        if (cancelled || loadedId === latest.investigationId) return
        const doc = await investigationApi.report(latest.investigationId)
        if (cancelled) return
        setReport(doc)
        setLoadedId(latest.investigationId)
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [simulationId, loadedId])

  return (
    <div className="app-main--scroll dossier-page">
      <div className="dossier-wrap">
        <DossierHeader investigationId={loadedId} />
        <SectionNav />
        <div className="dossier-grid">
          <div className="report-sections">
            {error ? (
              <Panel title="Report">
                <EmptyState label="Report unavailable" hint={error} />
              </Panel>
            ) : report ? (
              SECTION_ORDER.map((key) => (
                <ReportSection key={key} id={key} title={SECTION_LABEL[key]} record={report[key]} />
              ))
            ) : (
              <Panel title="Report">
                <EmptyState
                  label="No completed investigation"
                  hint="Run an investigation on the Investigation page, then return here."
                />
              </Panel>
            )}
          </div>
          <div className="dossier-side">
            <VerdictCard />
            <ProvenancePanel />
            <GroundTruth />
            <Panel title="Reading this report">
              <div className="stack">
                <Disclaimer>
                  Scores are composite likelihoods for the search window and are{' '}
                  <strong>not probabilities</strong>. A <strong>ranked candidate</strong> is
                  never a confirmed culprit.
                </Disclaimer>
                <div className="text-faint" style={{ fontSize: '10.5px', lineHeight: 1.4 }}>
                  Sections reflect the stages recorded during the investigation run; stages that
                  did not produce data report "Not available" rather than guesses.
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  )
}