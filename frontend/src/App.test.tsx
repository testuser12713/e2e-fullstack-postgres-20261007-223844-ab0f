import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

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
    expect(screen.getByRole('heading', { name: 'Neue Buchung' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})
