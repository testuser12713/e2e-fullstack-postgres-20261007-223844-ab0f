export interface Room {
  id: number
  name: string
  seats: number
  equipment: string[]
}

export interface Booking {
  id: number
  room_id: number
  title: string
  booked_by: string
  start: string
  end: string
}

export interface HealthResponse {
  status: string
  database: string
}

export interface ErrorBody {
  code: string
  message: string
  details: unknown | null
}

export type ApiErrorCode =
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'booking_started'
  | 'network_error'
  | 'http_error'
  | 'unknown_error'

export class ApiError extends Error {
  readonly code: string
  readonly details: unknown | null
  readonly status: number

  constructor(code: string, message: string, details: unknown | null = null, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}
