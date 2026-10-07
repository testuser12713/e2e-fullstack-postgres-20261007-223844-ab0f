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

export interface ErrorBody {
  code: string
  message: string
  details: object | null
}

export type ApiErrorCode =
  | 'validation_error'
  | 'not_found'
  | 'conflict'
  | 'booking_started'
  | 'network_error'
  | 'http_error'

export class ApiError extends Error {
  readonly code: string
  readonly details: object | null
  readonly status: number

  constructor(code: string, message: string, details: object | null = null, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
    this.status = status
  }
}
