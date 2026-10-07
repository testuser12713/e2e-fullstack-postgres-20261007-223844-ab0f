import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../api/types'
import RoomListPage from './RoomListPage'

const rooms: Room[] = [
  { id: 1, name: 'Ada', seats: 4, equipment: ['Projector', 'Whiteboard'] },
  { id: 2, name: 'Turing', seats: 10, equipment: ['Video conference'] },
  { id: 3, name: 'Hopper', seats: 6, equipment: ['Projector'] },
]

function responseWith(body: unknown) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body }
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RoomListPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('RoomListPage', () => {
  it('renders every room with its seats and equipment', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWith(rooms)))
    renderPage()

    expect(await screen.findByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Turing')).toBeInTheDocument()
    expect(screen.getByText('Hopper')).toBeInTheDocument()

    const adaCard = screen.getByText('Ada').closest('article') as HTMLElement
    expect(within(adaCard).getByText('4 seats')).toBeInTheDocument()
    expect(within(adaCard).getByText('Projector')).toBeInTheDocument()
    expect(within(adaCard).getByText('Whiteboard')).toBeInTheDocument()

    expect(screen.getByTestId('room-grid')).toBeInTheDocument()
    expect(screen.getByText('3 rooms')).toBeInTheDocument()
  })

  it('links each room to its day view route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWith(rooms)))
    renderPage()

    await screen.findByText('Ada')
    expect(screen.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/rooms/1/day')
  })

  it('narrows the list immediately by equipment keyword', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWith(rooms)))
    renderPage()

    await screen.findByText('Ada')
    await user.click(screen.getByRole('button', { name: 'Projector' }))

    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getByText('Hopper')).toBeInTheDocument()
    expect(screen.queryByText('Turing')).not.toBeInTheDocument()
    expect(screen.getByText('2 of 3 rooms')).toBeInTheDocument()
  })

  it('narrows the list immediately by minimum seats', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWith(rooms)))
    renderPage()

    await screen.findByText('Ada')
    await user.type(screen.getByLabelText('Minimum seats'), '6')

    expect(screen.queryByText('Ada')).not.toBeInTheDocument()
    expect(screen.getByText('Turing')).toBeInTheDocument()
    expect(screen.getByText('Hopper')).toBeInTheDocument()
  })

  it('shows the empty state when no room matches the filters', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseWith(rooms)))
    renderPage()

    await screen.findByText('Ada')
    await user.type(screen.getByLabelText('Minimum seats'), '99')

    expect(
      screen.getByText('No rooms match these filters. Try removing a filter.'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('room-grid')).not.toBeInTheDocument()
  })

  it('shows a loading state while the request is in flight', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined
    const pending = new Promise((resolve) => {
      resolveRequest = resolve
    })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending))
    renderPage()

    expect(screen.getByText('Loading rooms…')).toBeInTheDocument()

    resolveRequest(responseWith(rooms))
    expect(await screen.findByText('Ada')).toBeInTheDocument()
  })

  it('shows an error message with a retry action on failure', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(responseWith(rooms))
    vi.stubGlobal('fetch', fetchMock)
    renderPage()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Ada')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
