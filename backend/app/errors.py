"""Uniform error handling for the whole API.

Every failure answer has one shape::

    {"code": str, "message": str, "details": object | null}

with ``code`` in ``validation_error``, ``not_found``, ``conflict`` or
``booking_started``. No answer ever exposes a bare ``detail`` string.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """An application failure carrying the uniform error fields."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


_STATUS_CODE_TO_ERROR_CODE = {
    404: "not_found",
    409: "conflict",
    422: "validation_error",
}


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    """Render an :class:`ApiError` in the uniform shape."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message, "details": exc.details},
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Render framework ``HTTPException`` (incl. unmatched routes) uniformly."""
    code = _STATUS_CODE_TO_ERROR_CODE.get(exc.status_code, "error")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed"
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": code, "message": message, "details": None},
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Render request-validation errors with the offending field and reason."""
    errors = exc.errors()
    if errors:
        first = errors[0]
        location = [str(part) for part in first.get("loc", []) if part != "body"]
        field = ".".join(location) or "body"
        reason = str(first.get("msg", "Invalid value"))
    else:
        field, reason = "body", "Invalid request body"
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "message": "Validation failed",
            "details": {"field": field, "reason": reason},
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Attach every uniform-error handler to ``app``."""
    app.add_exception_handler(ApiError, api_error_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
