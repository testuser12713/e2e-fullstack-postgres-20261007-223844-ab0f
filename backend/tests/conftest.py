"""Shared pytest fixtures: a real PostgreSQL session and a TestClient."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.config import Settings
from app.db import Base
from app.main import app


@pytest.fixture(scope="session")
def engine() -> Iterator[Engine]:
    """A real PostgreSQL engine built from ``DATABASE_URL``.

    The schema is created here too, so tests never depend on a previous run.
    """
    settings = Settings()
    eng = create_engine(settings.sqlalchemy_database_url, pool_pre_ping=True, future=True)
    Base.metadata.create_all(bind=eng)
    try:
        yield eng
    finally:
        eng.dispose()


@pytest.fixture()
def db_session(engine: Engine) -> Iterator[Session]:
    """A session bound to the test engine, closed afterwards."""
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _clean_own_tables(engine: Engine) -> Iterator[None]:
    """Remove rows this ticket's tables own, leaving other tables alone."""
    yield
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM bookings"))
        connection.execute(text("DELETE FROM rooms"))


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """A TestClient that runs the app's startup/shutdown lifespan."""
    with TestClient(app) as test_client:
        yield test_client
