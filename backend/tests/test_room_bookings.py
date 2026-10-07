"""Tests for the room day-bookings endpoint against real PostgreSQL."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Booking, Room


def _office_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().office_timezone)


def _local(day: date, hour: int, minute: int = 0) -> datetime:
    """An aware datetime at the given local wall time in the office timezone."""
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=_office_tz())


def _room(db: Session, name: str, seats: int = 4) -> Room:
    room = Room(name=name, seats=seats, equipment=[])
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def _booking(
    db: Session,
    room: Room,
    title: str,
    start: datetime,
    end: datetime,
    booked_by: str = "ada",
) -> Booking:
    booking = Booking(
        room_id=room.id,
        title=title,
        booked_by=booked_by,
        start=start,
        end=end,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def test_lists_only_that_rooms_bookings_in_chronological_order(
    client: TestClient, db_session: Session
) -> None:
    day = date(2026, 10, 8)
    room = _room(db_session, "Day room A")
    other_room = _room(db_session, "Day room B")

    afternoon = _booking(db_session, room, "afternoon", _local(day, 14), _local(day, 15))
    morning = _booking(db_session, room, "morning", _local(day, 9), _local(day, 10))
    _booking(db_session, other_room, "other room", _local(day, 11), _local(day, 12))
    _booking(
        db_session,
        room,
        "previous day",
        _local(day - timedelta(days=1), 22),
        _local(day - timedelta(days=1), 23),
    )

    response = client.get(f"/api/rooms/{room.id}/bookings", params={"date": day.isoformat()})

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body] == [morning.id, afternoon.id]
    assert [item["title"] for item in body] == ["morning", "afternoon"]
    for item in body:
        assert item["room_id"] == room.id
        assert set(item) == {"id", "room_id", "title", "booked_by", "start", "end"}


def test_local_day_boundary_is_translated_to_utc(client: TestClient, db_session: Session) -> None:
    day = date(2026, 10, 8)
    room = _room(db_session, "Boundary room")

    # Starts just before local midnight -> belongs to the requested day.
    before_midnight = _booking(
        db_session, room, "before midnight", _local(day, 23, 30), _local(day, 23, 59)
    )
    # Starts on the neighbouring local day -> must not be listed.
    _booking(
        db_session,
        room,
        "next day",
        _local(day + timedelta(days=1), 0, 30),
        _local(day + timedelta(days=1), 1, 30),
    )
    # 00:30 local is on the previous UTC day: the window must be local, not UTC.
    after_midnight = _booking(
        db_session, room, "after midnight", _local(day, 0, 30), _local(day, 1, 30)
    )

    response = client.get(f"/api/rooms/{room.id}/bookings", params={"date": day.isoformat()})

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body] == [after_midnight.id, before_midnight.id]
    starts = [datetime.fromisoformat(item["start"]) for item in body]
    assert starts[0].astimezone(UTC) == _local(day, 0, 30).astimezone(UTC)


def test_free_day_returns_empty_array(client: TestClient, db_session: Session) -> None:
    day = date(2026, 10, 8)
    room = _room(db_session, "Free room")
    _booking(
        db_session,
        room,
        "another day",
        _local(day + timedelta(days=1), 9),
        _local(day + timedelta(days=1), 10),
    )

    response = client.get(f"/api/rooms/{room.id}/bookings", params={"date": day.isoformat()})

    assert response.status_code == 200
    assert response.json() == []


def test_unknown_room_returns_404_in_uniform_shape(client: TestClient, db_session: Session) -> None:
    response = client.get("/api/rooms/999999/bookings", params={"date": "2026-10-08"})

    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"code", "message", "details"}
    assert body["code"] == "not_found"
    assert "detail" not in body


def test_missing_date_is_a_validation_error(client: TestClient, db_session: Session) -> None:
    room = _room(db_session, "No date room")

    response = client.get(f"/api/rooms/{room.id}/bookings")

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
