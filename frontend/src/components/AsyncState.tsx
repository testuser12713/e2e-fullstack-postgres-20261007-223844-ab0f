import type { ReactNode } from 'react'
import { ApiError } from '../api/types'

export interface AsyncStateProps {
  loading: boolean
  error: ApiError | null
  onRetry: () => void
  loadingLabel?: string
  children: ReactNode
}

export function AsyncState({
  loading,
  error,
  onRetry,
  loadingLabel = 'Loading…',
  children,
}: AsyncStateProps) {
  if (loading) {
    return (
      <div className="loading-state" role="status" aria-busy="true">
        <span className="visually-hidden">{loadingLabel}</span>
        <span className="loading-state__skeleton" aria-hidden="true" />
        <span className="loading-state__skeleton loading-state__skeleton--short" aria-hidden="true" />
      </div>
    )
  }

  if (error) {
    const statusHint = error.status ? `HTTP ${error.status}` : error.code
    return (
      <div className="error-banner" role="alert">
        <span className="error-banner__message">
          {error.message || 'Something went wrong.'}
          <span className="error-banner__hint">{statusHint}</span>
        </span>
        <button type="button" className="button button--secondary" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }

  return <>{children}</>
}

export default AsyncState
