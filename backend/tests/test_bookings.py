"""Tests for booking CRUD and every time/overlap rule (against real PostgreSQL).

Rooms are created directly through a database session because room CRUD is a
different ticket; the booking endpoints are exercised through the real test
client.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Room

BOOKING_URL = "/api/bookings"

# A day in the future so the "started booking" rule never triggers by accident.
BASE_DAY = (datetime.now(UTC) + timedelta(days=2)).replace(
    hour=0, minute=0, second=0, microsecond=0
)


def _at(hour: int, minute: int = 0, day_offset: int = 0) -> datetime:
    """A timezone-aware timestamp on the future base day."""
    return BASE_DAY + timedelta(days=day_offset, hours=hour, minutes=minute)


def _iso(value: datetime) -> str:
    return value.isoformat()


def _payload(room_id: int, start: datetime, end: datetime, **overrides: object) -> dict:
    body = {
        "room_id": room_id,
        "title": "Team sync",
        "booked_by": "Ada",
        "start": _iso(start),
        "end": _iso(end),
    }
    body.update(overrides)
    return body


@pytest.fixture()
def room(db_session: Session) -> Room:
    """A persisted room available for booking."""
    entity = Room(name=f"Room-{uuid4().hex}", seats=6, equipment=["tv"])
    db_session.add(entity)
    db_session.commit()
    db_session.refresh(entity)
    return entity


@pytest.fixture()
def other_room(db_session: Session) -> Room:
    """A second persisted room to prove overlaps are per room."""
    entity = Room(name=f"Room-other-{uuid4().hex}", seats=2, equipment=[])
    db_session.add(entity)
    db_session.commit()
    db_session.refresh(entity)
    return entity


def _create(client: TestClient, payload: dict) -> dict:
    response = client.post(BOOKING_URL, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


# --- create ---------------------------------------------------------------


def test_create_booking_returns_201_with_room_id(client: TestClient, room: Room) -> None:
    response = client.post(BOOKING_URL, json=_payload(room.id, _at(10), _at(11)))

    assert response.status_code == 201
    body = response.json()
    assert body["room_id"] == room.id
    assert body["title"] == "Team sync"
    assert body["booked_by"] == "Ada"
    assert body["id"] > 0
    assert datetime.fromisoformat(body["start"]) == _at(10)
    assert datetime.fromisoformat(body["end"]) == _at(11)


def test_create_booking_unknown_room_404(client: TestClient) -> None:
    response = client.post(BOOKING_URL, json=_payload(999_999, _at(10), _at(11)))

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == "not_found"
    assert set(body) == {"code", "message", "details"}


def test_create_booking_end_before_start_422_names_end(client: TestClient, room: Room) -> None:
    response = client.post(BOOKING_URL, json=_payload(room.id, _at(11), _at(10)))

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["details"]["field"] == "end"
    assert isinstance(body["details"]["reason"], str)


def test_create_booking_end_equal_start_422_names_end(client: TestClient, room: Room) -> None:
    response = client.post(BOOKING_URL, json=_payload(room.id, _at(10), _at(10)))

    assert response.status_code == 422
    assert response.json()["details"]["field"] == "end"


def test_create_booking_duration_over_eight_hours_422_names_end(
    client: TestClient, room: Room
) -> None:
    response = client.post(BOOKING_URL, json=_payload(room.id, _at(9), _at(18)))

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["details"]["field"] == "end"
    assert "8" in body["details"]["reason"]


def test_create_booking_exactly_eight_hours_is_allowed(client: TestClient, room: Room) -> None:
    response = client.post(BOOKING_URL, json=_payload(room.id, _at(9), _at(17)))

    assert response.status_code == 201


def test_create_booking_overlap_409_names_conflicting_booking(
    client: TestClient, room: Room
) -> None:
    existing = _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.post(BOOKING_URL, json=_payload(room.id, _at(11), _at(13)))

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "conflict"
    conflict = body["details"]["conflicting_booking"]
    assert conflict["id"] == existing["id"]
    assert conflict["title"] == existing["title"]
    assert conflict["booked_by"] == existing["booked_by"]
    assert datetime.fromisoformat(conflict["start"]) == _at(10)
    assert datetime.fromisoformat(conflict["end"]) == _at(12)


def test_create_booking_starting_when_other_ends_is_accepted(
    client: TestClient, room: Room
) -> None:
    _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.post(BOOKING_URL, json=_payload(room.id, _at(12), _at(14)))

    assert response.status_code == 201


def test_create_booking_ending_when_other_starts_is_accepted(
    client: TestClient, room: Room
) -> None:
    _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.post(BOOKING_URL, json=_payload(room.id, _at(8), _at(10)))

    assert response.status_code == 201


def test_overlap_in_another_room_is_allowed(
    client: TestClient, room: Room, other_room: Room
) -> None:
    _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.post(BOOKING_URL, json=_payload(other_room.id, _at(10), _at(12)))

    assert response.status_code == 201


# --- read -----------------------------------------------------------------


def test_get_booking_returns_stored_booking(client: TestClient, room: Room) -> None:
    created = _create(client, _payload(room.id, _at(10), _at(11)))

    response = client.get(f"{BOOKING_URL}/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_unknown_booking_404(client: TestClient) -> None:
    response = client.get(f"{BOOKING_URL}/123456")

    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


# --- update ---------------------------------------------------------------


def test_update_unchanged_future_range_does_not_collide_with_itself(
    client: TestClient, room: Room
) -> None:
    created = _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.put(
        f"{BOOKING_URL}/{created['id']}",
        json={"title": "Renamed"},
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Renamed"


def test_put_with_same_window_is_accepted(client: TestClient, room: Room) -> None:
    created = _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.put(
        f"{BOOKING_URL}/{created['id']}",
        json={
            "start": _iso(_at(10)),
            "end": _iso(_at(12)),
        },
    )

    assert response.status_code == 200


def test_patch_applies_changes(client: TestClient, room: Room) -> None:
    created = _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.patch(
        f"{BOOKING_URL}/{created['id']}",
        json={"end": _iso(_at(13)), "booked_by": "Grace"},
    )

    assert response.status_code == 200
    body = response.json()
    assert datetime.fromisoformat(body["end"]) == _at(13)
    assert body["booked_by"] == "Grace"


def test_update_end_before_merged_start_422_names_end(client: TestClient, room: Room) -> None:
    created = _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.patch(f"{BOOKING_URL}/{created['id']}", json={"end": _iso(_at(9))})

    assert response.status_code == 422
    assert response.json()["details"]["field"] == "end"


def test_update_to_overlapping_window_409(client: TestClient, room: Room) -> None:
    first = _create(client, _payload(room.id, _at(10), _at(12)))
    second = _create(client, _payload(room.id, _at(14), _at(16)))

    response = client.patch(f"{BOOKING_URL}/{second['id']}", json={"start": _iso(_at(11))})

    assert response.status_code == 409
    conflict = response.json()["details"]["conflicting_booking"]
    assert conflict["id"] == first["id"]


def test_update_to_new_room_is_applied(client: TestClient, room: Room, other_room: Room) -> None:
    created = _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.patch(f"{BOOKING_URL}/{created['id']}", json={"room_id": other_room.id})

    assert response.status_code == 200
    assert response.json()["room_id"] == other_room.id


def test_update_unknown_booking_404(client: TestClient) -> None:
    response = client.patch(f"{BOOKING_URL}/123456", json={"title": "x"})

    assert response.status_code == 404


# --- started bookings -----------------------------------------------------


def _create_started(client: TestClient, room: Room) -> dict:
    now = datetime.now(UTC)
    start = now - timedelta(hours=2)
    end = now - timedelta(hours=1)
    return _create(client, _payload(room.id, start, end))


def test_update_started_booking_is_rejected_but_readable(client: TestClient, room: Room) -> None:
    created = _create_started(client, room)

    response = client.patch(f"{BOOKING_URL}/{created['id']}", json={"title": "Later"})

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "booking_started"
    assert isinstance(body["message"], str) and body["message"]

    read = client.get(f"{BOOKING_URL}/{created['id']}")
    assert read.status_code == 200
    assert read.json()["title"] == "Team sync"


def test_delete_started_booking_is_rejected(client: TestClient, room: Room) -> None:
    created = _create_started(client, room)

    response = client.delete(f"{BOOKING_URL}/{created['id']}")

    assert response.status_code == 409
    assert response.json()["code"] == "booking_started"

    assert client.get(f"{BOOKING_URL}/{created['id']}").status_code == 200


# --- delete ---------------------------------------------------------------


def test_delete_future_booking_returns_204_and_gone(client: TestClient, room: Room) -> None:
    created = _create(client, _payload(room.id, _at(10), _at(12)))

    response = client.delete(f"{BOOKING_URL}/{created['id']}")

    assert response.status_code == 204
    assert client.get(f"{BOOKING_URL}/{created['id']}").status_code == 404


def test_delete_unknown_booking_404(client: TestClient) -> None:
    response = client.delete(f"{BOOKING_URL}/123456")

    assert response.status_code == 404


# --- trimming and required fields ----------------------------------------


def test_title_and_booked_by_are_trimmed(client: TestClient, room: Room) -> None:
    created = _create(
        client,
        _payload(room.id, _at(10), _at(11), title="  Sprint review  ", booked_by="  Ada  "),
    )

    assert created["title"] == "Sprint review"
    assert created["booked_by"] == "Ada"


def test_empty_title_422_names_title(client: TestClient, room: Room) -> None:
    response = client.post(BOOKING_URL, json=_payload(room.id, _at(10), _at(11), title="   "))

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "validation_error"
    assert body["details"]["field"] == "title"


def test_empty_booked_by_422_names_booked_by(client: TestClient, room: Room) -> None:
    response = client.post(BOOKING_URL, json=_payload(room.id, _at(10), _at(11), booked_by=""))

    assert response.status_code == 422
    assert response.json()["details"]["field"] == "booked_by"


def test_error_body_never_uses_bare_detail(client: TestClient) -> None:
    response = client.get(f"{BOOKING_URL}/123456")

    assert set(response.json()) == {"code", "message", "details"}
