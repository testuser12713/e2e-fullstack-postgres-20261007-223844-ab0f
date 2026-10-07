"""Room CRUD endpoints.

Implements the shared room interface:

* ``POST /api/rooms``          -> 201 Room | 409 duplicate name | 422
* ``GET /api/rooms``           -> 200 [Room]
* ``GET /api/rooms/{id}``      -> 200 Room | 404
* ``PUT|PATCH /api/rooms/{id}``-> 200 Room | 404 | 409 | 422
* ``DELETE /api/rooms/{id}``   -> 204 | 404 | 409 (a booking has not ended yet)

Every failure answer uses the uniform error shape from :mod:`app.errors`.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import ApiError
from ..models import Booking, Room
from ..schemas import RoomCreate, RoomRead, RoomUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


def _normalize_equipment(equipment: list[str]) -> list[str]:
    """Trim every keyword, drop empty ones and remove duplicates.

    Order is preserved (first occurrence wins).
    """
    normalized: list[str] = []
    for raw in equipment:
        keyword = raw.strip()
        if not keyword:
            raise ApiError(
                "validation_error",
                "Equipment keywords must not be empty",
                status_code=422,
                details={"field": "equipment", "reason": "equipment keyword must not be empty"},
            )
        if keyword not in normalized:
            normalized.append(keyword)
    return normalized


def _ensure_name_available(db: Session, name: str, exclude_id: int | None = None) -> None:
    """Reject a name that already exists, ignoring case and surrounding whitespace."""
    normalized = name.strip().lower()
    query = select(Room.id).where(func.lower(func.trim(Room.name)) == normalized)
    if exclude_id is not None:
        query = query.where(Room.id != exclude_id)
    if db.execute(query).first() is not None:
        raise ApiError(
            "conflict",
            f"A room named '{name}' already exists",
            status_code=409,
            details={"field": "name"},
        )


def _get_room_or_404(db: Session, room_id: int) -> Room:
    """Return the room or raise a uniform 404."""
    room = db.get(Room, room_id)
    if room is None:
        raise ApiError("not_found", f"Room {room_id} not found", status_code=404)
    return room


def _commit_or_conflict(db: Session) -> None:
    """Persist the current transaction, translating a unique-name clash to 409."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ApiError(
            "conflict",
            "A room with this name already exists",
            status_code=409,
            details={"field": "name"},
        ) from None


@router.post("/api/rooms", response_model=RoomRead, status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, db: Session = Depends(get_db)) -> Room:
    """Create a room; a duplicate name (case/whitespace-insensitive) is a 409."""
    _ensure_name_available(db, payload.name)
    room = Room(
        name=payload.name,
        seats=payload.seats,
        equipment=_normalize_equipment(payload.equipment),
    )
    db.add(room)
    _commit_or_conflict(db)
    db.refresh(room)
    logger.info("created room id=%s name=%r", room.id, room.name)
    return room


@router.get("/api/rooms", response_model=list[RoomRead])
def list_rooms(db: Session = Depends(get_db)) -> list[Room]:
    """Return every room, ordered by id."""
    return list(db.execute(select(Room).order_by(Room.id)).scalars())


@router.get("/api/rooms/{room_id}", response_model=RoomRead)
def get_room(room_id: int, db: Session = Depends(get_db)) -> Room:
    """Return one room or a uniform 404."""
    return _get_room_or_404(db, room_id)


@router.put("/api/rooms/{room_id}", response_model=RoomRead)
@router.patch("/api/rooms/{room_id}", response_model=RoomRead)
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db)) -> Room:
    """Partially update a room and re-check name uniqueness."""
    room = _get_room_or_404(db, room_id)
    data = payload.model_dump(exclude_unset=True)

    new_name = data.get("name")
    if new_name is not None:
        _ensure_name_available(db, new_name, exclude_id=room_id)
        room.name = new_name

    new_seats = data.get("seats")
    if new_seats is not None:
        room.seats = new_seats

    new_equipment = data.get("equipment")
    if new_equipment is not None:
        room.equipment = _normalize_equipment(new_equipment)

    _commit_or_conflict(db)
    db.refresh(room)
    logger.info("updated room id=%s", room.id)
    return room


@router.delete("/api/rooms/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int, db: Session = Depends(get_db)) -> Response:
    """Delete a room unless it has a booking that has not ended yet."""
    room = _get_room_or_404(db, room_id)
    now = datetime.now(UTC)
    blocking = db.execute(
        select(Booking.id).where(Booking.room_id == room_id, Booking.end > now).limit(1)
    ).first()
    if blocking is not None:
        raise ApiError(
            "conflict",
            "Room has a booking that has not ended yet",
            status_code=409,
        )
    db.delete(room)
    db.commit()
    logger.info("deleted room id=%s", room_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
