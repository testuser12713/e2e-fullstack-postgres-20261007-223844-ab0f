"""Tests for ``GET /api/rooms/available`` against a real PostgreSQL.

Rows are created directly through the ORM because the room and booking HTTP
endpoints are owned by other tickets; this file only verifies the availability
query itself.
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Booking, Room

BASE = datetime(2026, 11, 3, 9, 0, tzinfo=UTC)


def _add_room(session: Session, name: str, seats: int, equipment: list[str] | None = None) -> Room:
    room = Room(name=name, seats=seats, equipment=equipment or [])
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


def _add_booking(session: Session, room_id: int, start: datetime, end: datetime) -> Booking:
    booking = Booking(
        room_id=room_id,
        title="Existing booking",
        booked_by="ada",
        start=start,
        end=end,
    )
    session.add(booking)
    session.commit()
    session.refresh(booking)
    return booking


def _params(start: datetime, end: datetime, min_seats: int = 1) -> dict[str, object]:
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "min_seats": min_seats,
    }


@pytest.fixture()
def seeded(db_session: Session) -> Iterator[dict[str, Room]]:
    """Two rooms of different size and one matching booking."""
    big = _add_room(db_session, "Alpha", 12, ["projector", "whiteboard"])
    small = _add_room(db_session, "Beta", 3, ["projector"])
    _add_booking(db_session, big.id, BASE + timedelta(hours=1), BASE + timedelta(hours=2))
    yield {"big": big, "small": small}


def test_available_filters_by_seats_and_reports_rooms_sorted_by_name(
    client: TestClient, seeded: dict[str, Room]
) -> None:
    # A window after Alpha's booking, so the seat filter is what matters here.
    response = client.get(
        "/api/rooms/available",
        params=_params(BASE + timedelta(hours=3), BASE + timedelta(hours=4), min_seats=10),
    )

    assert response.status_code == 200
    body = response.json()
    # Only "Alpha" is large enough; it is also free in the queried window.
    assert [room["name"] for room in body] == ["Alpha"]
    assert body[0]["seats"] == 12


def test_available_sorted_alphabetically(client: TestClient, db_session: Session) -> None:
    for name, seats in (("Zeta", 5), ("Alpha", 5), ("Mike", 5)):
        _add_room(db_session, name, seats)

    response = client.get("/api/rooms/available", params=_params(BASE, BASE + timedelta(hours=1)))

    assert response.status_code == 200
    assert [room["name"] for room in response.json()] == ["Alpha", "Mike", "Zeta"]


def test_room_with_overlapping_booking_is_absent(
    client: TestClient, seeded: dict[str, Room]
) -> None:
    response = client.get(
        "/api/rooms/available",
        params=_params(BASE + timedelta(minutes=30), BASE + timedelta(hours=3), min_seats=1),
    )

    assert response.status_code == 200
    names = {room["name"] for room in response.json()}
    # Alpha is booked 10:00-11:00, so it collides with the 09:30-12:00 query.
    assert "Alpha" not in names
    assert names == {"Beta"}


def test_booking_ending_at_query_start_is_not_a_collision(
    client: TestClient, db_session: Session
) -> None:
    room = _add_room(db_session, "Gamma", 6)
    booked_end = BASE + timedelta(hours=1)
    _add_booking(db_session, room.id, BASE, booked_end)

    response = client.get(
        "/api/rooms/available",
        params=_params(booked_end, booked_end + timedelta(hours=1), min_seats=1),
    )

    assert response.status_code == 200
    assert [room["name"] for room in response.json()] == ["Gamma"]


def test_booking_starting_at_query_end_is_not_a_collision(
    client: TestClient, db_session: Session
) -> None:
    room = _add_room(db_session, "Delta", 6)
    query_end = BASE + timedelta(hours=1)
    _add_booking(db_session, room.id, query_end, query_end + timedelta(hours=1))

    response = client.get(
        "/api/rooms/available",
        params=_params(BASE, query_end, min_seats=1),
    )

    assert response.status_code == 200
    assert [room["name"] for room in response.json()] == ["Delta"]


def test_equipment_filter_requires_every_keyword(
    client: TestClient, seeded: dict[str, Room]
) -> None:
    response = client.get(
        "/api/rooms/available",
        params=[
            ("start", (BASE + timedelta(hours=3)).isoformat()),
            ("end", (BASE + timedelta(hours=4)).isoformat()),
            ("min_seats", "1"),
            ("equipment", "projector"),
            ("equipment", "whiteboard"),
        ],
    )

    assert response.status_code == 200
    # Only Alpha has both keywords; Beta is missing the whiteboard.
    assert [room["name"] for room in response.json()] == ["Alpha"]


def test_equipment_parameter_is_repeatable_and_optional(client: TestClient, seeded: dict) -> None:
    no_filter = client.get(
        "/api/rooms/available",
        params=_params(BASE + timedelta(hours=3), BASE + timedelta(hours=4)),
    )
    assert no_filter.status_code == 200
    assert {room["name"] for room in no_filter.json()} == {"Alpha", "Beta"}


def test_end_not_after_start_returns_uniform_422(client: TestClient) -> None:
    response = client.get(
        "/api/rooms/available",
        params=_params(BASE + timedelta(hours=2), BASE),
    )

    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"code", "message", "details"}
    assert body["code"] == "validation_error"
    assert body["details"]["field"] == "end"
    assert "detail" not in body


def test_equal_start_and_end_returns_uniform_422(client: TestClient) -> None:
    response = client.get("/api/rooms/available", params=_params(BASE, BASE))

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["details"]["field"] == "end"
