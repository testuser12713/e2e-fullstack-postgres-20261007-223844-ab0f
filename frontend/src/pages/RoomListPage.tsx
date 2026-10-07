import { useMemo, useState } from 'react'
import { get } from '../api/client'
import type { Room } from '../api/types'
import AsyncState from '../components/AsyncState'
import RoomCard from '../components/RoomCard'
import RoomFilters from '../components/RoomFilters'
import { useApi } from '../hooks/useApi'
import '../styles/rooms.css'

function roomsLabel(count: number, total: number, filtersActive: boolean): string {
  if (filtersActive) {
    return `${count} of ${total} rooms`
  }
  return `${count} ${count === 1 ? 'room' : 'rooms'}`
}

export default function RoomListPage() {
  const { data, loading, error, reload } = useApi<Room[]>(() => get<Room[]>('/api/rooms'))
  const rooms = useMemo(() => data ?? [], [data])
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [minSeats, setMinSeats] = useState<number | ''>('')

  const equipmentOptions = useMemo(() => {
    const keywords = new Set<string>()
    rooms.forEach((room) => room.equipment.forEach((keyword) => keywords.add(keyword)))
    return Array.from(keywords).sort((a, b) => a.localeCompare(b))
  }, [rooms])

  const filteredRooms = useMemo(
    () =>
      rooms.filter((room) => {
        const matchesEquipment = selectedEquipment.every((keyword) =>
          room.equipment.includes(keyword),
        )
        const matchesSeats = minSeats === '' || room.seats >= minSeats
        return matchesEquipment && matchesSeats
      }),
    [rooms, selectedEquipment, minSeats],
  )

  const filtersActive = selectedEquipment.length > 0 || minSeats !== ''

  function toggleEquipment(keyword: string) {
    setSelectedEquipment((current) =>
      current.includes(keyword) ? current.filter((item) => item !== keyword) : [...current, keyword],
    )
  }

  function clearFilters() {
    setSelectedEquipment([])
    setMinSeats('')
  }

  return (
    <section className="rooms-screen" data-testid="rooms-screen">
      <div className="page-head" data-testid="rooms-head">
        <h1 className="page-title" aria-label="Rooms">
          Räume
        </h1>
        <p className="page-subtitle">All bookable rooms with equipment and seats.</p>
      </div>

      <AsyncState
        loading={loading}
        error={error}
        onRetry={reload}
        loadingLabel="Loading rooms…"
      >
        <RoomFilters
          equipmentOptions={equipmentOptions}
          selectedEquipment={selectedEquipment}
          onToggleEquipment={toggleEquipment}
          minSeats={minSeats}
          onMinSeatsChange={setMinSeats}
          onClear={clearFilters}
          filtersActive={filtersActive}
        />

        <p className="rooms-count" role="status" aria-live="polite" data-testid="rooms-count">
          {roomsLabel(filteredRooms.length, rooms.length, filtersActive)}
        </p>

        {filteredRooms.length === 0 ? (
          <div className="empty-state" role="status" data-testid="rooms-empty">
            <svg
              className="empty-icon"
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
            <p className="empty-title">No rooms match these filters. Try removing a filter.</p>
            <div className="empty-action">
              <button
                type="button"
                className="button button--secondary button--sm"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <div className="room-grid" data-testid="room-grid">
            {filteredRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </AsyncState>
    </section>
  )
}
