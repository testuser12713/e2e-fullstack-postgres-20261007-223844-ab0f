import { get } from '../api/client'
import { useApi } from '../hooks/useApi'
import type { HealthResponse } from '../api/types'

export default function HealthIndicator() {
  const { data, loading, error } = useApi<HealthResponse>(() =>
    get<HealthResponse>('/api/health'),
  )

  if (error) {
    return (
      <span
        className="health-pill health-pill--offline"
        role="status"
        title={error.message || 'The API did not answer /api/health'}
      >
        <span className="health-pill__dot" aria-hidden="true" />
        API offline
      </span>
    )
  }

  if (loading || !data) {
    return (
      <span className="health-pill health-pill--loading" role="status" title="Checking /api/health…">
        <span className="health-pill__dot" aria-hidden="true" />
        Checking…
      </span>
    )
  }

  const databaseOk = data.database === 'ok'
  return (
    <span
      className={`health-pill health-pill--${databaseOk ? 'ok' : 'db-unreachable'}`}
      role="status"
      title={JSON.stringify(data)}
    >
      <span className="health-pill__dot" aria-hidden="true" />
      {databaseOk ? 'API ok' : 'Database unreachable'}
    </span>
  )
}
