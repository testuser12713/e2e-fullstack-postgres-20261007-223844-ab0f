"""Time-window validation and overlap lookup for bookings.

Both the booking CRUD endpoints and the tests use these helpers so the rules
live in exactly one place:

* :func:`validate_window` rejects an interval whose end is not strictly after
  its start, and an interval longer than eight hours. Both failures name the
  field ``end``.
* :func:`find_conflict` looks for a booking of the same room that overlaps the
  requested half-open interval ``[start, end)``; an end that lands exactly on
  another booking's start is not a conflict. A booking can be excluded from its
  own overlap check by id (used when updating it).
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .errors import ApiError
from .models import Booking

#: A booking may not span more than this many hours.
MAX_BOOKING_DURATION = timedelta(hours=8)

#: Message shared by validation and the OpenAPI-facing error body.
END_NOT_AFTER_START = "end must be strictly after start"
DURATION_TOO_LONG = "duration must not exceed 8 hours"


def _as_aware(value: datetime) -> datetime:
    """Return ``value`` as a timezone-aware datetime, assuming UTC when naive."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value


def validate_window(start: datetime, end: datetime) -> None:
    """Validate a booking window, raising :class:`ApiError` (422) when invalid.

    ``end`` must be strictly after ``start`` and the interval must not exceed
    eight hours. Both failures report ``field: "end"`` because the end of the
    window is what the caller has to change.
    """
    start_aware = _as_aware(start)
    end_aware = _as_aware(end)
    if end_aware <= start_aware:
        raise ApiError(
            code="validation_error",
            message=END_NOT_AFTER_START,
            status_code=422,
            details={"field": "end", "reason": END_NOT_AFTER_START},
        )
    if end_aware - start_aware > MAX_BOOKING_DURATION:
        raise ApiError(
            code="validation_error",
            message=DURATION_TOO_LONG,
            status_code=422,
            details={"field": "end", "reason": DURATION_TOO_LONG},
        )


def find_conflict(
    db: Session,
    room_id: int,
    start: datetime,
    end: datetime,
    exclude_id: int | None = None,
) -> Booking | None:
    """Return the first booking of ``room_id`` overlapping ``[start, end)``.

    Intervals are half-open, so ``start == other.end`` and ``end ==
    other.start`` are *not* overlaps. ``exclude_id`` removes one booking (the
    one currently being updated) from the check so it cannot collide with
    itself.
    """
    start_aware = _as_aware(start)
    end_aware = _as_aware(end)
    statement = (
        select(Booking)
        .where(
            Booking.room_id == room_id,
            Booking.start < end_aware,
            Booking.end > start_aware,
        )
        .order_by(Booking.start, Booking.id)
        .limit(1)
    )
    if exclude_id is not None:
        statement = statement.where(Booking.id != exclude_id)
    return db.execute(statement).scalars().first()


def conflict_details(booking: Booking) -> dict[str, object]:
    """Build the ``details`` payload naming a conflicting booking.

    The shape matches the shared interface:
    ``{"conflicting_booking": {id, title, booked_by, start, end}}``.
    """
    return {
        "conflicting_booking": {
            "id": booking.id,
            "title": booking.title,
            "booked_by": booking.booked_by,
            "start": booking.start.isoformat(),
            "end": booking.end.isoformat(),
        }
    }


def has_started(booking: Booking, now: datetime | None = None) -> bool:
    """Return whether the booking's start is reached or already passed."""
    reference = now if now is not None else datetime.now(UTC)
    return _as_aware(booking.start) <= _as_aware(reference)
