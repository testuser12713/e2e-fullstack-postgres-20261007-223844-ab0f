"""Health endpoint."""

import logging

from fastapi import APIRouter
from sqlalchemy import text

from ..config import get_settings
from ..db import engine
from ..schemas import HealthRead

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/health", response_model=HealthRead)
def health() -> HealthRead:
    """Report service status and database reachability.

    Answers 200 whether or not the database is reachable; the ``database``
    field carries ``"ok"`` or ``"unreachable"``.
    """
    settings = get_settings()
    logger.debug("health probe (timezone=%s)", settings.office_timezone)

    database = "ok"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database = "unreachable"

    return HealthRead(status="ok" if database == "ok" else "degraded", database=database)
