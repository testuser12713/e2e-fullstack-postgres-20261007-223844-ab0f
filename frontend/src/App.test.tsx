import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as unknown as Response
}

function renderApp(initialEntry = '/rooms') {
  return render(
    <MemoryRouter
      initialEntries={[initialEntry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  // A pending health request keeps the shell inert while navigation is asserted.
  fetchMock.mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App shell navigation', () => {
  it('renders the navigation chrome on the default route', () => {
    renderApp('/rooms')
    const nav = screen.getByRole('navigation', { name: /main navigation/i })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Rooms' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Day view' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Free rooms' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
  })

  it('redirects the root route to the room list', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
  })

  it('switches to the free-room search page', async () => {
    const user = userEvent.setup()
    renderApp('/rooms')
    await user.click(screen.getByRole('link', { name: 'Free rooms' }))
    expect(screen.getByRole('heading', { name: 'Free rooms' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('switches to the day view page', async () => {
    const user = userEvent.setup()
    renderApp('/rooms')
    await user.click(screen.getByRole('link', { name: 'Day view' }))
    expect(screen.getByRole('heading', { name: 'Day view' })).toBeInTheDocument()
  })

  it('switches back to the room list page', async () => {
    const user = userEvent.setup()
    renderApp('/rooms/search')
    await user.click(screen.getByRole('link', { name: 'Rooms' }))
    expect(screen.getByRole('heading', { name: 'Rooms' })).toBeInTheDocument()
  })

  it('renders the booking form route inside the shell', () => {
    renderApp('/rooms/1/bookings/new')
    expect(screen.getByRole('heading', { name: 'Booking' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})

describe('App shell health indicator', () => {
  it('shows a healthy API pill when /api/health reports a reachable database', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'ok', database: 'ok' }))
    renderApp('/rooms')
    const pill = await screen.findByText('API ok')
    expect(pill).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/health'), expect.anything())
  })

  it('shows the database as unreachable when health reports it', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'degraded', database: 'unreachable' }))
    renderApp('/rooms')
    expect(await screen.findByText('Database unreachable')).toBeInTheDocument()
  })

  it('shows the API as offline when the health request fails', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'))
    renderApp('/rooms')
    expect(await screen.findByText('API offline')).toBeInTheDocument()
  })
})
