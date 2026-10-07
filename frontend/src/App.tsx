import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import BookingFormPage from './pages/BookingFormPage'
import RoomDayPage from './pages/RoomDayPage'
import RoomListPage from './pages/RoomListPage'
import RoomSearchPage from './pages/RoomSearchPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/rooms" replace />} />
        <Route path="/rooms" element={<RoomListPage />} />
        <Route path="/rooms/search" element={<RoomSearchPage />} />
        <Route path="/rooms/:roomId/day" element={<RoomDayPage />} />
        <Route path="/rooms/:roomId/bookings/new" element={<BookingFormPage />} />
        <Route path="/bookings/:bookingId/edit" element={<BookingFormPage />} />
        <Route path="*" element={<Navigate to="/rooms" replace />} />
      </Route>
    </Routes>
  )
}
