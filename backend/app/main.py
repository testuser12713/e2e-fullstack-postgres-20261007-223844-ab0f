"""FastAPI application entry point."""

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import init_db
from .errors import register_exception_handlers
from .routers import availability, bookings, health, room_bookings, rooms

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Validate configuration and ensure the schema once at startup."""
    settings = get_settings()
    logger.info("starting API (office timezone=%s)", settings.office_timezone)
    init_db()
    yield


app = FastAPI(
    title="Office Room Booking API",
    version="1.0.0",
    description="REST API for rooms and bookings of a small office.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Answer any unhandled error inside the CORS layer with the uniform shape."""
    logger.exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"code": "internal_error", "message": "Internal Server Error", "details": None},
    )


# Fixed order: availability must be matched before the parameterised room path.
app.include_router(health.router)
app.include_router(availability.router)
app.include_router(room_bookings.router)
app.include_router(rooms.router)
app.include_router(bookings.router)
