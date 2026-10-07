"""Free-room availability endpoint.

``GET /api/rooms/available`` returns every room that is large enough and free
for a queried interval. The overlap predicate is defined here on purpose: the
bookings router owns its own copy so the two modules stay independent.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError
from ..models import Booking, Room
from ..schemas import RoomRead

router = APIRouter()


def _require_end_after_start(start: datetime, end: datetime) -> None:
    """Reject an interval whose end is not strictly after its start.

    Raises :class:`ApiError` with the uniform 422 body naming the ``end`` field.
    A timezone-naive value paired with an aware one cannot be compared and is
    reported the same way instead of surfacing as a 500.
    """
    try:
        invalid = end <= start
    except TypeError:
        invalid = True

    if invalid:
        reason = "end must be strictly after start"
        raise ApiError(
            code="validation_error",
            message="Validation failed",
            status_code=422,
            details={"field": "end", "reason": reason},
        )


@router.get("/api/rooms/available", response_model=list[RoomRead])
def available_rooms(
    start: datetime,
    end: datetime,
    min_seats: int,
    equipment: list[str] = Query(default_factory=list),
    db: Session = Depends(get_db),
) -> list[Room]:
    """List rooms with enough seats that are free for ``[start, end)``.

    A room qualifies when it has at least ``min_seats`` seats, carries every
    requested equipment keyword and has no booking that overlaps the queried
    half-open interval. Intervals are half-open, so a booking ending exactly at
    ``start`` (or starting exactly at ``end``) is not a collision. Results are
    sorted by room name.
    """
    _require_end_after_start(start, end)

    overlap = (
        select(Booking.id)
        .where(
            Booking.room_id == Room.id,
            Booking.start < end,
            Booking.end > start,
        )
        .exists()
    )

    statement = select(Room).where(Room.seats >= min_seats)
    if equipment:
        statement = statement.where(Room.equipment.contains(equipment))
    statement = statement.where(~overlap).order_by(Room.name)

    return list(db.execute(statement).scalars().all())
