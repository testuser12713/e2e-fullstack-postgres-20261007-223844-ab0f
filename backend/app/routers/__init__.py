"""Router package. Each module exposes ``router = APIRouter()``.

Routers are included by ``app.main`` in the fixed order
health, availability, room_bookings, rooms, bookings so that
``/api/rooms/available`` is matched before ``/api/rooms/{room_id}``.
"""
