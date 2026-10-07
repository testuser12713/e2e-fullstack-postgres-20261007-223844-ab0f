"""Application configuration read lazily from the environment."""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the API.

    Values are resolved from environment variables (and an optional ``.env``
    file) at first use, never at import time, so a missing value can be reported
    by the startup validation instead of a bare import traceback.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    database_url: str = Field(
        default="postgresql+psycopg://app@localhost:5432/app",
        description="SQLAlchemy database URL (PostgreSQL via psycopg 3).",
    )
    office_timezone: str = Field(
        default="Europe/Berlin",
        description="IANA timezone used for local-day calculations.",
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        """Database URL normalised to the psycopg 3 SQLAlchemy driver.

        Operators commonly provide a bare ``postgresql://`` URL (that is what
        the office injects); SQLAlchemy would then reach for psycopg2. This
        project only ships psycopg 3, so the driver is made explicit here.
        """
        url = self.database_url.strip()
        for prefix in ("postgresql://", "postgres://"):
            if url.startswith(prefix):
                return "postgresql+psycopg://" + url[len(prefix) :]
        return url


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance (constructed on first call)."""
    return Settings()
