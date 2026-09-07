import type { DataSourceStatus } from '@/types/domain'

type DataSourceCardProps = {
  name: string
  provider: string
  status: DataSourceStatus
  label: string
  note?: string
  icon: React.ReactNode
}

const STATUS_DOT: Record<DataSourceStatus, string> = {
  awaiting: 'dot dot--idle',
  demo: 'dot dot--warn',
  available: 'dot dot--ok',
  unavailable: 'dot dot--danger',
}

/**
 * A data-source card. Clearly labels availability vs placeholders; status
 * is conveyed by icon + text as well as colour. Demo status is used only
 * for explicitly-marked mock data.
 */
export function DataSourceCard({
  name,
  provider,
  status,
  label,
  note,
  icon,
}: DataSourceCardProps) {
  return (
    <div className="datasource">
      <span aria-hidden="true" style={{ color: 'var(--accent)', opacity: 0.8 }}>
        {icon}
      </span>
      <div className="datasource-body">
        <span className="datasource-name">{name}</span>
        <span className="datasource-provider">{provider}</span>
        <span className="datasource-status">
          <span aria-hidden="true" className={STATUS_DOT[status]} />
          {label}
        </span>
        {note ? <span className="text-faint" style={{ fontSize: '10px' }}>{note}</span> : null}
      </div>
    </div>
  )
}