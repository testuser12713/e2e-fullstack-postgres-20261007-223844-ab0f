import { useState, type ChangeEvent, type FormEvent } from 'react'
import AsyncState from '../components/AsyncState'
import { get } from '../api/client'
import type { Room } from '../api/types'
import { useApi } from '../hooks/useApi'
import './RoomSearchPage.css'

interface SearchParams {
  start: string
  end: string
  minSeats: number
  equipment: string[]
}

type FieldKey = 'date' | 'start' | 'end' | 'minSeats'

function toIsoDateTime(date: string, time: string): string {
  if (!date || !time) return ''
  const value = new Date(`${date}T${time}:00`)
  return Number.isNaN(value.getTime()) ? '' : value.toISOString()
}

async function fetchAvailableRooms(params: SearchParams): Promise<Room[]> {
  const query = new URLSearchParams()
  query.set('start', params.start)
  query.set('end', params.end)
  // The endpoint requires min_seats: it is always sent. An empty seat field
  // means "no minimum", expressed as 0, never an incomplete request.
  query.set('min_seats', String(params.minSeats))
  for (const keyword of params.equipment) {
    query.append('equipment', keyword)
  }
  return get<Room[]>(`/api/rooms/available?${query.toString()}`)
}

function uniqueEquipment(rooms: Room[]): string[] {
  const keywords = new Set<string>()
  rooms.forEach((room) => room.equipment.forEach((keyword) => keywords.add(keyword)))
  return Array.from(keywords).sort((a, b) => a.localeCompare(b))
}

export default function RoomSearchPage() {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [minSeats, setMinSeats] = useState('')
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [params, setParams] = useState<SearchParams | null>(null)

  // The equipment keywords offered as filter chips mirror the room list: they
  // are the union of every room's equipment, loaded from the room catalogue.
  const catalogue = useApi<Room[]>(() => get<Room[]>('/api/rooms'))
  const equipmentOptions = uniqueEquipment(catalogue.data ?? [])

  const { data, loading, error, reload } = useApi<Room[]>(
    () => (params ? fetchAvailableRooms(params) : Promise.resolve([])),
    [params],
  )

  function markTouched(field: FieldKey) {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }))
  }

  function errorFor(field: FieldKey): string | undefined {
    // AC-22: no error state before the field is touched or a submit happened.
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
      minSeats: seatsValue === '' ? 0 : Number.parseInt(seatsValue, 10),
      equipment: selectedEquipment,
    })
  }

  function toggleEquipment(keyword: string) {
    setSelectedEquipment((current) =>
      current.includes(keyword)
        ? current.filter((item) => item !== keyword)
        : [...current, keyword],
    )
  }

  function clearEquipment() {
    setSelectedEquipment([])
  }

  const rooms = data ?? []

  return (
    <section className="search-screen">
      <div className="search-screen__head">
        <h1 className="page-title">Free rooms</h1>
        <p className="search-screen__subtitle">
          Enter a period and a minimum number of seats to find available rooms.
        </p>
      </div>

      <form className="search-card" onSubmit={handleSubmit} noValidate>
        <div className="search-time-range">
          <div className="search-field">
            <label className="search-label" htmlFor="search-date">
              Date
            </label>
            <input
              id="search-date"
              className="search-input"
              type="date"
              value={date}
              aria-invalid={errorFor('date') ? true : undefined}
              aria-describedby={errorFor('date') ? 'search-date-error' : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setDate(event.target.value)}
              onBlur={() => markTouched('date')}
            />
            {errorFor('date') && (
              <span id="search-date-error" className="search-error">
                {errorFor('date')}
              </span>
            )}
          </div>
          <div className="search-field">
            <label className="search-label" htmlFor="search-start">
              Start
            </label>
            <input
              id="search-start"
              className="search-input"
              type="time"
              step={300}
              value={startTime}
              aria-invalid={errorFor('start') ? true : undefined}
              aria-describedby={errorFor('start') ? 'search-start-error' : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setStartTime(event.target.value)}
              onBlur={() => markTouched('start')}
            />
            {errorFor('start') && (
              <span id="search-start-error" className="search-error">
                {errorFor('start')}
              </span>
            )}
          </div>
          <div className="search-field">
            <label className="search-label" htmlFor="search-end">
              End
            </label>
            <input
              id="search-end"
              className="search-input"
              type="time"
              step={300}
              value={endTime}
              aria-invalid={errorFor('end') ? true : undefined}
              aria-describedby={errorFor('end') ? 'search-end-error' : undefined}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setEndTime(event.target.value)}
              onBlur={() => markTouched('end')}
            />
            {errorFor('end') && (
              <span id="search-end-error" className="search-error">
                {errorFor('end')}
              </span>
            )}
          </div>
        </div>

        <div className="search-field">
          <label className="search-label" htmlFor="search-seats">
            Minimum seats
          </label>
          <input
            id="search-seats"
            className="search-input search-input--seats"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={minSeats}
            aria-invalid={errorFor('minSeats') ? true : undefined}
            aria-describedby={errorFor('minSeats') ? 'search-seats-error' : undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setMinSeats(event.target.value)}
            onBlur={() => markTouched('minSeats')}
          />
          {errorFor('minSeats') && (
            <span id="search-seats-error" className="search-error">
              {errorFor('minSeats')}
            </span>
          )}
        </div>

        <div className="search-field">
          <span className="search-label" id="search-equipment-label">
            Equipment
          </span>
          {catalogue.loading ? (
            <p className="search-hint" role="status">
              Loading equipment keywords…
            </p>
          ) : catalogue.error ? (
            <div className="search-inline-error" role="alert">
              <span>{catalogue.error.message || 'Could not load equipment keywords.'}</span>
              <button
                type="button"
                className="button button--secondary"
                onClick={catalogue.reload}
              >
                Retry
              </button>
            </div>
          ) : equipmentOptions.length === 0 ? (
            <p className="search-hint">No equipment keywords available.</p>
          ) : (
            <div
              className="search-equip-group"
              role="group"
              aria-labelledby="search-equipment-label"
            >
              {equipmentOptions.map((keyword) => {
                const selected = selectedEquipment.includes(keyword)
                return (
                  <button
                    key={keyword}
                    type="button"
                    className="search-chip"
                    aria-pressed={selected}
                    onClick={() => toggleEquipment(keyword)}
                  >
                    {selected && (
                      <span className="search-chip__check" aria-hidden="true">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 8l3 3 7-7" />
                        </svg>
                      </span>
                    )}
                    {keyword}
                  </button>
                )
              })}
              {selectedEquipment.length > 0 && (
                <button type="button" className="button search-ghost" onClick={clearEquipment}>
                  Clear equipment
                </button>
              )}
            </div>
          )}
        </div>

        <div className="search-card__actions">
          <button type="submit" className="button search-primary">
            Search
          </button>
        </div>
      </form>

      <section className="search-results" aria-live="polite">
        {params === null ? (
          <p className="search-hint">Choose a date and times, then select Search.</p>
        ) : (
          <AsyncState
            loading={loading}
            error={error}
            onRetry={reload}
            loadingLabel="Loading free rooms…"
          >
            {rooms.length === 0 ? (
              <div className="search-empty" role="status">
                <svg
                  className="search-empty__icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <p className="search-empty__title">
                  No free room for this period. Try a shorter period or fewer seats.
                </p>
              </div>
            ) : (
              <>
                <h2 className="search-results__title">
                  {rooms.length} free {rooms.length === 1 ? 'room' : 'rooms'}
                </h2>
                <div className="search-room-grid">
                  {rooms.map((room) => (
                    <RoomSummary key={room.id} room={room} />
                  ))}
                </div>
              </>
            )}
          </AsyncState>
        )}
      </section>
    </section>
  )
}

function RoomSummary({ room }: { room: Room }) {
  return (
    <article className="search-room-card">
      <div className="search-room-card__head">
        <h3 className="search-room-card__name">{room.name}</h3>
        <span className="search-seats-badge">{room.seats} seats</span>
      </div>
      <div className="search-equip-chips">
        {room.equipment.length > 0 ? (
          room.equipment.map((keyword) => (
            <span key={keyword} className="search-equip-chip">
              {keyword}
            </span>
          ))
        ) : (
          <span className="search-equip-empty">No equipment listed</span>
        )}
      </div>
    </article>
  )
}
