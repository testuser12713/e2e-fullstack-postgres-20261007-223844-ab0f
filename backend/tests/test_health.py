"""Tests for the health endpoint, the database session and the error shape."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.errors import register_exception_handlers


def test_health_reports_service_and_database(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"status", "database"}
    assert isinstance(body["status"], str)
    assert body["database"] in {"ok", "unreachable"}


def test_health_reports_ok_with_live_postgres(client: TestClient) -> None:
    body = client.get("/api/health").json()

    assert body["database"] == "ok"
    assert body["status"] == "ok"


def test_unknown_route_uses_uniform_error_body(client: TestClient) -> None:
    response = client.get("/api/definitely-not-a-route")

    assert response.status_code == 404
    body = response.json()
    assert set(body) == {"code", "message", "details"}
    assert body["code"] == "not_found"
    assert "detail" not in body


def test_validation_error_uses_uniform_error_body() -> None:
    probe = FastAPI()
    register_exception_handlers(probe)

    class Payload(BaseModel):
        name: str

    @probe.post("/_probe")
    def _echo(payload: Payload) -> dict[str, str]:
        return {"name": payload.name}

    with TestClient(probe) as client:
        response = client.post("/_probe", json={})

    assert response.status_code == 422
    body = response.json()
    assert set(body) == {"code", "message", "details"}
    assert body["code"] == "validation_error"
    assert body["details"]["field"] == "name"
    assert isinstance(body["details"]["reason"], str)
    assert "detail" not in body


def test_booking_end_before_start_reports_field_end() -> None:
    probe = FastAPI()
    register_exception_handlers(probe)

    from app.schemas import BookingCreate

    @probe.post("/_booking")
    def _booking(payload: BookingCreate) -> dict[str, object]:
        return {"ok": True}

    with TestClient(probe) as client:
        response = client.post(
            "/_booking",
            json={
                "room_id": 1,
                "title": "sync",
                "booked_by": "ada",
                "start": "2026-10-08T10:00:00+00:00",
                "end": "2026-10-08T09:00:00+00:00",
            },
        )

    assert response.status_code == 422
    assert response.json()["details"]["field"] == "end"


def test_database_session_is_reachable(db_session: Session) -> None:
    assert db_session.execute(text("SELECT 1")).scalar() == 1
