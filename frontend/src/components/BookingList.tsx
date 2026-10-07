import { Link } from 'react-router-dom'
import type { Booking } from '../api/types'
import { formatDuration, formatTimeRange, isInProgress, isStarted } from '../lib/datetime'

export interface BookingListProps {
  bookings: Booking[]
  now: Date
  onDelete: (booking: Booking) => void
}

/** Ascending by start time. */
export function sortBookings(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/**
 * Chronological list of a room's bookings. Future bookings offer Edit/Delete;
 * bookings that have already started show a "Started" badge and a note instead.
 */
export default function BookingList({ bookings, now, onDelete }: BookingListProps) {
  const ordered = sortBookings(bookings)

  return (
    <ul className="booking-list">
      {ordered.map((booking) => {
        const started = isStarted(booking.start, now)
        const inProgress = isInProgress(booking.start, booking.end, now)
        return (
          <li
            key={booking.id}
            className={inProgress ? 'booking-item booking-item--in-progress' : 'booking-item'}
            data-testid="booking-item"
          >
            <div className="booking-item__time">
              <span className="booking-item__range">
                {formatTimeRange(booking.start, booking.end)}
              </span>
              <span className="booking-item__duration">
                {formatDuration(booking.start, booking.end)}
              </span>
            </div>
            <div className="booking-item__main">
              <span className="booking-item__title" data-testid="booking-item-title">
                {booking.title}
              </span>
              <span className="booking-item__by">booked by {booking.booked_by}</span>
            </div>
            <div className="booking-item__actions">
              {started ? (
                <>
                  <span className="started-pill">Started</span>
                  <span className="booking-item__note">
                    Started bookings can no longer be changed
                  </span>
                </>
              ) : (
                <>
                  <Link
                    className="button button--secondary button--sm"
                    to={`/bookings/${booking.id}/edit`}
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    className="button button--danger button--sm"
                    onClick={() => onDelete(booking)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
