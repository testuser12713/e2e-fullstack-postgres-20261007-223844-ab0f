"""Booking endpoints: create, read, update and delete a booking.

Every time and overlap rule is enforced here through :mod:`app.booking_rules`:

* creating or updating validates the room exists (404) and the window (422),
* an overlapping booking of the same room answers 409 naming that booking,
* an interval that merely touches another one (end == start) is allowed,
* a booking that has already started can no longer be changed (409) but stays
  readable (200).
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..booking_rules import conflict_details, find_conflict, has_started, validate_window
from ..db import get_db
from ..errors import ApiError
from ..models import Booking, Room
from ..schemas import BookingCreate, BookingRead, BookingUpdate

router = APIRouter()

_STARTED_MESSAGE = "a booking that has already started can no longer be changed"


def _room_or_404(db: Session, room_id: int) -> Room:
    """Return the room or raise a uniform 404."""
    room = db.get(Room, room_id)
    if room is None:
        raise ApiError(
            code="not_found",
            message=f"room {room_id} does not exist",
            status_code=404,
        )
    return room


def _booking_or_404(db: Session, booking_id: int) -> Booking:
    """Return the booking or raise a uniform 404."""
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise ApiError(
            code="not_found",
            message=f"booking {booking_id} does not exist",
            status_code=404,
        )
    return booking


def _ensure_not_started(booking: Booking) -> None:
    """Refuse to change a booking whose start is reached or already passed."""
    if has_started(booking):
        raise ApiError(
            code="booking_started",
            message=_STARTED_MESSAGE,
            status_code=409,
        )


def _ensure_no_overlap(
    db: Session,
    room_id: int,
    start: datetime,
    end: datetime,
    exclude_id: int | None = None,
) -> None:
    """Refuse when another booking of the room overlaps ``[start, end)``."""
    conflict = find_conflict(db, room_id, start, end, exclude_id=exclude_id)
    if conflict is not None:
        raise ApiError(
            code="conflict",
            message="the room is already booked in this period",
            status_code=409,
            details=conflict_details(conflict),
        )


@router.post("/api/bookings", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db)) -> Booking:
    """Create a booking for an existing room."""
    _room_or_404(db, payload.room_id)
    validate_window(payload.start, payload.end)
    _ensure_no_overlap(db, payload.room_id, payload.start, payload.end)

    booking = Booking(
        room_id=payload.room_id,
        title=payload.title,
        booked_by=payload.booked_by,
        start=payload.start,
        end=payload.end,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/api/bookings/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: int, db: Session = Depends(get_db)) -> Booking:
    """Read a booking by id, regardless of whether it has started."""
    return _booking_or_404(db, booking_id)


def _update_booking(booking_id: int, payload: BookingUpdate, db: Session) -> Booking:
    """Apply a partial update, re-checking every booking rule.

    The booking being updated is excluded from the overlap check so an
    unchanged time range does not collide with itself.
    """
    booking = _booking_or_404(db, booking_id)
    _ensure_not_started(booking)

    room_id = payload.room_id if payload.room_id is not None else booking.room_id
    _room_or_404(db, room_id)

    start = payload.start if payload.start is not None else booking.start
    end = payload.end if payload.end is not None else booking.end
    validate_window(start, end)
    _ensure_no_overlap(db, room_id, start, end, exclude_id=booking.id)

    booking.room_id = room_id
    if payload.title is not None:
        booking.title = payload.title
    if payload.booked_by is not None:
        booking.booked_by = payload.booked_by
    booking.start = start
    booking.end = end

    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.put("/api/bookings/{booking_id}", response_model=BookingRead)
def update_booking_put(
    booking_id: int, payload: BookingUpdate, db: Session = Depends(get_db)
) -> Booking:
    """Partially update a booking (PUT spells the same partial update as PATCH)."""
    return _update_booking(booking_id, payload, db)


@router.patch("/api/bookings/{booking_id}", response_model=BookingRead)
def update_booking_patch(
    booking_id: int, payload: BookingUpdate, db: Session = Depends(get_db)
) -> Booking:
    """Partially update a booking."""
    return _update_booking(booking_id, payload, db)


@router.delete("/api/bookings/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int, db: Session = Depends(get_db)) -> Response:
    """Delete a future booking."""
    booking = _booking_or_404(db, booking_id)
    _ensure_not_started(booking)
    db.delete(booking)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
