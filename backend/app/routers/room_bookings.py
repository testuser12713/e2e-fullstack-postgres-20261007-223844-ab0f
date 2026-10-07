"""Room day-bookings endpoint.

Owned by the room day view ticket. ``GET /api/rooms/{room_id}/bookings``
lists exactly the bookings of one room that begin on a given local day.
"""

from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..errors import ApiError
from ..models import Booking, Room
from ..schemas import BookingRead

router = APIRouter()


@router.get(
    "/api/rooms/{room_id}/bookings",
    response_model=list[BookingRead],
)
def list_room_bookings(
    room_id: int,
    booking_date: date = Query(..., alias="date"),
    db: Session = Depends(get_db),
) -> list[Booking]:
    """Return the bookings of ``room_id`` that start on the local day ``date``.

    The day is interpreted in the configured office timezone
    (:data:`Settings.OFFICE_TIMEZONE`, default ``Europe/Berlin``) and the
    resulting half-open window ``[day_start, day_end)`` is translated to UTC
    before it is compared against the stored ``TIMESTAMPTZ`` values. A booking
    belongs to the day when its ``start`` falls inside that window, so a
    booking on the neighbouring local day is not returned.
    """
    room = db.get(Room, room_id)
    if room is None:
        raise ApiError("not_found", f"Room {room_id} not found", status_code=404)

    office_tz = ZoneInfo(get_settings().office_timezone)
    day_start_local = datetime.combine(booking_date, time.min, tzinfo=office_tz)
    day_end_local = day_start_local + timedelta(days=1)
    day_start = day_start_local.astimezone(UTC)
    day_end = day_end_local.astimezone(UTC)

    statement = (
        select(Booking)
        .where(Booking.room_id == room_id)
        .where(Booking.start >= day_start)
        .where(Booking.start < day_end)
        .order_by(Booking.start.asc(), Booking.id.asc())
    )
    return list(db.scalars(statement).all())
