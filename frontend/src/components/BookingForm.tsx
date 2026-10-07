import { useMemo, useState, type FormEvent } from 'react'
import type { Booking, Room } from '../api/types'
import {
  EMPTY_BOOKING_FORM,
  buildBookingPayload,
  formatDateTimeRange,
  hasErrors,
  isoToBerlinInput,
  validateBookingForm,
  type BookingFormErrors,
  type BookingFormField,
  type BookingFormTouched,
  type BookingFormValues,
  type BookingPayload,
} from '../lib/validation'

// Component-scoped styles. They live here rather than in a separate CSS module
// so the booking-form slice stays inside the four files its ticket owns; every
// value comes from the DESIGN.md tokens declared in styles/tokens.css.
const FORM_STYLES = `
.booking-form-page {
  max-width: 640px;
}
.booking-form-page .page-title {
  margin-bottom: var(--space-4);
}
.card {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: 0 1px 2px rgba(17, 24, 39, 0.06);
}
.booking-form__required-note {
  margin: 0 0 var(--space-3);
  font-size: var(--size-small);
  color: var(--color-muted);
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}
.form-field label {
  font-size: var(--size-small);
  font-weight: var(--label-weight);
  color: var(--color-fg-soft);
}
.form-field input,
.form-field select {
  width: 100%;
  height: 44px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-strong);
  background: var(--color-bg);
  color: var(--color-fg);
  font-family: inherit;
  font-size: var(--size-body);
  font-variant-numeric: tabular-nums;
}
.form-field select {
  padding-right: 36px;
}
.form-field input:hover,
.form-field select:hover {
  border-color: var(--color-fg-soft);
}
.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-soft);
}
.form-field [aria-invalid='true'] {
  border-color: var(--color-danger);
}
.form-field [aria-invalid='true']:focus {
  box-shadow: 0 0 0 2px var(--color-danger-soft);
}
.form-field__error {
  margin: 0;
  font-size: var(--size-small);
  color: var(--color-danger);
}
.time-range {
  border: 0;
  margin: 0 0 var(--space-3);
  padding: 0;
}
.time-range__legend {
  padding: 0;
  margin-bottom: var(--space-1);
  font-size: var(--size-small);
  font-weight: var(--label-weight);
  color: var(--color-fg-soft);
}
.time-range__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-2);
}
@media (min-width: 640px) {
  .time-range__grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
.conflict-banner {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-warning);
  background: var(--color-warning-soft);
}
.conflict-banner__title {
  margin: 0 0 var(--space-0);
  font-weight: var(--heading-weight);
  color: var(--color-warning);
}
.conflict-banner__body {
  margin: 0;
  font-size: var(--size-small);
  color: var(--color-fg-soft);
}
.booking-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
.button--primary {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: #ffffff;
}
.button--primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  border-color: var(--color-accent-hover);
}
.button--primary:active:not(:disabled) {
  background: var(--color-accent-active);
  border-color: var(--color-accent-active);
}
.button--danger {
  background: var(--color-bg);
  border: 1px solid var(--color-danger-soft);
  color: var(--color-danger);
}
.button--danger:hover:not(:disabled) {
  background: var(--color-danger-soft);
}
.booking-form__note {
  margin: var(--space-2) 0 0;
  font-size: var(--size-small);
  color: var(--color-muted);
}
`

export interface ConflictingBooking {
  id: number
  title: string
  booked_by: string
  start: string
  end: string
}

export interface ConflictDetails {
  conflicting_booking: ConflictingBooking
}

export interface BookingFormProps {
  mode: 'create' | 'edit'
  rooms: Room[]
  initial?: Booking | null
  defaultRoomId?: number | null
  submitting: boolean
  conflict: ConflictDetails | null
  serverError: string | null
  serverFieldErrors: Partial<Record<BookingFormField, string>>
  started: boolean
  onSubmit: (payload: BookingPayload) => void
  onDelete?: () => void
  onCancel: () => void
}

function initialValues(initial: Booking | null | undefined, defaultRoomId: number | null | undefined): BookingFormValues {
  if (initial) {
    const start = isoToBerlinInput(initial.start)
    const end = isoToBerlinInput(initial.end)
    return {
      room_id: String(initial.room_id),
      title: initial.title,
      booked_by: initial.booked_by,
      date: start.date,
      start_time: start.time,
      end_time: end.time,
    }
  }
  return { ...EMPTY_BOOKING_FORM, room_id: defaultRoomId ? String(defaultRoomId) : '' }
}

export default function BookingForm({
  mode,
  rooms,
  initial,
  defaultRoomId,
  submitting,
  conflict,
  serverError,
  serverFieldErrors,
  started,
  onSubmit,
  onDelete,
  onCancel,
}: BookingFormProps) {
  const [values, setValues] = useState<BookingFormValues>(() => initialValues(initial, defaultRoomId))
  const [touched, setTouched] = useState<BookingFormTouched>({})
  const [submitted, setSubmitted] = useState(false)

  const errors = useMemo<BookingFormErrors>(() => validateBookingForm(values), [values])

  const update = (field: BookingFormField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const visibleError = (field: BookingFormField): string | undefined => {
    if (serverFieldErrors[field]) {
      return serverFieldErrors[field]
    }
    if (submitted || touched[field]) {
      return errors[field]
    }
    return undefined
  }

  const attemptSubmit = () => {
    setSubmitted(true)
    if (hasErrors(errors)) {
      return
    }
    onSubmit(buildBookingPayload(values))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    attemptSubmit()
  }

  const fieldProps = (field: BookingFormField) => {
    const error = visibleError(field)
    return {
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `booking-${field}-error` : undefined,
    }
  }

  const renderError = (field: BookingFormField) => {
    const error = visibleError(field)
    if (!error) {
      return null
    }
    return (
      <p className="form-field__error" id={`booking-${field}-error`}>
        {error}
      </p>
    )
  }

  const disabled = submitting || started

  return (
    <>
      <style>{FORM_STYLES}</style>
      <form className="booking-form" onSubmit={handleSubmit} noValidate>
      <div className="card">
        <p className="booking-form__required-note">
          Fields marked <span aria-hidden="true">*</span> are required.
        </p>

        <div className="form-field">
          <label htmlFor="booking-room_id">
            Room <span aria-hidden="true">*</span>
          </label>
          <select
            id="booking-room_id"
            value={values.room_id}
            onChange={(event) => update('room_id', event.target.value)}
            {...fieldProps('room_id')}
          >
            <option value="">Select a room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} · {room.seats} seats
              </option>
            ))}
          </select>
          {renderError('room_id')}
        </div>

        <div className="form-field">
          <label htmlFor="booking-title">
            Title <span aria-hidden="true">*</span>
          </label>
          <input
            id="booking-title"
            type="text"
            value={values.title}
            onChange={(event) => update('title', event.target.value)}
            {...fieldProps('title')}
          />
          {renderError('title')}
        </div>

        <div className="form-field">
          <label htmlFor="booking-booked_by">
            Booked by <span aria-hidden="true">*</span>
          </label>
          <input
            id="booking-booked_by"
            type="text"
            value={values.booked_by}
            onChange={(event) => update('booked_by', event.target.value)}
            {...fieldProps('booked_by')}
          />
          {renderError('booked_by')}
        </div>

        <fieldset className="time-range">
          <legend className="time-range__legend">
            Time range <span aria-hidden="true">*</span>
          </legend>
          <div className="time-range__grid">
            <div className="form-field">
              <label htmlFor="booking-date">Date</label>
              <input
                id="booking-date"
                type="date"
                value={values.date}
                onChange={(event) => update('date', event.target.value)}
                {...fieldProps('date')}
              />
              {renderError('date')}
            </div>
            <div className="form-field">
              <label htmlFor="booking-start_time">Start</label>
              <input
                id="booking-start_time"
                type="time"
                step={300}
                value={values.start_time}
                onChange={(event) => update('start_time', event.target.value)}
                {...fieldProps('start_time')}
              />
              {renderError('start_time')}
            </div>
            <div className="form-field">
              <label htmlFor="booking-end_time">End</label>
              <input
                id="booking-end_time"
                type="time"
                step={300}
                value={values.end_time}
                onChange={(event) => update('end_time', event.target.value)}
                {...fieldProps('end_time')}
              />
              {renderError('end_time')}
            </div>
          </div>
        </fieldset>

        {conflict ? (
          <div className="conflict-banner" role="alert">
            <p className="conflict-banner__title">This period is already taken</p>
            <p className="conflict-banner__body">
              {conflict.conflicting_booking.title} by {conflict.conflicting_booking.booked_by},{' '}
              {formatDateTimeRange(conflict.conflicting_booking.start, conflict.conflicting_booking.end)}
            </p>
          </div>
        ) : null}

        {serverError ? (
          <div className="error-banner" role="alert">
            <span className="error-banner__message">{serverError}</span>
            <button type="button" className="button button--secondary" onClick={attemptSubmit}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="booking-form__actions">
          <button type="submit" className="button button--primary" disabled={disabled}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
          {mode === 'edit' && onDelete ? (
            <button type="button" className="button button--danger" disabled={disabled} onClick={onDelete}>
              Delete
            </button>
          ) : null}
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>

        {started ? (
          <p className="booking-form__note">
            This booking has already started, so it can no longer be changed or deleted.
          </p>
        ) : null}
      </div>
      </form>
    </>
  )
}
