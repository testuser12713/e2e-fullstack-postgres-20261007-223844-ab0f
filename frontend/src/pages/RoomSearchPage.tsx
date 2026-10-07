import { useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import AsyncState from '../components/AsyncState'
import { get } from '../api/client'
import type { Room } from '../api/types'
import { useApi } from '../hooks/useApi'

interface SearchParams {
  start: string
  end: string
  minSeats: number | null
  equipment: string[]
}

const fieldKeys = ['date', 'start', 'end', 'minSeats'] as const
type FieldKey = (typeof fieldKeys)[number]

function toIsoDateTime(date: string, time: string): string {
  if (!date || !time) return ''
  const normalized = time.length === 5 ? `${time}:00` : time
  const value = new Date(`${date}T${normalized}`)
  return Number.isNaN(value.getTime()) ? '' : value.toISOString()
}

function parseEquipment(raw: string): string[] {
  return raw
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0)
}

async function fetchAvailableRooms(params: SearchParams): Promise<Room[]> {
  const query = new URLSearchParams()
  query.set('start', params.start)
  query.set('end', params.end)
  // The availability endpoint requires min_seats; an empty field means no seat
  // filter, which 1 expresses (every room has at least one seat).
  query.set('min_seats', String(params.minSeats ?? 1))
  for (const keyword of params.equipment) query.append('equipment', keyword)
  return get<Room[]>(`/api/rooms/available?${query.toString()}`)
}

export default function RoomSearchPage() {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [minSeats, setMinSeats] = useState('')
  const [equipmentText, setEquipmentText] = useState('')
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [params, setParams] = useState<SearchParams | null>(null)

  const { data, loading, error, reload } = useApi<Room[]>(
    () => (params ? fetchAvailableRooms(params) : Promise.resolve([])),
    [params],
  )

  function markTouched(field: FieldKey) {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }

  function errorFor(field: FieldKey): string | undefined {
    if (!submitAttempted && !touched[field]) return undefined
    return fieldErrors[field]
  }

  function validate(): Partial<Record<FieldKey, string>> {
    const errors: Partial<Record<FieldKey, string>> = {}
    if (!date) errors.date = 'Please choose a date.'
    if (!startTime) errors.start = 'Please choose a start time.'
    if (!endTime) errors.end = 'Please choose an end time.'
    if (date && startTime && endTime && endTime <= startTime) {
      errors.end = 'End must be after start.'
    }
    const seatsValue = minSeats.trim()
    if (seatsValue !== '') {
      const parsed = Number.parseInt(seatsValue, 10)
      if (Number.isNaN(parsed) || parsed < 1) {
        errors.minSeats = 'Minimum seats must be at least 1.'
      }
    }
    return errors
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitAttempted(true)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    const seatsValue = minSeats.trim()
    setParams({
      start: toIsoDateTime(date, startTime),
      end: toIsoDateTime(date, endTime),
      minSeats: seatsValue === '' ? null : Number.parseInt(seatsValue, 10),
      equipment: parseEquipment(equipmentText),
    })
  }

  const rooms = data ?? []

  return (
    <div>
      <div style={styles.pageHead}>
        <h1 className="page-title">Free rooms</h1>
        <p style={styles.subtitle}>
          Enter a period and a minimum number of seats to find available rooms.
        </p>
      </div>

      <form style={styles.card} onSubmit={handleSubmit} noValidate>
        <div style={styles.timeRange}>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="search-date">
              Date
            </label>
            <input
              id="search-date"
              style={styles.input}
              type="date"
              value={date}
              aria-invalid={errorFor('date') ? true : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)}
              onBlur={() => markTouched('date')}
            />
            {errorFor('date') && <span style={styles.error}>{errorFor('date')}</span>}
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="search-start">
              Start
            </label>
            <input
              id="search-start"
              style={styles.input}
              type="time"
              step={300}
              value={startTime}
              aria-invalid={errorFor('start') ? true : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setStartTime(event.target.value)}
              onBlur={() => markTouched('start')}
            />
            {errorFor('start') && <span style={styles.error}>{errorFor('start')}</span>}
          </div>
          <div style={styles.field}>
            <label style={styles.label} htmlFor="search-end">
              End
            </label>
            <input
              id="search-end"
              style={styles.input}
              type="time"
              step={300}
              value={endTime}
              aria-invalid={errorFor('end') ? true : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEndTime(event.target.value)}
              onBlur={() => markTouched('end')}
            />
            {errorFor('end') && <span style={styles.error}>{errorFor('end')}</span>}
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="search-seats">
            Minimum seats
          </label>
          <input
            id="search-seats"
            style={styles.seatsInput}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={minSeats}
            aria-invalid={errorFor('minSeats') ? true : undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setMinSeats(event.target.value)}
            onBlur={() => markTouched('minSeats')}
          />
          {errorFor('minSeats') && <span style={styles.error}>{errorFor('minSeats')}</span>}
        </div>

        <div style={styles.field}>
          <label style={styles.label} htmlFor="search-equipment">
            Equipment
          </label>
          <input
            id="search-equipment"
            style={styles.input}
            type="text"
            placeholder="e.g. Beamer, Whiteboard"
            value={equipmentText}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEquipmentText(event.target.value)}
          />
          <span style={styles.hint}>Optional, comma-separated keywords.</span>
        </div>

        <div style={styles.actions}>
          <button type="submit" className="button" style={styles.primaryButton}>
            Search
          </button>
        </div>
      </form>

      <section aria-live="polite">
        {params === null ? (
          <p style={styles.subtitle}>Enter a period and click Search.</p>
        ) : (
          <AsyncState
            loading={loading}
            error={error}
            onRetry={reload}
            loadingLabel="Loading free rooms…"
          >
            {rooms.length === 0 ? (
              <div style={styles.empty}>
                <h2 style={styles.emptyTitle}>No free room for this period</h2>
                <p style={styles.emptyText}>Try a shorter period or fewer seats.</p>
              </div>
            ) : (
              <>
                <h2 style={styles.resultsTitle}>
                  {rooms.length} free {rooms.length === 1 ? 'room' : 'rooms'}
                </h2>
                <div style={styles.roomGrid}>
                  {rooms.map((room) => (
                    <RoomResultCard key={room.id} room={room} />
                  ))}
                </div>
              </>
            )}
          </AsyncState>
        )}
      </section>
    </div>
  )
}

function RoomResultCard({ room }: { room: Room }) {
  return (
    <article style={styles.roomCard}>
      <div style={styles.roomCardHead}>
        <h3 style={styles.roomName}>{room.name}</h3>
        <span style={styles.seatsBadge}>{room.seats} seats</span>
      </div>
      <div style={styles.chips}>
        {room.equipment.length > 0 ? (
          room.equipment.map((keyword) => (
            <span key={keyword} style={styles.chip}>
              {keyword}
            </span>
          ))
        ) : (
          <span style={styles.chipEmpty}>No equipment listed</span>
        )}
      </div>
      <div style={styles.roomCardFoot}>
        <Link className="button button--secondary" to={`/rooms/${room.id}/day`}>
          View day
        </Link>
        <Link className="button" style={styles.primaryButton} to={`/rooms/${room.id}/bookings/new`}>
          Book
        </Link>
      </div>
    </article>
  )
}

const styles: Record<string, CSSProperties> = {
  pageHead: { marginBottom: 'var(--space-5)' },
  subtitle: {
    margin: 'var(--space-1) 0 0',
    color: 'var(--color-muted)',
    fontSize: 'var(--size-small)',
    lineHeight: 'var(--line-small)',
  },
  card: {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: '0 1px 2px rgba(17, 24, 39, 0.05)',
    marginBottom: 'var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  timeRange: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 140px',
    minWidth: 0,
  },
  label: {
    fontSize: 'var(--size-small)',
    fontWeight: 'var(--label-weight)',
    color: 'var(--color-fg-soft)',
    marginBottom: 'var(--space-0)',
  },
  input: {
    height: 44,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-strong)',
    background: 'var(--color-bg)',
    color: 'var(--color-fg)',
    fontSize: 'var(--size-body)',
    fontFamily: 'inherit',
  },
  seatsInput: {
    height: 44,
    width: 96,
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-strong)',
    background: 'var(--color-bg)',
    color: 'var(--color-fg)',
    fontSize: 'var(--size-body)',
    fontFamily: 'inherit',
    fontVariantNumeric: 'tabular-nums',
  },
  error: {
    marginTop: 'var(--space-0)',
    color: 'var(--color-danger)',
    fontSize: 'var(--size-small)',
  },
  hint: {
    marginTop: 'var(--space-0)',
    color: 'var(--color-muted)',
    fontSize: 'var(--size-small)',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 'var(--space-1)',
  },
  primaryButton: {
    background: 'var(--color-accent)',
    border: '1px solid var(--color-accent)',
    color: '#ffffff',
  },
  resultsTitle: {
    margin: '0 0 var(--space-3)',
    fontSize: 'var(--size-h2)',
    lineHeight: 'var(--line-h2)',
    fontWeight: 'var(--heading-weight)',
  },
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 'var(--space-3)',
  },
  roomCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: '20px',
    boxShadow: '0 1px 2px rgba(17, 24, 39, 0.05)',
  },
  roomCardHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 'var(--space-1)',
  },
  roomName: {
    margin: 0,
    fontSize: 'var(--size-h2)',
    lineHeight: 'var(--line-h2)',
    fontWeight: 'var(--heading-weight)',
    color: 'var(--color-fg)',
  },
  seatsBadge: {
    flexShrink: 0,
    background: 'var(--color-surface-strong)',
    color: 'var(--color-fg-soft)',
    borderRadius: 'var(--radius-pill)',
    padding: '2px 10px',
    fontSize: 'var(--size-small)',
    fontWeight: 'var(--label-weight)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  chip: {
    background: 'var(--color-accent-soft)',
    color: 'var(--color-accent-active)',
    borderRadius: 'var(--radius-pill)',
    padding: '0 10px',
    height: 24,
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 'var(--size-caption)',
  },
  chipEmpty: {
    color: 'var(--color-muted)',
    fontSize: 'var(--size-small)',
  },
  roomCardFoot: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-1)',
    marginTop: 'var(--space-0)',
  },
  empty: {
    maxWidth: 420,
    margin: '0 auto',
    padding: 'var(--space-5)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--color-surface)',
    border: '1px dashed var(--color-border-strong)',
    textAlign: 'center',
  },
  emptyTitle: {
    margin: '0 0 var(--space-1)',
    fontSize: 'var(--size-h2)',
    lineHeight: 'var(--line-h2)',
    fontWeight: 'var(--heading-weight)',
  },
  emptyText: {
    margin: 0,
    color: 'var(--color-muted)',
    fontSize: 'var(--size-small)',
    lineHeight: 'var(--line-small)',
  },
}
