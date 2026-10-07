import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/types'

export interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: ApiError | null
  reload: () => void
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<ApiError | null>(null)
  const [version, setVersion] = useState(0)

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fetcherRef
      .current()
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setError(
          cause instanceof ApiError
            ? cause
            : new ApiError(
                'unknown_error',
                cause instanceof Error ? cause.message : String(cause),
                null,
                0,
              ),
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [...deps, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  return { data, loading, error, reload }
}
