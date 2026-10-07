import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../api/types'
import RoomSearchPage from './RoomSearchPage'

const catalogue: Room[] = [
  { id: 1, name: 'Conference North', seats: 8, equipment: ['Projector', 'Whiteboard'] },
  { id: 2, name: 'Focus Room A', seats: 2, equipment: [] },
  { id: 3, name: 'Studio', seats: 12, equipment: ['Projector'] },
]

const available: Room[] = [
  { id: 1, name: 'Conference North', seats: 8, equipment: ['Projector', 'Whiteboard'] },
  { id: 2, name: 'Focus Room A', seats: 2, equipment: [] },
]

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response
}

function installFetch(availableImpl: () => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/rooms/available')) return availableImpl()
    if (url.includes('/api/rooms')) return Promise.resolve(jsonResponse(catalogue))
    return Promise.reject(new Error(`unexpected request ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function availableRequestUrl(fetchMock: ReturnType<typeof vi.fn>): string {
  const found = fetchMock.mock.calls
    .map((call) => String(call[0]))
    .find((url) => url.includes('/api/rooms/available'))
  expect(found).toBeDefined()
  return found as string
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RoomSearchPage />
    </MemoryRouter>,
  )
}

function fillPeriod() {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-04-14' } })
  fireEvent.change(screen.getByLabelText('Start'), { target: { value: '09:00' } })
  fireEvent.change(screen.getByLabelText('End'), { target: { value: '10:30' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RoomSearchPage', () => {
  it('renders the page heading before any search is submitted', () => {
    installFetch(() => Promise.resolve(jsonResponse(available)))
    renderPage()

    expect(screen.getByRole('heading', { name: 'Free rooms' })).toBeInTheDocument()
  })

  it('lists the rooms matching the entered period, seats and equipment', async () => {
    const fetchMock = installFetch(() => Promise.resolve(jsonResponse(available)))
    const user = userEvent.setup()
    renderPage()

    await screen.findByRole('button', { name: 'Projector' })

    fillPeriod()
    fireEvent.change(screen.getByLabelText('Minimum seats'), { target: { value: '4' } })
    await user.click(screen.getByRole('button', { name: 'Projector' }))
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Conference North')).toBeInTheDocument()
    const card = screen.getByText('Conference North').closest('article') as HTMLElement
    expect(within(card).getByText('8 seats')).toBeInTheDocument()
    expect(within(card).getByText('Projector')).toBeInTheDocument()
    expect(within(card).getByText('Whiteboard')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2 free rooms' })).toBeInTheDocument()

    const url = availableRequestUrl(fetchMock)
    expect(url).toContain('/api/rooms/available?')
    expect(url).toContain('start=')
    expect(url).toContain('end=')
    expect(url).toContain('min_seats=4')
    expect(url).toContain('equipment=Projector')
  })

  it('reads "No equipment listed" for a room without equipment', async () => {
    installFetch(() => Promise.resolve(jsonResponse(available)))
    const user = userEvent.setup()
    renderPage()

    fillPeriod()
    await user.click(screen.getByRole('button', { name: 'Search' }))

    const card = (await screen.findByText('Focus Room A')).closest('article') as HTMLElement
    expect(within(card).getByText('No equipment listed')).toBeInTheDocument()
  })

  it('always sends min_seats, using 0 when the seat field is empty', async () => {
    const fetchMock = installFetch(() => Promise.resolve(jsonResponse(available)))
    const user = userEvent.setup()
    renderPage()

    fillPeriod()
    await user.click(screen.getByRole('button', { name: 'Search' }))

    await screen.findByText('Conference North')
    expect(availableRequestUrl(fetchMock)).toContain('min_seats=0')
  })

  it('shows the English empty message when no room matches', async () => {
    installFetch(() => Promise.resolve(jsonResponse([])))
    const user = userEvent.setup()
    renderPage()

    fillPeriod()
    fireEvent.change(screen.getByLabelText('Minimum seats'), { target: { value: '99' } })
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(
      await screen.findByText(
        'No free room for this period. Try a shorter period or fewer seats.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the error with a retry that re-runs the search', async () => {
    let firstAvailabilityCall = true
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/rooms/available')) {
        if (firstAvailabilityCall) {
          firstAvailabilityCall = false
          return Promise.reject(new Error('network down'))
        }
        return Promise.resolve(jsonResponse(available))
      }
      return Promise.resolve(jsonResponse(catalogue))
    })
    vi.stubGlobal('fetch', fetchMock)
    const user = userEvent.setup()
    renderPage()

    fillPeriod()
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('network down')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Conference North')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter((call) => String(call[0]).includes('/api/rooms/available')),
    ).toHaveLength(2)
  })

  it('keeps an untouched form free of validation errors (AC-22)', async () => {
    installFetch(() => Promise.resolve(jsonResponse(available)))
    renderPage()

    expect(screen.queryByText('Please choose a date.')).not.toBeInTheDocument()
    expect(screen.queryByText('Please choose a start time.')).not.toBeInTheDocument()
    expect(screen.queryByText('Please choose an end time.')).not.toBeInTheDocument()
  })
})
