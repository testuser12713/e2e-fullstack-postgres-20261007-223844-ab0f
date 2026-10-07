import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AsyncState from '../components/AsyncState'
import BookingForm, { type ConflictDetails } from '../components/BookingForm'
import { del, get, post, put } from '../api/client'
import { ApiError, type Booking, type Room } from '../api/types'
import { useApi } from '../hooks/useApi'
import type { BookingFormField, BookingPayload } from '../lib/validation'

const SERVER_FIELD_MAP: Record<string, BookingFormField> = {
  room_id: 'room_id',
  title: 'title',
  booked_by: 'booked_by',
  start: 'start_time',
  end: 'end_time',
}

function extractConflict(details: object | null): ConflictDetails | null {
  if (!details) {
    return null
  }
  const conflicting = (details as { conflicting_booking?: ConflictDetails['conflicting_booking'] })
    .conflicting_booking
  if (!conflicting || typeof conflicting !== 'object') {
    return null
  }
  return { conflicting_booking: conflicting }
}

function extractFieldErrors(details: object | null): Partial<Record<BookingFormField, string>> {
  if (!details) {
    return {}
  }
  const { field, reason } = details as { field?: unknown; reason?: unknown }
  if (typeof field !== 'string' || typeof reason !== 'string') {
    return {}
  }
  const mapped = SERVER_FIELD_MAP[field]
  return mapped ? { [mapped]: reason } : {}
}

export default function BookingFormPage() {
  const params = useParams()
  const navigate = useNavigate()
  const bookingId = params.bookingId
  const editing = bookingId !== undefined
  const parsedRoomId = Number(params.roomId)
  const defaultRoomId = Number.isFinite(parsedRoomId) ? parsedRoomId : null

  const roomsApi = useApi<Room[]>(() => get<Room[]>('/api/rooms'), [])
  const bookingApi = useApi<Booking | null>(
    () => (bookingId ? get<Booking>(`/api/bookings/${bookingId}`) : Promise.resolve(null)),
    [bookingId],
  )

  const [submitting, setSubmitting] = useState(false)
  const [conflict, setConflict] = useState<ConflictDetails | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<BookingFormField, string>>>({})

  const booking = bookingApi.data
  const loading = roomsApi.loading || (editing && bookingApi.loading)
  const loadError = roomsApi.error ?? bookingApi.error
  const started = booking ? new Date(booking.start).getTime() <= Date.now() : false

  const reload = () => {
    roomsApi.reload()
    if (editing) {
      bookingApi.reload()
    }
  }

  const goToDay = (roomId: number | string | undefined | null) => {
    if (roomId === undefined || roomId === null || roomId === '') {
      navigate('/rooms')
      return
    }
    navigate(`/rooms/${roomId}/day`)
  }

  const handleRequestError = (error: unknown) => {
    if (error instanceof ApiError) {
      if (error.code === 'conflict') {
        setConflict(extractConflict(error.details))
      } else if (error.code === 'validation_error') {
        const fieldErrors = extractFieldErrors(error.details)
        if (Object.keys(fieldErrors).length > 0) {
          setServerFieldErrors(fieldErrors)
        } else {
          setServerError(error.message)
        }
      } else {
        setServerError(error.message)
      }
      return
    }
    setServerError('Something went wrong. Please try again.')
  }

  const handleSubmit = async (payload: BookingPayload) => {
    setSubmitting(true)
    setConflict(null)
    setServerError(null)
    setServerFieldErrors({})
    try {
      if (bookingId) {
        await put<Booking>(`/api/bookings/${bookingId}`, payload)
      } else {
        await post<Booking>('/api/bookings', payload)
      }
      goToDay(payload.room_id)
    } catch (error) {
      handleRequestError(error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!bookingId) {
      return
    }
    setSubmitting(true)
    setServerError(null)
    try {
      await del(`/api/bookings/${bookingId}`)
      goToDay(booking?.room_id)
    } catch (error) {
      handleRequestError(error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    goToDay(booking?.room_id ?? params.roomId)
  }

  return (
    <div className="booking-form-page">
      <h1 className="page-title">{editing ? 'Buchung bearbeiten' : 'Neue Buchung'}</h1>
      <AsyncState loading={loading} error={loadError} onRetry={reload}>
        {roomsApi.data ? (
          <BookingForm
            key={editing ? `edit-${bookingId}` : 'create'}
            mode={editing ? 'edit' : 'create'}
            rooms={roomsApi.data}
            initial={booking}
            defaultRoomId={defaultRoomId}
            submitting={submitting}
            conflict={conflict}
            serverError={serverError}
            serverFieldErrors={serverFieldErrors}
            started={started}
            onSubmit={handleSubmit}
            onDelete={editing ? handleDelete : undefined}
            onCancel={handleCancel}
          />
        ) : null}
      </AsyncState>
    </div>
  )
}
