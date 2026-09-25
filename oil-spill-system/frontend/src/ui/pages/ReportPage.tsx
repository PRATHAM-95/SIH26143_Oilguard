import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useSimulationStore } from '@/store/simulationStore'
import { useInvestigationStore } from '@/store/investigationStore'
import { useSarStore } from '@/store/sarStore'
import { useBacktrackingStore, useAttributionStore } from '@/store/featureStores'
import { investigationApi, type InvestigationReport } from '@/lib/api/investigationApi'
import { useSimulationConnection } from '@/hooks/useSimulationConnection'
import { useInvestigationConnection } from '@/hooks/useInvestigationConnection'

// Lazy-loaded interactive analytical map theater (screen only)
const MaritimeMapTheater = lazy(() =>
  import('@/ui/console/map/MaritimeMapTheater').then((m) => ({ default: m.MaritimeMapTheater }))
)

// Report sections
import { DossierHero, ExecutiveFinding } from '../report/DossierHero'
import { DetectionSection, CharacterizationSection, EnvironmentSection } from '../report/EvidenceSections'
import { ForwardDriftSection, BacktrackingSection } from '../report/AnalysisSections'
import { AISSection, AttributionSection } from '../report/AttributionSections'
import { ConclusionSection, ProvenanceSection, LimitationsSection, TechnicalAppendix } from '../report/ConclusionSections'
import { SectionNav, REPORT_SECTIONS } from '../report/SectionNav'
import { ReportDivider } from '../report/primitives'
import { ReportCompletionBanner } from '../journey/JourneyOverviewCard'

/**
 * M5 — REPORT PAGE
 * Maritime Forensic Dossier: publication-grade scrollable report.
 * NOT a WorkstationShell — this is a full-width editorial document.
 */
export default function ReportPage() {
  const simulationId = useSimulationStore((s) => s.simulationId)
  const refreshState = useSimulationStore((s) => s.refreshState)
  const investigationId = useInvestigationStore((s) => s.investigationId)
  const loadForSimulation = useInvestigationStore((s) => s.loadForSimulation)

  const [report, setReport] = useState<InvestigationReport | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>('dossier-hero')

  const scrollRef = useRef<HTMLDivElement>(null)
  const booted = useRef(false)

  // Live connections
  useSimulationConnection(simulationId)
  useInvestigationConnection(investigationId)

  // Cold-open bootstrap: hydrate stores
  useEffect(() => {
    if (booted.current) return
    booted.current = true
    const simId = useSimulationStore.getState().simulationId
    if (simId) {
      void refreshState()
      void loadForSimulation(simId)
      void useSarStore.getState().loadObservation(simId)
      void useBacktrackingStore.getState().loadRuns(simId)
      void useAttributionStore.getState().loadRuns(simId)
    }
  }, [refreshState, loadForSimulation])

  // Load report from API when investigation changes
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
    return () => { cancelled = true }
  }, [simulationId, loadedId])

  // Reload stores when simulationId changes
  useEffect(() => {
    if (simulationId) {
      void refreshState()
      void loadForSimulation(simulationId)
      void useSarStore.getState().loadObservation(simulationId)
      void useBacktrackingStore.getState().loadRuns(simulationId)
      void useAttributionStore.getState().loadRuns(simulationId)
    }
  }, [simulationId, refreshState, loadForSimulation])

  // Scroll spy — track which section is in view
  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const scrollTop = container.scrollTop + 120 // offset for nav
    for (let i = REPORT_SECTIONS.length - 1; i >= 0; i--) {
      const el = document.getElementById(REPORT_SECTIONS[i].id)
      if (el && el.offsetTop <= scrollTop) {
        setActiveSection(REPORT_SECTIONS[i].id)
        break
      }
    }
  }, [])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <div className="report-layout" ref={scrollRef} onScroll={handleScroll}>
      {/* Section navigation sidebar — screen only */}
      <SectionNav activeSection={activeSection} onPrint={handlePrint} />

      {/* Dossier document body */}
      <article className="report-document">
        {error && (
          <div className="report-aside report-aside--warn mb-6" role="alert">
            <span className="report-aside__label">Notice</span>
            <span className="report-aside__text">Backend report synchronization: {error}</span>
          </div>
        )}

        <ReportCompletionBanner />
        <DossierHero />
        <ReportDivider />
        <ExecutiveFinding />
        <ReportDivider />
        <DetectionSection reportData={report} />
        <CharacterizationSection reportData={report} />
        <ReportDivider />
        <EnvironmentSection reportData={report} />
        <ForwardDriftSection reportData={report} />
        <ReportDivider />
        <BacktrackingSection reportData={report} />

        {/* Unified Geospatial Intelligence Map Theater (Screen only) */}
        <div className="report-theater-plate screen-only my-8">
          <div className="report-theater-plate__header flex items-center justify-between pb-2 border-b border-chartline">
            <div>
              <span className="font-mono text-signal-blue text-[10px] uppercase tracking-wider block">Interactive Evidence Theater</span>
              <h3 className="text-sm font-medium text-porcelain">Unified Geospatial Investigation Map</h3>
            </div>
            <span className="text-[11px] text-dim font-mono">MapLibre · Deck.gl</span>
          </div>
          <div className="report-theater-plate__frame h-[420px] w-full relative rounded overflow-hidden border border-chartline my-3 bg-trench">
            <Suspense fallback={
              <div className="h-full w-full flex items-center justify-center text-dim font-mono text-xs">
                Initializing Geospatial Theater...
              </div>
            }>
              <MaritimeMapTheater />
            </Suspense>
          </div>
          <p className="text-xs text-dim leading-relaxed">
            Live interactive viewport integrating SAR detection contours, forward drift dispersion, reverse Lagrangian backtracking ensemble, and candidate AIS vessel trajectories.
          </p>
        </div>

        <ReportDivider />
        <AISSection reportData={report} />
        <AttributionSection reportData={report} />
        <ReportDivider />
        <ConclusionSection />
        <ReportDivider />
        <ProvenanceSection />
        <LimitationsSection />
        <ReportDivider />
        <TechnicalAppendix />

        {/* Report footer */}
        <footer className="report-footer">
          <p>
            OilGuard Maritime Forensic Intelligence · Report generated from recorded investigation state
          </p>
          <p className="font-mono text-xs">
            {loadedId && `Investigation: ${loadedId}`}
            {simulationId && ` · Simulation: ${simulationId}`}
          </p>
          <p className="text-dim text-xs">
            Scores are composite likelihoods for the search window and are not probabilities.
            A ranked candidate is never a confirmed culprit.
          </p>
        </footer>
      </article>
    </div>
  )
}
