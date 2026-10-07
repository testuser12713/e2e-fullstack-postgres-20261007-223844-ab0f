"""Tests for the room CRUD endpoints (``app/routers/rooms.py``).

These run against the real PostgreSQL instance behind ``DATABASE_URL``; the
shared ``_clean_own_tables`` fixture removes the rows written here afterwards.
"""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Booking


def _assert_uniform_error(response, code: str) -> None:
    """Every failure answer carries exactly code/message/details and no detail."""
    body = response.json()
    assert set(body) == {"code", "message", "details"}
    assert body["code"] == code
    assert isinstance(body["message"], str) and body["message"]
    assert "detail" not in body


def _create_room(
    client: TestClient,
    name: str = "Konferenz",
    seats: int = 8,
    equipment: list[str] | None = None,
) -> dict:
    response = client.post(
        "/api/rooms",
        json={"name": name, "seats": seats, "equipment": equipment or []},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _add_booking(db_session: Session, room_id: int, start: datetime, end: datetime) -> int:
    """Insert a booking directly (the bookings API belongs to another ticket)."""
    booking = Booking(
        room_id=room_id,
        title="Team sync",
        booked_by="Ada",
        start=start,
        end=end,
    )
    db_session.add(booking)
    db_session.commit()
    return booking.id


def test_create_room_returns_201_with_stored_room(client: TestClient) -> None:
    response = client.post(
        "/api/rooms",
        json={"name": "  Konferenz  ", "seats": 8, "equipment": ["Beamer"]},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Konferenz"
    assert body["seats"] == 8
    assert body["equipment"] == ["Beamer"]
    assert isinstance(body["id"], int)


def test_create_room_trims_and_dedupes_equipment(client: TestClient) -> None:
    body = _create_room(
        client,
        name="Labor",
        equipment=[" Projector ", "Projector", "Whiteboard"],
    )

    assert body["equipment"] == ["Projector", "Whiteboard"]


def test_create_room_duplicate_name_ignoring_case_returns_409(client: TestClient) -> None:
    _create_room(client, name="Merkur")

    response = client.post(
        "/api/rooms",
        json={"name": "merkur", "seats": 4, "equipment": []},
    )

    assert response.status_code == 409
    _assert_uniform_error(response, "conflict")


def test_create_room_duplicate_name_ignoring_whitespace_returns_409(client: TestClient) -> None:
    _create_room(client, name="Merkur")

    response = client.post(
        "/api/rooms",
        json={"name": "  Merkur  ", "seats": 4, "equipment": []},
    )

    assert response.status_code == 409
    _assert_uniform_error(response, "conflict")


def test_create_room_non_positive_seats_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/rooms",
        json={"name": "Nullraum", "seats": 0, "equipment": []},
    )

    assert response.status_code == 422
    _assert_uniform_error(response, "validation_error")
    assert response.json()["details"]["field"] == "seats"


def test_create_room_blank_name_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/rooms",
        json={"name": "   ", "seats": 2, "equipment": []},
    )

    assert response.status_code == 422
    _assert_uniform_error(response, "validation_error")
    assert response.json()["details"]["field"] == "name"


def test_list_rooms_returns_all_created_rooms(client: TestClient) -> None:
    first = _create_room(client, name="A")
    second = _create_room(client, name="B")

    response = client.get("/api/rooms")

    assert response.status_code == 200
    ids = {room["id"] for room in response.json()}
    assert {first["id"], second["id"]} <= ids


def test_get_room_returns_single_room(client: TestClient) -> None:
    created = _create_room(client, name="Fokus", equipment=["Whiteboard"])

    response = client.get(f"/api/rooms/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_unknown_room_returns_404_uniform(client: TestClient) -> None:
    response = client.get("/api/rooms/999999")

    assert response.status_code == 404
    _assert_uniform_error(response, "not_found")


def test_put_updates_all_given_fields(client: TestClient) -> None:
    created = _create_room(client, name="Alt", seats=4, equipment=["Beamer"])

    response = client.put(
        f"/api/rooms/{created['id']}",
        json={"name": "Neu", "seats": 12, "equipment": ["Miro"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["name"] == "Neu"
    assert body["seats"] == 12
    assert body["equipment"] == ["Miro"]


def test_patch_updates_only_provided_fields(client: TestClient) -> None:
    created = _create_room(client, name="Teil", seats=6, equipment=["Beamer"])

    response = client.patch(f"/api/rooms/{created['id']}", json={"seats": 10})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Teil"
    assert body["seats"] == 10
    assert body["equipment"] == ["Beamer"]


def test_update_unknown_room_returns_404(client: TestClient) -> None:
    response = client.put("/api/rooms/999999", json={"seats": 3})

    assert response.status_code == 404
    _assert_uniform_error(response, "not_found")


def test_update_name_clashing_with_other_room_returns_409(client: TestClient) -> None:
    _create_room(client, name="Merkur")
    other = _create_room(client, name="Venus")

    response = client.patch(f"/api/rooms/{other['id']}", json={"name": "merkur"})

    assert response.status_code == 409
    _assert_uniform_error(response, "conflict")


def test_update_room_may_keep_its_own_name(client: TestClient) -> None:
    created = _create_room(client, name="Merkur")

    response = client.put(
        f"/api/rooms/{created['id']}",
        json={"name": "MERKUR", "seats": 5},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "MERKUR"


def test_delete_room_without_bookings_returns_204(client: TestClient) -> None:
    created = _create_room(client, name="Vergaenglich")

    response = client.delete(f"/api/rooms/{created['id']}")

    assert response.status_code == 204
    assert client.get(f"/api/rooms/{created['id']}").status_code == 404


def test_delete_unknown_room_returns_404(client: TestClient) -> None:
    response = client.delete("/api/rooms/999999")

    assert response.status_code == 404
    _assert_uniform_error(response, "not_found")


def test_delete_room_with_future_booking_returns_409(
    client: TestClient, db_session: Session
) -> None:
    created = _create_room(client, name="Belegt")
    now = datetime.now(UTC)
    _add_booking(db_session, created["id"], now + timedelta(hours=1), now + timedelta(hours=2))

    response = client.delete(f"/api/rooms/{created['id']}")

    assert response.status_code == 409
    _assert_uniform_error(response, "conflict")
    assert client.get(f"/api/rooms/{created['id']}").status_code == 200


def test_delete_room_with_only_past_booking_cascades(
    client: TestClient, db_session: Session
) -> None:
    created = _create_room(client, name="Vergangen")
    now = datetime.now(UTC)
    booking_id = _add_booking(
        db_session, created["id"], now - timedelta(hours=2), now - timedelta(hours=1)
    )

    response = client.delete(f"/api/rooms/{created['id']}")

    assert response.status_code == 204
    db_session.expire_all()
    assert db_session.get(Booking, booking_id) is None
    assert (
        db_session.execute(
            select(func.count()).select_from(Booking).where(Booking.room_id == created["id"])
        ).scalar()
        == 0
    )
