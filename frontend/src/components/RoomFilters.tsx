export interface RoomFiltersProps {
  equipmentOptions: string[]
  selectedEquipment: string[]
  onToggleEquipment: (keyword: string) => void
  minSeats: number | ''
  onMinSeatsChange: (value: number | '') => void
  onClear: () => void
  filtersActive: boolean
}

export default function RoomFilters({
  equipmentOptions,
  selectedEquipment,
  onToggleEquipment,
  minSeats,
  onMinSeatsChange,
  onClear,
  filtersActive,
}: RoomFiltersProps) {
  return (
    <section className="rooms-filter" data-testid="rooms-filter">
      <div
        className="filter-row"
        data-testid="rooms-filters"
        role="group"
        aria-label="Filter by equipment and minimum seats"
      >
        {equipmentOptions.map((keyword) => {
          const selected = selectedEquipment.includes(keyword)
          return (
            <button
              key={keyword}
              type="button"
              className={selected ? 'filter-chip is-selected' : 'filter-chip'}
              aria-pressed={selected}
              onClick={() => onToggleEquipment(keyword)}
            >
              {selected && (
                <span className="chip-check" aria-hidden="true">
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

        <div className="seats-filter">
          <label className="seats-label" htmlFor="min-seats">
            Minimum seats
          </label>
          <input
            id="min-seats"
            className="input num"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="—"
            value={minSeats === '' ? '' : minSeats}
            onChange={(event) => {
              const raw = event.target.value
              if (raw === '') {
                onMinSeatsChange('')
                return
              }
              const parsed = Number(raw)
              onMinSeatsChange(Number.isNaN(parsed) ? '' : parsed)
            }}
          />
          {minSeats !== '' && (
            <span className="seats-readout">
              ≥ {minSeats} {minSeats === 1 ? 'seat' : 'seats'}
            </span>
          )}
        </div>

        {filtersActive && (
          <button type="button" className="button button--ghost button--sm" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    </section>
  )
}
