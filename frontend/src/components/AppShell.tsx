import { NavLink, Outlet } from 'react-router-dom'
import HealthIndicator from './HealthIndicator'

function tabClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'nav-tabs__link nav-tabs__link--active' : 'nav-tabs__link'
}

export default function AppShell() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__inner">
          <span className="app-brand">Room Booking</span>
          <nav className="nav-tabs" aria-label="Main navigation">
            <NavLink to="/rooms" end className={tabClass}>
              Rooms
            </NavLink>
            <NavLink to="/rooms/1/day" className={tabClass}>
              Day view
            </NavLink>
            <NavLink to="/rooms/search" className={tabClass}>
              Free rooms
            </NavLink>
          </nav>
          <HealthIndicator />
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
