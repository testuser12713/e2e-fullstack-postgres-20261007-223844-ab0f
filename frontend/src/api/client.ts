import { ApiError, type ErrorBody } from './types'

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (!configured || configured.startsWith('${')) {
    return ''
  }
  return configured.replace(/\/+$/, '')
}

function requestUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${apiBaseUrl()}${normalized}`
}

function isErrorBody(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string'
  )
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null
  }
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(requestUrl(path), {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Network request failed'
    throw new ApiError('network_error', message, null, 0)
  }

  const payload = await readJson(response)

  if (!response.ok) {
    if (isErrorBody(payload)) {
      throw new ApiError(
        payload.code,
        payload.message || response.statusText || `HTTP ${response.status}`,
        payload.details ?? null,
        response.status,
      )
    }
    throw new ApiError(
      'http_error',
      response.statusText || `HTTP ${response.status}`,
      null,
      response.status,
    )
  }

  return payload as T
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

export function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, body)
}

export function del<T = void>(path: string): Promise<T> {
  return request<T>('DELETE', path)
}
