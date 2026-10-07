import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type Room } from '../api/types'
import RoomSearchPage from './RoomSearchPage'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('../api/client', () => ({
  get: getMock,
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}))

const rooms: Room[] = [
  { id: 1, name: 'Conference North', seats: 8, equipment: ['Projector', 'Whiteboard'] },
  { id: 2, name: 'Focus Room A', seats: 2, equipment: [] },
]

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

describe('RoomSearchPage', () => {
  beforeEach(() => {
    getMock.mockReset()
  })

  it('lists the rooms matching the entered period and minimum seats', async () => {
    getMock.mockResolvedValue(rooms)
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Free rooms' })).toBeInTheDocument()

    fillPeriod()
    fireEvent.change(screen.getByLabelText('Minimum seats'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Equipment'), { target: { value: 'Projector' } })
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Conference North')).toBeInTheDocument()
    expect(screen.getByText('8 seats')).toBeInTheDocument()
    expect(screen.getByText('Projector')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2 free rooms' })).toBeInTheDocument()

    const requestedUrl = getMock.mock.calls[0][0] as string
    expect(requestedUrl).toContain('/api/rooms/available?')
    expect(requestedUrl).toContain('min_seats=4')
    expect(requestedUrl).toContain('equipment=Projector')
  })

  it('shows the empty message when no room matches', async () => {
    getMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderPage()

    fillPeriod()
    fireEvent.change(screen.getByLabelText('Minimum seats'), { target: { value: '6' } })
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('No free room for this period')).toBeInTheDocument()
    expect(screen.getByText('Try a shorter period or fewer seats.')).toBeInTheDocument()
    expect(getMock.mock.calls[0][0] as string).toContain('min_seats=6')
  })

  it('always sends min_seats, defaulting to 1 when the field is empty', async () => {
    getMock.mockResolvedValue(rooms)
    const user = userEvent.setup()
    renderPage()

    fillPeriod()
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Conference North')).toBeInTheDocument()
    expect(getMock.mock.calls[0][0] as string).toContain('min_seats=1')
  })

  it('shows an error with retry and retries the search', async () => {
    getMock.mockRejectedValueOnce(new ApiError('network_error', 'Network request failed', null, 0))
    getMock.mockResolvedValueOnce(rooms)
    const user = userEvent.setup()
    renderPage()

    fillPeriod()
    fireEvent.change(screen.getByLabelText('Minimum seats'), { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('Network request failed')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Retry' })

    await user.click(retry)

    expect(await screen.findByText('Conference North')).toBeInTheDocument()
    await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    expect(getMock.mock.calls[1][0] as string).toContain('min_seats=2')
  })
})
