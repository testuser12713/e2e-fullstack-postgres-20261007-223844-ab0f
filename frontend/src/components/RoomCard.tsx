import { Link } from 'react-router-dom'
import type { Room } from '../api/types'

export interface RoomCardProps {
  room: Room
}

function SeatIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  )
}

export default function RoomCard({ room }: RoomCardProps) {
  const dayPath = `/rooms/${room.id}/day`
  const bookPath = `/rooms/${room.id}/bookings/new`

  return (
    <article className="room-card" data-testid="room-card">
      <div className="room-card-head">
        <h2 className="room-card-name">
          <Link className="room-card-name-link" to={dayPath}>
            {room.name}
          </Link>
        </h2>
        <span className="seats-badge">
          <SeatIcon />
          {room.seats} seats
        </span>
      </div>
      <div className="equip-chips">
        {room.equipment.length > 0 ? (
          room.equipment.map((keyword) => (
            <span className="equip-chip" key={keyword}>
              {keyword}
            </span>
          ))
        ) : (
          <span className="equip-empty">No equipment listed</span>
        )}
      </div>
      <div className="room-card-foot">
        <Link className="button button--secondary button--sm" to={dayPath}>
          View day
        </Link>
        <Link className="button button--primary button--sm" to={bookPath}>
          Book
        </Link>
      </div>
    </article>
  )
}
