import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { del, get } from '../api/client'
import { ApiError, type Booking, type Room } from '../api/types'
import AsyncState from '../components/AsyncState'
import BookingList from '../components/BookingList'
import { useApi } from '../hooks/useApi'
import { formatDisplayDate, formatTimeRange, isIsoDate, shiftIsoDate, todayIso } from '../lib/datetime'
import './RoomDayPage.css'

export interface RoomDayPageProps {
  now?: Date
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export default function RoomDayPage({ now = new Date() }: RoomDayPageProps) {
  const { roomId } = useParams<{ roomId: string }>()
  const numericRoomId = Number(roomId)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = todayIso(now)
  const dateParam = searchParams.get('date')
  const date = isIsoDate(dateParam) ? dateParam : today

  const [pendingDelete, setPendingDelete] = useState<Booking | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const rooms = useApi<Room[]>(() => get<Room[]>('/api/rooms'), [])
  const bookings = useApi<Booking[]>(
    () => get<Booking[]>(`/api/rooms/${numericRoomId}/bookings?date=${date}`),
    [numericRoomId, date],
  )

  const roomList = rooms.data ?? []
  const roomName =
    roomList.find((room) => room.id === numericRoomId)?.name ?? `Room ${roomId ?? ''}`.trim()

  useEffect(() => {
    if (!pendingDelete) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPendingDelete(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pendingDelete])

  function goToDate(next: string) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      params.set('date', next)
      return params
    })
  }

  function changeRoom(nextRoomId: string) {
    if (!nextRoomId) return
    navigate(`/rooms/${nextRoomId}/day?date=${date}`)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await del(`/api/bookings/${pendingDelete.id}`)
      setPendingDelete(null)
      bookings.reload()
    } catch (cause) {
      setPendingDelete(null)
      setDeleteError(cause instanceof ApiError ? cause.message : 'Could not delete the booking.')
    } finally {
      setDeleting(false)
    }
  }

  const displayDate = formatDisplayDate(date)
  const bookingItems = bookings.data ?? []

  return (
    <div className="day-page">
      <div className="day-head">
        <h1 className="page-title">Day view</h1>
        <p className="day-head__subtitle">Bookings for one room on one day.</p>
      </div>

      <AsyncState
        loading={rooms.loading}
        error={rooms.error}
        onRetry={rooms.reload}
        loadingLabel="Loading rooms…"
      >
        <div className="day-controls">
          <div className="day-controls__room">
            <label className="field-label" htmlFor="room-select">
              Room
            </label>
            <select
              id="room-select"
              className="select"
              value={Number.isFinite(numericRoomId) ? String(numericRoomId) : ''}
              onChange={(event) => changeRoom(event.target.value)}
            >
              {roomList.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <div className="date-nav">
            <button
              type="button"
              className="icon-btn"
              aria-label="Previous day"
              onClick={() => goToDate(shiftIsoDate(date, -1))}
            >
              <ChevronLeft />
            </button>
            <input
              className="input num"
              type="date"
              aria-label="Booking date"
              value={date}
              onChange={(event) => {
                if (event.target.value) goToDate(event.target.value)
              }}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Next day"
              onClick={() => goToDate(shiftIsoDate(date, 1))}
            >
              <ChevronRight />
            </button>
            <button
              type="button"
              className="button button--ghost button--sm"
              disabled={date === today}
              onClick={() => goToDate(today)}
            >
              Today
            </button>
          </div>
        </div>

        <div className="day-layout">
          <section aria-labelledby="bookings-heading">
            <div className="card day-bookings__head">
              <h2 id="bookings-heading">Bookings — {displayDate}</h2>
              <Link
                className="button button--primary button--sm"
                to={`/rooms/${roomId}/bookings/new`}
              >
                New booking
              </Link>
            </div>

            {deleteError && (
              <div className="error-banner" role="alert">
                <span className="error-banner__message">{deleteError}</span>
              </div>
            )}

            <AsyncState
              loading={bookings.loading}
              error={bookings.error}
              onRetry={bookings.reload}
              loadingLabel="Loading bookings…"
            >
              {bookingItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-title">No bookings</div>
                  <p className="empty-text">
                    No bookings for {roomName} on {displayDate}.
                  </p>
                </div>
              ) : (
                <BookingList bookings={bookingItems} now={now} onDelete={setPendingDelete} />
              )}
            </AsyncState>
          </section>

          <aside className="card day-hint" aria-label="Notes">
            <h2>Notes</h2>
            <p className="muted">
              Bookings that have already started can no longer be changed. A blue border marks the
              booking currently in progress.
            </p>
          </aside>
        </div>
      </AsyncState>

      {pendingDelete && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="dialog">
            <h2 id="delete-dialog-title">Delete booking</h2>
            <p>
              Delete “{pendingDelete.title}” (
              {formatTimeRange(pendingDelete.start, pendingDelete.end)}, {displayDate})?
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
