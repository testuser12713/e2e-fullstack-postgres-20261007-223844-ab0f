"""Database engine, session factory, declarative base and schema bootstrap."""

import logging
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    """Declarative base for every ORM model in this application."""


# create_engine does not open a connection, so this stays import-safe even when
# the database is temporarily unreachable.
engine = create_engine(
    get_settings().sqlalchemy_database_url,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a database session and closing it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> bool:
    """Create all tables idempotently, logging (not raising) when unreachable.

    Returns ``True`` when the schema was ensured, ``False`` when the database
    could not be reached. A missing database must not stop the API from serving
    ``/api/health``, which reports the database as ``unreachable`` instead.
    """
    try:
        from . import models  # noqa: F401  (registers tables on Base.metadata)

        Base.metadata.create_all(bind=engine)
        logger.info("database schema is present")
        return True
    except Exception:
        logger.exception("database unreachable — schema could not be created")
        return False
