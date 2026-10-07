"""Pydantic v2 schemas for rooms, bookings and the uniform error body.

These models are shared with later tickets and must keep their field names,
types and shapes exactly.
"""

from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ErrorBody(BaseModel):
    """The single error shape every failure answer uses."""

    code: str
    message: str
    details: Any = None


class _Base(BaseModel):
    """Common configuration: surrounding whitespace is never significant."""

    model_config = ConfigDict(str_strip_whitespace=True)


class RoomCreate(_Base):
    """Payload for creating a room."""

    name: str = Field(min_length=1, max_length=200)
    seats: int = Field(ge=1)
    equipment: list[str] = Field(default_factory=list)


class RoomUpdate(_Base):
    """Partial update payload for a room."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    seats: int | None = Field(default=None, ge=1)
    equipment: list[str] | None = None


class RoomRead(_Base):
    """Room as returned by the API."""

    id: int
    name: str
    seats: int
    equipment: list[str]

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class BookingCreate(_Base):
    """Payload for creating a booking."""

    room_id: int
    title: str = Field(min_length=1, max_length=300)
    booked_by: str = Field(min_length=1, max_length=200)
    start: datetime
    end: datetime

    @field_validator("end")
    @classmethod
    def _validate_end(cls, value: datetime, info: Any) -> datetime:
        start = info.data.get("start")
        if start is None:
            return value
        if value <= start:
            raise ValueError("end must be strictly after start")
        if value - start > timedelta(hours=8):
            raise ValueError("duration must not exceed 8 hours")
        return value


class BookingUpdate(_Base):
    """Partial update payload for a booking."""

    room_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)
    booked_by: str | None = Field(default=None, min_length=1, max_length=200)
    start: datetime | None = None
    end: datetime | None = None

    @field_validator("end")
    @classmethod
    def _validate_end(cls, value: datetime | None, info: Any) -> datetime | None:
        start = info.data.get("start")
        if value is None or start is None:
            return value
        if value <= start:
            raise ValueError("end must be strictly after start")
        if value - start > timedelta(hours=8):
            raise ValueError("duration must not exceed 8 hours")
        return value


class BookingRead(_Base):
    """Booking as returned by the API."""

    id: int
    room_id: int
    title: str
    booked_by: str
    start: datetime
    end: datetime

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class HealthRead(_Base):
    """Response body of ``GET /api/health``."""

    status: str
    database: str
