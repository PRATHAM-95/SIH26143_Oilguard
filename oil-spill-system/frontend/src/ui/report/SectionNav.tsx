import { clsx } from 'clsx'
import { prefersReducedMotion } from '../motion/tokens'

export const REPORT_SECTIONS = [
  { id: 'dossier-hero', label: 'Incident Dossier', number: '01' },
  { id: 'executive-finding', label: 'Executive Finding', number: '02' },
  { id: 'detection', label: 'Detection', number: '03' },
  { id: 'characterization', label: 'Characterization', number: '04' },
  { id: 'environment', label: 'Environment', number: '05' },
  { id: 'forward-drift', label: 'Forward Drift', number: '06' },
  { id: 'backtracking', label: 'Backtracking', number: '07' },
  { id: 'ais-traffic', label: 'AIS / Vessels', number: '08' },
  { id: 'attribution', label: 'Attribution', number: '09' },
  { id: 'conclusion', label: 'Conclusion', number: '10' },
  { id: 'provenance', label: 'Provenance', number: '11' },
  { id: 'limitations', label: 'Limitations', number: '12' },
  { id: 'technical-appendix', label: 'Appendix', number: '13' },
]

export function SectionNav({
  activeSection,
  onPrint,
}: {
  activeSection: string
  onPrint: () => void
}) {
  return (
    <nav className="report-nav" aria-label="Report sections">
      <div className="report-nav__header">
        <span className="report-nav__brand">OilGuard</span>
        <span className="report-nav__type">Forensic Dossier</span>
      </div>

      <ul className="report-nav__list">
        {REPORT_SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={activeSection === s.id ? 'location' : undefined}
              className={clsx(
                'report-nav__link',
                activeSection === s.id && 'report-nav__link--active',
              )}
              onClick={(e) => {
                e.preventDefault()
                const isReduced = prefersReducedMotion()
                document.getElementById(s.id)?.scrollIntoView({
                  behavior: isReduced ? 'auto' : 'smooth',
                  block: 'start',
                })
              }}
            >
              <span className="report-nav__number">{s.number}</span>
              <span className="report-nav__label">{s.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <div className="report-nav__actions">
        <button
          className="report-nav__print-btn"
          onClick={onPrint}
          aria-label="Export report as PDF"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Export PDF
        </button>
      </div>
    </nav>
  )
}
