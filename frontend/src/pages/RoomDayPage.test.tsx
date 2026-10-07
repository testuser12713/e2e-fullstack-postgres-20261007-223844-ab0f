import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { del, get } from '../api/client'
import type { Booking, Room } from '../api/types'
import RoomDayPage from './RoomDayPage'

vi.mock('../api/client', () => ({
  get: vi.fn(),
  del: vi.fn(),
}))

const getMock = get as unknown as Mock
const delMock = del as unknown as Mock

const rooms: Room[] = [
  { id: 1, name: 'Conference North', seats: 8, equipment: ['projector'] },
  { id: 2, name: 'Meeting Central', seats: 4, equipment: [] },
]

let bookingsResponse: Booking[] = []

function makeBooking(overrides: Partial<Booking>): Booking {
  return {
    id: 1,
    room_id: 1,
    title: 'Booking',
    booked_by: 'Anna Schmidt',
    start: '2026-04-14T09:00:00+02:00',
    end: '2026-04-14T10:00:00+02:00',
    ...overrides,
  }
}

const fixedNow = new Date('2026-04-14T08:00:00+02:00')

function renderPage(
  initialEntry = '/rooms/1/day?date=2026-04-14',
  now: Date = fixedNow,
): ReturnType<typeof render> {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/rooms/:roomId/day" element={<RoomDayPage now={now} />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  bookingsResponse = []
  delMock.mockResolvedValue(undefined)
  getMock.mockImplementation((path: string) => {
    if (path === '/api/rooms') return Promise.resolve(rooms)
    if (/^\/api\/rooms\/\d+\/bookings\?date=\d{4}-\d{2}-\d{2}$/.test(path)) {
      return Promise.resolve(bookingsResponse)
    }
    return Promise.reject(new Error(`Unexpected request: ${path}`))
  })
})

describe('RoomDayPage', () => {
  it('lists the bookings of the day chronologically with time range and duration', async () => {
    bookingsResponse = [
      makeBooking({
        id: 3,
        title: 'Product planning',
        booked_by: 'Laura Hoffmann',
        start: '2026-04-14T13:30:00+02:00',
        end: '2026-04-14T15:00:00+02:00',
      }),
      makeBooking({
        id: 1,
        title: 'Stand-up',
        booked_by: 'Anna Schmidt',
        start: '2026-04-14T09:00:00+02:00',
        end: '2026-04-14T10:30:00+02:00',
      }),
      makeBooking({
        id: 2,
        title: 'Budget review',
        booked_by: 'Markus Weber',
        start: '2026-04-14T11:00:00+02:00',
        end: '2026-04-14T12:00:00+02:00',
      }),
    ]

    renderPage()

    const titles = await screen.findAllByTestId('booking-item-title')
    expect(titles.map((node) => node.textContent)).toEqual([
      'Stand-up',
      'Budget review',
      'Product planning',
    ])

    const rows = screen.getAllByTestId('booking-item')
    expect(within(rows[0]).getByText('09:00–10:30')).toBeInTheDocument()
    expect(within(rows[0]).getByText('1 h 30 min')).toBeInTheDocument()
    expect(within(rows[0]).getByText('booked by Anna Schmidt')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bookings — 14.04.2026' })).toBeInTheDocument()
  })

  it('reloads the view when moving one day forward and back', async () => {
    const user = userEvent.setup()
    renderPage('/rooms/1/day?date=2026-04-14')

    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('/api/rooms/1/bookings?date=2026-04-14'),
    )

    await user.click(screen.getByRole('button', { name: 'Next day' }))
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('/api/rooms/1/bookings?date=2026-04-15'),
    )
    expect(screen.getByLabelText('Booking date')).toHaveValue('2026-04-15')
    expect(screen.getByRole('heading', { name: 'Bookings — 15.04.2026' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous day' }))
    await waitFor(() =>
      expect(getMock).toHaveBeenCalledWith('/api/rooms/1/bookings?date=2026-04-14'),
    )
    expect(screen.getByLabelText('Booking date')).toHaveValue('2026-04-14')
    expect(screen.getByRole('heading', { name: 'Bookings — 14.04.2026' })).toBeInTheDocument()
  })

  it('shows a clear empty state for a day without bookings', async () => {
    bookingsResponse = []
    renderPage('/rooms/1/day?date=2026-04-14')

    expect(
      await screen.findByText('No bookings for Conference North on 14.04.2026.'),
    ).toBeInTheDocument()
    expect(screen.queryAllByTestId('booking-item')).toHaveLength(0)
  })

  it('offers a new-booking link and a per-booking edit link for future bookings', async () => {
    bookingsResponse = [
      makeBooking({
        id: 5,
        start: '2026-12-01T09:00:00+01:00',
        end: '2026-12-01T10:00:00+01:00',
      }),
    ]

    renderPage('/rooms/1/day?date=2026-12-01', new Date('2026-10-07T10:00:00+02:00'))

    const newBooking = await screen.findByRole('link', { name: 'New booking' })
    expect(newBooking).toHaveAttribute('href', '/rooms/1/bookings/new')
    const editLink = await screen.findByRole('link', { name: 'Edit' })
    expect(editLink).toHaveAttribute('href', '/bookings/5/edit')
  })

  it('replaces the edit and delete controls with a started badge for started bookings', async () => {
    bookingsResponse = [
      makeBooking({
        id: 7,
        start: '2026-04-14T09:00:00+02:00',
        end: '2026-04-14T10:00:00+02:00',
      }),
    ]

    renderPage('/rooms/1/day?date=2026-04-14', new Date('2026-04-14T09:30:00+02:00'))

    expect(await screen.findByText('Started')).toBeInTheDocument()
    expect(screen.getByText('Started bookings can no longer be changed')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('asks for confirmation before deleting a booking', async () => {
    bookingsResponse = [
      makeBooking({
        id: 5,
        title: 'Budget review',
        start: '2026-12-01T09:00:00+01:00',
        end: '2026-12-01T10:00:00+01:00',
      }),
    ]
    const user = userEvent.setup()
    renderPage('/rooms/1/day?date=2026-12-01', new Date('2026-10-07T10:00:00+02:00'))

    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Delete booking' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(delMock).toHaveBeenCalledWith('/api/bookings/5'))
  })
})
