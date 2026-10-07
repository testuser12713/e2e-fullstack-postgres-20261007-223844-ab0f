// Pure logic for the booking form: field validation plus the conversions
// between the office time zone (Europe/Berlin) and the ISO 8601 timestamps
// the API speaks.

export const MAX_BOOKING_MINUTES = 8 * 60

export const OFFICE_TIME_ZONE = 'Europe/Berlin'

export interface BookingFormValues {
  room_id: string
  title: string
  booked_by: string
  date: string
  start_time: string
  end_time: string
}

export type BookingFormField = keyof BookingFormValues

export type BookingFormErrors = Partial<Record<BookingFormField, string>>

export type BookingFormTouched = Partial<Record<BookingFormField, boolean>>

export interface BookingPayload {
  room_id: number
  title: string
  booked_by: string
  start: string
  end: string
}

export const EMPTY_BOOKING_FORM: BookingFormValues = {
  room_id: '',
  title: '',
  booked_by: '',
  date: '',
  start_time: '',
  end_time: '',
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(date: Date): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const read = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? '0')
  let hour = read('hour')
  if (hour === 24) hour = 0
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  }
}

function timeZoneOffsetMinutes(date: Date): number {
  const parts = zonedParts(date)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return Math.round((asUtc - date.getTime()) / 60000)
}

function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-'
  const absolute = Math.abs(minutes)
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
}

// Builds an ISO 8601 timestamp with the office time zone offset from the wall
// clock date + time the user entered.
export function toIsoDateTime(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  let offset = timeZoneOffsetMinutes(new Date(wallAsUtc))
  // Second pass settles the offset on a DST transition boundary.
  offset = timeZoneOffsetMinutes(new Date(wallAsUtc - offset * 60000))
  return `${date}T${time}:00${formatOffset(offset)}`
}

// Reads an API timestamp back as office-local wall clock for the date + time
// inputs (never the raw ISO string).
export function isoToBerlinInput(iso: string): { date: string; time: string } {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return { date: '', time: '' }
  }
  const parts = zonedParts(date)
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  }
}

function minutesOfDay(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

export function validateBookingForm(values: BookingFormValues): BookingFormErrors {
  const errors: BookingFormErrors = {}
  if (!values.room_id) {
    errors.room_id = 'Please select a room.'
  }
  if (!values.title.trim()) {
    errors.title = 'Please enter a title.'
  }
  if (!values.booked_by.trim()) {
    errors.booked_by = 'Please enter who booked the room.'
  }
  if (!values.date) {
    errors.date = 'Please choose a date.'
  }
  if (!values.start_time) {
    errors.start_time = 'Please choose a start time.'
  }
  if (!values.end_time) {
    errors.end_time = 'Please choose an end time.'
  }
  if (values.start_time && values.end_time) {
    const duration = minutesOfDay(values.end_time) - minutesOfDay(values.start_time)
    if (duration <= 0) {
      errors.end_time = 'End must be after start'
    } else if (duration > MAX_BOOKING_MINUTES) {
      errors.end_time = 'A booking may last at most 8 hours'
    }
  }
  return errors
}

export function hasErrors(errors: BookingFormErrors): boolean {
  return Object.values(errors).some((message) => Boolean(message))
}

export function buildBookingPayload(values: BookingFormValues): BookingPayload {
  return {
    room_id: Number(values.room_id),
    title: values.title.trim(),
    booked_by: values.booked_by.trim(),
    start: toIsoDateTime(values.date, values.start_time),
    end: toIsoDateTime(values.date, values.end_time),
  }
}

function officeDate(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: OFFICE_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function officeTime(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: OFFICE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : officeDate(date)
}

// '09:00–10:30' in the office time zone, en dash as DESIGN.md requires.
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${officeTime(new Date(startIso))}–${officeTime(new Date(endIso))}`
}

// '09:00–10:30 (14.04.2026)'
export function formatDateTimeRange(startIso: string, endIso: string): string {
  return `${formatTimeRange(startIso, endIso)} (${formatDate(startIso)})`
}
