import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BookingFormPage from './BookingFormPage'

interface RecordedCall {
  url: string
  method: string
  body: unknown
}

interface MockRoute {
  method: string
  test: (url: string) => boolean
  respond: () => { status: number; body?: unknown }
}

const ALPHA_ROOM = { id: 1, name: 'Alpha', seats: 4, equipment: ['beamer'] }

const FUTURE_BOOKING = {
  id: 5,
  room_id: 1,
  title: 'Team sync',
  booked_by: 'Alice',
  start: '2030-04-14T09:00:00+02:00',
  end: '2030-04-14T10:30:00+02:00',
}

let calls: RecordedCall[] = []
let routes: MockRoute[] = []

function installFetch() {
  calls = []
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method, body })
    const path = pathOf(url)
    const route = routes.find((candidate) => candidate.method === method && candidate.test(path))
    const result = route
      ? route.respond()
      : { status: 500, body: { code: 'http_error', message: 'no mock route', details: null } }
    return {
      ok: result.status >= 200 && result.status < 300,
      status: result.status,
      statusText: String(result.status),
      json: async () => result.body ?? null,
    } as unknown as Response
  })
  vi.stubGlobal('fetch', mock)
}

// The client resolves the configured VITE_API_BASE_URL onto every request, so
// route matching works on the path alone and stays independent of the base.
function pathOf(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname
  } catch {
    return url
  }
}

function renderPage(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/rooms/:roomId/bookings/new" element={<BookingFormPage />} />
        <Route path="/bookings/:bookingId/edit" element={<BookingFormPage />} />
        <Route path="/rooms/:roomId/day" element={<div>Day view stub</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function roomsRoute(): MockRoute {
  return { method: 'GET', test: (url) => url === '/api/rooms', respond: () => ({ status: 200, body: [ALPHA_ROOM] }) }
}

function startTimeCalls(): RecordedCall[] {
  return calls.filter((call) => call.method === 'POST' || call.method === 'PUT')
}

beforeEach(() => {
  installFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BookingFormPage create', () => {
  it('shows no error on an untouched form and blocks a request with missing required fields', async () => {
    routes = [roomsRoute()]
    const user = userEvent.setup()
    renderPage('/rooms/1/bookings/new')

    await screen.findByRole('option', { name: /Alpha/ })

    expect(screen.queryByText('Please enter a title.')).not.toBeInTheDocument()
    expect(screen.queryByText('Please enter who booked the room.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Please enter a title.')).toBeInTheDocument()
    expect(screen.getByText('Please enter who booked the room.')).toBeInTheDocument()
    expect(startTimeCalls()).toHaveLength(0)
  })

  it('blocks an end that is not after the start', async () => {
    routes = [roomsRoute()]
    const user = userEvent.setup()
    renderPage('/rooms/1/bookings/new')
    await screen.findByRole('option', { name: /Alpha/ })

    await user.type(screen.getByLabelText(/Title/), 'Team sync')
    await user.type(screen.getByLabelText(/Booked by/), 'Alice')
    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2030-04-14' } })
    fireEvent.change(screen.getByLabelText(/Start/), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText(/End/), { target: { value: '09:00' } })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('End must be after start')).toBeInTheDocument()
    expect(startTimeCalls()).toHaveLength(0)
  })

  it('blocks a duration over 8 hours', async () => {
    routes = [roomsRoute()]
    const user = userEvent.setup()
    renderPage('/rooms/1/bookings/new')
    await screen.findByRole('option', { name: /Alpha/ })

    await user.type(screen.getByLabelText(/Title/), 'Workshop')
    await user.type(screen.getByLabelText(/Booked by/), 'Alice')
    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2030-04-14' } })
    fireEvent.change(screen.getByLabelText(/Start/), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText(/End/), { target: { value: '18:00' } })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('A booking may last at most 8 hours')).toBeInTheDocument()
    expect(startTimeCalls()).toHaveLength(0)
  })

  it('shows the conflict banner from a 409 and keeps the entered values', async () => {
    routes = [
      roomsRoute(),
      {
        method: 'POST',
        test: (url) => url === '/api/bookings',
        respond: () => ({
          status: 409,
          body: {
            code: 'conflict',
            message: 'The room is already booked in that period.',
            details: {
              conflicting_booking: {
                id: 9,
                title: 'Standup',
                booked_by: 'Bob',
                start: '2030-04-14T07:00:00+00:00',
                end: '2030-04-14T08:30:00+00:00',
              },
            },
          },
        }),
      },
    ]
    const user = userEvent.setup()
    renderPage('/rooms/1/bookings/new')
    await screen.findByRole('option', { name: /Alpha/ })

    await user.type(screen.getByLabelText(/Title/), 'Team sync')
    await user.type(screen.getByLabelText(/Booked by/), 'Alice')
    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2030-04-14' } })
    fireEvent.change(screen.getByLabelText(/Start/), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText(/End/), { target: { value: '10:30' } })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('This period is already taken')
    expect(banner).toHaveTextContent(/Standup/)
    expect(banner).toHaveTextContent(/Bob/)
    expect(banner).toHaveTextContent('09:00–10:30')
    expect(banner).toHaveTextContent('(14.04.2030)')
    expect((screen.getByLabelText(/Title/) as HTMLInputElement).value).toBe('Team sync')
  })

  it('creates a booking and navigates to the room day view', async () => {
    routes = [
      roomsRoute(),
      {
        method: 'POST',
        test: (url) => url === '/api/bookings',
        respond: () => ({ status: 201, body: { ...FUTURE_BOOKING, id: 11 } }),
      },
    ]
    const user = userEvent.setup()
    renderPage('/rooms/1/bookings/new')
    await screen.findByRole('option', { name: /Alpha/ })

    await user.type(screen.getByLabelText(/Title/), 'Team sync')
    await user.type(screen.getByLabelText(/Booked by/), 'Alice')
    fireEvent.change(screen.getByLabelText(/Date/), { target: { value: '2030-04-14' } })
    fireEvent.change(screen.getByLabelText(/Start/), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText(/End/), { target: { value: '10:30' } })

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('Day view stub')).toBeInTheDocument())
    const posted = calls.find((call) => call.method === 'POST')
    expect(posted?.body).toMatchObject({
      room_id: 1,
      title: 'Team sync',
      booked_by: 'Alice',
      start: '2030-04-14T09:00:00+02:00',
      end: '2030-04-14T10:30:00+02:00',
    })
  })
})

describe('BookingFormPage edit', () => {
  it('pre-fills the form from the loaded booking', async () => {
    routes = [
      roomsRoute(),
      {
        method: 'GET',
        test: (url) => url === '/api/bookings/5',
        respond: () => ({ status: 200, body: FUTURE_BOOKING }),
      },
    ]
    renderPage('/bookings/5/edit')

    expect(await screen.findByDisplayValue('Team sync')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Buchung bearbeiten' })).toBeInTheDocument()
    expect((screen.getByLabelText(/Booked by/) as HTMLInputElement).value).toBe('Alice')
    expect((screen.getByLabelText(/Date/) as HTMLInputElement).value).toBe('2030-04-14')
    expect((screen.getByLabelText(/Start/) as HTMLInputElement).value).toBe('09:00')
    expect((screen.getByLabelText(/End/) as HTMLInputElement).value).toBe('10:30')
    expect((screen.getByLabelText(/Room/) as HTMLSelectElement).value).toBe('1')
  })

  it('disables save and delete with an explanation for a booking that has already started', async () => {
    const startedBooking = {
      ...FUTURE_BOOKING,
      id: 7,
      start: '2020-01-01T09:00:00+01:00',
      end: '2020-01-01T10:00:00+01:00',
    }
    routes = [
      roomsRoute(),
      {
        method: 'GET',
        test: (url) => url === '/api/bookings/7',
        respond: () => ({ status: 200, body: startedBooking }),
      },
    ]
    renderPage('/bookings/7/edit')

    const save = await screen.findByRole('button', { name: 'Save' })
    const remove = screen.getByRole('button', { name: 'Delete' })
    expect(save).toBeDisabled()
    expect(remove).toBeDisabled()
    expect(screen.getByText(/already started/i)).toBeInTheDocument()
  })
})
